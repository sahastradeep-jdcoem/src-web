import { ref, uploadBytes, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "./config";
import { compressImage } from "@/lib/imageCompression";

const UPLOAD_TIMEOUT_MS = 6000; // 6s fast timeout for background cloud upload attempt

/**
 * Convert a base64 Data URL to a native binary Blob for streaming upload
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Upload an image file or Base64 WebP string to Firebase Cloud Storage.
 * Uses binary streaming for ultra-fast, lightweight uploads.
 * If Firebase Storage bucket is unreachable or unprovisioned, gracefully returns the
 * optimized WebP data URL for direct instant Firestore synchronization.
 */
export async function uploadImageToStorage(
  fileOrDataUrl: File | string,
  storagePath: string,
  options?: { throwOnError?: boolean }
): Promise<string> {
  // If user provided a remote URL already (like unsplash or external CDN), return as-is
  if (typeof fileOrDataUrl === "string" && fileOrDataUrl.startsWith("http")) {
    return fileOrDataUrl;
  }

  const throwOnError = options?.throwOnError ?? true;

  if (!storage || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    const msg = "Firebase Cloud Storage is not configured on this client.";
    if (throwOnError) throw new Error(msg);
    console.warn("Storage upload notice:", msg);
    return typeof fileOrDataUrl === "string" ? fileOrDataUrl : "";
  }

  try {
    const storageRef = ref(storage, storagePath);

    const uploadTask = (async () => {
      if (fileOrDataUrl instanceof File) {
        await uploadBytes(storageRef, fileOrDataUrl, {
          contentType: fileOrDataUrl.type || "image/jpeg",
        });
      } else {
        // High-res Data URL string -> convert to binary Blob for faster, reliable streaming
        const isPng = fileOrDataUrl.includes("image/png");
        const blob = await dataUrlToBlob(fileOrDataUrl);
        await uploadBytes(storageRef, blob, {
          contentType: isPng ? "image/png" : "image/webp",
        });
      }
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    })();

    const timeoutTask = new Promise<string>((_, reject) => {
      setTimeout(
        () => reject(new Error("Storage upload timed out (6s).")),
        UPLOAD_TIMEOUT_MS
      );
    });

    const cloudUrl = await Promise.race([uploadTask, timeoutTask]);
    if (cloudUrl && cloudUrl.startsWith("http")) {
      return cloudUrl;
    }
    throw new Error("Cloud Storage did not return a valid download URL.");
  } catch (error: any) {
    console.error("Firebase Storage upload failure:", error?.message || error);
    if (throwOnError) {
      throw error;
    }
    return typeof fileOrDataUrl === "string" ? fileOrDataUrl : "";
  }
}
