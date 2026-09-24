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
  Globe,
  Share2
} from "lucide-react";
import { 
  getStoredListings, 
  subscribeToListings, 
  syncListingsFromFirestore,
  voteOnListingPoll, 
  getStoredVotedPolls,
  syncListingResponsesFromFirestore,
  getStoredListingResponses,
  subscribeToListingResponses,
  getPollStats
} from "@/lib/listingsStore";
import { ListingItem, ListingPillar, ListingResponseRecord } from "@/types/listings";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { isExternalUser as checkIsExternalUser } from "@/lib/usersStore";
import confetti from "canvas-confetti";
import { StaggerGrid, StaggerItem } from "@/components/ui/StaggerContainer";
import { ListingCardSkeleton } from "@/components/ui/SkeletonCard";

export default function StudentHubPage() {
  const { user, openAuthModal } = useAuth();
  const isExternalUser = checkIsExternalUser(user);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [responses, setResponses] = useState<ListingResponseRecord[]>([]);
  const [selectedPillar, setSelectedPillar] = useState<ListingPillar | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    // Purge any obsolete un-scoped legacy voted key from storage
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("src_voted_polls");
      } catch {}
    }

    // 2. Load user-specific voting ledger
    if (user?.uid) {
      const initialMap = {
        ...getStoredVotedPolls(user.uid),
        ...((user as any)?.votedPolls || {}),
      };
      setVotedPolls(initialMap);

      syncListingResponsesFromFirestore().then((res) => {
        if (res && Array.isArray(res)) {
          const userVotes = res.filter(
            (r) => r.listingType === "poll" && (r.userId === user.uid || (r.userEmail && r.userEmail === user.email))
          );
          if (userVotes.length > 0) {
            const map: Record<string, string> = {
              ...initialMap,
            };
            userVotes.forEach((r) => {
              if (r.listingId && r.selectedOptionIds?.[0]) {
                map[r.listingId] = r.selectedOptionIds[0];
              }
            });
            setVotedPolls(map);
            try {
              localStorage.setItem(`src_voted_polls_${user.uid}`, JSON.stringify(map));
            } catch {}
          }
        }
      });
    } else {
      // Unauthenticated: Strictly clear all voted state
      setVotedPolls({});
    }
  }, [user]);

  useEffect(() => {
    const cachedListings = getStoredListings();
    setListings(cachedListings);
    setResponses(getStoredListingResponses());
    if (cachedListings.length > 0) setIsLoading(false);

    // CRITICAL: Fetch fresh from Firestore on mount
    syncListingsFromFirestore().then((remote) => {
      if (remote && Array.isArray(remote)) {
        setListings(remote);
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    syncListingResponsesFromFirestore().then((res) => {
      if (res && Array.isArray(res)) {
        setResponses(res);
      }
    });

    const unsubListings = subscribeToListings((updated) => {
      if (updated && Array.isArray(updated)) {
        setListings(updated);
        setIsLoading(false);
        if (user?.uid) {
          setVotedPolls(getStoredVotedPolls(user.uid));
        }
      }
    });

    const unsubResponses = subscribeToListingResponses((updated) => {
      if (updated && Array.isArray(updated)) {
        setResponses(updated);
      }
    });

    return () => {
      unsubListings();
      unsubResponses();
    };
  }, [user]);

  const showToast = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  const handleShareLink = async (e: React.MouseEvent, item: ListingItem) => {
    e.preventDefault();
    e.stopPropagation();

    const canonicalUrl = typeof window !== "undefined"
      ? `${window.location.origin}/hub/${item.slug}`
      : `https://www.srcjdcoem.in/hub/${item.slug}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(canonicalUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = canonicalUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedId(item.id);
      showToast("Link copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      showToast("Failed to copy link. Please copy from address bar.");
    }
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

  // Pillar counts for filter badges
  const pillarCounts = useMemo(() => {
    const active = listings.filter((item) => item.isLive !== false && item.status !== "draft");
    return {
      all: active.length,
      voice: active.filter((item) => item.pillar === "voice").length,
      opportunities: active.filter((item) => item.pillar === "opportunities").length,
      applications: active.filter((item) => item.pillar === "applications").length,
      submissions: active.filter((item) => item.pillar === "submissions").length,
      community: active.filter((item) => item.pillar === "community").length,
    };
  }, [listings]);

  const filterTabs = [
    { id: "all", label: "All Engagements", icon: Sparkles },
    { id: "voice", label: "Campus Polls", icon: Vote },
    { id: "opportunities", label: "Opportunities", icon: Briefcase },
    { id: "applications", label: "Applications", icon: Users },
    { id: "submissions", label: "Contests & Drives", icon: UploadCloud },
    { id: "community", label: "Support & Grievances", icon: ShieldAlert },
  ];

  const handleVote = (listingId: string, optionId: string) => {
    if (!user) {
      openAuthModal();
      showToast("Please sign in with your student account to cast your vote.");
      return;
    }
    const matched = listings.find((l) => l.id === listingId);
    if (matched && (matched.status === "closed" || matched.isAcceptingResponses === false)) {
      showToast("Voting has closed for this poll.");
      return;
    }
    if (matched && (matched.targetAudience === "jdcoem_only" || matched.isInterCollege === false) && isExternalUser) {
      showToast("Voting on this listing is restricted to JDCOEM campus students.");
      return;
    }
    const voterKey = user.email || user.uid;
    const voterInfo = {
      userId: user.uid,
      userName: user.displayName || (user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : undefined),
      userEmail: user.email,
      userDepartment: user.department,
      userYear: user.year,
      btId: user.btId,
      isAnonymous: Boolean(matched?.pollConfig?.isAnonymous),
    };
    const res = voteOnListingPoll(listingId, optionId, voterKey, voterInfo);
    if (res.success) {
      if (res.updatedListing) {
        setListings((prev) => prev.map((l) => (l.id === listingId ? res.updatedListing! : l)));
      }
      setResponses(getStoredListingResponses());
      setVotedPolls(getStoredVotedPolls(user.uid));
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
      <section className="relative pt-20 sm:pt-24 pb-10 sm:pb-14 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-900 via-[#17458F] to-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 relative z-10 text-center sm:text-left">
          <div className="max-w-3xl space-y-2 sm:space-y-3">
            <h1 className="font-heading font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight uppercase">
              STUDENT ENGAGEMENT HUB
            </h1>
            <p className="text-xs sm:text-base text-slate-200 font-medium leading-relaxed max-w-2xl">
              Explore opportunities, vote on campus polls, apply for campus initiatives and programs, submit creative entries, and file confidential student concerns.
            </p>
          </div>

          {/* Search & Stats Bar */}
          <div className="pt-2 sm:pt-4 max-w-xl">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search polls, opportunities, challenges, or applications..."
                className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-medium placeholder:text-slate-300 focus:outline-none focus:bg-white focus:text-slate-900 transition-all shadow-inner"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pillar Tabs & Main Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20 space-y-6 sm:space-y-8">
        
        {/* Navigation Filter Pills Toolbar - Space-Saving Horizontal Scroll on Mobile */}
        <div className="relative">
          <div className="p-1.5 sm:p-2 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar sm:flex-wrap scroll-smooth">
            {filterTabs.map((pill) => {
              const Icon = pill.icon;
              const count = pillarCounts[pill.id as keyof typeof pillarCounts] || 0;
              const isSelected = selectedPillar === pill.id;

              return (
                <button
                  key={pill.id}
                  onClick={() => setSelectedPillar(pill.id as any)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap select-none min-h-[38px]",
                    isSelected
                      ? "bg-[#17458F] text-white shadow-xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-white" : "text-slate-500")} />
                  <span>{pill.label}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "ml-0.5 px-1.5 py-0.5 text-[10px] font-extrabold rounded-md leading-none",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-slate-200/80 text-slate-600"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Subtle Right Edge Fade Gradient on Mobile to indicate horizontal scroll */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white via-white/80 to-transparent rounded-r-2xl sm:hidden" />
        </div>

        {/* Listings Grid */}
        {isLoading && filteredListings.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredListings.length > 0 ? (
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" staggerDelay={0.05}>
            {filteredListings.map((item) => {
              const isPoll = item.type === "poll";
              const isOpp = item.type === "opportunity";
              const isIssue = item.type === "issue";
              const isSub = item.type === "submission";

              return (
                <StaggerItem key={item.id} className="h-full">
                  <div
                    className="group rounded-3xl bg-white border border-slate-200 p-6 flex flex-col justify-between hover:border-[#17458F] hover:shadow-xl transition-all space-y-5 h-full"
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
                      {(item.status === "closed" || item.isAcceptingResponses === false) && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200">
                          Closed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.deadline && (
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#E78023]" />
                          <span>Ends {item.deadline}</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleShareLink(e, item)}
                        title={copiedId === item.id ? "Link copied!" : "Share link"}
                        className={cn(
                          "p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0",
                          copiedId === item.id
                            ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                            : "border-slate-200 hover:border-[#17458F] hover:bg-slate-50 text-slate-400 hover:text-[#17458F]"
                        )}
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                        ) : (
                          <Share2 className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Header Image if present */}
                  {item.coverImage && (
                    isPoll ? (
                      <div className="block relative h-40 rounded-2xl overflow-hidden bg-slate-100">
                        <Image
                          src={item.coverImage}
                          alt={item.title}
                          fill
                          unoptimized={true}
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <Link href={`/hub/${item.slug}`} className="block relative h-40 rounded-2xl overflow-hidden bg-slate-100">
                        <Image
                          src={item.coverImage}
                          alt={item.title}
                          fill
                          unoptimized={true}
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </Link>
                    )
                  )}

                  {/* Title & Summary */}
                  <div className="space-y-1.5">
                    {isPoll ? (
                      <h3 className="font-heading font-extrabold text-lg text-[#0F172A] uppercase line-clamp-2">
                        {item.title}
                      </h3>
                    ) : (
                      <Link href={`/hub/${item.slug}`}>
                        <h3 className="font-heading font-extrabold text-lg text-[#0F172A] uppercase group-hover:text-[#17458F] transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                      </Link>
                    )}
                    <p className="text-xs text-slate-500 leading-relaxed font-sans line-clamp-3">
                      {item.summary}
                    </p>
                  </div>

                  {/* LIVE POLL INTERACTIVE WIDGET */}
                  {isPoll && item.pollConfig && (() => {
                    const userVotedOptionId = user ? (votedPolls[item.id] || (user as any).votedPolls?.[item.id]) : null;
                    const isOptionValid = Boolean(item.pollConfig?.options.some((o) => o.id === userVotedOptionId));
                    const hasVoted = Boolean(user) && Boolean(userVotedOptionId) && isOptionValid;
                    const isClosed = item.status === "closed" || item.isAcceptingResponses === false;
                    const pollStats = getPollStats(item, responses, user?.uid, userVotedOptionId);

                    return (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div className="space-y-2">
                          {pollStats.computedOptions.map((opt) => {
                            const isSelectedByUser = hasVoted && userVotedOptionId === opt.id;
                            const pct = pollStats.totalVotes > 0 ? Math.round((opt.votes / pollStats.totalVotes) * 100) : 0;

                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={hasVoted || isClosed}
                                onClick={() => {
                                  if (isClosed) {
                                    showToast("Voting is closed for this poll.");
                                    return;
                                  }
                                  if (!user) {
                                    openAuthModal();
                                    showToast("Please sign in with your student account to vote.");
                                    return;
                                  }
                                  if (!hasVoted) {
                                    handleVote(item.id, opt.id);
                                  }
                                }}
                                className={cn(
                                  "w-full relative overflow-hidden rounded-xl border p-3 text-left transition-all",
                                  isClosed && !hasVoted
                                    ? "border-slate-200 bg-slate-50/70 text-slate-500 cursor-not-allowed"
                                    : hasVoted
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
                            {isClosed
                              ? "🔒 Voting has closed"
                              : !user
                              ? "🔒 Sign in to vote"
                              : (votedPolls[item.id] || (user as any).votedPolls?.[item.id]) && item.pollConfig?.options.some((o) => o.id === (votedPolls[item.id] || (user as any).votedPolls?.[item.id]))
                              ? "✓ Your vote recorded" 
                              : "Select an option to vote"}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

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
                    ) : (item.status === "closed" || item.isAcceptingResponses === false) ? (
                      <div className="w-full py-2.5 px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2 cursor-not-allowed">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Responses Closed</span>
                      </div>
                    ) : (
                      <Link
                        href={`/hub/${item.slug}`}
                        className="w-full py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer group/btn"
                      >
                        <span>
                          {isOpp ? "Apply for Fellowship" : isSub ? "Submit Entry" : isIssue ? "File Confidential Concern" : "Fill Form"}
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
            </StaggerItem>
          );
        })}
      </StaggerGrid>
    ) : null}
  </div>

    </div>
  );
}
