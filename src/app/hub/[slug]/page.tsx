"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { 
  Vote, 
  Briefcase, 
  Users, 
  UploadCloud, 
  ShieldAlert, 
  Calendar, 
  Clock, 
  ArrowLeft, 
  CheckCircle2, 
  Share2, 
  Lock, 
  Send,
  Building,
  Check,
  AlertCircle
} from "lucide-react";
import { 
  getStoredListings, 
  subscribeToListings, 
  voteOnListingPoll, 
  saveStoredListingResponse 
} from "@/lib/listingsStore";
import { ListingItem, ListingResponseRecord } from "@/types/listings";
import { useAuth } from "@/context/AuthContext";
import confetti from "canvas-confetti";

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { user } = useAuth();

  const [listing, setListing] = useState<ListingItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidateDept, setCandidateDept] = useState("Computer Science & Engineering");
  const [candidateYear, setCandidateYear] = useState("3rd Year");
  const [candidateBtId, setCandidateBtId] = useState("");
  const [submissionLink, setSubmissionLink] = useState("");
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptCode, setReceiptCode] = useState<string | null>(null);

  useEffect(() => {
    const resolveListing = (list: ListingItem[]) => {
      if (!slug) return;
      const clean = slug.toLowerCase().trim();
      const matched = list.find(
        (l) => l.isLive !== false && l.status !== "draft" && (l.slug === clean || l.id === clean)
      );
      if (matched) setListing(matched);
    };

    const initial = getStoredListings();
    resolveListing(initial);

    const unsub = subscribeToListings((updated) => {
      if (updated && Array.isArray(updated)) {
        resolveListing(updated);
      }
    });
    return () => unsub();
  }, [slug]);

  useEffect(() => {
    if (user) {
      setCandidateName(user.displayName || "");
      setCandidateEmail(user.email || "");
      if (user.department) setCandidateDept(user.department);
      if (user.year) setCandidateYear(user.year);
      if (user.btId) setCandidateBtId(user.btId);
    }
  }, [user]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      showToast("Listing URL copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleVote = (optionId: string) => {
    if (!listing) return;
    const voterKey = user?.email || `anon-${Date.now()}`;
    const res = voteOnListingPoll(listing.id, optionId, voterKey);
    if (res.success) {
      showToast("Vote recorded successfully!");
      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } catch {}
    } else {
      showToast(res.error || "Failed to submit vote.");
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing) return;
    setIsSubmitting(true);

    const ticketCode = `SRC-${listing.type.toUpperCase().slice(0, 3)}-${Math.floor(10000 + Math.random() * 90000)}`;

    const responseRecord: ListingResponseRecord = {
      id: `resp-${Date.now()}`,
      listingId: listing.id,
      listingSlug: listing.slug,
      listingType: listing.type,
      listingTitle: listing.title,
      userId: user?.uid,
      userEmail: candidateEmail,
      userName: candidateName,
      userDepartment: candidateDept,
      userYear: candidateYear,
      btId: candidateBtId || undefined,
      isAnonymous: Boolean(listing.issueConfig?.allowAnonymous),
      answers: Object.keys(customAnswers).length > 0 ? customAnswers : undefined,
      submissionLink: submissionLink || undefined,
      ticketCode,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    saveStoredListingResponse(responseRecord);

    setTimeout(() => {
      setIsSubmitting(false);
      setReceiptCode(ticketCode);
      try {
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });
      } catch {}
    }, 450);
  };

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-4 max-w-md shadow-xs">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="font-heading font-extrabold text-xl text-slate-900 uppercase">
            Listing Not Found
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            The requested student engagement listing may have closed, been archived, or does not exist.
          </p>
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#17458F] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#123670] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Engagement Hub</span>
          </Link>
        </div>
      </div>
    );
  }

  const isPoll = listing.type === "poll";
  const isOpp = listing.type === "opportunity";
  const isIssue = listing.type === "issue";
  const totalPollVotes = listing.pollConfig?.totalVotes || 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans pb-24">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb Nav */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-6 flex items-center justify-between">
        <Link
          href="/hub"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#17458F] uppercase tracking-wider transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Student Hub</span>
        </Link>

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#17458F] text-slate-700 hover:text-[#17458F] text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{copiedLink ? "Copied" : "Share"}</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        
        {/* Main Card */}
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden space-y-6">
          
          {/* Cover Header */}
          {listing.coverImage ? (
            <div className="relative h-64 sm:h-80 w-full bg-slate-100">
              <Image
                src={listing.coverImage}
                alt={listing.title}
                fill
                unoptimized={true}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-[#E78023] text-white">
                  {listing.type.toUpperCase()}
                </span>
                <h1 className="font-heading font-extrabold text-2xl sm:text-4xl uppercase tracking-tight text-white">
                  {listing.title}
                </h1>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-gradient-to-br from-[#17458F] to-slate-900 text-white space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-[#E78023] text-white">
                {listing.type.toUpperCase()}
              </span>
              <h1 className="font-heading font-extrabold text-2xl sm:text-4xl uppercase tracking-tight text-white">
                {listing.title}
              </h1>
            </div>
          )}

          {/* Metadata Badges */}
          <div className="px-6 sm:px-8 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1.5 text-slate-700">
              <Building className="w-4 h-4 text-[#17458F]" />
              <span>Organized by {listing.organizer}</span>
            </span>
            {listing.deadline && (
              <span className="flex items-center gap-1.5 text-slate-700">
                <Clock className="w-4 h-4 text-[#E78023]" />
                <span>Deadline: {listing.deadline}</span>
              </span>
            )}
            {isIssue && (
              <span className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                <span>Confidential Channel</span>
              </span>
            )}
          </div>

          {/* Description Body */}
          <div className="px-6 sm:px-8 space-y-4">
            <h2 className="font-heading font-bold text-base text-slate-800 uppercase tracking-wider">
              Overview &amp; Guidelines
            </h2>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-line">
              {listing.description || listing.summary}
            </div>
          </div>

          {/* LIVE POLL PARTICIPATION */}
          {isPoll && listing.pollConfig && (
            <div className="p-6 sm:p-8 border-t border-slate-200 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-extrabold text-lg text-[#17458F] uppercase">
                  Cast Your Vote
                </h3>
                <span className="text-xs font-bold text-slate-400">
                  {totalPollVotes} votes submitted
                </span>
              </div>

              <div className="space-y-3">
                {listing.pollConfig.options.map((opt) => {
                  const pct = totalPollVotes > 0 ? Math.round((opt.votes / totalPollVotes) * 100) : 0;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleVote(opt.id)}
                      className="w-full relative overflow-hidden rounded-2xl border border-slate-200 p-4 text-left hover:border-[#17458F] transition-all bg-slate-50 hover:bg-white cursor-pointer group"
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-blue-100/70 -z-10 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800">
                        <span className="group-hover:text-[#17458F] transition-colors">{opt.text}</span>
                        <span className="font-mono text-[#17458F]">{pct}% ({opt.votes} votes)</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* APPLICATION / SUBMISSION / GRIEVANCE FORM */}
          {!isPoll && (
            <div className="p-6 sm:p-8 border-t border-slate-200 space-y-6">
              <h3 className="font-heading font-extrabold text-lg text-[#17458F] uppercase">
                {isIssue ? "Submit Confidential Inquiry" : "Participant Application"}
              </h3>

              {receiptCode ? (
                <div className="p-8 rounded-3xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
                  <div className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="font-heading font-extrabold text-xl text-emerald-950 uppercase">
                    Submission Received
                  </h4>
                  <p className="text-xs text-emerald-800 font-sans max-w-sm mx-auto">
                    Your response has been registered and synced to the central database.
                  </p>
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 max-w-xs mx-auto">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Reference ID</span>
                    <span className="font-mono font-extrabold text-lg text-[#17458F]">{receiptCode}</span>
                  </div>
                  <Link
                    href="/dashboard"
                    className="inline-block px-5 py-2 rounded-xl bg-[#17458F] text-white text-xs font-bold uppercase tracking-wider"
                  >
                    Track in Student Dashboard
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={candidateEmail}
                        onChange={(e) => setCandidateEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
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
                        value={candidateDept}
                        onChange={(e) => setCandidateDept(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                        Academic Year
                      </label>
                      <input
                        type="text"
                        value={candidateYear}
                        onChange={(e) => setCandidateYear(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                        BT ID
                      </label>
                      <input
                        type="text"
                        value={candidateBtId}
                        onChange={(e) => setCandidateBtId(e.target.value.toUpperCase())}
                        placeholder="BT23..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  {listing.type === "submission" && (
                    <div className="space-y-1 pt-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        Submission Drive / Portfolio Link *
                      </label>
                      <input
                        type="url"
                        required
                        value={submissionLink}
                        onChange={(e) => setSubmissionLink(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                      />
                    </div>
                  )}

                  {/* Dynamic Questions */}
                  {listing.customQuestions?.map((q) => (
                    <div key={q.id} className="space-y-1.5 pt-2">
                      <label className="text-xs font-bold text-slate-800">
                        {q.question} {q.required && "*"}
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
                          <option value="">Select option...</option>
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

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-8 py-3 rounded-2xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                    >
                      {isSubmitting ? "Submitting..." : "Send Application & Log Ticket"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
