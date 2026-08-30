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
    return list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [hostingMembers, spokespersons]);

  const sortedHostingMembers = unifiedHostingMembers;

  const sortedCouncilMembers = React.useMemo(() => {
    return [...councilMembers].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [councilMembers]);

  // Club Heads & Co-Heads converted to standard TeamMember cards
  const clubLeadMembers = React.useMemo(() => {
    const list: TeamMember[] = [];
    clubs.forEach((club, index) => {
      if (club.lead) {
        list.push({
          id: `${club.id || club.slug}-lead`,
          name: club.lead.name || `${club.name} Head`,
          role: `${club.name} Head`,
          level: club.name,
          category: "Clubs Leadership",
          clubSlug: club.slug,
          department: club.lead.department || "JDCOEM Nagpur",
          year: club.lead.year || "4th Year",
          avatar: club.lead.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
          bio: club.lead.bio || `Leading ${club.name} activities, workshops, productions, and student talent mentorship.`,
          email: club.lead.email || `src.${club.slug}.head@jdcoem.ac.in`,
          linkedin: club.lead.linkedin || "https://www.linkedin.com/company/src-jdcoem/",
          order: index * 2 + 1
        });
      }
      if (club.coLead && club.coLead.name) {
        list.push({
          id: `${club.id || club.slug}-colead`,
          name: club.coLead.name,
          role: `${club.name} Co-Head`,
          level: club.name,
          category: "Clubs Leadership",
          clubSlug: club.slug,
          department: club.coLead.department || "JDCOEM Nagpur",
          year: club.coLead.year || "3rd Year",
          avatar: club.coLead.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
          bio: club.coLead.bio || `Co-leading ${club.name} logistics, rehearsals, member coordination, and event execution.`,
          email: club.coLead.email || `src.${club.slug}.cohead@jdcoem.ac.in`,
          linkedin: club.coLead.linkedin || "https://www.linkedin.com/company/src-jdcoem/",
          order: index * 2 + 2
        });
      }
    });
    return list;
  }, [clubs]);

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
            Meet the {councilMembers.length} Admins, {clubLeadMembers.length} Heads &amp; Co-Heads, and {unifiedHostingMembers.length} Hosting Committee members steering JDCOEM Nagpur.
          </p>
        </div>

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
              <CouncilMemberCard key={member.id} member={member} />
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
                <CouncilMemberCard key={member.id} member={member} />
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
