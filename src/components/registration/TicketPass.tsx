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
  Printer,
  Check,
  RefreshCw,
  Share2,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { downloadPassAsImage } from "@/lib/passExport";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";

interface TicketPassProps {
  registrationId: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  participantName: string;
  department: string;
  year: string;
  teamType: string;
  teamName?: string;
  teamMembers?: string[];
  ticketCode: string;
}

export function TicketPass({
  registrationId,
  eventName,
  eventDate,
  eventVenue,
  participantName,
  department,
  year,
  teamType,
  teamName,
  teamMembers,
  ticketCode,
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

  const handlePrint = () => {
    window.print();
  };

  const handleAddToCalendar = () => {
    const title = encodeURIComponent(`JDCOEM SRC: ${eventName}`);
    const details = encodeURIComponent(`Registration ID: ${registrationId}\nParticipant: ${participantName}\nVenue: ${eventVenue}`);
    const location = encodeURIComponent(eventVenue);
    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    window.open(googleCalUrl, "_blank");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Top Success Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 mb-2">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="font-extrabold text-3xl sm:text-5xl text-[#0F172A] tracking-tight font-heading">
          YOU&apos;RE IN.
        </h2>
        <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto font-medium">
          Your official registration for <strong className="text-[#E78023]">{eventName}</strong> has been confirmed.
        </p>
      </div>

      {/* Official Digital Ticket Pass Card (Exportable Target) */}
      <div
        id="src-delegate-pass-card"
        className="relative rounded-3xl bg-white border border-slate-200 shadow-xl overflow-hidden"
      >
        {/* Ticket Top Strip */}
        <div className="bg-[#17458F] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative h-12 w-12 rounded-xl bg-white p-1 shrink-0">
              <Image
                src="/assets/SRC Logo.png"
                alt="SRC Logo"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#E78023]">
                Official Delegate Pass
              </span>
              <h3 className="font-bold text-xl sm:text-2xl text-white font-heading">
                SAHASTRADEEP
              </h3>
              <p className="text-xs text-slate-200">Student Representative Council • JDCOEM</p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-200">
              Pass ID
            </span>
            <p className="font-mono font-bold text-base sm:text-lg text-[#E78023]">
              {registrationId}
            </p>
          </div>
        </div>

        {/* Ticket Perforation Notch */}
        <div className="relative py-2 flex items-center justify-between px-2 sm:px-4 bg-slate-50">
          <div className="w-5 h-5 -ml-5 sm:-ml-7 rounded-full bg-[#F8FAFC] border border-slate-200" />
          <div className="w-full border-t-2 border-dashed border-slate-300 mx-4" />
          <div className="w-5 h-5 -mr-5 sm:-mr-7 rounded-full bg-[#F8FAFC] border border-slate-200" />
        </div>

        {/* Ticket Body */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8 items-center bg-white">
          
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#E78023]">
                Event Selection
              </span>
              <h4 className="font-extrabold text-2xl text-[#0F172A] mt-1 font-heading">
                {eventName}
              </h4>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {eventDate} • {eventVenue}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 uppercase font-bold text-[10px]">
                  Participant
                </span>
                <p className="font-bold text-slate-900 text-sm">{participantName}</p>
                <p className="text-slate-600 text-[11px] font-medium">{department} ({year})</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase font-bold text-[10px]">
                  Category / Squad
                </span>
                <p className="font-bold text-slate-900 text-sm">
                  {teamType === "Team" ? teamName || "Team Entry" : "Individual Entry"}
                </p>
                <Badge variant="success" size="sm" className="mt-1">
                  CONFIRMED
                </Badge>
              </div>
            </div>

            {teamMembers && teamMembers.length > 0 && (
              <div className="pt-2 border-t border-slate-100 font-medium">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  Roster Members:
                </span>
                <p className="text-xs text-slate-700 mt-0.5">
                  {teamMembers.join(" • ")}
                </p>
              </div>
            )}
          </div>

          {/* Visual Scannable QR Code & Verification Block */}
          <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
            <div className="relative p-2 bg-white rounded-xl shadow-xs border border-slate-200 flex items-center justify-center overflow-hidden">
              <ScannableQRCode
                value={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/verify/${encodeURIComponent(registrationId)}`
                    : `https://src-jdcoem.vercel.app/verify/${encodeURIComponent(registrationId)}`
                }
                size={116}
                level="H"
                includeMargin={true}
                fgColor="#0F172A"
                bgColor="#FFFFFF"
                renderAs="canvas"
              />
            </div>

            <div className="space-y-1">
              <span className="font-mono text-[11px] font-bold text-[#E78023] block tracking-wider">
                {ticketCode}
              </span>
              <p className="text-[10px] text-slate-500 font-semibold flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Scan for Gate Check-In</span>
              </p>
            </div>
          </div>

        </div>

        {/* Ticket Bottom Endorsement Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium gap-2">
          <p>Entry permitted only with valid physical College ID card.</p>
          <p className="font-semibold text-slate-700">JDCOEM Nagpur • SRC Sahastradeep</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        
        {/* 1-Click Save Pass Image to Gallery */}
        <Button
          onClick={handleDownloadImage}
          disabled={isDownloading}
          variant="primary"
          size="md"
          className="gap-2 shadow-lg shadow-[#17458F]/20"
        >
          {isDownloading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : downloadSuccess ? (
            <Check className="w-4 h-4 text-emerald-300" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{downloadSuccess ? "Pass Saved!" : isDownloading ? "Generating High-Res Pass..." : "Save Pass to Phone (PNG)"}</span>
        </Button>

        <Button
          onClick={handlePrint}
          variant="secondary"
          size="md"
          className="gap-2"
        >
          <Printer className="w-4 h-4" />
          <span>Print / PDF</span>
        </Button>

        <Button
          onClick={handleAddToCalendar}
          variant="outline"
          size="md"
          className="gap-2"
        >
          <CalendarIcon className="w-4 h-4 text-[#E78023]" />
          <span>Add to Calendar</span>
        </Button>

        <Link href="/dashboard">
          <Button
            variant="outline"
            size="md"
            className="gap-2 text-[#17458F] border-[#17458F]/30"
          >
            <span>Student Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

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
