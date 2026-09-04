"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Vote, 
  Briefcase, 
  Users, 
  UploadCloud, 
  ShieldAlert, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Search, 
  Check, 
  AlertCircle,
  Lock,
  ExternalLink,
  GraduationCap,
  Globe
} from "lucide-react";
import { 
  getStoredListings, 
  subscribeToListings, 
  syncListingsFromFirestore,
  voteOnListingPoll, 
  getStoredVotedPolls
} from "@/lib/listingsStore";
import { ListingItem, ListingPillar } from "@/types/listings";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

export default function StudentHubPage() {
  const { user } = useAuth();
  const isExternalUser = Boolean(
    user && (user.userType === "EXTERNAL_STUDENT" || user.isCollegeStudent === false)
  );
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [selectedPillar, setSelectedPillar] = useState<ListingPillar | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  useEffect(() => {
    setListings(getStoredListings());
    setVotedPolls(getStoredVotedPolls());

    // CRITICAL: Fetch fresh from Firestore on mount
    syncListingsFromFirestore().then((remote) => {
      if (remote && Array.isArray(remote)) {
        setListings(remote);
      }
    });

    const unsub = subscribeToListings((updated) => {
      if (updated && Array.isArray(updated)) {
        setListings(updated);
        setVotedPolls(getStoredVotedPolls());
      }
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  const filteredListings = useMemo(() => {
    return listings
      .filter((item) => item.isLive !== false && item.status !== "draft")
      .filter((item) => {
        if (selectedPillar !== "all" && item.pillar !== selectedPillar) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            item.title.toLowerCase().includes(q) ||
            item.summary.toLowerCase().includes(q) ||
            item.organizer.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [listings, selectedPillar, searchQuery]);

  const handleVote = (listingId: string, optionId: string) => {
    const matched = listings.find((l) => l.id === listingId);
    if (matched && (matched.targetAudience === "jdcoem_only" || matched.isInterCollege === false) && isExternalUser) {
      showToast("Voting on this listing is restricted to JDCOEM campus students.");
      return;
    }
    const voterKey = user?.email || `anon-${Date.now()}`;
    const voterInfo = {
      userId: user?.uid,
      userName: user?.displayName || (user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : undefined),
      userEmail: user?.email,
      userDepartment: user?.department,
      userYear: user?.year,
      btId: user?.btId,
      isAnonymous: Boolean(matched?.pollConfig?.isAnonymous),
    };
    const res = voteOnListingPoll(listingId, optionId, voterKey, voterInfo);
    if (res.success) {
      if (res.updatedListing) {
        setListings((prev) => prev.map((l) => (l.id === listingId ? res.updatedListing! : l)));
      }
      setVotedPolls(getStoredVotedPolls());
      showToast("Your vote has been cast successfully!");
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } catch {}
    } else {
      showToast(res.error || "Failed to submit vote.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans pb-24">
      
      {/* Toast Alert */}
      {feedbackNotice && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* Hero Header */}
      <section className="relative pt-24 pb-14 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-900 via-[#17458F] to-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-6 relative z-10 text-center sm:text-left">
          <div className="max-w-3xl space-y-3">
            <h1 className="font-heading font-extrabold text-4xl sm:text-6xl text-white tracking-tight uppercase">
              STUDENT ENGAGEMENT HUB
            </h1>
            <p className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed">
              Explore opportunities, vote on campus polls, apply for specialized club recruitments, submit creative entries, and file confidential student concerns.
            </p>
          </div>

          {/* Search & Stats Bar */}
          <div className="pt-4 max-w-xl">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search polls, fellowships, challenges, or club recruitments..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-medium placeholder:text-slate-300 focus:outline-none focus:bg-white focus:text-slate-900 transition-all shadow-inner"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pillar Tabs & Main Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20 space-y-8">
        
        {/* Navigation Filter Pills */}
        <div className="p-2 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
          {[
            { id: "all", label: "🌟 All Engagements" },
            { id: "voice", label: "📊 Campus Polls" },
            { id: "opportunities", label: "💡 Opportunities" },
            { id: "applications", label: "👥 Club Recruitments" },
            { id: "submissions", label: "📤 Contests & Drives" },
            { id: "community", label: "🐞 Support & Grievances" },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setSelectedPillar(pill.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedPillar === pill.id
                  ? "bg-[#17458F] text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Listings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((item) => {
            const isPoll = item.type === "poll";
            const isOpp = item.type === "opportunity";
            const isIssue = item.type === "issue";
            const isSub = item.type === "submission";
            const totalPollVotes = item.pollConfig?.totalVotes || 0;

            return (
              <div
                key={item.id}
                className="group rounded-3xl bg-white border border-slate-200 p-6 flex flex-col justify-between hover:border-[#17458F] hover:shadow-xl transition-all space-y-5"
              >
                <div className="space-y-4">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-[#17458F] text-white">
                        {item.type.toUpperCase()}
                      </span>
                      <span className={cn(
                        "text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                        (item.targetAudience === "jdcoem_only" || item.isInterCollege === false)
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                      )}>
                        {(item.targetAudience === "jdcoem_only" || item.isInterCollege === false) ? "🎓 JDCOEM Only" : "🌐 Inter-College"}
                      </span>
                    </div>
                    {item.deadline && (
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#E78023]" />
                        <span>Ends {item.deadline}</span>
                      </span>
                    )}
                  </div>

                  {/* Header Image if present */}
                  {item.coverImage && (
                    <Link href={`/hub/${item.slug}`} className="block relative h-40 rounded-2xl overflow-hidden bg-slate-100">
                      <Image
                        src={item.coverImage}
                        alt={item.title}
                        fill
                        unoptimized={true}
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </Link>
                  )}

                  {/* Title & Summary */}
                  <div className="space-y-1.5">
                    <Link href={`/hub/${item.slug}`}>
                      <h3 className="font-heading font-extrabold text-lg text-[#0F172A] uppercase group-hover:text-[#17458F] transition-colors line-clamp-2">
                        {item.title}
                      </h3>
                    </Link>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans line-clamp-3">
                      {item.summary}
                    </p>
                  </div>

                  {/* LIVE POLL INTERACTIVE WIDGET */}
                  {isPoll && item.pollConfig && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="space-y-2">
                        {item.pollConfig.options.map((opt) => {
                          const userVotedOptionId = votedPolls[item.id];
                          const isOptionValid = Boolean(item.pollConfig?.options.some((o) => o.id === userVotedOptionId));
                          const hasVoted = Boolean(userVotedOptionId) && isOptionValid && totalPollVotes > 0;
                          const isSelectedByUser = hasVoted && userVotedOptionId === opt.id;
                          const pct = totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={hasVoted}
                              onClick={() => !hasVoted && handleVote(item.id, opt.id)}
                              className={cn(
                                "w-full relative overflow-hidden rounded-xl border p-3 text-left transition-all",
                                hasVoted
                                  ? isSelectedByUser
                                    ? "border-[#17458F] bg-blue-50/40 cursor-default"
                                    : "border-slate-200 bg-slate-50/60 cursor-default"
                                  : "border-slate-200 bg-slate-50 hover:bg-white hover:border-[#17458F] hover:shadow-2xs cursor-pointer group/opt"
                              )}
                            >
                              {/* Background percentage fill bar — ONLY shown after selecting your vote */}
                              {hasVoted && (
                                <div
                                  className={cn(
                                    "absolute left-0 top-0 bottom-0 -z-10 transition-all duration-700",
                                    isSelectedByUser ? "bg-[#17458F]/15" : "bg-slate-200/60"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              )}
                              
                              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                <div className="flex items-center gap-2">
                                  {!hasVoted ? (
                                    <span className="w-3.5 h-3.5 rounded-full border border-slate-300 group-hover/opt:border-[#17458F] flex items-center justify-center shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover/opt:bg-[#17458F] transition-colors" />
                                    </span>
                                  ) : isSelectedByUser ? (
                                    <span className="w-3.5 h-3.5 rounded-full bg-[#17458F] text-white flex items-center justify-center shrink-0 text-[9px]">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="w-3.5 h-3.5 rounded-full border border-slate-200 shrink-0" />
                                  )}
                                  <span className={cn(
                                    hasVoted ? (isSelectedByUser ? "text-[#17458F] font-extrabold" : "text-slate-700") : "group-hover/opt:text-[#17458F] transition-colors"
                                  )}>
                                    {opt.text}
                                  </span>
                                </div>

                                {/* ONLY show percent, and ONLY after selecting your vote. NO no of votes! */}
                                {hasVoted && (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isSelectedByUser && (
                                      <span className="text-[10px] font-mono font-bold text-[#17458F] bg-blue-100/70 px-1.5 py-0.2 rounded-md">
                                        Your Vote
                                      </span>
                                    )}
                                    <span className="font-mono text-xs font-extrabold text-[#17458F]">{pct}%</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {votedPolls[item.id] && item.pollConfig?.options.some((o) => o.id === votedPolls[item.id]) && totalPollVotes > 0 
                            ? "✓ Your vote recorded" 
                            : "Select an option to vote"}
                        </span>
                        <Link href={`/hub/${item.slug}`} className="text-[#17458F] hover:underline font-bold">
                          Dedicated Page &rarr;
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* OPPORTUNITY PARAMETERS */}
                  {isOpp && item.opportunityConfig && (
                    <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-emerald-950">
                        <span>Role: {item.opportunityConfig.opportunityType}</span>
                        <span>{item.opportunityConfig.openings} Openings</span>
                      </div>
                      {item.opportunityConfig.stipend && (
                        <p className="text-emerald-800 font-semibold">{item.opportunityConfig.stipend}</p>
                      )}
                    </div>
                  )}

                  {/* GRIEVANCE PARAMETERS */}
                  {isIssue && (
                    <div className="p-3 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs flex items-center gap-2 text-rose-950 font-bold">
                      <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Encrypted &amp; Direct to Faculty Council</span>
                    </div>
                  )}
                </div>

                {/* Card Action Button */}
                {!isPoll && (
                  <div className="pt-4 border-t border-slate-100">
                    {(item.targetAudience === "jdcoem_only" || item.isInterCollege === false) && isExternalUser ? (
                      <div className="w-full py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-amber-700" />
                        <span>JDCOEM Students Only</span>
                      </div>
                    ) : (
                      <Link
                        href={`/hub/${item.slug}`}
                        className="w-full py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer group/btn"
                      >
                        <span>
                          {isOpp ? "Apply for Fellowship" : isSub ? "Submit Entry" : isIssue ? "File Confidential Concern" : "Apply / Audition"}
                        </span>
                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                      </Link>
                    )}
                    <div className="pt-2 text-center">
                      <Link
                        href={`/hub/${item.slug}`}
                        className="text-[11px] font-bold text-slate-500 hover:text-[#17458F] transition-colors"
                      >
                        View Full Details &amp; Share &rarr;
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
