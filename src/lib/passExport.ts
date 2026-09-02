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

    // Ensure all web fonts and document fonts are fully loaded before capturing
    if (typeof document !== "undefined" && document.fonts) {
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn("Font loading wait notice", e);
      }
    }

    // Small delay to ensure any layout calculations or SVG/canvas QR codes are flushed
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Dynamically load html2canvas
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(element, {
      scale: 3, // 3x ultra-HD resolution (300 DPI equivalent) for razor-sharp text and QR codes
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#FFFFFF",
      logging: false,
      imageTimeout: 8000,
      removeContainer: true,
      windowWidth: 1024, // Consistent landscape viewport for render stability
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(elementId);
        if (clonedEl) {
          clonedEl.style.transform = "none";
          clonedEl.style.boxShadow = "none";
          clonedEl.style.width = "720px";
          clonedEl.style.minWidth = "720px";
          clonedEl.style.maxWidth = "720px";
          clonedEl.style.margin = "0 auto";
          clonedEl.style.letterSpacing = "normal";

          // Prevent text clipping by resetting line-heights and removing restrictive overflows
          const textElements = clonedEl.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span, div, strong");
          textElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            // Prevent truncation clipping in canvas
            if (htmlEl.classList.contains("truncate")) {
              htmlEl.style.overflow = "visible";
              htmlEl.style.textOverflow = "clip";
              htmlEl.style.whiteSpace = "normal";
            }
            // Add padding-bottom breathing room for letter descenders (g, j, p, q, y)
            if (htmlEl.tagName.startsWith("H") || htmlEl.classList.contains("font-heading")) {
              htmlEl.style.lineHeight = "1.3";
              htmlEl.style.paddingBottom = "4px";
              htmlEl.style.display = "block";
            } else if (htmlEl.tagName === "P" || htmlEl.tagName === "SPAN") {
              htmlEl.style.lineHeight = "1.4";
            }
          });

          // Ensure logo img tags are rendered with explicit dimensions and no distortion
          const images = clonedEl.querySelectorAll("img");
          images.forEach((img) => {
            img.style.objectFit = "contain";
            img.style.display = "block";
            if (img.alt === "SRC Logo") {
              img.style.width = "48px";
              img.style.height = "48px";
              img.style.minWidth = "48px";
              img.style.minHeight = "48px";
            }
          });
        }
      },
    });

    const dataUrl = canvas.toDataURL("image/png");

    // Convert to Blob
    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), "image/png", 1.0);
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
