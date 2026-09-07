"use client";

import React, { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  Loader2, 
  Ticket
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cancelRegistrationInFirestore } from "@/lib/firebase/firestore";
import { RegistrationRecord } from "@/types";
import { useAuth } from "@/context/AuthContext";

interface CancelRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration: RegistrationRecord | any | null;
  onCancelled?: (registrationId: string) => void;
}

const COMMON_REASONS = [
  "Academic schedule / exam clash",
  "Personal or health emergency",
  "Travel or commute constraint",
  "Registered by mistake / duplicate",
  "Schedule conflict with another college activity",
  "Team member unavailable to participate",
];

export function CancelRegistrationModal({
  isOpen,
  onClose,
  registration,
  onCancelled,
}: CancelRegistrationModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setError(null);
      setIsSubmitting(false);
      setIsSuccess(false);
    }
  }, [isOpen]);

  if (!registration) return null;

  const eventName = registration.eventName || registration.eventTitle || "Event";
  const passId = registration.registrationId || registration.id;
  const participantName = registration.participantName || registration.leaderName || "Delegate";
  const isPaid = (registration.amountPaid && registration.amountPaid > 0) || registration.paymentStatus === "PAID";

  const handleConfirmCancel = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please specify the reason for cancelling your registration.");
      return;
    }
    if (trimmed.length < 5) {
      setError("Please provide a more descriptive reason (at least 5 characters).");
      return;
    }

    if (isPaid) {
      setError("Paid registrations cannot be cancelled online. Please contact the event coordinator directly.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const userIdentifier = user?.email || user?.displayName || user?.btId || "Student";
      const result = await cancelRegistrationInFirestore(registration.id, trimmed, userIdentifier);

      if (!result.success) {
        setError(result.error || "Failed to cancel registration. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        onCancelled?.(registration.id);
        onClose();
      }, 1200);
    } catch (e: any) {
      console.error("Cancellation error:", e);
      setError(e?.message || "An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Cancel Event Registration"
      subtitle={`Pass ID: ${passId}`}
      maxWidth="md"
    >
      <div className="space-y-5 py-1">
        {/* Success Feedback View */}
        {isSuccess ? (
          <div className="p-6 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-extrabold text-xl text-slate-900">
                Registration Cancelled
              </h3>
              <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                Your pass for <strong>{eventName}</strong> has been cancelled and invalidated. The slot has been released back to other students.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Event Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Ticket className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Free Event Pass</span>
                </div>
                <h4 className="font-heading font-bold text-sm sm:text-base text-slate-900">
                  {eventName}
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  Delegate: <span className="font-semibold text-slate-800">{participantName}</span>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider shrink-0">
                Free Entry
              </span>
            </div>

            {/* Warning Alert */}
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5 leading-relaxed">
                <p className="font-bold text-rose-950">Pass Will Be Voided Immediately</p>
                <p className="text-rose-800">
                  Your digital accreditation QR pass will no longer be accepted for venue check-in. If this was a squad registration, your team entry will be revoked.
                </p>
              </div>
            </div>

            {/* Reason Specification Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>Reason for Cancellation</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {reason.trim().length} chars
                </span>
              </div>

              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSubmitting}
                rows={3}
                placeholder="Please state why you are cancelling your registration (e.g. academic exams, personal emergency, scheduling conflict)..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/20 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all resize-none font-sans"
              />

              {/* Quick Select Suggestion Chips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Quick Select Common Reasons:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_REASONS.map((chipReason) => (
                    <button
                      key={chipReason}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setReason(chipReason);
                        if (error) setError(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#17458F]/10 hover:text-[#17458F] text-[11px] font-medium text-slate-600 transition-colors cursor-pointer text-left border border-slate-200/80 active:scale-95"
                    >
                      {chipReason}
                    </button>
                  ))}
                </div>
              </div>

              {/* Validation Error Notice */}
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
                  <XCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="md"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto text-xs font-semibold"
              >
                Keep Registration
              </Button>

              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isSubmitting || !reason.trim()}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling Pass...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm Cancellation</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
