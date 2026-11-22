/**
 * High-Definition Client-Side Certificate Exporter (Zero Server Cost)
 * Renders the HTML Certificate element via html2canvas at 3x scale (~300 DPI print quality)
 * Supports desktop direct download, mobile Web Share / Camera Roll saving, and A4 landscape printing.
 */

export interface ExportCertificateResult {
  success: boolean;
  imageUrl?: string;
  blob?: Blob;
  isMobile?: boolean;
}

export async function downloadCertificateAsImage(
  elementId: string,
  filename = "SRC-JDCOEM-Official-Certificate.png"
): Promise<ExportCertificateResult> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Certificate element #${elementId} not found`);
      return { success: false };
    }

    // Wait for fonts to be ready
    if (typeof document !== "undefined" && document.fonts) {
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn("Font loading wait notice", e);
      }
    }

    // Small delay to allow canvas / SVG QR codes to flush
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Dynamically import html2canvas
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(element, {
      scale: 3, // 3x ultra-HD resolution (300 DPI equivalent)
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#FFFFFF", // Enforce pure white base
      logging: false,
      imageTimeout: 10000,
      removeContainer: true,
      windowWidth: 1200,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(elementId);
        if (clonedEl) {
          clonedEl.style.transform = "none";
          clonedEl.style.boxShadow = "none";
          clonedEl.style.width = "1040px";
          clonedEl.style.minWidth = "1040px";
          clonedEl.style.maxWidth = "1040px";
          clonedEl.style.margin = "0 auto";
          clonedEl.style.backgroundColor = "#FFFFFF";

          // Prevent text clipping in cloned DOM
          const allText = clonedEl.querySelectorAll<HTMLElement>("p, span, h1, h2, h3, h4, h5, h6, strong");
          allText.forEach((node) => {
            node.style.overflow = "visible";
          });
        }
      },
    });

    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          resolve({ success: false });
          return;
        }

        const cleanFilename = filename.endsWith(".png") ? filename : `${filename}.png`;

        // 1. Mobile Web Share API support (save to photos / share sheet)
        if (isMobile && navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], cleanFilename, { type: "image/png" });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: "Official SRC JDCOEM Certificate",
                text: "Here is my official credential from Student Representation Council, JDCOEM Nagpur.",
              });
              resolve({ success: true, isMobile: true, blob });
              return;
            }
          } catch (shareErr) {
            console.warn("Web Share cancelled or failed, falling back to direct anchor download", shareErr);
          }
        }

        // 2. Direct browser anchor download
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = cleanFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1500);

        resolve({ success: true, imageUrl: url, blob, isMobile });
      }, "image/png");
    });
  } catch (error) {
    console.error("Certificate image download failed:", error);
    return { success: false };
  }
}

/**
 * Triggers standard browser print dialog optimized for A4 Landscape
 */
export function printCertificate(): void {
  if (typeof window !== "undefined") {
    window.print();
  }
}
