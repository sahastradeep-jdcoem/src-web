"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Filter, Award, Sparkles, ArrowRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface ArchiveItem {
  id: string;
  name: string;
  year: string;
  category: string;
  club: string;
  poster: string;
  summary: string;
  stats: string;
  winner: string;
}

const ARCHIVE_DATA: ArchiveItem[] = [
  {
    id: "arc-1",
    name: "PRARAMBH (Founding Council Investiture)",
    year: "2025",
    category: "Fest",
    club: "SRC Central Council",
    poster: "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=800&auto=format&fit=crop",
    summary: "Historic investiture ceremony where Sahastradeep and the chartered student clubs were officially badged and established.",
    stats: "Central Amphitheatre • Official Investiture",
    winner: "Founding Council Invested",
  },
  {
    id: "arc-2",
    name: "PRARAMBH Cultural & Technical Showcases",
    year: "2025",
    category: "Fest",
    club: "SRC Central Council",
    poster: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
    summary: "Collegiate stage productions, musical concerts, and department exhibitions under the Sahastradeep banner.",
    stats: "All-Campus Showcase",
    winner: "Institutional Accreditations",
  },
];

const YEARS = ["All", "2025", "2024"];
const CATEGORIES = ["All", "Fest", "Technical", "Competitions", "Cultural"];

export default function ArchivePage() {
  const [selectedYear, setSelectedYear] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredArchive = useMemo(() => {
    return ARCHIVE_DATA.filter((item) => {
      const matchesYear = selectedYear === "All" || item.year === selectedYear;
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      return matchesYear && matchesCategory;
    });
  }, [selectedYear, selectedCategory]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 space-y-12">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Page Header */}
        <div className="space-y-4 max-w-3xl">
          <Badge variant="orange" size="md">
            HISTORICAL RETROSPECTIVE
          </Badge>
          <h1 className="font-extrabold text-4xl sm:text-6xl text-[#0F172A] tracking-tight uppercase leading-none">
            THE ARCHIVE.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            A chronicle of past milestones, championship roll rosters, and legacy celebrations of JDCOEM.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            
            {/* Year */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
                Year:
              </span>
              {YEARS.map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all",
                    selectedYear === yr
                      ? "bg-[#E78023] text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  {yr}
                </button>
              ))}
            </div>

            {/* Category */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
                Domain:
              </span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all",
                    selectedCategory === cat
                      ? "bg-[#17458F] text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

          </div>

          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredArchive.length} legacy events
          </span>
        </div>

        {/* Editorial Archive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredArchive.map((item) => (
            <div
              key={item.id}
              className="rounded-3xl bg-white border border-slate-200 hover:border-[#17458F]/30 hover:shadow-md transition-all overflow-hidden flex flex-col justify-between shadow-xs"
            >
              <div className="relative h-48 w-full overflow-hidden">
                <Image
                  src={item.poster}
                  alt={item.name}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                <div className="absolute top-3.5 left-3.5 flex gap-2">
                  <Badge variant="orange" size="sm">
                    {item.year}
                  </Badge>
                  <Badge variant="slate" size="sm">
                    {item.category}
                  </Badge>
                </div>
              </div>

              <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="font-bold text-lg text-[#0F172A]">
                    {item.name}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {item.summary}
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-500">Organizer:</span>
                    <span className="font-semibold text-slate-800">{item.club}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-500">Turnout:</span>
                    <span className="font-semibold text-slate-800">{item.stats}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Championship:</span>
                    <span className="font-bold text-[#E78023]">{item.winner}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
