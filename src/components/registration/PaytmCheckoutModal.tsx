"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  ShieldCheck, 
  Lock, 
  ChevronRight, 
  QrCode, 
  Check, 
  Clock, 
  ArrowLeft, 
  Info, 
  Smartphone,
  RefreshCw,
  AlertTriangle,
  Download,
  Camera,
  Share2
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
  const [mobileSubView, setMobileSubView] = useState<"methods" | "qr">("methods");

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

  // Detect iOS (iPhone / iPad) to prevent invalid Android intent:// errors in Safari
  const isIOS = typeof navigator !== "undefined" && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );

  const cleanQuery = paytmCheckoutData.upiLink.includes("?")
    ? paytmCheckoutData.upiLink.split("?")[1]
    : "";

  // On iOS Safari, NEVER load intent:// package URLs which trigger "Safari cannot open page because address is invalid"
  const gpayHref = isIOS
    ? `tez://upi/pay?${cleanQuery}`
    : (paytmCheckoutData.gpayLink && !paytmCheckoutData.gpayLink.startsWith("intent://")
        ? paytmCheckoutData.gpayLink
        : (paytmCheckoutData.gpayLink || paytmCheckoutData.upiLink));

  const phonepeHref = isIOS
    ? `phonepe://pay?${cleanQuery}`
    : (paytmCheckoutData.phonepeLink && !paytmCheckoutData.phonepeLink.startsWith("intent://")
        ? paytmCheckoutData.phonepeLink
        : (paytmCheckoutData.phonepeLink || paytmCheckoutData.upiLink));

  const paytmHref = isIOS
    ? `paytmmp://pay?${cleanQuery}`
    : (paytmCheckoutData.paytmLink && !paytmCheckoutData.paytmLink.startsWith("intent://")
        ? paytmCheckoutData.paytmLink
        : (paytmCheckoutData.paytmLink || paytmCheckoutData.upiLink));

  const universalUpiHref = paytmCheckoutData.upiLink;

  const [isQrSaved, setIsQrSaved] = useState(false);
  const [showDirectAppLinks, setShowDirectAppLinks] = useState(false);

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
        {/* Mobile Header: Royal Blue Bar */}
        <div className="sticky top-0 z-40 bg-gradient-to-r from-[#1A56DB] via-[#2065D6] to-[#2563EB] text-white p-4 shadow-sm select-none">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Monogram Crest */}
              <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center font-black text-sm text-white shrink-0 shadow-inner">
                S
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-extrabold text-sm text-white uppercase tracking-wide truncate">
                    SRC JDCOEM
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-semibold mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Council Verified Portal</span>
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
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Amount Overview Banner */}
          <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-blue-100/80 uppercase tracking-wider font-semibold">
                  Total Amount
                </span>
                <span className="text-[10px] text-emerald-300 font-bold bg-emerald-400/15 border border-emerald-300/25 px-1.5 py-0.2 rounded">
                  Zero Fee
                </span>
                {paytmCheckoutData.microPaisaOffset ? (
                  <span className="text-[10px] text-amber-200 font-bold bg-amber-400/20 border border-amber-300/30 px-1.5 py-0.2 rounded">
                    +{paytmCheckoutData.microPaisaOffset}p Instant-Verify
                  </span>
                ) : null}
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-heading font-black text-2xl text-white tracking-tight">
                  ₹{paytmCheckoutData.formattedAmount}
                </span>
                <span className="text-[11px] text-blue-100/70 font-medium truncate max-w-[140px]">
                  • {event.name}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 border border-white/20 text-[10px] font-semibold text-blue-100 backdrop-blur-xs">
                <Lock className="w-2.5 h-2.5 text-emerald-300" />
                256-Bit SSL
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Body Content */}
        <div className="p-4 space-y-3 flex-1">
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

              {/* Dynamic QR Canvas */}
              <div id="paytm-checkout-mobile-qr" className="p-2.5 bg-white rounded-2xl border border-slate-100 shadow-inner inline-block">
                <ScannableQRCode value={paytmCheckoutData.upiLink} size={180} />
              </div>

              {/* Supported Apps Brand Strip */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-medium flex-wrap">
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-[10px]">
                  <span className="text-[#4285F4]">G</span>
                  <span className="text-[#EA4335]">P</span>
                  <span className="text-[#FBBC05]">a</span>
                  <span className="text-[#34A853]">y</span>
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-[#5f259f] font-bold text-[10px]">
                  PhonePe
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[#002970] font-bold text-[10px]">
                  Paytm
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 font-medium text-[10px]">
                  CRED / BHIM / Banks
                </span>
              </div>

              {/* Save QR to Photos Button */}
              <div className="w-full pt-1">
                <Button
                  onClick={handleShareOrDownloadQr}
                  variant="outline"
                  size="sm"
                  className="w-full justify-center gap-2 cursor-pointer font-bold text-xs py-2.5 bg-blue-50/70 border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800 rounded-xl transition-all shadow-2xs min-h-[40px]"
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

          {/* Quick Step Guide for Students */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 text-left shadow-xs space-y-2">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-[#1A56DB]" />
              How to scan &amp; pay:
            </span>
            <div className="text-xs text-slate-600 space-y-2 font-medium leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span><strong>Paying on this same phone:</strong> Tap <em>Save QR to Photos</em> above (or screenshot), open Google Pay, PhonePe, or Paytm &rarr; tap <strong>Scanner</strong> &rarr; tap the <strong>Gallery/Photo</strong> icon to select the QR image.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span><strong>Paying from another phone:</strong> Open camera or any UPI app on the other phone and point it at the QR code above.</span>
              </div>
            </div>
          </div>

          {/* Optional Collapsible Direct App Launch (with Bank Policy Disclaimer) */}
          <div className="text-center pt-0.5">
            {!showDirectAppLinks ? (
              <button
                type="button"
                onClick={() => setShowDirectAppLinks(true)}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-medium underline underline-offset-4 py-1 transition-colors cursor-pointer"
              >
                Prefer to try opening UPI app directly? Tap here &darr;
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-left space-y-2.5 animate-in fade-in duration-150 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Direct App Launch
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDirectAppLinks(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                  >
                    Hide
                  </button>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed font-medium">
                  ⚠️ Note: If your UPI app shows &quot;Cannot accept this payment as per risk policy&quot;, bank rules require scanning the QR code above instead.
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <a
                    href={gpayHref}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-center font-bold text-xs text-slate-800 no-underline active:scale-95 transition-all"
                  >
                    GPay
                  </a>
                  <a
                    href={phonepeHref}
                    className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-center font-bold text-xs text-[#5f259f] no-underline active:scale-95 transition-all"
                  >
                    PhonePe
                  </a>
                  <a
                    href={paytmHref}
                    className="p-2.5 rounded-xl border border-sky-200 bg-sky-50/60 hover:bg-sky-100 text-center font-bold text-xs text-[#002970] no-underline active:scale-95 transition-all"
                  >
                    Paytm
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Live Auto-Approval Radar Screen */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-left space-y-2 relative overflow-hidden shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-300 animate-pulse" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                </span>
                <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                  Auto-Approval Active
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-md">
                <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                Listening live
              </span>
            </div>
            <p className="text-[11px] text-emerald-900 leading-relaxed font-medium">
              Pass activates automatically the instant payment is confirmed in your UPI app.
            </p>
          </div>

          {/* Mobile Manual UTR Emergency Drawer */}
          <div className="pt-1 text-center">
            {!showManualUtr ? (
              <button
                type="button"
                onClick={() => setShowManualUtr(true)}
                className="text-[11px] text-slate-400 hover:text-slate-700 font-medium underline underline-offset-4 py-1.5 transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <span>Having trouble? Paid but pass didn&apos;t activate? Enter UTR manually &rarr;</span>
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-white border border-slate-200 text-left space-y-3 animate-in fade-in duration-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    12-Digit UPI Reference (UTR)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowManualUtr(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                  >
                    Hide
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="e.g. 425512345678 (12 digits)"
                  value={paytmUtr}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, "");
                    setPaytmUtr(onlyNums);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-mono text-slate-900 tracking-wider focus:outline-none focus:ring-2 focus:ring-[#2065D6]/30"
                />
                <Button
                  onClick={handleVerifyPaytmPayment}
                  isLoading={isVerifyingPaytm}
                  disabled={paytmUtr.length !== 12 || isVerifyingPaytm}
                  variant="primary"
                  size="md"
                  className="w-full justify-center gap-2 cursor-pointer min-h-[44px] bg-[#2065D6] hover:bg-[#1b55b8]"
                >
                  <Check className="w-4 h-4" />
                  <span>Verify UTR &amp; Issue Pass</span>
                </Button>
              </div>
            )}
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

                {/* Supported Apps Brand Strip */}
                <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-slate-500 font-medium flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-[10px]">
                    <span className="text-[#4285F4]">G</span>
                    <span className="text-[#EA4335]">P</span>
                    <span className="text-[#FBBC05]">a</span>
                    <span className="text-[#34A853]">y</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-[#5f259f] font-bold text-[10px]">
                    PhonePe
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[#002970] font-bold text-[10px]">
                    Paytm
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 font-medium text-[10px]">
                    CRED / BHIM / Bank UPI
                  </span>
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
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-left flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </span>
                <span className="text-xs text-emerald-950 font-medium truncate">
                  Pass will generate automatically once payment completes
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                Listening live
              </span>
            </div>

            {/* Desktop Manual UTR Fallback Drawer */}
            <div className="pt-0.5 text-center">
              {!showManualUtr ? (
                <button
                  type="button"
                  onClick={() => setShowManualUtr(true)}
                  className="text-[11px] text-slate-400 hover:text-slate-700 font-medium underline underline-offset-4 py-0.5 transition-colors cursor-pointer"
                >
                  Paid but pass didn&apos;t activate? Enter 12-digit UTR manually &rarr;
                </button>
              ) : (
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-left space-y-2.5 animate-in fade-in duration-150 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      12-Digit UPI Reference (UTR)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowManualUtr(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                    >
                      Hide
                    </button>
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
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 tracking-wider focus:outline-none focus:ring-2 focus:ring-[#2B64E2]/30"
                    />
                    <Button
                      onClick={handleVerifyPaytmPayment}
                      isLoading={isVerifyingPaytm}
                      disabled={paytmUtr.length !== 12 || isVerifyingPaytm}
                      variant="primary"
                      size="sm"
                      className="shrink-0 cursor-pointer bg-[#2B64E2] hover:bg-[#1E52C6] px-4 min-h-[40px]"
                    >
                      <Check className="w-4 h-4" />
                      <span>Verify UTR</span>
                    </Button>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Digits: {paytmUtr.length}/12 {paytmUtr.length === 12 && <span className="text-emerald-600 font-bold ml-1">✓ Ready</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
}

// Backward-compatible alias
export const SecureCheckoutModal = PaytmCheckoutModal;
