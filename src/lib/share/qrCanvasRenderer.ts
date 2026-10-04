import QRCode from "qrcode";

/**
 * Loads an image from a URL into an HTMLImageElement with CORS crossOrigin support.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from ${src}`));
    img.src = src;
  });
}

export interface QrRenderOptions {
  size?: number;
  logoSrc?: string;
  logoRatio?: number;
  margin?: number;
}

export interface QrRenderResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  blob: Blob;
}

/**
 * High-Resolution (1024×1024) Branded QR Code Canvas Engine.
 * Produces a high-contrast, black-and-white QR code with Error Correction Level 'H' (30%)
 * and the official circular SRC emblem placed cleanly in the center with a quiet zone pad.
 */
export async function renderBrandedQRCode(
  url: string,
  options?: QrRenderOptions
): Promise<QrRenderResult> {
  if (!url || typeof url !== "string" || url.trim().length === 0) {
    throw new Error("Invalid or empty URL provided for QR generation");
  }

  const cleanUrl = url.trim();
  const size = options?.size || 1024;
  const logoSrc = options?.logoSrc || "/assets/SRC Logo.png";
  const logoRatio = options?.logoRatio || 0.20; // 20% of QR size for optimal scannability
  const margin = options?.margin !== undefined ? options.margin : 4; // Standard 4-module quiet zone

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  // 1. Render black-on-white QR with high error correction (H = 30%)
  await QRCode.toCanvas(canvas, cleanUrl, {
    width: size,
    margin,
    errorCorrectionLevel: "H",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to obtain 2D canvas rendering context");
  }

  // 2. Load official SRC circular logo
  try {
    const logoImg = await loadImage(logoSrc);

    // 3. Center coordinates and sizing
    const center = size / 2;
    const logoSize = Math.round(size * logoRatio);
    const radius = logoSize / 2;
    // Quiet padding between black QR modules and circular logo
    const quietPadding = Math.max(8, Math.round(logoSize * 0.08));

    ctx.save();

    // 4. Draw white circular background to excavate QR modules behind logo
    ctx.beginPath();
    ctx.arc(center, center, radius + quietPadding, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // 5. Draw the official circular SRC logo
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      logoImg,
      center - radius,
      center - radius,
      logoSize,
      logoSize
    );

    ctx.restore();
  } catch (err) {
    console.warn("[qrCanvasRenderer] SRC logo could not be embedded, falling back to base QR:", err);
  }

  // 6. Generate DataURL & Blob
  const dataUrl = canvas.toDataURL("image/png", 1.0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to export QR canvas as PNG blob"));
    }, "image/png", 1.0);
  });

  return { canvas, dataUrl, blob };
}

/**
 * Generates a clean, sanitized filename for the event QR code download.
 * Format: SRC-[sanitized-slug]-QR.png
 */
export function getQrDownloadFilename(url: string, title?: string): string {
  let slug = "";

  try {
    const urlObj = new URL(url);
    const segments = urlObj.pathname.split("/").filter(Boolean);
    const eventIdx = segments.indexOf("events");
    if (eventIdx !== -1 && segments[eventIdx + 1]) {
      slug = segments[eventIdx + 1];
    }
  } catch {
    const match = url.match(/\/events\/([a-zA-Z0-9_-]+)/);
    if (match) slug = match[1];
  }

  if (!slug) {
    slug = (title || "event")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const cleanSlug = slug.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 45) || "event";
  return `SRC-${cleanSlug}-QR.png`;
}
