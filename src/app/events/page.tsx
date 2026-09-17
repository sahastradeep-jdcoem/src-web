"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  Search, 
  Calendar, 
  Sparkles, 
  History, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight,
  Archive,
  Layers,
  Clock
} from "lucide-react";
import { EventCard } from "@/components/events/EventCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { 
  getStoredEvents, 
  syncEventsFromFirestore, 
  subscribeToEvents, 
  sortEventsByDate,
  getEventDateTimestamp,
  sanitizeEventItem
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
  
  // Past Tenure Events Pagination & Filtering
  const [selectedPastTenureId, setSelectedPastTenureId] = useState<string>("all");
  const [pastTenurePage, setPastTenurePage] = useState<number>(1);
  const [pastItemsPerPage, setPastItemsPerPage] = useState<number>(3); // 3 per page (1 row) or 6 (2 rows)

  const refreshTenures = () => {
    const pub = getPublicTenures();
    setTenuresList(pub);
    const curr = getCurrentTenure();
    if (curr?.label) {
      setCurrentTenureLabel(curr.label);
    }
  };

  useEffect(() => {
    setEventsList(getStoredEvents());
    refreshTenures();

    syncEventsFromFirestore().then((res) => {
      if (res && Array.isArray(res)) setEventsList(res);
    });
    syncTenuresFromFirestore().then((res) => {
      if (res && Array.isArray(res)) refreshTenures();
    });

    const unsubscribeEvents = subscribeToEvents((remoteEvents) => {
      if (Array.isArray(remoteEvents)) setEventsList(remoteEvents);
    });

    const unsubscribeTenures = subscribeToTenures(() => {
      refreshTenures();
    });

    const handleUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setEventsList(e.detail);
      } else {
        setEventsList(getStoredEvents());
      }
      refreshTenures();
    };

    window.addEventListener("src_events_updated", handleUpdate);
    window.addEventListener("src_tenures_updated", handleUpdate);
    window.addEventListener("src_tenure_changed", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsubscribeEvents();
      unsubscribeTenures();
      window.removeEventListener("src_events_updated", handleUpdate);
      window.removeEventListener("src_tenures_updated", handleUpdate);
      window.removeEventListener("src_tenure_changed", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Filter events for the live calendar
  const filteredEvents = useMemo(() => {
    const filtered = eventsList
      .filter(
        (e) =>
          e.isLive !== false &&
          e.status !== "draft" &&
          !e.isCancelled &&
          e.status !== "Cancelled" &&
          !e.parentEventId &&
          !e.parentEventSlug
      )
      .filter((event) => {
        const matchesSearch =
          event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (event.tagline && event.tagline.toLowerCase().includes(searchQuery.toLowerCase()));

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
      Boolean(e.isFeatured) &&
      e.isLive !== false &&
      e.status !== "draft" &&
      !e.isCancelled &&
      e.status !== "Cancelled" &&
      e.status !== "Completed" &&
      !e.parentEventId &&
      !e.parentEventSlug
  );

  // Aggregate ALL Past Tenure & Concluded Events
  const allPastTenureEvents = useMemo(() => {
    const map = new Map<string, EventItem & { tenureLabel?: string; tenureNumber?: string }>();

    // 1. Concluded events from archived tenures
    const archivedTenures = tenuresList.filter((t) => !t.isDraft && !t.isCurrent);
    archivedTenures.forEach((t) => {
      if (Array.isArray(t.events)) {
        t.events.forEach((rawEvt, idx) => {
          if (rawEvt) {
            const sanitized = sanitizeEventItem(rawEvt);
            const key = sanitized.id || sanitized.slug || `archive-${t.id}-${idx}`;
            map.set(key, {
              ...sanitized,
              id: sanitized.id || key,
              name: sanitized.name || "Event",
              category: sanitized.category || "Event",
              status: sanitized.status || "Completed",
              date: sanitized.date || "Past Session",
              venue: sanitized.venue || "Campus",
              tenureLabel: t.label,
              tenureNumber: t.tenureNumber,
            });
          }
        });
      }
    });

    // NOTE: Current tenure completed events are NOT added here.
    // They remain in the main "Active & Upcoming" calendar grid.
    // Events only appear in this archive section when they belong
    // to an actual archived (non-current, non-draft) tenure.

    // Sort descending (most recent past event first, oldest on bottom)
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const tA = getEventDateTimestamp(a);
      const tB = getEventDateTimestamp(b);
      if (tA !== tB) return tB - tA;
      return (a.name || "").localeCompare(b.name || "");
    });

    return list;
  }, [tenuresList, eventsList]);

  // Filter past events by selected tenure tab
  const filteredPastEvents = useMemo(() => {
    if (selectedPastTenureId === "all") {
      return allPastTenureEvents;
    }
    return allPastTenureEvents.filter((e) => {
      const tenure = tenuresList.find((t) => t.id === selectedPastTenureId);
      if (!tenure) return true;
      return e.tenureLabel === tenure.label || (e as any).tenureId === tenure.id;
    });
  }, [allPastTenureEvents, selectedPastTenureId, tenuresList]);

  // Calculate Google-Style Pagination
  const totalPastEvents = filteredPastEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalPastEvents / pastItemsPerPage));

  // Reset to page 1 if page exceeds total
  useEffect(() => {
    if (pastTenurePage > totalPages) {
      setPastTenurePage(1);
    }
  }, [totalPages, pastTenurePage]);

  // Sliced items for current page
  const paginatedPastEvents = useMemo(() => {
    const startIndex = (pastTenurePage - 1) * pastItemsPerPage;
    return filteredPastEvents.slice(startIndex, startIndex + pastItemsPerPage);
  }, [filteredPastEvents, pastTenurePage, pastItemsPerPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPastTenurePage(newPage);
    const elem = document.getElementById("past-tenure-events");
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Google-style visible page range (up to 10 pages)
  const visiblePages = useMemo(() => {
    const maxVisible = 10;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, pastTenurePage - 4);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages, pastTenurePage]);

  const startItem = totalPastEvents === 0 ? 0 : (pastTenurePage - 1) * pastItemsPerPage + 1;
  const endItem = Math.min(pastTenurePage * pastItemsPerPage, totalPastEvents);

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

          {/* Quick Anchor Link to Past Events */}
          {allPastTenureEvents.length > 0 && (
            <a
              href="#past-tenure-events"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-[#17458F] text-slate-700 hover:text-[#17458F] font-bold text-xs uppercase tracking-wider shadow-2xs transition-all shrink-0 self-start md:self-auto"
            >
              <History className="w-4 h-4 text-[#E78023]" />
              <span>Jump to Past Tenure Events ({allPastTenureEvents.length}) ↓</span>
            </a>
          )}
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
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="font-extrabold text-xl sm:text-2xl text-[#17458F] uppercase tracking-tight">
                {searchQuery ? `Search Results (${filteredEvents.length})` : `Current Tenure Events (${activeUpcomingEvents.length})`}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {searchQuery ? "Matches from live calendar" : `Official JDCOEM SRC Events for ${currentTenureLabel}`}
              </p>
            </div>

            {allPastTenureEvents.length > 0 && !searchQuery && (
              <a
                href="#past-tenure-events"
                className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#17458F] uppercase tracking-wider transition-colors"
              >
                <span>View Past Events</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            )}
          </div>

          {activeUpcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeUpcomingEvents.map((evt) => (
                <EventCard key={evt.id} event={evt} />
              ))}
            </div>
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
        {/* PAST TENURE EVENTS SECTION (Google-Style Pagination: 1 of 10, etc) */}
        {/* ------------------------------------------------------------------ */}
        <section 
          id="past-tenure-events" 
          className="pt-10 border-t-2 border-slate-200/80 space-y-8 scroll-mt-6"
        >
          {/* Header & Tenure Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="navy" size="sm">
                  HISTORIC ARCHIVES
                </Badge>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Council Sessions
                </span>
              </div>
              <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] tracking-tight uppercase">
                PAST TENURE EVENTS
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                Browse concluded competitions, hackathons, and cultural fests hosted across previous student council tenures.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/archive"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-[#17458F] text-slate-700 hover:text-[#17458F] text-xs font-bold uppercase tracking-wider shadow-2xs transition-all"
              >
                <Archive className="w-4 h-4 text-[#E78023]" />
                <span>Full Council Archive</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Tenure Filter Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
                Filter by Session:
              </span>
              <button
                onClick={() => {
                  setSelectedPastTenureId("all");
                  setPastTenurePage(1);
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all",
                  selectedPastTenureId === "all"
                    ? "bg-[#17458F] text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                All Past Sessions ({allPastTenureEvents.length})
              </button>

              {tenuresList.map((tenure) => {
                const isSelected = selectedPastTenureId === tenure.id;
                const eventsInTenure = allPastTenureEvents.filter(
                  (e) => e.tenureLabel === tenure.label || (e as any).tenureId === tenure.id
                ).length;
                if (eventsInTenure === 0 && !tenure.isCurrent) return null;

                return (
                  <button
                    key={tenure.id}
                    onClick={() => {
                      setSelectedPastTenureId(tenure.id);
                      setPastTenurePage(1);
                    }}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                      isSelected
                        ? "bg-[#17458F] text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    )}
                  >
                    <span>{tenure.tenureNumber || tenure.label} ({tenure.label})</span>
                    <span className="opacity-70 text-[11px]">({eventsInTenure})</span>
                  </button>
                );
              })}
            </div>

            {/* Per-Page Selector (3 or 6) */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium px-2">
              <span>View:</span>
              <button
                onClick={() => {
                  setPastItemsPerPage(3);
                  setPastTenurePage(1);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold text-xs transition-colors",
                  pastItemsPerPage === 3 
                    ? "bg-[#E78023] text-white" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                3 / page
              </button>
              <button
                onClick={() => {
                  setPastItemsPerPage(6);
                  setPastTenurePage(1);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold text-xs transition-colors",
                  pastItemsPerPage === 6 
                    ? "bg-[#E78023] text-white" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                6 / page
              </button>
            </div>
          </div>

          {/* Past Events Grid */}
          {filteredPastEvents.length > 0 ? (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedPastEvents.map((evt) => (
                  <div key={evt.id} className="relative group">
                    <EventCard event={evt} />
                    {evt.tenureLabel && (
                      <div className="absolute top-3 right-3 pointer-events-none z-10">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wider border border-white/20 shadow-md">
                          {evt.tenureLabel}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ------------------------------------------------------------- */}
              {/* GOOGLE-STYLE PAGINATION COMPONENT ("1 of 10, 2 of 10" TYPE) */}
              {/* ------------------------------------------------------------- */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-6">
                
                {/* Google-Style Visual Logo/Wordmark */}
                <div 
                  className="flex items-center justify-center tracking-tight text-3xl sm:text-4xl font-extrabold font-heading select-none"
                  aria-label={`Google style pagination, page ${pastTenurePage} of ${totalPages}`}
                >
                  <span className="text-[#4285F4]">G</span>
                  {visiblePages.map((pageNum) => {
                    const isActive = pageNum === pastTenurePage;
                    // Google color palette for Os: Red, Yellow, Blue, Green
                    const colorIndex = (pageNum - 1) % 4;
                    const letterColor = isActive
                      ? "text-[#EA4335]" // Active highlighted red 'o'
                      : colorIndex === 0
                      ? "text-[#EA4335]"
                      : colorIndex === 1
                      ? "text-[#FBBC05]"
                      : colorIndex === 2
                      ? "text-[#4285F4]"
                      : "text-[#34A853]";

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className="px-0.5 sm:px-1 transition-transform hover:scale-125 focus:outline-hidden"
                        title={`Go to page ${pageNum}`}
                      >
                        <span
                          className={cn(
                            "inline-block font-extrabold transition-all duration-200",
                            letterColor,
                            isActive ? "scale-125 underline decoration-2 underline-offset-4" : "opacity-80 hover:opacity-100"
                          )}
                        >
                          o
                        </span>
                      </button>
                    );
                  })}
                  <span className="text-[#4285F4]">g</span>
                  <span className="text-[#34A853]">l</span>
                  <span className="text-[#EA4335]">e</span>
                </div>

                {/* Google-Style Numbered Navigation Row */}
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
                  <button
                    onClick={() => handlePageChange(pastTenurePage - 1)}
                    disabled={pastTenurePage === 1}
                    className={cn(
                      "px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 min-h-[44px]",
                      pastTenurePage === 1
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-[#17458F] hover:bg-slate-100 active:scale-95 cursor-pointer"
                    )}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
                    {visiblePages.map((pageNum) => {
                      const isActive = pageNum === pastTenurePage;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={cn(
                            "w-11 h-11 rounded-full text-xs font-bold transition-all flex items-center justify-center cursor-pointer min-w-[44px] min-h-[44px]",
                            isActive
                              ? "bg-[#17458F] text-white shadow-md scale-105 font-extrabold ring-2 ring-[#17458F]/20"
                              : "text-slate-600 hover:bg-slate-100 hover:text-[#17458F]"
                          )}
                          aria-label={`Page ${pageNum}`}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(pastTenurePage + 1)}
                    disabled={pastTenurePage === totalPages}
                    className={cn(
                      "px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 min-h-[44px]",
                      pastTenurePage === totalPages
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-[#17458F] hover:bg-slate-100 active:scale-95 cursor-pointer"
                    )}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Counter Badge: "1 of 10, 2 of 10" Type Display */}
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                  <span className="px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-800 font-bold border border-slate-200 shadow-2xs">
                    {pastTenurePage} of {totalPages}
                  </span>
                  <span>•</span>
                  <span>
                    Showing {startItem}–{endItem} of {totalPastEvents} past events
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
              <History className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="font-bold text-lg text-slate-800">No past events recorded for this session</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Concluded events and milestones from previous councils will automatically appear in this archive browser.
              </p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
