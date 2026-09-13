"use client";

import React, { useState } from "react";
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
  Smartphone
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
}

interface SecureCheckoutModalProps {
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
}

export function SecureCheckoutModal({
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
}: SecureCheckoutModalProps) {
  const [mobileSubView, setMobileSubView] = useState<"methods" | "qr">("methods");

  // Fallback student phone
  const studentPhone = formData.phone || "9876543210";

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
        Centered, floating card architecture with zero cutoff
        ========================================================================
      */}
      <div className="sm:hidden flex flex-col w-full max-w-[420px] mx-auto bg-slate-50 font-sans text-left relative overflow-hidden">
        {/* Mobile Header: Royal Blue Bar */}
        <div className="sticky top-0 z-40 bg-gradient-to-r from-[#1A56DB] via-[#2065D6] to-[#2563EB] text-white p-4 shadow-sm select-none">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {mobileSubView === "qr" ? (
                <button
                  type="button"
                  onClick={() => setMobileSubView("methods")}
                  className="p-1 -ml-1 text-white/90 hover:text-white rounded-lg active:scale-95 transition-all cursor-pointer"
                  aria-label="Back to methods"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : null}

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
                if (!isVerifyingPaytm) onClose();
              }}
              aria-label="Close checkout"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
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
        <div className="p-4 space-y-4 flex-1">
          {mobileSubView === "qr" ? (
            /* Subview: QR Code View on Mobile */
            <div className="p-5 rounded-2xl bg-white border border-slate-200 text-center shadow-sm space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Scan &amp; Pay</span>
                <span className="text-blue-600 font-semibold lowercase">any upi app</span>
              </div>

              <div className="p-3 bg-white rounded-2xl inline-block border-2 border-slate-100 shadow-inner">
                <ScannableQRCode value={paytmCheckoutData.upiLink} size={180} />
              </div>

              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Scan with <strong>Google Pay, PhonePe, Paytm</strong>, or any UPI app on your other phone
              </p>

              <button
                type="button"
                onClick={() => setMobileSubView("methods")}
                className="text-xs text-blue-600 font-bold hover:underline py-1"
              >
                &larr; Return to UPI Apps
              </button>
            </div>
          ) : (
            /* Main Mobile Method View: UPI & Options */
            <>
              {/* Method Section Heading */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Pay via UPI App
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  1-Tap Instant
                </span>
              </div>

              {/* UPI 1-Tap App Launcher Cards */}
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-xs overflow-hidden">
                {/* Google Pay */}
                <a
                  href={paytmCheckoutData.gpayLink || paytmCheckoutData.upiLink}
                  className="group flex items-center justify-between p-3.5 hover:bg-slate-50 transition-all no-underline active:bg-blue-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                      <span className="text-[#4285F4]">G</span>
                      <span className="text-[#EA4335]">P</span>
                      <span className="text-[#FBBC05]">a</span>
                      <span className="text-[#34A853]">y</span>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 group-hover:text-[#4285F4] transition-colors block">
                        Google Pay
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Fast 1-Tap UPI Transfer</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#4285F4] transition-colors" />
                </a>

                {/* PhonePe */}
                <a
                  href={paytmCheckoutData.phonepeLink || paytmCheckoutData.upiLink}
                  className="group flex items-center justify-between p-3.5 hover:bg-slate-50 transition-all no-underline active:bg-purple-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#5f259f]/10 border border-[#5f259f]/20 flex items-center justify-center font-black text-xs text-[#5f259f] shrink-0 shadow-2xs">
                      पे
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 group-hover:text-[#5f259f] transition-colors block">
                        PhonePe
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Instant UPI Settlement</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#5f259f] transition-colors" />
                </a>

                {/* Paytm */}
                <a
                  href={paytmCheckoutData.paytmLink || paytmCheckoutData.upiLink}
                  className="group flex items-center justify-between p-3.5 hover:bg-slate-50 transition-all no-underline active:bg-sky-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#00b9f5]/10 border border-[#00b9f5]/25 flex items-center justify-center font-black text-xs text-[#002970] shrink-0 shadow-2xs">
                      PTM
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 group-hover:text-[#002970] transition-colors block">
                        Paytm UPI
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Fast 1-Tap UPI Settlement</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#002970] transition-colors" />
                </a>

                {/* Other UPI Apps */}
                <a
                  href={paytmCheckoutData.upiLink}
                  className="group flex items-center justify-between p-3.5 hover:bg-slate-50 transition-all no-underline active:bg-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">Other UPI Apps</span>
                      <span className="text-[10px] text-slate-400 font-medium">CRED, BHIM, WhatsApp, Banks</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>
              </div>

              {/* Mobile QR Button Card */}
              <button
                type="button"
                onClick={() => setMobileSubView("qr")}
                className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 flex items-center justify-between text-left shadow-xs transition-all cursor-pointer group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors block">
                      Paying from another phone?
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Show Scannable QR Code</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                  Show QR
                </span>
              </button>
            </>
          )}

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
            {/* Custom 3D Isometric Pedestal Illustration (Compact height) */}
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

            {/* Security Seal */}
            <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-blue-100 font-medium">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-300 shrink-0" />
                <span>Secured by <strong>256-Bit SSL</strong></span>
              </div>
              <span className="text-[10px] text-white/50 font-mono">
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
                if (!isVerifyingPaytm) onClose();
              }}
              aria-label="Close checkout"
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* QR Workspace Content */}
          <div className="flex-1 p-5 overflow-y-auto space-y-3.5">
            {/* Centered Large Scannable QR Code Card */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-center flex flex-col items-center justify-center space-y-2.5">
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
