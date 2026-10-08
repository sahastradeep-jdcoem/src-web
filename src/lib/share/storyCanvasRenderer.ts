import QRCode from "qrcode";
import { SocialSharePayload, StoryPalette, StoryRenderOptions } from "./types";
import { getProxiedImageUrl, DEFAULT_STORY_PALETTE } from "./colorExtractor";

/**
 * Loads an image from a URL into an HTMLImageElement with CORS crossOrigin support.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Helper to draw a rounded rectangle on a canvas.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Smart line wrapping for titles on Canvas with safe ellipsis truncation.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 3
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) {
        // Last permitted line, append remainder and truncate with ellipsis if needed
        const remaining = words.slice(i).join(" ");
        let truncated = remaining;
        while (ctx.measureText(truncated + "…").width > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1).trim();
        }
        lines.push(truncated + "…");
        return lines;
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.slice(0, maxLines);
}

/**
 * Ultra-High-Resolution 1080 × 1920 Instagram Story Canvas Engine.
 * Single Authoritative Creative Direction: "Cosmic Obsidian & Sahastradeep Amber".
 * Designed with senior graphic design principles: volumetric lighting, floating acrylic plaque,
 * VIP festival pass HUD badges, luminous typography, and an illuminated interactive CTA capsule.
 */
export async function renderStoryToCanvas(
  payload: SocialSharePayload,
  palette: StoryPalette = DEFAULT_STORY_PALETTE,
  options: StoryRenderOptions = {}
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  // Enable high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // =========================================================================
  // 1. VOLUMETRIC COSMIC CANVAS (Deep Obsidian to Luminous Royal Sapphire)
  // =========================================================================
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
  bgGrad.addColorStop(0, "#030712");    // Deep obsidian navy
  bgGrad.addColorStop(0.25, "#0A1B3B"); // Luminous royal sapphire core
  bgGrad.addColorStop(0.60, "#061025"); // Deep twilight navy
  bgGrad.addColorStop(1, "#020409");    // Pure cosmic obsidian
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Tactile film grit stippling (3.5% opacity) to eliminate digital banding & add print prestige
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  for (let i = 0; i < 8500; i++) {
    const nx = Math.random() * 1080;
    const ny = Math.random() * 1920;
    ctx.fillRect(nx, ny, 1.5, 1.5);
  }
  ctx.restore();

  // =========================================================================
  // 2. VOLUMETRIC ATMOSPHERIC LIGHTING & AURA LAYERS
  // =========================================================================
  ctx.save();
  // A. Top-Right Sahastradeep Amber Ember Aura
  const orangeAura = ctx.createRadialGradient(980, 240, 30, 980, 240, 720);
  orangeAura.addColorStop(0, "rgba(231, 128, 35, 0.32)");
  orangeAura.addColorStop(0.5, "rgba(231, 128, 35, 0.08)");
  orangeAura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = orangeAura;
  ctx.fillRect(360, 0, 720, 920);

  // B. Mid-Left Electric Sapphire Backlight (Illuminates content side)
  const blueAura = ctx.createRadialGradient(140, 780, 40, 140, 780, 780);
  blueAura.addColorStop(0, "rgba(23, 69, 143, 0.40)");
  blueAura.addColorStop(0.6, "rgba(23, 69, 143, 0.10)");
  blueAura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = blueAura;
  ctx.fillRect(0, 280, 840, 1040);

  // C. Bottom-Center Warm Glow (Subtly illuminates the CTA capsule)
  const bottomGlow = ctx.createRadialGradient(540, 1680, 50, 540, 1680, 560);
  bottomGlow.addColorStop(0, "rgba(231, 128, 35, 0.22)");
  bottomGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(80, 1360, 920, 560);

  // D. Hero Artwork Plaque Spotlight (Volumetric backlight framing the 16:9 poster)
  const heroSpotlight = ctx.createRadialGradient(540, 510, 80, 540, 510, 640);
  heroSpotlight.addColorStop(0, "rgba(255, 255, 255, 0.09)");
  heroSpotlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = heroSpotlight;
  ctx.fillRect(0, 120, 1080, 800);
  ctx.restore();

  // =========================================================================
  // 3. ARCHITECTURAL GRAPHIC MARKINGS & ISOMETRIC ACCENTS
  // =========================================================================
  // Elegant diagonal diamond mesh lines (subtle 1.8% opacity)
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.018)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -1920; i < 1920; i += 120) {
    ctx.moveTo(0, i);
    ctx.lineTo(1080, i + 1080);
    ctx.moveTo(1080, i);
    ctx.lineTo(0, i + 1080);
  }
  ctx.stroke();
  ctx.restore();

  // Architectural registration crosshairs (+) at outer safe boundaries
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1.5;
  const crossSize = 14;
  const crossPoints = [
    { x: 48, y: 48 },
    { x: 1032, y: 48 },
    { x: 48, y: 1872 },
    { x: 1032, y: 1872 },
  ];
  crossPoints.forEach(({ x, y }) => {
    ctx.beginPath();
    ctx.moveTo(x - crossSize, y);
    ctx.lineTo(x + crossSize, y);
    ctx.moveTo(x, y - crossSize);
    ctx.lineTo(x, y + crossSize);
    ctx.stroke();
  });
  ctx.restore();

  // Preload Hero Artwork Image
  let heroImg: HTMLImageElement | null = null;
  if (payload.imageUrl) {
    try {
      const proxiedUrl = getProxiedImageUrl(payload.imageUrl);
      heroImg = await loadImage(proxiedUrl);
    } catch {
      console.warn("[storyCanvasRenderer] Could not load hero image for card");
    }
  }

  // Preload SRC Logo
  let srcLogoImg: HTMLImageElement | null = null;
  try {
    srcLogoImg = await loadImage("/assets/SRC Logo.png");
  } catch {
    // Graceful fallback
  }

  // =========================================================================
  // 4. PRESTIGE INSTITUTIONAL HEADER (Y = 155px) — Instagram Safe Zone
  // =========================================================================
  const headerY = 155;

  // Soft Golden Halo behind SRC Crest
  if (srcLogoImg) {
    ctx.save();
    const logoHalo = ctx.createRadialGradient(132, headerY + 34, 10, 132, headerY + 34, 56);
    logoHalo.addColorStop(0, "rgba(231, 128, 35, 0.28)");
    logoHalo.addColorStop(1, "rgba(231, 128, 35, 0)");
    ctx.fillStyle = logoHalo;
    ctx.fillRect(70, headerY - 26, 124, 124);
    ctx.restore();

    ctx.drawImage(srcLogoImg, 96, headerY - 2, 72, 72);
  }

  // Institutional Brand Typography
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textBaseline = "top";
  (ctx as any).letterSpacing = "1.5px";
  ctx.fillText("SAHASTRADEEP", srcLogoImg ? 186 : 96, headerY + 4);
  (ctx as any).letterSpacing = "0px";

  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.font = "600 17px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("Student Representative Council • JDCOEM", srcLogoImg ? 186 : 96, headerY + 40);

  // Frosted Glass Event Category Pill (Top Right)
  const typeText = (payload.typeLabel || (payload.type === "event" ? "CAMPUS EVENT" : "SRC FORM")).toUpperCase();
  ctx.font = "800 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  (ctx as any).letterSpacing = "1.5px";
  const typeMetrics = ctx.measureText(typeText);
  const pillW = typeMetrics.width + 48; // padding for indicator dot + text
  const pillH = 40;
  const pillX = 1080 - 96 - pillW;
  const pillY = headerY + 12;

  ctx.save();
  // Frosted glass background
  const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
  pillGrad.addColorStop(0, "rgba(255, 255, 255, 0.14)");
  pillGrad.addColorStop(1, "rgba(255, 255, 255, 0.04)");
  roundRect(ctx, pillX, pillY, pillW, pillH, 20);
  ctx.fillStyle = pillGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Amber Indicator Dot
  ctx.fillStyle = "#E78023";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("●", pillX + 16, pillY + pillH / 2);

  // Category Text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(typeText, pillX + 32, pillY + pillH / 2);
  (ctx as any).letterSpacing = "0px";
  ctx.restore();

  // Luminous Horizon Line with center glow fade
  ctx.save();
  const lineGrad = ctx.createLinearGradient(96, 0, 984, 0);
  lineGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
  lineGrad.addColorStop(0.2, "rgba(255, 255, 255, 0.18)");
  lineGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.28)");
  lineGrad.addColorStop(0.8, "rgba(255, 255, 255, 0.18)");
  lineGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.beginPath();
  ctx.moveTo(96, headerY + 90);
  ctx.lineTo(984, headerY + 90);
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // =========================================================================
  // 5. FLOATING ACRYLIC HERO PLAQUE (16:9 Artwork, Y = 270px)
  // =========================================================================
  const cardX = 96;
  const cardY = 270;
  const cardW = 888;
  const cardH = 500; // Exact 16:9 aspect ratio
  const cardRadius = 28;

  // Dual-Tier Volumetric Shadow Structure
  ctx.save();
  // Primary soft atmospheric bloom
  ctx.shadowColor = "rgba(0, 0, 0, 0.72)";
  ctx.shadowBlur = 55;
  ctx.shadowOffsetY = 26;
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fillStyle = "#0B1528";
  ctx.fill();
  
  // Secondary sharp contact shadow
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  ctx.fill();
  ctx.restore();

  // Ground Reflection Effect (Fading downwards)
  if (heroImg) {
    ctx.save();
    ctx.translate(0, cardY + cardH * 2 + 16);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.045;
    ctx.beginPath();
    roundRect(ctx, cardX, cardY, cardW, 60, 0);
    ctx.clip();
    
    const imgRatio = heroImg.width / heroImg.height;
    const cardRatio = cardW / cardH;
    let drawW = cardW;
    let drawH = cardH;
    let drawX = cardX;
    let drawY = cardY;

    if (imgRatio > cardRatio) {
      drawW = cardH * imgRatio;
      drawX = cardX - (drawW - cardW) / 2;
    } else {
      drawH = cardW / imgRatio;
      drawY = cardY - (drawH - cardH) / 2;
    }
    ctx.drawImage(heroImg, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  // Draw Artwork Image Inside Plaque
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.clip();

  if (heroImg) {
    const imgRatio = heroImg.width / heroImg.height;
    const cardRatio = cardW / cardH;
    let drawW = cardW;
    let drawH = cardH;
    let drawX = cardX;
    let drawY = cardY;

    if (imgRatio > cardRatio) {
      drawW = cardH * imgRatio;
      drawX = cardX - (drawW - cardW) / 2;
    } else {
      drawH = cardW / imgRatio;
      drawY = cardY - (drawH - cardH) / 2;
    }
    ctx.drawImage(heroImg, drawX, drawY, drawW, drawH);
  } else {
    // Branded Geometric Fallback Banner
    const fallbackGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    fallbackGrad.addColorStop(0, "#08132A");
    fallbackGrad.addColorStop(0.5, "#17458F");
    fallbackGrad.addColorStop(1, "#E78023");
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    if (srcLogoImg) {
      ctx.drawImage(srcLogoImg, cardX + cardW / 2 - 80, cardY + cardH / 2 - 80, 160, 160);
    }
  }

  // Cinematic Bottom Vignette Gradient (Smooth 45% fade)
  const innerGrad = ctx.createLinearGradient(0, cardY + cardH * 0.45, 0, cardY + cardH);
  innerGrad.addColorStop(0, "rgba(0,0,0,0)");
  innerGrad.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = innerGrad;
  ctx.fillRect(cardX, cardY + cardH * 0.45, cardW, cardH * 0.55);
  ctx.restore();

  // Acrylic Specular Glass Edge Highlight (Outer 1.5px + Inner 1px bezel)
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  roundRect(ctx, cardX + 2, cardY + 2, cardW - 4, cardH - 4, cardRadius - 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // =========================================================================
  // 6. EDITORIAL TYPOGRAPHY & HEADLINE HOOK (Y = 815px)
  // =========================================================================
  let currentY = 815;

  // Category & Audience Badge Capsule
  if (payload.badge) {
    const badgeText = payload.badge.toUpperCase();
    ctx.font = "800 15px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    (ctx as any).letterSpacing = "1.5px";
    const bMetrics = ctx.measureText(badgeText);
    const bW = bMetrics.width + 36;
    const bH = 38;

    ctx.save();
    const bGrad = ctx.createLinearGradient(96, currentY, 96 + bW, currentY);
    bGrad.addColorStop(0, "#E78023");
    bGrad.addColorStop(1, "#F59E0B");
    roundRect(ctx, 96, currentY, bW, bH, 19);
    ctx.fillStyle = bGrad;
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, 96 + 18, currentY + bH / 2);
    (ctx as any).letterSpacing = "0px";
    ctx.restore();

    currentY += 56;
  }

  // Display Event Title (High-impact typography)
  let titleFontSize = 64;
  if (payload.title.length > 45) titleFontSize = 50;
  else if (payload.title.length > 25) titleFontSize = 56;

  ctx.font = `900 ${titleFontSize}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "top";

  const isShortTitle = payload.title.length <= 15;
  if (isShortTitle) {
    (ctx as any).letterSpacing = "2.5px";
  } else {
    (ctx as any).letterSpacing = "0.5px";
  }

  const wrappedTitleLines = wrapText(ctx, payload.title.toUpperCase(), 888, 3);
  for (const line of wrappedTitleLines) {
    ctx.fillText(line, 96, currentY);
    currentY += titleFontSize * 1.16;
  }
  (ctx as any).letterSpacing = "0px";
  currentY += 16;

  // Subtitle / Brief Hook Description
  const descriptionText = payload.description || payload.subtitle;
  if (descriptionText) {
    const isLongDescription = descriptionText.length > 120;
    const descFontSize = isLongDescription ? 22 : 25;
    const lineSpacing = isLongDescription ? 32 : 36;

    ctx.font = `400 ${descFontSize}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = "rgba(248, 250, 252, 0.90)";

    const descLines = wrapText(ctx, descriptionText, 888, 4);
    for (const dLine of descLines) {
      ctx.fillText(dLine, 96, currentY);
      currentY += lineSpacing;
    }
    currentY += 20;
  }

  // =========================================================================
  // 7. VIP FESTIVAL PASS / HUD METADATA CARDS
  // =========================================================================
  const metaItems: { label: string; value: string; color: string }[] = [];

  if (payload.date) {
    metaItems.push({ label: "DATE", value: payload.date, color: "#E78023" });
  }
  if (payload.time) {
    metaItems.push({ label: "TIME", value: payload.time, color: "#38BDF8" });
  }
  if (payload.venue) {
    metaItems.push({ label: "VENUE", value: payload.venue, color: "#34D399" });
  }
  if (payload.deadline) {
    metaItems.push({ label: "DEADLINE", value: payload.deadline, color: "#F87171" });
  }
  if (payload.entryFee) {
    metaItems.push({ label: "ACCESS", value: payload.entryFee, color: "#A78BFA" });
  }

  if (metaItems.length > 0) {
    const metaContainerY = Math.min(Math.max(currentY, 1180), 1360);
    const metaColWidth = metaItems.length >= 3 ? 282 : metaItems.length === 2 ? 430 : 888;
    const mH = 98;

    metaItems.slice(0, 3).forEach((item, idx) => {
      const mX = 96 + idx * (metaColWidth + 21);
      const mY = metaContainerY;

      ctx.save();
      // Smoked Glass Pass Background
      const mGrad = ctx.createLinearGradient(mX, mY, mX, mY + mH);
      mGrad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
      mGrad.addColorStop(1, "rgba(255, 255, 255, 0.03)");
      
      roundRect(ctx, mX, mY, metaColWidth, mH, 22);
      ctx.fillStyle = mGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.20)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Colored HUD Micro-Beacon Dot
      ctx.fillStyle = item.color;
      ctx.font = "14px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("●", mX + 22, mY + 28);

      // HUD Category Label
      ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx.font = "700 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      (ctx as any).letterSpacing = "1.5px";
      ctx.fillText(item.label, mX + 40, mY + 28);
      (ctx as any).letterSpacing = "0px";

      // Primary Value
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 21px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textBaseline = "top";
      let displayVal = item.value;
      while (ctx.measureText(displayVal).width > metaColWidth - 44 && displayVal.length > 4) {
        displayVal = displayVal.slice(0, -1).trim();
      }
      if (displayVal !== item.value) displayVal += "…";

      ctx.fillText(displayVal, mX + 22, mY + 50);
      ctx.restore();
    });

    currentY = metaContainerY + 128;
  }

  // Refined Organizer Attribution
  if (payload.organizer) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "italic 500 19px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(`Curated & Presented by ${payload.organizer}`, 96, currentY);
    currentY += 40;
  }

  // =========================================================================
  // 8. ILLUMINATED INTERACTIVE CTA CAPSULE & FOOTER GROUNDING
  // =========================================================================
  const footerY = 1615;
  const qrSize = 144;
  const hasQr = Boolean(options.includeQrCode);

  // Optional Acrylic QR Code Dock Container
  if (hasQr) {
    try {
      const qrDataUrl = await QRCode.toDataURL(payload.url, {
        margin: 1,
        width: qrSize,
        color: {
          dark: "#0F172A",
          light: "#FFFFFF",
        },
      });
      const qrImg = await loadImage(qrDataUrl);

      const qrX = 1080 - 96 - qrSize - 16;
      const qrY = footerY - 12;
      ctx.save();
      roundRect(ctx, qrX, qrY, qrSize + 16, qrSize + 16, 24);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
      ctx.shadowBlur = 28;
      ctx.drawImage(qrImg, qrX + 8, qrY + 8, qrSize, qrSize);
      ctx.restore();
    } catch (e) {
      console.warn("[storyCanvasRenderer] Failed to render QR code:", e);
    }
  }

  // Liquid Amber CTA Capsule
  const ctaWidth = hasQr ? 680 : 888;
  const ctaH = 88;
  ctx.save();
  
  // Ambient Glow Shadow
  ctx.shadowColor = "rgba(231, 128, 35, 0.55)";
  ctx.shadowBlur = 24;
  roundRect(ctx, 96, footerY, ctaWidth, ctaH, 28);
  
  // Vibrant Sahastradeep Amber Gradient
  const ctaGrad = ctx.createLinearGradient(96, footerY, 96 + ctaWidth, footerY);
  ctaGrad.addColorStop(0, "#E78023");
  ctaGrad.addColorStop(1, "#F59E0B");
  ctx.fillStyle = ctaGrad;
  ctx.fill();

  // Luminous Edge Stroke
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top-Half Specular Gloss Reflection
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(96 + 28, footerY);
  ctx.lineTo(96 + ctaWidth - 28, footerY);
  ctx.arcTo(96 + ctaWidth, footerY, 96 + ctaWidth, footerY + ctaH / 2, 28);
  ctx.lineTo(96, footerY + ctaH / 2);
  ctx.arcTo(96, footerY, 96 + 28, footerY, 28);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fill();

  // CTA Interactive Action Text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textBaseline = "middle";
  const ctaTitle = payload.ctaText || (payload.type === "event" ? "Tap Link Sticker to Register" : "Tap Link to Participate");
  ctx.fillText(`✦  ${ctaTitle}`, 132, footerY + ctaH / 2 + 2);

  // Directional Action Arrow
  ctx.font = "900 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("→", 96 + ctaWidth - 56, footerY + ctaH / 2);
  ctx.restore();

  // Canonical Clean URL Display
  const cleanDisplayUrl = payload.url.replace(/^https?:\/\//, "");
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = "bold 20px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textBaseline = "top";
  (ctx as any).letterSpacing = "0.8px";
  ctx.fillText(cleanDisplayUrl, 96, footerY + 116);
  (ctx as any).letterSpacing = "0px";

  // Institutional Accreditation
  ctx.fillStyle = "rgba(255, 255, 255, 0.50)";
  ctx.font = "500 15px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText("JD College of Engineering & Management, Nagpur • An Autonomous Institute", 96, footerY + 146);

  // Embossed Faint Watermark Emblem (Bottom Right)
  if (srcLogoImg) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.drawImage(srcLogoImg, 1080 - 96 - 48, 1920 - 96 - 48, 48, 48);
    ctx.restore();
  }

  return canvas;
}

/**
 * Exports the rendered Story canvas to a high-quality PNG Blob.
 */
export async function exportStoryBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob export failed"));
      },
      "image/png",
      1.0
    );
  });
}
