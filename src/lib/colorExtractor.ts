import { CertificateColorPalette } from "@/types/certificates";

export const DEFAULT_CERTIFICATE_PALETTES: Record<string, CertificateColorPalette> = {
  ocean: {
    // Exact palette from user reference image
    primary: "#0B2545",
    secondary: "#134074",
    accent: "#1D4ED8",
    pillBg: "#0B192C",
    pillText: "#FFFFFF",
    borderGlow: "rgba(29, 78, 216, 0.25)",
  },
  royalPurple: {
    primary: "#2E1065",
    secondary: "#4C1D95",
    accent: "#7C3AED",
    pillBg: "#1E1B4B",
    pillText: "#FFFFFF",
    borderGlow: "rgba(124, 58, 237, 0.25)",
  },
  emerald: {
    primary: "#064E3B",
    secondary: "#047857",
    accent: "#10B981",
    pillBg: "#022C22",
    pillText: "#FFFFFF",
    borderGlow: "rgba(16, 185, 129, 0.25)",
  },
  crimson: {
    primary: "#831843",
    secondary: "#9F1239",
    accent: "#E11D48",
    pillBg: "#4C0519",
    pillText: "#FFFFFF",
    borderGlow: "rgba(225, 29, 72, 0.25)",
  },
  amberGold: {
    primary: "#78350F",
    secondary: "#B45309",
    accent: "#F59E0B",
    pillBg: "#451A03",
    pillText: "#FFFFFF",
    borderGlow: "rgba(245, 158, 11, 0.25)",
  },
  midnightSlate: {
    primary: "#0F172A",
    secondary: "#1E293B",
    accent: "#38BDF8",
    pillBg: "#020617",
    pillText: "#FFFFFF",
    borderGlow: "rgba(56, 189, 248, 0.25)",
  },
};

/**
 * Converts RGB values to HSL
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
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Converts HSL to Hex color string
 */
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/**
 * Extracts a harmonious CertificateColorPalette from an image URL (such as an event 4:5 poster)
 * Runs safely in the browser using HTML5 Canvas pixel analysis.
 */
export async function extractPosterColorPalette(
  imageUrl?: string | null
): Promise<CertificateColorPalette> {
  if (!imageUrl || typeof window === "undefined") {
    return DEFAULT_CERTIFICATE_PALETTES.ocean;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    const timeout = setTimeout(() => {
      resolve(DEFAULT_CERTIFICATE_PALETTES.ocean);
    }, 2500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(DEFAULT_CERTIFICATE_PALETTES.ocean);
          return;
        }

        const width = 80;
        const height = 100;
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height).data;

        // Buckets for chromatic vibrant colors
        const colorCounts: Record<string, { count: number; h: number; s: number; l: number }> = {};

        for (let i = 0; i < imageData.length; i += 16) { // Sample every 4th pixel
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          const a = imageData[i + 3];

          if (a < 128) continue; // Skip transparent pixels

          const [h, s, l] = rgbToHsl(r, g, b);

          // Disregard near-black, near-white, or washed-out gray pixels
          if (l < 15 || l > 88 || s < 25) continue;

          // Round hue to nearest 15 degrees to group similar tones
          const bucketH = Math.round(h / 15) * 15;
          const bucketKey = `${bucketH}`;

          if (!colorCounts[bucketKey]) {
            colorCounts[bucketKey] = { count: 0, h: bucketH, s, l };
          }
          colorCounts[bucketKey].count++;
        }

        const sorted = Object.values(colorCounts).sort((a, b) => b.count - a.count);

        if (sorted.length === 0) {
          resolve(DEFAULT_CERTIFICATE_PALETTES.ocean);
          return;
        }

        const dominant = sorted[0];
        const h = dominant.h;

        // Construct high-contrast, prestigious academic certificate palette
        // 1. Primary: Rich deep dark tone (L: 18-22%)
        const primary = hslToHex(h, Math.min(85, Math.max(50, dominant.s)), 18);
        
        // 2. Secondary: Saturated mid tone for fluid wave gradients (L: 32-38%)
        const secondary = hslToHex((h + 5) % 360, Math.min(80, Math.max(45, dominant.s)), 32);

        // 3. Accent: Radiant tone for wave highlights & borders (L: 50-60%)
        const accent = hslToHex((h + 10) % 360, Math.min(95, Math.max(65, dominant.s)), 52);

        // 4. Pill background: Dark, crisp pill base with slight hue tint (L: 10-12%)
        const pillBg = hslToHex(h, 60, 10);

        resolve({
          primary,
          secondary,
          accent,
          pillBg,
          pillText: "#FFFFFF",
          borderGlow: `rgba(${parseInt(primary.slice(1, 3), 16)}, ${parseInt(primary.slice(3, 5), 16)}, ${parseInt(primary.slice(5, 7), 16)}, 0.25)`,
        });
      } catch (err) {
        console.warn("Could not extract poster palette, falling back to ocean default", err);
        resolve(DEFAULT_CERTIFICATE_PALETTES.ocean);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(DEFAULT_CERTIFICATE_PALETTES.ocean);
    };

    img.src = imageUrl;
  });
}
