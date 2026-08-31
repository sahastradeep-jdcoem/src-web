import React from "react";
import Link from "next/link";
import { Compass, Home, Calendar, Users, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center space-y-8 p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
        <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#17458F] to-[#2563EB] flex items-center justify-center text-white shadow-lg shadow-[#17458F]/20">
          <Compass className="w-10 h-10 animate-spin" style={{ animationDuration: "12s" }} />
          <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md bg-[#E78023] text-white text-[10px] font-mono font-extrabold shadow-sm">
            404
          </span>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#E78023]">
            Page Not Found
          </span>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-slate-900 tracking-tight">
            Lost on Campus?
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
            The page you are looking for has been moved, renamed, or does not exist in the official JDCOEM SRC portal.
          </p>
        </div>

        {/* Quick Navigate Shortcuts */}
        <div className="grid grid-cols-2 gap-3 pt-2 text-left">
          <Link
            href="/events"
            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-[#17458F]/40 hover:bg-[#17458F]/5 transition-all group"
          >
            <Calendar className="w-4 h-4 text-[#17458F] mb-1.5" />
            <p className="text-xs font-bold text-slate-900 group-hover:text-[#17458F] transition-colors">
              Council Events
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Browse active fests</p>
          </Link>

          <Link
            href="/clubs"
            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-[#E78023]/40 hover:bg-[#E78023]/5 transition-all group"
          >
            <Sparkles className="w-4 h-4 text-[#E78023] mb-1.5" />
            <p className="text-xs font-bold text-slate-900 group-hover:text-[#E78023] transition-colors">
              12 Student Clubs
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Explore charters</p>
          </Link>

          <Link
            href="/prarambh"
            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-[#17458F]/40 hover:bg-[#17458F]/5 transition-all group"
          >
            <Sparkles className="w-4 h-4 text-[#17458F] mb-1.5" />
            <p className="text-xs font-bold text-slate-900 group-hover:text-[#17458F] transition-colors">
              PRARAMBH Fest
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Flagship extravaganza</p>
          </Link>

          <Link
            href="/team"
            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-[#E78023]/40 hover:bg-[#E78023]/5 transition-all group"
          >
            <Users className="w-4 h-4 text-[#E78023] mb-1.5" />
            <p className="text-xs font-bold text-slate-900 group-hover:text-[#E78023] transition-colors">
              Council Roster
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Student leadership</p>
          </Link>
        </div>

        <div>
          <Link href="/">
            <Button variant="primary" size="md" className="gap-2 shadow-lg shadow-[#17458F]/20">
              <Home className="w-4 h-4" />
              <span>Return to Sahastradeep Home</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
