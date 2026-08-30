"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Calendar, Sparkles } from "lucide-react";
import { mockEvents } from "@/data/events";
import { EventCard } from "@/components/events/EventCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { getStoredEvents, syncEventsFromFirestore, subscribeToEvents } from "@/lib/eventsStore";
import { EventItem } from "@/types";

export default function EventsPage() {
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setEventsList(getStoredEvents());
    syncEventsFromFirestore().then((res) => {
      if (res) setEventsList(res);
    });

    const unsubscribe = subscribeToEvents((remoteEvents) => {
      setEventsList(remoteEvents);
    });

    const handleUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setEventsList(e.detail);
      } else {
        setEventsList(getStoredEvents());
      }
    };

    window.addEventListener("src_events_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener("src_events_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const filteredEvents = useMemo(() => {
    return eventsList.filter((event) => {
      const matchesSearch =
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.tagline && event.tagline.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesSearch;
    });
  }, [eventsList, searchQuery]);

  const featuredEvent = eventsList.find((e) => e.isFeatured);

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8 space-y-12 text-[#0F172A]">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Page Header */}
        <div className="space-y-4 max-w-3xl">
          <Badge variant="orange" size="md">
            OFFICIAL CALENDAR 2025–26
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

        {/* Events Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h3 className="font-extrabold text-xl text-[#17458F] uppercase">
              All Events ({filteredEvents.length})
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Official JDCOEM SRC Events
            </span>
          </div>

          {filteredEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((evt) => (
                <EventCard key={evt.id} event={evt} />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
              <Calendar className="w-8 h-8 text-[#E78023] mx-auto opacity-70" />
              <h4 className="font-bold text-lg text-slate-800">No events found</h4>
              <p className="text-xs text-slate-500">
                Try adjusting your search query to find upcoming events.
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

      </div>
    </div>
  );
}
