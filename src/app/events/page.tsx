"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { 
  Search, 
  Calendar, 
  Sparkles, 
  History, 
  ArrowRight,
  Archive
} from "lucide-react";
import { EventCard } from "@/components/events/EventCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { StaggerGrid, StaggerItem } from "@/components/ui/StaggerContainer";
import { EventCardSkeleton } from "@/components/ui/SkeletonCard";
import { 
  getStoredEvents, 
  syncEventsFromFirestore, 
  subscribeToEvents, 
  sortEventsByDate,
  isEventCompletedByDate
} from "@/lib/eventsStore";
import { 
  getPublicTenures, 
  syncTenuresFromFirestore, 
  subscribeToTenures, 
  getCurrentTenure,
  CouncilTenure 
} from "@/lib/tenureStore";
import { EventItem } from "@/types";

export default function EventsPage() {
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [tenuresList, setTenuresList] = useState<CouncilTenure[]>([]);
  const [currentTenureLabel, setCurrentTenureLabel] = useState("2025–26");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const hasSynced = useRef(false);

  const refreshTenures = () => {
    const pub = getPublicTenures();
    setTenuresList(pub);
    const curr = getCurrentTenure();
    if (curr?.label) {
      setCurrentTenureLabel(curr.label);
    }
  };

  useEffect(() => {
    // 1. Show cached localStorage data immediately (0ms load)
    const cached = getStoredEvents();
    if (cached.length > 0) {
      setEventsList(cached);
      setIsLoadingEvents(false);
    }
    refreshTenures();

    // 2. Fetch from Firestore server directly (<150ms)
    syncEventsFromFirestore().then((res) => {
      if (res && Array.isArray(res) && res.length > 0) {
        hasSynced.current = true;
        setEventsList(res);
        setIsLoadingEvents(false);
      }
    }).catch(() => {
      if (!hasSynced.current) {
        const fallback = getStoredEvents();
        if (fallback.length > 0) setEventsList(fallback);
        setIsLoadingEvents(false);
      }
    });

    syncTenuresFromFirestore().then((res) => {
      if (res && Array.isArray(res)) refreshTenures();
    });

    const unsubscribeEvents = subscribeToEvents((remoteEvents) => {
      if (Array.isArray(remoteEvents) && remoteEvents.length > 0) {
        hasSynced.current = true;
        setEventsList(remoteEvents);
        setIsLoadingEvents(false);
      }
    });

    const unsubscribeTenures = subscribeToTenures(() => {
      refreshTenures();
    });

    // CRITICAL: Differentiate event updates from tenure updates!
    // NEVER overwrite eventsList with tenure objects!
    const handleEventsUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        const valid = e.detail.filter(
          (evt: any) => Boolean(evt?.name && typeof evt.name === "string" && evt.name.trim().length > 0)
        );
        if (valid.length > 0) {
          hasSynced.current = true;
          setEventsList(valid);
          setIsLoadingEvents(false);
          return;
        }
      }
      const stored = getStoredEvents();
      if (stored.length > 0) {
        setEventsList(stored);
        setIsLoadingEvents(false);
      }
    };

    const handleTenuresUpdate = () => {
      refreshTenures();
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "src_events" || !e.key) {
        handleEventsUpdate(e);
      }
      if (e.key?.includes("tenure") || !e.key) {
        handleTenuresUpdate();
      }
    };

    // Timeout: if sync + subscription haven't delivered after 3.5 seconds, show stored events
    const syncTimeout = setTimeout(() => {
      if (!hasSynced.current) {
        const fallback = getStoredEvents();
        if (fallback.length > 0) setEventsList(fallback);
        setIsLoadingEvents(false);
      }
    }, 3500);

    window.addEventListener("src_events_updated", handleEventsUpdate);
    window.addEventListener("src_tenures_updated", handleTenuresUpdate);
    window.addEventListener("src_tenure_changed", handleTenuresUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      clearTimeout(syncTimeout);
      unsubscribeEvents();
      unsubscribeTenures();
      window.removeEventListener("src_events_updated", handleEventsUpdate);
      window.removeEventListener("src_tenures_updated", handleTenuresUpdate);
      window.removeEventListener("src_tenure_changed", handleTenuresUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Filter events for the live calendar
  const filteredEvents = useMemo(() => {
    const filtered = eventsList
      .filter(
        (e) =>
          Boolean(e?.name && typeof e.name === "string" && e.name.trim().length > 0) &&
          e.isLive !== false &&
          e.status !== "draft" &&
          !e.isCancelled &&
          e.status !== "Cancelled" &&
          !e.parentEventId &&
          !e.parentEventSlug
      )
      .filter((event) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          (event.name || "").toLowerCase().includes(q) ||
          (event.description || "").toLowerCase().includes(q) ||
          (event.category || "").toLowerCase().includes(q) ||
          (event.tagline && event.tagline.toLowerCase().includes(q));

        return matchesSearch;
      });

    return sortEventsByDate(filtered);
  }, [eventsList, searchQuery]);

  // Active / Upcoming Events in the live calendar
  // Current tenure completed events stay here — they only move to Past Tenure
  // after an explicit tenure change is marked by administrators.
  const activeUpcomingEvents = useMemo(() => {
    return filteredEvents;
  }, [filteredEvents]);

  // Featured Flagship Event
  const featuredEvent = eventsList.find(
    (e) =>
      Boolean(e?.name && typeof e.name === "string" && e.name.trim().length > 0) &&
      Boolean(e.isFeatured) &&
      e.isLive !== false &&
      e.status !== "draft" &&
      !e.isCancelled &&
      e.status !== "Cancelled" &&
      e.status !== "Completed" &&
      !isEventCompletedByDate(e) &&
      !e.parentEventId &&
      !e.parentEventSlug
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8 space-y-16 text-[#0F172A]">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          <div className="space-y-4 max-w-3xl">
            <Badge variant="orange" size="md">
              OFFICIAL CALENDAR {currentTenureLabel}
            </Badge>
            <h1 className="font-extrabold text-4xl sm:text-6xl text-[#0F172A] tracking-tight uppercase leading-none">
              FIND YOUR NEXT
              <br />
              <span className="text-[#E78023]">EXPERIENCE.</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 font-medium">
              Competitions, workshops, performances, festivals and everything in between.
            </p>
          </div>

        </div>

        {/* Search Toolbar */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by event name, category, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:border-[#17458F] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold uppercase text-slate-400 hover:text-slate-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Featured Flagship Banner */}
        {!searchQuery && featuredEvent && (
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Flagship Highlight</span>
            </span>
            <EventCard event={featuredEvent} featuredLayout={true} />
          </div>
        )}

        {/* Live / Upcoming Events Grid */}
        <div className="space-y-6">
          {searchQuery && (
            <div className="border-b border-slate-200 pb-4">
              <h3 className="font-extrabold text-xl sm:text-2xl text-[#17458F] uppercase tracking-tight">
                Search Results ({filteredEvents.length})
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Matches from live calendar
              </p>
            </div>
          )}

          {isLoadingEvents && activeUpcomingEvents.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <EventCardSkeleton key={i} />
              ))}
            </div>
          ) : activeUpcomingEvents.length > 0 ? (
            <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" staggerDelay={0.06}>
              {activeUpcomingEvents.map((evt) => (
                <StaggerItem key={evt.id || evt.slug}>
                  <EventCard event={evt} />
                </StaggerItem>
              ))}
            </StaggerGrid>
          ) : (
            <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
              <Calendar className="w-8 h-8 text-[#E78023] mx-auto opacity-70" />
              <h4 className="font-bold text-lg text-slate-800">No active events found</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery 
                  ? "Try adjusting your search keywords to find events." 
                  : "All current events have either concluded or new events are being announced soon. Check the past tenure events below!"}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-2 px-4 py-2 rounded-xl bg-[#E78023] text-white text-xs font-bold uppercase tracking-wider"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* ARCHIVE & PAST TENURE NAVIGATION BANNER                            */}
        {/* ------------------------------------------------------------------ */}
        <section className="pt-8 border-t-2 border-slate-200/80">
          <div className="p-6 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge variant="navy" size="sm">
                  HISTORIC ARCHIVES
                </Badge>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Council Sessions
                </span>
              </div>
              <h3 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] tracking-tight uppercase">
                Looking for past council events?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                Browse concluded competitions, hackathons, and cultural fests hosted across previous student council tenures on our dedicated session archive page.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/events/past"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#17458F] hover:bg-[#17458F]/90 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-all"
              >
                <History className="w-4 h-4 text-[#E78023]" />
                <span>Past Tenure Events</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/archive"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider shadow-2xs transition-all"
              >
                <Archive className="w-4 h-4 text-[#E78023]" />
                <span>Full Council Archive</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
