"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { CertificateRecord, CertificateColorPalette } from "@/types/certificates";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";
import { DEFAULT_CERTIFICATE_PALETTES } from "@/lib/colorExtractor";

interface CertificateViewProps {
  certificate: CertificateRecord;
  id?: string;
  className?: string;
  showQrCode?: boolean;
}

/**
 * High-Definition Canvas-Powered Wave Decoration Component
 * Renders the corner decorative fluid waves directly onto an HTML5 canvas.
 * Canvas elements are first-class citizens in html2canvas (copied directly via pixel buffer),
 * completely bypassing html2canvas's known SVG serialization & rendering bugs.
 */
function CertificateWavesCanvas({ palette }: { palette: CertificateColorPalette }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawWaves = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Master resolution matches certificate canvas (1040 x 735)
    canvas.width = 1040;
    canvas.height = 735;
    ctx.clearRect(0, 0, 1040, 735);

    // -------------------------------------------------------------
    // 1. BOTTOM-RIGHT CORNER FLUID WAVES (CONFINED TO OUTER CORNER)
    // -------------------------------------------------------------
    ctx.save();
    // Position at bottom-right corner: 1040 - 300 = 740, 735 - 220 = 515
    ctx.translate(1040 - 300, 735 - 220);

    // Layer 1: Deep Primary Sweeping Ribbon
    ctx.fillStyle = palette.primary;
    ctx.globalAlpha = 0.96;
    ctx.fill(new Path2D("M320 240L110 240C165 200 205 165 240 120C270 75 295 30 320 0L320 240Z"));

    // Layer 2: Secondary Mid-Tone Flow
    ctx.fillStyle = palette.secondary;
    ctx.globalAlpha = 0.88;
    ctx.fill(new Path2D("M320 240L160 240C205 205 240 170 265 130C290 85 305 45 320 25L320 240Z"));

    // Layer 3: Vibrant Accent Ribbon
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.7;
    ctx.fill(new Path2D("M320 240L215 240C245 210 270 180 285 140C300 100 310 65 320 50L320 240Z"));

    // Layer 4: Front Highlight Ripple
    ctx.globalAlpha = 0.35;
    ctx.fill(new Path2D("M320 240L260 240C280 215 295 190 305 155C315 120 318 95 320 85L320 240Z"));

    // White Wave Contour Lines
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.55;
    ctx.lineCap = "round";
    ctx.stroke(new Path2D("M140 235C185 195 220 160 250 115C280 70 300 30 315 5"));

    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.stroke(new Path2D("M185 235C220 200 250 165 270 125C295 85 310 50 320 25"));

    // Accent Wave Contour Line
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.75;
    ctx.stroke(new Path2D("M120 238C165 205 200 170 230 130C265 85 295 45 315 15"));

    // Sparkles
    ctx.fillStyle = "#FFFFFF";
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(265, 140, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(290, 95, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // -------------------------------------------------------------
    // 2. BOTTOM-LEFT CORNER FLUID WAVES (CONFINED TO OUTER CORNER)
    // -------------------------------------------------------------
    ctx.save();
    // Position at bottom-left corner: x=0, y = 735 - 150 = 585
    ctx.translate(0, 735 - 150);

    ctx.fillStyle = palette.primary;
    ctx.globalAlpha = 0.94;
    ctx.fill(new Path2D("M-20 170L140 170C110 130 80 110 60 75C40 45 20 20 -20 0L-20 170Z"));

    ctx.fillStyle = palette.secondary;
    ctx.globalAlpha = 0.82;
    ctx.fill(new Path2D("M-20 170L100 170C70 135 50 110 30 75C15 50 0 25 -20 15L-20 170Z"));

    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.45;
    ctx.fill(new Path2D("M-20 170L60 170C40 140 25 115 10 85L-20 65L-20 170Z"));

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.45;
    ctx.stroke(new Path2D("M-10 90C10 105 30 130 65 160"));

    ctx.restore();
  }, [palette]);

  useEffect(() => {
    drawWaves();
  }, [drawWaves]);

  return (
    <canvas
      ref={canvasRef}
      width={1040}
      height={735}
      className="absolute inset-0 pointer-events-none z-0"
      style={{ width: "1040px", height: "735px" }}
    />
  );
}

export function CertificateView({
  certificate,
  id = `cert-canvas-${certificate.id}`,
  className = "",
  showQrCode = true,
}: CertificateViewProps) {
  const palette: CertificateColorPalette =
    certificate.colorPalette || DEFAULT_CERTIFICATE_PALETTES.ocean;

  const isRevoked = certificate.status === "REVOKED";

  // Sanitize remote club logo through proxy to prevent canvas CORS tainting during html2canvas export
  const clubLogoSrc = certificate.clubLogoUrl
    ? certificate.clubLogoUrl.startsWith("http://") || certificate.clubLogoUrl.startsWith("https://")
      ? `/api/proxy-image?url=${encodeURIComponent(certificate.clubLogoUrl)}`
      : certificate.clubLogoUrl
    : "";

  // Responsive scaler for Live Preview:
  // The master certificate has a fixed 1040px x 735px canvas with zero viewport reflow.
  // The outer wrapper measures container width and scales the certificate proportionally
  // so it fits any screen (desktop modal, laptop, smartphone) without shifting elements.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!wrapperRef.current) return;
      const width = wrapperRef.current.clientWidth;
      if (width > 0) {
        setScale(Math.min(1, width / 1040));
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (wrapperRef.current) {
      ro.observe(wrapperRef.current);
    }
    window.addEventListener("resize", updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`w-full max-w-[1040px] mx-auto overflow-hidden flex items-start justify-center ${className}`}
      style={{
        height: `${Math.round(735 * scale)}px`,
      }}
    >
      <div
        id={id}
        data-certificate-root
        className="relative bg-white text-slate-900 rounded-[28px] shadow-2xl overflow-hidden select-none border border-slate-200/90 flex flex-col justify-between px-12 py-10 print:shadow-none print:border-none print:m-0 shrink-0"
        style={{
          width: "1040px",
          minWidth: "1040px",
          maxWidth: "1040px",
          height: "735px",
          minHeight: "735px",
          maxHeight: "735px",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          boxSizing: "border-box",
        }}
      >
        {/* ------------------------------------------------------------- */}
        {/* EMBEDDED GOOGLE FONTS FOR ZERO-LATENCY HTML2CANVAS RENDERING */}
        {/* ------------------------------------------------------------- */}
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Great+Vibes&family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,600;1,700&display=swap');

          @media print {
            body * {
              visibility: hidden;
            }
            [data-certificate-root],
            [data-certificate-root] * {
              visibility: visible;
            }
            [data-certificate-root] {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              aspect-ratio: 1.414 / 1 !important;
              transform: none !important;
              box-shadow: none !important;
              border: none !important;
              margin: 0 !important;
            }
          }
        `}</style>

        {/* ------------------------------------------------------------- */}
        {/* ROYAL INSET DIPLOMA BORDERS (HIGH-END ACADEMIC PRESTIGE)      */}
        {/* ------------------------------------------------------------- */}
        <div className="absolute inset-4 border-[1.5px] border-slate-200/90 rounded-[22px] pointer-events-none z-10" />
        <div
          className="absolute inset-[22px] border-[1.5px] rounded-[18px] pointer-events-none z-10 opacity-35"
          style={{ borderColor: palette.secondary }}
        />

        {/* Corner Bracket Accents (Top-Left, Top-Right, Bottom-Left, Bottom-Right) */}
        <div
          className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 rounded-tl-sm pointer-events-none z-10 opacity-75"
          style={{ borderColor: palette.accent }}
        />
        <div
          className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 rounded-tr-sm pointer-events-none z-10 opacity-75"
          style={{ borderColor: palette.accent }}
        />
        <div
          className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 rounded-bl-sm pointer-events-none z-10 opacity-75"
          style={{ borderColor: palette.accent }}
        />
        <div
          className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 rounded-br-sm pointer-events-none z-10 opacity-75"
          style={{ borderColor: palette.accent }}
        />

        {/* ------------------------------------------------------------- */}
        {/* DYNAMIC FLUID WAVE CORNER DECORATIONS (CANVAS POWERED)         */}
        {/* 100% BULLETPROOF IN BOTH LIVE PREVIEW & HTML2CANVAS EXPORT    */}
        {/* ------------------------------------------------------------- */}
        <CertificateWavesCanvas palette={palette} />

        {/* Subtle background crest watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] z-0">
          <div className="relative w-[360px] h-[360px]">
            <Image
              src="/assets/SRC Logo.png"
              alt="Watermark Crest"
              fill
              unoptimized={true}
              className="object-contain"
            />
          </div>
        </div>

        {/* Revocation Stamp Overlay (if revoked) */}
        {isRevoked && (
          <div className="absolute inset-0 z-40 bg-red-950/15 backdrop-blur-[1px] flex items-center justify-center">
            <div className="border-4 border-red-600 text-red-600 uppercase font-black tracking-widest text-6xl px-8 py-3 rounded-2xl rotate-[-15deg] shadow-2xl bg-white/90">
              REVOKED
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* OFFICIAL VERIFICATION QR SEAL (RIGHT FLANK BELOW HEADER LINE)  */}
        {/* ------------------------------------------------------------- */}
        {showQrCode && (
          <div className="absolute top-[124px] right-[44px] z-20 flex flex-col items-center">
            <div className="p-1.5 rounded-xl bg-white border border-slate-200/90 shadow-xs flex flex-col items-center">
              <ScannableQRCode
                value={certificate.verificationUrl}
                size={52}
                level="M"
                fgColor={palette.primary}
              />
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* 1. HEADER (LEFT: SRC HORIZONTAL, CENTER: CLUB LOGO, RIGHT: JD) */}
        {/* ------------------------------------------------------------- */}
        <header
          data-certificate-header
          className="relative z-10 flex items-center justify-between gap-4 border-b border-slate-100/90 pb-3 px-2"
        >
          {/* Left: SRC Horizontal Logo (100% clean white background) */}
          <div className="flex-1 flex items-center justify-start">
            <div className="relative h-[56px] w-[220px] shrink-0">
              <Image
                src="/assets/SRC Horizontal B.png"
                alt="Student Representative Council Logo"
                fill
                unoptimized={true}
                className="object-contain object-left"
                priority
              />
            </div>
          </div>

          {/* Center: Organizing Club Logo / 3D Embossed Seal (Rendered ONLY if event is conducted by a club) */}
          {clubLogoSrc && (
            <div className="flex flex-col items-center justify-center shrink-0 px-2">
              <div className="relative h-[60px] w-[60px] rounded-full overflow-hidden bg-white shadow-md border-2 border-amber-500/80 ring-4 ring-amber-300/30 p-1 flex items-center justify-center">
                <Image
                  src={clubLogoSrc}
                  alt={certificate.organizerClub || "Event Club"}
                  fill
                  unoptimized={true}
                  className="object-contain p-0.5 rounded-full"
                />
              </div>
            </div>
          )}

          {/* Right: JD Header Logo */}
          <div className="flex-1 flex items-center justify-end">
            <div className="relative h-[56px] w-[220px] shrink-0">
              <Image
                src="/assets/JD Header B.png"
                alt="JD College of Engineering and Management"
                fill
                unoptimized={true}
                className="object-contain object-right"
                priority
              />
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------- */}
        {/* 2. BODY CONTENT (CERTIFICATE OF PARTICIPATION / RECIPIENT) */}
        {/* ------------------------------------------------------------- */}
        <main
          data-certificate-body
          className="relative z-10 flex flex-col items-center text-center my-auto py-2 space-y-2"
        >
          {/* CERTIFICATE Header in Dynamic Color */}
          <h1
            className="font-serif tracking-[0.18em] text-[44px] font-extrabold uppercase leading-none"
            style={{
              fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
              color: palette.primary,
            }}
          >
            CERTIFICATE
          </h1>

          {/* Dynamic Category Pill Badge (OF PARTICIPATION / OF ACHIEVEMENT) */}
          <div className="inline-block">
            <div
              className="rounded-full px-10 py-1.5 shadow-md flex items-center justify-center border border-white/30"
              style={{
                background: `linear-gradient(135deg, ${palette.pillBg}, ${palette.secondary})`,
                boxShadow: `0 4px 16px ${palette.borderGlow}`,
              }}
            >
              <span className="font-sans font-black text-[13px] tracking-[0.26em] uppercase text-white">
                {certificate.type === "ACHIEVEMENT"
                  ? "OF ACHIEVEMENT"
                  : certificate.title.toUpperCase().replace(/^CERTIFICATE\s+/, "") || "OF PARTICIPATION"}
              </span>
            </div>
          </div>

          {/* PROUDLY PRESENTED TO */}
          <p className="font-serif font-bold text-[11px] text-slate-500 tracking-[0.3em] uppercase pt-0.5">
            PROUDLY PRESENTED TO
          </p>

          {/* Recipient Name in Elegant Calligraphy Script (Great Vibes) */}
          <div className="space-y-1 w-full max-w-xl mx-auto py-0.5">
            <h2
              className="text-[54px] text-slate-900 leading-tight px-4 drop-shadow-xs"
              style={{
                fontFamily: "'Great Vibes', cursive, 'Brush Script MT', sans-serif",
                fontWeight: 400,
              }}
            >
              {certificate.recipientName || "Participant Name"}
            </h2>

            {/* Ornamental Divider with Centered Diamond */}
            <div className="flex items-center justify-center gap-3 w-72 mx-auto py-0.5">
              <div
                className="h-[1.5px] flex-1 rounded-full opacity-65"
                style={{
                  background: `linear-gradient(to right, transparent, ${palette.secondary})`,
                }}
              />
              <div
                className="w-2.5 h-2.5 rotate-45 rounded-[1px] shadow-xs shrink-0"
                style={{ backgroundColor: palette.secondary }}
              />
              <div
                className="h-[1.5px] flex-1 rounded-full opacity-65"
                style={{
                  background: `linear-gradient(to left, transparent, ${palette.secondary})`,
                }}
              />
            </div>
          </div>

          {/* Citation Body Text */}
          <p className="max-w-[680px] text-[13.5px] text-slate-700 leading-relaxed font-sans px-6 font-normal">
            {certificate.citation ||
              `For outstanding performance in the ${certificate.eventName}, in recognition of your outstanding performance, dedication, and technical skills.`}
          </p>
        </main>

        {/* ------------------------------------------------------------- */}
        {/* 3. FOOTER (4 INSTITUTIONAL SIGNATURES ON PURE WHITE BASELINE)  */}
        {/* 100% CONTRAST & LEGIBILITY GUARANTEED ACROSS ALL 4 SIGNATORIES */}
        {/* ------------------------------------------------------------- */}
        <footer
          data-certificate-footer
          className="relative z-10 pt-3 border-t border-slate-100/90 w-full"
        >
          <div className="grid grid-cols-4 gap-6 items-end text-center w-full max-w-[880px] mx-auto px-4">
            {certificate.signatories.slice(0, 4).map((sig, idx) => (
              <div key={sig.id || idx} className="space-y-1 flex flex-col items-center">
                {/* Signature Image (Transparent PNG) or Cursive Text */}
                <div className="h-11 flex items-end justify-center w-full px-1">
                  {sig.signatureImageUrl ? (
                    <div className="relative h-10 w-28 max-w-full">
                      <Image
                        src={
                          sig.signatureImageUrl.startsWith("http://") ||
                          sig.signatureImageUrl.startsWith("https://")
                            ? `/api/proxy-image?url=${encodeURIComponent(sig.signatureImageUrl)}`
                            : sig.signatureImageUrl
                        }
                        alt={sig.name}
                        fill
                        unoptimized={true}
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <span
                      className="text-sm text-slate-800 tracking-wider truncate max-w-full font-medium"
                      style={{
                        fontFamily: "'Great Vibes', cursive, 'Brush Script MT', sans-serif",
                      }}
                    >
                      {sig.name}
                    </span>
                  )}
                </div>

                {/* Line */}
                <div className="w-full h-[1.5px] bg-slate-800/80" />

                {/* Designation & Organization Below Line (Always high contrast on white) */}
                <div className="leading-tight">
                  <p className="text-[11px] font-bold text-slate-900 truncate max-w-full">
                    {sig.designation}
                  </p>
                  <p className="text-[9px] text-slate-500 font-medium truncate max-w-full">
                    {sig.organization || "SRC, JDCOEM"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
