"use client";

import React from "react";
import { CertificateRecord, CertificateColorPalette } from "@/types/certificates";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";
import { DEFAULT_CERTIFICATE_PALETTES } from "@/lib/colorExtractor";

interface CertificateViewProps {
  certificate: CertificateRecord;
  id?: string;
  className?: string;
  showQrCode?: boolean;
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

  return (
    <div
      id={id}
      data-certificate-root
      className={`relative w-full max-w-[1040px] aspect-[1.414/1] bg-white text-slate-900 rounded-[28px] shadow-2xl overflow-hidden select-none border border-slate-200/90 mx-auto flex flex-col justify-between p-7 sm:p-9 md:p-11 print:shadow-none print:border-none print:m-0 print:w-full print:aspect-auto ${className}`}
      style={{
        boxSizing: "border-box",
        minHeight: "560px",
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* EMBEDDED GOOGLE FONTS FOR ZERO-LATENCY HTML2CANVAS RENDERING */}
      {/* ------------------------------------------------------------- */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Great+Vibes&family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,600;1,700&display=swap');
      `}</style>

      {/* ------------------------------------------------------------- */}
      {/* ROYAL INSET DIPLOMA BORDERS (HIGH-END ACADEMIC PRESTIGE)      */}
      {/* ------------------------------------------------------------- */}
      <div className="absolute inset-3 sm:inset-4 border border-slate-200/90 rounded-[22px] pointer-events-none z-10" />
      <div
        className="absolute inset-4.5 sm:inset-5.5 border rounded-[18px] pointer-events-none z-10 opacity-35"
        style={{ borderColor: palette.secondary }}
      />

      {/* Corner Bracket Accents (Top-Left, Top-Right, Bottom-Left, Bottom-Right) */}
      <div
        className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 rounded-tl-sm pointer-events-none z-10 opacity-70"
        style={{ borderColor: palette.accent }}
      />
      <div
        className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 rounded-tr-sm pointer-events-none z-10 opacity-70"
        style={{ borderColor: palette.accent }}
      />
      <div
        className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 rounded-bl-sm pointer-events-none z-10 opacity-70"
        style={{ borderColor: palette.accent }}
      />
      <div
        className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 rounded-br-sm pointer-events-none z-10 opacity-70"
        style={{ borderColor: palette.accent }}
      />

      {/* ------------------------------------------------------------- */}
      {/* DYNAMIC FLUID WAVE CORNER DECORATIONS (PERIPHERAL CORNERS ONLY) */}
      {/* CAREFULLY CONFINED SO SIGNATURES & TEXT REMAIN 100% CLEAR       */}
      {/* ------------------------------------------------------------- */}

      {/* 1. BOTTOM-RIGHT CORNER FLUID WAVES (CONFINED TO OUTER CORNER) */}
      <svg
        data-certificate-wave="bottom-right"
        className="absolute -bottom-1 -right-1 pointer-events-none z-0"
        width={300}
        height={220}
        viewBox="0 0 300 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "300px", height: "220px" }}
      >
        {/* Layer 1: Deep Primary Sweeping Ribbon */}
        <path
          d="M320 240L110 240C165 200 205 165 240 120C270 75 295 30 320 0L320 240Z"
          fill={palette.primary}
          fillOpacity="0.96"
        />
        {/* Layer 2: Secondary Mid-Tone Flow */}
        <path
          d="M320 240L160 240C205 205 240 170 265 130C290 85 305 45 320 25L320 240Z"
          fill={palette.secondary}
          fillOpacity="0.88"
        />
        {/* Layer 3: Vibrant Accent Ribbon */}
        <path
          d="M320 240L215 240C245 210 270 180 285 140C300 100 310 65 320 50L320 240Z"
          fill={palette.accent}
          fillOpacity="0.7"
        />
        {/* Layer 4: Front Highlight Ripple */}
        <path
          d="M320 240L260 240C280 215 295 190 305 155C315 120 318 95 320 85L320 240Z"
          fill={palette.accent}
          fillOpacity="0.35"
        />

        {/* White Wave Contour Lines */}
        <path
          d="M140 235C185 195 220 160 250 115C280 70 300 30 315 5"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeOpacity="0.55"
          strokeLinecap="round"
        />
        <path
          d="M185 235C220 200 250 165 270 125C295 85 310 50 320 25"
          stroke="#FFFFFF"
          strokeWidth="1"
          strokeOpacity="0.4"
          strokeLinecap="round"
        />
        <path
          d="M120 238C165 205 200 170 230 130C265 85 295 45 315 15"
          stroke={palette.accent}
          strokeWidth="1.2"
          strokeOpacity="0.75"
          strokeLinecap="round"
        />

        <circle cx="265" cy="140" r="1.5" fill="#FFFFFF" fillOpacity="0.5" />
        <circle cx="290" cy="95" r="1.5" fill="#FFFFFF" fillOpacity="0.6" />
      </svg>

      {/* 2. BOTTOM-LEFT CORNER FLUID WAVES (CONFINED TO OUTER CORNER) */}
      <svg
        data-certificate-wave="bottom-left"
        className="absolute -bottom-1 -left-1 pointer-events-none z-0"
        width={210}
        height={150}
        viewBox="0 0 210 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "210px", height: "150px" }}
      >
        <path
          d="M-20 170L140 170C110 130 80 110 60 75C40 45 20 20 -20 0L-20 170Z"
          fill={palette.primary}
          fillOpacity="0.94"
        />
        <path
          d="M-20 170L100 170C70 135 50 110 30 75C15 50 0 25 -20 15L-20 170Z"
          fill={palette.secondary}
          fillOpacity="0.82"
        />
        <path
          d="M-20 170L60 170C40 140 25 115 10 85L-20 65L-20 170Z"
          fill={palette.accent}
          fillOpacity="0.45"
        />
        <path
          d="M-10 90C10 105 30 130 65 160"
          stroke="#FFFFFF"
          strokeWidth="1.2"
          strokeOpacity="0.45"
          strokeLinecap="round"
        />
      </svg>

      {/* Subtle background crest watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0">
        <img
          src="/assets/SRC Logo.png"
          alt="Watermark Crest"
          className="w-80 h-80 sm:w-96 sm:h-96 object-contain"
        />
      </div>

      {/* Revocation Stamp Overlay (if revoked) */}
      {isRevoked && (
        <div className="absolute inset-0 z-40 bg-red-950/15 backdrop-blur-[1px] flex items-center justify-center">
          <div className="border-4 border-red-600 text-red-600 uppercase font-black tracking-widest text-4xl sm:text-6xl px-8 py-3 rounded-2xl rotate-[-15deg] shadow-2xl bg-white/90">
            REVOKED
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* OFFICIAL VERIFICATION QR SEAL (RIGHT FLANK BELOW HEADER LINE)  */}
      {/* ------------------------------------------------------------- */}
      {showQrCode && (
        <div className="absolute top-[118px] sm:top-[128px] md:top-[138px] right-7 sm:right-9 md:right-11 z-20 flex flex-col items-center">
          <div className="p-1 rounded-xl bg-white/95 border border-slate-200/90 shadow-xs flex flex-col items-center">
            <ScannableQRCode
              value={certificate.verificationUrl}
              size={48}
              level="M"
              fgColor={palette.primary}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER (LEFT: SRC HORIZONTAL, CENTER: CLUB LOGO, RIGHT: JD HEADER) */}
      {/* ------------------------------------------------------------- */}
      <header
        data-certificate-header
        className="relative z-10 flex items-center justify-between gap-4 border-b border-slate-100/90 pb-3 px-2"
      >
        {/* Left: SRC Horizontal Logo (Natural proportions, never stretched by html2canvas) */}
        <div className="flex-1 flex items-center justify-start">
          <img
            src="/assets/SRC Horizontal B.png"
            alt="Student Representative Council Logo"
            className="h-12 sm:h-14 md:h-16 w-auto max-w-[220px] object-contain object-left shrink-0"
          />
        </div>

        {/* Center: Organizing Club Logo / 3D Embossed Seal (Rendered ONLY if event is conducted by a club) */}
        {clubLogoSrc && (
          <div className="flex flex-col items-center justify-center shrink-0 px-2">
            <div className="relative h-13 w-13 sm:h-15 sm:w-15 md:h-16 md:w-16 rounded-full overflow-hidden bg-white shadow-md border-2 border-amber-500/80 ring-4 ring-amber-300/30 p-1 flex items-center justify-center">
              <img
                src={clubLogoSrc}
                alt={certificate.organizerClub || "Event Club"}
                className="w-full h-full object-contain p-0.5 rounded-full"
              />
            </div>
          </div>
        )}

        {/* Right: JD Header Logo (Natural proportions, never stretched by html2canvas) */}
        <div className="flex-1 flex items-center justify-end">
          <img
            src="/assets/JD Header B.png"
            alt="JD College of Engineering and Management"
            className="h-12 sm:h-14 md:h-16 w-auto max-w-[240px] object-contain object-right shrink-0"
          />
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. BODY CONTENT (CERTIFICATE OF PARTICIPATION / RECIPIENT) */}
      {/* ------------------------------------------------------------- */}
      <main
        data-certificate-body
        className="relative z-10 flex flex-col items-center text-center my-auto py-2.5 sm:py-3.5 space-y-2 sm:space-y-2.5"
      >
        {/* CERTIFICATE Header in Dynamic Color */}
        <h1
          className="font-serif tracking-[0.18em] text-3xl sm:text-4xl md:text-5xl font-extrabold uppercase leading-none"
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
            className="rounded-full px-8 sm:px-11 py-1 sm:py-1.5 shadow-md flex items-center justify-center border border-white/30"
            style={{
              background: `linear-gradient(135deg, ${palette.pillBg}, ${palette.secondary})`,
              boxShadow: `0 4px 16px ${palette.borderGlow}`,
            }}
          >
            <span className="font-sans font-black text-xs sm:text-sm tracking-[0.26em] uppercase text-white">
              {certificate.type === "ACHIEVEMENT"
                ? "OF ACHIEVEMENT"
                : certificate.title.toUpperCase().replace(/^CERTIFICATE\s+/, "") || "OF PARTICIPATION"}
            </span>
          </div>
        </div>

        {/* PROUDLY PRESENTED TO */}
        <p className="font-serif font-bold text-[10px] sm:text-xs text-slate-500 tracking-[0.3em] uppercase pt-0.5">
          PROUDLY PRESENTED TO
        </p>

        {/* Recipient Name in Elegant Calligraphy Script (Great Vibes) */}
        <div className="space-y-1 w-full max-w-xl mx-auto py-0.5">
          <h2
            className="text-4xl sm:text-5xl md:text-6xl text-slate-900 leading-tight px-4 drop-shadow-xs"
            style={{
              fontFamily: "'Great Vibes', cursive, 'Brush Script MT', sans-serif",
              fontWeight: 400,
            }}
          >
            {certificate.recipientName || "Participant Name"}
          </h2>

          {/* Ornamental Divider with Centered Diamond */}
          <div className="flex items-center justify-center gap-3 w-64 sm:w-80 mx-auto py-0.5">
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
        <p className="max-w-2xl text-xs sm:text-[13px] md:text-sm text-slate-700 leading-relaxed font-sans px-6 font-normal">
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
        className="relative z-10 pt-2.5 sm:pt-3.5 border-t border-slate-100/90 w-full"
      >
        <div className="grid grid-cols-4 gap-4 sm:gap-6 items-end text-center w-full max-w-3xl sm:max-w-4xl mx-auto px-4">
          {certificate.signatories.slice(0, 4).map((sig, idx) => (
            <div key={sig.id || idx} className="space-y-1 flex flex-col items-center">
              {/* Signature Image (Transparent PNG) or Cursive Text */}
              <div className="h-9 sm:h-11 flex items-end justify-center w-full px-1">
                {sig.signatureImageUrl ? (
                  <img
                    src={
                      sig.signatureImageUrl.startsWith("http://") ||
                      sig.signatureImageUrl.startsWith("https://")
                        ? `/api/proxy-image?url=${encodeURIComponent(sig.signatureImageUrl)}`
                        : sig.signatureImageUrl
                    }
                    alt={sig.name}
                    className="h-8 sm:h-10 w-auto max-w-[112px] object-contain"
                  />
                ) : (
                  <span
                    className="text-xs sm:text-sm text-slate-800 tracking-wider truncate max-w-full font-medium"
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
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-900 truncate max-w-full">
                  {sig.designation}
                </p>
                <p className="text-[8px] sm:text-[9px] text-slate-500 font-medium truncate max-w-full">
                  {sig.organization || "SRC, JDCOEM"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
