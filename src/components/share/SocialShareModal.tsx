"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  X, 
  Share2, 
  Download, 
  Copy, 
  Check, 
  QrCode, 
  ChevronDown,
  ChevronUp,
  Instagram,
  Loader2,
  HelpCircle,
  Link as LinkIcon,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  AlertCircle
} from "lucide-react";
import { SocialSharePayload, StoryPalette } from "@/lib/share/types";
import { extractStoryPalette, DEFAULT_STORY_PALETTE } from "@/lib/share/colorExtractor";
import { renderStoryToCanvas, exportStoryBlob } from "@/lib/share/storyCanvasRenderer";
import { renderBrandedQRCode, getQrDownloadFilename } from "@/lib/share/qrCanvasRenderer";
import { toast } from "@/lib/toastStore";

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SocialSharePayload | null;
}

export function SocialShareModal({ isOpen, onClose, payload }: SocialShareModalProps) {
  // Mode: "choose" (Options: Copy Link, Instagram Story, QR Code) | "instagram" (Story Studio) | "qrcode" (Branded QR Studio)
  const [activeView, setActiveView] = useState<"choose" | "instagram" | "qrcode">("choose");

  const [isRendering, setIsRendering] = useState(true);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [storyBlob, setStoryBlob] = useState<Blob | null>(null);
  const [palette, setPalette] = useState<StoryPalette>(DEFAULT_STORY_PALETTE);
  const [includeQrCode, setIncludeQrCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Dedicated QR Code Studio State
  const [isQrRendering, setIsQrRendering] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBlob, setQrBlob] = useState<Blob | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isQrDownloading, setIsQrDownloading] = useState(false);

  // Reset to initial choose screen whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveView("choose");
      setCopiedLink(false);
      setShowInstructions(false);
      setIsQrDownloading(false);
    }
  }, [isOpen, payload]);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Extract palette and render Story whenever payload, QR toggle, or view changes to "instagram"
  useEffect(() => {
    if (!isOpen || !payload) {
      setPreviewDataUrl(null);
      setStoryBlob(null);
      return;
    }

    let isMounted = true;
    setIsRendering(true);

    async function generateStory() {
      try {
        if (!payload) return;
        const extractedPalette = await extractStoryPalette(payload.imageUrl);
        if (!isMounted) return;
        setPalette(extractedPalette);

        const canvas = await renderStoryToCanvas(payload, extractedPalette, {
          includeQrCode,
        });
        if (!isMounted) return;

        const blob = await exportStoryBlob(canvas);
        if (!isMounted) return;

        setStoryBlob(blob);
        const dataUrl = canvas.toDataURL("image/png", 1.0);
        setPreviewDataUrl(dataUrl);
      } catch (err) {
        console.error("[SocialShareModal] Failed to render story preview:", err);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    }

    generateStory();

    return () => {
      isMounted = false;
    };
  }, [isOpen, payload, includeQrCode]);

  // Generate Ultra-HD Branded QR Code whenever modal opens with payload
  useEffect(() => {
    if (!isOpen || !payload || !payload.url) {
      setQrDataUrl(null);
      setQrBlob(null);
      setQrError(null);
      return;
    }

    let isMounted = true;
    setIsQrRendering(true);
    setQrError(null);

    async function generateQR() {
      try {
        if (!payload?.url || payload.url.trim().length === 0) {
          throw new Error("Missing or invalid event URL");
        }
        const result = await renderBrandedQRCode(payload.url, {
          size: 1024,
          logoSrc: "/assets/SRC Logo.png",
          logoRatio: 0.20,
          margin: 4,
        });

        if (!isMounted) return;
        setQrDataUrl(result.dataUrl);
        setQrBlob(result.blob);
      } catch (err: any) {
        console.error("[SocialShareModal] Failed to generate QR code:", err);
        if (!isMounted) return;
        setQrError(err?.message || "Unable to generate QR code. Please try again.");
      } finally {
        if (isMounted) setIsQrRendering(false);
      }
    }

    generateQR();

    return () => {
      isMounted = false;
    };
  }, [isOpen, payload]);

  if (!isOpen || !payload) return null;

  // Canonical share URL with lightweight UTM parameters
  const shareUrlWithUtm = payload.url.includes("?")
    ? `${payload.url}&utm_source=instagram&utm_medium=story&utm_campaign=share`
    : `${payload.url}?utm_source=instagram&utm_medium=story&utm_campaign=share`;

  // Filename for downloading
  const sanitizedSlug = (payload.title || "story")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30);
  const downloadFileName = `srcjdcoem-${sanitizedSlug}-story.png`;

  // Copy Link Handler - Copies exact canonical event URL
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(payload.url);
      setCopiedLink(true);
      toast.show("Canonical event link copied to clipboard!", "success", { title: "Link Copied" });
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      toast.show("Could not copy link to clipboard", "error");
    }
  };

  // Robust Download QR Code Image Handler
  const handleDownloadQr = async () => {
    if (!qrBlob && !qrDataUrl) {
      toast.show("QR code is not ready yet", "error");
      return;
    }
    setIsQrDownloading(true);

    try {
      const filename = getQrDownloadFilename(payload.url, payload.title);

      // Support mobile Web Share API for saving directly to photo library
      if (qrBlob && typeof navigator !== "undefined" && navigator.canShare) {
        const file = new File([qrBlob], filename, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${payload.title} QR Code`,
            });
            toast.show("QR Code saved / shared successfully!", "success");
            setIsQrDownloading(false);
            return;
          } catch (shareErr: any) {
            if (shareErr?.name === "AbortError") {
              setIsQrDownloading(false);
              return;
            }
          }
        }
      }

      // Standard browser download
      const downloadUrl = qrBlob ? URL.createObjectURL(qrBlob) : qrDataUrl!;
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      downloadLink.rel = "noopener";
      document.body.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        document.body.removeChild(downloadLink);
        if (qrBlob) URL.revokeObjectURL(downloadUrl);
      }, 250);

      toast.show("QR Code downloaded in Ultra-HD (1024×1024)!", "success", {
        title: "Download Complete",
      });
    } catch (err) {
      console.error("[SocialShareModal] QR Download failed:", err);
      toast.show("Could not download QR code. Try long-pressing the preview.", "error");
    } finally {
      setIsQrDownloading(false);
    }
  };

  // Robust Download Story Image Handler (Works on both Desktop & iOS/Android browsers)
  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      let currentBlob = storyBlob;

      // If blob isn't ready yet, regenerate from canvas on the fly
      if (!currentBlob) {
        const canvas = await renderStoryToCanvas(payload, palette, { includeQrCode });
        currentBlob = await exportStoryBlob(canvas);
        setStoryBlob(currentBlob);
      }

      // Check if mobile Web Share API can share the file directly into photos
      if (typeof navigator !== "undefined" && navigator.canShare) {
        const file = new File([currentBlob], downloadFileName, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: payload.title,
            });
            toast.show("Image saved / shared successfully!", "success");
            setIsDownloading(false);
            return;
          } catch (shareErr: any) {
            if (shareErr?.name === "AbortError") {
              setIsDownloading(false);
              return;
            }
          }
        }
      }

      // Standard blob download fallback via object URL
      const objectUrl = URL.createObjectURL(currentBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = objectUrl;
      downloadLink.download = downloadFileName;
      downloadLink.rel = "noopener";
      document.body.appendChild(downloadLink);
      downloadLink.click();

      // Clean up after click
      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(objectUrl);
      }, 250);

      toast.show("Story image downloaded! Check your gallery or downloads.", "success", {
        title: "Image Saved",
      });
      setShowInstructions(true);
    } catch (err) {
      console.error("[SocialShareModal] Download failed:", err);
      toast.show("Could not save image. Try holding the preview to save.", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  // Native Web Share API Handler for Story View
  const handleNativeShare = async () => {
    // 1. Auto-copy link to clipboard for instant use in Instagram Link sticker
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrlWithUtm);
        setCopiedLink(true);
      }
    } catch {
      // Non-blocking clipboard error
    }

    setIsSharing(true);

    try {
      let currentBlob = storyBlob;
      if (!currentBlob) {
        const canvas = await renderStoryToCanvas(payload, palette, { includeQrCode });
        currentBlob = await exportStoryBlob(canvas);
        setStoryBlob(currentBlob);
      }

      const file = new File([currentBlob], downloadFileName, { type: "image/png" });

      const shareDataWithFile = {
        title: `${payload.title} | SRC JDCOEM`,
        text: payload.subtitle || `Check out ${payload.title} on Sahastradeep • SRC JDCOEM!`,
        url: shareUrlWithUtm,
        files: [file],
      };

      if (navigator.canShare && navigator.canShare(shareDataWithFile)) {
        await navigator.share(shareDataWithFile);
        toast.show("Link copied! Story image sent to share sheet.", "success");
        setIsSharing(false);
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setIsSharing(false);
        return;
      }
    }

    // Fallback: download image and notify
    setIsSharing(false);
    await handleDownload();
  };

  // Direct Instagram App Launcher (deeplink)
  const handleOpenInstagram = () => {
    window.location.href = "instagram://camera";
    setTimeout(() => {
      window.open("https://www.instagram.com", "_blank");
    }, 1200);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none opacity-50 dark:opacity-100" />
      <div
        className={`relative w-full ${
          activeView === "choose"
            ? "max-w-lg sm:max-w-2xl md:max-w-3xl"
            : activeView === "qrcode"
            ? "max-w-md sm:max-w-lg"
            : "max-w-lg sm:max-w-xl md:max-w-4xl"
        } max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl dark:shadow-slate-900/50 overflow-hidden flex flex-col text-slate-900 dark:text-slate-100 font-sans transition-all duration-300 animate-in fade-in zoom-in-95`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================================================================= */}
        {/* VIEW 1: CHOOSE SHARE OPTION (Light themed, crisp, minimal) */}
        {/* ================================================================= */}
        {activeView === "choose" ? (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#E78023] uppercase tracking-wider block">
                  {payload.typeLabel || "SRC SHARE"}
                </span>
                <h3 className="text-xl sm:text-2xl font-heading font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                  Share this {payload.type === "form" ? "Form" : "Event"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal leading-relaxed line-clamp-1">
                  {payload.title}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-2.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Three Primary Action Options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              {/* Option 1: Copy Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="relative group p-4 sm:p-5 rounded-3xl border-2 border-slate-200 dark:border-slate-700 hover:border-[#17458F] dark:hover:border-[#17458F] bg-slate-50/60 dark:bg-slate-800/60 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-all duration-300 text-left flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99] overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#17458F] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 rounded-l-3xl" />
                <div className="flex items-center justify-between w-full relative z-10">
                  <div className="w-[44px] h-[44px] rounded-xl bg-blue-100 dark:bg-blue-900/50 text-[#17458F] dark:text-blue-400 flex items-center justify-center group-hover:scale-105 group-hover:animate-pulse transition-transform shadow-sm">
                    {copiedLink ? <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <LinkIcon className="w-5 h-5" />}
                  </div>
                  <span className="text-xs font-bold text-[#17458F] dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    {copiedLink ? "Copied!" : "Copy"} <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div className="relative z-10">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#17458F] dark:group-hover:text-blue-400 transition-colors">
                    {copiedLink ? "Link Copied!" : "Copy Web Link"}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Share directly via WhatsApp, Telegram, or messages with preview tags.
                  </p>
                </div>
              </button>

              {/* Option 2: Share to Instagram Story */}
              <button
                type="button"
                onClick={() => setActiveView("instagram")}
                className="relative group p-4 sm:p-5 rounded-3xl border-2 border-transparent bg-gradient-to-br from-pink-50/80 via-orange-50/50 to-amber-50/80 dark:from-slate-800/90 dark:via-slate-800/80 dark:to-slate-800/90 transition-all duration-300 text-left flex flex-col justify-between space-y-4 shadow-sm hover:shadow-lg cursor-pointer hover:scale-[1.02] active:scale-[0.99] overflow-hidden"
              >
                <div className="absolute inset-0 rounded-3xl p-[2px] bg-gradient-to-br from-pink-500 via-orange-400 to-amber-500 opacity-30 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
                <div className="absolute inset-[2px] rounded-[22px] bg-white dark:bg-slate-900 -z-10" />
                <div className="flex items-center justify-between w-full relative z-10">
                  <div className="w-[44px] h-[44px] rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white flex items-center justify-center group-hover:scale-105 group-hover:animate-pulse transition-transform shadow-sm">
                    <Instagram className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-pink-600 dark:text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div className="relative z-10">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors flex items-center gap-1.5">
                    <span>Instagram Story</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Generate a branded 9:16 story card with 16:9 artwork & official badge.
                  </p>
                </div>
              </button>

              {/* Option 3: QR Code */}
              <button
                type="button"
                onClick={() => setActiveView("qrcode")}
                className="relative group p-4 sm:p-5 rounded-3xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50/60 dark:bg-slate-800/60 transition-all duration-300 text-left flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99] overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 rounded-l-3xl" />
                
                {/* Subtle scanning line animation on hover */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent -translate-y-full group-hover:animate-[scan_2s_ease-in-out_infinite] opacity-0 group-hover:opacity-100 pointer-events-none" />

                <div className="flex items-center justify-between w-full relative z-10">
                  <div className="w-[44px] h-[44px] rounded-xl bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center group-hover:scale-105 group-hover:animate-pulse transition-transform shadow-sm">
                    <QrCode className="w-5 h-5 text-[#E78023]" />
                  </div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    View <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div className="relative z-10">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                    <span>QR Code</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Generate a branded QR code for this event.
                  </p>
                </div>
              </button>
            </div>

            {/* Destination URL strip */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 transition-colors duration-300">
              <span className="truncate pr-2 font-mono text-[11px]">
                {payload.url.replace(/^https?:\/\//, "")}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="font-bold text-[#17458F] dark:text-blue-400 hover:underline shrink-0 text-xs cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center relative overflow-hidden"
              >
                <span className={`transition-all duration-300 absolute inset-0 flex items-center justify-center ${copiedLink ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}>Copy</span>
                <span className={`absolute inset-0 flex items-center justify-center transition-all duration-300 text-emerald-600 dark:text-emerald-400 ${copiedLink ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
                  <Check className="w-4 h-4 mr-1" /> Copied
                </span>
              </button>
            </div>
          </div>
        ) : activeView === "qrcode" ? (
          /* ================================================================= */
          /* VIEW 2: DEDICATED QR CODE STUDIO (Crisp, High-Contrast & Branded)  */
          /* ================================================================= */
          <div className="flex flex-col max-h-[92vh]">
            {/* Studio Header */}
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveView("choose")}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Back to share options"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-1.5">
                    <span>Event QR Code</span>
                    <QrCode className="w-4 h-4 text-[#17458F] dark:text-blue-400" />
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Studio Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 flex flex-col items-center justify-center text-center bg-slate-50/50 dark:bg-slate-900/50">
              {/* Event Name */}
              <div className="space-y-0.5 mb-4 sm:mb-5 max-w-sm px-2">
                <h4 className="text-base sm:text-lg font-heading font-extrabold text-[#0F172A] dark:text-white tracking-tight line-clamp-2">
                  {payload.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Event QR Code
                </p>
              </div>

              {/* Centered QR Card Container */}
              <div className={`relative p-4 sm:p-5 bg-white dark:bg-slate-800 rounded-3xl border-2 ${isQrRendering ? 'border-indigo-400 animate-pulse' : 'border-slate-200/90 dark:border-slate-700'} shadow-xl dark:shadow-slate-900/50 flex flex-col items-center justify-center transition-all group duration-300`}>
                {isQrRendering ? (
                  <div className="w-[220px] h-[220px] sm:w-[260px] sm:h-[260px] flex flex-col items-center justify-center gap-3 p-4">
                    <Loader2 className="w-8 h-8 text-[#17458F] dark:text-blue-400 animate-spin" />
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Generating branded QR code...
                    </span>
                  </div>
                ) : qrError ? (
                  <div className="w-[220px] h-[220px] sm:w-[260px] sm:h-[260px] flex flex-col items-center justify-center gap-2.5 p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                      {qrError}
                    </span>
                  </div>
                ) : qrDataUrl ? (
                  <div className="relative w-[220px] h-[220px] sm:w-[260px] sm:h-[260px] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt={`Official QR Code for ${payload.title}`}
                      width={260}
                      height={260}
                      className="w-full h-full object-contain rounded-xl select-none"
                    />
                  </div>
                ) : (
                  <div className="w-[220px] h-[220px] sm:w-[260px] sm:h-[260px] flex items-center justify-center text-xs text-slate-400">
                    No URL available
                  </div>
                )}
              </div>

              {/* Below QR: Scan Helper Prompt */}
              <div className="mt-4 space-y-1 max-w-xs px-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Scan to view this event
                </p>
                <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[260px] mx-auto">
                  {payload.url.replace(/^https?:\/\//, "")}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-xs">
                {/* Download Button */}
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  disabled={isQrRendering || !!qrError || !qrDataUrl || isQrDownloading}
                  className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-[#17458F] dark:bg-blue-600 hover:bg-[#123670] dark:hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-900/20 dark:shadow-blue-900/40 cursor-pointer active:scale-[0.98] disabled:opacity-50 min-h-[46px]"
                >
                  {isQrDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Download className="w-4 h-4 text-[#E78023] dark:text-amber-400" />
                  )}
                  <span>Download QR Code</span>
                </button>

                {/* Copy Canonical Link Button */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full sm:w-auto py-3 px-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] min-h-[46px]"
                  title="Copy Link"
                >
                  {copiedLink ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  )}
                  <span className="sm:hidden">{copiedLink ? "Copied" : "Copy Link"}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* VIEW 3: INSTAGRAM STORY STUDIO (Clean, light-themed container) */
          /* ================================================================= */
          <div className="flex flex-col max-h-[92vh]">
            {/* Studio Header */}
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveView("choose")}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Back to share options"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-1.5">
                    <span>Share to Instagram Story</span>
                    <Instagram className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                    1080 × 1920 Ultra HD card with SRC accreditation
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columns on Desktop, Stacked on Mobile */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-slate-50/50 dark:bg-slate-900/50">
              
              {/* Left Column: 9:16 Story Mockup Preview */}
              <div className="md:col-span-6 flex flex-col items-center justify-center">
                <div className="relative w-[260px] sm:w-[295px] aspect-[9/16] rounded-[2.5rem] overflow-hidden shadow-2xl flex items-center justify-center group p-[4px] bg-gradient-to-tr from-amber-500/80 via-pink-500/60 to-purple-600/80 shadow-purple-950/40 transition-all duration-300">
                  <div className="relative w-full h-full rounded-[2.25rem] overflow-hidden border border-slate-900 bg-black">
                    {/* Device Mockup Details */}
                    <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20 pointer-events-none">
                      <div className="w-24 h-4 rounded-b-xl opacity-90 bg-black" />
                    </div>
                    <div className="absolute top-1.5 right-4 flex gap-1 z-20 pointer-events-none opacity-50">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>

                    {isRendering ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                        <Loader2 className="w-8 h-8 text-[#E78023] animate-spin" />
                        <span className="text-xs font-semibold text-slate-300">
                          Generating Ultra-HD Story canvas...
                        </span>
                      </div>
                    ) : previewDataUrl ? (
                      <Image
                        src={previewDataUrl}
                        alt="Story preview"
                        fill
                        unoptimized={true}
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-slate-400 text-center p-4">
                        Unable to render preview
                      </div>
                    )}

                    {/* Resolution Overlay Badge */}
                    <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none z-10">
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full backdrop-blur-md border border-white/20 bg-black/70 text-white/95 flex items-center gap-1.5">
                        <span>1080 × 1920</span>
                        <span className="opacity-40">•</span>
                        <span>ULTRA HD</span>
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 mt-2 font-medium">
                  {isRendering ? "Rendering..." : "Tap Download Image to save full resolution"}
                </span>
              </div>

              {/* Right Column: Controls & Actions */}
              <div className="md:col-span-6 space-y-4 flex flex-col justify-center">
                
                {/* Story Configuration Card */}
                <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 space-y-3.5">
                  {/* Include QR Code Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20 text-[#E78023] dark:text-amber-500">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Include QR Code</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Embed scan link in story footer</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={includeQrCode}
                      onClick={() => setIncludeQrCode(!includeQrCode)}
                      className={`w-12 h-7 rounded-full transition-colors duration-300 relative cursor-pointer flex-shrink-0 ${
                        includeQrCode ? "bg-[#E78023] dark:bg-amber-600" : "bg-slate-300 dark:bg-slate-600"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 absolute top-1 ${
                          includeQrCode ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-3 pt-2">
                  {/* 1. Share Story Button (Native share sheet on iOS/Android) */}
                  <div className="relative group rounded-3xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/50 via-[#E78023]/50 to-amber-500/50 opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-300" />
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      disabled={isRendering || isSharing}
                      className="w-full relative z-10 py-3.5 px-4 rounded-3xl bg-[#E78023] hover:bg-[#d6731a] text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-md shadow-[#E78023]/25 dark:shadow-[#E78023]/10 cursor-pointer active:scale-[0.98] disabled:opacity-50 min-h-[46px]"
                    >
                      {isSharing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Share2 className="w-5 h-5" />
                      )}
                      <span>Share to Instagram Story</span>
                    </button>
                  </div>

                  {/* 2. Direct Actions: Download Image & Open Instagram */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={isRendering || isDownloading}
                      className="py-3 px-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] disabled:opacity-50 shadow-sm min-h-[46px]"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#E78023]" />
                      ) : (
                        <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>Download Image</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenInstagram}
                      className="py-3 px-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] shadow-sm min-h-[46px]"
                    >
                      <Instagram className="w-4 h-4" />
                      <span>Open Instagram</span>
                    </button>
                  </div>

                  {/* 3. Copy Link Action */}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="w-full py-3 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] min-h-[46px]"
                  >
                    {copiedLink ? (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    )}
                    <span>{copiedLink ? "Link Copied to Clipboard!" : "Copy Official Link"}</span>
                  </button>
                </div>

                {/* Collapsed Guide: How to post on Instagram */}
                <div className="p-3.5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm mt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-[#17458F] dark:hover:text-blue-400 transition-colors cursor-pointer min-h-[36px]"
                  >
                    <span className="flex items-center gap-2 text-[#E78023] dark:text-amber-500">
                      <HelpCircle className="w-4 h-4" />
                      <span>How to post this on Instagram:</span>
                    </span>
                    {showInstructions ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    )}
                  </button>

                  {showInstructions && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200 space-y-2">
                      {[
                        { text: "Tap Download Image to save the high-res graphic to your photos.", bold: "Download Image" },
                        { text: "Tap Copy Official Link (copied automatically on share).", bold: "Copy Official Link" },
                        { text: "Tap Open Instagram → Swipe to create a Story → Pick the saved image.", bold: "Open Instagram" },
                        { text: "Tap the Sticker icon (🔗 LINK) in Instagram → Paste the link so viewers can tap directly to your event!", bold: "Sticker icon (🔗 LINK)" }
                      ].map((step, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                            {step.text.split(step.bold).map((part, i, arr) => (
                              <React.Fragment key={i}>
                                {part}
                                {i < arr.length - 1 && <strong className="font-bold text-slate-900 dark:text-white">{step.bold}</strong>}
                              </React.Fragment>
                            ))}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
