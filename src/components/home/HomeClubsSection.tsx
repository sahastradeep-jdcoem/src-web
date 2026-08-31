"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Play, Pause, Sparkles } from "lucide-react";
import { getStoredClubs, syncClubsFromFirestore, subscribeToClubs } from "@/lib/councilStore";
import { ClubCard } from "@/components/clubs/ClubCard";
import { ClubItem } from "@/types";

export default function HomeClubsSection() {
  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setClubs(getStoredClubs());
    syncClubsFromFirestore().then((res) => {
      if (res && Array.isArray(res) && res.length > 0) setClubs(res);
    });

    const unsubscribe = subscribeToClubs((remoteClubs) => {
      if (remoteClubs && Array.isArray(remoteClubs) && remoteClubs.length > 0) {
        setClubs(remoteClubs);
      }
    });

    const handleUpdate = () => {
      setClubs(getStoredClubs());
    };

    window.addEventListener("src_clubs_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener("src_clubs_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const handleManualScroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 380;
    scrollContainerRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Duplicate clubs for seamless infinite loop ticker
  const displayClubs = clubs.length > 0 ? clubs : [];
  const loopedClubs = [...displayClubs, ...displayClubs, ...displayClubs];

  return (
    <section className="py-20 border-b border-slate-200 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <span className="text-xs font-sans font-semibold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Student Communities</span>
            </span>
            <h2 className="font-section text-3xl sm:text-4xl text-[#0F172A] tracking-tight uppercase">
              {displayClubs.length > 0 ? displayClubs.length : 12} CLUBS. ONE COMMUNITY.
            </h2>
            <p className="text-sm text-slate-600 max-w-xl font-sans font-normal">
              Find your space. Build your people. Create something that matters.
            </p>
          </div>

          {/* Action & Carousel Navigation Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Manual Scroll Controls */}
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => handleManualScroll("left")}
                className="h-8 w-8 rounded-full bg-white hover:bg-slate-50 text-slate-700 hover:text-[#17458F] flex items-center justify-center transition-all shadow-xs cursor-pointer"
                title="Scroll Left"
                aria-label="Scroll Carousel Left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsPaused((prev) => !prev)}
                className="h-8 w-8 rounded-full bg-white hover:bg-slate-50 text-slate-700 hover:text-[#E78023] flex items-center justify-center transition-all shadow-xs cursor-pointer"
                title={isPaused ? "Resume Auto-Gliding" : "Pause Auto-Gliding"}
                aria-label={isPaused ? "Resume Carousel" : "Pause Carousel"}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
              </button>

              <button
                type="button"
                onClick={() => handleManualScroll("right")}
                className="h-8 w-8 rounded-full bg-white hover:bg-slate-50 text-slate-700 hover:text-[#17458F] flex items-center justify-center transition-all shadow-xs cursor-pointer"
                title="Scroll Right"
                aria-label="Scroll Carousel Right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Explore All Clubs Button */}
            <Link
              href="/clubs"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#17458F] hover:bg-[#0E2F66] text-white text-xs font-sans font-semibold uppercase tracking-wider transition-all shadow-md shadow-[#17458F]/20 cursor-pointer"
            >
              <span>Explore All {displayClubs.length > 0 ? displayClubs.length : 12} Clubs</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>

      {/* Infinite Right-to-Left Carousel Container */}
      <div className="relative mt-8 w-full pause-on-hover">
        {/* Left & Right Cinematic Gradient Edge Fades */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-20 md:w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-20 md:w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />

        {/* Scrolling Viewport */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto no-scrollbar py-4 px-4 sm:px-6 flex scroll-smooth"
        >
          <div
            className={`flex gap-6 ${
              isPaused ? "" : "animate-marquee-glide"
            }`}
            style={{
              animationPlayState: isPaused ? "paused" : undefined,
            }}
          >
            {loopedClubs.map((club, idx) => (
              <div
                key={`${club.id || club.slug}-${idx}`}
                className="w-[290px] sm:w-[340px] md:w-[370px] shrink-0 transition-transform duration-300 hover:-translate-y-1"
              >
                <ClubCard club={club} />
              </div>
            ))}
          </div>
        </div>

        {/* Carousel Micro Hint */}
        <div className="text-center pt-2">
          <p className="text-[11px] font-sans font-medium text-slate-400">
            Hover over any card to pause • Click arrows or drag to explore all {displayClubs.length || 12} chartered clubs
          </p>
        </div>
      </div>
    </section>
  );
}

