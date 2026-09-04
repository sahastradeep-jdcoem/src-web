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
  X, 
  Check, 
  AlertCircle,
  FileText,
  Lock,
  ExternalLink
} from "lucide-react";
import { 
  getStoredListings, 
  subscribeToListings, 
  voteOnListingPoll,
  saveStoredListingResponse 
} from "@/lib/listingsStore";
import { ListingItem, ListingPillar, ListingResponseRecord } from "@/types/listings";
import { useAuth } from "@/context/AuthContext";
import confetti from "canvas-confetti";

export default function StudentHubPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [selectedPillar, setSelectedPillar] = useState<ListingPillar | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Form state for responding to an application/submission/grievance
  const [activeListingModal, setActiveListingModal] = useState<ListingItem | null>(null);
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantDepartment, setApplicantDepartment] = useState("Computer Science & Engineering");
  const [applicantYear, setApplicantYear] = useState("3rd Year");
  const [applicantBtId, setApplicantBtId] = useState("");
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});
  const [submissionLink, setSubmissionLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedTicketCode, setCompletedTicketCode] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  useEffect(() => {
    setListings(getStoredListings());
    const unsub = subscribeToListings((updated) => {
      if (updated && Array.isArray(updated)) {
        setListings(updated);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user) {
      setApplicantName(user.displayName || "");
      setApplicantEmail(user.email || "");
      if (user.department) setApplicantDepartment(user.department);
      if (user.year) setApplicantYear(user.year);
      if (user.btId) setApplicantBtId(user.btId);
    }
  }, [user]);

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
    const voterKey = user?.email || `anon-${Date.now()}`;
    const res = voteOnListingPoll(listingId, optionId, voterKey);
    if (res.success) {
      showToast("Your vote has been cast successfully!");
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } catch {}
    } else {
      showToast(res.error || "Failed to submit vote.");
    }
  };

  const handleOpenActionModal = (item: ListingItem) => {
    setActiveListingModal(item);
    setCustomAnswers({});
    setSubmissionLink("");
    setCompletedTicketCode(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeListingModal) return;
    setIsSubmitting(true);

    const ticketCode = `SRC-${activeListingModal.type.toUpperCase().slice(0, 3)}-${Math.floor(10000 + Math.random() * 90000)}`;

    const responseRecord: ListingResponseRecord = {
      id: `resp-${Date.now()}`,
      listingId: activeListingModal.id,
      listingSlug: activeListingModal.slug,
      listingType: activeListingModal.type,
      listingTitle: activeListingModal.title,
      userId: user?.uid,
      userEmail: applicantEmail,
      userName: applicantName,
      userDepartment: applicantDepartment,
      userYear: applicantYear,
      btId: applicantBtId || undefined,
      isAnonymous: Boolean(activeListingModal.issueConfig?.allowAnonymous),
      answers: Object.keys(customAnswers).length > 0 ? customAnswers : undefined,
      submissionLink: submissionLink || undefined,
      ticketCode,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    saveStoredListingResponse(responseRecord);

    setTimeout(() => {
      setIsSubmitting(false);
      setCompletedTicketCode(ticketCode);
      try {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      } catch {}
    }, 400);
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
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-[#17458F] text-white">
                      {item.type.toUpperCase()}
                    </span>
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
                          const pct = totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleVote(item.id, opt.id)}
                              className="w-full relative overflow-hidden rounded-xl border border-slate-200 p-3 text-left hover:border-[#17458F] transition-all group/opt bg-slate-50 hover:bg-white cursor-pointer"
                            >
                              <div
                                className="absolute left-0 top-0 bottom-0 bg-blue-100/70 -z-10 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                <span className="group-hover/opt:text-[#17458F] transition-colors">{opt.text}</span>
                                <span className="font-mono text-[#17458F]">{pct}% ({opt.votes})</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {totalPollVotes} student votes recorded
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
                    <button
                      type="button"
                      onClick={() => handleOpenActionModal(item)}
                      className="w-full py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <span>
                        {isOpp ? "Apply for Fellowship" : isSub ? "Submit Entry" : isIssue ? "File Confidential Concern" : "Apply / Audition"}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
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

      {/* MODAL: SUBMISSION / APPLICATION FORM */}
      {activeListingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-8 font-sans text-left">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-[#17458F] text-white flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#E78023] text-white">
                  {activeListingModal.type.toUpperCase()}
                </span>
                <h2 className="font-heading font-extrabold text-xl text-white uppercase tracking-tight line-clamp-1">
                  {activeListingModal.title}
                </h2>
              </div>
              <button
                onClick={() => setActiveListingModal(null)}
                className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If completed, show success ticket receipt */}
            {completedTicketCode ? (
              <div className="p-8 text-center space-y-6">
                <div className="inline-flex p-4 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-heading font-extrabold text-2xl text-slate-900 uppercase">
                    SUBMISSION CONFIRMED
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-sans max-w-md mx-auto">
                    Your response for <strong>{activeListingModal.title}</strong> has been logged to the central database and synced with council coordinators.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-xs mx-auto space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Official Reference Ticket ID
                  </span>
                  <p className="font-mono font-extrabold text-xl text-[#17458F] tracking-wider">
                    {completedTicketCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveListingModal(null)}
                  className="px-6 py-2.5 rounded-xl bg-[#17458F] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#123670] transition-colors"
                >
                  Done &amp; Return to Hub
                </button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="p-6 sm:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-sans leading-relaxed">
                  {activeListingModal.description}
                </div>

                {/* Candidate Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      placeholder="student@jdcoem.ac.in"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={applicantDepartment}
                      onChange={(e) => setApplicantDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Academic Year
                    </label>
                    <input
                      type="text"
                      value={applicantYear}
                      onChange={(e) => setApplicantYear(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      BT ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={applicantBtId}
                      onChange={(e) => setApplicantBtId(e.target.value.toUpperCase())}
                      placeholder="BT23..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                {/* External Link or File submission */}
                {activeListingModal.type === "submission" && (
                  <div className="space-y-1 pt-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      Submission Portfolio / Drive Link *
                    </label>
                    <input
                      type="url"
                      required
                      value={submissionLink}
                      onChange={(e) => setSubmissionLink(e.target.value)}
                      placeholder="https://drive.google.com/... or Behance/GitHub link"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                )}

                {/* Dynamic Questions (if defined) */}
                {activeListingModal.customQuestions && activeListingModal.customQuestions.map((q) => (
                  <div key={q.id} className="space-y-1.5 pt-2">
                    <label className="text-xs font-bold text-slate-800">
                      {q.question}
                    </label>
                    {q.type === "long_text" ? (
                      <textarea
                        rows={3}
                        required={q.required}
                        value={customAnswers[q.id] || ""}
                        onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-[#17458F]"
                      />
                    ) : q.type === "dropdown" || q.type === "multiple_choice" ? (
                      <select
                        required={q.required}
                        value={customAnswers[q.id] || ""}
                        onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                      >
                        <option value="">Select an option...</option>
                        {q.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required={q.required}
                        value={customAnswers[q.id] || ""}
                        onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-[#17458F]"
                      />
                    )}
                  </div>
                ))}

                {/* Footer Buttons */}
                <div className="pt-6 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveListingModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
                  >
                    {isSubmitting ? "Submitting..." : "Confirm & Send"}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
