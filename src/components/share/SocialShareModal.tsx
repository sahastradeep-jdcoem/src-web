"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { 
  X, 
  Share2, 
  Download, 
  Copy, 
  Check, 
  QrCode, 
  Sparkles, 
  ExternalLink,
  Instagram,
  Loader2,
  HelpCircle
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
  const [isRendering, setIsRendering] = useState(true);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [storyBlob, setStoryBlob] = useState<Blob | null>(null);
  const [palette, setPalette] = useState<StoryPalette>(DEFAULT_STORY_PALETTE);
  const [includeQrCode, setIncludeQrCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Extract palette and render Story whenever payload or QR toggle changes
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
        const dataUrl = canvas.toDataURL("image/png", 0.95);
        setPreviewDataUrl(dataUrl);
      } catch (err) {
        console.error("[SocialShareModal] Failed to render story preview:", err);
        toast.show("Could not generate story preview", "error");
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
      toast.show("Story destination link copied with tags!", "success", { title: "Link Copied" });
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      toast.show("Could not copy link to clipboard", "error");
    }
  };

  // Download Story Image Handler
  const handleDownload = () => {
    if (!storyBlob && !previewDataUrl) {
      toast.show("Story image is still preparing...", "info");
      return;
    }

    try {
      const url = previewDataUrl || URL.createObjectURL(storyBlob!);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.show("Story image saved to downloads!", "success", { title: "Saved to Device" });
      setShowInstructions(true);
    } catch (err) {
      console.error("Download failed:", err);
      toast.show("Download failed. Please try again.", "error");
    }
  };

  // Native Web Share API Handler
  const handleNativeShare = async () => {
    if (!storyBlob) {
      handleDownload();
      return;
    }

    setIsSharing(true);
    const file = new File([storyBlob], downloadFileName, { type: "image/png" });

    const shareDataWithFile = {
      title: `${payload.title} | SRC JDCOEM`,
      text: payload.subtitle || `Check out this ${payload.type} from SRC JDCOEM!`,
      url: shareUrlWithUtm,
      files: [file],
    };

    const shareDataWithoutFile = {
      title: `${payload.title} | SRC JDCOEM`,
      text: payload.subtitle || `Check out this ${payload.type} from SRC JDCOEM!`,
      url: shareUrlWithUtm,
    };

    try {
      // 1. Check if browser can share files directly (iOS Safari, Android Chrome)
      if (navigator.canShare && navigator.canShare(shareDataWithFile)) {
        await navigator.share(shareDataWithFile);
        toast.show("Story shared successfully!", "success");
        setIsSharing(false);
        return;
      }

      // 2. Fall back to standard link share if file sharing unsupported
      if (navigator.share && navigator.canShare && navigator.canShare(shareDataWithoutFile)) {
        await navigator.share(shareDataWithoutFile);
        toast.show("Link shared! Download the Story image to post.", "info");
        setIsSharing(false);
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setIsSharing(false);
        return;
      }
      console.warn("[SocialShareModal] Native share error, falling back to download:", err);
    }

    // 3. Fallback: Download image + copy link + open instructions
    setIsSharing(false);
    handleDownload();
    handleCopyLink();
    setShowInstructions(true);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Dialog Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-sm">
              <Instagram className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                Share to Instagram Story
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                High-resolution 9:16 branded visual with official SRC accreditation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body (2 Columns on Desktop, Single Column Scroll on Mobile) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          {/* Left Column: 9:16 Story Mockup Preview */}
          <div className="md:col-span-6 flex flex-col items-center justify-center">
            <div className="relative w-[270px] sm:w-[310px] aspect-[9/16] rounded-3xl overflow-hidden border-4 border-slate-700/90 shadow-2xl bg-black flex items-center justify-center group">
              
              {/* Instagram Story Top Pill Mockup */}
              <div className="absolute top-2.5 inset-x-3 z-20 flex items-center gap-2 pointer-events-none">
                <div className="h-1 flex-1 bg-white/40 rounded-full overflow-hidden">
                  <div className="h-full bg-white w-full rounded-full" />
                </div>
              </div>

              {isRendering ? (
                <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Loader2 className="w-8 h-8 text-[#E78023] animate-spin" />
                  <span className="text-xs font-semibold text-slate-300">
                    Generating 9:16 Story canvas...
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Extracting palette & applying depth
                  </span>
                </div>
              ) : previewDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewDataUrl}
                  alt={payload.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                />
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  Failed to load Story preview
                </div>
              )}

              {/* Bottom Canvas Resolution Tag */}
              <div className="absolute bottom-2.5 inset-x-0 flex justify-center pointer-events-none z-20">
                <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-slate-300 border border-white/10">
                  1080 × 1920 • Ultra HD
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Controls, Actions, and Instructions */}
          <div className="md:col-span-6 flex flex-col space-y-4">
            
            {/* Story Details Card */}
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#E78023]">
                <span>{payload.typeLabel || payload.type}</span>
                {payload.badge && (
                  <span className="text-slate-400 lowercase font-medium">• {payload.badge}</span>
                )}
              </div>
              <h4 className="text-sm sm:text-base font-extrabold text-white line-clamp-2 leading-snug">
                {payload.title}
              </h4>
              <p className="text-xs text-slate-300 line-clamp-2 font-normal">
                {payload.subtitle || payload.description || "Official announcement from Student Representative Council."}
              </p>
            </div>

            {/* QR Code Toggle Switch */}
            <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-4 h-4 text-[#E78023]" />
                <div>
                  <span className="text-xs font-bold text-white block">Include QR Code</span>
                  <span className="text-[10px] text-slate-400 block">Embed scan link for viewers in Story footer</span>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={includeQrCode}
                onClick={() => setIncludeQrCode(!includeQrCode)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  includeQrCode ? "bg-[#E78023]" : "bg-slate-700"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    includeQrCode ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Primary Action Buttons */}
            <div className="space-y-2.5 pt-1">
              {/* 1. Share Story Button */}
              <button
                type="button"
                onClick={handleNativeShare}
                disabled={isRendering || isSharing}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#E78023] to-[#D26E17] hover:from-[#d57016] hover:to-[#be5e0e] text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#E78023]/25 cursor-pointer active:scale-[0.98] disabled:opacity-50"
              >
                {isSharing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                <span>Share Story</span>
              </button>

              {/* 2. Download Image Button */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isRendering}
                  className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download Image</span>
                </button>

                {/* 3. Copy Link Button */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  {copiedLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{copiedLink ? "Link Copied!" : "Copy Link"}</span>
                </button>
              </div>
            </div>

            {/* Instagram Posting Instructions Banner */}
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-2">
              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 text-[#E78023]">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>How to post this on Instagram:</span>
                </span>
                <span className="text-[10px] text-slate-500 uppercase">{showInstructions ? "Hide" : "Show"}</span>
              </button>

              {(showInstructions || !previewDataUrl) && (
                <ol className="text-[11px] text-slate-400 space-y-1.5 list-decimal list-inside font-normal pt-1 border-t border-slate-800/60">
                  <li>
                    Tap <strong>Download Image</strong> to save the 1080×1920 graphic to your camera roll.
                  </li>
                  <li>
                    Tap <strong>Copy Link</strong> to get the verified destination URL.
                  </li>
                  <li>
                    Open Instagram → Swipe to create a Story → Pick the downloaded image.
                  </li>
                  <li>
                    Tap the <strong>Sticker icon</strong> (top right) → Choose <strong>LINK</strong> → Paste the copied URL!
                  </li>
                </ol>
              )}
            </div>

            {/* Canonical Destination Link Preview */}
            <div className="text-[10px] text-slate-400 flex items-center justify-between truncate pt-1 px-1">
              <span className="truncate">Destination: <strong className="text-slate-300">{payload.url.replace(/^https?:\/\//, "")}</strong></span>
              <a
                href={payload.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E78023] hover:underline flex items-center gap-0.5 ml-2 shrink-0"
              >
                <span>Verify</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
