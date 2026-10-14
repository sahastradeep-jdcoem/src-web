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
      {/* Sophisticated floating glass card at top-right of screen   */}
      {/* ========================================================= */}
      <div 
        role="alert"
        aria-live="polite"
        className="hidden md:block fixed top-20 right-6 z-50 max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-auto"
      >
        <div className="relative rounded-3xl bg-slate-900/95 text-white backdrop-blur-xl border border-amber-500/40 p-4 shadow-2xl shadow-slate-950/50 ring-1 ring-amber-500/20 overflow-hidden">
          {/* Subtle warm amber ambient glow in the top-right corner */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-3">
            {/* Top Row: Icon + Title + Status Pill + Dismiss */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                  <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-heading font-extrabold text-xs tracking-tight text-white uppercase">
                      College BT ID Flagged
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold tracking-wide">
                      Action Required
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    Please correct your institutional ID format
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="h-7 w-7 rounded-full bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Remind me later"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Middle: Discrepancy details */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-slate-400 text-[11px]">Enrolled Department:</span>
                <span className="font-semibold text-white truncate max-w-[190px]" title={user?.department || "Department"}>
                  {deptShort}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-slate-400 text-[11px]">Current BT ID:</span>
                <span className="font-mono font-bold text-amber-300">
                  {user?.btId || "Not Registered"}
                </span>
              </div>
              <div className="pt-1 border-t border-white/5 flex items-baseline justify-between gap-2">
                <span className="text-slate-400 text-[11px]">Expected Format:</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {expectedFormat}
                </span>
              </div>
              <p className="text-[11px] text-amber-300/90 font-medium pt-1 leading-snug">
                ⚠️ {validation.reason}
              </p>
            </div>

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Passes &amp; access remain active</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3 py-1.5 rounded-xl bg-transparent hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Later
                </button>

                <button
                  type="button"
                  onClick={handleOpenFix}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#E78023] to-[#D26E17] hover:from-[#d26e17] hover:to-[#be6113] active:scale-[0.98] text-white text-xs font-bold shadow-md shadow-[#E78023]/25 transition-all flex items-center gap-1.5 cursor-pointer"
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
      {/* Touch-first bottom floating drawer with safe-area spacing   */}
      {/* ========================================================= */}
      <div 
        role="alert"
        aria-live="polite"
        className="block md:hidden fixed bottom-4 left-3 right-3 z-50 max-w-md mx-auto pointer-events-auto animate-in slide-in-from-bottom-6 fade-in duration-300"
      >
        <div className="relative rounded-3xl bg-slate-900/98 text-white backdrop-blur-2xl border-2 border-amber-500/60 p-4 shadow-2xl shadow-slate-950/80 ring-1 ring-amber-500/30 overflow-hidden">
          {/* Subtle gradient accent bar along the top edge */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-[#E78023] to-amber-500" />

          <div className="space-y-3 pt-1">
            {/* Header row with 44px touch target close */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-heading font-extrabold text-xs text-white uppercase tracking-tight truncate">
                    Fix Your College BT ID
                  </h4>
                  <p className="text-[10px] text-amber-300 font-bold truncate">
                    Format discrepancy detected
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="h-10 w-10 -mr-2 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-slate-400 hover:text-white active:bg-white/10 transition-colors cursor-pointer shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Issue Description */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1 text-xs">
              <p className="text-[11px] text-slate-300 leading-snug">
                Your ID <strong className="font-mono text-amber-300">{user?.btId || "Empty"}</strong> is flagged:{" "}
                <span className="text-amber-200 font-medium">{validation.reason}</span>
              </p>
              <p className="text-[11px] text-emerald-400 font-semibold pt-0.5">
                Expected format: <span className="font-mono underline">{expectedFormat}</span>
              </p>
            </div>

            {/* Reassurance text */}
            <p className="text-[10px] text-slate-400 flex items-center gap-1.5 font-medium px-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Event passes and logins are NOT blocked</span>
            </p>

            {/* Full-width Stacked Touch Buttons (Minimum 48px height) */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleOpenFix}
                className="w-full h-12 min-h-[48px] rounded-2xl bg-gradient-to-r from-[#E78023] to-[#D26E17] hover:from-[#d26e17] hover:to-[#be6113] active:scale-[0.98] text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#E78023]/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Fix BT ID in Profile</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="w-full h-9 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
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
