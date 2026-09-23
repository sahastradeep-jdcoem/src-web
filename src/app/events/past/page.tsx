"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  History,
  ChevronLeft,
  ChevronRight,
  Archive,
  ArrowLeft,
  ArrowRight,
  Clock,
} from "lucide-react";
import { EventCard } from "@/components/events/EventCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { StaggerGrid, StaggerItem } from "@/components/ui/StaggerContainer";
import { EventCardSkeleton } from "@/components/ui/SkeletonCard";
import {
  getPublicTenures,
  syncTenuresFromFirestore,
  subscribeToTenures,
  CouncilTenure,
} from "@/lib/tenureStore";
import {
  getEventDateTimestamp,
  sanitizeEventItem,
} from "@/lib/eventsStore";
import { EventItem } from "@/types";

export default function PastTenureEventsPage() {
  const [tenuresList, setTenuresList] = useState<CouncilTenure[]>([]);
  const [selectedTenureId, setSelectedTenureId] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(6);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTenures = () => {
    const pub = getPublicTenures();
    setTenuresList(pub);
    if (pub.length > 0) setIsLoading(false);
  };

  useEffect(() => {
    refreshTenures();

    syncTenuresFromFirestore().then(() => {
      refreshTenures();
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    const unsubTenures = subscribeToTenures(() => {
      refreshTenures();
      setIsLoading(false);
    });

    window.addEventListener("src_tenures_updated", refreshTenures);
    window.addEventListener("src_tenure_changed", refreshTenures);

    return () => {
      unsubTenures();
      window.removeEventListener("src_tenures_updated", refreshTenures);
      window.removeEventListener("src_tenure_changed", refreshTenures);
    };
  }, []);

  // Aggregate ALL past tenure events from archived tenures
  const allPastEvents = useMemo(() => {
    const map = new Map<string, EventItem & { tenureLabel?: string; tenureNumber?: string; tenureId?: string }>();

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
              tenureId: t.id,
            });
          }
        });
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const tA = getEventDateTimestamp(a);
      const tB = getEventDateTimestamp(b);
      if (tA !== tB) return tB - tA;
      return (a.name || "").localeCompare(b.name || "");
    });

    return list;
  }, [tenuresList]);

  // Past tenures that have at least 1 event
  const archivedTenuresWithEvents = useMemo(() => {
    return tenuresList.filter((t) => {
      if (t.isDraft || t.isCurrent) return false;
      const count = allPastEvents.filter(
        (e) => e.tenureLabel === t.label || (e as any).tenureId === t.id
      ).length;
      return count > 0;
    });
  }, [tenuresList, allPastEvents]);

  // Filtered by selected tenure
  const filteredEvents = useMemo(() => {
    if (selectedTenureId === "all") return allPastEvents;
    return allPastEvents.filter(
      (e) =>
        e.tenureLabel ===
          (tenuresList.find((t) => t.id === selectedTenureId)?.label ?? "") ||
        (e as any).tenureId === selectedTenureId
    );
  }, [allPastEvents, selectedTenureId, tenuresList]);

  const totalEvents = filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalEvents / itemsPerPage));

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedTenureId, itemsPerPage]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredEvents.slice(start, start + itemsPerPage);
  }, [filteredEvents, page, itemsPerPage]);

  const startItem = totalEvents === 0 ? 0 : (page - 1) * itemsPerPage + 1;
  const endItem = Math.min(page * itemsPerPage, totalEvents);

  // Visible page buttons (up to 10)
  const visiblePages = useMemo(() => {
    const maxVisible = 10;
    if (totalPages <= maxVisible) return Array.from({ length: totalPages }, (_, i) => i + 1);
    let start = Math.max(1, page - 4);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [totalPages, page]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8 text-[#0F172A]">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* ---- Page Header ---- */}
        <div className="space-y-6">
          {/* Back link */}
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-[#17458F] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Events
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="navy" size="md">HISTORIC ARCHIVES</Badge>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Council Sessions</span>
              </div>
              <h1 className="font-extrabold text-4xl sm:text-5xl text-[#0F172A] tracking-tight uppercase leading-none">
                PAST TENURE
                <br />
                <span className="text-[#17458F]">EVENTS.</span>
              </h1>
              <p className="text-base text-slate-600 font-medium max-w-2xl">
                Browse concluded competitions, hackathons, cultural fests and milestones hosted across all previous student council tenures.
              </p>
            </div>

            {/* Full Council Archive button */}
            <Link
              href="/archive"
              className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-white border border-slate-200 hover:border-[#17458F] text-slate-700 hover:text-[#17458F] text-xs font-bold uppercase tracking-wider shadow-xs transition-all shrink-0 self-start md:self-auto"
            >
              <Archive className="w-4 h-4 text-[#E78023]" />
              <span>Full Council Archive</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* ---- Tenure Filter Bar ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
              Filter by Session:
            </span>

            {/* All Sessions */}
            <button
              onClick={() => setSelectedTenureId("all")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[36px]",
                selectedTenureId === "all"
                  ? "bg-[#17458F] text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              All Past Sessions ({allPastEvents.length})
            </button>

            {/* Per-tenure filter buttons */}
            {archivedTenuresWithEvents.map((tenure) => {
              const count = allPastEvents.filter(
                (e) => e.tenureLabel === tenure.label || (e as any).tenureId === tenure.id
              ).length;
              const isSelected = selectedTenureId === tenure.id;
              return (
                <button
                  key={tenure.id}
                  onClick={() => setSelectedTenureId(tenure.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 min-h-[36px]",
                    isSelected
                      ? "bg-[#17458F] text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  <span>{tenure.tenureNumber || tenure.label}</span>
                  <span className="opacity-70 text-[11px]">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Items per page */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium px-2">
            <span>View:</span>
            {[6, 9, 12].map((n) => (
              <button
                key={n}
                onClick={() => setItemsPerPage(n)}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold text-xs transition-colors min-h-[32px]",
                  itemsPerPage === n
                    ? "bg-[#E78023] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {n} / page
              </button>
            ))}
          </div>
        </div>

        {/* ---- Events Grid ---- */}
        {isLoading && paginated.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : paginated.length > 0 ? (
          <div className="space-y-10">
            <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" staggerDelay={0.05}>
              {paginated.map((evt) => (
                <StaggerItem key={evt.id}>
                  <div className="relative group">
                    <EventCard event={evt} />
                    {(evt as any).tenureLabel && (
                      <div className="absolute top-3 right-3 pointer-events-none z-10">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider border border-white/20 shadow-md">
                          {(evt as any).tenureLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </StaggerItem>
              ))}
            </StaggerGrid>

            {/* ---- Google-Style Pagination ---- */}
            {totalPages > 1 && (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-6">

                {/* Google wordmark with clickable 'o' letters */}
                <div
                  className="flex items-center justify-center tracking-tight text-3xl sm:text-4xl font-extrabold font-heading select-none"
                  aria-label={`Page ${page} of ${totalPages}`}
                >
                  <span className="text-[#4285F4]">G</span>
                  {visiblePages.map((pageNum) => {
                    const isActive = pageNum === page;
                    const colorIndex = (pageNum - 1) % 4;
                    const letterColor = isActive
                      ? "text-[#EA4335]"
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
                        className="px-0.5 sm:px-1 transition-transform hover:scale-125 focus:outline-none"
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

                {/* Numbered navigation */}
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className={cn(
                      "px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 min-h-[44px]",
                      page === 1
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-[#17458F] hover:bg-slate-100 active:scale-95 cursor-pointer"
                    )}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
                    {visiblePages.map((pageNum) => {
                      const isActive = pageNum === page;
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
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className={cn(
                      "px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 min-h-[44px]",
                      page === totalPages
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-[#17458F] hover:bg-slate-100 active:scale-95 cursor-pointer"
                    )}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Counter */}
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                  <span className="px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-800 font-bold border border-slate-200 shadow-xs">
                    {page} of {totalPages}
                  </span>
                  <span>•</span>
                  <span>Showing {startItem}–{endItem} of {totalEvents} past events</span>
                </div>
              </div>
            )}

            {/* Simple counter when only 1 page */}
            {totalPages === 1 && totalEvents > 0 && (
              <p className="text-center text-xs text-slate-400 font-medium">
                Showing all {totalEvents} past event{totalEvents !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        ) : (
          <div className="p-16 text-center rounded-3xl bg-white border border-slate-200 space-y-4">
            <Clock className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-xl text-slate-700">No past events recorded yet</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Concluded events and milestones from previous council tenures will automatically appear here once a tenure change is marked.
            </p>
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 rounded-2xl bg-[#17458F] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#17458F]/90 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              View Current Events
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
