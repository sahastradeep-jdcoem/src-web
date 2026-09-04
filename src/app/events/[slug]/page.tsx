"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  CheckCircle2, 
  Phone, 
  Sparkles, 
  Trophy,
  AlertCircle,
  Layers,
  ArrowDown
} from "lucide-react";
import { mockEvents } from "@/data/events";
import { getStoredEvents, syncEventsFromFirestore, subscribeToEvents, sanitizeEventItem } from "@/lib/eventsStore";
import { EventItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Accordion } from "@/components/ui/Accordion";
import { ScheduleTimeline } from "@/components/events/ScheduleTimeline";
import { PrizeCard } from "@/components/events/PrizeCard";

export default function EventDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [event, setEvent] = useState<EventItem | null>(null);
  const [subEvents, setSubEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const findEvent = (allEvents: EventItem[], targetSlug: string): EventItem | null => {
    if (!targetSlug) return null;
    const cleanSlug = targetSlug.toLowerCase().trim();
    return (
      allEvents.filter(e => e.isLive !== false && e.status !== 'draft').find(
        (e) =>
          e.slug === cleanSlug ||
          e.id === cleanSlug ||
          e.id.toLowerCase() === cleanSlug ||
          (e.slug && e.slug.toLowerCase() === cleanSlug) ||
          e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === cleanSlug
      ) || null
    );
  };

  const findSubEvents = (allEvents: EventItem[], parent: EventItem): EventItem[] => {
    return allEvents
      .filter((e) => e.isLive !== false && e.status !== "draft")
      .filter(
        (e) =>
          e.id !== parent.id &&
          ((e.parentEventId && (e.parentEventId === parent.id || e.parentEventId === parent.slug)) ||
           (e.parentEventSlug && (e.parentEventSlug === parent.slug || e.parentEventSlug === parent.id)) ||
           (e.parentEventName && e.parentEventName.toLowerCase().trim() === parent.name.toLowerCase().trim()))
      );
  };

  useEffect(() => {
    if (!slug) return;

    // 1. Check local stored events + fallback mock events
    const stored = getStoredEvents();
    const combined = [...stored, ...mockEvents];
    const match = findEvent(combined, slug);

    if (match) {
      const cleanMatch = sanitizeEventItem(match);
      setEvent(cleanMatch);
      setSubEvents(findSubEvents(combined, cleanMatch));
      setIsLoading(false);
    }

    // 2. Fetch latest from Firestore in case event was just created on another device
    syncEventsFromFirestore().then((remote) => {
      if (remote) {
        const remoteCombined = [...remote, ...mockEvents];
        const remoteMatch = findEvent(remoteCombined, slug);
        if (remoteMatch) {
          const cleanRemoteMatch = sanitizeEventItem(remoteMatch);
          setEvent(cleanRemoteMatch);
          setSubEvents(findSubEvents(remoteCombined, cleanRemoteMatch));
        }
      }
      setIsLoading(false);
    });

    const unsub = subscribeToEvents((remoteEvents) => {
      if (remoteEvents) {
        const streamCombined = [...remoteEvents, ...mockEvents];
        const streamMatch = findEvent(streamCombined, slug);
        if (streamMatch) {
          const cleanStreamMatch = sanitizeEventItem(streamMatch);
          setEvent(cleanStreamMatch);
          setSubEvents(findSubEvents(streamCombined, cleanStreamMatch));
        }
      }
    });

    return () => {
      unsub();
    };
  }, [slug]);

  if (isLoading && !event) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 border-3 border-[#17458F] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Loading Event Details...
        </p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-[70vh] bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 text-[#E78023]">
          <AlertCircle className="w-10 h-10 mx-auto" />
        </div>
        <div className="space-y-2 max-w-md">
          <h1 className="font-heading font-extrabold text-2xl text-[#0F172A] uppercase">
            Event Not Found
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed font-sans">
            The event <code className="font-mono text-[#17458F] font-bold">/{slug}</code> could not be found or may have been updated.
          </p>
        </div>
        <Link
          href="/events"
          className="px-6 py-3 rounded-2xl bg-[#17458F] text-white text-xs font-bold uppercase tracking-wider transition-all hover:bg-[#123670] shadow-sm"
        >
          &larr; Browse All Events
        </Link>
      </div>
    );
  }

  const isRegistrationOpen = event.status === "Registration Open";

  const displayRules = Array.from(
    new Set((event.rules || []).map((s) => (typeof s === "string" ? s.trim() : s)).filter(Boolean))
  );

  const ruleAccordionItems = displayRules.map((rule, idx) => ({
    id: `rule-${idx}`,
    title: `Regulation 0${idx + 1}: ${rule.slice(0, 45)}...`,
    content: rule,
  }));

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-20 font-sans">
      
      {/* 1. CINEMATIC HERO BANNER */}
      <section className="relative h-[55vh] sm:h-[60vh] flex items-end pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-slate-900">
        {/* Cinematic Background Backdrop Banner */}
        <Image
          src={event.headerImage || event.cardImage || event.poster || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1920&auto=format&fit=crop"}
          alt={event.name}
          fill
          priority
          unoptimized={true}
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="max-w-7xl mx-auto w-full relative z-10 space-y-6">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-[#E78023] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Events</span>
          </Link>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#E78023] text-white shadow-xs">
                {event.category}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/90 text-slate-900 shadow-xs">
                {event.status}
              </span>
              {event.parentEventName && (
                <Link
                  href={`/events/${event.parentEventSlug || event.parentEventId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-xs transition-colors shadow-xs"
                >
                  <Layers className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Part of {event.parentEventName}</span>
                  <ArrowRight className="w-3 h-3 text-white/70" />
                </Link>
              )}
              {event.subEventBadge && (
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-900/80 text-white border border-white/20 shadow-xs">
                  {event.subEventBadge}
                </span>
              )}
              {event.tagline && (
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#E78023] ml-2">
                  • {event.tagline}
                </span>
              )}
            </div>

            <h1 className="font-heading font-extrabold text-4xl sm:text-6xl text-white tracking-tight uppercase">
              {event.name}
            </h1>
          </div>

          {/* Quick Info Bar */}
          <div className="flex flex-wrap items-center gap-6 sm:gap-8 pt-4 border-t border-white/20 text-xs sm:text-sm text-slate-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#E78023] shrink-0" />
              <span className="font-bold text-white">{event.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-300 shrink-0" />
              <span>{event.time || "10:00 AM IST"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E78023] shrink-0" />
              <span>{event.venue || "JDCOEM Campus"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-300 shrink-0" />
              <span>Organized by: <strong className="text-white">{event.organizer}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MAIN CONTENT & STICKY REGISTRATION PANEL */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          
          {/* Left 2 Columns: Detailed Sections */}
          <div className="lg:col-span-2 space-y-16">
            
            {/* ABOUT */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#E78023]">
                <Sparkles className="w-4 h-4" />
                <span>Overview</span>
              </div>
              <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                ABOUT THE EVENT
              </h2>
              <p className="text-slate-700 leading-relaxed text-sm sm:text-base font-medium font-sans">
                {event.about || event.description}
              </p>
            </section>

            {/* DYNAMIC FESTIVAL SUB-EVENTS & COMPETITIONS */}
            {subEvents.length > 0 && (
              <section id="competitions" className="space-y-6 pt-6 border-t border-slate-200 scroll-mt-24">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    <span>Festival Lineup &amp; Segments</span>
                  </span>
                  <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                    Competitions Under {event.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Explore specialized competitions, pageants, and tournaments happening under {event.name}. Each competition features dedicated prizes and rules.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {subEvents.map((sub) => {
                    const topPrize = sub.prizes && sub.prizes[0] ? sub.prizes[0].amount : null;
                    return (
                      <div
                        key={sub.id}
                        className="group relative rounded-3xl bg-white border border-slate-200 p-5 flex flex-col justify-between hover:border-[#17458F] hover:shadow-lg transition-all"
                      >
                        <div className="space-y-4">
                          <div className="relative h-44 rounded-2xl overflow-hidden bg-slate-100">
                            <Image
                              src={sub.cardImage || sub.poster || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop"}
                              alt={sub.name}
                              fill
                              unoptimized={true}
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute top-3 left-3 flex items-center gap-1.5">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#E78023] text-white shadow-xs">
                                {sub.category}
                              </span>
                              {sub.subEventBadge && (
                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-900/80 text-white backdrop-blur-xs shadow-xs">
                                  {sub.subEventBadge}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <h3 className="font-heading font-extrabold text-lg text-[#0F172A] uppercase group-hover:text-[#17458F] transition-colors">
                              {sub.name}
                            </h3>
                            {sub.tagline && (
                              <p className="text-xs text-slate-500 line-clamp-1 font-medium">
                                {sub.tagline}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#E78023]" />
                              <span>{sub.date}</span>
                            </div>
                            {topPrize && (
                              <div className="flex items-center gap-1 text-[#17458F] font-bold">
                                <Trophy className="w-3.5 h-3.5 text-[#E78023]" />
                                <span>Prize: {topPrize}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-700">
                            {sub.isPaid && sub.feeAmount ? `₹${sub.feeAmount}` : "Free Entry"}
                          </span>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/events/${sub.slug}`}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                              Details
                            </Link>
                            <Link
                              href={`/events/${sub.slug}/register`}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
                            >
                              <span>Register</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* WHAT TO EXPECT */}
            {(() => {
              const displayExpect = Array.from(
                new Set((event.whatToExpect || []).map((s) => (typeof s === "string" ? s.trim() : s)).filter(Boolean))
              );
              if (displayExpect.length === 0) return null;
              return (
                <section className="space-y-6">
                  <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                    WHAT TO EXPECT
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {displayExpect.map((item, index) => (
                      <div
                        key={index}
                        className="p-5 rounded-2xl bg-white border border-slate-200 flex items-start gap-3.5 shadow-xs"
                      >
                        <CheckCircle2 className="w-5 h-5 text-[#E78023] shrink-0 mt-0.5" />
                        <p className="text-xs sm:text-sm text-slate-700 leading-snug font-medium">{item}</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}

            {/* SCHEDULE TIMELINE */}
            {event.schedule && event.schedule.length > 0 && (
              <section className="space-y-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
                    Event Sequence
                  </span>
                  <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                    SCHEDULE &amp; ITINERARY
                  </h2>
                </div>
                <ScheduleTimeline schedule={event.schedule} />
              </section>
            )}

            {/* PRIZES & RECOGNITION */}
            {event.prizes && event.prizes.length > 0 && (
              <section className="space-y-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                    <Trophy className="w-4 h-4" />
                    <span>Rewards &amp; Laurels</span>
                  </span>
                  <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                    PRIZES &amp; RECOGNITION
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {event.prizes.map((prize, idx) => (
                    <PrizeCard key={idx} prize={prize} index={idx} />
                  ))}
                </div>
              </section>
            )}

            {/* RULES & GUIDELINES ACCORDION */}
            {ruleAccordionItems && ruleAccordionItems.length > 0 && (
              <section className="space-y-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
                    Official Code of Conduct
                  </span>
                  <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                    RULES &amp; GUIDELINES
                  </h2>
                </div>
                <Accordion items={ruleAccordionItems} />
              </section>
            )}

          </div>

          {/* Right Column: Sticky Registration Card & Official Poster */}
          <div className="lg:sticky lg:top-24 space-y-6">
            
            {/* Official Event Notice Poster */}
            {(event.posterImage || event.poster) && (
              <div className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">
                  <span className="flex items-center gap-1.5 text-[#17458F]">
                    <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                    Official Event Poster
                  </span>
                </div>
                <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden border border-slate-100 shadow-xs group">
                  <Image
                    src={event.posterImage || event.poster}
                    alt={`${event.name} Official Poster`}
                    fill
                    unoptimized={true}
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>
            )}

            {event.isParentFest || subEvents.length > 0 ? (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-xl shadow-slate-200/50 space-y-6 relative overflow-hidden">
                {/* Brand top accent gradient stripe */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#17458F] via-[#E78023] to-[#17458F]" />

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#17458F]/10 text-[#17458F] border border-[#17458F]/20 inline-flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-[#E78023]" />
                      <span>UMBRELLA FESTIVAL</span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Registrations Open
                    </span>
                  </div>

                  <h3 className="font-heading font-extrabold text-2xl text-[#0F172A] tracking-tight">
                    Festival Competitions
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {event.name} hosts <strong className="text-slate-800 font-semibold">{subEvents.length} specialized competition{subEvents.length === 1 ? "" : "s"}</strong>. Choose a competition to configure your category and official delegate entry.
                  </p>
                </div>

                {/* Specs Breakdown */}
                <div className="space-y-2.5 pt-4 border-t border-slate-100 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100/80">
                    <span className="text-slate-500 font-medium">Active Competitions</span>
                    <span className="font-bold text-[#17458F] font-mono px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100/80">
                      {subEvents.length} {subEvents.length === 1 ? "Segment" : "Segments"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100/80">
                    <span className="text-slate-500 font-medium">Festival Date</span>
                    <span className="font-bold text-slate-900">{event.date}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100/80">
                    <span className="text-slate-500 font-medium">Festival Venue</span>
                    <span className="font-bold text-slate-900 truncate max-w-[170px] text-right">{event.venue}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 font-medium">Entry Authorization</span>
                    <span className="font-bold text-[#E78023] flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Official Delegate Pass
                    </span>
                  </div>
                </div>

                {/* Action Buttons: Enhanced Pro Max CTA Stack */}
                {subEvents.length > 0 ? (
                  <div className="space-y-2.5 pt-1">
                    {/* Primary High-Impact CTA: Choose Competition & Register */}
                    <Link
                      href={`/events/${event.slug}/register`}
                      className="group relative w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-[#E78023] via-[#F28E2B] to-[#D26E17] hover:brightness-105 active:scale-[0.98] text-white text-xs sm:text-sm font-bold uppercase tracking-wider text-center transition-all shadow-lg shadow-[#E78023]/25 hover:shadow-xl hover:shadow-[#E78023]/35 flex items-center justify-between cursor-pointer overflow-hidden"
                    >
                      {/* Interactive shimmer sweep on hover */}
                      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
                      
                      <div className="flex items-center gap-3 text-left relative z-10">
                        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                          <Sparkles className="w-4 h-4 text-amber-100" />
                        </div>
                        <div>
                          <div className="font-extrabold text-white leading-tight tracking-wide text-xs sm:text-sm">
                            Register for Competition
                          </div>
                          <div className="text-[10px] text-white/85 font-medium lowercase tracking-normal">
                            select from {subEvents.length} active {subEvents.length === 1 ? "event" : "events"}
                          </div>
                        </div>
                      </div>

                      <div className="w-8 h-8 rounded-xl bg-white/20 group-hover:bg-white/30 flex items-center justify-center shrink-0 transition-all relative z-10">
                        <ArrowRight className="w-4 h-4 text-white transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>

                    {/* Secondary Clean CTA: Quick Jump to Lineup & Details */}
                    <a
                      href="#competitions"
                      className="w-full py-3 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200/80 border border-slate-200 text-[#17458F] text-xs font-bold uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#17458F]" />
                      <span>Explore Lineup &amp; Prizes ({subEvents.length})</span>
                      <ArrowDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5 text-[#E78023]" />
                    </a>
                  </div>
                ) : (
                  <div className="w-full py-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Competitions Announcing Soon</span>
                  </div>
                )}

                {/* Coordinator Contact */}
                {event.coordinatorContact && (
                  <div className="pt-4 border-t border-slate-100 text-xs space-y-1">
                    <span className="text-slate-500 uppercase font-bold text-[10px]">
                      Festival Secretariat
                    </span>
                    <p className="font-semibold text-slate-800">{event.coordinatorContact.name} ({event.coordinatorContact.role})</p>
                    <p className="text-[#E78023] font-bold flex items-center gap-1.5">
                      <Phone className="w-3 h-3" />
                      <span>{event.coordinatorContact.phone}</span>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
                <div className="space-y-2">
                  <Badge variant={isRegistrationOpen ? "orange" : "slate"} size="md">
                    {event.status}
                  </Badge>
                  <h3 className="font-heading font-extrabold text-2xl text-[#0F172A]">
                    Registration Portal
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Secure your official entry pass for {event.name}.
                  </p>
                </div>

                {/* Specs Breakdown */}
                <div className="space-y-3 pt-4 border-t border-slate-100 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Participation Format:</span>
                    <span className="font-bold text-slate-900">{event.teamType || "Individual"}</span>
                  </div>
                  {event.maxTeamSize && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-500">Team Size:</span>
                      <span className="font-bold text-slate-900">{event.minTeamSize || 1} – {event.maxTeamSize} Members</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Registration Closes:</span>
                    <span className="font-bold text-[#E78023]">{event.registrationDeadline || "Open until slots filled"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Fee:</span>
                    <span className="font-bold text-emerald-600">{event.entryFee || "Free Entry"}</span>
                  </div>
                </div>

                {/* Action Button */}
                {isRegistrationOpen ? (
                  <Link
                    href={`/events/${event.slug}/register`}
                    className="w-full py-3.5 rounded-2xl bg-[#E78023] hover:bg-[#D26E17] text-white text-xs sm:text-sm font-bold uppercase tracking-wider text-center transition-all shadow-md shadow-[#E78023]/25 flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <span>REGISTER NOW</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                ) : (
                  <div className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider text-center">
                    Registration Closed
                  </div>
                )}

                {/* Coordinator Contact */}
                {event.coordinatorContact && (
                  <div className="pt-4 border-t border-slate-100 text-xs space-y-1">
                    <span className="text-slate-500 uppercase font-bold text-[10px]">
                      Event Helpdesk
                    </span>
                    <p className="font-semibold text-slate-800">{event.coordinatorContact.name} ({event.coordinatorContact.role})</p>
                    <p className="text-[#E78023] font-bold flex items-center gap-1.5">
                      <Phone className="w-3 h-3" />
                      <span>{event.coordinatorContact.phone}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
