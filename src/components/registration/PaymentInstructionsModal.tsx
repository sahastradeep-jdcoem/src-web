"use client";

import React from "react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Camera, 
  ArrowRight,
  X,
  Smartphone,
  QrCode,
  Clock,
  Lock
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface PaymentInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  formattedAmount: string;
  eventName: string;
}

export function PaymentInstructionsModal({
  isOpen,
  onClose,
  onProceed,
  formattedAmount,
  eventName,
}: PaymentInstructionsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      maxWidth="3xl"
      dialogClassName="max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden"
      contentClassName="p-0 sm:p-0 flex flex-col flex-1 min-h-0 overflow-hidden"
    >
      {/* 
        ========================================================================
        MOBILE VIEWPORT (sm:hidden)
        Touch-first, compact 4-step guide with sticky action footer
        ========================================================================
      */}
      <div className="sm:hidden flex flex-col flex-1 min-h-0 w-full bg-white font-sans text-left overflow-hidden">
        {/* Mobile Header Bar */}
        <div className="bg-gradient-to-r from-[#1A56DB] via-[#2065D6] to-[#2563EB] text-white p-4 shadow-sm shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center font-black text-xs text-white shrink-0 shadow-inner">
                S
              </div>
              <div className="min-w-0">
                <h3 className="font-heading font-black text-sm text-white uppercase tracking-wide truncate">
                  Payment Guide
                </h3>
                <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-semibold mt-0.5">
                  <ShieldCheck className="w-3 h-3 text-emerald-300 shrink-0" />
                  <span>SRC JDCOEM Official Gateway</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 transition-all cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Amount Overview Pill */}
          <div className="mt-2.5 pt-2 border-t border-white/15 flex items-baseline justify-between">
            <span className="text-xs text-blue-100 font-medium truncate max-w-[180px]">
              {eventName}
            </span>
            <div className="text-right">
              <span className="text-[10px] text-blue-200 block uppercase font-bold tracking-wider">
                Total Payable
              </span>
              <span className="font-heading font-black text-xl text-white">
                ₹{formattedAmount}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Mobile Modal Body */}
        <div className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Step-by-Step Instructions */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-[#1A56DB]" />
              Clear 4-Step Payment Guide:
            </span>

            <div className="space-y-2">
              {/* Step 1 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="text-xs text-slate-700 leading-relaxed font-medium">
                  <strong>Take a screenshot</strong> of the QR code (or tap <em>Save QR to Photos</em>).
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="text-xs text-slate-700 leading-relaxed font-medium">
                  <strong>Open your UPI app</strong> &rarr; tap the <strong>Scanner icon</strong> &rarr; select the screenshot from your photo gallery to pay <strong>₹{formattedAmount}</strong>.
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-amber-50/80 border border-amber-200/80">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="text-xs text-amber-900 leading-relaxed font-medium">
                  Return to this screen and <strong>wait for 30 seconds</strong>. Your official ticket pass will be generated automatically!
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-purple-50/80 border border-purple-200/80">
                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-900 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <div className="text-xs text-purple-900 leading-relaxed font-medium">
                  If your pass is not auto-generated after 30 seconds, copy the <strong>12-digit UTR</strong> from your payment receipt and paste it below.
                </div>
              </div>
            </div>
          </div>

          {/* Strict Security Rule Warning */}
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200/90 text-left space-y-1 shadow-2xs">
            <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Strict Rule: Do NOT Share This QR Code</span>
            </div>
            <p className="text-[11px] text-rose-900 font-medium leading-relaxed">
              This dynamic UPI QR code is uniquely linked to your specific registration. <strong>Do not share this QR code with anyone else</strong> or let others scan it, as it will cause payment mapping conflicts.
            </p>
          </div>
        </div>

        {/* Action Button Bar - Fixed at bottom */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end gap-2.5 shrink-0 z-20">
          <Button
            onClick={onClose}
            variant="outline"
            size="md"
            className="cursor-pointer font-bold text-xs px-4 min-h-[42px]"
          >
            Cancel
          </Button>

          <Button
            onClick={onProceed}
            variant="primary"
            size="md"
            className="cursor-pointer bg-[#1A56DB] hover:bg-[#1546b8] font-bold text-xs px-5 min-h-[42px] inline-flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            <span>OK, Proceed to Pay</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </Button>
        </div>
      </div>

      {/* 
        ========================================================================
        DESKTOP VIEWPORT (hidden sm:flex)
        High-End 2-Column Split: Balanced proportions, zero empty space, direct scan
        ========================================================================
      */}
      <div className="hidden sm:flex flex-row flex-1 min-h-0 w-full bg-white font-sans text-left overflow-hidden">
        {/* Left Column: Royal Navy Summary Sidebar (w-72) */}
        <div className="w-72 bg-gradient-to-b from-[#1A56DB] via-[#2065D6] to-[#1E40AF] text-white p-5 flex flex-col shrink-0 shadow-md">
          {/* Top Brand & Event Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center font-black text-base text-white shadow-inner shrink-0">
                S
              </div>
              <div className="min-w-0">
                <div className="font-heading font-black text-sm text-white tracking-wide uppercase truncate">
                  SRC JDCOEM
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-semibold">
                  <ShieldCheck className="w-3 h-3 text-emerald-300 shrink-0" />
                  <span>Verified Gateway</span>
                </div>
              </div>
            </div>

            {/* Registration Summary Card */}
            <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1.5 shadow-xs">
              <div>
                <span className="text-[9px] text-blue-200/90 uppercase tracking-widest font-bold block mb-1">
                  Registration
                </span>
                <h4 className="font-heading font-bold text-xs text-white leading-snug line-clamp-1">
                  {eventName}
                </h4>
                <span className="text-[10px] text-blue-100/70 font-medium">
                  Official Delegate Pass
                </span>
              </div>
              <div className="pt-1.5 border-t border-white/15 flex items-baseline justify-between">
                <div>
                  <span className="text-[9px] text-blue-200 block uppercase font-bold tracking-wider">
                    Total Amount
                  </span>
                  <span className="font-heading font-black text-xl text-white">
                    ₹{formattedAmount}
                  </span>
                </div>
              </div>
            </div>

            {/* Security Alert Card - Sits naturally in flow */}
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-300/25 text-rose-100 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-white text-[10px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Do NOT Share This QR</span>
              </div>
              <p className="text-[10px] text-blue-100/80 leading-relaxed font-medium">
                Uniquely generated for your registration. Scan only from your personal UPI app.
              </p>
            </div>
          </div>

          {/* Bottom Security Trust Signature */}
          <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between text-[10px] text-blue-100/70">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-300" />
              <span>256-Bit SSL Encrypted</span>
            </div>
            <span className="font-mono text-[9px] text-white/50">JDCOEM-SRC</span>
          </div>
        </div>

        {/* Right Column: Direct Camera Scan Guide & Action Buttons */}
        <div className="flex-1 flex flex-col justify-between p-5 sm:p-6 bg-white min-w-0">
          {/* Top Bar with Title & Close Button */}
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="font-heading font-black text-base sm:text-lg text-slate-800 tracking-tight">
                Payment Guide
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Pay in seconds using any UPI app on your mobile phone — no screenshots needed!
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop 3-Step Scan Workflow Cards */}
          <div className="space-y-2.5 my-auto py-2">
            {/* Step 1 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200 hover:border-blue-200 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1A56DB] flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h5 className="font-heading font-bold text-xs text-slate-800">
                  1. Open any UPI app on your phone
                </h5>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed font-medium">
                  Launch <strong>Google Pay</strong>, <strong>PhonePe</strong>, <strong>Paytm</strong>, <strong>CRED</strong>, or <strong>BHIM</strong>.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200 hover:border-blue-200 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <QrCode className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h5 className="font-heading font-bold text-xs text-slate-800">
                  2. Point your phone camera at this screen
                </h5>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed font-medium">
                  Tap the <strong>Scanner icon</strong> in your app and simply scan the QR code on your computer screen.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 hover:border-emerald-300 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h5 className="font-heading font-bold text-xs text-emerald-950">
                  3. Pay ₹{formattedAmount} &amp; wait 30 seconds
                </h5>
                <p className="text-[11px] text-emerald-900 mt-0.5 leading-relaxed font-medium">
                  Approve payment on your phone. Keep this tab open — your official ticket pass will be generated automatically!
                </p>
              </div>
            </div>
          </div>

          {/* Action Button Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <Button
              onClick={onClose}
              variant="outline"
              size="md"
              className="cursor-pointer font-bold text-xs px-4 min-h-[38px]"
            >
              Cancel
            </Button>

            <Button
              onClick={onProceed}
              variant="primary"
              size="md"
              className="cursor-pointer bg-[#1A56DB] hover:bg-[#1546b8] font-bold text-xs px-5 min-h-[38px] inline-flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0"
            >
              <span>OK, Proceed to Pay</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
