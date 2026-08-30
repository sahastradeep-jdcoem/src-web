import React from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Instagram, 
  Linkedin, 
  Mail, 
  MapPin, 
  Phone, 
  ChevronRight
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 pt-16 pb-12 text-slate-700">
      
      {/* Top Accent Line */}
      <div className="h-1 bg-gradient-to-r from-[#17458F] via-[#E78023] to-[#3D406B] -mt-16 mb-16" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Logos Row */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 pb-12 border-b border-slate-200">
          
          <div className="flex flex-wrap items-center gap-6 sm:gap-10">
            {/* SRC Horizontal B Logo */}
            <div className="relative h-11 w-48 sm:w-56">
              <Image
                src="/assets/SRC Horizontal B.png"
                alt="SRC Sahastradeep"
                fill
                className="object-contain object-left"
              />
            </div>

            <div className="hidden sm:block h-6 w-px bg-slate-300" />

            {/* JDCOEM Dark Header Logo */}
            <div className="relative h-10 w-44 sm:w-52">
              <Image
                src="/assets/JD B Short Header.png"
                alt="JD College of Engineering & Management"
                fill
                className="object-contain object-left"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#E78023]" />
            <span className="text-xs font-bold tracking-wider text-[#17458F] uppercase">
              12 Chartered Clubs • 1 Unified Voice
            </span>
          </div>

        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 py-12">
          
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-extrabold text-lg text-[#17458F] tracking-wide flex items-center gap-2">
              <span>SAHASTRADEEP</span>
              <span className="text-[#E78023] text-sm font-normal">सहस्रदीप</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pr-4">
              The official Student Representative Council (SRC) of JD College of Engineering & Management, Nagpur. Empowering students, incubating leadership, championing diverse clubs, and orchestrating premier collegiate fests.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#E78023] hover:border-[#E78023]/40 shadow-sm transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#17458F] hover:border-[#17458F]/40 shadow-sm transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="mailto:src@jdcoem.ac.in"
                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#E78023] hover:border-[#E78023]/40 shadow-sm transition-colors"
                aria-label="Email SRC"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Explore */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#E78023]">
              Explore
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/events" className="hover:text-[#17458F] transition-colors flex items-center gap-1.5 font-medium">
                  <ChevronRight className="w-3 h-3 text-[#17458F]" />
                  <span>Events & Fests</span>
                </Link>
              </li>
              <li>
                <Link href="/clubs" className="hover:text-[#17458F] transition-colors flex items-center gap-1.5 font-medium">
                  <ChevronRight className="w-3 h-3 text-[#17458F]" />
                  <span>12 Student Clubs</span>
                </Link>
              </li>
              <li>
                <Link href="/team" className="hover:text-[#17458F] transition-colors flex items-center gap-1.5 font-medium">
                  <ChevronRight className="w-3 h-3 text-[#17458F]" />
                  <span>Council Officers & Leads</span>
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="hover:text-[#17458F] transition-colors flex items-center gap-1.5 font-medium">
                  <ChevronRight className="w-3 h-3 text-[#17458F]" />
                  <span>Moments Gallery</span>
                </Link>
              </li>
              <li>
                <Link href="/prarambh" className="hover:text-[#17458F] transition-colors flex items-center gap-1.5 font-medium">
                  <ChevronRight className="w-3 h-3 text-[#17458F]" />
                  <span>Prarambh Legacy</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Portals */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#E78023]">
              Portals & Info
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/dashboard" className="hover:text-[#17458F] transition-colors flex items-center gap-1.5 font-medium">
                  <ChevronRight className="w-3 h-3 text-[#17458F]" />
                  <span>Student Dashboard</span>
                </Link>
              </li>
              <li>
                <Link href="/events/prarambh/register" className="hover:text-[#17458F] transition-colors flex items-center gap-1.5 font-medium">
                  <ChevronRight className="w-3 h-3 text-[#17458F]" />
                  <span>Ticket Registration</span>
                </Link>
              </li>
              <li>
                <Link href="/archive" className="hover:text-[#17458F] transition-colors flex items-center gap-1.5 font-medium">
                  <ChevronRight className="w-3 h-3 text-[#17458F]" />
                  <span>Historical Archive</span>
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-[#17458F] transition-colors flex items-center gap-1.5 font-medium">
                  <ChevronRight className="w-3 h-3 text-[#17458F]" />
                  <span>Constitution & Charter</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#E78023]">
              Secretariat
            </h4>
            <div className="space-y-2.5 text-xs text-slate-600">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#E78023] shrink-0 mt-0.5" />
                <span>JDCOEM, Katol Road, Nagpur, Maharashtra — 441501</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#E78023] shrink-0" />
                <span>+91 712 281 0000 / 01</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#E78023] shrink-0" />
                <span>src@jdcoem.ac.in</span>
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Strip */}
        <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2025–26 SRC JDCOEM — Sahastradeep. All rights reserved.</p>
          <div className="flex items-center gap-4 font-semibold text-slate-600">
            <span className="text-[#17458F]">Student Representative Council</span>
            <span className="text-[#E78023]">•</span>
            <span>JDCOEM Nagpur</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
