import React from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight, 
  Sparkles, 
  Calendar, 
  Users, 
  Award, 
  Flame, 
  ChevronRight, 
  Layers, 
  ShieldCheck,
  Zap,
  MapPin
} from "lucide-react";
import BrandStrip from "@/components/layout/BrandStrip";
import HeroSection from "@/components/home/HeroSection";
import HomeClubsSection from "@/components/home/HomeClubsSection";
import HomeEventsSection from "@/components/home/HomeEventsSection";
import { mockClubs } from "@/data/clubs";
import { Badge } from "@/components/ui/Badge";

export default function HomePage() {
  return (
    <div className="relative bg-[#F8FAFC] text-[#0F172A] min-h-screen font-sans">
      
      {/* 1. CENTERED HERO SECTION WITH PARALLAX BACKDROP & 3D LOGO DISSOLVE */}
      <HeroSection />

      {/* 2. INSTITUTIONAL BRAND STRIP */}
      <BrandStrip />

      {/* 3. CLEAN INSTITUTIONAL PILLARS */}
      <section id="explore" className="py-16 px-4 sm:px-6 lg:px-8 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Stat 1 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5 hover:border-[#17458F]/30 hover:shadow-md transition-all">
              <span className="font-heading font-extrabold text-3xl sm:text-4xl text-[#E78023] tracking-tight block">
                {mockClubs.length}
              </span>
              <h4 className="text-xs sm:text-sm font-sans font-semibold uppercase tracking-wider text-[#17458F]">
                Chartered Clubs
              </h4>
              <p className="text-xs text-slate-500 font-sans font-medium">Cultural, Tech, Media & Sports</p>
            </div>

            {/* Stat 2 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5 hover:border-[#17458F]/30 hover:shadow-md transition-all">
              <span className="font-heading font-extrabold text-3xl sm:text-4xl text-[#E78023] tracking-tight block">
                Unified
              </span>
              <h4 className="text-xs sm:text-sm font-sans font-semibold uppercase tracking-wider text-[#17458F]">
                Student Council
              </h4>
              <p className="text-xs text-slate-500 font-sans font-medium">Council Admins &amp; Officers</p>
            </div>

            {/* Stat 3 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5 hover:border-[#17458F]/30 hover:shadow-md transition-all">
              <span className="font-heading font-extrabold text-3xl sm:text-4xl text-[#17458F] tracking-tight block">
                Official
              </span>
              <h4 className="text-xs sm:text-sm font-sans font-semibold uppercase tracking-wider text-[#17458F]">
                JDCOEM Portal
              </h4>
              <p className="text-xs text-slate-500 font-sans font-medium">Autonomous &amp; Student-Driven</p>
            </div>

            {/* Stat 4 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5 hover:border-[#17458F]/30 hover:shadow-md transition-all">
              <span className="font-heading font-extrabold text-3xl sm:text-4xl text-[#E78023] tracking-tight block">
                100%
              </span>
              <h4 className="text-xs sm:text-sm font-sans font-semibold uppercase tracking-wider text-[#17458F]">
                Opportunities
              </h4>
              <p className="text-xs text-slate-500 font-sans font-medium">Leadership, Fests &amp; Impact</p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. FEATURED EVENTS (DYNAMIC FROM ADMIN STUDIO) */}
      <HomeEventsSection />

      {/* 5. DYNAMIC CLUBS ECOSYSTEM */}
      <HomeClubsSection />

      {/* 6. PRARAMBH INCEPTION SPOTLIGHT — Sora Bold Section Heading */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl bg-white border border-slate-200 p-8 sm:p-12 lg:p-14 flex flex-col lg:flex-row items-center justify-between gap-10 shadow-xs">
            
            <div className="space-y-5 max-w-2xl">
              <Badge variant="orange" size="md">
                FOUNDATION MILESTONE
              </Badge>

              <div className="space-y-1.5">
                {/* Heading — Sora Bold */}
                <h2 className="font-section text-3xl sm:text-4xl text-[#17458F] tracking-tight">
                  PRARAMBH
                </h2>
                <p className="text-base font-sans font-semibold text-[#E78023] uppercase tracking-wide">
                  THE BEGINNING OF SAHASTRADEEP
                </p>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed font-sans font-normal">
                The inaugural foundation ceremony that unified all twelve collegiate societies under a single, autonomous student council — badging the first council admins and lighting the perpetual lamp of student leadership.
              </p>

              <div className="pt-2">
                <Link
                  href="/prarambh"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-sans font-semibold uppercase tracking-wider shadow-md shadow-[#E78023]/25 transition-all cursor-pointer"
                >
                  <span>Discover Prarambh History</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Emblem Image Asset */}
            <div className="flex flex-col items-center">
              <div className="relative h-44 w-44 sm:h-52 sm:w-52 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shadow-inner">
                <Image
                  src="/assets/SRC Logo.png"
                  alt="Sahastradeep Emblem"
                  fill
                  className="object-contain p-3"
                />
              </div>
              <span className="text-xs font-sans font-semibold text-[#17458F] mt-3 uppercase tracking-wider">
                Official Sahastradeep Seal
              </span>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
