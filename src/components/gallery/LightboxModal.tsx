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
}

export function LightboxModal({ photo, onClose, onPrev, onNext }: LightboxModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };

    if (photo) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [photo, onClose, onPrev, onNext]);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-brand-black/95 backdrop-blur-2xl">
      {/* Close Button */}
      <button
        onClick={onClose}
        aria-label="Close Lightbox"
        className="absolute top-6 right-6 p-3 rounded-full bg-brand-surface/80 hover:bg-brand-orange text-white border border-brand-border transition-colors z-50"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Navigation Controls */}
      <button
        onClick={onPrev}
        aria-label="Previous Image"
        className="hidden sm:flex absolute left-6 top-1/2 -translate-y-1/2 p-3.5 rounded-full bg-brand-surface/80 hover:bg-brand-navy-light text-white border border-brand-border transition-colors z-50"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={onNext}
        aria-label="Next Image"
        className="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 p-3.5 rounded-full bg-brand-surface/80 hover:bg-brand-navy-light text-white border border-brand-border transition-colors z-50"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Main Image & Metadata Container */}
      <div className="relative max-w-5xl w-full max-h-[85vh] flex flex-col items-center justify-center">
        <div className="relative w-full h-[60vh] sm:h-[70vh] rounded-2xl overflow-hidden border border-brand-border shadow-2xl">
          <Image
            src={photo.imageUrl}
            alt={photo.title}
            fill
            unoptimized={true}
            className="object-contain"
            priority
          />
        </div>

        {/* Caption Bar */}
        <div className="w-full mt-4 p-4 rounded-2xl bg-brand-surface/90 border border-brand-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div>
            <h4 className="font-display font-bold text-base text-white">
              {photo.title}
            </h4>
            <p className="text-brand-gray mt-0.5">{photo.caption}</p>
          </div>

          <div className="flex items-center gap-4 text-slate-300 shrink-0">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-navy/30 border border-brand-navy/50 text-brand-orange font-bold uppercase tracking-wider text-[10px]">
              <Tag className="w-3 h-3" />
              {photo.category}
            </span>
            <span className="flex items-center gap-1.5 text-brand-gray">
              <Calendar className="w-3.5 h-3.5" />
              {photo.date}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
