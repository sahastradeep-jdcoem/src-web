"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getStoredClubs } from "@/lib/councilStore";
import { ClubCard } from "@/components/clubs/ClubCard";
import { ClubItem } from "@/types";

export default function HomeClubsSection() {
  const [clubs, setClubs] = useState<ClubItem[]>([]);

  const refreshClubs = () => {
    setClubs(getStoredClubs());
  };

  useEffect(() => {
    refreshClubs();

    const handleUpdate = () => {
      refreshClubs();
    };

    window.addEventListener("src_clubs_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("src_clubs_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const featured = clubs.slice(0, 6);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto space-y-12">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <span className="text-xs font-sans font-semibold uppercase tracking-wider text-[#E78023]">
              Student Communities
            </span>
            <h2 className="font-section text-3xl sm:text-4xl text-[#0F172A] tracking-tight uppercase">
              {clubs.length} CLUBS. ONE COMMUNITY.
            </h2>
            <p className="text-sm text-slate-600 max-w-xl font-sans font-normal">
              Find your space. Build your people. Create something that matters.
            </p>
          </div>

          <Link
            href="/clubs"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#17458F] hover:bg-[#0E2F66] text-white text-xs font-sans font-semibold uppercase tracking-wider transition-all shadow-md shadow-[#17458F]/20 cursor-pointer"
          >
            <span>Explore All {clubs.length} Clubs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((club) => (
            <ClubCard key={club.id} club={club} />
          ))}
        </div>

      </div>
    </section>
  );
}
