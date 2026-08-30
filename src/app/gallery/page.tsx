"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Filter, Sparkles, Maximize2, Tag, Calendar } from "lucide-react";
import { 
  getStoredGalleryPhotos, 
  syncGalleryFromFirestore, 
  subscribeToGallery 
} from "@/lib/galleryStore";
import { LightboxModal } from "@/components/gallery/LightboxModal";
import { GalleryPhoto } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "All",
  "Events",
  "Clubs",
  "SRC",
  "Prarambh",
  "Behind the Scenes",
];

export default function GalleryPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    setPhotos(getStoredGalleryPhotos());

    syncGalleryFromFirestore().then((res) => {
      if (res) setPhotos(res);
    });

    const unsub = subscribeToGallery((p) => setPhotos(p));

    const handleUpdate = () => {
      setPhotos(getStoredGalleryPhotos());
    };

    window.addEventListener("src_gallery_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsub();
      window.removeEventListener("src_gallery_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const filteredPhotos = useMemo(() => {
    if (selectedCategory === "All") return photos;
    return photos.filter((p) => p.category === selectedCategory);
  }, [photos, selectedCategory]);

  const activePhoto = activePhotoIndex !== null ? filteredPhotos[activePhotoIndex] : null;

  const handlePrev = () => {
    if (activePhotoIndex !== null) {
      setActivePhotoIndex((prev) =>
        prev !== null ? (prev > 0 ? prev - 1 : filteredPhotos.length - 1) : 0
      );
    }
  };

  const handleNext = () => {
    if (activePhotoIndex !== null) {
      setActivePhotoIndex((prev) =>
        prev !== null ? (prev < filteredPhotos.length - 1 ? prev + 1 : 0) : 0
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Page Header */}
        <div className="space-y-4 max-w-3xl">
          <Badge variant="orange" size="md">
            VISUAL CHRONICLES
          </Badge>
          <h1 className="font-extrabold text-4xl sm:text-6xl text-[#0F172A] tracking-tight uppercase leading-none">
            MOMENTS THAT
            <br />
            <span className="text-[#E78023]">STAY WITH US.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            A visual retrospective of campus euphoria, robotics arenas, cultural stages, and council leadership at JDCOEM.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-2 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#E78023]" />
              <span>Category:</span>
            </span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all",
                  selectedCategory === cat
                    ? "bg-[#E78023] text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredPhotos.length} photographs
          </span>
        </div>

        {/* Masonry / Structured Image Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPhotos.map((photo, index) => {
            const isTall = photo.aspectRatio === "portrait";

            return (
              <div
                key={photo.id}
                onClick={() => setActivePhotoIndex(index)}
                className={cn(
                  "group relative rounded-3xl overflow-hidden border border-slate-200 bg-white cursor-pointer hover:border-[#17458F]/40 transition-all duration-300 hover:shadow-lg",
                  isTall ? "h-96 sm:h-[480px]" : "h-72 sm:h-80"
                )}
              >
                <Image
                  src={photo.imageUrl}
                  alt={photo.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                
                {/* Dark Gradient Overlay for legible white captions over photography */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />

                {/* Top Badges */}
                <div className="absolute top-4 left-4">
                  <Badge variant="orange" size="sm">
                    {photo.category}
                  </Badge>
                </div>

                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-2 rounded-full bg-white/90 text-slate-800 shadow-sm">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Bottom Caption Info */}
                <div className="absolute bottom-0 left-0 right-0 p-5 space-y-1 transform translate-y-1 group-hover:translate-y-0 transition-transform">
                  <span className="text-[10px] text-[#E78023] font-bold">
                    {photo.date}
                  </span>
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    {photo.title}
                  </h3>
                  <p className="text-xs text-slate-200 line-clamp-2">
                    {photo.caption}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Lightbox Modal */}
        <LightboxModal
          photo={activePhoto}
          onClose={() => setActivePhotoIndex(null)}
          onPrev={handlePrev}
          onNext={handleNext}
        />

      </div>
    </div>
  );
}
