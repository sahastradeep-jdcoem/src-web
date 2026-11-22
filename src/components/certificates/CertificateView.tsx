"use client";

import React from "react";
import Image from "next/image";
import { CertificateRecord, CertificateColorPalette } from "@/types/certificates";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";
import { Award } from "lucide-react";
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
      {/* DYNAMIC FLUID WAVE CORNER DECORATIONS (BOTTOM CORNERS ONLY)  */}
      {/* (TOP HEADER IS 100% PURE WHITE TO ENSURE FULL LOGO CLARITY) */}
      {/* ------------------------------------------------------------- */}

      {/* 1. BOTTOM-RIGHT EXTENDED FLUID WAVE FRAME */}
      <svg
        className="absolute -bottom-1 -right-1 pointer-events-none z-0"
        width={460}
        height={360}
        viewBox="0 0 460 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "460px", height: "360px" }}
      >
        {/* Layer 1: Deep Primary Sweeping Ribbon */}
        <path
          d="M480 380L130 380C195 315 230 260 275 195C320 130 375 65 480 15L480 380Z"
          fill={palette.primary}
          fillOpacity="0.96"
        />
        {/* Layer 2: Secondary Mid-Tone Flow */}
        <path
          d="M480 380L210 380C265 325 310 270 345 205C380 140 415 85 480 65L480 380Z"
          fill={palette.secondary}
          fillOpacity="0.9"
        />
        {/* Layer 3: Vibrant Accent Ribbon */}
        <path
          d="M480 380L290 380C335 335 375 290 400 225C425 160 440 115 480 105L480 380Z"
          fill={palette.accent}
          fillOpacity="0.72"
        />
        {/* Layer 4: Front Highlight Ripple */}
        <path
          d="M480 380L360 380C395 345 425 310 440 255C455 200 465 165 480 155L480 380Z"
          fill={palette.accent}
          fillOpacity="0.38"
        />

        {/* White Wave Contour Lines */}
        <path
          d="M175 370C230 305 265 250 315 185C360 120 405 65 450 25"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeOpacity="0.55"
          strokeLinecap="round"
        />
        <path
          d="M240 370C285 315 325 260 360 195C395 130 430 85 460 55"
          stroke="#FFFFFF"
          strokeWidth="1"
          strokeOpacity="0.4"
          strokeLinecap="round"
        />
        <path
          d="M150 375C205 330 250 280 290 225C335 160 385 105 445 65"
          stroke={palette.accent}
          strokeWidth="1.2"
          strokeOpacity="0.7"
          strokeLinecap="round"
        />

        <circle cx="355" cy="235" r="2" fill="#FFFFFF" fillOpacity="0.5" />
        <circle cx="395" cy="170" r="1.5" fill="#FFFFFF" fillOpacity="0.6" />
      </svg>

      {/* 2. BOTTOM-LEFT FLUID WAVE ACCENT */}
      <svg
        className="absolute -bottom-1 -left-1 pointer-events-none z-0"
        width={340}
        height={260}
        viewBox="0 0 340 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "340px", height: "260px" }}
      >
        <path
          d="M-20 280L220 280C175 220 130 200 105 150C80 100 45 55 -20 20L-20 280Z"
          fill={palette.primary}
          fillOpacity="0.95"
        />
        <path
          d="M-20 280L160 280C115 230 80 195 55 150C30 105 5 70 -20 60L-20 280Z"
          fill={palette.secondary}
          fillOpacity="0.84"
        />
        <path
          d="M-20 280L100 280C65 245 40 210 15 165L-20 140L-20 280Z"
          fill={palette.accent}
          fillOpacity="0.5"
        />
        <path
          d="M-10 160C25 185 60 220 110 270"
          stroke="#FFFFFF"
          strokeWidth="1.2"
          strokeOpacity="0.45"
          strokeLinecap="round"
        />
      </svg>

      {/* Subtle background crest watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] z-0">
        <div className="relative w-96 h-96">
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
          <div className="border-4 border-red-600 text-red-600 uppercase font-black tracking-widest text-4xl sm:text-6xl px-8 py-3 rounded-2xl rotate-[-15deg] shadow-2xl bg-white/90">
            REVOKED
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* AUTHENTICITY QR CODE (POSITIONED IN UPPER-RIGHT UNDER JD LOGO) */}
      {/* ------------------------------------------------------------- */}
      {showQrCode && (
        <div className="absolute top-22 sm:top-25 md:top-28 right-7 sm:right-9 md:right-11 z-20 flex flex-col items-center">
          <div className="p-1 rounded-xl bg-white/95 border border-slate-200/90 shadow-xs">
            <ScannableQRCode
              value={certificate.verificationUrl}
              size={50}
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
        className="relative z-10 flex items-center justify-between gap-4 border-b border-slate-100/90 pb-3"
      >
        {/* Left: SRC Horizontal Logo (100% clean white background) */}
        <div className="flex-1 flex items-center justify-start">
          <div className="relative h-12 sm:h-14 md:h-16 w-44 sm:w-52 md:w-56 shrink-0">
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

        {/* Center: Organizing Club Logo / 3D Embossed Shield (No text below) */}
        <div className="flex flex-col items-center justify-center shrink-0 px-2">
          {clubLogoSrc ? (
            <div className="relative h-13 w-13 sm:h-15 sm:w-15 md:h-16 md:w-16 rounded-full overflow-hidden bg-white shadow-md border-2 border-amber-500/80 ring-2 ring-amber-300/40 p-1 flex items-center justify-center">
              <Image
                src={clubLogoSrc}
                alt={certificate.organizerClub || "Event Club"}
                fill
                unoptimized={true}
                className="object-contain p-0.5 rounded-full"
              />
            </div>
          ) : (
            <div
              className="h-12 w-12 sm:h-14 sm:w-14 md:h-15 md:w-15 rounded-full flex flex-col items-center justify-center text-white shadow-md border-2 border-amber-400 ring-2 ring-amber-200/50"
              style={{
                background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
              }}
            >
              <Award className="w-5 h-5 text-amber-300" />
              <span className="text-[8px] font-black tracking-tighter uppercase leading-none mt-0.5">
                {certificate.organizerClub ? certificate.organizerClub.slice(0, 5) : "EVENT"}
              </span>
            </div>
          )}
        </div>

        {/* Right: JD Header Logo */}
        <div className="flex-1 flex items-center justify-end">
          <div className="relative h-12 sm:h-14 md:h-16 w-44 sm:w-52 md:w-56 shrink-0">
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
        className="relative z-10 flex flex-col items-center text-center my-auto py-2.5 sm:py-3.5 space-y-2 sm:space-y-2.5"
      >
        {/* CERTIFICATE Header in Dynamic Color */}
        <h1
          className="font-serif tracking-[0.16em] text-3xl sm:text-4xl md:text-5xl font-extrabold uppercase leading-none"
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
            className="rounded-full px-7 sm:px-10 py-1 sm:py-1.5 shadow-md flex items-center justify-center border border-white/25"
            style={{
              background: `linear-gradient(135deg, ${palette.pillBg}, ${palette.secondary})`,
              boxShadow: `0 4px 14px ${palette.borderGlow}`,
            }}
          >
            <span className="font-sans font-black text-xs sm:text-sm tracking-[0.24em] uppercase text-white">
              {certificate.type === "ACHIEVEMENT"
                ? "OF ACHIEVEMENT"
                : certificate.title.toUpperCase().replace(/^CERTIFICATE\s+/, "") || "OF PARTICIPATION"}
            </span>
          </div>
        </div>

        {/* PROUDLY PRESENTED TO */}
        <p className="font-serif font-bold text-[10px] sm:text-xs text-slate-500 tracking-[0.28em] uppercase pt-0.5">
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
              className="w-2 h-2 rotate-45 rounded-[1px] shadow-xs shrink-0"
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
      {/* 3. FOOTER (4 INSTITUTIONAL SIGNATURES SPANNING FULL WIDTH)    */}
      {/* ------------------------------------------------------------- */}
      <footer
        data-certificate-footer
        className="relative z-10 pt-2 sm:pt-3 border-t border-slate-100/90 w-full"
      >
        <div className="grid grid-cols-4 gap-4 sm:gap-6 items-end text-center w-full max-w-4xl mx-auto">
          {certificate.signatories.slice(0, 4).map((sig, idx) => (
            <div key={sig.id || idx} className="space-y-1 flex flex-col items-center">
              {/* Signature Image (Transparent PNG) or Cursive Text */}
              <div className="h-9 sm:h-11 flex items-end justify-center w-full px-1">
                {sig.signatureImageUrl ? (
                  <div className="relative h-8 sm:h-10 w-28 max-w-full">
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
                    className="text-xs sm:text-sm text-slate-700 tracking-wider truncate max-w-full"
                    style={{
                      fontFamily: "'Great Vibes', cursive, 'Brush Script MT', sans-serif",
                    }}
                  >
                    {sig.name}
                  </span>
                )}
              </div>

              {/* Line */}
              <div className="w-full h-[1.5px] bg-slate-700/80" />

              {/* Designation & Organization Below Line */}
              <div className="leading-tight">
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-800 truncate max-w-full">
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
