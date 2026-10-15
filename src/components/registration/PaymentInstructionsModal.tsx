"use client";

import React from "react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Camera, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  X
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
      maxWidth="md"
      contentClassName="p-0 overflow-hidden rounded-3xl"
    >
      <div className="flex flex-col w-full bg-white font-sans text-left">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#1A56DB] via-[#2065D6] to-[#2563EB] text-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center font-black text-sm text-white shrink-0 shadow-inner">
                S
              </div>
              <div>
                <h3 className="font-heading font-black text-base text-white uppercase tracking-wide">
                  Payment Instructions
                </h3>
                <div className="flex items-center gap-1 text-[11px] text-emerald-300 font-semibold mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span>SRC JDCOEM Official Gateway</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 transition-all cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Amount Overview Pill */}
          <div className="mt-3.5 pt-3 border-t border-white/15 flex items-baseline justify-between">
            <span className="text-xs text-blue-100 font-medium truncate max-w-[200px]">
              {eventName}
            </span>
            <div className="text-right">
              <span className="text-[10px] text-blue-200 block uppercase font-bold tracking-wider">
                Total Payable
              </span>
              <span className="font-heading font-black text-2xl text-white">
                ₹{formattedAmount}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Step-by-Step Instructions */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#1A56DB]" />
              Clear 4-Step Payment Guide:
            </span>

            <div className="space-y-2.5">
              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="text-xs text-slate-700 leading-relaxed font-medium">
                  <strong>Take a screenshot</strong> of the QR code (or tap <em>Save QR to Photos</em>).
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="text-xs text-slate-700 leading-relaxed font-medium">
                  Open <strong>Google Pay, PhonePe, Paytm, or CRED</strong> &rarr; tap the <strong>Scanner icon</strong> &rarr; select the screenshot from your photo gallery to pay <strong>₹{formattedAmount}</strong>.
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="text-xs text-amber-900 leading-relaxed font-medium">
                  Return to this screen and <strong>wait for 30 seconds</strong>. Your official ticket pass will be generated automatically!
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-purple-50/80 border border-purple-200/80">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-900 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <div className="text-xs text-purple-900 leading-relaxed font-medium">
                  If your pass is not auto-generated after 30 seconds, copy the <strong>12-digit UTR</strong> from your payment receipt and paste it below.
                </div>
              </div>
            </div>
          </div>

          {/* Strict Security Rule Warning */}
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/90 text-left space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Strict Rule: Do NOT Share This QR Code</span>
            </div>
            <p className="text-[11px] text-rose-900 font-medium leading-relaxed">
              This dynamic UPI QR code is uniquely linked to your specific registration. <strong>Do not share this QR code with anyone else</strong> or let others scan it, as it will cause payment mapping conflicts.
            </p>
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end gap-2.5">
          <Button
            onClick={onClose}
            variant="outline"
            size="md"
            className="cursor-pointer font-bold text-xs px-4 min-h-[44px]"
          >
            Cancel
          </Button>

          <Button
            onClick={onProceed}
            variant="primary"
            size="md"
            className="cursor-pointer bg-[#1A56DB] hover:bg-[#1546b8] font-bold text-xs px-6 min-h-[44px] inline-flex items-center gap-2 shadow-sm"
          >
            <span>OK, Proceed to Pay</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
