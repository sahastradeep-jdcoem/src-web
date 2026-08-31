"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Sparkles, 
  Crown, 
  ShieldCheck, 
  ArrowRight, 
  Users, 
  Calendar, 
  Award,
  Mail,
  Linkedin,
  Flame,
  CheckCircle2,
  GraduationCap
} from "lucide-react";
import { getStoredCouncilMembers, subscribeToCouncilMembers } from "@/lib/councilStore";
import { getCurrentTenure, getStoredTenures } from "@/lib/tenureStore";
import { getDepartmentShortName } from "@/lib/departmentsStore";
import { TeamMember } from "@/types";
import { Badge } from "@/components/ui/Badge";

export default function LeadershipSpotlightSection() {
  const [councilMembers, setCouncilMembers] = useState<TeamMember[]>([]);
  const [currentTenureLabel, setCurrentTenureLabel] = useState<string>("2025-26");

  const refresh = () => {
    const members = getStoredCouncilMembers();
    setCouncilMembers(members);
    const tenure = getCurrentTenure();
    if (tenure) {
      setCurrentTenureLabel(tenure.label);
    }
  };

  useEffect(() => {
    refresh();

    const unsubscribe = subscribeToCouncilMembers((remote) => {
      if (remote && remote.length > 0) setCouncilMembers(remote);
    });

    const handleUpdate = () => refresh();
    window.addEventListener("src_council_team_updated", handleUpdate);
    window.addEventListener("src_tenures_updated", handleUpdate);
    window.addEventListener("src_tenure_changed", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener("src_council_team_updated", handleUpdate);
      window.removeEventListener("src_tenures_updated", handleUpdate);
      window.removeEventListener("src_tenure_changed", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Find President (exclude Vice President)
  const president = 
    councilMembers.find((m) => {
      const r = (m.role || "").toLowerCase();
      return r.includes("president") && !r.includes("vice");
    }) ||
    councilMembers.find((m) => m.role.toLowerCase() === "president") ||
    councilMembers[1] || // fallback to index 1 (usually president after mentor)
    councilMembers[0];

  // Find Vice President
  const vicePresident = 
    councilMembers.find((m) => {
      const r = (m.role || "").toLowerCase();
      return r.includes("vice president") || r.includes("vice-president") || r === "vp";
    }) ||
    councilMembers.find((m) => m.id !== president?.id && (m.role.toLowerCase().includes("lead") || m.role.toLowerCase().includes("secretary"))) ||
    councilMembers[2];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200 bg-gradient-to-b from-[#F8FAFC] via-white to-[#F8FAFC] text-[#0F172A] relative overflow-hidden">
      
      {/* Background Decorative Glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-[#17458F]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-[#E78023]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-12 relative z-10">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-[#E78023] shadow-xs">
              <Crown className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                NEW TENURE LEADERSHIP SPOTLIGHT • SESSION {currentTenureLabel}
              </span>
            </div>

            <h2 className="font-section text-3xl sm:text-4xl text-[#0F172A] tracking-tight uppercase">
              COUNCIL PRESIDENCY & EXECUTIVE LEADERSHIP
            </h2>
            
            <p className="text-sm text-slate-600 max-w-2xl font-normal">
              Introducing the executive leaders presiding over the Student Representative Council for Tenure {currentTenureLabel}. Council leadership is currently finalizing the upcoming season fests and events.
            </p>
          </div>

          <Link
            href="/team"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#0E2F66] text-white text-xs font-bold uppercase tracking-wider shadow-sm shadow-[#17458F]/20 transition-all cursor-pointer shrink-0"
          >
            <Users className="w-4 h-4 text-[#E78023]" />
            <span>View Full Council Team ({councilMembers.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Dual Spotlight Card Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 1. PRESIDENT SPOTLIGHT CARD */}
          {president && (
            <div className="relative group rounded-3xl bg-gradient-to-br from-white via-slate-50 to-amber-50/30 border border-amber-200/60 p-6 sm:p-8 shadow-sm hover:shadow-xl hover:border-[#E78023]/40 transition-all duration-300">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                
                {/* Photo with Gold Ring */}
                <div className="relative shrink-0">
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden ring-4 ring-amber-400/30 shadow-md relative bg-slate-100">
                    <Image
                      src={president.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop"}
                      alt={president.name}
                      fill
                      unoptimized={true}
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-[#E78023] text-white shadow-md">
                    <Crown className="w-4 h-4" />
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-3 text-center sm:text-left flex-1 min-w-0">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E78023]/10 text-[#E78023] font-mono text-[10px] font-extrabold uppercase tracking-wider">
                      <span>PRESIDENT</span>
                      <span>•</span>
                      <span>{currentTenureLabel}</span>
                    </div>

                    <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-[#0F172A] tracking-tight truncate">
                      {president.name}
                    </h3>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 font-semibold text-[#17458F]">
                      <GraduationCap className="w-3.5 h-3.5 text-[#E78023]" />
                      <span>{president.department || "Engineering"}</span>
                      {president.year && <span>• {president.year}</span>}
                    </div>

                    {president.btId && (
                      <div className="flex items-center justify-center sm:justify-start gap-1 font-mono text-[11px] text-slate-500 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>BT ID: {president.btId}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 font-normal italic">
                    &ldquo;{president.bio || `Leading the Student Representative Council for the ${currentTenureLabel} tenure with unified leadership, transparent governance, and student empowerment.`}&rdquo;
                  </p>

                  <div className="pt-2 flex items-center justify-center sm:justify-start gap-2">
                    {president.email && (
                      <a
                        href={`mailto:${president.email}`}
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#17458F] hover:border-[#17458F]/40 transition-colors"
                        title={`Email ${president.name}`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {president.linkedin && (
                      <a
                        href={president.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#17458F] hover:border-[#17458F]/40 transition-colors"
                        title="LinkedIn Profile"
                      >
                        <Linkedin className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium px-2 py-1 bg-white/60 rounded-lg border border-slate-100">
                      Chief Executive Officer
                    </span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 2. VICE PRESIDENT SPOTLIGHT CARD */}
          {vicePresident && (
            <div className="relative group rounded-3xl bg-gradient-to-br from-white via-slate-50 to-blue-50/30 border border-[#17458F]/20 p-6 sm:p-8 shadow-sm hover:shadow-xl hover:border-[#17458F]/40 transition-all duration-300">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                
                {/* Photo with Blue Ring */}
                <div className="relative shrink-0">
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden ring-4 ring-[#17458F]/20 shadow-md relative bg-slate-100">
                    <Image
                      src={vicePresident.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop"}
                      alt={vicePresident.name}
                      fill
                      unoptimized={true}
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-[#17458F] text-white shadow-md">
                    <Award className="w-4 h-4 text-[#E78023]" />
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-3 text-center sm:text-left flex-1 min-w-0">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#17458F]/10 text-[#17458F] font-mono text-[10px] font-extrabold uppercase tracking-wider">
                      <span>VICE PRESIDENT</span>
                      <span>•</span>
                      <span>{currentTenureLabel}</span>
                    </div>

                    <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-[#0F172A] tracking-tight truncate">
                      {vicePresident.name}
                    </h3>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 font-semibold text-[#17458F]">
                      <GraduationCap className="w-3.5 h-3.5 text-[#E78023]" />
                      <span>{vicePresident.department || "Engineering"}</span>
                      {vicePresident.year && <span>• {vicePresident.year}</span>}
                    </div>

                    {vicePresident.btId && (
                      <div className="flex items-center justify-center sm:justify-start gap-1 font-mono text-[11px] text-slate-500 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>BT ID: {vicePresident.btId}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 font-normal italic">
                    &ldquo;{vicePresident.bio || `Executing institutional operations and empowering collegiate clubs across JDCOEM for Tenure ${currentTenureLabel}.`}&rdquo;
                  </p>

                  <div className="pt-2 flex items-center justify-center sm:justify-start gap-2">
                    {vicePresident.email && (
                      <a
                        href={`mailto:${vicePresident.email}`}
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#17458F] hover:border-[#17458F]/40 transition-colors"
                        title={`Email ${vicePresident.name}`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {vicePresident.linkedin && (
                      <a
                        href={vicePresident.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#17458F] hover:border-[#17458F]/40 transition-colors"
                        title="LinkedIn Profile"
                      >
                        <Linkedin className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium px-2 py-1 bg-white/60 rounded-lg border border-slate-100">
                      Executive Operations
                    </span>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Season Transition Status Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs shadow-xs">
          <div className="flex items-center gap-3 text-slate-600">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#E78023] shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800 block">
                Upcoming Flagship Events in Planning
              </span>
              <span className="text-[11px] text-slate-500">
                Official registration dates and event guidelines for Tenure {currentTenureLabel} will be published here shortly.
              </span>
            </div>
          </div>

          <Link
            href="/team"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17458F] hover:text-[#E78023] transition-colors whitespace-nowrap"
          >
            <span>Explore Department Officers &rarr;</span>
          </Link>
        </div>

      </div>
    </section>
  );
}
