import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, Users, ArrowRight, Layers } from "lucide-react";
import { EventItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: EventItem;
  featuredLayout?: boolean;
}

export function EventCard({ event, featuredLayout = false }: EventCardProps) {
  const isRegistrationOpen = event.status === "Registration Open";
  const isCompleted = event.status === "Completed";

  const statusVariant = isRegistrationOpen
    ? "orange"
    : isCompleted
    ? "slate"
    : "navy";

  if (featuredLayout) {
    return (
      <div className="group rounded-3xl bg-white border border-slate-200 hover:border-[#17458F]/30 hover:shadow-xl transition-all duration-300 overflow-hidden shadow-xs flex flex-col lg:flex-row font-sans">
        
        {/* Poster / Card Image */}
        <div className="relative lg:w-3/5 h-64 sm:h-80 lg:h-auto overflow-hidden">
          <Image
            src={event.cardImage || event.poster}
            alt={event.name}
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
                <span>Umbrella Festival</span>
              </span>
            ) : (
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#E78023] text-white shadow-md">
                Featured Fest
              </span>
            )}
            <Badge variant={statusVariant} size="sm">
              {event.status}
            </Badge>
          </div>
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
                <span className="font-semibold text-[#0F172A]">{event.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#17458F] shrink-0" />
                <span className="truncate">{event.venue}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-slate-500">Organized By: <strong className="text-[#17458F] font-semibold">{event.organizer}</strong></span>
              </div>
            </div>
          </div>

          {/* Action CTAs — Inter SemiBold */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <Link
              href={`/events/${event.slug}`}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#17458F] text-xs font-sans font-semibold uppercase tracking-wider text-center transition-all cursor-pointer"
            >
              Event Details
            </Link>

            {event.isParentFest ? (
              <Link
                href={`/events/${event.slug}#competitions`}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#17458F] to-[#0f2d5c] hover:from-[#123670] hover:to-[#0a2244] text-white text-xs font-sans font-bold uppercase tracking-wider text-center transition-all shadow-md shadow-[#17458F]/20 flex items-center justify-center gap-2 cursor-pointer group/btn"
              >
                <Layers className="w-3.5 h-3.5 text-[#E78023]" />
                <span>Explore Lineup</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
              </Link>
            ) : isRegistrationOpen ? (
              <Link
                href={`/events/${event.slug}/register`}
                className="flex-1 py-3 px-4 rounded-xl bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-sans font-semibold uppercase tracking-wider text-center transition-all shadow-md shadow-[#E78023]/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Register</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : null}
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
          src={event.cardImage || event.poster}
          alt={event.name}
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
              <span>Umbrella Fest</span>
            </span>
          ) : (
            <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E78023] text-white shadow-xs">
              {event.category}
            </span>
          )}
          <Badge variant={statusVariant} size="sm">
            {event.status}
          </Badge>
        </div>
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
            <span className="font-semibold text-[#0F172A]">{event.date}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <MapPin className="w-3.5 h-3.5 text-[#17458F] shrink-0" />
            <span className="truncate">{event.venue}</span>
          </div>
        </div>

        {/* Action Buttons — Inter SemiBold */}
        <div className="pt-2 flex items-center gap-2">
          <Link
            href={`/events/${event.slug}`}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#17458F] text-xs font-sans font-semibold uppercase tracking-wider text-center transition-colors cursor-pointer"
          >
            Details
          </Link>

          {event.isParentFest ? (
            <Link
              href={`/events/${event.slug}#competitions`}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#17458F] to-[#0f2d5c] hover:from-[#123670] hover:to-[#0a2244] text-white text-xs font-sans font-bold uppercase tracking-wider text-center transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer group/btn"
            >
              <Layers className="w-3.5 h-3.5 text-[#E78023]" />
              <span>Explore Lineup</span>
              <ArrowRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5" />
            </Link>
          ) : isRegistrationOpen ? (
            <Link
              href={`/events/${event.slug}/register`}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-sans font-semibold uppercase tracking-wider text-center transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Register</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          ) : (
            <span className="flex-1 py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-xs font-sans font-medium uppercase tracking-wider text-center">
              {event.status}
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
