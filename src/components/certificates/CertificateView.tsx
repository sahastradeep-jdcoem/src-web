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
      {/* DYNAMIC FLUID WAVE CORNER DECORATIONS (MATCHING USER REFERENCE) */}
      {/* ------------------------------------------------------------- */}

      {/* 1. TOP-LEFT FLUID WAVE RIBBONS WITH CONTOUR LINES */}
      <svg
        className="absolute -top-2 -left-2 w-72 sm:w-88 md:w-[380px] h-auto pointer-events-none z-0"
        viewBox="0 0 380 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="tlGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.primary} stopOpacity="0.95" />
            <stop offset="100%" stopColor={palette.secondary} stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="tlGrad2" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor={palette.secondary} stopOpacity="0.75" />
            <stop offset="100%" stopColor={palette.accent} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {/* Deep background wave band */}
        <path
          d="M-20 -20L280 -20C240 40 210 90 150 110C90 130 60 190 -20 220L-20 -20Z"
          fill="url(#tlGrad1)"
        />
        {/* Mid flowing ribbon */}
        <path
          d="M-20 -20L210 -20C170 30 140 80 90 120C40 160 20 210 -20 260L-20 -20Z"
          fill="url(#tlGrad2)"
        />
        {/* Accent ripple */}
        <path
          d="M-20 60C30 70 80 120 70 170C60 210 20 240 -20 270L-20 60Z"
          fill={palette.accent}
          fillOpacity="0.3"
        />
        {/* White organic wave contour lines */}
        <path
          d="M-10 10C50 30 130 60 170 110C210 160 190 220 230 260"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeOpacity="0.45"
          strokeLinecap="round"
        />
        <path
          d="M-10 40C40 60 100 90 130 140C160 190 150 240 180 270"
          stroke="#FFFFFF"
          strokeWidth="1"
          strokeOpacity="0.3"
          strokeLinecap="round"
        />
        <circle cx="150" cy="50" r="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <circle cx="110" cy="90" r="2" fill="#FFFFFF" fillOpacity="0.5" />
      </svg>

      {/* 2. BOTTOM-RIGHT EXTENDED FLUID WAVE FRAME (MATCHING USER REFERENCE) */}
      <svg
        className="absolute -bottom-2 -right-2 w-80 sm:w-96 md:w-[440px] h-auto pointer-events-none z-0"
        viewBox="0 0 440 340"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="brGrad1" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={palette.primary} stopOpacity="0.95" />
            <stop offset="70%" stopColor={palette.secondary} stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.accent} stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="brGrad2" x1="100%" y1="100%" x2="0%" y2="20%">
            <stop offset="0%" stopColor={palette.secondary} stopOpacity="0.8" />
            <stop offset="100%" stopColor={palette.accent} stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="brGrad3" x1="80%" y1="100%" x2="20%" y2="0%">
            <stop offset="0%" stopColor={palette.accent} stopOpacity="0.5" />
            <stop offset="100%" stopColor={palette.primary} stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Outer Deep Wave Ribbon */}
        <path
          d="M460 360L160 360C220 300 250 250 290 190C330 130 380 70 460 20L460 360Z"
          fill="url(#brGrad1)"
        />
        {/* Mid Flowing Wave Ribbon */}
        <path
          d="M460 360L230 360C280 310 320 260 350 200C380 140 410 90 460 70L460 360Z"
          fill="url(#brGrad2)"
        />
        {/* Forward Sweeping Wave Accent */}
        <path
          d="M460 360L310 360C350 320 390 280 410 220C430 160 440 120 460 110L460 360Z"
          fill="url(#brGrad3)"
        />

        {/* White Wave Contour Ribbons */}
        <path
          d="M200 350C250 290 280 240 330 180C370 120 410 70 450 30"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeOpacity="0.5"
          strokeLinecap="round"
        />
        <path
          d="M260 350C300 300 340 250 370 190C400 130 430 90 450 60"
          stroke="#FFFFFF"
          strokeWidth="1"
          strokeOpacity="0.35"
          strokeLinecap="round"
        />
        <path
          d="M170 355C220 315 260 270 300 220C340 160 390 110 445 70"
          stroke={palette.accent}
          strokeWidth="1.2"
          strokeOpacity="0.6"
          strokeLinecap="round"
        />

        <circle cx="340" cy="220" r="2" fill="#FFFFFF" fillOpacity="0.5" />
        <circle cx="380" cy="160" r="1.5" fill="#FFFFFF" fillOpacity="0.6" />
      </svg>

      {/* 3. BOTTOM-LEFT FLUID WAVE ACCENT (MATCHING USER REFERENCE) */}
      <svg
        className="absolute -bottom-2 -left-2 w-64 sm:w-76 md:w-88 h-auto pointer-events-none z-0"
        viewBox="0 0 320 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M-20 240L180 240C140 190 100 170 80 130C60 90 30 50 -20 20L-20 240Z"
          fill={palette.primary}
          fillOpacity="0.9"
        />
        <path
          d="M-20 240L130 240C90 200 60 170 40 130C20 90 0 60 -20 50L-20 240Z"
          fill={palette.secondary}
          fillOpacity="0.7"
        />
        <path
          d="M-20 240L80 240C50 210 30 180 10 140L-20 120L-20 240Z"
          fill={palette.accent}
          fillOpacity="0.4"
        />
        <path
          d="M-10 140C20 160 50 190 90 230"
          stroke="#FFFFFF"
          strokeWidth="1.2"
          strokeOpacity="0.4"
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
      {/* 1. HEADER (LEFT: SRC HORIZONTAL, CENTER: CLUB LOGO, RIGHT: JD HEADER) */}
      {/* ------------------------------------------------------------- */}
      <header
        data-certificate-header
        className="relative z-10 flex items-center justify-between gap-4 border-b border-slate-100/90 pb-3"
      >
        {/* Left: SRC Horizontal Logo */}
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

        {/* Center: Organizing Club Logo / 3D Embossed Shield */}
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
          {certificate.organizerClub && (
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 max-w-[130px] truncate text-center">
              {certificate.organizerClub}
            </span>
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
      {/* 3. FOOTER (4 SIGNATURES & CLEAN MINIMAL STANDALONE QR CODE) */}
      {/* ------------------------------------------------------------- */}
      <footer
        data-certificate-footer
        className="relative z-10 pt-2 sm:pt-3 border-t border-slate-100/90 flex items-end justify-between gap-3 sm:gap-4"
      >
        {/* Left: Clean Minimal Standalone QR Code (NO bulky box, NO event code, NO extra text) */}
        {showQrCode && (
          <div className="flex flex-col items-center justify-center shrink-0">
            <div className="p-1 rounded-lg bg-white/95 border border-slate-200/90 shadow-xs">
              <ScannableQRCode
                value={certificate.verificationUrl}
                size={46}
                level="M"
                fgColor={palette.primary}
              />
            </div>
          </div>
        )}

        {/* Right: Signatures Grid (4 Institutional Columns) */}
        <div className="flex-1 grid grid-cols-4 gap-2 sm:gap-4 items-end text-center">
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

              {/* Designation & Organization Below Line (No duplicated titles above) */}
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
