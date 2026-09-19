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
  ChevronLeft
} from "lucide-react";
import { SocialSharePayload, StoryPalette } from "@/lib/share/types";
import { extractStoryPalette, DEFAULT_STORY_PALETTE } from "@/lib/share/colorExtractor";
import { renderStoryToCanvas, exportStoryBlob } from "@/lib/share/storyCanvasRenderer";
import { toast } from "@/lib/toastStore";

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SocialSharePayload | null;
}

export function SocialShareModal({ isOpen, onClose, payload }: SocialShareModalProps) {
  // Mode: "choose" (Options: Copy Link or Share to Instagram Story) | "instagram" (Preview, controls, download, share)
  const [activeView, setActiveView] = useState<"choose" | "instagram">("choose");

  const [isRendering, setIsRendering] = useState(true);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [storyBlob, setStoryBlob] = useState<Blob | null>(null);
  const [palette, setPalette] = useState<StoryPalette>(DEFAULT_STORY_PALETTE);
  const [includeQrCode, setIncludeQrCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Reset to initial choose screen whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveView("choose");
      setCopiedLink(false);
      setShowInstructions(false);
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

  // Copy Link Handler
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrlWithUtm);
      setCopiedLink(true);
      toast.show("Link copied to clipboard!", "success", { title: "Link Copied" });
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      toast.show("Could not copy link to clipboard", "error");
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg sm:max-w-xl md:max-w-4xl max-h-[92vh] bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-900 font-sans"
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
                <h3 className="text-xl sm:text-2xl font-heading font-extrabold text-[#0F172A] tracking-tight">
                  Share this {payload.type === "form" ? "Form" : "Event"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed line-clamp-1">
                  {payload.title}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-2.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Two Primary Action Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {/* Option 1: Copy Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="group p-5 rounded-2xl border-2 border-slate-200 hover:border-[#17458F] bg-slate-50/60 hover:bg-blue-50/30 transition-all text-left flex flex-col justify-between space-y-4 shadow-2xs hover:shadow-md cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#17458F] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                    {copiedLink ? <Check className="w-5 h-5 text-emerald-600" /> : <LinkIcon className="w-5 h-5" />}
                  </div>
                  <span className="text-xs font-bold text-[#17458F] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    {copiedLink ? "Copied!" : "Copy"} <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#17458F] transition-colors">
                    {copiedLink ? "Link Copied to Clipboard!" : "Copy Web Link"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                    Share directly via WhatsApp, Telegram, or messages with preview tags.
                  </p>
                </div>
              </button>

              {/* Option 2: Share to Instagram Story */}
              <button
                type="button"
                onClick={() => setActiveView("instagram")}
                className="group p-5 rounded-2xl border-2 border-slate-200 hover:border-pink-500/80 bg-gradient-to-br from-pink-50/50 via-orange-50/30 to-amber-50/50 hover:from-pink-50 hover:to-orange-50 transition-all text-left flex flex-col justify-between space-y-4 shadow-2xs hover:shadow-md cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                    <Instagram className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-pink-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-pink-600 transition-colors flex items-center gap-1.5">
                    <span>Instagram Story</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                    Generate a branded 9:16 story card with 16:9 artwork & official badge.
                  </p>
                </div>
              </button>
            </div>

            {/* Destination URL strip */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="truncate pr-2 font-mono text-[11px]">
                {payload.url.replace(/^https?:\/\//, "")}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="font-bold text-[#17458F] hover:underline shrink-0 text-xs cursor-pointer"
              >
                {copiedLink ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* VIEW 2: INSTAGRAM STORY STUDIO (Clean, light-themed container) */
          /* ================================================================= */
          <div className="flex flex-col max-h-[92vh]">
            {/* Studio Header */}
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveView("choose")}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Back to share options"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                    <span>Share to Instagram Story</span>
                    <Instagram className="w-4 h-4 text-pink-600" />
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                    1080 × 1920 Ultra HD card with SRC accreditation
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columns on Desktop, Stacked on Mobile */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-slate-50/50">
              
              {/* Left Column: 9:16 Story Mockup Preview */}
              <div className="md:col-span-6 flex flex-col items-center justify-center">
                <div className="relative w-[260px] sm:w-[295px] aspect-[9/16] rounded-3xl overflow-hidden border-4 border-slate-800 shadow-xl bg-black flex items-center justify-center group">
                  {isRendering ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <Loader2 className="w-8 h-8 text-[#E78023] animate-spin" />
                      <span className="text-xs font-semibold text-slate-300">
                        Generating 9:16 Story canvas...
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
                    <div className="text-xs text-slate-400 text-center p-4">
                      Unable to render preview
                    </div>
                  )}

                  {/* Resolution Overlay Badge */}
                  <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none z-10">
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-black/60 text-white/90 backdrop-blur-md border border-white/20">
                      1080 × 1920 • ULTRA HD
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 mt-2 font-medium">
                  {isRendering ? "Rendering..." : "Tap Download Image to save full resolution"}
                </span>
              </div>

              {/* Right Column: Controls & Actions */}
              <div className="md:col-span-6 space-y-4 flex flex-col justify-center">
                
                {/* Story Configuration Card */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-50 text-[#E78023]">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Include QR Code</span>
                        <span className="text-[11px] text-slate-500 block">Embed scan link in story footer</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={includeQrCode}
                      onClick={() => setIncludeQrCode(!includeQrCode)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        includeQrCode ? "bg-[#E78023]" : "bg-slate-300"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform absolute top-1 ${
                          includeQrCode ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="space-y-2.5">
                  {/* 1. Share Story Button (Native share sheet on iOS/Android) */}
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    disabled={isRendering || isSharing}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#E78023] hover:bg-[#d6731a] text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-[#E78023]/25 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSharing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                    <span>Share to Instagram Story</span>
                  </button>

                  {/* 2. Direct Actions: Download Image & Open Instagram */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={isRendering || isDownloading}
                      className="py-3 px-3 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] disabled:opacity-50 shadow-2xs"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E78023]" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>Download Image</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenInstagram}
                      className="py-3 px-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] shadow-sm"
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      <span>Open Instagram</span>
                    </button>
                  </div>

                  {/* 3. Copy Link Action */}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="w-full py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{copiedLink ? "Link Copied to Clipboard!" : "Copy Official Link"}</span>
                  </button>
                </div>

                {/* Collapsed Guide: How to post on Instagram */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-800 hover:text-[#17458F] transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 text-[#E78023]">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>How to post this on Instagram:</span>
                    </span>
                    {showInstructions ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {showInstructions && (
                    <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside font-normal pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                      <li>
                        Tap <strong>Download Image</strong> to save the high-res graphic to your photos.
                      </li>
                      <li>
                        Tap <strong>Copy Official Link</strong> (copied automatically on share).
                      </li>
                      <li>
                        Tap <strong>Open Instagram</strong> → Swipe to create a Story → Pick the saved image.
                      </li>
                      <li>
                        Tap the <strong>Sticker icon (🔗 LINK)</strong> in Instagram → Paste the link so viewers can tap directly to your event!
                      </li>
                    </ol>
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
