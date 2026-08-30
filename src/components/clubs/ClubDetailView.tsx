"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Users, 
  Sparkles, 
  Calendar, 
  ArrowLeft, 
  ArrowRight, 
  Award, 
  CheckCircle2, 
  Compass, 
  Image as ImageIcon 
} from "lucide-react";
import { getStoredClubs } from "@/lib/councilStore";
import { getDepartmentShortName } from "@/lib/departmentsStore";
import { ClubItem, EventItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { EventCard } from "@/components/events/EventCard";

interface ClubDetailViewProps {
  initialClub: ClubItem;
  clubEvents: EventItem[];
}

export default function ClubDetailView({ initialClub, clubEvents }: ClubDetailViewProps) {
  const [club, setClub] = useState<ClubItem>(initialClub);

  useEffect(() => {
    const storedClubs = getStoredClubs();
    const found = storedClubs.find((c) => c.slug === initialClub.slug || c.id === initialClub.id);
    if (found) {
      setClub(found);
    }

    const handleUpdate = () => {
      const updatedClubs = getStoredClubs();
      const updatedFound = updatedClubs.find((c) => c.slug === initialClub.slug || c.id === initialClub.id);
      if (updatedFound) {
        setClub(updatedFound);
      }
    };

    window.addEventListener("src_clubs_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("src_clubs_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [initialClub]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-20">
      
      {/* 1. CINEMATIC HERO */}
      <section className="relative h-[50vh] sm:h-[55vh] flex items-end pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-slate-900">
        <Image
          src={club.heroImage}
          alt={club.name}
          fill
          priority
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="max-w-7xl mx-auto w-full relative z-10 space-y-6">
          <Link
            href="/clubs"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-[#E78023] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Clubs Directory</span>
          </Link>

          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#E78023] text-white">
                {club.category}
              </span>
              <span className="text-xs font-bold text-white px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#E78023]" />
                <span>{club.memberCount} Active Members</span>
              </span>
            </div>

            <h1 className="font-extrabold text-4xl sm:text-6xl text-white tracking-tight uppercase font-heading">
              {club.name}
            </h1>

            <p className="text-base sm:text-lg text-[#E78023] font-bold tracking-wide">
              {club.tagline}
            </p>
          </div>
        </div>
      </section>

      {/* 2. BODY CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 space-y-16">
        
        {/* Mission & About Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Identity & Purpose</span>
            </span>
            <h2 className="font-extrabold text-2xl text-[#17458F] uppercase font-heading">
              ABOUT THE CLUB
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
              {club.description}
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-[#17458F] flex items-center gap-1.5">
              <Compass className="w-4 h-4" />
              <span>Charter Mandate</span>
            </span>
            <h2 className="font-extrabold text-2xl text-[#17458F] uppercase font-heading">
              OUR MISSION
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
              {club.mission}
            </p>
          </div>
        </div>

        {/* Leadership Section */}
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="font-extrabold text-2xl text-[#17458F] uppercase font-heading">
              CLUB COORDINATORS & LEADERSHIP
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Council-appointed student heads overseeing club affairs and workshops.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
            {/* Primary Lead */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 flex items-center gap-4 shadow-xs">
              <div className="relative h-16 w-16 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                <Image
                  src={club.lead.avatar}
                  alt={club.lead.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E78023]">
                  {club.lead.role}
                </span>
                <h4 className="font-bold text-base text-[#0F172A]">
                  {club.lead.name}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  <span className="sm:hidden">{getDepartmentShortName(club.lead.department)}</span>
                  <span className="hidden sm:inline">{club.lead.department}</span>
                  {" "}• {club.lead.year}
                </p>
              </div>
            </div>

            {/* Co-Lead */}
            {club.coLead && (
              <div className="p-6 rounded-3xl bg-white border border-slate-200 flex items-center gap-4 shadow-xs">
                <div className="relative h-16 w-16 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  <Image
                    src={club.coLead.avatar}
                    alt={club.coLead.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#17458F]">
                    {club.coLead.role}
                  </span>
                  <h4 className="font-bold text-base text-[#0F172A]">
                    {club.coLead.name}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    <span className="sm:hidden">{getDepartmentShortName(club.coLead.department)}</span>
                    <span className="hidden sm:inline">{club.coLead.department}</span>
                    {" "}• {club.coLead.year}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Club Events */}
        {clubEvents.length > 0 && (
          <section className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="font-extrabold text-2xl text-[#17458F] uppercase font-heading">
                ORGANIZED BY {club.name}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clubEvents.map((evt) => (
                <EventCard key={evt.id} event={evt} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
