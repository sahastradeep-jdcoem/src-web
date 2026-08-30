/**
 * Client-Side Image Auto-Compression Utility
 * Compresses raw high-res DSLR/mobile photos to crystal-clear WebP/JPEG format
 * Reduces 5MB-15MB files down to 150KB-350KB before uploading to Firebase Storage.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default 0.82)
  outputFormat?: "image/webp" | "image/jpeg" | "image/png";
}

export interface CompressionResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  savingsPercentage: number;
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * Format bytes into human-readable string (KB, MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Compress an image file in the browser using HTML5 Canvas API
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.82,
    outputFormat = "image/webp",
  } = options;

  return new Promise((resolve, reject) => {
    // If file is SVG, return original without canvas processing
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          file,
          dataUrl: reader.result as string,
          originalSize: file.size,
          compressedSize: file.size,
          savingsPercentage: 0,
          dimensions: { width: 0, height: 0 },
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate proportional scale dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to create canvas rendering context"));
          return;
        }

        // High quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to Blob in WebP format
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Image compression failed"));
              return;
            }

            // Create compressed File instance
            const extension = outputFormat === "image/webp" ? ".webp" : ".jpg";
            const newFileName = file.name.replace(/\.[^/.]+$/, "") + extension;
            const compressedFile = new File([blob], newFileName, {
              type: outputFormat,
              lastModified: Date.now(),
            });

            const compressedDataUrl = canvas.toDataURL(outputFormat, quality);
            const savings = Math.max(
              0,
              Math.round(((file.size - blob.size) / file.size) * 100)
            );

            resolve({
              file: compressedFile,
              dataUrl: compressedDataUrl,
              originalSize: file.size,
              compressedSize: blob.size,
              savingsPercentage: savings,
              dimensions: { width, height },
            });
          },
          outputFormat,
          quality
        );
      };

      img.onerror = () => {
        reject(new Error("Failed to load image for compression"));
      };
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
  });
}
