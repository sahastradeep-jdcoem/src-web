"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { mockEvents } from "@/data/events";
import { getStoredEvents, syncEventsFromFirestore } from "@/lib/eventsStore";
import { EventItem } from "@/types";
import { RegistrationWizard } from "@/components/registration/RegistrationWizard";
import { Badge } from "@/components/ui/Badge";

export default function EventRegisterPage() {
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

    // 2. Fetch latest from Firestore in case event was just created
    syncEventsFromFirestore().then((remote) => {
      if (remote) {
        const remoteMatch = findEvent([...remote, ...mockEvents], slug);
        if (remoteMatch) {
          setEvent(remoteMatch);
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
            <span>Back to Event Details</span>
          </Link>

          <div className="flex items-center gap-2">
            <Badge variant="orange" size="sm">
              LIVE REGISTRATION
            </Badge>
          </div>
        </div>

        {/* Header Title */}
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
            SRC Event Accreditation
          </span>
          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-[#0F172A] tracking-tight uppercase">
            {event.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {event.date} • {event.venue}
          </p>
        </div>

        {/* Multi-Step Registration Wizard Form */}
        <RegistrationWizard event={event} />

      </div>
    </div>
  );
}
