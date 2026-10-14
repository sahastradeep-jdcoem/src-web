"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, ArrowRight, X, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isExternalUser } from "@/lib/usersStore";
import { validateStudentBtId, getDepartmentShortName } from "@/lib/departmentsStore";

export function FlaggedBtIdNotification() {
  const { user, openProfileModal } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine if notification should be shown
  const shouldNotify = Boolean(
    mounted &&
    user &&
    !user.isDeleted &&
    user.status !== "deleted" &&
    !isExternalUser(user) &&
    user.userType !== "EXTERNAL_STUDENT" &&
    user.role !== "FACULTY" &&
    user.userType !== "FACULTY" &&
    !user.employeeId
  );

  const validation = shouldNotify 
    ? validateStudentBtId(user?.btId, user?.department) 
    : { isFlagged: false };

  // Check session dismissal on mount or user change
  useEffect(() => {
    if (user?.uid) {
      const dismissed = sessionStorage.getItem(`src_dismiss_flagged_bt_id_${user.uid}`);
      setIsDismissed(dismissed === "true");
    }
  }, [user?.uid]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (user?.uid) {
      sessionStorage.setItem(`src_dismiss_flagged_bt_id_${user.uid}`, "true");
    }
  };

  const handleOpenFix = () => {
    openProfileModal();
  };

  if (!shouldNotify || !validation.isFlagged || isDismissed) {
    return null;
  }

  const deptShort = getDepartmentShortName(user?.department || "") || "Your Branch";
  const expectedFormat = validation.expectedExample || "e.g. BT210036CS";

  return (
    <>
      {/* ========================================================= */}
      {/* 1. DESKTOP NOTIFICATION DESIGN (Large screens >= 768px)    */}
      {/* Solid high-contrast floating card at top-right of screen   */}
      {/* ========================================================= */}
      <div 
        role="alert"
        aria-live="polite"
        className="hidden md:block fixed top-20 right-6 z-50 max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-auto"
      >
        <div className="relative rounded-3xl bg-[#0B132B] text-white border-2 border-amber-500/70 p-4 shadow-2xl shadow-black/80 ring-1 ring-amber-400/30 overflow-hidden">
          {/* Warm amber accent bar at the top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-[#E78023] to-amber-500" />

          <div className="relative z-10 space-y-3 pt-1">
            {/* Top Row: Icon + Title + Status Pill + Dismiss */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                  <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-heading font-black text-sm tracking-tight text-white uppercase">
                      College BT ID Flagged
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium pt-0.5">
                    Please correct your institutional ID format
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="h-8 w-8 rounded-full bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Remind me later"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Middle: High-Contrast Discrepancy details */}
            <div className="p-3.5 rounded-2xl bg-[#0F172A] border border-slate-700/80 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300 text-xs font-medium">Department:</span>
                <span className="font-bold text-white truncate max-w-[200px]" title={user?.department || "Department"}>
                  {deptShort}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300 text-xs font-medium">Current BT ID:</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 font-mono font-bold text-amber-300">
                  {user?.btId || "Not Registered"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-700/60">
                <span className="text-slate-300 text-xs font-medium">Expected Format:</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 font-mono font-bold text-emerald-300">
                  {expectedFormat}
                </span>
              </div>
              <p className="text-xs text-amber-200 font-semibold pt-1 leading-snug flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{validation.reason}</span>
              </p>
            </div>

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Passes remain active</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Later
                </button>

                <button
                  type="button"
                  onClick={handleOpenFix}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#E78023] to-[#D26E17] hover:from-[#d26e17] hover:to-[#be6113] active:scale-[0.98] text-white text-xs font-extrabold uppercase tracking-wider shadow-md shadow-[#E78023]/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Fix BT ID Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. MOBILE NOTIFICATION DESIGN (Smartphone screens < 768px) */}
      {/* 100% Solid Dark Shield with WCAG AAA Contrast & Touch UX   */}
      {/* ========================================================= */}
      <div 
        role="alert"
        aria-live="polite"
        className="block md:hidden fixed bottom-6 left-3.5 right-3.5 z-50 max-w-md mx-auto pointer-events-auto animate-in slide-in-from-bottom-6 fade-in duration-300"
      >
        <div className="relative rounded-3xl bg-[#0B132B] text-white border-2 border-amber-500 p-4 shadow-2xl shadow-black/90 ring-1 ring-amber-400/50 overflow-hidden">
          {/* Top amber-to-orange highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-[#E78023] to-amber-500" />

          <div className="space-y-3.5 pt-1.5">
            {/* Header row with high-contrast icon, bold title & 44px close button */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/25 border-2 border-amber-400/60 text-amber-300 flex items-center justify-center shrink-0 shadow-md">
                  <AlertTriangle className="w-5 h-5 text-amber-300 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-heading font-black text-sm text-white uppercase tracking-tight truncate">
                    Fix Your College BT ID
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-[10px] text-amber-300 font-extrabold uppercase tracking-wider inline-block">
                    Format Discrepancy
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="h-10 w-10 min-w-[40px] min-h-[40px] rounded-full bg-slate-800 text-slate-300 hover:text-white active:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Solid, High-Contrast Issue Box */}
            <div className="p-3.5 rounded-2xl bg-[#0F172A] border border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300 text-xs font-semibold">Your Current ID:</span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/60 font-mono font-black text-amber-300 text-xs">
                  {user?.btId || "Not Registered"}
                </span>
              </div>

              <p className="text-xs text-amber-200 font-semibold leading-relaxed flex items-start gap-1.5 pt-0.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{validation.reason}</span>
              </p>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-700/80">
                <span className="text-slate-300 text-xs font-semibold">Expected Format:</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/60 font-mono font-black text-emerald-300 text-xs">
                  {expectedFormat}
                </span>
              </div>
            </div>

            {/* Reassurance Callout Card with Solid Background */}
            <div className="flex items-center gap-2 text-xs text-emerald-200 bg-emerald-950/50 border border-emerald-500/40 px-3 py-2 rounded-xl font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Event passes and logins are <strong>NOT</strong> blocked</span>
            </div>

            {/* High-Contrast Full-Width Stacked Action Buttons */}
            <div className="space-y-2 pt-0.5">
              <button
                type="button"
                onClick={handleOpenFix}
                className="w-full h-12 min-h-[48px] rounded-2xl bg-gradient-to-r from-[#E78023] via-[#ea8c38] to-[#d4721c] hover:from-[#d4721c] hover:to-[#c36515] active:scale-[0.98] text-white text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg shadow-black/50 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-300/40"
              >
                <span>Fix BT ID in Profile</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="w-full h-11 min-h-[44px] rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center cursor-pointer"
              >
                Remind Me Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default FlaggedBtIdNotification;
