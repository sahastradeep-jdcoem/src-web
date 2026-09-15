/**
 * Universal Image System — Storage Abstraction Layer
 *
 * Decouples the image upload UI from the underlying storage mechanism.
 * On Firebase Spark (current), images are stored as inline WebP base64 data URLs
 * directly in Firestore documents. On Firebase Blaze (future), images are streamed
 * as binary blobs to Firebase Cloud Storage and the CDN download URL is persisted.
 *
 * Switching from Spark to Blaze requires setting NEXT_PUBLIC_STORAGE_MODE=cloud
 * in .env — zero UI code changes needed.
 */

import type { ImagePurpose } from "./imageProfiles";
import { getImageProfile } from "./imageProfiles";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StorageMode = "spark_inline" | "cloud_storage";

export interface ImageUploadOptions {
  purpose: ImagePurpose;
  storagePath: string;
  fileName?: string;
}

export interface ImageUploadResult {
  /** The final URL — data:image/webp;base64,... on Spark, https://... on Blaze */
  url: string;
  /** Which storage backend was used */
  storageMode: StorageMode;
  /** Byte size of the persisted image */
  sizeBytes: number;
  /** Pixel dimensions of the output */
  dimensions: { width: number; height: number };
  /** The purpose profile used */
  purpose: ImagePurpose;
}

export interface IImageStorageAdapter {
  readonly mode: StorageMode;
  upload(
    dataUrl: string,
    options: ImageUploadOptions
  ): Promise<ImageUploadResult>;
  delete?(pathOrUrl: string): Promise<boolean>;
}

// ─── Spark Inline Adapter ────────────────────────────────────────────────────

/**
 * Validates that the optimized WebP data URL is within document safety limits,
 * then returns it for direct Firestore document persistence.
 * This is the default on Firebase Spark (free tier).
 */
class SparkInlineStorageAdapter implements IImageStorageAdapter {
  readonly mode: StorageMode = "spark_inline";

  async upload(
    dataUrl: string,
    options: ImageUploadOptions
  ): Promise<ImageUploadResult> {
    if (!dataUrl || !dataUrl.startsWith("data:")) {
      throw new Error("[UIS/Spark] Invalid data URL provided for inline storage.");
    }

    const profile = getImageProfile(options.purpose);
    const byteLength = new Blob([dataUrl]).size;

    if (byteLength > profile.maxInlineBytes) {
      console.warn(
        `[UIS/Spark] Image for "${options.purpose}" is ${byteLength} bytes ` +
        `(limit: ${profile.maxInlineBytes}). It will still be stored but may ` +
        `contribute to Firestore document size pressure.`
      );
    }

    // Extract rough dimensions from a very quick canvas probe (non-blocking)
    const dimensions = await this.probeDimensions(dataUrl);

    return {
      url: dataUrl,
      storageMode: "spark_inline",
      sizeBytes: byteLength,
      dimensions,
      purpose: options.purpose,
    };
  }

  private probeDimensions(
    dataUrl: string
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      if (typeof window === "undefined") {
        resolve({ width: 0, height: 0 });
        return;
      }
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = dataUrl;
    });
  }
}

// ─── Cloud Storage Adapter (Blaze-Native) ────────────────────────────────────

/**
 * Streams binary blobs to Firebase Cloud Storage and returns the permanent CDN download URL.
 * Active by default on the Firebase Blaze plan with 1-year immutable Google CDN caching.
 */
class CloudStorageAdapter implements IImageStorageAdapter {
  readonly mode: StorageMode = "cloud_storage";

  async upload(
    dataUrl: string,
    options: ImageUploadOptions
  ): Promise<ImageUploadResult> {
    const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
    const { storage } = await import("@/lib/firebase/config");

    if (!storage) {
      throw new Error("[UIS/Cloud] Firebase Cloud Storage is not configured.");
    }

    const isPng = dataUrl.includes("image/png");
    const contentType = isPng ? "image/png" : "image/webp";
    const ext = isPng ? ".png" : ".webp";

    const cleanName = (options.fileName || "image")
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/\.[^/.]+$/, "");
    const finalPath = `${options.storagePath}/${Date.now()}_${cleanName}${ext}`;

    // Convert data URL to binary Blob for efficient streaming upload
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const storageRef = ref(storage, finalPath);

    // Reliable 30-second timeout for Blaze Cloud CDN delivery
    const uploadTask = (async () => {
      await uploadBytes(storageRef, blob, {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
      });
      return await getDownloadURL(storageRef);
    })();

    const timeoutTask = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error("[UIS/Cloud] Cloud Storage upload timed out (30s).")), 30000);
    });

    const cloudUrl = await Promise.race([uploadTask, timeoutTask]);

    if (!cloudUrl || !cloudUrl.startsWith("http")) {
      throw new Error("[UIS/Cloud] Upload completed but no valid download URL returned.");
    }

    const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
      if (typeof window === "undefined") {
        resolve({ width: 0, height: 0 });
        return;
      }
      const img = new window.Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = dataUrl;
    });

    return {
      url: cloudUrl,
      storageMode: "cloud_storage",
      sizeBytes: blob.size,
      dimensions,
      purpose: options.purpose,
    };
  }
}

// ─── Direct Base64 to Cloud Storage Helper ───────────────────────────────────

/**
 * Directly converts a Base64 data URL to a binary Blob, streams it to Firebase Cloud Storage,
 * and returns the permanent HTTPS Google Cloud CDN URL.
 */
export async function uploadBase64ToCloudStorage(
  dataUrl: string,
  storagePath: string
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }

  const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
  const { storage } = await import("@/lib/firebase/config");

  if (!storage) {
    throw new Error("Firebase Cloud Storage is not initialized.");
  }

  const isPng = dataUrl.includes("image/png");
  const contentType = isPng ? "image/png" : "image/webp";

  const response = await fetch(dataUrl);
  const blob = await response.blob();

  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, {
    contentType,
    cacheControl: "public, max-age=31536000, immutable",
  });

  return await getDownloadURL(storageRef);
}

// ─── Factory ─────────────────────────────────────────────────────────────────

let _cachedAdapter: IImageStorageAdapter | null = null;

/**
 * Returns the appropriate storage adapter.
 *
 * Defaults to `CloudStorageAdapter` on the Blaze plan whenever Cloud Storage is configured.
 * Falls back to `SparkInlineStorageAdapter` only if explicitly forced or offline.
 */
export function getImageStorageService(): IImageStorageAdapter {
  if (_cachedAdapter) return _cachedAdapter;

  const mode = process.env.NEXT_PUBLIC_STORAGE_MODE;

  // On Blaze (default), use CloudStorageAdapter unless explicitly forced to spark_inline
  if (mode === "spark_inline") {
    _cachedAdapter = new SparkInlineStorageAdapter();
  } else {
    _cachedAdapter = new CloudStorageAdapter();
  }

  return _cachedAdapter;
}

/**
 * Convenience: detect the current storage mode from the environment.
 */
export function getCurrentStorageMode(): StorageMode {
  return process.env.NEXT_PUBLIC_STORAGE_MODE === "spark_inline"
    ? "spark_inline"
    : "cloud_storage";
}

/**
 * Convenience: check if we're running on Spark (inline base64 storage).
 */
export function isSparkMode(): boolean {
  return getCurrentStorageMode() === "spark_inline";
}
