"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, MapPin, Users, Layers, Sparkles, Share2, Check } from "lucide-react";
import { EventItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toastStore";
import { useSocialShare } from "@/context/SocialShareContext";

interface EventCardProps {
  event: EventItem;
  featuredLayout?: boolean;
}

const DEFAULT_EVENT_IMAGE = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop";

export function EventCard({ event, featuredLayout = false }: EventCardProps) {
  const isRegistrationOpen = event.status === "Registration Open";
  const isCompleted = event.status === "Completed";
  const isUpcoming = event.status === "Upcoming";

  const isDateComingSoon = Boolean(
    event.isDateTbd ||
    !event.date ||
    /\b(coming soon|to be announced|tba|to be decided|tbd)\b/i.test(event.date)
  );

  const statusVariant = isRegistrationOpen
    ? "orange"
    : isUpcoming
    ? "warning"
    : isCompleted
    ? "slate"
    : "navy";

  const eventImage = event.cardImage || event.poster || DEFAULT_EVENT_IMAGE;
  const [copied, setCopied] = useState(false);
  const { openShare } = useSocialShare();

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const canonicalUrl = `https://www.srcjdcoem.in/events/${event.slug}`;
    const heroImage = event.cardImage;

    openShare({
      type: "event",
      typeLabel: event.isParentFest ? "CAMPUS FESTIVAL" : event.category ? `${event.category.toUpperCase()} EVENT` : "CAMPUS EVENT",
      title: event.name,
      subtitle: event.description || event.tagline,
      description: event.description,
      imageUrl: heroImage,
      badge: event.targetAudience === "jdcoem_only" || event.isInterCollege === false ? "🎓 JDCOEM Only" : "🌐 Inter-College",
      date: event.date,
      time: event.time,
      venue: event.venue,
      organizer: event.organizer,
      entryFee: event.noRegistrationRequired ? "Open Walk-in" : event.entryFee || "Free Entry",
      ctaText: "Tap to Explore & Register",
      url: canonicalUrl,
    });
  };

  if (featuredLayout) {
    return (
      <div className="group rounded-3xl bg-white border border-slate-200 hover:border-[#17458F]/30 hover:shadow-xl transition-all duration-300 overflow-hidden shadow-xs flex flex-col lg:flex-row font-sans">
        
        {/* Poster / Card Image */}
        <div className="relative lg:w-3/5 h-64 sm:h-80 lg:h-auto overflow-hidden">
          <Image
            src={eventImage}
            alt={event.name || "Event Image"}
            fill
            unoptimized={true}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-black/60 via-transparent to-transparent" />

          {/* Badges on Image */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            {event.isParentFest ? (
              <span className="text-[10px] font-sans font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-600 text-white shadow-md flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>Umbrella Event</span>
              </span>
            ) : event.isFeatured ? (
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#E78023] text-white shadow-md flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Flagship Spotlight</span>
              </span>
            ) : null}
            <span className={cn(
              "text-[10px] font-sans font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md flex items-center gap-1",
              event.targetAudience === "jdcoem_only" || event.isInterCollege === false
                ? "bg-amber-500 text-white"
                : "bg-teal-600 text-white"
            )}>
              {event.targetAudience === "jdcoem_only" || event.isInterCollege === false ? "🎓 JDCOEM Only" : "🌐 Inter-College"}
            </span>
            {event.noRegistrationRequired ? (
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-md">
                Open Walk-in
              </span>
            ) : (
              <Badge variant={statusVariant} size="sm">
                {event.status}
              </Badge>
            )}
          </div>

          {/* Floating Share Button on Featured Banner */}
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share event"
            title="Share event link"
            className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white border border-white/25 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95 z-10 flex items-center gap-1.5 text-xs font-semibold"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Share"}</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 lg:w-2/5 flex flex-col justify-between space-y-6 bg-white">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#E78023] font-sans font-semibold uppercase tracking-wider">
              <span>{event.category}</span>
              {event.tagline && <span className="text-slate-500 font-medium">• {event.tagline}</span>}
            </div>

            {/* Event Title — Sora Bold */}
            <h3 className="font-heading font-bold text-2xl sm:text-3xl text-[#0F172A] tracking-tight group-hover:text-[#17458F] transition-colors">
              {event.name}
            </h3>

            <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed font-sans font-normal">
              {event.description}
            </p>

            {/* Event Metadata — Inter Medium */}
            <div className="pt-3 space-y-2 text-xs text-slate-600 border-t border-slate-100 font-sans font-medium">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#E78023] shrink-0" />
                <span className={cn("font-semibold", isDateComingSoon ? "text-amber-600 font-bold" : "text-[#0F172A]")}>
                  {event.date || "Coming Soon"}
                </span>
                {isDateComingSoon ? (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Date TBA
                  </span>
                ) : event.isMultiDay ? (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Multi-Day
                  </span>
                ) : null}
              </div>
              {event.time && (
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{event.time}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#17458F] shrink-0" />
                <span className="truncate">{event.venue}</span>
              </div>
              {event.organizer && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span className="text-slate-500 leading-snug">
                    Organized By: <strong className="text-[#17458F] font-semibold">{event.organizer}</strong>
                    {event.collaboratingClubs && event.collaboratingClubs.length > 0 && (
                      <span className="text-slate-500">
                        {" "}with{" "}
                        <strong className="text-slate-800 font-semibold">
                          {event.collaboratingClubs.map((c) => c.name).join(", ")}
                        </strong>
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
            <Link
              href={`/events/${event.slug}`}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#17458F] text-xs font-sans font-semibold uppercase tracking-wider text-center transition-colors cursor-pointer"
            >
              Details
            </Link>

            {event.isParentFest && (
              <Link
                href={`/events/${event.slug}#competitions`}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#17458F] to-[#0f2d5c] hover:from-[#123670] hover:to-[#0a2244] text-white text-xs font-sans font-bold uppercase tracking-wider text-center transition-all shadow-md shadow-[#17458F]/20 flex items-center justify-center cursor-pointer"
              >
                <span>Explore</span>
              </Link>
            )}
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="group rounded-2xl bg-white border border-slate-200 hover:border-[#17458F]/30 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xs font-sans">
      
      {/* Top Image Container */}
      <div className="relative h-48 w-full overflow-hidden">
        <Image
          src={eventImage}
          alt={event.name || "Event Image"}
          fill
          unoptimized={true}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        
        {/* Floating Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {event.isParentFest ? (
            <span className="text-[10px] font-sans font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-600 text-white shadow-xs flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>Umbrella Event</span>
            </span>
          ) : (
            <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E78023] text-white shadow-xs">
              {event.category}
            </span>
          )}
          <span className={cn(
            "text-[10px] font-sans font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1",
            event.targetAudience === "jdcoem_only" || event.isInterCollege === false
              ? "bg-amber-500 text-white"
              : "bg-teal-600 text-white"
          )}>
            {event.targetAudience === "jdcoem_only" || event.isInterCollege === false ? "🎓 JDCOEM Only" : "🌐 Inter-College"}
          </span>
          {event.noRegistrationRequired ? (
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
              Open Walk-in
            </span>
          ) : (
            <Badge variant={statusVariant} size="sm">
              {event.status}
            </Badge>
          )}
        </div>

        {/* Floating Share Button on Image */}
        <button
          type="button"
          onClick={handleShare}
          aria-label="Share event"
          title="Share event link"
          className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white border border-white/25 transition-all shadow-md cursor-pointer hover:scale-110 active:scale-95 z-10 flex items-center justify-center"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-white" />}
        </button>
      </div>

      {/* Bottom Card Content */}
      <div className="p-5 flex flex-col justify-between flex-1 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[#E78023] font-sans font-semibold uppercase tracking-wider">
            <span>{event.category}</span>
            {event.tagline && <span className="text-slate-400 font-medium truncate max-w-[140px]">• {event.tagline}</span>}
          </div>

          <h3 className="font-heading font-bold text-lg text-[#0F172A] tracking-tight group-hover:text-[#17458F] transition-colors line-clamp-1">
            {event.name}
          </h3>

          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-sans font-normal">
            {event.description}
          </p>
        </div>

        {/* Event Metadata — Inter Medium */}
        <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100 font-sans font-medium">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#E78023] shrink-0" />
            <span className={cn("font-semibold truncate", isDateComingSoon ? "text-amber-600 font-bold" : "text-[#0F172A]")}>
              {event.date || "Coming Soon"}
            </span>
            {isDateComingSoon ? (
              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                Date TBA
              </span>
            ) : event.isMultiDay ? (
              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                Multi-Day
              </span>
            ) : null}
          </div>
          {event.time && (
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{event.time}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <MapPin className="w-3.5 h-3.5 text-[#17458F] shrink-0" />
            <span className="truncate">{event.venue}</span>
          </div>
          {event.organizer && (
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                Organized by <strong className="text-slate-700 font-semibold">{event.organizer}</strong>
                {event.collaboratingClubs && event.collaboratingClubs.length > 0 && (
                  <span className="text-[#E78023] font-bold ml-1">
                    +{event.collaboratingClubs.length} co-host{event.collaboratingClubs.length > 1 ? "s" : ""}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons — Inter SemiBold */}
        <div className="pt-2 flex items-center gap-2">
          <Link
            href={`/events/${event.slug}`}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#17458F] text-xs font-sans font-semibold uppercase tracking-wider text-center transition-colors cursor-pointer"
          >
            Details
          </Link>

          {event.isParentFest && (
            <Link
              href={`/events/${event.slug}#competitions`}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#17458F] to-[#0f2d5c] hover:from-[#123670] hover:to-[#0a2244] text-white text-xs font-sans font-bold uppercase tracking-wider text-center transition-all shadow-xs hover:shadow-md flex items-center justify-center cursor-pointer"
            >
              <span>Explore</span>
            </Link>
          )}
        </div>
      </div>

    </div>
  );
}
