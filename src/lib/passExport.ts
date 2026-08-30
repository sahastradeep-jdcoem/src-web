/**
 * Client-Side Delegate Pass Image Downloader (Zero Server Cost)
 * Captures the HTML delegate pass element and saves it directly to the student's phone/laptop.
 */

export async function downloadPassAsImage(elementId: string, filename = "SRC-JDCOEM-Delegate-Pass.png"): Promise<boolean> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element #${elementId} not found`);
      return false;
    }

    // Dynamically load html2canvas to avoid heavy bundle on initial page load
    const html2canvas = (await import("html2canvas")).default;
    
    const canvas = await html2canvas(element, {
      scale: 3, // High-res 300 DPI export
      useCORS: true,
      backgroundColor: "#FFFFFF",
      logging: false,
    });

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error("Pass export failed", error);
    return false;
  }
}
