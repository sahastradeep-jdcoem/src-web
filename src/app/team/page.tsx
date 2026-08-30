"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Users, 
  ShieldCheck, 
  Sparkles, 
  Award, 
  Layers, 
  Mic2,
  Megaphone,
  ArrowRight,
  Filter
} from "lucide-react";
import { 
  getStoredCouncilMembers, 
  getStoredHostingCommittee, 
  getStoredSpokespersons, 
  getStoredClubs,
  syncCouncilMembersFromFirestore,
  subscribeToCouncilMembers,
  syncHostingCommitteeFromFirestore,
  subscribeToHostingCommittee,
  syncSpokespersonsFromFirestore,
  subscribeToSpokespersons,
  syncClubsFromFirestore,
  subscribeToClubs
} from "@/lib/councilStore";
import { TeamMember, ClubItem } from "@/types";
import { CouncilMemberCard } from "@/components/team/CouncilMemberCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default function TeamPage() {
  const [councilMembers, setCouncilMembers] = useState<TeamMember[]>([]);
  const [hostingMembers, setHostingMembers] = useState<TeamMember[]>([]);
  const [spokespersons, setSpokespersons] = useState<TeamMember[]>([]);
  const [clubs, setClubs] = useState<ClubItem[]>([]);

  const refreshAll = () => {
    setCouncilMembers(getStoredCouncilMembers());
    setHostingMembers(getStoredHostingCommittee());
    setSpokespersons(getStoredSpokespersons());
    setClubs(getStoredClubs());
  };

  useEffect(() => {
    refreshAll();

    syncCouncilMembersFromFirestore().then((res) => {
      if (res) setCouncilMembers(res);
    });
    syncHostingCommitteeFromFirestore().then((res) => {
      if (res) setHostingMembers(res);
    });
    syncSpokespersonsFromFirestore().then((res) => {
      if (res) setSpokespersons(res);
    });
    syncClubsFromFirestore().then((res) => {
      if (res) setClubs(res);
    });

    const unsubCouncil = subscribeToCouncilMembers((members) => setCouncilMembers(members));
    const unsubHosting = subscribeToHostingCommittee((members) => setHostingMembers(members));
    const unsubSpokes = subscribeToSpokespersons((members) => setSpokespersons(members));
    const unsubClubs = subscribeToClubs((c) => setClubs(c));

    const handleUpdate = () => {
      refreshAll();
    };

    window.addEventListener("src_council_team_updated", handleUpdate);
    window.addEventListener("src_hosting_updated", handleUpdate);
    window.addEventListener("src_spokespersons_updated", handleUpdate);
    window.addEventListener("src_clubs_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsubCouncil();
      unsubHosting();
      unsubSpokes();
      unsubClubs();
      window.removeEventListener("src_council_team_updated", handleUpdate);
      window.removeEventListener("src_hosting_updated", handleUpdate);
      window.removeEventListener("src_spokespersons_updated", handleUpdate);
      window.removeEventListener("src_clubs_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Unified Hosting Committee (spokespersons as a group is called Hosting Committee)
  const unifiedHostingMembers = React.useMemo(() => {
    const list: TeamMember[] = [];
    const seen = new Set<string>();
    [...hostingMembers, ...spokespersons].forEach((m) => {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        list.push(m);
      }
    });
    return list;
  }, [hostingMembers, spokespersons]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 space-y-20">
      <div className="max-w-7xl mx-auto space-y-20">
        
        {/* Page Header */}
        <div className="space-y-4 max-w-3xl">
          <Badge variant="orange" size="md">
            LEADERSHIP & GOVERNANCE
          </Badge>
          <h1 className="font-extrabold text-4xl sm:text-6xl text-[#0F172A] tracking-tight uppercase leading-none">
            THE PEOPLE
            <br />
            <span className="text-[#E78023]">BEHIND SAHASTRADEEP.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            Meet the {councilMembers.length} executive council officers, {unifiedHostingMembers.length} hosting committee members (spokespersons & anchors), and {clubs.length} chartered club leaders steering JDCOEM Nagpur.
          </p>
        </div>

        {/* SECTION 1: SRC ADMIN COUNCIL POSITIONS */}
        <section className="space-y-8">
          <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Executive Council</span>
              </span>
              <h2 className="font-extrabold text-2xl sm:text-4xl text-[#17458F] uppercase">
                {councilMembers.length} ADMIN POSITIONS
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                The governing body authorized under JDCOEM student bylaws.
              </p>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {councilMembers.map((member) => (
              <CouncilMemberCard key={member.id} member={member} />
            ))}
          </div>

          {councilMembers.length === 0 && (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs">
              No council officers listed yet.
            </div>
          )}
        </section>

        {/* SECTION 2: HOSTING COMMITTEE (COUNCIL SPOKESPERSONS & STAGE ANCHORS) */}
        {unifiedHostingMembers.length > 0 && (
          <section className="space-y-8 pt-8 border-t border-slate-200">
            <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4" />
                  <span>Stage Convocations & Student Representation</span>
                </span>
                <h2 className="font-extrabold text-2xl sm:text-4xl text-[#17458F] uppercase">
                  HOSTING COMMITTEE ({unifiedHostingMembers.length})
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Official council spokespersons, stage anchors, and emcees representing student voices and live event moderation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {unifiedHostingMembers.map((member) => (
                <CouncilMemberCard key={member.id} member={member} />
              ))}
            </div>
          </section>
        )}

        {/* SECTION 3: CHARTERED CLUBS LEADS */}
        <section className="space-y-8 pt-8 border-t border-slate-200">
          <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Domain Leadership</span>
              </span>
              <h2 className="font-extrabold text-2xl sm:text-4xl text-[#17458F] uppercase">
                {clubs.length} CLUBS LEADERSHIP
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Club Presidents, Heads, and Co-Heads orchestrating day-to-day workshops, hackathons, and productions.
              </p>
            </div>

            <Link
              href="/clubs"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#17458F] hover:text-[#E78023] transition-colors"
            >
              <span>Explore All {clubs.length} Clubs</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {clubs.map((club) => (
              <div
                key={club.slug}
                className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4 hover:border-[#17458F]/30 hover:shadow-md transition-all flex flex-col justify-between shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {club.name}
                    </span>
                    <span className="text-[10px] font-bold text-[#E78023]">
                      CLUB LEAD
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs shrink-0">
                      <Image
                        src={club.lead.avatar}
                        alt={club.lead.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#0F172A]">
                        {club.lead.name || "TBA"}
                      </h4>
                      <p className="text-xs text-[#17458F] font-semibold">{club.lead.role}</p>
                    </div>
                  </div>

                  {club.coLead?.name && (
                    <div className="text-xs text-slate-500 pt-2 border-t border-slate-100 font-medium">
                      <span>Co-Lead: </span>
                      <strong className="text-slate-800 font-semibold">{club.coLead.name}</strong> ({club.coLead.role})
                    </div>
                  )}
                </div>

                <Link
                  href={`/clubs/${club.slug}`}
                  className="inline-flex items-center justify-between w-full pt-3 border-t border-slate-100 text-xs font-bold uppercase tracking-wider text-[#17458F] hover:text-[#E78023] transition-colors"
                >
                  <span>View Club Page</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
