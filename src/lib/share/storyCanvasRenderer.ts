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
 * Smart line wrapping for titles on Canvas.
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
 * High-Resolution 1080 × 1920 Instagram Story Canvas Engine.
 * Supports both Ultra-Modern Dark (Midnight Sapphire) and Luxury Light (Porcelain Ivory) aesthetics.
 */
export async function renderStoryToCanvas(
  payload: SocialSharePayload,
  palette: StoryPalette = DEFAULT_STORY_PALETTE,
  options: StoryRenderOptions = {}
): Promise<HTMLCanvasElement> {
  const isLight = options.theme === "light";
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  // Enable high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1. BASE BACKGROUND: Dynamic editorial canvas
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
  if (isLight) {
    bgGrad.addColorStop(0, "#FAFCFF");   // Pristine porcelain top
    bgGrad.addColorStop(0.35, "#F1F5F9"); // Crisp light slate
    bgGrad.addColorStop(0.70, "#E2E8F0"); // Soft silver depth
    bgGrad.addColorStop(1, "#F8FAFC");    // Clean base
  } else {
    bgGrad.addColorStop(0, "#050B14");   // Deep rich navy
    bgGrad.addColorStop(0.35, "#0B1D40"); // Mid rich blue
    bgGrad.addColorStop(0.70, "#071228"); // Dark Navy
    bgGrad.addColorStop(1, "#020408");    // Obsidian
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Subtle noise texture effect for organic print-grade depth
  ctx.save();
  ctx.fillStyle = isLight ? "rgba(15, 23, 42, 0.02)" : "rgba(255, 255, 255, 0.04)";
  for (let i = 0; i < 9000; i++) {
    const nx = Math.random() * 1080;
    const ny = Math.random() * 1920;
    ctx.fillRect(nx, ny, 1.5, 1.5);
  }
  ctx.restore();

  // 2. BRAND ACCENT LIGHTS (Atmospheric glows)
  ctx.save();
  // Top-right SRC Orange aura
  const orangeAura = ctx.createRadialGradient(960, 260, 40, 960, 260, 680);
  if (isLight) {
    orangeAura.addColorStop(0, "rgba(231, 128, 35, 0.16)");
    orangeAura.addColorStop(0.5, "rgba(231, 128, 35, 0.05)");
  } else {
    orangeAura.addColorStop(0, "rgba(231, 128, 35, 0.28)");
    orangeAura.addColorStop(0.5, "rgba(231, 128, 35, 0.08)");
  }
  orangeAura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = orangeAura;
  ctx.fillRect(400, 0, 680, 900);

  // Center-left SRC Royal Blue glow
  const blueAura = ctx.createRadialGradient(160, 800, 50, 160, 800, 750);
  if (isLight) {
    blueAura.addColorStop(0, "rgba(23, 69, 143, 0.12)");
    blueAura.addColorStop(0.6, "rgba(23, 69, 143, 0.04)");
  } else {
    blueAura.addColorStop(0, "rgba(23, 69, 143, 0.35)");
    blueAura.addColorStop(0.6, "rgba(23, 69, 143, 0.10)");
  }
  blueAura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = blueAura;
  ctx.fillRect(0, 300, 800, 1000);

  // Bottom-center Warm Glow
  const bottomGlow = ctx.createRadialGradient(540, 1720, 60, 540, 1720, 550);
  if (isLight) {
    bottomGlow.addColorStop(0, "rgba(231, 128, 35, 0.14)");
  } else {
    bottomGlow.addColorStop(0, "rgba(231, 128, 35, 0.20)");
  }
  bottomGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(100, 1400, 880, 520);
  
  // Radial spotlight effect behind the hero image
  const heroSpotlight = ctx.createRadialGradient(540, 480, 100, 540, 480, 650);
  if (isLight) {
    heroSpotlight.addColorStop(0, "rgba(231, 128, 35, 0.06)");
    heroSpotlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  } else {
    heroSpotlight.addColorStop(0, "rgba(255, 255, 255, 0.1)");
    heroSpotlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  }
  ctx.fillStyle = heroSpotlight;
  ctx.fillRect(0, 100, 1080, 800);
  ctx.restore();

  // Subtle elegant diamond/diagonal background grid lines
  ctx.save();
  ctx.strokeStyle = isLight ? "rgba(15, 23, 42, 0.025)" : "rgba(255, 255, 255, 0.02)";
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

  // Subtle decorative geometric corner elements
  ctx.save();
  ctx.strokeStyle = isLight ? "rgba(15, 23, 42, 0.12)" : "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5;
  const cornerLen = 24;
  const margin = 40;
  // Top left
  ctx.beginPath(); ctx.moveTo(margin, margin + cornerLen); ctx.lineTo(margin, margin); ctx.lineTo(margin + cornerLen, margin); ctx.stroke();
  // Top right
  ctx.beginPath(); ctx.moveTo(1080 - margin, margin + cornerLen); ctx.lineTo(1080 - margin, margin); ctx.lineTo(1080 - margin - cornerLen, margin); ctx.stroke();
  // Bottom left
  ctx.beginPath(); ctx.moveTo(margin, 1920 - margin - cornerLen); ctx.lineTo(margin, 1920 - margin); ctx.lineTo(margin + cornerLen, 1920 - margin); ctx.stroke();
  // Bottom right
  ctx.beginPath(); ctx.moveTo(1080 - margin, 1920 - margin - cornerLen); ctx.lineTo(1080 - margin, 1920 - margin); ctx.lineTo(1080 - margin - cornerLen, 1920 - margin); ctx.stroke();
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

  // 4. INSTITUTIONAL HEADER (Y = 160px)
  const headerY = 160;
  let srcLogoImg: HTMLImageElement | null = null;
  try {
    srcLogoImg = await loadImage("/assets/SRC Logo.png");
  } catch {
    // Graceful fallback
  }

  if (srcLogoImg) {
    ctx.drawImage(srcLogoImg, 96, headerY - 4, 72, 72);
  }

  ctx.fillStyle = isLight ? "#0F172A" : "#FFFFFF";
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "top";
  (ctx as any).letterSpacing = "1px";
  ctx.fillText("SAHASTRADEEP", srcLogoImg ? 186 : 96, headerY + 2);
  (ctx as any).letterSpacing = "0px";

  ctx.fillStyle = isLight ? "#475569" : "rgba(255, 255, 255, 0.7)";
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.fillText("Student Representative Council • JDCOEM", srcLogoImg ? 186 : 96, headerY + 38);

  // Type Pill Badge on Top Right
  const typeText = (payload.typeLabel || (payload.type === "event" ? "CAMPUS EVENT" : "SRC FORM")).toUpperCase();
  ctx.font = "800 15px system-ui, -apple-system, sans-serif";
  (ctx as any).letterSpacing = "1.5px";
  const typeMetrics = ctx.measureText(typeText);
  const pillW = typeMetrics.width + 40;
  const pillH = 42;
  const pillX = 1080 - 96 - pillW;
  const pillY = headerY + 10;

  ctx.save();
  // Filled gradient background for pill
  const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY);
  pillGrad.addColorStop(0, "rgba(231, 128, 35, 0.95)");
  pillGrad.addColorStop(1, "rgba(245, 158, 11, 0.95)");
  roundRect(ctx, pillX, pillY, pillW, pillH, 21);
  ctx.fillStyle = pillGrad;
  ctx.fill();
  ctx.strokeStyle = isLight ? "rgba(231, 128, 35, 0.4)" : "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.fillText(typeText, pillX + 20, pillY + pillH / 2);
  (ctx as any).letterSpacing = "0px";
  ctx.restore();

  // Thin elegant separator line below header
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(96, headerY + 90);
  ctx.lineTo(984, headerY + 90);
  ctx.strokeStyle = isLight ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // 5. HERO ARTWORK CARD (Y = 280px)
  const cardX = 96;
  const cardY = 280;
  const cardW = 888;
  const cardH = 500;
  const cardRadius = 28;

  // Layered Shadow Effect
  ctx.save();
  // Primary deep shadow
  ctx.shadowColor = isLight ? "rgba(15, 23, 42, 0.14)" : "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = isLight ? 35 : 45;
  ctx.shadowOffsetY = isLight ? 18 : 25;
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fillStyle = isLight ? "#FFFFFF" : "#0B1528";
  ctx.fill();
  
  // Secondary sharp shadow for depth
  ctx.shadowColor = isLight ? "rgba(15, 23, 42, 0.06)" : "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  ctx.fill();
  ctx.restore();

  // Subtle reflection effect below the card
  if (heroImg) {
    ctx.save();
    ctx.translate(0, cardY + cardH * 2 + 16);
    ctx.scale(1, -1);
    ctx.globalAlpha = isLight ? 0.03 : 0.05;
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

  // Draw Artwork Image Inside Rounded Card
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
    fallbackGrad.addColorStop(0, "#0E234A");
    fallbackGrad.addColorStop(0.5, "#17458F");
    fallbackGrad.addColorStop(1, "#E78023");
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    if (srcLogoImg) {
      ctx.drawImage(srcLogoImg, cardX + cardW / 2 - 80, cardY + cardH / 2 - 80, 160, 160);
    }
  }

  // Cinematic inner gradient overlay on bottom of card
  const innerGrad = ctx.createLinearGradient(0, cardY + cardH * 0.4, 0, cardY + cardH);
  innerGrad.addColorStop(0, "rgba(0,0,0,0)");
  innerGrad.addColorStop(1, isLight ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.9)");
  ctx.fillStyle = innerGrad;
  ctx.fillRect(cardX, cardY + cardH * 0.4, cardW, cardH * 0.6);

  ctx.restore();

  // Inner glow/border effect on the card edges
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.strokeStyle = isLight ? "rgba(15, 23, 42, 0.12)" : "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  roundRect(ctx, cardX + 2, cardY + 2, cardW - 4, cardH - 4, cardRadius - 2);
  ctx.strokeStyle = isLight ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // 6. CONTENT & TYPOGRAPHY SECTION
  let currentY = 820;

  // Category & Audience Badges Strip
  if (payload.badge) {
    const badgeText = payload.badge.toUpperCase();
    ctx.font = "800 16px system-ui, -apple-system, sans-serif";
    (ctx as any).letterSpacing = "1px";
    const bMetrics = ctx.measureText(badgeText);
    const bW = bMetrics.width + 36;
    const bH = 38;

    ctx.save();
    roundRect(ctx, 96, currentY, bW, bH, 19);
    ctx.fillStyle = "#E78023";
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, 96 + 18, currentY + bH / 2);
    (ctx as any).letterSpacing = "0px";
    ctx.restore();

    currentY += 56;
  }

  // Event / Form Title
  let titleFontSize = 64;
  if (payload.title.length > 45) titleFontSize = 50;
  else if (payload.title.length > 25) titleFontSize = 56;

  ctx.font = `900 ${titleFontSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = isLight ? "#0F172A" : "#FFFFFF";
  ctx.textBaseline = "top";

  const isShortTitle = payload.title.length <= 15;
  if (isShortTitle) {
    (ctx as any).letterSpacing = "3px";
  } else {
    (ctx as any).letterSpacing = "0px";
  }

  const wrappedTitleLines = wrapText(ctx, payload.title.toUpperCase(), 888, 3);
  for (const line of wrappedTitleLines) {
    ctx.fillText(line, 96, currentY);
    currentY += titleFontSize * 1.18;
  }
  (ctx as any).letterSpacing = "0px";
  currentY += 16;

  // Subtitle / Brief Description
  const descriptionText = payload.description || payload.subtitle;
  if (descriptionText) {
    const isLongDescription = descriptionText.length > 120;
    const descFontSize = isLongDescription ? 22 : 25;
    const lineSpacing = isLongDescription ? 32 : 36;

    ctx.font = `400 ${descFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = isLight ? "#334155" : "rgba(255, 255, 255, 0.85)";

    const descLines = wrapText(ctx, descriptionText, 888, 4);
    for (const dLine of descLines) {
      ctx.fillText(dLine, 96, currentY);
      currentY += lineSpacing;
    }
    currentY += 20;
  }

  // 7. METADATA CARDS
  const metaItems: { label: string; value: string; color: string }[] = [];

  if (payload.date) {
    metaItems.push({ label: "DATE", value: payload.date, color: "#E78023" });
  }
  if (payload.time) {
    metaItems.push({ label: "TIME", value: payload.time, color: "#3B82F6" });
  }
  if (payload.venue) {
    metaItems.push({ label: "VENUE", value: payload.venue, color: "#10B981" });
  }
  if (payload.deadline) {
    metaItems.push({ label: "DEADLINE", value: payload.deadline, color: "#EF4444" });
  }
  if (payload.entryFee) {
    metaItems.push({ label: "ACCESS", value: payload.entryFee, color: "#8B5CF6" });
  }

  if (metaItems.length > 0) {
    const metaContainerY = Math.min(Math.max(currentY, 1180), 1360);
    const metaColWidth = metaItems.length >= 3 ? 282 : metaItems.length === 2 ? 430 : 888;

    metaItems.slice(0, 3).forEach((item, idx) => {
      const mX = 96 + idx * (metaColWidth + 21);
      const mY = metaContainerY;
      const mH = 100;

      ctx.save();
      // Gradient background for metadata card
      const mGrad = ctx.createLinearGradient(mX, mY, mX, mY + mH);
      if (isLight) {
        mGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        mGrad.addColorStop(1, "rgba(241, 245, 249, 0.85)");
      } else {
        mGrad.addColorStop(0, "rgba(255, 255, 255, 0.12)");
        mGrad.addColorStop(1, "rgba(255, 255, 255, 0.04)");
      }
      
      roundRect(ctx, mX, mY, metaColWidth, mH, 24);
      ctx.fillStyle = mGrad;
      ctx.fill();
      ctx.strokeStyle = isLight ? "rgba(203, 213, 225, 0.9)" : "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Colored Dot Indicator
      ctx.fillStyle = item.color;
      ctx.font = "14px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText("●", mX + 22, mY + 28);

      // Label
      ctx.fillStyle = isLight ? "#64748B" : "rgba(255, 255, 255, 0.7)";
      ctx.font = "700 13px system-ui, -apple-system, sans-serif";
      (ctx as any).letterSpacing = "1.5px";
      ctx.fillText(item.label, mX + 40, mY + 28);
      (ctx as any).letterSpacing = "0px";

      // Value
      ctx.fillStyle = isLight ? "#0F172A" : "#FFFFFF";
      ctx.font = "bold 21px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "top";
      let displayVal = item.value;
      while (ctx.measureText(displayVal).width > metaColWidth - 44 && displayVal.length > 4) {
        displayVal = displayVal.slice(0, -1).trim();
      }
      if (displayVal !== item.value) displayVal += "…";

      ctx.fillText(displayVal, mX + 22, mY + 52);
      ctx.restore();
    });

    currentY = metaContainerY + 130;
  }

  // Organizer Credit
  if (payload.organizer) {
    ctx.fillStyle = isLight ? "#475569" : "rgba(255, 255, 255, 0.6)";
    ctx.font = "italic 500 19px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(`Presented by ${payload.organizer}`, 96, currentY);
    currentY += 40;
  }

  // 8. BOTTOM FOOTER & DESTINATION CALLOUT
  const footerY = 1620;
  const qrSize = 144;
  const hasQr = Boolean(options.includeQrCode);

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
      const qrY = footerY - 10;
      ctx.save();
      roundRect(ctx, qrX, qrY, qrSize + 16, qrSize + 16, 24);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.shadowColor = isLight ? "rgba(15, 23, 42, 0.15)" : "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 24;
      ctx.drawImage(qrImg, qrX + 8, qrY + 8, qrSize, qrSize);
      ctx.restore();
    } catch (e) {
      console.warn("[storyCanvasRenderer] Failed to render QR code:", e);
    }
  }

  // Pill CTA Button
  const ctaWidth = hasQr ? 680 : 888;
  const ctaH = 88;
  ctx.save();
  
  // Subtle glow outline
  ctx.shadowColor = isLight ? "rgba(231, 128, 35, 0.35)" : "rgba(231, 128, 35, 0.5)";
  ctx.shadowBlur = 20;
  roundRect(ctx, 96, footerY, ctaWidth, ctaH, 28);
  
  // CTA Main Gradient
  const ctaGrad = ctx.createLinearGradient(96, footerY, 96 + ctaWidth, footerY);
  ctaGrad.addColorStop(0, "#E78023");
  ctaGrad.addColorStop(1, "#F59E0B");
  ctx.fillStyle = ctaGrad;
  ctx.fill();

  // CTA Glow Outline
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Shine gloss effect (top half reflection)
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

  // CTA Text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  const ctaTitle = payload.ctaText || (payload.type === "event" ? "Tap Link Sticker to View" : "Tap Link to Participate");
  ctx.fillText(`✦  ${ctaTitle}`, 132, footerY + ctaH / 2 + 2);

  // Arrow symbol on right of CTA
  ctx.font = "900 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("→", 96 + ctaWidth - 56, footerY + ctaH / 2);
  ctx.restore();

  // Canonical Clean URL Display
  const cleanDisplayUrl = payload.url.replace(/^https?:\/\//, "");
  ctx.fillStyle = isLight ? "#0F172A" : "rgba(255, 255, 255, 0.9)";
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "top";
  (ctx as any).letterSpacing = "0.5px";
  ctx.fillText(cleanDisplayUrl, 96, footerY + 116);
  (ctx as any).letterSpacing = "0px";

  // Institution Accreditation
  ctx.fillStyle = isLight ? "#64748B" : "rgba(255, 255, 255, 0.45)";
  ctx.font = "500 15px system-ui, -apple-system, sans-serif";
  ctx.fillText("JD College of Engineering & Management, Nagpur • An Autonomous Institute", 96, footerY + 146);

  // SRC Logo Watermark faintly in bottom-right corner
  if (srcLogoImg) {
    ctx.save();
    ctx.globalAlpha = isLight ? 0.06 : 0.08;
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
