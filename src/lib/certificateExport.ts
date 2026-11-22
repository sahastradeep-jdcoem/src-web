/**
 * High-Definition Client-Side Certificate Exporter (Zero Server Cost)
 * Renders the HTML Certificate element via html2canvas at 3x scale (~300 DPI print quality)
 * Guarantees that exported image matches the Live Preview pixel-for-pixel.
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

    // 1. Wait for custom web fonts to be completely ready
    if (typeof document !== "undefined" && document.fonts) {
      try {
        await document.fonts.ready;
        await Promise.allSettled([
          document.fonts.load("400 36px 'Great Vibes'"),
          document.fonts.load("400 44px 'Great Vibes'"),
          document.fonts.load("400 48px 'Great Vibes'"),
          document.fonts.load("400 54px 'Great Vibes'"),
          document.fonts.load("400 60px 'Great Vibes'"),
          document.fonts.load("800 36px 'Cinzel'"),
          document.fonts.load("800 48px 'Cinzel'"),
          document.fonts.load("700 12px 'Cinzel'"),
        ]);
      } catch (e) {
        console.warn("Font loading wait notice", e);
      }
    }

    // 2. Wait for all images inside the certificate to be fully decoded
    const allImgs = Array.from(element.querySelectorAll("img"));
    await Promise.allSettled(
      allImgs.map(async (img) => {
        if (!img.complete) {
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }
        if (img.decode) {
          await img.decode().catch(() => {});
        }
      })
    );

    // 3. Small flush delay for canvas rendering buffers
    await new Promise((resolve) => setTimeout(resolve, 120));

    // 4. Dynamically import html2canvas
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(element, {
      scale: 3, // 3x ultra-HD resolution (300 DPI equivalent)
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#FFFFFF", // Enforce pure white base
      logging: false,
      imageTimeout: 10000,
      removeContainer: true,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(elementId);
        if (clonedEl) {
          clonedEl.style.boxShadow = "none";

          // Convert wave SVG elements into HTML5 canvas in cloned DOM
          // This bypasses html2canvas's known bug where inline SVGs are dropped/invisible
          const waveSvgs = clonedEl.querySelectorAll<SVGElement>("svg[data-certificate-wave]");
          waveSvgs.forEach((svg) => {
            const waveType = svg.getAttribute("data-certificate-wave");
            const viewBox = svg.getAttribute("viewBox") || "0 0 300 220";
            const parts = viewBox.split(" ").map(Number);
            const w = parts[2] || (waveType === "bottom-right" ? 300 : 210);
            const h = parts[3] || (waveType === "bottom-right" ? 220 : 150);

            const canvasEl = clonedDoc.createElement("canvas");
            canvasEl.setAttribute("data-wave-canvas", "true");
            // 3x resolution matching scale: 3 for crystal-sharp output
            canvasEl.width = w * 3;
            canvasEl.height = h * 3;
            canvasEl.style.width = `${w}px`;
            canvasEl.style.height = `${h}px`;
            canvasEl.style.position = "absolute";
            canvasEl.style.bottom = "-4px";
            if (waveType === "bottom-right") {
              canvasEl.style.right = "-4px";
            } else {
              canvasEl.style.left = "-4px";
            }
            canvasEl.style.pointerEvents = "none";
            canvasEl.style.zIndex = "0";

            const ctx = canvasEl.getContext("2d");
            if (ctx) {
              ctx.scale(3, 3);

              // 1. Draw paths
              const paths = svg.querySelectorAll("path");
              paths.forEach((p) => {
                const d = p.getAttribute("d");
                if (!d) return;
                const fill = p.getAttribute("fill");
                const fillOpacity = parseFloat(p.getAttribute("fill-opacity") || "1");
                const stroke = p.getAttribute("stroke");
                const strokeWidth = parseFloat(p.getAttribute("stroke-width") || "1");
                const strokeOpacity = parseFloat(p.getAttribute("stroke-opacity") || "1");

                ctx.save();
                if (fill && fill !== "none") {
                  ctx.fillStyle = fill;
                  ctx.globalAlpha = fillOpacity;
                  ctx.fill(new Path2D(d));
                }
                if (stroke && stroke !== "none") {
                  ctx.strokeStyle = stroke;
                  ctx.lineWidth = strokeWidth;
                  ctx.globalAlpha = strokeOpacity;
                  ctx.lineCap = "round";
                  ctx.stroke(new Path2D(d));
                }
                ctx.restore();
              });

              // 2. Draw circles (sparkles)
              const circles = svg.querySelectorAll("circle");
              circles.forEach((c) => {
                const cx = parseFloat(c.getAttribute("cx") || "0");
                const cy = parseFloat(c.getAttribute("cy") || "0");
                const r = parseFloat(c.getAttribute("r") || "1.5");
                const fill = c.getAttribute("fill") || "#FFFFFF";
                const fillOpacity = parseFloat(c.getAttribute("fill-opacity") || "0.5");

                ctx.save();
                ctx.fillStyle = fill;
                ctx.globalAlpha = fillOpacity;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              });
            }

            if (svg.parentNode) {
              svg.parentNode.replaceChild(canvasEl, svg);
            }
          });

          // Prevent text clipping in cloned DOM
          const allText = clonedEl.querySelectorAll<HTMLElement>("p, span, h1, h2, h3, h4, h5, h6, strong");
          allText.forEach((node) => {
            node.style.overflow = "visible";
          });

          // Calibrate pill badge & text in cloned DOM for mathematically centered rendering in html2canvas
          const pillBadge = clonedEl.querySelector<HTMLElement>("[data-certificate-pill]");
          if (pillBadge) {
            pillBadge.style.position = "relative";
            pillBadge.style.top = "12.33px"; // Exactly 37px at 3x export resolution (kept as approved by user)
            pillBadge.style.paddingTop = "3.5px";
            pillBadge.style.paddingBottom = "8.5px";
            pillBadge.style.boxShadow = "none";
          }
          const pillText = clonedEl.querySelector<HTMLElement>("[data-certificate-pill-text]");
          if (pillText) {
            pillText.style.position = "relative";
            pillText.style.top = "-4px";
            pillText.style.lineHeight = "1";
            pillText.style.display = "inline-flex";
            pillText.style.alignItems = "center";
            pillText.style.justifyContent = "center";
          }

          // Calibrate recipient name in cloned DOM: move more up and guarantee clean separation above the ornamental line
          const nameHeading = clonedEl.querySelector<HTMLElement>("h2");
          if (nameHeading) {
            nameHeading.style.position = "relative";
            nameHeading.style.top = "-7px";
            nameHeading.style.marginBottom = "14px";
          }
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
