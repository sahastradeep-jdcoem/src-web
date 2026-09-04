"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { GraduationCap, Award, ShieldCheck, Mail, Linkedin } from "lucide-react";
import { InstitutionalPillar } from "@/types";
import { 
  getStoredInstitutionalPillars, 
  syncInstitutionalPillarsFromFirestore, 
  subscribeToInstitutionalPillars 
} from "@/lib/councilStore";

interface PillarsOfStrengthSectionProps {
  className?: string;
}

export function PillarsOfStrengthSection({ className = "" }: PillarsOfStrengthSectionProps) {
  const [pillars, setPillars] = useState<InstitutionalPillar[]>([]);

  useEffect(() => {
    setPillars(getStoredInstitutionalPillars());

    syncInstitutionalPillarsFromFirestore().then((res) => {
      if (res && res.length > 0) setPillars(res);
    });

    const unsub = subscribeToInstitutionalPillars((res) => {
      if (res && res.length > 0) setPillars(res);
    });

    const handleUpdate = () => {
      setPillars(getStoredInstitutionalPillars());
    };

    window.addEventListener("src_pillars_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsub();
      window.removeEventListener("src_pillars_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const sortedPillars = [...pillars].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return (
    <section className={`space-y-4 ${className}`}>
      {/* Postcard Container with Subtle Academic Aesthetic */}
      <div className="p-5 sm:p-7 rounded-3xl bg-linear-to-b from-white via-slate-50/40 to-slate-50/80 border border-slate-200/90 shadow-2xs space-y-5">
        
        {/* Understated Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#17458F]/10 text-[#17458F] border border-[#17458F]/20 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#E78023]" />
                <span>Institutional Patrons &amp; Mentors</span>
              </span>
            </div>
            <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-[#17458F] uppercase tracking-tight">
              4 PILLARS OF STRENGTH OF SRC
            </h2>
            <p className="text-xs text-slate-500 font-medium max-w-2xl">
              Visionary institutional patronship and dedicated faculty mentorship guiding the Student Representative Council at JDCOEM Nagpur.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 bg-white px-3 py-1 rounded-full border border-slate-200/70 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#E78023]" />
            <span>Guiding Sahastradeep</span>
          </div>
        </div>

        {/* 4 Postcards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {sortedPillars.map((pillar) => (
            <div
              key={pillar.id}
              className="group bg-white rounded-2xl border border-slate-200/90 hover:border-[#17458F]/30 p-3 sm:p-3.5 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden"
            >
              {/* Postage Stamp Role Badge */}
              <div className="absolute top-4 right-4 z-10">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs text-[#17458F] border border-slate-200 text-[9px] font-black uppercase tracking-wider shadow-xs">
                  <Award className="w-2.5 h-2.5 text-[#E78023]" />
                  <span>{pillar.role}</span>
                </span>
              </div>

              {/* Framed Portrait Photo (Postcard Aspect Ratio) */}
              <div className="space-y-3">
                <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-slate-100 border border-slate-200/70 shadow-inner">
                  <Image
                    src={pillar.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop"}
                    alt={pillar.name}
                    fill
                    unoptimized={true}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover object-top group-hover:scale-104 transition-transform duration-500 ease-out"
                  />
                  
                </div>

                {/* Postcard Details */}
                <div className="space-y-1">
                  <h3 className="font-heading font-extrabold text-sm sm:text-base text-[#0F172A] group-hover:text-[#17458F] transition-colors line-clamp-1 leading-snug">
                    {pillar.name}
                  </h3>
                  <p className="text-xs font-bold text-[#E78023] line-clamp-1 leading-tight">
                    {pillar.designation}
                  </p>
                  <p className="text-[10px] font-medium text-slate-500 line-clamp-1 font-sans">
                    {pillar.department}
                  </p>
                </div>
              </div>

              {/* Quote / Creed (Postcard Backside Note) */}
              {pillar.quote && (
                <div className="pt-2.5 mt-2.5 border-t border-dashed border-slate-200 text-[11px] text-slate-600 italic line-clamp-2 leading-relaxed font-serif">
                  &ldquo;{pillar.quote}&rdquo;
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
