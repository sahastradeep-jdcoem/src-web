"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CertificateRecord, CertificateColorPalette, CertificateSignatory } from "@/types/certificates";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";
import { DEFAULT_CERTIFICATE_PALETTES } from "@/lib/colorExtractor";
import {
  getCertificateSettings,
  DEFAULT_INSTITUTIONAL_SIGNATORIES,
  resolveCertificateClubLogoSync,
  resolveCertificateClubLogoAsync,
} from "@/lib/certificatesStore";

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

  // Institutional default signatories fallback if certificate has empty signature images
  // Synchronously initialize from localStorage cache so the very first render already has signature images!
  const [defaultSignatories, setDefaultSignatories] = useState<CertificateSignatory[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("src_certificate_settings");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed?.defaultSignatories) && parsed.defaultSignatories.length > 0) {
            return parsed.defaultSignatories;
          }
        }
      } catch {}
    }
    return DEFAULT_INSTITUTIONAL_SIGNATORIES;
  });

  useEffect(() => {
    const hasMissingSig = (certificate.signatories || []).some((s) => !s.signatureImageUrl);
    if (hasMissingSig || defaultSignatories.some((s) => !s.signatureImageUrl)) {
      getCertificateSettings()
        .then((settings) => {
          if (settings?.defaultSignatories?.length > 0) {
            setDefaultSignatories(settings.defaultSignatories);
          }
        })
        .catch(() => {});
    }
  }, [certificate]);

  // Auto-resolve organizing club logo synchronously on mount and reactively via fallbacks
  const [resolvedClubLogo, setResolvedClubLogo] = useState<string>(() =>
    resolveCertificateClubLogoSync(certificate)
  );

  useEffect(() => {
    const syncLogo = resolveCertificateClubLogoSync(certificate);
    if (syncLogo) {
      setResolvedClubLogo(syncLogo);
      return;
    }
    if (resolvedClubLogo) return;

    resolveCertificateClubLogoAsync(certificate)
      .then((logo) => {
        if (logo) {
          setResolvedClubLogo(logo);
        }
      })
      .catch(() => {});
  }, [certificate, resolvedClubLogo]);

  const qrVerificationUrl = certificate.verificationUrl?.startsWith("http")
    ? certificate.verificationUrl
    : certificate.verificationUrl
    ? `https://srcjdcoem.in${certificate.verificationUrl.startsWith("/") ? "" : "/"}${certificate.verificationUrl}`
    : `https://srcjdcoem.in/verify/certificate/${certificate.id || certificate.certificateNumber}`;

  // Sanitize remote club logo through proxy to prevent canvas CORS tainting during html2canvas export
  const effectiveClubLogo = resolvedClubLogo || certificate.clubLogoUrl || "";
  const clubLogoSrc = effectiveClubLogo
    ? effectiveClubLogo.startsWith("http://") || effectiveClubLogo.startsWith("https://")
      ? `/api/proxy-image?url=${encodeURIComponent(effectiveClubLogo)}`
      : effectiveClubLogo
    : "";

  // Always guarantee exactly 4 institutional signatories in the baseline footer
  const activeSignatories = useMemo(() => {
    return [0, 1, 2, 3].map((idx) => {
      const certSig = certificate.signatories?.[idx];
      const fallbackSig =
        (defaultSignatories && defaultSignatories[idx]) ||
        DEFAULT_INSTITUTIONAL_SIGNATORIES[idx];
      return {
        id: certSig?.id || fallbackSig.id,
        name: certSig?.name || fallbackSig.name,
        designation: certSig?.designation || fallbackSig.designation,
        organization: certSig?.organization || fallbackSig.organization || "SRC, JDCOEM",
        signatureImageUrl: certSig?.signatureImageUrl || fallbackSig?.signatureImageUrl || "",
      };
    });
  }, [certificate.signatories, defaultSignatories]);

  return (
    <div
      id={id}
      data-certificate-root
      className={`relative w-full max-w-[1040px] aspect-[1.414/1] text-slate-900 rounded-[28px] shadow-2xl overflow-hidden select-none border border-slate-200/90 mx-auto flex flex-col justify-between p-11 print:shadow-none print:border-none print:m-0 print:w-full print:aspect-auto ${className}`}
      style={{
        boxSizing: "border-box",
        minHeight: "560px",
        background: "radial-gradient(ellipse at center, #FFFFFF 0%, #FAFCFF 70%, #F5F7FB 100%)",
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
      <div className="absolute inset-3.5 border-[1.5px] border-slate-300/85 rounded-[22px] pointer-events-none z-10" />
      <div
        className="absolute inset-5 border border-dashed rounded-[18px] pointer-events-none z-10 opacity-35"
        style={{ borderColor: palette.secondary }}
      />
      <div
        className="absolute inset-[26px] border-[0.75px] rounded-[14px] pointer-events-none z-10 opacity-40"
        style={{ borderColor: palette.accent }}
      />

      {/* Engraved Victorian Corner Rosette Filigrees (Top-Left, Top-Right, Bottom-Left, Bottom-Right) */}
      <div className="absolute top-3.5 left-3.5 w-6 h-6 pointer-events-none z-10">
        <div className="absolute top-0 left-0 w-6 h-6 border-t-[2px] border-l-[2px] rounded-tl-[8px]" style={{ borderColor: palette.accent, opacity: 0.85 }} />
        <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t border-l rounded-tl-[4px]" style={{ borderColor: palette.secondary, opacity: 0.65 }} />
        <div className="absolute top-2 left-2 w-1.5 h-1.5 rotate-45 rounded-[0.5px]" style={{ backgroundColor: palette.accent, opacity: 0.95 }} />
      </div>
      <div className="absolute top-3.5 right-3.5 w-6 h-6 pointer-events-none z-10">
        <div className="absolute top-0 right-0 w-6 h-6 border-t-[2px] border-r-[2px] rounded-tr-[8px]" style={{ borderColor: palette.accent, opacity: 0.85 }} />
        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t border-r rounded-tr-[4px]" style={{ borderColor: palette.secondary, opacity: 0.65 }} />
        <div className="absolute top-2 right-2 w-1.5 h-1.5 rotate-45 rounded-[0.5px]" style={{ backgroundColor: palette.accent, opacity: 0.95 }} />
      </div>
      <div className="absolute bottom-3.5 left-3.5 w-6 h-6 pointer-events-none z-10">
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[2px] border-l-[2px] rounded-bl-[8px]" style={{ borderColor: palette.accent, opacity: 0.85 }} />
        <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b border-l rounded-bl-[4px]" style={{ borderColor: palette.secondary, opacity: 0.65 }} />
        <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rotate-45 rounded-[0.5px]" style={{ backgroundColor: palette.accent, opacity: 0.95 }} />
      </div>
      <div className="absolute bottom-3.5 right-3.5 w-6 h-6 pointer-events-none z-10">
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[2px] border-r-[2px] rounded-br-[8px]" style={{ borderColor: palette.accent, opacity: 0.85 }} />
        <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b border-r rounded-br-[4px]" style={{ borderColor: palette.secondary, opacity: 0.65 }} />
        <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rotate-45 rounded-[0.5px]" style={{ backgroundColor: palette.accent, opacity: 0.95 }} />
      </div>

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

        {/* Shimmering Gold Foil Contour Ribbons */}
        <path
          d="M160 237C200 202 235 167 260 122C285 80 305 40 318 10"
          stroke="#DFB76C"
          strokeWidth="1.5"
          strokeOpacity="0.85"
          strokeLinecap="round"
        />
        <path
          d="M200 237C235 205 260 175 278 135C295 95 308 60 318 35"
          stroke="#F5DEB3"
          strokeWidth="1"
          strokeOpacity="0.6"
          strokeLinecap="round"
        />

        <circle cx="245" cy="165" r="1.5" fill="#DFB76C" fillOpacity="0.75" />
        <circle cx="275" cy="115" r="1.5" fill="#DFB76C" fillOpacity="0.8" />
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
        {/* Shimmering Gold Accent Contour */}
        <path
          d="M-15 110C12 125 35 145 75 165"
          stroke="#DFB76C"
          strokeWidth="1.5"
          strokeOpacity="0.85"
          strokeLinecap="round"
        />
        <circle cx="45" cy="120" r="1.5" fill="#DFB76C" fillOpacity="0.75" />
      </svg>

      {/* Diploma Security Guilloché Concentric Inset Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div
          className="w-[520px] h-[520px] rounded-full border border-dashed flex items-center justify-center opacity-[0.035]"
          style={{ borderColor: palette.primary }}
        >
          <div
            className="w-[450px] h-[450px] rounded-full border border-dotted flex items-center justify-center"
            style={{ borderColor: palette.secondary }}
          >
            <div
              className="w-[380px] h-[380px] rounded-full border-[1.5px] border-dashed flex items-center justify-center"
              style={{ borderColor: palette.primary }}
            >
              <div
                className="w-[310px] h-[310px] rounded-full border border-dotted"
                style={{ borderColor: palette.accent }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Subtle background crest watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0">
        <img
          src="/assets/SRC Logo.png"
          alt="Watermark Crest"
          crossOrigin="anonymous"
          className="w-96 h-96 object-contain"
        />
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
        <div className="absolute top-[138px] right-11 z-20 flex flex-col items-center">
          <div className="p-1 rounded-xl bg-white/95 border border-slate-200/90 shadow-xs flex flex-col items-center">
            <ScannableQRCode
              value={qrVerificationUrl}
              size={48}
              level="M"
              fgColor={palette.primary}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* OFFICIAL GOLD RIBBON EMBLEM (LEFT FLANK BELOW SRC LOGO)       */}
      {/* Symmetrically balanced with the verification QR seal on right */}
      {/* ------------------------------------------------------------- */}
      <div className="absolute top-[138px] left-14 z-20 flex flex-col items-center">
        <img
          src="/assets/gold_ribbon.png"
          alt="Official Gold Ribbon Emblem"
          crossOrigin="anonymous"
          width={44}
          height={56}
          style={{
            height: "56px",
            width: "auto",
            aspectRatio: "83 / 106",
          }}
          className="h-14 w-auto object-contain drop-shadow-xs pointer-events-none"
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER (LEFT: SRC HORIZONTAL, CENTER: CLUB LOGO, RIGHT: JD HEADER) */}
      {/* ------------------------------------------------------------- */}
      <header
        data-certificate-header
        className="relative z-10 flex items-center justify-between gap-4 pb-3 px-2"
      >
        {/* Left: SRC Horizontal Logo (Natural 2.96:1 aspect ratio, never stretched) */}
        <div className="flex-1 flex items-center justify-start">
          <div className="h-[68px] flex items-center justify-start shrink-0">
            <img
              src="/assets/SRC Horizontal B.png"
              alt="Student Representative Council Logo"
              crossOrigin="anonymous"
              width={200}
              height={68}
              style={{
                height: "auto",
                maxHeight: "68px",
                width: "auto",
                maxWidth: "230px",
                aspectRatio: "1020 / 345",
              }}
              className="object-contain shrink-0"
            />
          </div>
        </div>

        {/* Center: Organizing Club Logo (Guild Medallion Seal) */}
        {clubLogoSrc && (
          <div className="flex flex-col items-center justify-center shrink-0 px-2">
            <div
              className="p-[2.5px] rounded-full shadow-md flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #ECC878 0%, #D4AF37 40%, #A67C1E 70%, #F5DEB3 100%)",
              }}
            >
              <div className="p-[1.5px] rounded-full bg-slate-900/10 flex items-center justify-center">
                <div className="relative h-16 w-16 rounded-full overflow-hidden bg-white shadow-xs border-2 border-amber-500/90 flex items-center justify-center">
                  <img
                    src={clubLogoSrc}
                    alt={certificate.organizerClub || "Event Club"}
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right: JD Header Logo (Natural 4.88:1 aspect ratio, never stretched) */}
        <div className="flex-1 flex items-center justify-end">
          <div className="h-16 flex items-center justify-end shrink-0">
            <img
              src="/assets/JD Header B.png"
              alt="JD College of Engineering and Management"
              crossOrigin="anonymous"
              width={250}
              height={52}
              style={{
                height: "auto",
                maxHeight: "52px",
                width: "auto",
                maxWidth: "250px",
                aspectRatio: "864 / 177",
              }}
              className="object-contain shrink-0"
            />
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. BODY CONTENT (CERTIFICATE OF PARTICIPATION / RECIPIENT) */}
      {/* Explicit margins used to guarantee identical vertical spacing  */}
      {/* between live preview and html2canvas without calc() collapses  */}
      {/* ------------------------------------------------------------- */}
      <main
        data-certificate-body
        className="relative z-10 flex flex-col items-center text-center my-auto py-3"
      >
        {/* CERTIFICATE Header in Dynamic Color */}
        <h1
          className="font-serif tracking-[0.18em] text-5xl font-extrabold uppercase leading-none mb-4"
          style={{
            fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
            color: palette.primary,
          }}
        >
          CERTIFICATE
        </h1>

        {/* Dynamic Category Pill Badge (OF PARTICIPATION / OF ACHIEVEMENT) */}
        <div className="inline-block mb-3.5">
          <div
            data-certificate-pill
            className="rounded-full px-11 py-1.5 shadow-md flex items-center justify-center border border-white/30"
            style={{
              background: `linear-gradient(135deg, ${palette.pillBg}, ${palette.secondary})`,
              boxShadow: `0 4px 16px ${palette.borderGlow}`,
            }}
          >
            <span
              data-certificate-pill-text
              className="font-sans font-black text-sm tracking-[0.26em] uppercase text-white whitespace-nowrap leading-none flex items-center justify-center text-center relative -top-[1px]"
              style={{
                lineHeight: "1",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {certificate.type === "ACHIEVEMENT"
                ? "OF ACHIEVEMENT"
                : certificate.title.toUpperCase().replace(/^CERTIFICATE\s+/, "") || "OF PARTICIPATION"}
            </span>
          </div>
        </div>

        {/* PROUDLY PRESENTED TO */}
        <p className="font-serif font-bold text-xs text-slate-500 tracking-[0.3em] uppercase mb-2">
          PROUDLY PRESENTED TO
        </p>

        {/* Recipient Name in Elegant Calligraphy Script (Great Vibes) */}
        <div className="w-full max-w-xl mx-auto mb-3">
          <h2
            className="text-[44px] text-slate-900 leading-tight px-4 drop-shadow-xs mb-2"
            style={{
              fontFamily: "'Great Vibes', cursive, 'Brush Script MT', sans-serif",
              fontWeight: 400,
            }}
          >
            {certificate.recipientName || "Participant Name"}
          </h2>

          {/* Royal Diploma Ornamental Divider */}
          <div className="flex items-center justify-center gap-2 w-80 mx-auto">
            <div
              className="h-[1.5px] flex-1 rounded-full opacity-60"
              style={{
                background: `linear-gradient(to right, transparent, ${palette.secondary})`,
              }}
            />
            <div
              className="w-1 h-1 rounded-full opacity-50 shrink-0"
              style={{ backgroundColor: palette.secondary }}
            />
            <div
              className="w-2 h-2 rotate-45 rounded-[0.5px] opacity-75 shrink-0"
              style={{ backgroundColor: palette.secondary }}
            />
            <div
              className="w-3 h-3 rotate-45 rounded-[1px] shadow-xs shrink-0 flex items-center justify-center"
              style={{
                backgroundColor: palette.secondary,
                boxShadow: `0 0 6px ${palette.borderGlow || "rgba(212,175,55,0.3)"}`,
              }}
            >
              <div className="w-1 h-1 rounded-[0.5px] bg-white/90" />
            </div>
            <div
              className="w-2 h-2 rotate-45 rounded-[0.5px] opacity-75 shrink-0"
              style={{ backgroundColor: palette.secondary }}
            />
            <div
              className="w-1 h-1 rounded-full opacity-50 shrink-0"
              style={{ backgroundColor: palette.secondary }}
            />
            <div
              className="h-[1.5px] flex-1 rounded-full opacity-60"
              style={{
                background: `linear-gradient(to left, transparent, ${palette.secondary})`,
              }}
            />
          </div>
        </div>

        {/* Citation Body Text */}
        <p className="max-w-2xl text-sm text-slate-700 leading-relaxed font-sans px-6 font-normal">
          {certificate.citation ||
            `In recognition of your enthusiastic participation in the ${certificate.eventName}, showcasing dedication and a commendable commitment to excellence.`}
        </p>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 3. FOOTER (4 INSTITUTIONAL SIGNATURES ON PURE WHITE BASELINE)  */}
      {/* ------------------------------------------------------------- */}
      <footer
        data-certificate-footer
        className="relative z-10 pt-2 w-full"
      >
        <div className="grid grid-cols-4 gap-6 items-end text-center w-full max-w-4xl mx-auto px-4">
          {activeSignatories.map((sig, idx) => {
            const signatureUrl = sig.signatureImageUrl;

            return (
              <div key={sig.id || idx} className="flex flex-col items-center">
                {/* Signature Image (Transparent PNG) or Cursive Text */}
                <div className="h-[64px] flex items-end justify-center w-full px-1 -mb-3.5 relative z-10 pointer-events-none">
                  {signatureUrl ? (
                    <img
                      src={
                        signatureUrl.startsWith("http://") ||
                        signatureUrl.startsWith("https://")
                          ? `/api/proxy-image?url=${encodeURIComponent(signatureUrl)}`
                          : signatureUrl
                      }
                      alt={sig.name}
                      crossOrigin="anonymous"
                      className="h-[64px] w-auto max-w-[180px] object-contain"
                    />
                  ) : (
                    <span
                      className="text-xl text-slate-800 tracking-wider truncate max-w-full font-medium"
                      style={{
                        fontFamily: "'Great Vibes', cursive, 'Brush Script MT', sans-serif",
                      }}
                    >
                      {sig.name}
                    </span>
                  )}
                </div>

                {/* Line */}
                <div className="w-full h-[1.5px] bg-slate-800/80 mb-1 relative z-0" />

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
            );
          })}
        </div>
      </footer>
    </div>
  );
}
