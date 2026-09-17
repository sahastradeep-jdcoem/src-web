"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  CheckCircle2, 
  Download, 
  Calendar as CalendarIcon, 
  QrCode, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Check,
  RefreshCw,
  Share2,
  ExternalLink,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { downloadPassAsImage } from "@/lib/passExport";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";
import { cn } from "@/lib/utils";

export interface TicketPassProps {
  registrationId: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  participantName: string;
  department?: string;
  year?: string;
  teamType?: "Individual" | "Team";
  teamName?: string;
  teamMembers?: string[];
  ticketCode: string;
  parentEventName?: string;
  subEventBadge?: string;
  status?: string;
  paymentStatus?: string;
  paymentId?: string;
  mode?: "registration" | "dashboard";
  onClose?: () => void;
}

export function TicketPass({
  registrationId,
  eventName,
  eventDate,
  eventVenue,
  participantName,
  department = "Engineering & Technology",
  year = "2nd Year",
  teamType = "Individual",
  teamName,
  teamMembers,
  ticketCode,
  parentEventName,
  subEventBadge,
  status = "CONFIRMED",
  paymentStatus,
  paymentId,
  mode = "registration",
  onClose,
}: TicketPassProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleDownloadImage = async () => {
    setIsDownloading(true);
    try {
      const res = await downloadPassAsImage(
        "src-delegate-pass-card",
        `${registrationId}-${eventName.replace(/\s+/g, "_")}_Pass.png`
      );
      if (res.success) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
        if (res.isMobile && res.imageUrl) {
          setPreviewImage(res.imageUrl);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddToCalendar = () => {
    const title = encodeURIComponent(`JDCOEM SRC: ${eventName}`);
    const details = encodeURIComponent(`Registration ID: ${registrationId}\nParticipant: ${participantName}\nVenue: ${eventVenue}`);
    const location = encodeURIComponent(eventVenue);
    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    window.open(googleCalUrl, "_blank");
  };

  return (
    <div className={cn("w-full max-w-3xl min-w-0 mx-auto", mode === "dashboard" ? "space-y-4 sm:space-y-0" : "space-y-6 sm:space-y-8")}>
      {/* Top Banner - only on registration completion page */}
      {mode !== "dashboard" && (
        paymentStatus === "PENDING" ? (
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-50 border border-amber-300 text-amber-600 mb-2 animate-pulse">
              <Clock className="w-10 h-10" />
            </div>
            <h2 className="font-extrabold text-3xl sm:text-5xl text-[#0F172A] tracking-tight font-heading">
              PAYMENT UNDER REVIEW
            </h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto font-medium font-sans">
              Your registration for <strong className="text-[#E78023]">{eventName}</strong> has been received. Treasurer is verifying UTR <strong className="font-mono text-slate-900">{paymentId}</strong>.
            </p>
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 mb-2">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="font-extrabold text-3xl sm:text-5xl text-[#0F172A] tracking-tight font-heading">
              YOU&apos;RE IN.
            </h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto font-medium font-sans">
              Your official registration for <strong className="text-[#E78023]">{eventName}</strong> has been confirmed.
            </p>
          </div>
        )
      )}

      {/* Mobile-Only Horizontal Swipe Indicator */}
      <div className="sm:hidden flex items-center justify-center pb-1">
        <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-500 bg-slate-100/90 border border-slate-200 rounded-full px-3.5 py-1.5 w-fit mx-auto shadow-xs select-none">
          <span className="text-[#E78023] animate-pulse">←</span>
          <span>Swipe pass horizontally to view QR code</span>
          <span className="text-[#E78023] animate-pulse">→</span>
        </div>
      </div>

      {/* Official Digital Ticket Pass Card (Exportable Target) */}
      <div className={cn("w-full max-w-full min-w-0 overflow-x-auto no-scrollbar touch-pan-x overscroll-x-contain", mode === "dashboard" ? "py-0.5" : "py-2")}>
        <div
          id="src-delegate-pass-card"
          className={cn(
            "relative shrink-0 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xl overflow-hidden text-left mx-auto font-sans",
            mode === "dashboard"
              ? "w-[580px] sm:min-w-0 sm:w-full max-w-[720px]"
              : "w-[620px] sm:min-w-[680px] md:w-full max-w-[720px]"
          )}
        >
          {/* Cancelled Pass Watermark Overlay */}
          {status === "CANCELLED" && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-20 flex items-center justify-center pointer-events-none p-6">
              <div className="rotate-[-10deg] border-4 border-rose-600 px-8 py-4 rounded-2xl bg-rose-50/95 shadow-2xl text-center space-y-1 max-w-sm">
                <span className="font-heading font-black text-2xl sm:text-3xl text-rose-600 tracking-widest block uppercase">
                  CANCELLED • VOID
                </span>
                <span className="text-[11px] font-bold text-rose-800 tracking-wider block uppercase font-mono">
                  Accreditation Inactivated
                </span>
              </div>
            </div>
          )}

          {/* Ticket Top Strip */}
          <div className={cn("bg-[#17458F] flex flex-row items-center justify-between gap-4", mode === "dashboard" ? "px-5 py-3 sm:px-6 sm:py-3.5" : "px-6 py-5 sm:px-8 sm:py-6")}>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={cn("rounded-xl bg-white p-1 shrink-0 flex items-center justify-center overflow-hidden", mode === "dashboard" ? "h-9 w-9 sm:h-10 sm:w-10" : "h-11 w-11 sm:h-12 sm:w-12")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/SRC Logo.png"
                  alt="SRC Logo"
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#E78023] block leading-normal">
                  Official Delegate Pass
                </span>
                <h3 className={cn("font-bold text-white font-sans leading-snug pb-0.5", mode === "dashboard" ? "text-base sm:text-xl" : "text-lg sm:text-2xl")}>
                  SAHASTRADEEP
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-200 leading-normal">Student Representative Council • JDCOEM</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-200 block leading-normal">
                Pass ID
              </span>
              <p className={cn("font-mono font-bold text-[#E78023] leading-normal", mode === "dashboard" ? "text-xs sm:text-base" : "text-sm sm:text-lg")}>
                {registrationId}
              </p>
            </div>
          </div>

          {/* Ticket Perforation Notch */}
          <div className={cn("relative flex items-center justify-between px-2 sm:px-4 bg-slate-50", mode === "dashboard" ? "py-1" : "py-2")}>
            <div className={cn("rounded-full bg-[#F8FAFC] border border-slate-200", mode === "dashboard" ? "w-4 h-4 -ml-4 sm:-ml-6" : "w-5 h-5 -ml-5 sm:-ml-7")} />
            <div className="w-full border-t-2 border-dashed border-slate-300 mx-3 sm:mx-4" />
            <div className={cn("rounded-full bg-[#F8FAFC] border border-slate-200", mode === "dashboard" ? "w-4 h-4 -mr-4 sm:-mr-6" : "w-5 h-5 -mr-5 sm:-mr-7")} />
          </div>

          {/* Ticket Body - Horizontal Layout */}
          <div className={cn("flex flex-row items-center justify-between bg-white", mode === "dashboard" ? "p-3.5 sm:p-5 sm:px-6 gap-4 sm:gap-6" : "p-6 sm:p-8 gap-6 sm:gap-8")}>
            
            {/* Main Info */}
            <div className={cn("flex-1 min-w-0", mode === "dashboard" ? "space-y-2.5" : "space-y-4")}>
              <div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#E78023] block leading-normal">
                    Event Selection
                  </span>
                  {parentEventName && (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      🎪 Part of {parentEventName}
                    </span>
                  )}
                  {subEventBadge && (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-white">
                      {subEventBadge}
                    </span>
                  )}
                </div>
                <h4 className={cn("font-extrabold text-[#0F172A] font-sans leading-snug", mode === "dashboard" ? "text-base sm:text-xl mt-0.5" : "text-xl sm:text-2xl mt-0.5 pb-1")}>
                  {eventName}
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium leading-normal">
                  {eventDate} • {eventVenue}
                </p>
              </div>

              <div className={cn("grid grid-cols-2 text-xs", mode === "dashboard" ? "gap-2.5 sm:gap-3" : "gap-4")}>
                <div className="min-w-0">
                  <span className="text-slate-500 uppercase font-bold text-[9px] sm:text-[10px] block leading-tight">
                    Participant
                  </span>
                  <p className={cn("font-bold text-slate-900 font-sans leading-snug", mode === "dashboard" ? "text-xs sm:text-sm" : "text-sm pb-0.5")}>{participantName}</p>
                  <p className="text-slate-600 text-[10px] sm:text-[11px] font-medium leading-normal">{department} ({year})</p>
                </div>

                <div className="min-w-0">
                  <span className="text-slate-500 uppercase font-bold text-[9px] sm:text-[10px] block leading-tight">
                    Category / Squad
                  </span>
                  <p className={cn("font-bold text-slate-900 font-sans leading-snug", mode === "dashboard" ? "text-xs sm:text-sm" : "text-sm pb-0.5")}>
                    {teamType === "Team" ? teamName || "Team Entry" : "Individual Entry"}
                  </p>
                  <Badge 
                    variant={status === "CHECKED_IN" ? "success" : status === "CANCELLED" ? "rose" : paymentStatus === "PENDING" ? "warning" : "orange"} 
                    size="sm" 
                    className="mt-0.5"
                  >
                    {paymentStatus === "PENDING" ? "PENDING REVIEW" : (status || "CONFIRMED")}
                  </Badge>
                </div>
              </div>

              {teamMembers && teamMembers.length > 0 && (
                <div className={cn("border-t border-slate-100 font-medium", mode === "dashboard" ? "pt-1.5" : "pt-2")}>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold tracking-wider block leading-normal">
                    Roster Members:
                  </span>
                  <p className="text-[11px] sm:text-xs text-slate-700 mt-0.5 leading-relaxed font-sans">
                    {teamMembers.join(" • ")}
                  </p>
                </div>
              )}
            </div>

            {/* Visual Scannable QR Code & Verification Block */}
            <div className={cn("shrink-0 flex flex-col items-center justify-center rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 text-center", mode === "dashboard" ? "w-32 sm:w-36 p-2 sm:p-2.5 space-y-1 sm:space-y-1.5" : "w-44 sm:w-48 p-4 sm:p-5 space-y-2.5")}>
              <div className="relative p-1.5 bg-white rounded-lg sm:rounded-xl shadow-xs border border-slate-200 flex items-center justify-center overflow-hidden">
                <ScannableQRCode
                  value={
                    typeof window !== "undefined"
                      ? `${window.location.origin}/verify/${encodeURIComponent(registrationId)}`
                      : `https://srcjdcoem.in/verify/${encodeURIComponent(registrationId)}`
                  }
                  size={mode === "dashboard" ? 92 : 116}
                  level="H"
                  includeMargin={true}
                  fgColor="#0F172A"
                  bgColor="#FFFFFF"
                  renderAs="canvas"
                />
              </div>

              <div className="space-y-0.5">
                <span className="font-mono text-[10px] sm:text-[11px] font-bold text-[#E78023] block tracking-wider leading-normal">
                  {ticketCode}
                </span>
                <p className="text-[9px] sm:text-[10px] text-slate-500 font-semibold flex items-center justify-center gap-1 leading-normal">
                  {paymentStatus === "PENDING" ? (
                    <>
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span className="text-amber-700 font-bold">Awaiting Verification</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Scan for Gate Check-In</span>
                    </>
                  )}
                </p>
              </div>
            </div>

          </div>

          {/* Ticket Bottom Endorsement Footer */}
          <div className={cn("bg-slate-50 border-t border-slate-200 flex flex-row items-center justify-between text-slate-500 font-medium gap-2 leading-normal", mode === "dashboard" ? "px-5 py-2 sm:px-6 sm:py-2 text-[10px] sm:text-[11px]" : "px-6 py-3.5 sm:px-8 sm:py-4 text-[11px] sm:text-xs")}>
            <p>Entry permitted only with valid physical College ID card.</p>
            <p className="font-semibold text-slate-700">JDCOEM Nagpur • SRC Sahastradeep</p>
          </div>
        </div>
      </div>

      {/* Action Buttons (Registration page only; Dashboard provides its own modal action toolbar) */}
      {mode !== "dashboard" && (
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4">
          {/* 1-Click Save Pass Image to Gallery (Desktop / Tablet) */}
          <Button
            onClick={handleDownloadImage}
            disabled={isDownloading}
            variant="primary"
            size="md"
            className="gap-2 shadow-lg shadow-[#17458F]/20 font-semibold"
          >
            {isDownloading ? (
              <span key="bottom-loading" className="inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#E78023]" />
                <span>Generating High-Res Pass...</span>
              </span>
            ) : downloadSuccess ? (
              <span key="bottom-success" className="inline-flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Pass Saved!</span>
              </span>
            ) : (
              <span key="bottom-idle" className="inline-flex items-center gap-2">
                <Download className="w-4 h-4" />
                <span>Save Pass to Phone (PNG)</span>
              </span>
            )}
          </Button>

          <Button
            onClick={handleAddToCalendar}
            variant="outline"
            size="md"
            className="gap-2 font-semibold"
          >
            <CalendarIcon className="w-4 h-4 text-[#E78023]" />
            <span>Add to Calendar</span>
          </Button>

          {/* Public Verification Link */}
          <Link
            href={`/verify/${encodeURIComponent(registrationId)}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold tracking-wide transition-all shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#17458F]" />
            <span>Public Verification Link</span>
          </Link>

          <Link href="/dashboard">
            <Button
              variant="outline"
              size="md"
              className="gap-2 text-[#17458F] border-[#17458F]/30 font-semibold"
            >
              <span>Student Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* Mobile Photo Save & Share Dialog */}
      {previewImage && (
        <Modal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          title="Official Delegate Pass Ready"
          subtitle="Save directly to your phone gallery or share via WhatsApp"
          maxWidth="lg"
        >
          <div className="space-y-5 text-center">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-50 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="Official Delegate Pass"
                className="w-full h-auto object-contain rounded-xl"
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-semibold">
              💡 <strong>Mobile Save Tip:</strong> Tap and hold the pass image above to select <strong>&quot;Save to Photos&quot;</strong>, or use the Share button below.
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={async () => {
                  try {
                    const res = await fetch(previewImage);
                    const blob = await res.blob();
                    const file = new File([blob], `${registrationId}_Pass.png`, { type: "image/png" });
                    if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({
                        files: [file],
                        title: "SRC Official Delegate Pass",
                        text: `My Official Delegate Pass for ${eventName} (${registrationId})`,
                      });
                    } else if (typeof navigator !== "undefined" && navigator.share) {
                      await navigator.share({
                        title: "SRC Official Delegate Pass",
                        url: window.location.href,
                      });
                    }
                  } catch (e) {
                    console.warn(e);
                  }
                }}
                className="w-full sm:w-auto gap-2 bg-[#E78023] hover:bg-[#D26E17] text-white shadow-md"
              >
                <Share2 className="w-4 h-4" />
                <span>Share / Save Image</span>
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  const w = window.open("");
                  w?.document.write(`<img src="${previewImage}" style="max-width:100%; height:auto;" />`);
                }}
                className="w-full sm:w-auto gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Full Image</span>
              </Button>

              <Button
                variant="secondary"
                size="md"
                onClick={() => setPreviewImage(null)}
                className="w-full sm:w-auto"
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
