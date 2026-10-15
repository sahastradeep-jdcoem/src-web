"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  ShieldCheck, 
  Lock, 
  ChevronRight, 
  Check, 
  Clock, 
  Info, 
  RefreshCw,
  Download,
  Camera
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";
import { EventItem } from "@/types";

export interface PaytmCheckoutData {
  orderId: string;
  amount: number;
  baseAmount?: number;
  microPaisaOffset?: number;
  formattedAmount: string;
  upiLink: string;
  gpayLink?: string;
  phonepeLink?: string;
  paytmLink?: string;
  bhimLink?: string;
  payeeName: string;
  upiId: string;
  expiresAt?: string;
}

interface PaytmCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  paytmCheckoutData: PaytmCheckoutData;
  event: EventItem;
  formData: {
    name?: string;
    phone?: string;
    email?: string;
    [key: string]: any;
  };
  isVerifyingPaytm: boolean;
  paytmUtr: string;
  setPaytmUtr: (utr: string) => void;
  handleVerifyPaytmPayment: () => void;
  showManualUtr: boolean;
  setShowManualUtr: (show: boolean) => void;
  onRegenerateQR?: () => void | Promise<void>;
  isRegeneratingQR?: boolean;
}

export function PaytmCheckoutModal({
  isOpen,
  onClose,
  paytmCheckoutData,
  event,
  formData,
  isVerifyingPaytm,
  paytmUtr,
  setPaytmUtr,
  handleVerifyPaytmPayment,
  showManualUtr,
  setShowManualUtr,
  onRegenerateQR,
  isRegeneratingQR = false,
}: PaytmCheckoutModalProps) {
  // Fallback student phone
  const studentPhone = formData.phone || "9876543210";

  // Calculate remaining seconds from expiresAt (default 300s = 5 mins)
  const calculateSecondsRemaining = () => {
    if (!paytmCheckoutData?.expiresAt) return 300;
    const expiry = new Date(paytmCheckoutData.expiresAt).getTime();
    return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
  };

  const [secondsRemaining, setSecondsRemaining] = useState<number>(calculateSecondsRemaining);

  useEffect(() => {
    setSecondsRemaining(calculateSecondsRemaining());
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [paytmCheckoutData?.orderId, paytmCheckoutData?.expiresAt]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isExpired = secondsRemaining <= 0;

  const [isQrSaved, setIsQrSaved] = useState(false);

  const handleDownloadQr = () => {
    try {
      const canvas = document.querySelector("#paytm-checkout-mobile-qr canvas") as HTMLCanvasElement;
      if (canvas) {
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `SRC-Paytm-QR-₹${paytmCheckoutData.formattedAmount}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setIsQrSaved(true);
        setTimeout(() => setIsQrSaved(false), 4000);
      }
    } catch (e) {
      console.warn("Could not download QR canvas:", e);
    }
  };

  const handleShareOrDownloadQr = async () => {
    try {
      const canvas = document.querySelector("#paytm-checkout-mobile-qr canvas") as HTMLCanvasElement;
      if (!canvas) {
        handleDownloadQr();
        return;
      }

      canvas.toBlob(async (blob) => {
        if (!blob) {
          handleDownloadQr();
          return;
        }
        const file = new File([blob], `SRC-Payment-QR-₹${paytmCheckoutData.formattedAmount}.png`, { type: "image/png" });

        if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Payment QR ₹${paytmCheckoutData.formattedAmount}`,
              text: `SRC JDCOEM Payment QR for ₹${paytmCheckoutData.formattedAmount}`,
            });
            setIsQrSaved(true);
            setTimeout(() => setIsQrSaved(false), 4000);
            return;
          } catch {
            // User cancelled or share dismissed, fall back to direct download
          }
        }
        handleDownloadQr();
      }, "image/png");
    } catch {
      handleDownloadQr();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      contentClassName="p-0 overflow-y-auto sm:overflow-hidden overscroll-contain"
      maxWidth="3xl"
    >
      {/* 
        ========================================================================
        MOBILE VIEWPORT (sm:hidden)
        QR-First Design with 1-Tap Save to Photos, Bank Scanner Guide, & Live Radar
        ========================================================================
      */}
      <div className="sm:hidden flex flex-col w-full max-w-[420px] mx-auto bg-slate-50 font-sans text-left relative overflow-hidden">
        {/* Mobile Header: Sleek Compact Royal Blue Bar */}
        <div className="sticky top-0 z-40 bg-gradient-to-r from-[#1A56DB] via-[#2065D6] to-[#2563EB] text-white px-4 py-2.5 shadow-sm select-none">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Monogram Crest */}
              <div className="w-8 h-8 rounded-lg bg-white/20 border border-white/25 flex items-center justify-center font-black text-xs text-white shrink-0 shadow-inner">
                S
              </div>

              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5 truncate">
                  <span className="font-heading font-black text-lg text-white tracking-tight">
                    ₹{paytmCheckoutData.formattedAmount}
                  </span>
                  <span className="text-xs text-blue-100/80 font-medium truncate">
                    • {event.name}
                  </span>
                </div>
                <div className="text-[10px] text-blue-100/70 font-semibold uppercase tracking-wider truncate">
                  SRC JDCOEM Payment
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                if (!isVerifyingPaytm && !isRegeneratingQR) onClose();
              }}
              aria-label="Close checkout"
              disabled={isVerifyingPaytm || isRegeneratingQR}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Body Content */}
        <div className="px-3.5 py-3 space-y-2.5 flex-1">
          {!isExpired ? (
            /* Centered Large Scannable QR Code Card */
            <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs text-center flex flex-col items-center justify-center space-y-2">
              {/* 5-minute live countdown pill */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border transition-colors ${
                secondsRemaining < 60
                  ? "bg-rose-50 border-rose-200 text-rose-700 animate-pulse"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}>
                <Clock className={`w-3.5 h-3.5 ${secondsRemaining < 60 ? "text-rose-600" : "text-amber-600"}`} />
                <span>QR Code expires in <strong>{formatTimer(secondsRemaining)}</strong></span>
              </div>

              {/* Dynamic QR Canvas */}
              <div id="paytm-checkout-mobile-qr" className="p-2 bg-white rounded-2xl border border-slate-100 shadow-inner inline-block">
                <ScannableQRCode value={paytmCheckoutData.upiLink} size={180} />
              </div>

              {/* Save QR to Photos Button */}
              <div className="w-full pt-0.5">
                <Button
                  onClick={handleShareOrDownloadQr}
                  variant="outline"
                  size="sm"
                  className="w-full justify-center gap-2 cursor-pointer font-bold text-xs py-2 bg-blue-50/70 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800 rounded-xl transition-all shadow-2xs min-h-[38px]"
                >
                  {isQrSaved ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>QR Saved! Open UPI App to Scan</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-blue-600" />
                      <span>Save QR to Photos / Gallery</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* Expired Desktop Card */
            <div className="p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center flex flex-col items-center justify-center space-y-3.5 animate-in fade-in duration-150">
              <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-heading font-black text-base text-slate-800">
                  Payment QR Code Expired
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                  For your payment safety, QR codes expire after 5 minutes. This QR code will no longer accept payments.
                </p>
              </div>
              {onRegenerateQR && (
                <Button
                  onClick={onRegenerateQR}
                  isLoading={isRegeneratingQR}
                  variant="primary"
                  size="md"
                  className="w-full cursor-pointer bg-[#2B64E2] hover:bg-[#1E52C6] px-5 py-2.5 font-bold shadow-sm inline-flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Generate New QR Code</span>
                </Button>
              )}
            </div>
          )}

          {/* Live Auto-Approval Radar Screen */}
          <div className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-left space-y-1 relative overflow-hidden shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-300 animate-pulse" />
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
              <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                Auto-Generation Active
              </span>
            </div>
            <p className="text-[11px] text-emerald-900 leading-relaxed font-medium">
              After payment, wait for 30 seconds for pass generation. If the pass is not autogenerated, simply paste your 12-digit UTR and tap Verify UTR &amp; Issue Pass.
            </p>
          </div>

          {/* Mobile Manual UTR Entry Box */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-left space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>12-Digit UPI Reference (UTR)</span>
              </label>
              <span className="text-[10px] font-mono font-bold text-slate-400">
                {paytmUtr.length}/12 digits
              </span>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                maxLength={12}
                placeholder="e.g. 425512345678 (12 digits)"
                value={paytmUtr}
                onChange={(e) => {
                  const onlyNums = e.target.value.replace(/\D/g, "");
                  setPaytmUtr(onlyNums);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-mono text-slate-900 tracking-wider focus:outline-none focus:ring-2 focus:ring-[#2065D6]/30 bg-slate-50/50"
              />
              <Button
                onClick={handleVerifyPaytmPayment}
                isLoading={isVerifyingPaytm}
                disabled={paytmUtr.length !== 12 || isVerifyingPaytm}
                variant="primary"
                size="md"
                className="w-full justify-center gap-2 cursor-pointer min-h-[44px] bg-[#2065D6] hover:bg-[#1b55b8] font-bold text-xs shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Verify UTR &amp; Issue Pass</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        DESKTOP / PC VIEWPORT (hidden sm:flex)
        Optimized for laptops: Dedicated QR-first scanning flow with zero cut-off
        ========================================================================
      */}
      <div className="hidden sm:flex flex-row w-full bg-white font-sans text-left relative overflow-hidden select-none">
        
        {/* LEFT SIDEBAR: Vibrant Blue Panel (w-72) */}
        <div className="w-72 bg-gradient-to-b from-[#2B64E2] via-[#245BD6] to-[#1B4EC2] text-white p-5 flex flex-col justify-between relative shrink-0 shadow-lg">
          
          {/* Top Merchant Identity & Price */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center font-black text-lg text-white shadow-inner">
                S
              </div>
              <div className="min-w-0">
                <div className="font-heading font-black text-sm text-white uppercase tracking-wider truncate">
                  SRC JDCOEM
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-semibold mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span>Council Verified Portal</span>
                  <Info className="w-3 h-3 text-white/60" />
                </div>
              </div>
            </div>

            {/* Price Summary Card */}
            <div className="bg-white rounded-2xl p-3.5 text-slate-800 shadow-md space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Price Summary
              </span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="font-heading font-black text-2xl text-slate-900 tracking-tight">
                  ₹{paytmCheckoutData.formattedAmount}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  +0 Fee
                </span>
                {paytmCheckoutData.microPaisaOffset ? (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/70 border border-amber-200 px-1.5 py-0.5 rounded">
                    +{paytmCheckoutData.microPaisaOffset}p Instant-Verify
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate pt-0.5">
                {event.name} • Delegate Pass
              </p>
            </div>

            {/* User Profile Capsule */}
            <div className="bg-white/15 backdrop-blur-md rounded-xl px-3 py-2.5 border border-white/20 flex items-center justify-between text-xs font-medium text-white/90 shadow-xs">
              <div className="flex items-center gap-2 truncate">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0 text-[10px]">
                  👤
                </div>
                <span className="truncate">Using as +91 {studentPhone}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-white/70 shrink-0" />
            </div>
          </div>

          {/* Bottom Compact Graphic & Trust Signature */}
          <div className="space-y-2.5 pt-3">
            {/* Custom 3D Isometric Pedestal Illustration */}
            <div className="w-full flex items-end justify-center opacity-85 pointer-events-none">
              <svg width="180" height="65" viewBox="0 0 220 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M140 30L170 15L200 30L170 45L140 30Z" fill="#60A5FA" fillOpacity="0.4" />
                <path d="M140 30V50L170 65V45L140 30Z" fill="#3B82F6" fillOpacity="0.4" />
                <path d="M170 45V65L200 50V30L170 45Z" fill="#2563EB" fillOpacity="0.4" />
                
                <path d="M40 70L80 50L120 70L80 90L40 70Z" fill="#93C5FD" fillOpacity="0.6" />
                <path d="M40 70V105L80 125V90L40 70Z" fill="#60A5FA" fillOpacity="0.6" />
                <path d="M80 90V125L120 105V70L80 90Z" fill="#3B82F6" fillOpacity="0.6" />

                <ellipse cx="80" cy="52" rx="20" ry="10" fill="#BFDBFE" />
                <path d="M60 52V62C60 67.5 69 72 80 72C91 72 100 67.5 100 62V52" fill="#93C5FD" fillOpacity="0.8" />
                <ellipse cx="80" cy="46" rx="20" ry="10" fill="#E0F2FE" />
                <path d="M60 46V52C60 57.5 69 62 80 62C91 62 100 57.5 100 52V46" fill="#BAE6FD" />
                <ellipse cx="80" cy="40" rx="20" ry="10" fill="#FFFFFF" fillOpacity="0.9" />

                <g transform="translate(130, 40) rotate(-15) skewX(10)">
                  <rect width="45" height="28" rx="4" fill="white" fillOpacity="0.9" stroke="#93C5FD" strokeWidth="1" />
                  <rect x="5" y="6" width="9" height="7" rx="1.5" fill="#F59E0B" />
                  <rect x="5" y="19" width="22" height="2" rx="1" fill="#94A3B8" />
                  <rect x="31" y="18" width="8" height="4" rx="1" fill="#3B82F6" />
                </g>
              </svg>
            </div>

            {/* Bottom Security Footer */}
            <div className="flex items-center justify-between text-[11px] font-medium text-white/70 pt-1 border-t border-white/10">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-300" />
                <span>256-Bit SSL Encrypted</span>
              </div>
              <span className="font-mono text-[10px] text-white/50">
                {paytmCheckoutData.orderId.slice(-8)}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT MAIN PANEL: Dedicated QR Scan & Auto-Approval Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          
          {/* Top Bar: Title, Surcharge Pill & Close Button */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-black text-sm text-slate-800 tracking-wide">
                  Scan QR Code to Pay
                </h3>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                  Zero Fee
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Scan with Google Pay, PhonePe, Paytm, or any UPI app
              </p>
            </div>
            <button
              onClick={() => {
                if (!isVerifyingPaytm && !isRegeneratingQR) onClose();
              }}
              aria-label="Close checkout"
              disabled={isVerifyingPaytm || isRegeneratingQR}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* QR Workspace Content */}
          <div className="flex-1 p-5 overflow-y-auto space-y-3.5">
            {!isExpired ? (
              /* Centered Large Scannable QR Code Card */
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center flex flex-col items-center justify-center space-y-2.5">
                {/* 5-minute live countdown pill */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border transition-colors ${
                  secondsRemaining < 60
                    ? "bg-rose-50 border-rose-200 text-rose-700 animate-pulse"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}>
                  <Clock className={`w-3.5 h-3.5 ${secondsRemaining < 60 ? "text-rose-600" : "text-amber-600"}`} />
                  <span>QR Code expires in <strong>{formatTimer(secondsRemaining)}</strong></span>
                </div>

                <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-inner inline-block">
                  <ScannableQRCode value={paytmCheckoutData.upiLink} size={165} />
                </div>
              </div>
            ) : (
              /* Expired Desktop Card */
              <div className="p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center flex flex-col items-center justify-center space-y-3.5 animate-in fade-in duration-150">
                <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-heading font-black text-base text-slate-800">
                    Payment QR Code Expired
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                    For your payment safety and accurate verification, QR codes expire after 5 minutes. This QR code will no longer accept payments.
                  </p>
                </div>
                {onRegenerateQR && (
                  <Button
                    onClick={onRegenerateQR}
                    isLoading={isRegeneratingQR}
                    variant="primary"
                    size="md"
                    className="cursor-pointer bg-[#2B64E2] hover:bg-[#1E52C6] px-5 py-2.5 font-bold shadow-sm inline-flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Generate New QR Code</span>
                  </Button>
                )}
              </div>
            )}

            {/* Auto-Approval Live Radar Strip */}
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-left flex items-center gap-2 shadow-xs">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span className="text-xs text-emerald-950 font-bold uppercase tracking-wider">
                Auto-Generation Active
              </span>
            </div>

            <p className="text-[11px] text-slate-500 font-medium px-1 text-left leading-relaxed">
              After payment, wait for 30 seconds for pass generation. If the pass is not autogenerated, simply paste your 12-digit UTR and tap Verify UTR &amp; Issue Pass.
            </p>

            {/* Desktop Manual UTR Box */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-left space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  12-Digit UPI Reference (UTR)
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {paytmUtr.length}/12 digits
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={12}
                  placeholder="e.g. 425512345678 (12 digits)"
                  value={paytmUtr}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, "");
                    setPaytmUtr(onlyNums);
                  }}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 tracking-wider focus:outline-none focus:ring-2 focus:ring-[#2B64E2]/30 bg-slate-50/50"
                />
                <Button
                  onClick={handleVerifyPaytmPayment}
                  isLoading={isVerifyingPaytm}
                  disabled={paytmUtr.length !== 12 || isVerifyingPaytm}
                  variant="primary"
                  size="sm"
                  className="shrink-0 cursor-pointer bg-[#2B64E2] hover:bg-[#1E52C6] px-4 min-h-[40px] font-bold"
                >
                  <Check className="w-4 h-4" />
                  <span>Verify UTR &amp; Issue Pass</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
}

// Backward-compatible alias
export const SecureCheckoutModal = PaytmCheckoutModal;
