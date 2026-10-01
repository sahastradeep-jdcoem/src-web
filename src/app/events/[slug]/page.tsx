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
  AlertCircle,
  Layers,
  ArrowDown,
  Lock,
  GraduationCap,
  Globe,
  Share2,
  Check,
  HelpCircle
} from "lucide-react";
import { 
  getStoredEvents, 
  syncEventsFromFirestore, 
  subscribeToEvents, 
  sanitizeEventItem,
  isRegistrationDeadlinePassed,
  isEventCompletedByDate,
  getEventEffectiveStatus
} from "@/lib/eventsStore";
import { getPublicTenures } from "@/lib/tenureStore";
import { EventItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { ScheduleTimeline } from "@/components/events/ScheduleTimeline";
import { PrizeCard } from "@/components/events/PrizeCard";
import { EventRulesSection } from "@/components/events/EventRulesSection";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { isExternalUser } from "@/lib/usersStore";
import { toast } from "@/lib/toastStore";
import { useSocialShare } from "@/context/SocialShareContext";

export default function EventDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { user, openAuthModal } = useAuth();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [subEvents, setSubEvents] = useState<EventItem[]>([]);
  const [relatedEvents, setRelatedEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const { openShare } = useSocialShare();

  const handleShare = () => {
    if (!event) return;

    const canonicalUrl = `https://www.srcjdcoem.in/events/${event.slug || slug}`;
    const heroImage = event.cardImage;

    openShare({
      type: "event",
      typeLabel: event.isParentFest ? "CAMPUS FESTIVAL" : event.category ? `${event.category.toUpperCase()} EVENT` : "CAMPUS EVENT",
      title: event.name,
      subtitle: event.description || event.tagline,
      description: event.description,
      imageUrl: heroImage,
      badge: event.targetAudience === "jdcoem_only" || event.isInterCollege === false ? "🎓 JDCOEM Only" : "🌐 Inter-College",
      date: event.status === "Coming Soon" ? "Coming Soon" : event.date,
      time: event.status === "Coming Soon" ? undefined : event.time,
      venue: event.venue,
      organizer: event.organizer,
      entryFee: event.noRegistrationRequired ? "Open Walk-in" : event.entryFee || "Free Entry",
      ctaText: "Tap to Explore & Register",
      url: canonicalUrl,
    });
  };

  const isExternalStudent = isExternalUser(user);

  const findEvent = (allEvents: EventItem[], targetSlug: string): EventItem | null => {
    if (!targetSlug) return null;
    const cleanSlug = targetSlug.toLowerCase().trim();
    return (
      allEvents.filter(e => e.isLive !== false && e.status !== 'draft').find(
        (e) =>
          e.slug === cleanSlug ||
          e.id === cleanSlug ||
          e.id.toLowerCase() === cleanSlug ||
          (e.slug && e.slug.toLowerCase() === cleanSlug) ||
          e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === cleanSlug
      ) || null
    );
  };

  const findSubEvents = (allEvents: EventItem[], parent: EventItem): EventItem[] => {
    return allEvents
      .filter((e) => e.isLive !== false && e.status !== "draft" && !e.isCancelled && e.status !== "Cancelled")
      .filter(
        (e) =>
          e.id !== parent.id &&
          ((e.parentEventId && (e.parentEventId === parent.id || e.parentEventId === parent.slug)) ||
           (e.parentEventSlug && (e.parentEventSlug === parent.slug || e.parentEventSlug === parent.id)) ||
           (e.parentEventName && e.parentEventName.toLowerCase().trim() === parent.name.toLowerCase().trim()))
      );
  };

  const findRelatedEvents = (allEvents: EventItem[], current: EventItem): EventItem[] => {
    return allEvents
      .filter((e) => e.isLive !== false && e.status !== "draft" && !e.isCancelled && e.status !== "Cancelled")
      .filter(
        (e) =>
          e.id !== current.id &&
          e.slug !== current.slug &&
          !e.parentEventId &&
          !e.parentEventSlug
      )
      .slice(0, 2);
  };

  useEffect(() => {
    if (!slug) return;

    // 1. Check local stored events
    const stored = getStoredEvents();
    let match = findEvent(stored, slug);

    // If not found in primary store, search archived tenures
    if (!match) {
      const publicTenures = getPublicTenures();
      for (const t of publicTenures) {
        if (Array.isArray(t.events)) {
          const tenureMatch = findEvent(t.events, slug);
          if (tenureMatch) {
            match = {
              ...tenureMatch,
              tenureLabel: tenureMatch.tenureLabel || t.label,
              tenureId: tenureMatch.tenureId || t.id,
            };
            break;
          }
        }
      }
    }

    if (match) {
      const cleanMatch = sanitizeEventItem(match);
      setEvent(cleanMatch);
      setSubEvents(findSubEvents(stored, cleanMatch));
      setRelatedEvents(findRelatedEvents(stored, cleanMatch));
      setIsLoading(false);
    }

    // 2. Fetch latest from Firestore in case event was just created on another device
    syncEventsFromFirestore().then((remote) => {
      if (remote) {
        let remoteMatch = findEvent(remote, slug);
        if (!remoteMatch) {
          const publicTenures = getPublicTenures();
          for (const t of publicTenures) {
            if (Array.isArray(t.events)) {
              const tenureMatch = findEvent(t.events, slug);
              if (tenureMatch) {
                remoteMatch = {
                  ...tenureMatch,
                  tenureLabel: tenureMatch.tenureLabel || t.label,
                  tenureId: tenureMatch.tenureId || t.id,
                };
                break;
              }
            }
          }
        }

        if (remoteMatch) {
          const cleanRemoteMatch = sanitizeEventItem(remoteMatch);
          setEvent(cleanRemoteMatch);
          setSubEvents(findSubEvents(remote, cleanRemoteMatch));
          setRelatedEvents(findRelatedEvents(remote, cleanRemoteMatch));
        }
      }
      setIsLoading(false);
    });

    const unsub = subscribeToEvents((remoteEvents) => {
      if (remoteEvents) {
        let streamMatch = findEvent(remoteEvents, slug);
        if (!streamMatch) {
          const publicTenures = getPublicTenures();
          for (const t of publicTenures) {
            if (Array.isArray(t.events)) {
              const tenureMatch = findEvent(t.events, slug);
              if (tenureMatch) {
                streamMatch = {
                  ...tenureMatch,
                  tenureLabel: tenureMatch.tenureLabel || t.label,
                  tenureId: tenureMatch.tenureId || t.id,
                };
                break;
              }
            }
          }
        }

        if (streamMatch) {
          const cleanStreamMatch = sanitizeEventItem(streamMatch);
          setEvent(cleanStreamMatch);
          setSubEvents(findSubEvents(remoteEvents, cleanStreamMatch));
          setRelatedEvents(findRelatedEvents(remoteEvents, cleanStreamMatch));
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

  if (event.isCancelled || event.status === "Cancelled") {
    return (
      <div className="min-h-[70vh] bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="p-4 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600">
          <AlertCircle className="w-10 h-10 mx-auto" />
        </div>
        <div className="space-y-3 max-w-lg">
          <Badge variant="rose" size="md">Event Officially Cancelled</Badge>
          <h1 className="font-heading font-extrabold text-2xl text-[#0F172A] uppercase">
            {event.name}
          </h1>
          <div className="p-4 rounded-2xl bg-white border border-rose-200 text-left space-y-1.5 shadow-xs">
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest block font-sans">
              Official Cancellation Notice:
            </span>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              &quot;{event.cancellationNotice || "This event has been officially cancelled by the Student Representative Council (SRC) administration."}&quot;
            </p>
            {event.cancelledAt && (
              <p className="text-[10px] text-slate-400 font-mono pt-1">
                Notice date: {new Date(event.cancelledAt).toLocaleDateString("en-IN", { dateStyle: "long" })}
              </p>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-sans">
            Registrations are closed. Registered delegates will find their pass status updated on their student dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/events"
            className="px-6 py-3 rounded-2xl bg-[#17458F] text-white text-xs font-bold uppercase tracking-wider transition-all hover:bg-[#123670] shadow-sm"
          >
            &larr; Explore Other Events
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all hover:bg-slate-50 shadow-2xs"
          >
            Go to Student Passes
          </Link>
        </div>
      </div>
    );
  }

  const effectiveStatus = getEventEffectiveStatus(event);
  const isComingSoon = effectiveStatus === "Coming Soon";
  const isUpcoming = effectiveStatus === "Upcoming";
  const isCompleted = effectiveStatus === "Completed";
  const isDeadlinePassed = isRegistrationDeadlinePassed(event);
  const isRegistrationOpen = effectiveStatus === "Registration Open" && !isDeadlinePassed && !isCompleted;
  const isDateComingSoon = isComingSoon || Boolean(
    !event.date ||
    /\b(coming soon|to be announced|tba|to be decided|tbd)\b/i.test(event.date)
  );
  const isJdcoemOnly = event.targetAudience === "jdcoem_only" || event.isInterCollege === false;

  const displayRules = Array.from(
    new Set((event.rules || []).map((s) => (typeof s === "string" ? s.trim() : s)).filter(Boolean))
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-28 md:pb-20 font-sans">
      
      {/* 1. CINEMATIC HERO BANNER */}
      <section className="relative h-[55vh] sm:h-[60vh] flex items-end pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-slate-900">
        {/* Cinematic Background Backdrop Banner */}
        <Image
          src={event.headerImage || event.cardImage || event.poster || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1920&auto=format&fit=crop"}
          alt={event.name}
          fill
          priority
          unoptimized={true}
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="max-w-7xl mx-auto w-full relative z-10 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-[#E78023] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to All Events</span>
            </Link>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-white" />}
              <span>{copiedLink ? "Link Copied" : "Share Event"}</span>
            </button>
          </div>

          <div className="space-y-3">
            {(event.parentEventName || event.subEventBadge || event.tagline) && (
              <div className="flex flex-wrap items-center gap-2">
                {event.parentEventName && (
                  <Link
                    href={`/events/${event.parentEventSlug || event.parentEventId}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-xs transition-colors shadow-xs"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#E78023]" />
                    <span>Part of {event.parentEventName}</span>
                    <ArrowRight className="w-3 h-3 text-white/70" />
                  </Link>
                )}
                {event.subEventBadge && (
                  <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-900/80 text-white border border-white/20 shadow-xs">
                    {event.subEventBadge}
                  </span>
                )}
                {event.tagline && (
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[#E78023]">
                    • {event.tagline}
                  </span>
                )}
              </div>
            )}

            <h1 className="font-heading font-extrabold text-4xl sm:text-6xl text-white tracking-tight uppercase">
              {event.name}
            </h1>
          </div>

          {/* Quick Info Bar */}
          <div className="flex flex-wrap items-center gap-6 sm:gap-8 pt-4 border-t border-white/20 text-xs sm:text-sm text-slate-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#E78023] shrink-0" />
              {isComingSoon ? (
                <span className="font-bold text-amber-300">
                  Coming Soon
                </span>
              ) : (
                <>
                  <span className="font-bold text-white">
                    {event.date}
                  </span>
                  {event.isMultiDay && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      Multi-Day
                    </span>
                  )}
                </>
              )}
            </div>
            {event.time && !isComingSoon && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-300 shrink-0" />
                <span>{event.time}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E78023] shrink-0" />
              <span>{event.venue || "JDCOEM Campus"}</span>
            </div>
            {event.organizer && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-300 shrink-0" />
                <span>
                  Organized by: <strong className="text-white">{event.organizer}</strong>
                  {event.collaboratingClubs && event.collaboratingClubs.length > 0 && (
                    <span className="text-slate-300">
                      {" "}in collaboration with{" "}
                      {event.collaboratingClubs.map((club, idx) => (
                        <React.Fragment key={club.slug || club.name}>
                          <Link
                            href={`/clubs/${club.slug}`}
                            className="text-[#E78023] hover:underline font-bold"
                          >
                            {club.name}
                          </Link>
                          {idx < (event.collaboratingClubs?.length ?? 0) - 1 ? ", " : ""}
                        </React.Fragment>
                      ))}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. MAIN CONTENT & STICKY REGISTRATION PANEL */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          
          {/* Left 2 Columns: Detailed Sections */}
          <div className="lg:col-span-2 space-y-16 lg:min-h-[1450px]">
            
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

              {/* COLLABORATING CLUBS SPOTLIGHT */}
              {event.collaboratingClubs && event.collaboratingClubs.length > 0 && (
                <div className="p-5 sm:p-6 rounded-3xl bg-blue-50/60 border border-blue-100 space-y-3 mt-6">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#17458F]">
                    <Users className="w-4 h-4 text-[#E78023]" />
                    <span>Joint Student Collaboration</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                    This official campus event is hosted jointly by <strong className="text-slate-900 font-semibold">{event.organizer}</strong> in strategic partnership and co-production with:
                  </p>
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {event.collaboratingClubs.map((club) => (
                      <Link
                        key={club.slug || club.name}
                        href={`/clubs/${club.slug}`}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-[#17458F] text-xs font-bold text-[#17458F] hover:shadow-xs transition-all cursor-pointer group"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#E78023]" />
                        <span>{club.name}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#17458F] group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* DYNAMIC FESTIVAL SUB-EVENTS & COMPETITIONS */}
            {subEvents.length > 0 && (
              <section id="competitions" className="space-y-6 pt-6 border-t border-slate-200 scroll-mt-24">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    <span>Festival Lineup &amp; Segments</span>
                  </span>
                  <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                    Events Under {event.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Explore specialized events, competitions, and segments happening under {event.name}. Each event features dedicated prizes and rules.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {subEvents.map((sub) => {
                    const topPrize = sub.hasPrizes !== false && sub.prizes && sub.prizes[0] ? sub.prizes[0].amount : null;
                    return (
                      <div
                        key={sub.id}
                        className="group relative rounded-3xl bg-white border border-slate-200 p-5 flex flex-col justify-between hover:border-[#17458F] hover:shadow-lg transition-all"
                      >
                        <div className="space-y-4">
                          <div className="relative h-44 rounded-2xl overflow-hidden bg-slate-100">
                            <Image
                              src={sub.cardImage || sub.poster || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop"}
                              alt={sub.name}
                              fill
                              unoptimized={true}
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute top-3 left-3 flex items-center gap-1.5">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#E78023] text-white shadow-xs">
                                {sub.category}
                              </span>
                              {sub.subEventBadge && (
                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-900/80 text-white backdrop-blur-xs shadow-xs">
                                  {sub.subEventBadge}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <h3 className="font-heading font-extrabold text-lg text-[#0F172A] uppercase group-hover:text-[#17458F] transition-colors">
                              {sub.name}
                            </h3>
                            {sub.tagline && (
                              <p className="text-xs text-slate-500 line-clamp-1 font-medium">
                                {sub.tagline}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#E78023]" />
                              {sub.status === "Coming Soon" ? (
                                <span className="font-bold text-amber-600">Coming Soon</span>
                              ) : (
                                <span>{sub.date}</span>
                              )}
                            </div>
                            {topPrize && (
                              <div className="flex items-center gap-1 text-[#17458F] font-bold">
                                <Trophy className="w-3.5 h-3.5 text-[#E78023]" />
                                <span>Prize: {topPrize}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-700">
                            {sub.isPaid && sub.feeAmount ? `₹${sub.feeAmount}` : "Free Entry"}
                          </span>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/events/${sub.slug}`}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                              Details
                            </Link>
                            {getEventEffectiveStatus(sub) === "Completed" || effectiveStatus === "Completed" ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                                <span>Completed</span>
                              </span>
                            ) : sub.status === "Coming Soon" ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider">
                                <span>Coming Soon</span>
                              </span>
                            ) : sub.status === "Upcoming" ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Opens Soon</span>
                              </span>
                            ) : isRegistrationDeadlinePassed(sub) ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <span>Closed</span>
                              </span>
                            ) : sub.noRegistrationRequired ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Open Walk-in</span>
                              </span>
                            ) : (
                              <Link
                                href={`/events/${sub.slug}/register`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
                              >
                                <span>Register</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* WHAT TO EXPECT */}
            {(() => {
              if (event.isParentFest) return null;
              const displayExpect = Array.from(
                new Set((event.whatToExpect || []).map((s) => (typeof s === "string" ? s.trim() : s)).filter(Boolean))
              );
              if (displayExpect.length === 0) return null;
              return (
                <section className="space-y-6">
                  <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                    WHAT TO EXPECT
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {displayExpect.map((item, index) => (
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
              );
            })()}

            {/* SCHEDULE TIMELINE */}
            {event.hasSchedule !== false && !event.isParentFest && event.schedule && event.schedule.length > 0 && (
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
            {event.hasPrizes !== false && !event.isParentFest && event.prizes && event.prizes.length > 0 && (
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
                <div
                  className={cn(
                    "grid gap-4 sm:gap-5 items-stretch",
                    event.prizes.length === 1 && "grid-cols-1 max-w-md",
                    event.prizes.length >= 2 && "grid-cols-1 sm:grid-cols-2"
                  )}
                >
                  {event.prizes.map((prize, idx) => {
                    const isSpanFull = event.prizes.length === 3 && idx === 2;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "h-full",
                          isSpanFull && "sm:col-span-2"
                        )}
                      >
                        <PrizeCard
                          prize={prize}
                          index={idx}
                          totalCount={event.prizes.length}
                          isSpanFull={isSpanFull}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* RULES & GUIDELINES SECTION */}
            {displayRules && displayRules.length > 0 && !event.isParentFest && (
              <EventRulesSection rules={displayRules} />
            )}

            {/* VENUE & ARRIVAL GUIDE */}
            <section className="space-y-6 pt-2">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>Venue &amp; Campus Access</span>
                </span>
                <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                  LOCATION &amp; ARRIVAL GUIDE
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Official reporting directives and on-campus venue details for attending delegates.
                </p>
              </div>

              <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#E78023]" />
                      <span>On-Campus Venue</span>
                    </span>
                    <p className="font-heading font-extrabold text-base text-slate-900">
                      {event.venue || "JDCOEM Campus"}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      JD College of Engineering &amp; Management, Katol Road, Nagpur
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#17458F]" />
                      <span>Reporting Protocol</span>
                    </span>
                    <p className="font-heading font-extrabold text-base text-slate-900">
                      15–20 Mins Prior to Start
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      {isDateComingSoon ? "Scheduled timings will be announced soon" : `Scheduled for ${event.date} • ${event.time || "10:00 AM IST"}`}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Carry your college ID &amp; digital pass QR for fast-track entry check-in</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">Gate 1 &bull; Delegate Helpdesk</span>
                </div>
              </div>
            </section>

            {/* FREQUENTLY ASKED QUESTIONS */}
            <section className="space-y-6 pt-2">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" />
                  <span>Delegate Queries</span>
                </span>
                <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                  FREQUENTLY ASKED QUESTIONS
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Answers to common questions regarding delegate participation, passes, and campus entry.
                </p>
              </div>

              <div className="space-y-3.5">
                <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-900">
                    How do I access my entry pass after registering?
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Your official pass with a verified QR ticket is instantly generated and stored in your{" "}
                    <Link href="/dashboard" className="text-[#17458F] font-bold underline hover:text-[#E78023]">
                      Student Dashboard
                    </Link>
                    . You can present it directly on your mobile device at the venue check-in desk.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-900">
                    Who is eligible to participate in this event?
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {isJdcoemOnly
                      ? "This event is exclusive to currently enrolled JDCOEM students across all academic branches and years."
                      : "This event is open to students and delegates from JDCOEM as well as other recognized colleges and universities."}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-900">
                    Will registered participants receive certificates?
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Yes! All attending delegates receive an official verifiable digital Certificate of Participation endorsed by the Student Representative Council (SRC) and JDCOEM authorities.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-900">
                    What should I do if I need on-ground support during the event?
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    You can contact the official event coordinators listed in the Event Helpdesk section on the right, or approach any Student Representative Council (SRC) volunteer on campus.
                  </p>
                </div>
              </div>
            </section>

            {/* EXPLORE OTHER EVENTS */}
            {relatedEvents.length > 0 && (
              <section className="space-y-6 pt-4 border-t border-slate-200">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Campus Lineup</span>
                  </span>
                  <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                    EXPLORE OTHER EVENTS
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Discover other technical, cultural, and sports competitions happening across JDCOEM.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relatedEvents.map((rel) => (
                    <div
                      key={rel.id}
                      className="group rounded-2xl bg-white border border-slate-200 p-4 hover:border-[#17458F] hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="relative h-32 rounded-xl overflow-hidden bg-slate-100">
                          <Image
                            src={rel.cardImage || rel.poster || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop"}
                            alt={rel.name}
                            fill
                            unoptimized={true}
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute top-2 left-2">
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#E78023] text-white shadow-xs">
                              {rel.category}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-heading font-bold text-sm text-[#0F172A] line-clamp-1 group-hover:text-[#17458F] transition-colors">
                            {rel.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-medium">
                            {rel.tagline || rel.description}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-600">
                          {rel.date}
                        </span>
                        <Link
                          href={`/events/${rel.slug}`}
                          className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-[#17458F] hover:text-white text-slate-700 text-[11px] font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1"
                        >
                          <span>Explore</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* Right Column: Sticky Registration Card & Official Poster */}
          <div className="lg:sticky lg:top-24 space-y-6 self-start">
            
            {/* Official Event Notice Poster */}
            {(event.posterImage || event.poster) && (
              <div className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">
                  <span className="flex items-center gap-1.5 text-[#17458F]">
                    <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                    Official Event Poster
                  </span>
                </div>
                <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden border border-slate-100 shadow-xs group">
                  <Image
                    src={event.posterImage || event.poster}
                    alt={`${event.name} Official Poster`}
                    fill
                    unoptimized={true}
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>
            )}

            {event.isParentFest || subEvents.length > 0 ? (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-xl shadow-slate-200/50 space-y-6 relative overflow-hidden">
                {/* Brand top accent gradient stripe */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#17458F] via-[#E78023] to-[#17458F]" />

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#17458F]/10 text-[#17458F] border border-[#17458F]/20 inline-flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-[#E78023]" />
                      <span>UMBRELLA EVENT</span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Registrations Open
                    </span>
                  </div>

                  <h3 className="font-heading font-extrabold text-2xl text-[#0F172A] tracking-tight">
                    {event.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {event.name} hosts <strong className="text-slate-800 font-semibold">{subEvents.length} specialized event/competition{subEvents.length === 1 ? "" : "s"}</strong>. Choose a event/competition to configure your category and official delegate entry.
                  </p>
                </div>

                {/* Specs Breakdown */}
                <div className="space-y-2.5 pt-4 border-t border-slate-100 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100/80">
                    <span className="text-slate-500 font-medium">Active Events / Competitions</span>
                    <span className="font-bold text-[#17458F] font-mono px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100/80">
                      {subEvents.length} {subEvents.length === 1 ? "Segment" : "Segments"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100/80">
                    <span className="text-slate-500 font-medium">Festival Date</span>
                    <span className="font-bold text-slate-900">
                      {isComingSoon ? <span className="text-amber-600">Coming Soon</span> : event.date}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100/80">
                    <span className="text-slate-500 font-medium">Festival Venue</span>
                    <span className="font-bold text-slate-900 truncate max-w-[170px] text-right">{event.venue}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100/80">
                    <span className="text-slate-500 font-medium">Audience Eligibility</span>
                    <span className={cn(
                      "font-bold text-xs flex items-center gap-1",
                      isJdcoemOnly ? "text-amber-700" : "text-emerald-700"
                    )}>
                      {isJdcoemOnly ? (
                        <>
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>JDCOEM Campus Only</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-3.5 h-3.5" />
                          <span>Open to All Colleges</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 font-medium">Entry Authorization</span>
                    <span className="font-bold text-[#E78023] flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Official Delegate Pass
                    </span>
                  </div>
                </div>

                {/* Action Buttons: Enhanced Pro Max CTA Stack */}
                {isCompleted ? (
                  <div className="space-y-3 pt-1">
                    <div className="w-full py-3.5 px-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2 shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Festival Completed • Registrations Closed</span>
                    </div>
                    {subEvents.length > 0 && (
                      <a
                        href="#competitions"
                        className="w-full py-3 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200/80 border border-slate-200 text-[#17458F] text-xs font-bold uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2 group cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#17458F]" />
                        <span>Explore Lineup &amp; Highlights ({subEvents.length})</span>
                        <ArrowDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5 text-[#E78023]" />
                      </a>
                    )}
                  </div>
                ) : isComingSoon ? (
                  <div className="space-y-3 pt-1">
                    <div className="w-full py-3.5 px-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2 shadow-xs">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Festival Coming Soon</span>
                    </div>
                    {subEvents.length > 0 && (
                      <a
                        href="#competitions"
                        className="w-full py-3 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200/80 border border-slate-200 text-[#17458F] text-xs font-bold uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2 group cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#17458F]" />
                        <span>Explore Lineup &amp; Details ({subEvents.length})</span>
                        <ArrowDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5 text-[#E78023]" />
                      </a>
                    )}
                  </div>
                ) : isJdcoemOnly && isExternalStudent ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2 text-center">
                    <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-amber-900 uppercase tracking-wider">
                      <Lock className="w-4 h-4 text-amber-700" />
                      <span>JDCOEM Campus Exclusive</span>
                    </div>
                    <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                      This festival is reserved exclusively for JDCOEM students. Non-JDCOEM / external delegates cannot register.
                    </p>
                  </div>
                ) : subEvents.length > 0 ? (
                  <div className="space-y-2.5 pt-1">
                    <a
                      href="#competitions"
                      className="w-full py-3.5 px-4 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200/80 border border-slate-200 text-[#17458F] text-xs font-bold uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-xs"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#17458F]" />
                      <span>Explore Lineup &amp; Prizes ({subEvents.length})</span>
                      <ArrowDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5 text-[#E78023]" />
                    </a>
                  </div>
                ) : event.noRegistrationRequired && !event.isParentFest ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2 text-center">
                    <div className="flex items-center justify-center gap-1.5 font-bold text-xs uppercase tracking-wider text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>No Registration Required</span>
                    </div>
                    <p className="text-xs text-emerald-900/90 font-medium leading-relaxed">
                      This festival is open for walk-in attendance. Simply arrive on campus during event dates to attend!
                    </p>
                    <a
                      href="#competitions"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17458F] hover:underline pt-1"
                    >
                      <span>View Schedule & Lineup</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  <div className="w-full py-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Competitions Announcing Soon</span>
                  </div>
                )}

                {/* Coordinator Contact */}
                {event.coordinatorContact && (event.coordinatorContact.name?.trim() || event.coordinatorContact.phone?.trim()) && (
                  <div className="pt-4 border-t border-slate-100 text-xs space-y-1.5">
                    <span className="text-slate-400 uppercase font-extrabold text-[10px] tracking-wider block">
                      Festival Secretariat
                    </span>
                    {event.coordinatorContact.name?.trim() && (
                      <p className="font-semibold text-slate-800 leading-snug">
                        {event.coordinatorContact.name.trim()}
                        {event.coordinatorContact.role?.trim() && (
                          <span className="text-slate-500 font-normal"> ({event.coordinatorContact.role.trim()})</span>
                        )}
                      </p>
                    )}
                    {event.coordinatorContact.phone?.trim() && (
                      <a
                        href={`tel:${event.coordinatorContact.phone.trim().replace(/\s+/g, "")}`}
                        className="text-[#E78023] hover:text-[#c46816] font-bold flex items-center gap-1.5 transition-colors group w-fit"
                      >
                        <Phone className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                        <span className="hover:underline">{event.coordinatorContact.phone.trim()}</span>
                      </a>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="w-full py-3 px-4 rounded-2xl border-2 border-slate-200 hover:border-[#17458F] hover:bg-slate-50 text-slate-700 hover:text-[#17458F] text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:shadow-md active:scale-98"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4 text-[#17458F]" />}
                    <span>{copiedLink ? "Festival Link Copied!" : "Share this Festival"}</span>
                  </button>
                </div>

                {/* Official Compliance & Delegate Trust Box */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-[#17458F]/10 text-[#17458F]">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                        Official Delegate Assurance
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      All event passes &amp; entry receipts are officially issued by the Student Representative Council (SRC) under JDCOEM oversight.
                    </p>
                    <div className="pt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-slate-600">
                      <Link href="/refund-policy" className="text-[#17458F] hover:text-[#E78023] underline decoration-slate-300 underline-offset-2 transition-colors">
                        Refund Policy
                      </Link>
                      <span className="text-slate-300">•</span>
                      <Link href="/terms" className="text-[#17458F] hover:text-[#E78023] underline decoration-slate-300 underline-offset-2 transition-colors">
                        Terms of Entry
                      </Link>
                      <span className="text-slate-300">•</span>
                      <Link href="/privacy" className="text-[#17458F] hover:text-[#E78023] underline decoration-slate-300 underline-offset-2 transition-colors">
                        Privacy Charter
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
                <div className="space-y-2">
                  <Badge variant={event.noRegistrationRequired ? "success" : isRegistrationOpen ? "orange" : isUpcoming ? "warning" : "slate"} size="md">
                    {event.noRegistrationRequired
                      ? "Open Attendance"
                      : isUpcoming
                      ? "Upcoming • Opening Soon"
                      : event.status}
                  </Badge>
                  <h3 className="font-heading font-extrabold text-2xl text-[#0F172A]">
                    {event.noRegistrationRequired ? "Event Access & Entry" : "Registration Portal"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {event.noRegistrationRequired
                      ? `Official entry and attendance details for ${event.name}.`
                      : `Secure your official entry pass for ${event.name}.`}
                  </p>
                </div>

                {/* Specs Breakdown */}
                <div className="space-y-3 pt-4 border-t border-slate-100 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Participation Format:</span>
                    <span className="font-bold text-slate-900">
                      {event.noRegistrationRequired ? "Open Walk-in" : (event.teamType || "Individual")}
                    </span>
                  </div>
                  {!event.noRegistrationRequired && event.maxTeamSize && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-500">Team Size:</span>
                      <span className="font-bold text-slate-900">{event.minTeamSize || 1} – {event.maxTeamSize} Members</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Registration:</span>
                    <span className="font-bold text-[#E78023]">
                      {event.noRegistrationRequired
                        ? "Not Required (Walk-in)"
                        : isComingSoon
                        ? "Coming Soon"
                        : isUpcoming
                        ? (event.registrationStartDate ? `Starts on ${event.registrationStartDate}` : "Opening Soon")
                        : isCompleted
                        ? "Concluded"
                        : isDeadlinePassed
                        ? "Closed (Deadline Passed)"
                        : (event.registrationDeadline || "Open until slots filled")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Audience Eligibility:</span>
                    <span className={cn(
                      "font-bold text-xs flex items-center gap-1",
                      isJdcoemOnly ? "text-amber-700" : "text-emerald-700"
                    )}>
                      {isJdcoemOnly ? (
                        <>
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>JDCOEM Students Only</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-3.5 h-3.5" />
                          <span>Open to All Colleges</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Entry / Fee:</span>
                    <span className="font-bold text-emerald-600">
                      {event.noRegistrationRequired ? "Free Walk-in Entry" : (event.entryFee || "Free Entry")}
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                {event.noRegistrationRequired ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2 text-center">
                    <div className="flex items-center justify-center gap-1.5 font-bold text-xs uppercase tracking-wider text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>No Registration Required</span>
                    </div>
                    <p className="text-xs text-emerald-900/90 font-medium leading-relaxed">
                      This event is open for walk-in attendance. Simply arrive at <strong>{event.venue || "JDCOEM Campus"}</strong> on <strong>{event.date}</strong> at <strong>{event.time || "10:00 AM IST"}</strong>.
                    </p>
                  </div>
                ) : isComingSoon ? (
                  <div className="space-y-2">
                    <div className="w-full py-3.5 px-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Coming Soon</span>
                    </div>
                    <p className="text-[11px] text-slate-500 text-center font-medium leading-relaxed">
                      Dates, schedule, and registrations for this event are coming soon. Follow updates on this portal!
                    </p>
                  </div>
                ) : isRegistrationOpen ? (
                  isJdcoemOnly && isExternalStudent ? (
                    <div className="space-y-2">
                      <div className="w-full py-3.5 px-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>JDCOEM Students Only</span>
                      </div>
                      <p className="text-[11px] text-slate-500 text-center font-medium leading-relaxed">
                        Registration is strictly reserved for enrolled JDCOEM students. Non-JDCOEM visiting delegates cannot register for this specific listing.
                      </p>
                    </div>
                  ) : (
                    <Link
                      href={`/events/${event.slug}/register`}
                      className="w-full py-3.5 rounded-2xl bg-[#E78023] hover:bg-[#D26E17] text-white text-xs sm:text-sm font-bold uppercase tracking-wider text-center transition-all shadow-md shadow-[#E78023]/25 flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <span>REGISTER NOW</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  )
                ) : isUpcoming ? (
                  <div className="space-y-2">
                    <div className="w-full py-3.5 px-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Registration Opens Soon</span>
                    </div>
                    <p className="text-[11px] text-slate-500 text-center font-medium leading-relaxed">
                      {event.registrationStartDate
                        ? `Official registrations are scheduled to start on ${event.registrationStartDate}. Check back soon!`
                        : "Official registrations will open soon. Follow updates on this portal!"}
                    </p>
                  </div>
                ) : isCompleted ? (
                  <div className="w-full py-3.5 px-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Event Completed • Registration Closed</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-full py-3.5 px-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Registration Closed</span>
                    </div>
                    {isDeadlinePassed && event.registrationDeadline && (
                      <p className="text-[11px] text-slate-500 text-center font-medium leading-relaxed">
                        Registration closed on {event.registrationDeadline}.
                      </p>
                    )}
                  </div>
                )}

                {/* Coordinator Contact */}
                {event.coordinatorContact && (event.coordinatorContact.name?.trim() || event.coordinatorContact.phone?.trim()) && (
                  <div className="pt-4 border-t border-slate-100 text-xs space-y-1.5">
                    <span className="text-slate-400 uppercase font-extrabold text-[10px] tracking-wider block">
                      Event Helpdesk
                    </span>
                    {event.coordinatorContact.name?.trim() && (
                      <p className="font-semibold text-slate-800 leading-snug">
                        {event.coordinatorContact.name.trim()}
                        {event.coordinatorContact.role?.trim() && (
                          <span className="text-slate-500 font-normal"> ({event.coordinatorContact.role.trim()})</span>
                        )}
                      </p>
                    )}
                    {event.coordinatorContact.phone?.trim() && (
                      <a
                        href={`tel:${event.coordinatorContact.phone.trim().replace(/\s+/g, "")}`}
                        className="text-[#E78023] hover:text-[#c46816] font-bold flex items-center gap-1.5 transition-colors group w-fit"
                      >
                        <Phone className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                        <span className="hover:underline">{event.coordinatorContact.phone.trim()}</span>
                      </a>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="w-full py-3 px-4 rounded-2xl border-2 border-slate-200 hover:border-[#17458F] hover:bg-slate-50 text-slate-700 hover:text-[#17458F] text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:shadow-md active:scale-98"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4 text-[#17458F]" />}
                    <span>{copiedLink ? "Event Link Copied!" : "Share this Event"}</span>
                  </button>
                </div>

                {/* Official Compliance & Delegate Trust Box */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-[#17458F]/10 text-[#17458F]">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                        Official Delegate Assurance
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      All event passes &amp; entry receipts are officially issued by the Student Representative Council (SRC) under JDCOEM oversight.
                    </p>
                    <div className="pt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-slate-600">
                      <Link href="/refund-policy" className="text-[#17458F] hover:text-[#E78023] underline decoration-slate-300 underline-offset-2 transition-colors">
                        Refund Policy
                      </Link>
                      <span className="text-slate-300">•</span>
                      <Link href="/terms" className="text-[#17458F] hover:text-[#E78023] underline decoration-slate-300 underline-offset-2 transition-colors">
                        Terms of Entry
                      </Link>
                      <span className="text-slate-300">•</span>
                      <Link href="/privacy" className="text-[#17458F] hover:text-[#E78023] underline decoration-slate-300 underline-offset-2 transition-colors">
                        Privacy Charter
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-200">
        {event.isParentFest || subEvents.length > 0 ? (
          <div className="w-full flex items-center gap-2">
            <a
              href="#competitions"
              className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#17458F] text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2 border border-slate-200 min-h-[44px]"
            >
              <Layers className="w-4 h-4 text-[#17458F]" />
              <span>EXPLORE LINEUP &amp; EVENTS ({subEvents.length})</span>
              <ArrowDown className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={handleShare}
              className="p-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-[#17458F] text-xs font-bold flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer shadow-2xs"
              aria-label="Share event"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        ) : !event.noRegistrationRequired && isRegistrationOpen && !(isJdcoemOnly && isExternalStudent) ? (
          <>
            <div className="pl-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Registration Fee</span>
              <span className="text-xs font-bold text-emerald-600">{event.entryFee || "Free Entry"}</span>
            </div>
            <Link
              href={`/events/${event.slug}/register`}
              className="flex-1 py-3 px-4 rounded-xl bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2 shadow-md shadow-[#E78023]/25 min-h-[44px]"
            >
              <span>REGISTER NOW</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        ) : (
          <div className="w-full flex items-center gap-2">
            <div className="flex-1 py-3 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-1.5 min-h-[44px]">
              {isComingSoon ? (
                <>
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-amber-800">Coming Soon</span>
                </>
              ) : isUpcoming ? (
                <>
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-amber-800">Registration Opens Soon</span>
                </>
              ) : isCompleted ? (
                <span>Event Completed</span>
              ) : (
                <span>Registration Closed</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleShare}
              className="p-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-[#17458F] text-xs font-bold flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer shadow-2xs"
              aria-label="Share event"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
