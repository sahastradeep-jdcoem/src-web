"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { 
  Filter, 
  Sparkles, 
  Maximize2, 
  Tag, 
  Calendar, 
  LayoutGrid, 
  Rows3, 
  Search, 
  X, 
  Camera,
  ArrowRight
} from "lucide-react";
import { 
  getStoredGalleryPhotos, 
  syncGalleryFromFirestore, 
  subscribeToGallery 
} from "@/lib/galleryStore";
import { LightboxModal } from "@/components/gallery/LightboxModal";
import { GalleryPhoto } from "@/types";
import { cn } from "@/lib/utils";

export default function GalleryPage() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "journal">("grid");
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  const categories = useMemo(() => {
    const existing = Array.from(new Set(photos.map((p) => p.category).filter(Boolean)));
    const priority = ["Events", "Clubs", "SRC", "Prarambh", "Behind the Scenes"];
    existing.sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return ["All", ...existing];
  }, [photos]);

  useEffect(() => {
    if (selectedCategory !== "All" && !categories.includes(selectedCategory)) {
      setSelectedCategory("All");
    }
  }, [categories, selectedCategory]);

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
    return photos.filter((p) => {
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        (p.caption && p.caption.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.date && p.date.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [photos, selectedCategory, searchQuery]);

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

  const getAspectClass = (ratio?: string) => {
    switch (ratio) {
      case "portrait":
        return "aspect-[3/4]";
      case "square":
        return "aspect-square";
      case "landscape":
      default:
        return "aspect-[16/10]";
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-10 sm:py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
        
        {/* VSCO Editorial Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-200/80">
          <div className="space-y-2 max-w-3xl">
            <h1 className="font-heading font-extrabold text-3xl sm:text-5xl lg:text-6xl text-[#0F172A] tracking-tight uppercase leading-none">
              MOMENTS &amp;
              <br />
              <span className="text-[#E78023]">ATMOSPHERE.</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-sans font-normal max-w-2xl pt-1 leading-relaxed">
              An editorial retrospective capturing student life, hackathon arenas, cultural amphitheaters, and council milestones at JDCOEM.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-end">
            <span className="font-mono text-[11px] sm:text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full shadow-2xs">
              {filteredPhotos.length} {filteredPhotos.length === 1 ? "FRAME" : "FRAMES"}
            </span>
          </div>
        </div>

        {/* Minimalist VSCO Filter & View Controls Toolbar */}
        <div className="p-3 sm:p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Horizontal Category Pills with smooth touch scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 pr-2">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer font-sans shrink-0 min-h-[36px]",
                    isSelected
                      ? "bg-[#0F172A] text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Right Tools: Search Input + View Mode Switcher */}
          <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
            {/* Minimalist Search Box */}
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search collection..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-full bg-slate-100 hover:bg-slate-150 focus:bg-white border border-transparent focus:border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* View Mode Toggle: Grid vs Journal */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Masonry Grid View"
                title="Masonry Grid View"
                className={cn(
                  "p-1.5 rounded-full transition-all cursor-pointer",
                  viewMode === "grid"
                    ? "bg-white text-[#17458F] shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setViewMode("journal")}
                aria-label="Editorial Journal View"
                title="Editorial Journal View"
                className={cn(
                  "p-1.5 rounded-full transition-all cursor-pointer",
                  viewMode === "journal"
                    ? "bg-white text-[#17458F] shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Rows3 className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* FEED CONTENT CONTAINER */}
        {filteredPhotos.length === 0 ? (
          /* VSCO Empty State */
          <div className="py-24 text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <Camera className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-[#0F172A]">
                No photographs in this collection
              </h3>
              <p className="text-xs text-slate-500">
                Try switching the category filter or clearing your search term.
              </p>
            </div>
            {(selectedCategory !== "All" || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCategory("All");
                  setSearchQuery("");
                }}
                className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          /* 1. MASONRY GRID LAYOUT (VSCO Signature Flow: 2-col on mobile, 3-col on tablet, 4-col on desktop) */
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-5 [column-fill:_balance]">
            {filteredPhotos.map((photo, index) => {
              const aspectClass = getAspectClass(photo.aspectRatio);

              return (
                <div
                  key={photo.id}
                  onClick={() => setActivePhotoIndex(index)}
                  className="break-inside-avoid mb-3 sm:mb-5 group relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60 shadow-2xs hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col"
                >
                  {/* Photo Frame */}
                  <div className={cn("relative w-full overflow-hidden bg-slate-200", aspectClass)}>
                    <Image
                      src={photo.imageUrl}
                      alt={photo.title}
                      fill
                      unoptimized={true}
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />

                    {/* Subtle VSCO Hover Vignette */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    {/* Top Right Expand Trigger */}
                    <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 pointer-events-none">
                      <div className="p-2 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 shadow-md">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Bottom Metadata Revealed on Hover */}
                    <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 space-y-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 pointer-events-none">
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-[#E78023] block line-clamp-1">
                        {photo.category} • {photo.date}
                      </span>
                      <h3 className="font-heading font-bold text-xs sm:text-sm text-white line-clamp-1 tracking-tight">
                        {photo.title}
                      </h3>
                      {photo.caption && (
                        <p className="text-[10px] text-slate-300 line-clamp-2 font-sans font-normal leading-snug">
                          {photo.caption}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Clean Minimal Underline Caption for Mobile / Touch Viewers */}
                  <div className="p-2 sm:p-2.5 bg-white flex items-center justify-between gap-2 border-t border-slate-100">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-slate-900 truncate leading-tight">
                        {photo.title}
                      </p>
                      <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wide truncate mt-0.5">
                        {photo.category}
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 shrink-0">
                      {photo.date ? photo.date.split(" ").slice(-2).join(" ") : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 2. EDITORIAL JOURNAL FEED LAYOUT (VSCO Magazine Single / Dual Column Experience) */
          <div className="max-w-3xl mx-auto space-y-12 sm:space-y-16">
            {filteredPhotos.map((photo, index) => {
              const aspectClass = 
                photo.aspectRatio === "portrait"
                  ? "aspect-[4/5]"
                  : photo.aspectRatio === "square"
                  ? "aspect-square"
                  : "aspect-[16/10]";

              return (
                <article
                  key={photo.id}
                  className="group rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden"
                >
                  {/* Large Cinematic Photo Frame */}
                  <div 
                    onClick={() => setActivePhotoIndex(index)}
                    className={cn(
                      "relative w-full overflow-hidden bg-slate-100 cursor-pointer",
                      aspectClass
                    )}
                  >
                    <Image
                      src={photo.imageUrl}
                      alt={photo.title}
                      fill
                      unoptimized={true}
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                    />

                    {/* Expand CTA overlay */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="p-2.5 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 shadow-md">
                        <Maximize2 className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Understated Editorial Caption Block */}
                  <div className="p-5 sm:p-7 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 font-bold text-[10px] uppercase tracking-wider font-mono">
                          {photo.category}
                        </span>
                        <span className="text-slate-400 text-xs">•</span>
                        <span className="font-mono text-xs text-slate-500">
                          {photo.date}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActivePhotoIndex(index)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17458F] hover:text-[#E78023] transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        <span>Full Studio View</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <h2 
                        onClick={() => setActivePhotoIndex(index)}
                        className="font-heading font-extrabold text-xl sm:text-2xl text-[#0F172A] tracking-tight hover:text-[#17458F] transition-colors cursor-pointer"
                      >
                        {photo.title}
                      </h2>
                      {photo.caption && (
                        <p className="text-sm text-slate-600 font-sans font-normal leading-relaxed pt-1">
                          {photo.caption}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Lightbox Modal with Index & Darkroom Studio Controls */}
        <LightboxModal
          photo={activePhoto}
          onClose={() => setActivePhotoIndex(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          currentIndex={activePhotoIndex !== null ? activePhotoIndex : undefined}
          totalCount={filteredPhotos.length}
        />

      </div>
    </div>
  );
}
