"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Calendar, Tag } from "lucide-react";
import { GalleryPhoto } from "@/types";

interface LightboxModalProps {
  photo: GalleryPhoto | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export function LightboxModal({ 
  photo, 
  onClose, 
  onPrev, 
  onNext,
  currentIndex,
  totalCount 
}: LightboxModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    if (photo) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("wheel", handleWheel, { passive: false });
    } else {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [photo, onClose, onPrev, onNext]);

  if (!photo) return null;

  const formattedIndex = 
    currentIndex !== undefined && totalCount !== undefined
      ? `${String(currentIndex + 1).padStart(2, "0")} / ${String(totalCount).padStart(2, "0")}`
      : null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 bg-black/95 backdrop-blur-2xl select-none"
      role="dialog"
      aria-modal="true"
    >
      {/* Top HUD Toolbar */}
      <div className="absolute top-0 inset-x-0 p-4 sm:p-6 flex items-center justify-between z-50 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          {formattedIndex && (
            <span className="font-mono text-[11px] text-white/80 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 font-bold tracking-wider">
              {formattedIndex}
            </span>
          )}
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#E78023] bg-[#E78023]/15 px-3 py-1 rounded-full border border-[#E78023]/30 backdrop-blur-md hidden sm:inline-flex">
            {photo.category}
          </span>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close Lightbox (Esc)"
          className="p-2.5 min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md transition-all cursor-pointer pointer-events-auto flex items-center justify-center shadow-lg"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Controls */}
      <button
        onClick={onPrev}
        aria-label="Previous photograph (Left Arrow)"
        className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 min-w-[44px] min-h-[44px] rounded-full bg-black/50 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md transition-all cursor-pointer z-50 flex items-center justify-center shadow-xl"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={onNext}
        aria-label="Next photograph (Right Arrow)"
        className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 min-w-[44px] min-h-[44px] rounded-full bg-black/50 hover:bg-white/20 text-white border border-white/15 backdrop-blur-md transition-all cursor-pointer z-50 flex items-center justify-center shadow-xl"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Main Image & Editorial Metadata Container */}
      <div className="relative max-w-5xl w-full max-h-[88vh] flex flex-col items-center justify-center my-auto">
        <div className="relative w-full h-[58vh] sm:h-[68vh] rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
          <Image
            src={photo.imageUrl}
            alt={photo.title}
            fill
            unoptimized={true}
            className="object-contain"
            priority
          />
        </div>

        {/* Minimalist Editorial Caption Bar */}
        <div className="w-full mt-3 p-4 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs select-text shadow-xl">
          <div className="space-y-0.5 max-w-2xl">
            <h4 className="font-heading font-bold text-sm sm:text-base text-white tracking-tight">
              {photo.title}
            </h4>
            {photo.caption && (
              <p className="text-slate-300 font-sans text-xs line-clamp-2 leading-relaxed">
                {photo.caption}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-300 shrink-0 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[#E78023] font-bold">
              <Tag className="w-3 h-3" />
              <span>{photo.category}</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3 h-3" />
              <span>{photo.date}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
