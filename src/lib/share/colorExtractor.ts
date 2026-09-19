import { StoryPalette } from "./types";

export const DEFAULT_STORY_PALETTE: StoryPalette = {
  primaryAccent: "#17458F",
  deepBase: "#070D1A",
  midBase: "#0E234A",
  glowColor: "rgba(231, 128, 35, 0.28)",
  cardBorder: "rgba(255, 255, 255, 0.22)",
  textColor: "#FFFFFF",
  brandColor: "#E78023",
};

/**
 * Safely resolves an image URL for cross-origin canvas access.
 * Routes remote HTTP/HTTPS images through our secure `/api/proxy-image` route
 * to avoid canvas CORS tainting.
 */
export function getProxiedImageUrl(originalUrl?: string): string {
  if (!originalUrl) return "/assets/SRC Logo.png";
  const trimmed = originalUrl.trim();

  // Local assets and data URLs are already safe and same-origin
  if (trimmed.startsWith("/") || trimmed.startsWith("data:")) {
    return trimmed;
  }

  // Remote URLs go through our authenticated same-origin image proxy
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return `/api/proxy-image?url=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}

/**
 * Converts RGB to HSL for color harmonics analysis
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s, l];
}

/**
 * Converts HSL values back to hex string
 */
function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extracts a harmonized, deep dark palette from an image for Instagram Story canvas rendering.
 * Runs in under 30ms via a 48x48 pixel thumbnail sampling.
 */
export async function extractStoryPalette(imageUrl?: string): Promise<StoryPalette> {
  if (typeof window === "undefined" || !imageUrl) {
    return DEFAULT_STORY_PALETTE;
  }

  try {
    const proxiedUrl = getProxiedImageUrl(imageUrl);

    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Image load timeout")), 4000);
      img.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Image load failed"));
      };
      img.src = proxiedUrl;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return DEFAULT_STORY_PALETTE;

    const sampleSize = 48;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    let mostVibrantHue = 215; // default navy
    let maxSaturation = 0;

    for (let i = 0; i < imageData.length; i += 16) { // Sample every 4th pixel
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      const a = imageData[i + 3];

      if (a < 128) continue; // Ignore transparent pixels

      const [h, s, l] = rgbToHsl(r, g, b);

      // Look for vibrant accents (avoiding stark white or pure black)
      if (s > maxSaturation && l > 0.18 && l < 0.85) {
        maxSaturation = s;
        mostVibrantHue = h;
      }

      totalR += r;
      totalG += g;
      totalB += b;
      count++;
    }

    if (count === 0) return DEFAULT_STORY_PALETTE;

    const [avgH] = rgbToHsl(totalR / count, totalG / count, totalB / count);
    const chosenHue = maxSaturation > 0.25 ? mostVibrantHue : (avgH || 215);

    // Build a cohesive dark gradient scheme around the chosen hue
    const deepBase = hslToHex(chosenHue, 0.45, 0.06); // Extremely dark midnight tone
    const midBase = hslToHex(chosenHue, 0.55, 0.14);  // Deep saturated tone
    const primaryAccent = hslToHex(chosenHue, 0.75, 0.48); // Vibrant spotlight color

    return {
      primaryAccent,
      deepBase,
      midBase,
      glowColor: `rgba(${Math.round(totalR / count)}, ${Math.round(totalG / count)}, ${Math.round(totalB / count)}, 0.35)`,
      cardBorder: "rgba(255, 255, 255, 0.24)",
      textColor: "#FFFFFF",
      brandColor: "#E78023",
    };
  } catch (error) {
    console.warn("[colorExtractor] Could not extract palette, using signature Sahastradeep colors:", error);
    return DEFAULT_STORY_PALETTE;
  }
}
