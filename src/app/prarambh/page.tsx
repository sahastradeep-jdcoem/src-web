"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Sparkles, 
  Calendar, 
  MapPin, 
  Quote, 
  ArrowRight, 
  Flame 
} from "lucide-react";
import { 
  getStoredFoundingMembers, 
  syncFoundingMembersFromFirestore,
  subscribeToFoundingMembers
} from "@/lib/councilStore";
import { TeamMember } from "@/types";
import { CouncilMemberCard } from "@/components/team/CouncilMemberCard";
import { Badge } from "@/components/ui/Badge";

export default function PrarambhPage() {
  const [foundingMembers, setFoundingMembers] = useState<TeamMember[]>([]);

  const refreshMembers = () => {
    setFoundingMembers(getStoredFoundingMembers());
  };

  useEffect(() => {
    refreshMembers();

    syncFoundingMembersFromFirestore().then((res) => {
      if (res) setFoundingMembers(res);
    });

    const unsubFounding = subscribeToFoundingMembers((members) => setFoundingMembers(members));

    const handleUpdate = () => {
      refreshMembers();
    };

    window.addEventListener("src_founding_members_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsubFounding();
      window.removeEventListener("src_founding_members_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const sortedFounders = [...foundingMembers].sort((a, b) => (a.order || 999) - (b.order || 999));

  const highlights = [
    {
      stat: "1,500+",
      label: "Students in Attendance",
      desc: "Electrifying gathering at the central amphitheatre",
    },
    {
      stat: "12",
      label: "Clubs Officially Chartered",
      desc: "United under one central autonomous council",
    },
    {
      stat: "16",
      label: "Admin Sashes Conferred",
      desc: "Sworn to uphold student democratic representation",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-20 space-y-20">
      
      {/* 1. CEREMONIAL HERO SECTION */}
      <section className="relative min-h-[55vh] flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-[#F8FAFC] border-b border-slate-200">
        
        <div className="max-w-5xl mx-auto relative z-10 text-center space-y-6">
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm">
            <Flame className="w-4 h-4 text-[#E78023]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#17458F]">
              The Genesis of Sahastradeep • 24 September 2025
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="font-extrabold text-5xl sm:text-7xl lg:text-8xl text-[#0F172A] tracking-tight uppercase leading-none font-heading">
              PRARAMBH
            </h1>
            <p className="text-lg sm:text-2xl font-bold text-[#E78023] uppercase tracking-wider font-heading">
              THE BEGINNING OF SAHASTRADEEP
            </p>
          </div>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed font-medium">
            The foundation ceremony that unified all twelve collegiate societies under a single, autonomous student council — igniting a thousand lights of leadership across JDCOEM Nagpur.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 pt-4 border-t border-slate-200 font-semibold">
            <span className="flex items-center gap-1.5 text-[#0F172A] font-bold">
              <Calendar className="w-4 h-4 text-[#E78023]" />
              <span>24 September 2025</span>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#17458F]" />
              <span>Central Amphitheatre, JDCOEM</span>
            </span>
          </div>

        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* 2. THREE KEY CEREMONIAL STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {highlights.map((item, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-2 shadow-sm"
            >
              <span className="font-extrabold text-4xl sm:text-5xl text-[#E78023] block font-hero">
                {item.stat}
              </span>
              <h3 className="font-bold text-sm uppercase tracking-wider text-[#17458F]">
                {item.label}
              </h3>
              <p className="text-xs text-slate-500 font-medium">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 3. FOUNDING MEMBERS OF SAHASTRADEEP */}
        <section className="space-y-8">
          <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5 font-sans">
                <Sparkles className="w-4 h-4" />
                <span>Founding Council</span>
              </span>
              <h2 className="font-extrabold text-2xl sm:text-4xl text-[#17458F] uppercase font-heading">
                FOUNDING MEMBERS OF SAHASTRADEEP
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium font-sans">
                The founding architects and visionaries who established the Student Representative Council institution.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {sortedFounders.map((member) => (
              <CouncilMemberCard key={member.id} member={member} />
            ))}
          </div>

          {sortedFounders.length === 0 && (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs">
              No founding members listed yet.
            </div>
          )}
        </section>

        {/* 4. HISTORICAL QUOTE SECTION */}
        <section className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 shadow-sm text-center max-w-4xl mx-auto space-y-6">
          <Quote className="w-12 h-12 text-[#E78023] mx-auto opacity-80" />
          <blockquote className="font-extrabold text-xl sm:text-2xl md:text-3xl text-[#0F172A] leading-snug font-heading">
            &ldquo;Sahastradeep is not just a student council; it is the collective beacon of a thousand voices striving for excellence, creativity, and fearless leadership.&rdquo;
          </blockquote>
          <div className="space-y-0.5 text-xs">
            <p className="font-bold text-[#E78023] uppercase tracking-wider font-sans">
              From the Founding Charter of Sahastradeep
            </p>
            <p className="text-slate-500 font-medium font-sans">Investiture Assembly • JDCOEM Nagpur</p>
          </div>
        </section>

        {/* 6. PHOTO MEMORIES */}
        <section className="space-y-8">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] font-sans">
                Visual Archives
              </span>
              <h2 className="font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase font-heading">
                PRARAMBH GALLERY
              </h2>
            </div>
            <Link
              href="/gallery"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#17458F] hover:text-[#E78023] transition-colors"
            >
              <span>Explore All Gallery</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="relative h-64 rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
              <Image
                src="https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=800&auto=format&fit=crop"
                alt="Lamp Lighting"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative h-64 rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
              <Image
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800&auto=format&fit=crop"
                alt="Council Oath"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative h-64 rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
              <Image
                src="https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop"
                alt="Investiture Assembly"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
