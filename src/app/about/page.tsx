import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { 
  ShieldCheck, 
  Target, 
  Eye, 
  Users, 
  Compass, 
  CheckCircle2, 
  ArrowRight,
  Award,
  Layers,
  Palette,
  Code2,
  Linkedin
} from "lucide-react";
import BrandStrip from "@/components/layout/BrandStrip";
import { PillarsOfStrengthSection } from "@/components/team/PillarsOfStrengthSection";

import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about the mission, vision, history, and patron leadership of the Student Representative Council (SRC) at JD College of Engineering & Management, Nagpur.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/about",
  },
  openGraph: {
    title: "About Us | SAHASTRADEEP • SRC JDCOEM",
    description: "Discover the governance, institutional pillars, and founding history of the Student Representative Council of JDCOEM Nagpur.",
    url: "https://www.srcjdcoem.in/about",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "About Us | SAHASTRADEEP • SRC JDCOEM",
    description: "Discover the governance, institutional pillars, and founding history of the Student Representative Council of JDCOEM Nagpur.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

export default function AboutPage() {
  const missionPillars = [
    {
      title: "Empower Student Talent",
      desc: "Providing national stage platforms, advanced workshop resources, and funding grants to nurture technical and creative excellence.",
    },
    {
      title: "Build Communities",
      desc: "Creating tight-knit clubs across 12 distinct domains where every student finds peers who share their genuine passion.",
    },
    {
      title: "Encourage Participation",
      desc: "Fostering inclusive campus fests, sports leagues, and hackathons with accessible entry pathways for all academic years.",
    },
    {
      title: "Create Meaningful Experiences",
      desc: "Orchestrating unforgettable milestones like Vibrance, Prarambh, and Clash of Departments that define college life.",
    },
    {
      title: "Develop Leadership",
      desc: "Incubating administrative acumen, crisis handling, event production, and team governance in student leaders.",
    },
    {
      title: "Represent Student Voices",
      desc: "Serving as the trusted, democratic conduit between students, faculty advisors, department deans, and university trustees.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 space-y-20">
      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Pillars header + cards (open layout) */}
        <PillarsOfStrengthSection boxed={false} />

        {/* SECTION 1: WHAT IS SAHASTRADEEP? */}
        <section className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-sm relative overflow-hidden">
          <div className="max-w-4xl space-y-4 relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Institutional Role</span>
            </span>
            <h2 className="font-extrabold text-2xl sm:text-4xl text-[#17458F] uppercase">
              WHAT IS SAHASTRADEEP?
            </h2>
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
              The <strong>Student Representative Council (SRC)</strong>, officially branded as <strong>Sahastradeep (सहस्रदीप)</strong>, is the apex student governance body of <strong>JD College of Engineering & Management, Nagpur</strong>.
            </p>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              SRC is responsible for the unified administration of all 12 student clubs, inter-departmental competitions, college festivals, cultural activities, technical symposia, and active student representation before the college management.
            </p>
          </div>
        </section>

        {/* SECTION 2: VISION & CORE CREED */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          
          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#E78023] flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>Our Vision</span>
              </span>
              <h2 className="font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                A STRONGER STUDENT ECOSYSTEM
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                To build an autonomous, vibrant student-driven community where every young engineer and manager can discover their potential, participate fearlessly, lead initiatives, and leave an enduring campus legacy.
              </p>
            </div>

            {/* 5 Vision Verbs */}
            <div className="pt-6 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider block mb-2">
                Five Guiding Tenets:
              </span>
              <div className="flex flex-wrap gap-2">
                {["Discover", "Participate", "Create", "Lead", "Represent"].map((verb) => (
                  <span
                    key={verb}
                    className="px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[#17458F] text-xs font-bold uppercase tracking-wider"
                  >
                    {verb}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#17458F] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#E78023]" />
                <span>Council Structure</span>
              </span>
              <h2 className="font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase">
                FIVE-TIER GOVERNANCE
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Sahastradeep functions through an official five-tier hierarchy: <strong>Admins</strong> (overseeing institutional policies, event operations, technical systems, PR, finance, and protocol), <strong>Spokespersons</strong> (Hosting Committee and official student spokespersons), <strong>Heads</strong> and <strong>Co-Heads</strong> (managing domain operations across all 12 chartered clubs), and inducted student <strong>Members</strong>.
              </p>
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Read profile rosters of all council officers:
              </span>
              <Link
                href="/team"
                className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#E78023] hover:text-[#D26E17]"
              >
                <span>View Team</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

        </section>

        {/* SECTION 3: MISSION PILLARS */}
        <section className="space-y-8">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
              Strategic Commitment
            </span>
            <h2 className="font-extrabold text-3xl sm:text-4xl text-[#0F172A] uppercase">
              OUR MISSION PILLARS
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Every initiative, competition, and council resolution is anchored in these six objectives.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {missionPillars.map((pillar, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-[#17458F]/30 hover:shadow-md transition-all space-y-3 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[#E78023] font-extrabold text-sm">
                    0{idx + 1}
                  </span>
                  <h3 className="font-bold text-base text-[#17458F]">
                    {pillar.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {pillar.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: PERMANENT STUDENT CREDITS */}
        <section id="credits" className="space-y-8 pt-4">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <h2 className="font-extrabold text-3xl sm:text-4xl text-[#0F172A] uppercase">
              CREATIVE &amp; TECHNICAL CREDITS
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Honoring the student architects behind the foundational visual identity
              <br className="hidden sm:inline" /> and digital web platform of Sahastradeep.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto items-stretch">
            
            {/* Card 1: SRC Logo Design */}
            <div className="p-7 sm:p-8 rounded-3xl bg-white border border-slate-200 hover:border-[#E78023]/40 shadow-sm transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-2xl bg-[#E78023]/10 border border-[#E78023]/20 flex items-center justify-center text-[#E78023]">
                    <Palette className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                    Brand Identity
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-xl text-[#0F172A]">
                    SRC Logo Design
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    Conceptualized and designed the official Sahastradeep insignia, crest geometry, and institutional visual brand identity.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                  Design Contributors
                </span>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 hover:bg-slate-100/70 transition-colors">
                    <div>
                      <h4 className="font-bold text-sm text-[#0F172A]">Gokul Pawar</h4>
                      <p className="text-xs text-slate-500 font-medium">DS 2nd Yr (2025–26)</p>
                    </div>
                    <a
                      href="https://www.linkedin.com/in/gokul-pawar-612664333/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-[#0077B5] hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5] shadow-xs text-xs font-semibold transition-all min-h-[44px] min-w-[44px] justify-center"
                      aria-label="Gokul Pawar LinkedIn Profile"
                    >
                      <Linkedin className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">LinkedIn</span>
                    </a>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 hover:bg-slate-100/70 transition-colors">
                    <div>
                      <h4 className="font-bold text-sm text-[#0F172A]">Sakshant Waghmare</h4>
                      <p className="text-xs text-slate-500 font-medium">DS (2025–26)</p>
                    </div>
                    <a
                      href="https://www.linkedin.com/in/sakshant-waghmare-51340b384/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-[#0077B5] hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5] shadow-xs text-xs font-semibold transition-all min-h-[44px] min-w-[44px] justify-center"
                      aria-label="Sakshant Waghmare LinkedIn Profile"
                    >
                      <Linkedin className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">LinkedIn</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: SRC Website Development */}
            <div className="p-7 sm:p-8 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F]/40 shadow-sm transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-2xl bg-[#17458F]/10 border border-[#17458F]/20 flex items-center justify-center text-[#17458F]">
                    <Code2 className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                    Digital Platform
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-xl text-[#0F172A]">
                    SRC Website Development
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    Architected and engineered the official web portal, real-time event systems, ticketing workflows, and student console architecture.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                  Engineering Lead
                </span>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 hover:bg-slate-100/70 transition-colors">
                    <div>
                      <h4 className="font-bold text-sm text-[#0F172A]">Harsh Shende</h4>
                      <p className="text-xs text-slate-500 font-medium">CSE 4th Yr. (2026–27)</p>
                    </div>
                    <a
                      href="https://www.linkedin.com/in/harsh-shende-xfr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-[#0077B5] hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5] shadow-xs text-xs font-semibold transition-all min-h-[44px] min-w-[44px] justify-center"
                      aria-label="Harsh Shende LinkedIn Profile"
                    >
                      <Linkedin className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">LinkedIn</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 5: INSTITUTIONAL BRAND STRIP */}
        <div className="pt-8">
          <BrandStrip />
        </div>

      </div>
    </div>
  );
}
