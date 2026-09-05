"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, ArrowRight, Calendar, Inbox } from "lucide-react";
import { EventCard } from "@/components/events/EventCard";
import { EventItem } from "@/types";
import { getStoredEvents, syncEventsFromFirestore, subscribeToEvents } from "@/lib/eventsStore";
import LeadershipSpotlightSection from "./LeadershipSpotlightSection";

export default function HomeEventsSection() {
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    const cached = getStoredEvents();
    if (cached && cached.length > 0) {
      setEventsList(cached);
      setIsSyncing(false);
    }

    syncEventsFromFirestore().then((res) => {
      if (res && res.length > 0) setEventsList(res);
      setIsSyncing(false);
    }).catch(() => {
      setIsSyncing(false);
    });

    const unsubscribe = subscribeToEvents((remoteEvents) => {
      if (remoteEvents && remoteEvents.length > 0) {
        setEventsList(remoteEvents);
      }
      setIsSyncing(false);
    });

    const handleUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setEventsList(e.detail);
      } else {
        setEventsList(getStoredEvents());
      }
      setIsSyncing(false);
    };

    window.addEventListener("src_events_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener("src_events_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const liveEvents = eventsList.filter(e => e.isLive !== false && e.status !== 'draft');
  const featuredEvent = liveEvents[0];
  const otherEvents = liveEvents.slice(1);

  if (liveEvents.length === 0) {
    if (isSyncing) {
      return (
        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200 bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
              <div className="space-y-2">
                <div className="h-4 w-44 bg-slate-200/80 rounded-md animate-pulse" />
                <div className="h-8 w-64 bg-slate-200/80 rounded-lg animate-pulse" />
                <div className="h-4 w-80 bg-slate-100 rounded-md animate-pulse" />
              </div>
            </div>
            <div className="h-96 w-full rounded-3xl bg-white border border-slate-200/80 shadow-sm animate-pulse p-8 flex flex-col justify-end">
              <div className="space-y-3 max-w-lg">
                <div className="h-6 w-32 bg-slate-200/80 rounded-full" />
                <div className="h-8 w-72 bg-slate-200/80 rounded-xl" />
                <div className="h-4 w-full bg-slate-100 rounded-md" />
              </div>
            </div>
          </div>
        </section>
      );
    }
    return <LeadershipSpotlightSection />;
  }

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto space-y-12">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#E78023]" />
              <span className="text-xs font-sans font-semibold uppercase tracking-wider text-[#E78023]">
                Flagship Council Showcase
              </span>
            </div>
            <h2 className="font-section text-3xl sm:text-4xl text-[#0F172A] tracking-tight uppercase">
              WHAT&apos;S HAPPENING
            </h2>
            <p className="text-sm text-slate-600 max-w-xl font-sans font-normal">
              {featuredEvent 
                ? `Experience ${featuredEvent.name} and upcoming flagship showcases hosted by the Student Representative Council.`
                : "Experience campus fests and upcoming flagship events hosted by the Student Representative Council."}
            </p>
          </div>

          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-sans font-semibold uppercase tracking-wider text-[#17458F] hover:text-[#E78023] transition-colors"
          >
            <span>Explore All Events</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Featured Large Hero Card */}
        {featuredEvent && (
          <EventCard event={featuredEvent} featuredLayout={true} />
        )}

        {/* Supporting Grid if multiple events are added */}
        {otherEvents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {otherEvents.map((evt) => (
              <EventCard key={evt.id || evt.slug} event={evt} />
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
