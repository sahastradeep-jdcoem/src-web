"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Calendar, 
  Filter, 
  Award, 
  Sparkles, 
  ArrowRight, 
  ExternalLink,
  ShieldCheck,
  Trophy,
  History,
  Users
} from "lucide-react";
import { 
  getStoredTenures, 
  syncTenuresFromFirestore, 
  subscribeToTenures, 
  CouncilTenure 
} from "@/lib/tenureStore";
import { CouncilMemberCard } from "@/components/team/CouncilMemberCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default function ArchivePage() {
  const [tenures, setTenures] = useState<CouncilTenure[]>([]);
  const [selectedTenureId, setSelectedTenureId] = useState<string>("ALL");

  useEffect(() => {
    setTenures(getStoredTenures());

    syncTenuresFromFirestore().then((res) => {
      if (res) setTenures(res);
    });

    const unsub = subscribeToTenures((t) => setTenures(t));

    const handleUpdate = () => {
      setTenures(getStoredTenures());
    };

    window.addEventListener("src_tenures_updated", handleUpdate);
    window.addEventListener("src_tenure_changed", handleUpdate);
    window.addEventListener("src_council_team_updated", handleUpdate);
    window.addEventListener("src_hosting_updated", handleUpdate);
    window.addEventListener("src_founding_members_updated", handleUpdate);
    window.addEventListener("src_events_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsub();
      window.removeEventListener("src_tenures_updated", handleUpdate);
      window.removeEventListener("src_tenure_changed", handleUpdate);
      window.removeEventListener("src_council_team_updated", handleUpdate);
      window.removeEventListener("src_hosting_updated", handleUpdate);
      window.removeEventListener("src_founding_members_updated", handleUpdate);
      window.removeEventListener("src_events_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const activeTenure = tenures.find((t) => t.isCurrent) || tenures[0];
  const displayedTenures = useMemo(() => {
    if (selectedTenureId === "ALL") return tenures;
    return tenures.filter((t) => t.id === selectedTenureId);
  }, [tenures, selectedTenureId]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 space-y-16 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Page Header */}
        <div className="space-y-4 max-w-3xl">
          <Badge variant="orange" size="md">
            HISTORICAL RETROSPECTIVE
          </Badge>
          <h1 className="font-extrabold text-4xl sm:text-6xl text-[#0F172A] tracking-tight uppercase leading-none font-heading">
            THE ARCHIVE.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium font-sans">
            A chronicle of past council tenures, leadership sessions, championship rolls, and historic collegiate milestones of JDCOEM.
          </p>
        </div>

        {/* Tenure Session Selector Bar */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-2 flex items-center gap-1.5 font-sans">
              <History className="w-3.5 h-3.5 text-[#E78023]" />
              <span>Council Tenure:</span>
            </span>

            <button
              onClick={() => setSelectedTenureId("ALL")}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                selectedTenureId === "ALL"
                  ? "bg-[#17458F] text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              )}
            >
              All Tenures ({tenures.length})
            </button>

            {tenures.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTenureId(t.id)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                  selectedTenureId === t.id
                    ? "bg-[#E78023] text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                )}
              >
                <span>{t.tenureNumber ? `${t.tenureNumber} (${t.label})` : `Tenure ${t.label}`}</span>
                {t.isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 font-medium font-sans">
            Serving students across all academic years
          </span>
        </div>

        {/* Tenure Sections Loop */}
        <div className="space-y-16">
          {displayedTenures.map((tenure) => (
            <section
              key={tenure.id}
              className="p-6 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-8"
            >
              {/* Tenure Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                      {tenure.tenureNumber ? `${tenure.tenureNumber.toUpperCase()} (${tenure.label})` : `TENURE ${tenure.label}`}
                    </span>
                    {tenure.id === "tenure-2025-26" && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E78023]/10 text-[#E78023] border border-[#E78023]/20 text-[10px] font-bold uppercase tracking-wider">
                        Founding Session
                      </span>
                    )}
                    {tenure.isCurrent ? (
                      <Badge variant="success" size="sm">
                        CURRENT ACTIVE TENURE
                      </Badge>
                    ) : (
                      <Badge variant="slate" size="sm">
                        ARCHIVED SESSION
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-[#E78023]">
                    {tenure.theme} • Academic Year {tenure.academicYear}
                  </p>
                  {tenure.archiveNotes && (
                    <p className="text-xs text-slate-600 max-w-3xl leading-relaxed pt-1 font-medium font-sans">
                      {tenure.archiveNotes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 font-sans shrink-0">
                  <span className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
                    {tenure.adminCouncil?.length || 0} Admins
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
                    {tenure.events?.length || 0} Events
                  </span>
                </div>
              </div>

              {/* Admin Council in this Tenure */}
              {tenure.adminCouncil && tenure.adminCouncil.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#17458F] flex items-center gap-1.5 font-sans">
                      <ShieldCheck className="w-4 h-4 text-[#E78023]" />
                      <span>Admin Council of Tenure {tenure.label}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                    {tenure.adminCouncil.map((member) => (
                      <CouncilMemberCard key={member.id} member={member} categoryLabel="ADMIN" />
                    ))}
                  </div>
                </div>
              )}

              {/* Events & Milestones in this Tenure */}
              {tenure.events && tenure.events.length > 0 && (
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#17458F] flex items-center gap-1.5 font-sans">
                      <Calendar className="w-4 h-4 text-[#E78023]" />
                      <span>Events &amp; Milestones ({tenure.events.length})</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tenure.events.map((evt) => (
                      <div
                        key={evt.id}
                        className="rounded-2xl bg-slate-50 border border-slate-200 hover:border-[#17458F]/30 transition-all overflow-hidden flex flex-col justify-between"
                      >
                        <div className="relative h-44 w-full overflow-hidden bg-slate-200">
                          <Image
                            src={evt.poster}
                            alt={evt.name}
                            fill
                            className="object-cover"
                          />
                          <div className="absolute top-2.5 left-2.5">
                            <Badge variant="orange" size="sm">
                              {evt.category}
                            </Badge>
                          </div>
                        </div>

                        <div className="p-4 space-y-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            {evt.date} • {evt.venue}
                          </span>
                          <h4 className="font-heading font-bold text-base text-[#0F172A]">
                            {evt.name}
                          </h4>
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-sans font-normal">
                            {evt.about}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </section>
          ))}
        </div>

      </div>
    </div>
  );
}
