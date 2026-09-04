"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { 
  ArrowLeft, 
  AlertCircle, 
  Layers, 
  Calendar, 
  Trophy, 
  Users, 
  ArrowRight, 
  Sparkles 
} from "lucide-react";
import { mockEvents } from "@/data/events";
import { getStoredEvents, syncEventsFromFirestore } from "@/lib/eventsStore";
import { EventItem } from "@/types";
import { RegistrationWizard } from "@/components/registration/RegistrationWizard";
import { Badge } from "@/components/ui/Badge";

export default function EventRegisterPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [event, setEvent] = useState<EventItem | null>(null);
  const [subEvents, setSubEvents] = useState<EventItem[]>([]);
  const [selectedSubEvent, setSelectedSubEvent] = useState<EventItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const findEvent = (allEvents: EventItem[], targetSlug: string): EventItem | null => {
    if (!targetSlug) return null;
    const cleanSlug = targetSlug.toLowerCase().trim();
    return (
      allEvents.filter(e => e.isLive !== false && e.status !== 'draft').find(
        (e) =>
          e.slug === cleanSlug ||
          e.id === cleanSlug ||
          e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === cleanSlug ||
          e.name.toLowerCase() === decodeURIComponent(cleanSlug).toLowerCase()
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
      setEvent(match);
      setSubEvents(findSubEvents(combined, match));
      setIsLoading(false);
    }

    // 2. Fetch latest from Firestore in case event was just created
    syncEventsFromFirestore().then((remote) => {
      if (remote) {
        const pool = [...remote, ...mockEvents];
        const remoteMatch = findEvent(pool, slug);
        if (remoteMatch) {
          setEvent(remoteMatch);
          setSubEvents(findSubEvents(pool, remoteMatch));
        }
      }
      setIsLoading(false);
    });
  }, [slug]);

  if (isLoading && !event) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 border-3 border-[#17458F] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Loading Registration Portal...
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
            Could not initialize registration portal for <code className="font-mono text-[#17458F] font-bold">/{slug}</code>.
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

  const isUmbrella = Boolean(event.isParentFest || subEvents.length > 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={`/events/${event.slug}`}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-[#E78023] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {event.name} Details</span>
          </Link>

          <div className="flex items-center gap-2">
            <Badge variant="orange" size="sm">
              LIVE REGISTRATION
            </Badge>
          </div>
        </div>

        {/* SCENARIO A: UMBRELLA FESTIVAL WITH SUB-EVENTS (USER MUST SELECT WHICH COMPETITION) */}
        {isUmbrella && !selectedSubEvent ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* Umbrella Header Banner */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#17458F] via-[#123670] to-slate-900 text-white space-y-3 shadow-md">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Layers className="w-3.5 h-3.5" />
                <span>Umbrella Festival Registration</span>
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-4xl uppercase tracking-tight text-white">
                {event.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-200 font-medium max-w-2xl leading-relaxed">
                {event.name} is the central umbrella festival hosting {subEvents.length} specialized competition{subEvents.length === 1 ? "" : "s"} and segments. 
                Please choose which specific competition you wish to register for below.
              </p>
            </div>

            {/* Sub-Events Selection Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E78023]" />
                  <span>Choose Your Competition ({subEvents.length} Segments Available)</span>
                </h2>
                <span className="text-xs text-slate-500 font-medium">
                  Step 1 of 2: Select Segment
                </span>
              </div>

              {subEvents.length === 0 ? (
                <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 mx-auto flex items-center justify-center text-slate-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading font-bold text-base text-slate-800">
                    No Sub-Competitions Listed Yet
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Competitions and segments under {event.name} are currently being published by the organizing council. Check back shortly!
                  </p>
                  <Link
                    href={`/events/${event.slug}`}
                    className="inline-block text-xs font-bold text-[#17458F] hover:underline pt-2"
                  >
                    &larr; Return to {event.name} Details
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {subEvents.map((sub) => {
                    const topPrize = sub.prizes && sub.prizes[0] ? sub.prizes[0].amount : null;
                    return (
                      <div
                        key={sub.id}
                        className="rounded-3xl bg-white border border-slate-200 hover:border-[#17458F] p-6 flex flex-col justify-between space-y-5 hover:shadow-xl transition-all group"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#E78023] text-white">
                              {sub.category}
                            </span>
                            {sub.subEventBadge && (
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-900 text-white">
                                {sub.subEventBadge}
                              </span>
                            )}
                          </div>

                          <h3 className="font-heading font-extrabold text-xl text-[#0F172A] uppercase group-hover:text-[#17458F] transition-colors">
                            {sub.name}
                          </h3>

                          {sub.tagline && (
                            <p className="text-xs text-slate-500 font-medium line-clamp-2">
                              {sub.tagline}
                            </p>
                          )}

                          <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-600 font-medium">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-[#E78023]" />
                              <span>{sub.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-[#17458F]" />
                              <span>Format: {sub.teamType || "Individual"} {sub.maxTeamSize ? `(Max ${sub.maxTeamSize})` : ""}</span>
                            </div>
                            {topPrize && (
                              <div className="flex items-center gap-2 text-[#17458F] font-bold">
                                <Trophy className="w-3.5 h-3.5 text-[#E78023]" />
                                <span>Prize Pool: {topPrize}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Entry Fee</span>
                            <span className="text-xs font-extrabold text-emerald-600">
                              {sub.isPaid && sub.feeAmount ? `₹${sub.feeAmount}` : "Free Entry"}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedSubEvent(sub)}
                            className="px-5 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Select &amp; Register</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* SCENARIO B: ACTIVE REGISTRATION FORM (EITHER DIRECT SUB-EVENT OR SELECTED SUB-EVENT OR STANDALONE EVENT) */
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* If selected under an umbrella, show informative switcher banner */}
            {selectedSubEvent && (
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 text-xs">
                  <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    Registering for: <strong className="font-bold text-[#17458F] text-sm">{selectedSubEvent.name}</strong> • Competition under <strong>{event.name}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSubEvent(null)}
                  className="text-xs font-bold text-[#E78023] hover:underline self-start sm:self-center cursor-pointer"
                >
                  &larr; Change Competition
                </button>
              </div>
            )}

            {/* Header Title */}
            <div className="text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
                SRC Official Event Accreditation
              </span>
              <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-[#0F172A] tracking-tight uppercase">
                {selectedSubEvent ? selectedSubEvent.name : event.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {selectedSubEvent ? `${selectedSubEvent.date} • Part of ${event.name}` : `${event.date} • ${event.venue}`}
              </p>
            </div>

            {/* Multi-Step Registration Wizard Form */}
            <RegistrationWizard 
              event={
                selectedSubEvent 
                  ? {
                      ...selectedSubEvent,
                      parentEventName: event.name,
                      parentEventId: event.id,
                      parentEventSlug: event.slug,
                    }
                  : event
              } 
            />
          </div>
        )}

      </div>
    </div>
  );
}
