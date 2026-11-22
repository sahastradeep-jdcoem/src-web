"use client";

import React from "react";
import Image from "next/image";
import { CertificateRecord, CertificateColorPalette } from "@/types/certificates";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";
import { ShieldCheck, Award } from "lucide-react";
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

  return (
    <div
      id={id}
      data-certificate-root
      className={`relative w-full max-w-[1040px] aspect-[1.414/1] bg-white text-slate-900 rounded-2xl shadow-xl overflow-hidden select-none border border-slate-200/80 mx-auto flex flex-col justify-between p-8 sm:p-10 md:p-12 print:shadow-none print:border-none print:m-0 print:w-full print:aspect-auto ${className}`}
      style={{
        boxSizing: "border-box",
        minHeight: "560px",
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* DYNAMIC FLUID WAVE CORNER DECORATIONS (MATCHING USER REFERENCE) */}
      {/* ------------------------------------------------------------- */}
      {/* Top-Left & Bottom-Left Abstract Fluid Waves */}
      <svg
        className="absolute -left-6 -bottom-6 w-72 sm:w-88 md:w-96 h-auto pointer-events-none z-0"
        viewBox="0 0 320 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M-20 280C40 280 80 230 70 170C60 110 130 90 170 50C200 20 230 -10 260 -20L-20 -20L-20 280Z"
          fill={palette.primary}
          fillOpacity="0.95"
        />
        <path
          d="M-20 280C50 280 110 240 120 180C130 120 180 110 210 60C240 10 270 0 300 -10L-20 -10L-20 280Z"
          fill={palette.secondary}
          fillOpacity="0.65"
        />
        <path
          d="M-20 280C60 270 140 220 150 150C160 80 220 60 260 20L-20 -20L-20 280Z"
          fill={palette.accent}
          fillOpacity="0.4"
        />
        <circle cx="90" cy="190" r="1.5" fill="#FFFFFF" fillOpacity="0.6" />
        <circle cx="140" cy="130" r="2" fill="#FFFFFF" fillOpacity="0.5" />
      </svg>

      {/* Top-Right & Bottom-Right Abstract Fluid Waves */}
      <svg
        className="absolute -right-6 -bottom-8 w-72 sm:w-88 md:w-96 h-auto pointer-events-none z-0"
        viewBox="0 0 320 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M340 280C260 280 220 220 240 160C260 100 180 80 140 40C110 10 70 -10 40 -20L340 -20L340 280Z"
          fill={palette.primary}
          fillOpacity="0.95"
        />
        <path
          d="M340 280C250 280 190 230 190 170C190 110 130 90 90 50C60 20 30 10 0 0L340 0L340 280Z"
          fill={palette.secondary}
          fillOpacity="0.65"
        />
        <path
          d="M340 280C240 260 170 200 160 130C150 70 80 40 40 10L340 0L340 280Z"
          fill={palette.accent}
          fillOpacity="0.4"
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
        className="relative z-10 flex items-center justify-between gap-4 border-b border-slate-100 pb-3"
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

        {/* Center: Organizing Club Logo / Emblem */}
        <div className="flex flex-col items-center justify-center shrink-0 px-2">
          {certificate.clubLogoUrl ? (
            <div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-full overflow-hidden bg-white shadow-sm border border-slate-200 p-0.5">
              <Image
                src={certificate.clubLogoUrl}
                alt={certificate.organizerClub || "Event Club"}
                fill
                unoptimized={true}
                className="object-contain rounded-full"
              />
            </div>
          ) : (
            <div
              className="h-11 w-11 sm:h-13 sm:w-13 rounded-full flex flex-col items-center justify-center text-white shadow-sm border border-white/40"
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
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 max-w-[120px] truncate text-center">
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
        className="relative z-10 flex flex-col items-center text-center my-auto py-3 sm:py-4 space-y-2.5 sm:space-y-3"
      >
        {/* CERTIFICATE Header in Dynamic Color */}
        <h1
          className="font-serif tracking-[0.16em] text-3xl sm:text-4xl md:text-5xl font-extrabold uppercase leading-none"
          style={{ color: palette.primary }}
        >
          CERTIFICATE
        </h1>

        {/* Dynamic Category Pill Badge (OF PARTICIPATION / MERIT) */}
        <div className="inline-block">
          <div
            className="rounded-full px-6 sm:px-9 py-1 sm:py-1.5 shadow-md flex items-center justify-center border border-white/20"
            style={{
              background: `linear-gradient(135deg, ${palette.pillBg}, ${palette.secondary})`,
            }}
          >
            <span
              className="font-sans font-extrabold text-xs sm:text-sm tracking-[0.22em] uppercase text-white"
            >
              {certificate.type === "ACHIEVEMENT"
                ? "OF ACHIEVEMENT"
                : certificate.title.toUpperCase().replace(/^CERTIFICATE\s+/, "") || "OF PARTICIPATION"}
            </span>
          </div>
        </div>

        {/* PROUDLY PRESENTED TO */}
        <p className="font-serif font-bold text-[10px] sm:text-xs text-slate-500 tracking-[0.25em] uppercase pt-1">
          PROUDLY PRESENTED TO
        </p>

        {/* Recipient Name in Elegant Script / Serif */}
        <div className="space-y-1 w-full max-w-xl mx-auto">
          <h2 className="font-serif italic font-bold text-2xl sm:text-3xl md:text-4xl text-slate-900 tracking-wide px-4">
            {certificate.recipientName || "Participant Name"}
          </h2>

          {/* Ornamental Divider Line */}
          <div className="flex items-center justify-center gap-2 max-w-xs mx-auto py-0.5">
            <div
              className="h-[1.5px] flex-1 rounded-full opacity-60"
              style={{ backgroundColor: palette.secondary }}
            />
            <div
              className="w-2 h-2 rotate-45 rounded-[1px]"
              style={{ backgroundColor: palette.accent }}
            />
            <div
              className="h-[1.5px] flex-1 rounded-full opacity-60"
              style={{ backgroundColor: palette.secondary }}
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
      {/* 3. FOOTER (SIGNATURES & SCANNABLE AUTHENTICITY QR CODE) */}
      {/* ------------------------------------------------------------- */}
      <footer
        data-certificate-footer
        className="relative z-10 pt-2 sm:pt-3 border-t border-slate-100 flex items-end justify-between gap-4"
      >
        {/* Left: Scannable Authenticity QR & Credential Info */}
        {showQrCode && (
          <div className="flex items-center gap-2.5 bg-slate-50/90 border border-slate-200/90 rounded-xl p-2 shrink-0 max-w-[210px] shadow-xs">
            <div className="bg-white p-1 rounded-lg border border-slate-200/80 shrink-0">
              <ScannableQRCode
                value={certificate.verificationUrl}
                size={52}
                level="M"
                fgColor={palette.primary}
              />
            </div>
            <div className="space-y-0.5 text-left">
              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 uppercase tracking-tight">
                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Verified Credential</span>
              </div>
              <p className="font-mono text-[9px] font-bold text-slate-800 tracking-tight truncate max-w-[120px]">
                {certificate.certificateNumber}
              </p>
              <p className="text-[8px] text-slate-500 leading-tight">
                Scan to verify genuine authenticity
              </p>
            </div>
          </div>
        )}

        {/* Right: Signatures Grid (2 to 4 Signatories) */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 items-end text-center">
          {certificate.signatories.slice(0, 4).map((sig, idx) => (
            <div key={sig.id || idx} className="space-y-1 flex flex-col items-center">
              {/* Signature Image (Transparent PNG) or Cursive Text */}
              <div className="h-9 sm:h-11 flex items-end justify-center w-full px-2">
                {sig.signatureImageUrl ? (
                  <div className="relative h-8 sm:h-10 w-28 max-w-full">
                    <Image
                      src={sig.signatureImageUrl}
                      alt={sig.name}
                      fill
                      unoptimized={true}
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <span className="font-serif italic text-xs sm:text-sm text-slate-600 tracking-wider">
                    {sig.name}
                  </span>
                )}
              </div>

              {/* Line */}
              <div className="w-full h-[1.5px] bg-slate-700/80" />

              {/* Title & Organization */}
              <div className="leading-tight">
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-800">
                  {sig.designation}
                </p>
                <p className="text-[8px] sm:text-[9px] text-slate-500 font-medium">
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
