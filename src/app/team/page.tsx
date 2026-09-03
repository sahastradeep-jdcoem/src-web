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
  subscribeToClubs,
  getClubLeaders
} from "@/lib/councilStore";
import { getCurrentTenure, CouncilTenure } from "@/lib/tenureStore";
import { TeamMember, ClubItem } from "@/types";
import { CouncilMemberCard } from "@/components/team/CouncilMemberCard";
import { PillarsOfStrengthSection } from "@/components/team/PillarsOfStrengthSection";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export default function TeamPage() {
  const [councilMembers, setCouncilMembers] = useState<TeamMember[]>([]);
  const [hostingMembers, setHostingMembers] = useState<TeamMember[]>([]);
  const [spokespersons, setSpokespersons] = useState<TeamMember[]>([]);
  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [currentTenure, setCurrentTenure] = useState<CouncilTenure | null>(null);

  useEffect(() => {
    setCurrentTenure(getCurrentTenure());
    setCouncilMembers(getStoredCouncilMembers());
    setHostingMembers(getStoredHostingCommittee());
    setSpokespersons(getStoredSpokespersons());
    setClubs(getStoredClubs());

    syncCouncilMembersFromFirestore().then((res) => { if (res) setCouncilMembers(res); });
    syncHostingCommitteeFromFirestore().then((res) => { if (res) setHostingMembers(res); });
    syncSpokespersonsFromFirestore().then((res) => { if (res) setSpokespersons(res); });
    syncClubsFromFirestore().then((res) => { if (res) setClubs(res); });

    const unsubCouncil = subscribeToCouncilMembers((remote) => setCouncilMembers(remote));
    const unsubHosting = subscribeToHostingCommittee((remote) => setHostingMembers(remote));
    const unsubSpokes = subscribeToSpokespersons((remote) => setSpokespersons(remote));
    const unsubClubs = subscribeToClubs((remote) => setClubs(remote));

    const handleUpdate = () => {
      setCurrentTenure(getCurrentTenure());
      setCouncilMembers(getStoredCouncilMembers());
      setHostingMembers(getStoredHostingCommittee());
      setSpokespersons(getStoredSpokespersons());
      setClubs(getStoredClubs());
    };

    window.addEventListener("src_tenures_updated", handleUpdate);
    window.addEventListener("src_tenure_changed", handleUpdate);
    window.addEventListener("src_council_team_updated", handleUpdate);
    window.addEventListener("src_hosting_updated", handleUpdate);
    window.addEventListener("src_founding_members_updated", handleUpdate);
    window.addEventListener("src_clubs_updated", handleUpdate);

    return () => {
      unsubCouncil();
      unsubHosting();
      unsubSpokes();
      unsubClubs();
      window.removeEventListener("src_tenures_updated", handleUpdate);
      window.removeEventListener("src_tenure_changed", handleUpdate);
      window.removeEventListener("src_council_team_updated", handleUpdate);
      window.removeEventListener("src_hosting_updated", handleUpdate);
      window.removeEventListener("src_founding_members_updated", handleUpdate);
      window.removeEventListener("src_clubs_updated", handleUpdate);
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
    return list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [hostingMembers, spokespersons]);

  const sortedHostingMembers = unifiedHostingMembers;

  const sortedCouncilMembers = React.useMemo(() => {
    return [...councilMembers].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [councilMembers]);

  // Club Heads & Co-Heads converted to standard TeamMember cards
  const clubLeadMembers = React.useMemo(() => {
    const list: TeamMember[] = [];
    clubs.forEach((club, clubIndex) => {
      const leaders = getClubLeaders(club);
      leaders.forEach((leader, leaderIndex) => {
        if (leader && (leader.name || leader.role)) {
          const isCoLead = leader.roleType === "coLead" || (leader.role && leader.role.toLowerCase().includes("co-head"));
          list.push({
            id: leader.id || `${club.id || club.slug}-leader-${leaderIndex}`,
            name: leader.name || (isCoLead ? `${club.name} Co-Head` : `${club.name} Head`),
            role: leader.role || (isCoLead ? `${club.name} Co-Head` : `${club.name} Head`),
            level: club.name,
            category: "Clubs Leadership",
            clubSlug: club.slug,
            department: leader.department || "JDCOEM Nagpur",
            year: leader.year || (isCoLead ? "3rd Year" : "4th Year"),
            avatar: leader.avatar || (isCoLead ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop" : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop"),
            bio: leader.bio || (isCoLead ? `Co-leading ${club.name} logistics, rehearsals, member coordination, and event execution.` : `Leading ${club.name} activities, workshops, productions, and student talent mentorship.`),
            email: leader.email || (isCoLead ? `src.${club.slug}.cohead${leaderIndex > 1 ? leaderIndex : ""}@jdcoem.ac.in` : `src.${club.slug}.head@jdcoem.ac.in`),
            linkedin: leader.linkedin || "https://www.linkedin.com/company/src-jdcoem/",
            order: clubIndex * 10 + leaderIndex + 1
          });
        }
      });
    });
    return list;
  }, [clubs]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 space-y-20">
      <div className="max-w-7xl mx-auto space-y-20">
        
        {/* Page Header */}
        <div className="space-y-4 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="orange" size="md">
              LEADERSHIP & GOVERNANCE
            </Badge>
            {currentTenure && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-[#17458F] text-white shadow-xs">
                <span>{currentTenure.tenureNumber ? `${currentTenure.tenureNumber} (${currentTenure.label})` : `Tenure ${currentTenure.label}`}</span>
                {currentTenure.isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </span>
            )}
            <Link
              href="/archive"
              className="text-xs font-bold text-[#E78023] hover:underline flex items-center gap-1 ml-2"
            >
              <span>Tenures Archive &rarr;</span>
            </Link>
          </div>
          <h1 className="font-extrabold text-4xl sm:text-6xl text-[#0F172A] tracking-tight uppercase leading-none font-heading">
            THE PEOPLE
            <br />
            <span className="text-[#E78023]">BEHIND SAHASTRADEEP.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            Meet the {councilMembers.length} Admins, {clubLeadMembers.length} Heads &amp; Co-Heads, and {unifiedHostingMembers.length} Hosting Committee members steering JDCOEM Nagpur in Tenure {currentTenure?.label || "2025-26"}.
          </p>
        </div>

        {/* INSTITUTIONAL PATRONS & FACULTY MENTORS (4 PILLARS OF STRENGTH OF SRC) */}
        <PillarsOfStrengthSection />

        {/* SECTION 1: SRC ADMIN POSITIONS */}
        <section className="space-y-8">
          <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Admins</span>
              </span>
              <h2 className="font-extrabold text-2xl sm:text-4xl text-[#17458F] uppercase">
                {councilMembers.length} ADMIN POSITIONS
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                The central leadership body authorized under JDCOEM student bylaws.
              </p>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {sortedCouncilMembers.map((member) => (
              <CouncilMemberCard key={member.id} member={member} categoryLabel="ADMIN" />
            ))}
          </div>

          {councilMembers.length === 0 && (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs">
              No admins listed yet.
            </div>
          )}
        </section>

        {/* SECTION 2: HOSTING COMMITTEE (COUNCIL SPOKESPERSONS & STAGE ANCHORS) */}
        {sortedHostingMembers.length > 0 && (
          <section className="space-y-8 pt-8 border-t border-slate-200">
            <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4" />
                  <span>Stage Convocations & Student Representation</span>
                </span>
                <h2 className="font-extrabold text-2xl sm:text-4xl text-[#17458F] uppercase">
                  HOSTING COMMITTEE ({sortedHostingMembers.length})
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Official council spokespersons, stage anchors, and emcees representing student voices and live event moderation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {sortedHostingMembers.map((member) => (
                <CouncilMemberCard key={member.id} member={member} categoryLabel="HOSTING" />
              ))}
            </div>
          </section>
        )}

        {/* SECTION 3: CHARTERED CLUBS HEADS & CO-HEADS */}
        {clubLeadMembers.length > 0 && (
          <section className="space-y-8 pt-8 border-t border-slate-200">
            <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Club Leadership</span>
                </span>
                <h2 className="font-extrabold text-2xl sm:text-4xl text-[#17458F] uppercase">
                  HEADS &amp; CO-HEADS ({clubLeadMembers.length})
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Club Heads and Co-Heads orchestrating workshops, hackathons, productions, and competitions across all 12 chartered societies.
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

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {clubLeadMembers.map((member) => (
                <CouncilMemberCard key={member.id} member={member} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
