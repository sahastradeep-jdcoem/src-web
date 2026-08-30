import React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
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
  Trophy 
} from "lucide-react";
import { mockEvents } from "@/data/events";
import { Badge } from "@/components/ui/Badge";
import { Accordion } from "@/components/ui/Accordion";
import { ScheduleTimeline } from "@/components/events/ScheduleTimeline";
import { PrizeCard } from "@/components/events/PrizeCard";

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return mockEvents.map((event) => ({
    slug: event.slug,
  }));
}

export default async function EventDetailPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = mockEvents.find((e) => e.slug === slug);

  if (!event) {
    notFound();
  }

  const isRegistrationOpen = event.status === "Registration Open";

  const ruleAccordionItems = event.rules.map((rule, idx) => ({
    id: `rule-${idx}`,
    title: `Regulation 0${idx + 1}: ${rule.slice(0, 45)}...`,
    content: rule,
  }));

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-20">
      
      {/* 1. CINEMATIC HERO BANNER */}
      <section className="relative h-[55vh] sm:h-[60vh] flex items-end pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden bg-slate-900">
        {/* Background Poster */}
        <Image
          src={event.poster}
          alt={event.name}
          fill
          priority
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="max-w-7xl mx-auto w-full relative z-10 space-y-6">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-[#E78023] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Events</span>
          </Link>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#E78023] text-white">
                {event.category}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/90 text-slate-900">
                {event.status}
              </span>
              {event.tagline && (
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#E78023] ml-2">
                  • {event.tagline}
                </span>
              )}
            </div>

            <h1 className="font-extrabold text-4xl sm:text-6xl text-white tracking-tight uppercase">
              {event.name}
            </h1>
          </div>

          {/* Quick Info Bar */}
          <div className="flex flex-wrap items-center gap-6 sm:gap-8 pt-4 border-t border-white/20 text-xs sm:text-sm text-slate-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#E78023] shrink-0" />
              <span className="font-bold text-white">{event.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-300 shrink-0" />
              <span>{event.time}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E78023] shrink-0" />
              <span>{event.venue}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-300 shrink-0" />
              <span>Organized by: <strong className="text-white">{event.organizer}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MAIN CONTENT & STICKY REGISTRATION PANEL */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          
          {/* Left 2 Columns: Detailed Sections */}
          <div className="lg:col-span-2 space-y-16">
            
            {/* ABOUT */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#E78023]">
                <Sparkles className="w-4 h-4" />
                <span>Overview</span>
              </div>
              <h2 className="font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                ABOUT THE EVENT
              </h2>
              <p className="text-slate-700 leading-relaxed text-sm sm:text-base font-medium">
                {event.about}
              </p>
            </section>

            {/* WHAT TO EXPECT */}
            {event.whatToExpect && event.whatToExpect.length > 0 && (
              <section className="space-y-6">
                <h2 className="font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                  WHAT TO EXPECT
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {event.whatToExpect.map((item, index) => (
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
            )}

            {/* SCHEDULE TIMELINE */}
            {event.schedule && event.schedule.length > 0 && (
              <section className="space-y-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
                    Event Sequence
                  </span>
                  <h2 className="font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                    SCHEDULE & ITINERARY
                  </h2>
                </div>
                <ScheduleTimeline schedule={event.schedule} />
              </section>
            )}

            {/* PRIZES & RECOGNITION */}
            {event.prizes && event.prizes.length > 0 && (
              <section className="space-y-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                    <Trophy className="w-4 h-4" />
                    <span>Rewards & Laurels</span>
                  </span>
                  <h2 className="font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                    PRIZES & RECOGNITION
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {event.prizes.map((prize, idx) => (
                    <PrizeCard key={idx} prize={prize} index={idx} />
                  ))}
                </div>
              </section>
            )}

            {/* RULES & GUIDELINES ACCORDION */}
            {event.rules && event.rules.length > 0 && (
              <section className="space-y-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
                    Official Code of Conduct
                  </span>
                  <h2 className="font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                    RULES & GUIDELINES
                  </h2>
                </div>
                <Accordion items={ruleAccordionItems} />
              </section>
            )}

          </div>

          {/* Right Column: Sticky Registration Card */}
          <div className="lg:sticky lg:top-24 space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
              <div className="space-y-2">
                <Badge variant={isRegistrationOpen ? "orange" : "slate"} size="md">
                  {event.status}
                </Badge>
                <h3 className="font-extrabold text-2xl text-[#0F172A]">
                  Registration Portal
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Secure your official entry pass for {event.name}.
                </p>
              </div>

              {/* Specs Breakdown */}
              <div className="space-y-3 pt-4 border-t border-slate-100 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Participation Format:</span>
                  <span className="font-bold text-slate-900">{event.teamType}</span>
                </div>
                {event.maxTeamSize && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Team Size:</span>
                    <span className="font-bold text-slate-900">{event.minTeamSize} – {event.maxTeamSize} Members</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-500">Registration Closes:</span>
                  <span className="font-bold text-[#E78023]">{event.registrationDeadline}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Fee:</span>
                  <span className="font-bold text-emerald-600">{event.entryFee || "Free Entry"}</span>
                </div>
              </div>

              {/* Action Button */}
              {isRegistrationOpen ? (
                <Link
                  href={`/events/${event.slug}/register`}
                  className="w-full py-3.5 rounded-2xl bg-[#E78023] hover:bg-[#D26E17] text-white text-xs sm:text-sm font-bold uppercase tracking-wider text-center transition-all shadow-md shadow-[#E78023]/25 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <span>REGISTER NOW</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              ) : (
                <div className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider text-center">
                  Registration Closed
                </div>
              )}

              {/* Coordinator Contact */}
              {event.coordinatorContact && (
                <div className="pt-4 border-t border-slate-100 text-xs space-y-1">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">
                    Event Helpdesk
                  </span>
                  <p className="font-semibold text-slate-800">{event.coordinatorContact.name} ({event.coordinatorContact.role})</p>
                  <p className="text-[#E78023] font-bold flex items-center gap-1.5">
                    <Phone className="w-3 h-3" />
                    <span>{event.coordinatorContact.phone}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
