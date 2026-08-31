"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  Search, 
  QrCode, 
  UserCheck, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Users,
  AlertCircle
} from "lucide-react";
import { getAllRegistrationsFromFirestore, StudentRegistrationRecord } from "@/lib/firebase/firestore";
import { Badge } from "@/components/ui/Badge";

export default function GateScannerHubPage() {
  const router = useRouter();
  const [passInput, setPassInput] = useState("");
  const [recentCheckedIn, setRecentCheckedIn] = useState<StudentRegistrationRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, checkedIn: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
        const cloud = await getAllRegistrationsFromFirestore();
        const all: StudentRegistrationRecord[] = cloud && cloud.length > 0 ? cloud : local;

        const checkedInCount = all.filter((r) => r.status === "CHECKED_IN").length;
        setStats({
          total: all.length,
          checkedIn: checkedInCount,
          pending: Math.max(0, all.length - checkedInCount),
        });

        const recent = all
          .filter((r) => r.status === "CHECKED_IN")
          .slice(0, 5);
        setRecentCheckedIn(recent);
      } catch (e) {
        console.warn("Could not load registration stats", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passInput.trim()) return;

    // Handle both direct ID or full URL pasted from scanner
    let id = passInput.trim();
    if (id.includes("/verify/")) {
      id = id.split("/verify/")[1].split("?")[0];
    } else if (id.includes("passId=")) {
      const match = id.match(/passId=([^&]+)/);
      if (match) id = match[1];
    }

    router.push(`/verify/${encodeURIComponent(id)}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-start p-4 sm:p-6 lg:p-10 font-sans">
      <div className="w-full max-w-xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
          >
            &larr; SRC JDCOEM
          </Link>
          <span className="px-3 py-1 rounded-full bg-[#17458F]/40 border border-[#17458F] text-[11px] font-bold text-blue-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#E78023]" />
            <span>Gate Accreditation Hub</span>
          </span>
        </div>

        {/* Hero Portal Card */}
        <div className="rounded-3xl bg-slate-900 border border-white/10 p-6 sm:p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-3xl bg-[#E78023]/10 border border-[#E78023]/30 flex items-center justify-center mx-auto text-[#E78023]">
            <QrCode className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
              Pass Verification &amp; Check-In
            </h1>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed font-medium">
              Scan participant QR passes with your smartphone camera or enter the pass ID below to authenticate genuine credentials.
            </p>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Total Passes</span>
              <p className="font-extrabold text-lg text-white font-heading">{stats.total}</p>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/20">
              <span className="text-[10px] font-mono text-emerald-400 uppercase">Checked In</span>
              <p className="font-extrabold text-lg text-emerald-400 font-heading">{stats.checkedIn}</p>
            </div>
            <div className="p-3 rounded-2xl bg-blue-950/30 border border-blue-500/20">
              <span className="text-[10px] font-mono text-blue-400 uppercase">Pending</span>
              <p className="font-extrabold text-lg text-blue-300 font-heading">{stats.pending}</p>
            </div>
          </div>
        </div>

        {/* Manual Pass ID / URL Lookup Form */}
        <form onSubmit={handleLookup} className="rounded-3xl bg-slate-900 border border-white/10 p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#E78023]" />
              <span>Verify Pass by ID or Token</span>
            </label>
            <p className="text-[11px] text-slate-500 font-medium">
              Enter Pass ID (e.g. <code className="text-[#E78023]">reg-174092...</code>) or paste scanner output:
            </p>
          </div>

          <div className="relative">
            <input
              type="text"
              required
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              placeholder="Paste Pass ID or Scan Token..."
              className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-slate-950 border border-white/15 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#E78023]"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-[#E78023] hover:bg-[#D26E17] text-white transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-[#17458F] hover:bg-[#123670] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-[#E78023]" />
            <span>Verify &amp; Open Accreditation</span>
          </button>
        </form>

        {/* Recent Check-Ins List */}
        {recentCheckedIn.length > 0 && (
          <div className="rounded-3xl bg-slate-900 border border-white/10 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Recent Gate Check-Ins</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Live Roster</span>
            </div>

            <div className="space-y-2">
              {recentCheckedIn.map((r) => (
                <Link
                  key={r.id}
                  href={`/verify/${r.id}`}
                  className="p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-white/5 flex items-center justify-between text-xs transition-colors group"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block group-hover:text-[#E78023] transition-colors">
                      {r.leaderName}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {r.eventTitle || r.eventId} • {r.department}
                    </span>
                  </div>
                  <Badge variant="success" size="sm">
                    CHECKED IN
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
