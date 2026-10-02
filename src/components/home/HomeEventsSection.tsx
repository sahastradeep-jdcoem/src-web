"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, ArrowRight, Calendar, Sparkles } from "lucide-react";
import { EventCard } from "@/components/events/EventCard";
import { EventItem } from "@/types";
import { 
  getStoredEvents, 
  syncEventsFromFirestore, 
  subscribeToEvents, 
  sortEventsByDate, 
  isSubEvent,
  isEventCompletedByDate 
} from "@/lib/eventsStore";
import { StaggerGrid, StaggerItem } from "@/components/ui/StaggerContainer";
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

  const allLiveEvents = sortEventsByDate(
    eventsList.filter(
      (e) =>
        Boolean(e?.name && typeof e.name === "string" && e.name.trim().length > 0) &&
        e.isLive !== false &&
        e.status !== "draft" &&
        !e.isCancelled &&
        e.status !== "Cancelled" &&
        !isSubEvent(e, eventsList)
    )
  );

  // 1. Separate upcoming active events from completed ones
  const upcomingEvents = allLiveEvents.filter(
    (e) => !isEventCompletedByDate(e) && e.status !== "Completed" && e.status?.toLowerCase() !== "completed"
  );
  const completedEvents = allLiveEvents.filter(
    (e) => isEventCompletedByDate(e) || e.status === "Completed" || e.status?.toLowerCase() === "completed"
  );

  const hasUpcoming = upcomingEvents.length > 0;
  // If upcoming events exist, prioritize them. Otherwise, fall back to recent completed highlights.
  const activePool = hasUpcoming ? upcomingEvents : completedEvents;

  // 2. Featured Event:
  // Priority: event with isFeatured flag, else earliest in the active pool
  const featuredEvent = activePool.find((e) => Boolean(e.isFeatured)) || activePool[0] || null;

  // 3. Supporting Grid: Exactly top 3 events (excluding the featured one)
  const curatedOtherEvents = activePool
    .filter((e) => (e.id || e.slug) !== (featuredEvent?.id || featuredEvent?.slug))
    .slice(0, 3);

  const totalLiveCount = allLiveEvents.length;
  const displayedCount = (featuredEvent ? 1 : 0) + curatedOtherEvents.length;
  const remainingCount = Math.max(0, totalLiveCount - displayedCount);

  if (allLiveEvents.length === 0) {
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
                {hasUpcoming ? "Flagship Council Showcase" : "Past Event Highlights"}
              </span>
            </div>
            <h2 className="font-section text-3xl sm:text-4xl text-[#0F172A] tracking-tight uppercase">
              WHAT&apos;S HAPPENING
            </h2>
            <p className="text-sm text-slate-600 max-w-xl font-sans font-normal">
              {featuredEvent 
                ? (hasUpcoming 
                    ? `Experience ${featuredEvent.name} and upcoming flagship showcases hosted by the Student Representative Council.`
                    : `Explore highlights from ${featuredEvent.name} and council milestones across campus.`)
                : "Experience campus fests and upcoming flagship events hosted by the Student Representative Council."}
            </p>
          </div>

          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-sans font-semibold uppercase tracking-wider text-[#17458F] hover:text-[#E78023] transition-colors"
          >
            <span>Explore All Events ({totalLiveCount})</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Featured Large Hero Card */}
        {featuredEvent && (
          <EventCard event={featuredEvent} featuredLayout={true} />
        )}

        {/* Supporting Grid with Staggered Entrance (Top 3) */}
        {curatedOtherEvents.length > 0 && (
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2" staggerDelay={0.04}>
            {curatedOtherEvents.map((evt) => (
              <StaggerItem key={evt.id || evt.slug}>
                <EventCard event={evt} />
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}

        {/* Discovery CTA Banner to explore full calendar */}
        {remainingCount > 0 && (
          <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-[#17458F] to-slate-900 text-white p-6 sm:p-8 lg:p-10 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#E78023] text-[11px] font-sans font-bold uppercase tracking-wider border border-white/10">
                <Calendar className="w-3.5 h-3.5" />
                <span>Academic Calendar &amp; Archive</span>
              </div>
              <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-white tracking-tight uppercase">
                Looking for more events?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans font-medium">
                {`Discover all ${totalLiveCount} collegiate festivals, departmental competitions, and archived editions on the dedicated events portal.`}
              </p>
            </div>

            <Link
              href="/events"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#E78023] hover:bg-[#d67217] text-white text-xs font-sans font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-lg hover:shadow-[#E78023]/20 shrink-0 group cursor-pointer"
            >
              <span>View All Events ({totalLiveCount})</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}

      </div>
    </section>
  );
}
