import React from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  ShieldCheck, 
  Sparkles, 
  Target, 
  Eye, 
  Users, 
  Compass, 
  CheckCircle2, 
  ArrowRight,
  Award,
  Layers
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import BrandStrip from "@/components/layout/BrandStrip";

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
      desc: "Incubating administrative acumen, crisis handling, event production, and team governance in student executives.",
    },
    {
      title: "Represent Student Voices",
      desc: "Serving as the trusted, democratic conduit between students, faculty advisors, department deans, and university trustees.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 space-y-20">
      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Page Header */}
        <div className="space-y-4 max-w-3xl">
          <Badge variant="orange" size="md">
            COUNCIL CHARTER & IDENTITY
          </Badge>
          <h1 className="font-extrabold text-4xl sm:text-6xl text-[#0F172A] tracking-tight uppercase leading-none">
            BUILT BY STUDENTS.
            <br />
            <span className="text-[#E78023]">FOR STUDENTS.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            The official Student Representative Council (Sahastradeep) of JD College of Engineering & Management, Nagpur.
          </p>
        </div>

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
                DUAL-TIER GOVERNANCE
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Sahastradeep functions through a comprehensive governance model: the <strong>Central Admin Council</strong> (16 executive positions overseeing institutional policies, event operations, technical systems, PR, finance, and protocol), specialized <strong>Hosting & Spokesperson Delegations</strong>, and the <strong>Club Leadership Council</strong> (managing day-to-day domain activities across 12 chartered clubs).
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

        {/* SECTION 4: INSTITUTIONAL BRAND STRIP */}
        <div className="pt-8">
          <BrandStrip />
        </div>

      </div>
    </div>
  );
}
