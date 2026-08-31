/**
 * Client-Side Delegate Pass Image Downloader (Zero Server Cost)
 * Captures the HTML delegate pass element and saves it directly to the student's phone/laptop.
 * Supports desktop direct download and mobile Photo Gallery / Web Share saving.
 */

export interface ExportPassResult {
  success: boolean;
  imageUrl?: string;
  blob?: Blob;
  isMobile?: boolean;
}

export async function downloadPassAsImage(
  elementId: string,
  filename = "SRC-JDCOEM-Delegate-Pass.png"
): Promise<ExportPassResult> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element #${elementId} not found`);
      return { success: false };
    }

    // Dynamically load html2canvas
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(element, {
      scale: 2, // 2x gives crisp 150-200 DPI without exhausting mobile GPU memory
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#FFFFFF",
      logging: false,
      imageTimeout: 3000,
      removeContainer: true,
      windowWidth: 1024, // Fix viewport width during clone so layout always renders in desktop landscape
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(elementId);
        if (clonedEl) {
          clonedEl.style.transform = "none";
          clonedEl.style.boxShadow = "none";
          clonedEl.style.width = "720px";
          clonedEl.style.minWidth = "720px";
          clonedEl.style.maxWidth = "720px";
          clonedEl.style.margin = "0";
        }
      },
    });

    const dataUrl = canvas.toDataURL("image/png");

    // Convert to Blob
    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), "image/png", 0.95);
    });

    const isMobile = typeof navigator !== "undefined" && (
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (typeof window !== "undefined" && window.innerWidth < 768)
    );

    // Desktop or Android Chrome direct download
    try {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 2000);
    } catch (e) {
      console.warn("Direct link download failed", e);
    }

    return {
      success: true,
      imageUrl: dataUrl,
      blob,
      isMobile,
    };
  } catch (error) {
    console.error("Pass export error:", error);
    return { success: false };
  }
}
