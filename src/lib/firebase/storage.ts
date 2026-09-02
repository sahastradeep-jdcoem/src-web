import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "./config";
import { compressImage } from "@/lib/imageCompression";

const UPLOAD_TIMEOUT_MS = 12000; // 12s so HD WebP uploads reliably over mobile networks

/**
 * Upload an image file or Base64 WebP string to Firebase Cloud Storage.
 * Uses a safe timeout race to ensure the UI never hangs if Storage rules or network are slow.
 * Returns the permanent HTTPS download URL if successful, or the local compressed WebP data URL on fallback.
 */
export async function uploadImageToStorage(
  fileOrDataUrl: File | string,
  storagePath: string
): Promise<string> {
  // If user provided a remote URL already (like unsplash or external CDN), return as-is
  if (typeof fileOrDataUrl === "string" && fileOrDataUrl.startsWith("http")) {
    return fileOrDataUrl;
  }

  let finalDataUrl = "";
  if (typeof fileOrDataUrl === "string") {
    finalDataUrl = fileOrDataUrl;
  } else {
    try {
      const compressed = await compressImage(fileOrDataUrl, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.88,
        outputFormat: "image/webp",
      });
      finalDataUrl = compressed.dataUrl;
    } catch {
      return "";
    }
  }

  // Attempt Firebase Cloud Storage upload with strict timeout race
  try {
    if (storage && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const storageRef = ref(storage, storagePath);

      const isPng = finalDataUrl.includes("image/png");
      const metadata = {
        contentType: isPng ? "image/png" : "image/webp",
      };

      const uploadTask = (async () => {
        await uploadString(storageRef, finalDataUrl, "data_url", metadata);
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
      })();

      const timeoutTask = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error("Storage upload timed out")), UPLOAD_TIMEOUT_MS);
      });

      const cloudUrl = await Promise.race([uploadTask, timeoutTask]);
      if (cloudUrl && cloudUrl.startsWith("http")) {
        return cloudUrl;
      }
    }
  } catch (error) {
    console.warn("Firebase Storage fast fallback active (using optimized WebP):", (error as any)?.message || error);
  }

  // Fallback: return the lightweight compressed WebP data URL
  return finalDataUrl;
}
