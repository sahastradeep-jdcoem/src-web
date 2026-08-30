"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Filter, Sparkles, Users } from "lucide-react";
import { getStoredClubs, syncClubsFromFirestore, subscribeToClubs } from "@/lib/councilStore";
import { ClubItem } from "@/types";
import { ClubCard } from "@/components/clubs/ClubCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default function ClubsDirectoryPage() {
  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setClubs(getStoredClubs());
    syncClubsFromFirestore().then((res) => {
      if (res) setClubs(res);
    });

    const unsubscribe = subscribeToClubs((remoteClubs) => {
      setClubs(remoteClubs);
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

  const filteredClubs = useMemo(() => {
    return clubs.filter((club) => {
      const matchesSearch =
        club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        club.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        club.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        club.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [clubs, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8 space-y-12 text-[#0F172A]">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Page Header */}
        <div className="space-y-4 max-w-3xl">
          <Badge variant="orange" size="md">
            COUNCIL ECOSYSTEM
          </Badge>
          <h1 className="font-extrabold text-4xl sm:text-6xl text-[#0F172A] tracking-tight uppercase leading-none font-heading">
            {clubs.length} CLUBS.
            <br />
            <span className="text-[#E78023]">ONE COMMUNITY.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium font-sans">
            Find your space. Build your people. Create something that matters.
          </p>
        </div>

        {/* Search Toolbar */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by club name, category, or interests..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-[#17458F] placeholder:text-slate-400 font-sans"
            />
          </div>
        </div>

        {/* Clubs Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h3 className="font-extrabold text-xl text-[#17458F] uppercase font-heading">
              Chartered Clubs ({filteredClubs.length})
            </h3>
            <span className="text-xs text-slate-500 font-medium font-sans">
              100% Chartered under SRC
            </span>
          </div>

          {filteredClubs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClubs.map((club) => (
                <ClubCard key={club.id} club={club} />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
              <Sparkles className="w-8 h-8 text-[#E78023] mx-auto opacity-70" />
              <h4 className="font-bold text-lg text-slate-800">No clubs found</h4>
              <p className="text-xs text-slate-500">
                Try adjusting your search criteria or resetting the domain filter.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
