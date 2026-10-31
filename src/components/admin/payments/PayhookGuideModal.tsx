"use client";

import React, { useEffect } from "react";
import { 
  X, 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Smartphone, 
  Sparkles,
  Zap,
  Sliders,
  ExternalLink
} from "lucide-react";

interface PayhookGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PayhookGuideModal({ isOpen, onClose }: PayhookGuideModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#17458F] to-[#0F2D5E] px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">SRC PayHook Setup &amp; Operator Guide</h2>
                <span className="text-[10px] font-bold bg-[#E78023] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Internal v1.4
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Official UPI payment listener app configuration for Treasurer &amp; Desk devices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-sm">
          {/* Important Restriction Notice */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">Staff &amp; Treasurer Device Only:</span> This app must strictly only be installed on the official Android device receiving festival UPI settlements (Paytm for Business, Soundbox, PhonePe, or Bank SMS). Regular students do not use this app.
            </div>
          </div>

          {/* Quick Action Bar: Download APK */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <div className="font-bold text-slate-900 text-sm">Download Native App</div>
              <div className="text-xs text-slate-500 font-mono">src-payhook-v1.4.apk (174 KB • Signed Production)</div>
            </div>
            <a
              href="/download/src-payhook-v1.4.apk"
              download="src-payhook-v1.4.apk"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E78023] hover:bg-[#d0701c] text-white font-bold text-xs shadow-md shadow-orange-950/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              Download APK v1.4
            </a>
          </div>

          {/* Step 1: Install & Play Protect */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-[#17458F] font-black text-xs flex items-center justify-center">1</div>
              <h3 className="font-bold text-slate-900">Install APK &amp; Play Protect Bypass</h3>
            </div>
            <p className="text-xs text-slate-600">
              Download <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-bold">src-payhook-v1.4.apk</code> directly onto the organizer phone.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                If Play Protect displays &quot;Blocked by Play Protect&quot;:
              </div>
              <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] text-slate-600">
                <li>Open <b>Google Play Store</b> &rarr; tap your Profile Icon (top right).</li>
                <li>Tap <b>Play Protect</b> &rarr; tap Settings (⚙️ gear icon).</li>
                <li>Temporarily toggle <b>OFF</b> <i>&quot;Scan apps with Play Protect&quot;</i> and install the APK.</li>
              </ol>
            </div>
          </div>

          {/* Step 2: Unlock Android 13+ Restricted Settings */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-orange-100 text-[#E78023] font-black text-xs flex items-center justify-center">2</div>
              <h3 className="font-bold text-slate-900">Unlock Android 13/14/15 Restricted Settings</h3>
            </div>
            <p className="text-xs text-slate-600">
              Modern Android versions protect notification listener permissions until manually unlocked in App Info:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1 text-xs text-slate-700 bg-amber-50/50 border border-amber-200/60 p-3.5 rounded-xl">
              <li>Open <b>SRC PayHook</b> and tap the orange button: <b>&quot;1. Open App Info&quot;</b>.</li>
              <li>On phone App Info, tap the <b>three dots (⋮)</b> in the top right corner.</li>
              <li>Select <b>&quot;Allow restricted settings&quot;</b> and confirm your fingerprint / PIN.</li>
              <li>Return to <b>SRC PayHook</b> and tap <b>&quot;2. Grant Notification Access&quot;</b> &rarr; Toggle <b>ON</b>.</li>
            </ol>
          </div>

          {/* Step 3: Battery Optimization & Test Ping */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center">3</div>
              <h3 className="font-bold text-slate-900">Disable Battery Saver &amp; Run Test</h3>
            </div>
            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Tap <b>&quot;Disable Battery Optimization&quot;</b> in the app so Android never sleeps the background listener.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Tap <b>&quot;Run Connection Diagnostics&quot;</b> to verify HTTP 200 connectivity to the website.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Tap <b>&quot;Simulate Test Payment&quot;</b> to verify the sound chime, vibration, and live signal log below.</span>
              </div>
            </div>
          </div>

          {/* Step 4: Monitored Apps (v1.3) */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center">4</div>
              <h3 className="font-bold text-slate-900">Configure Monitored Apps Filter</h3>
            </div>
            <p className="text-xs text-slate-600">
              In Card 3 (<b>MONITORED PAYMENT APPS</b>), toggle ON only the payment sources your festival desk uses (Paytm Business, PhonePe, GPay, Bank SMS).
            </p>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
              <b>🛡️ Anti-Promotional Shielding:</b> Marketing and shopping alerts (Meesho, Amazon sales) are automatically discarded.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Accessible exclusively inside Payments Studio
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}
