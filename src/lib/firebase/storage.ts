import { ref, uploadBytes, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "./config";
import { compressImage } from "@/lib/imageCompression";

const UPLOAD_TIMEOUT_MS = 8000; // 8s safe timeout so UI is always responsive

/**
 * Upload an image file or Base64 WebP string to Firebase Cloud Storage.
 * Uses a safe timeout race to ensure the UI never hangs if Storage rules or network are slow.
 * Uploads pristine original files directly to preserve 100% camera clarity with zero compression loss.
 * Returns the permanent HTTPS download URL if successful, or the local data URL on fallback.
 */
export async function uploadImageToStorage(
  fileOrDataUrl: File | string,
  storagePath: string
): Promise<string> {
  // If user provided a remote URL already (like unsplash or external CDN), return as-is
  if (typeof fileOrDataUrl === "string" && fileOrDataUrl.startsWith("http")) {
    return fileOrDataUrl;
  }

  // Attempt Firebase Cloud Storage upload with pristine fidelity
  try {
    if (storage && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const storageRef = ref(storage, storagePath);

      const uploadTask = (async () => {
        if (fileOrDataUrl instanceof File) {
          // UPLOAD ORIGINAL FILE DIRECTLY TO FIREBASE STORAGE (100% UNCOMPRESSED CRISPNESS)
          await uploadBytes(storageRef, fileOrDataUrl, {
            contentType: fileOrDataUrl.type || "image/jpeg",
          });
        } else {
          // It's a high-res Data URL string
          const isPng = fileOrDataUrl.includes("image/png");
          await uploadString(storageRef, fileOrDataUrl, "data_url", {
            contentType: isPng ? "image/png" : "image/webp",
          });
        }
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
    console.warn("Firebase Storage direct upload notice:", (error as any)?.message || error);
  }

  // Fallback: if it was a file and storage is unreachable, generate ultra high-res data URL
  if (fileOrDataUrl instanceof File) {
    try {
      const isPng = fileOrDataUrl.type === "image/png" || fileOrDataUrl.type === "image/svg+xml";
      const compressed = await compressImage(fileOrDataUrl, {
        maxWidth: 2560,
        maxHeight: 2560,
        quality: 0.95,
        outputFormat: isPng ? "image/png" : "image/webp",
      });
      return compressed.dataUrl;
    } catch {
      return "";
    }
  }

  return fileOrDataUrl;
}
