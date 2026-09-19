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
 * Produces a pixel-perfect branded visual ready for direct Instagram Story sharing or download.
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

  // 1. BASE BACKGROUND: Official SRC collegiate midnight navy gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
  bgGrad.addColorStop(0, "#07122A");   // Deep SRC Navy
  bgGrad.addColorStop(0.35, "#0D224C"); // Mid SRC Blue
  bgGrad.addColorStop(0.70, "#08142A"); // Dark Navy
  bgGrad.addColorStop(1, "#030712");    // Midnight slate
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);

  // 2. SRC BRAND ACCENT LIGHTS (Atmospheric glows in SRC orange & gold)
  ctx.save();
  // Top-right SRC Orange aura
  const orangeAura = ctx.createRadialGradient(960, 260, 40, 960, 260, 680);
  orangeAura.addColorStop(0, "rgba(231, 128, 35, 0.28)"); // #E78023
  orangeAura.addColorStop(0.5, "rgba(231, 128, 35, 0.08)");
  orangeAura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = orangeAura;
  ctx.fillRect(400, 0, 680, 900);

  // Center-left SRC Royal Blue glow
  const blueAura = ctx.createRadialGradient(160, 800, 50, 160, 800, 750);
  blueAura.addColorStop(0, "rgba(23, 69, 143, 0.35)"); // #17458F
  blueAura.addColorStop(0.6, "rgba(23, 69, 143, 0.10)");
  blueAura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = blueAura;
  ctx.fillRect(0, 300, 800, 1000);

  // Bottom-center Warm Glow behind CTA
  const bottomGlow = ctx.createRadialGradient(540, 1720, 60, 540, 1720, 550);
  bottomGlow.addColorStop(0, "rgba(231, 128, 35, 0.20)");
  bottomGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(100, 1400, 880, 520);
  ctx.restore();

  // Subtle geometric brand watermarks / background grid lines
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 1;
  for (let x = 120; x < 1080; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1920);
    ctx.stroke();
  }
  for (let y = 140; y < 1920; y += 160) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1080, y);
    ctx.stroke();
  }
  ctx.restore();

  // Preload Hero Artwork Image for Card Content
  let heroImg: HTMLImageElement | null = null;
  if (payload.imageUrl) {
    try {
      const proxiedUrl = getProxiedImageUrl(payload.imageUrl);
      heroImg = await loadImage(proxiedUrl);
    } catch {
      console.warn("[storyCanvasRenderer] Could not load hero image for card");
    }
  }

  // 4. INSTITUTIONAL HEADER (Y = 160px) — Instagram Top Safe Zone Clearance
  const headerY = 170;
  let srcLogoImg: HTMLImageElement | null = null;
  try {
    srcLogoImg = await loadImage("/assets/SRC Logo.png");
  } catch {
    // Graceful fallback if logo path unavailable
  }

  if (srcLogoImg) {
    ctx.drawImage(srcLogoImg, 96, headerY, 68, 68);
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("SAHASTRADEEP", srcLogoImg ? 180 : 96, headerY + 4);

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.fillText("Student Representative Council • JDCOEM", srcLogoImg ? 180 : 96, headerY + 38);

  // Type Pill Badge on Top Right
  const typeText = (payload.typeLabel || (payload.type === "event" ? "CAMPUS EVENT" : "SRC FORM")).toUpperCase();
  ctx.font = "800 16px system-ui, -apple-system, sans-serif";
  const typeMetrics = ctx.measureText(typeText);
  const pillW = typeMetrics.width + 32;
  const pillH = 38;
  const pillX = 1080 - 96 - pillW;
  const pillY = headerY + 14;

  ctx.save();
  roundRect(ctx, pillX, pillY, pillW, pillH, 19);
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#E78023";
  ctx.textBaseline = "middle";
  ctx.fillText(typeText, pillX + 16, pillY + pillH / 2);
  ctx.restore();

  // 5. HERO ARTWORK CARD (Y = 275px, Width = 888px, Height = 740px)
  const cardX = 96;
  const cardY = 275;
  const cardW = 888;
  const cardH = 740;
  const cardRadius = 36;

  ctx.save();
  // Card Drop Shadow & Ambient Glow
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = 45;
  ctx.shadowOffsetY = 24;

  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fillStyle = "#0B1528";
  ctx.fill();
  ctx.restore();

  // Draw Artwork Image Inside Rounded Card
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.clip();

  if (heroImg) {
    // Calculate aspect ratio cover inside card
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
      ctx.drawImage(srcLogoImg, cardX + cardW / 2 - 100, cardY + cardH / 2 - 100, 200, 200);
    }
  }

  // Inner subtle gradient overlay on bottom of card
  const innerGrad = ctx.createLinearGradient(0, cardY + cardH - 180, 0, cardY + cardH);
  innerGrad.addColorStop(0, "rgba(0,0,0,0)");
  innerGrad.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = innerGrad;
  ctx.fillRect(cardX, cardY + cardH - 180, cardW, 180);

  ctx.restore();

  // Crisp Hairline Card Border
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.strokeStyle = palette.cardBorder || "rgba(255, 255, 255, 0.26)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 6. CONTENT & TYPOGRAPHY SECTION (Y = 1055px)
  let currentY = 1055;

  // Category & Audience Badges Strip
  if (payload.badge) {
    const badgeText = payload.badge.toUpperCase();
    ctx.font = "800 16px system-ui, -apple-system, sans-serif";
    const bMetrics = ctx.measureText(badgeText);
    const bW = bMetrics.width + 28;
    const bH = 34;

    ctx.save();
    roundRect(ctx, 96, currentY, bW, bH, 17);
    ctx.fillStyle = "rgba(231, 128, 35, 0.9)";
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, 96 + 14, currentY + bH / 2);
    ctx.restore();

    currentY += 52;
  }

  // Event / Form Title (Adaptive Font Size + Smart Line Wrap)
  let titleFontSize = 58;
  if (payload.title.length > 50) titleFontSize = 46;
  else if (payload.title.length > 30) titleFontSize = 52;

  ctx.font = `900 ${titleFontSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "top";

  const wrappedTitleLines = wrapText(ctx, payload.title.toUpperCase(), 888, 3);
  for (const line of wrappedTitleLines) {
    ctx.fillText(line, 96, currentY);
    currentY += titleFontSize * 1.15;
  }
  currentY += 16;

  // Subtitle / Tagline (if present)
  if (payload.subtitle && wrappedTitleLines.length <= 2) {
    ctx.font = "500 24px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(226, 232, 240, 0.88)";
    const subLines = wrapText(ctx, payload.subtitle, 888, 2);
    for (const sLine of subLines) {
      ctx.fillText(sLine, 96, currentY);
      currentY += 34;
    }
    currentY += 12;
  }

  // 7. METADATA CARDS (Date, Time, Venue / Deadline)
  const metaItems: { label: string; value: string; iconSymbol: string }[] = [];

  if (payload.date) {
    metaItems.push({ label: "DATE", value: payload.date, iconSymbol: "📅" });
  }
  if (payload.time) {
    metaItems.push({ label: "TIME", value: payload.time, iconSymbol: "⏰" });
  }
  if (payload.venue) {
    metaItems.push({ label: "VENUE", value: payload.venue, iconSymbol: "📍" });
  }
  if (payload.deadline) {
    metaItems.push({ label: "DEADLINE", value: payload.deadline, iconSymbol: "⏳" });
  }
  if (payload.entryFee) {
    metaItems.push({ label: "ACCESS", value: payload.entryFee, iconSymbol: "🎟️" });
  }

  if (metaItems.length > 0) {
    const metaContainerY = Math.min(currentY, 1420);
    const metaColWidth = metaItems.length >= 3 ? 282 : metaItems.length === 2 ? 430 : 888;

    metaItems.slice(0, 3).forEach((item, idx) => {
      const mX = 96 + idx * (metaColWidth + 18);
      const mY = metaContainerY;
      const mH = 88;

      ctx.save();
      roundRect(ctx, mX, mY, metaColWidth, mH, 20);
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#E78023";
      ctx.font = "800 13px system-ui, -apple-system, sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(`${item.iconSymbol} ${item.label}`, mX + 18, mY + 16);

      // Value
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "700 20px system-ui, -apple-system, sans-serif";
      // Truncate value if too long for column
      let displayVal = item.value;
      while (ctx.measureText(displayVal).width > metaColWidth - 36 && displayVal.length > 4) {
        displayVal = displayVal.slice(0, -1).trim();
      }
      if (displayVal !== item.value) displayVal += "…";

      ctx.fillText(displayVal, mX + 18, mY + 44);
      ctx.restore();
    });

    currentY = metaContainerY + 110;
  }

  // Organizer Credit
  if (payload.organizer) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.font = "600 17px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(`Organized by: ${payload.organizer}`, 96, currentY);
    currentY += 34;
  }

  // 8. BOTTOM FOOTER & DESTINATION CALLOUT (Instagram Bottom Safe Zone Clearance)
  const footerY = 1660;
  const qrSize = 136;
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

      // Draw QR Code in rounded white container
      const qrX = 1080 - 96 - qrSize - 16;
      const qrY = footerY - 10;
      ctx.save();
      roundRect(ctx, qrX, qrY, qrSize + 16, qrSize + 16, 20);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 20;
      ctx.drawImage(qrImg, qrX + 8, qrY + 8, qrSize, qrSize);
      ctx.restore();
    } catch (e) {
      console.warn("[storyCanvasRenderer] Failed to render QR code:", e);
    }
  }

  // Pill CTA: "Link in Story / Scan to Explore"
  const ctaWidth = hasQr ? 680 : 888;
  ctx.save();
  roundRect(ctx, 96, footerY, ctaWidth, 80, 24);
  const ctaGrad = ctx.createLinearGradient(96, footerY, 96 + ctaWidth, footerY);
  ctaGrad.addColorStop(0, "#E78023");
  ctaGrad.addColorStop(1, "#FF9B3F");
  ctx.fillStyle = ctaGrad;
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  const ctaTitle = payload.ctaText || (payload.type === "event" ? "Tap Link Sticker to View" : "Tap Link to Participate");
  ctx.fillText(`🔗  ${ctaTitle}`, 124, footerY + 40);

  // Arrow symbol on right of CTA
  ctx.font = "900 24px system-ui, -apple-system, sans-serif";
  ctx.fillText("→", 96 + ctaWidth - 48, footerY + 40);
  ctx.restore();

  // Canonical Clean URL Display
  const cleanDisplayUrl = payload.url.replace(/^https?:\/\//, "");
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = "600 18px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(cleanDisplayUrl, 96, footerY + 96);

  // Institution Accreditation
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.font = "500 14px system-ui, -apple-system, sans-serif";
  ctx.fillText("JD College of Engineering & Management, Nagpur • An Autonomous Institute", 96, footerY + 124);

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
