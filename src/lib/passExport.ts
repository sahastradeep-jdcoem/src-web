/**
 * Client-Side Delegate Pass Image Downloader (Zero Server Cost)
 * Captures the HTML delegate pass element and saves it directly to the student's phone/laptop.
 * Optimized for Mobile (iOS Safari & Android Chrome) via Web Share API & Blob fallbacks.
 */

export async function downloadPassAsImage(
  elementId: string,
  filename = "SRC-JDCOEM-Delegate-Pass.png"
): Promise<boolean> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element #${elementId} not found`);
      return false;
    }

    // Dynamically load html2canvas to avoid heavy bundle on initial page load
    const html2canvas = (await import("html2canvas")).default;

    // Timeout promise to guarantee the button never hangs indefinitely on mobile
    const renderPromise = html2canvas(element, {
      scale: 2, // 2x scale gives crystal-clear 150-200 DPI without exhausting mobile WebKit memory
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#FFFFFF",
      logging: false,
      imageTimeout: 2500,
      removeContainer: true,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(elementId);
        if (clonedEl) {
          clonedEl.style.transform = "none";
          clonedEl.style.boxShadow = "none";
        }
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Pass generation timed out on device")), 4500)
    );

    const canvas = await Promise.race([renderPromise, timeoutPromise]);

    return new Promise<boolean>((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          // Fallback to dataUrl
          try {
            const dataUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            resolve(true);
          } catch {
            resolve(false);
          }
          return;
        }

        const file = new File([blob], filename, { type: "image/png" });

        // Mobile Web Share API: On iOS Safari and Android Chrome, triggers native "Save Image" / "Photos" / "WhatsApp"
        if (
          typeof navigator !== "undefined" &&
          navigator.canShare &&
          navigator.canShare({ files: [file] })
        ) {
          try {
            await navigator.share({
              files: [file],
              title: "SRC Official Delegate Pass",
              text: "Official Delegate Pass - SRC Sahastradeep, JDCOEM",
            });
            resolve(true);
            return;
          } catch (err: any) {
            // If user closed share sheet (AbortError), treat as completed
            if (err?.name === "AbortError") {
              resolve(true);
              return;
            }
          }
        }

        // Standard Blob Download for Desktop / Fallback
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 1500);

        resolve(true);
      }, "image/png", 0.95);
    });
  } catch (error) {
    console.error("Pass export error:", error);
    // Graceful fallback for mobile: trigger print dialog if rendering fails
    if (typeof window !== "undefined") {
      try {
        window.print();
        return true;
      } catch {
        // do nothing
      }
    }
    return false;
  }
}
