import React from "react";
import Link from "next/link";
import { Download, ShieldCheck, BellRing, Sparkles, Smartphone, CheckCircle2, ChevronRight, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "SRC PayHook Setup Guide | Student Representative Council JDCOEM",
  description: "Official setup guide for SRC PayHook native Android payment listener app.",
};

export default function PayhookGuidePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-[#17458F] to-[#0F2D5E] text-white pt-24 pb-12 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E78023] text-white text-xs font-semibold mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            Official Internal Tool v1.2
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            SRC PayHook Setup Guide
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto mb-6">
            Instant 0% commission UPI payment listener app engineered for SRC JDCOEM festival registration desks.
          </p>

          <a
            href="/download/src-payhook-release.apk"
            download
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E78023] hover:bg-[#d0701c] text-white font-bold text-sm shadow-lg shadow-orange-950/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            Download APK (170 KB)
          </a>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-6">
        {/* Notice Card: Only for UPI Receiver Phone */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 shadow-sm mb-8 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-amber-900 leading-relaxed">
            <span className="font-bold">Who needs this app?</span> Only the Student Council organizer phone that receives the college festival UPI payments (Paytm for Business, Soundbox, or Bank SMS). Regular students do not need this app.
          </div>
        </div>

        {/* 3 Step Setup Guide */}
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-[#17458F] font-black flex items-center justify-center text-sm">
                1
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Download &amp; Install APK
              </h2>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Download <span className="font-semibold text-slate-900">src-payhook-release.apk</span> on the receiver Android phone.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs sm:text-sm text-slate-700 space-y-2">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                If Google Play Protect displays &quot;App blocked&quot;:
              </div>
              <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-600">
                <li>Open <b>Google Play Store</b> on your phone.</li>
                <li>Tap your <b>Profile Icon</b> (top right) → tap <b>Play Protect</b>.</li>
                <li>Tap the <b>Settings Gear (⚙️)</b> in the top right corner.</li>
                <li>Toggle <b>OFF</b> <i>&quot;Scan apps with Play Protect&quot;</i>.</li>
                <li>Open your Downloads folder and tap the APK to install.</li>
              </ol>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-[#E78023] font-black flex items-center justify-center text-sm">
                2
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Unlock Android 13+ Restricted Settings
              </h2>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              On Android 13, 14, and 15, Google protects sensitive notification listener permissions by default until you unlock it in App Info.
            </p>

            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 text-xs sm:text-sm text-amber-900 space-y-2">
              <div className="font-semibold text-amber-950">Follow this 10-second unlock:</div>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 text-amber-900/90">
                <li>Open <b>SRC PayHook</b> and tap the orange button: <b>&quot;1. Open App Info&quot;</b>.</li>
                <li>On the phone&apos;s App Info screen, tap the <b>three dots (⋮)</b> in the top-right corner.</li>
                <li>Tap <b>&quot;Allow restricted settings&quot;</b> and confirm your phone PIN or fingerprint.</li>
                <li>Return to <b>SRC PayHook</b> and tap <b>&quot;2. Grant Notification Access&quot;</b>.</li>
                <li>Toggle <b>ON</b> SRC PayHook in the list.</li>
              </ol>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-black flex items-center justify-center text-sm">
                3
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Disable Battery Optimization &amp; Run Test
              </h2>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Ensure Android never puts the listener service to sleep while the phone is locked.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Tap <b>&quot;Disable Battery Optimization&quot;</b> inside the app to whitelist it.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Tap <b>&quot;Run Connection Diagnostics&quot;</b>. You will see <i>Phase 1: HTTP 200 OK</i> and <i>Phase 2: Auth Verified</i>.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>Tap <b>&quot;Simulate Test Payment&quot;</b>. You will hear an audible confirmation chime and feel a double vibration buzz.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-10 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#17458F] hover:underline"
          >
            ← Return to SRC JDCOEM Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
