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
  AlertCircle
} from "lucide-react";
import { mockEvents } from "@/data/events";
import { getStoredEvents, syncEventsFromFirestore, subscribeToEvents } from "@/lib/eventsStore";
import { EventItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Accordion } from "@/components/ui/Accordion";
import { ScheduleTimeline } from "@/components/events/ScheduleTimeline";
import { PrizeCard } from "@/components/events/PrizeCard";

export default function EventDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [event, setEvent] = useState<EventItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const findEvent = (allEvents: EventItem[], targetSlug: string): EventItem | null => {
    if (!targetSlug) return null;
    const cleanSlug = targetSlug.toLowerCase().trim();
    return (
      allEvents.find(
        (e) =>
          e.slug === cleanSlug ||
          e.id === cleanSlug ||
          e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === cleanSlug ||
          e.name.toLowerCase() === decodeURIComponent(cleanSlug).toLowerCase()
      ) || null
    );
  };

  useEffect(() => {
    if (!slug) return;

    // 1. Check local stored events + fallback mock events
    const stored = getStoredEvents();
    const combined = [...stored, ...mockEvents];
    const match = findEvent(combined, slug);

    if (match) {
      setEvent(match);
      setIsLoading(false);
    }

    // 2. Fetch latest from Firestore in case event was just created on another device
    syncEventsFromFirestore().then((remote) => {
      if (remote) {
        const remoteMatch = findEvent([...remote, ...mockEvents], slug);
        if (remoteMatch) {
          setEvent(remoteMatch);
        }
      }
      setIsLoading(false);
    });

    const unsub = subscribeToEvents((remoteEvents) => {
      if (remoteEvents) {
        const remoteMatch = findEvent([...remoteEvents, ...mockEvents], slug);
        if (remoteMatch) {
          setEvent(remoteMatch);
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

  const ruleAccordionItems = (event.rules || []).map((rule, idx) => ({
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

            {/* WHAT TO EXPECT */}
            {event.whatToExpect && event.whatToExpect.length > 0 && (
              <section className="space-y-6">
                <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                  WHAT TO EXPECT
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {event.whatToExpect.map((item, index) => (
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
            )}

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
                  <span className="text-[10px] text-slate-400">Portrait 3:4</span>
                </div>
                <div className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden border border-slate-100 shadow-xs group">
                  <Image
                    src={event.posterImage || event.poster}
                    alt={`${event.name} Official Poster`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>
            )}

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
          </div>

        </div>
      </div>
    </div>
  );
}
