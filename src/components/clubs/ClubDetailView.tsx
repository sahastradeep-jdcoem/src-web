"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Users, 
  UserCheck,
  Sparkles, 
  Calendar, 
  ArrowLeft, 
  ArrowRight, 
  Award, 
  CheckCircle2, 
  Compass, 
  Image as ImageIcon 
} from "lucide-react";
import { getStoredClubs, syncClubsFromFirestore, subscribeToClubs, getClubLeaders, findClub } from "@/lib/councilStore";
import { getStoredEvents, syncEventsFromFirestore, subscribeToEvents } from "@/lib/eventsStore";
import { findStudentByBtId, checkBtIdPositionConflict } from "@/lib/usersStore";
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
  const [events, setEvents] = useState<EventItem[]>(clubEvents);

  // Strictly filter out any officers from public member display
  const displayMembers = useMemo(() => {
    if (!club.members || !Array.isArray(club.members)) return [];
    return club.members.filter((m) => {
      const conflict = checkBtIdPositionConflict(m.btId, club.slug || club.id);
      return !conflict.isOfficer;
    });
  }, [club.members, club.slug, club.id]);

  useEffect(() => {
    const applyClub = (list: ClubItem[]) => {
      const found =
        findClub(list, initialClub.slug) ||
        findClub(list, initialClub.id) ||
        list.find((c) => c.slug === initialClub.slug || c.id === initialClub.id);
      if (found) {
        setClub((prev) => {
          if (prev?.logoImage && !found.logoImage) {
            return { ...found, logoImage: prev.logoImage };
          }
          return found;
        });
      }
    };

    applyClub(getStoredClubs());

    syncClubsFromFirestore().then((res) => {
      if (res) applyClub(res);
    });

    const unsubscribe = subscribeToClubs((remoteClubs) => {
      applyClub(remoteClubs);
    });

    const handleUpdate = () => {
      applyClub(getStoredClubs());
    };

    window.addEventListener("src_clubs_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener("src_clubs_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [initialClub]);

  useEffect(() => {
    const applyEvents = (list: EventItem[]) => {
      const filtered = list.filter(
        (e) =>
          !e.parentEventId &&
          !e.parentEventSlug &&
          (e.organizerClubSlug === club.slug ||
          (club.slug === "agentic-ai" && (e.organizerClubSlug === "robotics" || e.organizerClubSlug === "club-robotics")) ||
          (club.slug === "robotics" && (e.organizerClubSlug === "agentic-ai" || e.organizerClubSlug === "club-1788779206223")) ||
          e.organizerClubSlug === club.id ||
          e.collaboratingClubs?.some(
            (c) =>
              c.slug === club.slug ||
              (club.slug === "agentic-ai" && c.slug === "robotics") ||
              (club.slug === "robotics" && c.slug === "agentic-ai")
          ))
      );
      setEvents(filtered);
    };

    applyEvents(getStoredEvents());
    syncEventsFromFirestore().then((remote) => {
      if (remote) applyEvents(remote);
    });
    const unsubEvents = subscribeToEvents((remote) => {
      applyEvents(remote);
    });
    const handleEventsUpdate = (e?: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        applyEvents(e.detail);
      } else {
        applyEvents(getStoredEvents());
      }
    };
    window.addEventListener("src_events_updated", handleEventsUpdate);

    return () => {
      unsubEvents();
      window.removeEventListener("src_events_updated", handleEventsUpdate);
    };
  }, [club.slug]);

  const allLeaders = getClubLeaders(club);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-20">
      
      {/* 1. CINEMATIC HERO */}
      <section className="relative h-[50vh] sm:h-[55vh] flex items-end pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-slate-900">
        <Image
          src={club.headerImage || club.heroImage}
          alt={club.name}
          fill
          priority
          unoptimized={true}
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

          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {club.logoImage && (
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shrink-0 shadow-md">
                <Image
                  src={club.logoImage}
                  alt={`${club.name} Logo`}
                  fill
                  unoptimized={true}
                  className="object-cover w-full h-full rounded-full"
                />
              </div>
            )}

            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#E78023] text-white">
                  {club.category}
                </span>
                <span className="text-xs font-bold text-white px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>{Math.max(club.memberCount || 0, displayMembers.length)} Active Members</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allLeaders.map((leader, idx) => {
              const isCoLead = leader.roleType === "coLead" || (leader.role && leader.role.toLowerCase().includes("co-head"));
              return (
                <div key={leader.id || idx} className="p-6 rounded-3xl bg-white border border-slate-200 flex items-center gap-4 shadow-xs">
                  <div className="relative h-16 w-16 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                    {leader.avatar ? (
                      <Image
                        src={leader.avatar}
                        alt={leader.name}
                        fill
                        unoptimized={true}
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-slate-500">
                        {(leader.name || "CH").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isCoLead ? "text-[#17458F]" : "text-[#E78023]"}`} title={leader.role}>
                      {leader.role || (isCoLead ? `${club.name} Co-Head` : `${club.name} Head`)}
                    </span>
                    <h4 className="font-bold text-base text-[#0F172A] truncate">
                      {leader.name}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium truncate">
                      <span className="sm:hidden">{getDepartmentShortName(leader.department)}</span>
                      <span className="hidden sm:inline">{leader.department}</span>
                      {" "}• {leader.year}
                    </p>
                    {leader.clubNames && leader.clubNames.length > 1 && (
                      <div className="pt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-semibold">Also leads:</span>
                        {leader.clubNames
                          .filter((cn) => cn.trim().toLowerCase() !== club.name.trim().toLowerCase())
                          .map((otherName) => (
                            <span
                              key={otherName}
                              className="text-[9px] font-bold text-[#17458F] px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200"
                            >
                              {otherName}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Club Members Section (Names only, zero photos, strictly non-officers) */}
        {displayMembers.length > 0 && (
          <section className="space-y-6">
            <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-2xl text-[#17458F] uppercase font-heading flex items-center gap-2">
                  <UserCheck className="w-6 h-6 text-[#E78023]" />
                  <span>CLUB MEMBERS</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium pt-1">
                  Official inducted student members contributing to {club.name} activities and workshops.
                </p>
              </div>
              <span className="text-xs font-bold text-[#17458F] bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                {displayMembers.length} {displayMembers.length === 1 ? "Member" : "Members"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayMembers.map((member, idx) => {
                const studentInfo = findStudentByBtId(member.btId);
                const displayName = member.name || studentInfo?.name || "Student Member";
                const displayDept = member.department || studentInfo?.department;
                const displayYear = member.year || studentInfo?.year;

                return (
                  <div
                    key={member.id || member.btId || idx}
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#17458F]/30 hover:shadow-sm transition-all flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#17458F] font-bold text-xs shrink-0 font-mono">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-[#0F172A] truncate" title={displayName}>
                        {displayName}
                      </h4>
                      {(displayDept || displayYear) ? (
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 font-medium truncate">
                          {displayDept && (
                            <span className="truncate">{getDepartmentShortName(displayDept)}</span>
                          )}
                          {displayDept && displayYear && (
                            <span>•</span>
                          )}
                          {displayYear && (
                            <span>{displayYear}</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 font-medium">
                          Inducted Member
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Club Events */}
        {events.length > 0 && (
          <section className="space-y-6">
            <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-2xl text-[#17458F] uppercase font-heading">
                  EVENTS &amp; INITIATIVES
                </h3>
                <p className="text-xs text-slate-500 font-medium pt-1">
                  Official campus showcases organized by or in collaboration with {club.name}.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {events.length} {events.length === 1 ? "Event" : "Events"}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((evt) => (
                <EventCard key={evt.id} event={evt} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
