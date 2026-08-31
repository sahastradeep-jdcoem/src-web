import { ref, uploadString, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./config";
import { compressImage } from "@/lib/imageCompression";

/**
 * Upload an image file or Base64 WebP string to Firebase Cloud Storage
 * Returns the permanent HTTPS download URL
 */
export async function uploadImageToStorage(
  fileOrDataUrl: File | string,
  storagePath: string
): Promise<string> {
  // If user provided a remote URL already (like unsplash or external CDN), return as-is
  if (typeof fileOrDataUrl === "string" && fileOrDataUrl.startsWith("http")) {
    return fileOrDataUrl;
  }

  try {
    if (storage && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const storageRef = ref(storage, storagePath);

      if (typeof fileOrDataUrl === "string") {
        // Base64 Data URL upload
        await uploadString(storageRef, fileOrDataUrl, "data_url");
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
      } else {
        // Compress file to WebP first
        const compressed = await compressImage(fileOrDataUrl, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.85,
          outputFormat: "image/webp",
        });

        await uploadString(storageRef, compressed.dataUrl, "data_url");
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
      }
    }
  } catch (error) {
    console.warn("Firebase Storage upload error, falling back to local compressed data URL:", error);
  }

  // Fallback if Firebase Storage rules block or offline: return the compressed dataUrl
  if (typeof fileOrDataUrl === "string") {
    return fileOrDataUrl;
  }
  const compressed = await compressImage(fileOrDataUrl, {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.8,
    outputFormat: "image/webp",
  });
  return compressed.dataUrl;
}
