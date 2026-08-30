"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, ArrowRight, Calendar, Inbox } from "lucide-react";
import { EventCard } from "@/components/events/EventCard";
import { EventItem } from "@/types";
import { getStoredEvents } from "@/lib/eventsStore";

export default function HomeEventsSection() {
  const [eventsList, setEventsList] = useState<EventItem[]>([]);

  useEffect(() => {
    setEventsList(getStoredEvents());

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
      window.removeEventListener("src_events_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const featuredEvent = eventsList[0];
  const otherEvents = eventsList.slice(1);

  if (eventsList.length === 0) {
    return null;
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
              Experience Prarambh and upcoming flagship events hosted by the Student Representative Council.
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
