"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { 
  BarChart3, 
  HelpCircle, 
  User, 
  Users,
  Table as TableIcon, 
  Download, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Trash2, 
  Check, 
  Inbox, 
  GraduationCap, 
  Building2, 
  Calendar, 
  FileSpreadsheet,
  FileText,
  ArrowLeft,
  Vote,
  Trophy,
  Award,
  ShieldCheck,
  RotateCcw
} from "lucide-react";
import { ListingItem, ListingResponseRecord } from "@/types/listings";
import { CustomQuestion } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ActiveTab = "summary" | "question" | "individual" | "table";

export interface ListingResponsesViewProps {
  listing: ListingItem;
  responses: ListingResponseRecord[];
  onBack: () => void;
  onUpdateStatus: (respId: string, status: "approved" | "rejected" | "resolved" | "reviewed") => void;
  onDeleteResponse?: (respId: string) => void;
  onExportExcel: () => void;
  onResetPollVotes?: () => void;
}

export function ListingResponsesView({
  listing,
  responses,
  onBack,
  onUpdateStatus,
  onDeleteResponse,
  onExportExcel,
  onResetPollVotes,
}: ListingResponsesViewProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [individualIndex, setIndividualIndex] = useState<number>(0);

  // Table search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Questions for Question-by-Question tab
  const availableQuestions = useMemo(() => {
    const list: { id: string; title: string; type: string; options?: string[]; isStandard?: boolean }[] = [
      { id: "userDepartment", title: "Engineering Department", type: "dropdown", isStandard: true },
      { id: "userYear", title: "Academic Year", type: "dropdown", isStandard: true },
    ];

    if (listing.type === "submission") {
      list.push({ id: "submissionLink", title: "Submission Portfolio / Drive Link", type: "short_text", isStandard: true });
    }

    if (listing.customQuestions && listing.customQuestions.length > 0) {
      listing.customQuestions.forEach((q) => {
        if (q.type !== "note") {
          list.push({
            id: q.id,
            title: q.question || "Custom Question",
            type: q.type,
            options: q.options || [],
            isStandard: false,
          });
        }
      });
    }

    return list;
  }, [listing]);

  // Aggregate stats & demographic breakdown (Department & Academic Year)
  const metrics = useMemo(() => {
    const total = responses.length;
    const approved = responses.filter((r) => r.status === "approved" || r.status === "resolved").length;
    const pending = responses.filter((r) => !r.status || r.status === "pending").length;
    const rejected = responses.filter((r) => r.status === "rejected").length;
    const approvedPct = total > 0 ? Math.round((approved / total) * 100) : 0;
    const withLinks = responses.filter((r) => Boolean(r.submissionLink)).length;

    // Department breakdown
    const depts: Record<string, number> = {};
    responses.forEach((r) => {
      const d = r.userDepartment?.trim() || "Unspecified";
      depts[d] = (depts[d] || 0) + 1;
    });

    // Year breakdown
    const years: Record<string, number> = {};
    responses.forEach((r) => {
      const y = r.userYear?.trim() || "Unspecified";
      years[y] = (years[y] || 0) + 1;
    });

    return { 
      total, 
      approved, 
      pending, 
      rejected, 
      approvedPct, 
      withLinks,
      departments: Object.entries(depts).sort((a, b) => b[1] - a[1]),
      years: Object.entries(years).sort((a, b) => b[1] - a[1]),
    };
  }, [responses]);

  // Helper for question aggregation
  const getQuestionAggregation = (q: { id: string; title: string; type: string; options?: string[]; isStandard?: boolean }) => {
    const records: { respondent: ListingResponseRecord; answer: any }[] = [];
    const optionCounts: Record<string, { count: number; respondents: ListingResponseRecord[] }> = {};

    const isChoice = q.type === "multiple_choice" || q.type === "checkboxes" || q.type === "dropdown";

    if (q.options && isChoice) {
      q.options.forEach((opt) => {
        optionCounts[opt] = { count: 0, respondents: [] };
      });
    }

    responses.forEach((r) => {
      let val: any = undefined;
      if (q.isStandard) {
        val = (r as any)[q.id];
      } else if (r.answers) {
        val = r.answers[q.id];
      }

      if (val !== undefined && val !== null && val !== "") {
        records.push({ respondent: r, answer: val });

        if (isChoice) {
          if (Array.isArray(val)) {
            val.forEach((item) => {
              if (!optionCounts[item]) {
                optionCounts[item] = { count: 0, respondents: [] };
              }
              optionCounts[item].count += 1;
              optionCounts[item].respondents.push(r);
            });
          } else {
            const strVal = String(val);
            if (!optionCounts[strVal]) {
              optionCounts[strVal] = { count: 0, respondents: [] };
            }
            optionCounts[strVal].count += 1;
            optionCounts[strVal].respondents.push(r);
          }
        }
      }
    });

    return {
      totalAnswered: records.length,
      records,
      isChoice,
      optionCounts: Object.entries(optionCounts).sort((a, b) => b[1].count - a[1].count),
    };
  };

  // Helper for Question type badges
  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case "multiple_choice":
        return "Multiple Choice";
      case "checkboxes":
        return "Checkboxes (Multi)";
      case "dropdown":
        return "Dropdown";
      case "long_text":
        return "Long Text / Paragraph";
      case "short_text":
        return "Short Text";
      default:
        return "Question";
    }
  };

  // Filtered responses for Table / Ledger tab
  const tableFilteredResponses = useMemo(() => {
    return responses.filter((r) => {
      if (statusFilter !== "all") {
        const itemStatus = (r.status || "pending").toLowerCase();
        if (itemStatus !== statusFilter.toLowerCase()) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.userName?.toLowerCase().includes(q);
        const matchesEmail = r.userEmail?.toLowerCase().includes(q);
        const matchesDept = r.userDepartment?.toLowerCase().includes(q);
        const matchesBt = r.btId?.toLowerCase().includes(q);
        const matchesTicket = r.ticketCode?.toLowerCase().includes(q);
        return Boolean(matchesName || matchesEmail || matchesDept || matchesBt || matchesTicket);
      }

      return true;
    });
  }, [responses, statusFilter, searchQuery]);

  const currentIndividual = responses[individualIndex] || null;

  // --------------------------------------------------------------------------
  // DEDICATED POLL ANALYTICS & BALLOT DISTRIBUTION STUDIO (NO GOOGLE FORM TABS)
  // --------------------------------------------------------------------------
  if (listing.type === "poll") {
    const pollResponses = responses.filter((r) => r.listingId === listing.id || r.listingSlug === listing.slug);
    const optionCounts: Record<string, number> = {};
    pollResponses.forEach((r) => {
      const ids: string[] = r.selectedOptionIds && r.selectedOptionIds.length > 0 
        ? r.selectedOptionIds 
        : ((r as any).selectedOptionId ? [(r as any).selectedOptionId] : []);
      if (ids.length === 0 && (r as any).customAnswers?.optionId) {
        ids.push((r as any).customAnswers.optionId);
      }
      ids.forEach((optId) => {
        optionCounts[optId] = (optionCounts[optId] || 0) + 1;
      });
    });

    const computedOptions = (listing.pollConfig?.options || []).map((opt) => ({
      ...opt,
      votes: Math.max(opt.votes || 0, optionCounts[opt.id] || 0),
    }));

    const totalVotes = Math.max(
      listing.pollConfig?.totalVotes || 0,
      pollResponses.length,
      computedOptions.reduce((s, o) => s + (o.votes || 0), 0)
    );

    const sortedOptions = [...computedOptions].sort((a, b) => b.votes - a.votes);
    const leadingOption = sortedOptions[0] || null;
    const leadingPct = totalVotes > 0 && leadingOption ? Math.round((leadingOption.votes / totalVotes) * 100) : 0;

    return (
      <div className="space-y-8 animate-in fade-in duration-200 font-sans text-left">
        {/* Header Strip with Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all shadow-2xs flex items-center justify-center cursor-pointer group"
              title="Back to All Listings"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase tracking-tight">
                  {listing.title}
                </h1>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider",
                  listing.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"
                )}>
                  {listing.status || "ACTIVE"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                  POLL • BALLOT
                </span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border",
                  listing.targetAudience === "jdcoem_only" || listing.isInterCollege === false
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                )}>
                  {listing.targetAudience === "jdcoem_only" || listing.isInterCollege === false ? "🎓 JDCOEM Only" : "🌐 Inter-College"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Live student poll results, option breakdown, and vote distribution analytics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onResetPollVotes && (
              <button
                type="button"
                onClick={onResetPollVotes}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Zero out all vote counts and reset ballots for this poll"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                <span>Reset Votes</span>
              </button>
            )}

            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Poll Report (.xlsx)</span>
            </button>

            <Link
              href={listing.type === "poll" ? "/hub" : `/hub/${listing.slug}`}
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <span>{listing.type === "poll" ? "View on Student Hub" : "View Public Page"}</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Key Poll Metrics (4 KPI Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
              Total Ballots Cast
            </span>
            <div className="flex items-baseline justify-between">
              <span className="font-heading font-extrabold text-2xl text-[#17458F]">
                {totalVotes}
              </span>
              <span className="text-xs text-slate-500 font-semibold">Verified Votes</span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
              Leading Choice
            </span>
            <div className="flex items-baseline justify-between">
              <span className="font-heading font-extrabold text-lg text-[#E78023] truncate max-w-[170px]" title={leadingOption ? leadingOption.text : ""}>
                {leadingOption && leadingOption.votes > 0 ? leadingOption.text : "No votes yet"}
              </span>
              <span className="text-xs text-amber-700 font-bold font-mono">
                {leadingPct}%
              </span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
              Voting Format
            </span>
            <div className="flex items-baseline justify-between">
              <span className="font-heading font-extrabold text-lg text-slate-800">
                {listing.pollConfig?.allowMultipleChoices ? "Multiple" : "Single Choice"}
              </span>
              <span className="text-xs text-emerald-700 font-semibold">
                {listing.pollConfig?.isAnonymous ? "🔒 Anonymous" : "Verified"}
              </span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
              Poll Status
            </span>
            <div className="flex items-baseline justify-between">
              <span className={cn(
                "font-heading font-extrabold text-lg",
                listing.status === "active" ? "text-emerald-600" : "text-slate-500"
              )}>
                {listing.status === "active" ? "Accepting Votes" : "Closed"}
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                {listing.deadline ? `Ends ${listing.deadline}` : "Ongoing"}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Live Leaderboard Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-5 h-5 text-[#17458F]" />
              <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 uppercase">
                Vote Breakdown &amp; Ranking
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">
              {sortedOptions.length} Options Configured
            </span>
          </div>

          {totalVotes === 0 ? (
            <div className="p-12 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-700 text-sm">No Votes Recorded Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Share the public link with students to begin collecting ballots. Vote percentages and rankings will update in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedOptions.map((opt, idx) => {
                const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                const isLeading = idx === 0 && opt.votes > 0;

                return (
                  <div
                    key={opt.id}
                    className={cn(
                      "p-5 rounded-2xl border transition-all space-y-3",
                      isLeading
                        ? "bg-amber-50/40 border-amber-200 shadow-2xs"
                        : "bg-slate-50/70 border-slate-200"
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "w-7 h-7 rounded-xl font-mono text-xs font-extrabold flex items-center justify-center shrink-0 shadow-2xs",
                          isLeading ? "bg-[#E78023] text-white" : "bg-white border border-slate-200 text-slate-600"
                        )}>
                          #{idx + 1}
                        </span>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{opt.text}</span>
                            {isLeading && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                👑 Leading
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="text-xs font-mono font-bold text-slate-500">
                          {opt.votes.toLocaleString()} votes
                        </span>
                        <span className="font-mono text-base font-extrabold text-[#17458F] min-w-[50px] text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* High-fidelity Progress Bar */}
                    <div className="w-full bg-white/80 border border-slate-200/80 rounded-full h-3 overflow-hidden p-0.5 shadow-2xs">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          isLeading ? "bg-gradient-to-r from-[#E78023] to-[#ff9b42]" : "bg-[#17458F]"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed Ballot Summary Ledger */}
        <div className="rounded-3xl border border-slate-200 overflow-hidden bg-white shadow-xs">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-heading font-extrabold text-sm text-slate-900 uppercase">
              Ballot Summary Ledger
            </h4>
            <span className="text-[11px] font-mono text-slate-400 font-bold">
              Total Recorded: {totalVotes}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Rank</th>
                  <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Option Label</th>
                  <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px] text-right">Votes Counted</th>
                  <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px] text-right">Percentage Share</th>
                  <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px] text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedOptions.map((opt, idx) => {
                  const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                  const isLeading = idx === 0 && opt.votes > 0;
                  return (
                    <tr key={opt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500 text-[11px]">#{idx + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{opt.text}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 text-right text-[11px]">
                        {opt.votes.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-[#17458F] text-right text-xs">
                        {pct}%
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isLeading ? (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            Leading
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            Contending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verified Student Voter Audit Log */}
        {(() => {
          const pollVoters = responses.filter((r) => {
            const isMatch = r.listingId === listing.id || r.listingSlug === listing.slug;
            if (!isMatch) return false;
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase();
              return (
                (r.userName && r.userName.toLowerCase().includes(q)) ||
                (r.userEmail && r.userEmail.toLowerCase().includes(q)) ||
                (r.userDepartment && r.userDepartment.toLowerCase().includes(q)) ||
                (r.btId && r.btId.toLowerCase().includes(q)) ||
                Object.values(r.answers || {}).some((ans) => String(ans).toLowerCase().includes(q))
              );
            }
            return true;
          });

          return (
            <div className="rounded-3xl border border-slate-200 overflow-hidden bg-white shadow-xs space-y-0">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-[#17458F]" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-heading font-extrabold text-sm text-slate-900 uppercase">
                        Verified Student Voter Log
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-[#17458F] border border-blue-200 font-mono">
                        {pollVoters.length} Logged
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Audit record of students and delegates who cast verified ballots for this poll.
                    </p>
                  </div>
                </div>

                {/* Voter Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search voter name, college, option..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>
              </div>

              {listing.pollConfig?.isAnonymous ? (
                <div className="p-8 text-center space-y-1.5 bg-slate-50/50">
                  <ShieldCheck className="w-6 h-6 text-slate-400 mx-auto" />
                  <h5 className="text-xs font-bold text-slate-700">Anonymous Poll Configuration</h5>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Individual voter identities are kept confidential and protected from public/admin disclosure per poll settings.
                  </p>
                </div>
              ) : pollVoters.length === 0 ? (
                <div className="p-10 text-center space-y-2 bg-slate-50/50">
                  <Inbox className="w-7 h-7 text-slate-300 mx-auto" />
                  <h5 className="text-xs font-bold text-slate-700">No Individual Ballots Logged</h5>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    {searchQuery ? "No voters matched your search filter." : "Ballot records will appear here as verified students and delegates submit votes."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Voter / Student</th>
                        <th className="py-3 px-4">College / Department</th>
                        <th className="py-3 px-4">Voted Option</th>
                        <th className="py-3 px-4">Time Cast</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {pollVoters.map((r, idx) => {
                        const optId = (r.selectedOptionIds && r.selectedOptionIds[0]) || (r as any).selectedOptionId || (r as any).customAnswers?.optionId;
                        const matchingOpt = computedOptions.find((o) => o.id === optId);
                        const votedAnswer = matchingOpt ? matchingOpt.text : (Object.values(r.answers || {})[0] || optId || "Recorded Vote");
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-400 text-[11px]">
                              #{idx + 1}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-900 block text-xs">
                                {r.userName || "Student Voter"}
                              </span>
                              {r.userEmail && (
                                <span className="text-[11px] text-slate-400 block font-sans">
                                  {r.userEmail}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              <span className="block font-semibold">
                                {r.btId ? r.btId : (r.userDepartment || "General Student")}
                              </span>
                              {r.userYear && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {r.userYear}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-[#17458F] font-bold text-xs inline-block">
                                {votedAnswer}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                              {r.createdAt ? new Date(r.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "Recently"}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Verified</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

      </div>
    );
  }

  // --------------------------------------------------------------------------
  // GOOGLE FORMS STYLE RESPONSE STUDIO (APPLICATIONS, CONTESTS, GRIEVANCES)
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Header Strip with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all shadow-2xs flex items-center justify-center cursor-pointer group"
            title="Back to All Listings"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase tracking-tight">
                {listing.title}
              </h1>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider",
                listing.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"
              )}>
                {listing.status || "ACTIVE"}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-[#17458F] border border-blue-200">
                {listing.pillar} • {listing.type}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Candidate submissions, demographic distributions, and questionnaire analytics studio.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            disabled={responses.length === 0}
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <Link
            href={`/engagement/${listing.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span>Live Page</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* GOOGLE FORMS STYLE 4-TAB NAVIGATION (IDENTICAL TO REGISTRATIONS PAGE) */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs">
        {[
          { id: "summary", label: "Summary", icon: BarChart3, badge: `${responses.length}` },
          { id: "question", label: "Question", icon: HelpCircle, badge: `${availableQuestions.length} Qs` },
          { id: "individual", label: "Individual", icon: User, badge: responses.length > 0 ? `${individualIndex + 1} of ${responses.length}` : "0" },
          { id: "table", label: "Spreadsheet / Ledger", icon: TableIcon, badge: `${tableFilteredResponses.length}` },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isActive
                  ? "bg-[#17458F] text-white shadow-sm font-heading"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[#E78023]" : "text-slate-400"}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SUMMARY (ANALYTICS & AGGREGATE BREAKDOWNS) */}
      {/* ========================================================================= */}
      {activeTab === "summary" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* Key Metrics Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Total Submissions
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-heading font-extrabold text-2xl text-[#17458F]">
                  {metrics.total}
                </span>
                <span className="text-xs text-slate-500 font-semibold">Responses</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Approved / Resolved
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-heading font-extrabold text-2xl text-emerald-600">
                  {metrics.approved}
                </span>
                <span className="text-xs text-emerald-700 font-semibold">
                  {metrics.approvedPct}% Processed
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-2">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${metrics.approvedPct}%` }}
                />
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Pending Review
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-heading font-extrabold text-2xl text-amber-600">
                  {metrics.pending}
                </span>
                <span className="text-xs text-amber-700 font-semibold">Awaiting</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Portfolios / Links
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-heading font-extrabold text-2xl text-purple-600">
                  {metrics.withLinks}
                </span>
                <span className="text-xs text-purple-700 font-semibold">Attached</span>
              </div>
            </div>
          </div>

          {metrics.total === 0 ? (
            <div className="p-16 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                <Inbox className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-base text-slate-800">
                  No Responses Recorded Yet
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When students participate in this listing, demographic distributions, bar charts, and individual response sheets will automatically render here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* EXACT DEPARTMENT BREAKDOWN CARD (FROM REGISTRATIONS PAGE) */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#17458F]" />
                    <h3 className="font-heading font-bold text-sm text-slate-900 uppercase">
                      Department Distribution
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    {metrics.departments.length} Branches
                  </span>
                </div>

                <div className="space-y-3">
                  {metrics.departments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No department data recorded.</p>
                  ) : (
                    metrics.departments.map(([dept, count]) => {
                      const pct = Math.round((count / metrics.total) * 100);
                      return (
                        <div key={dept} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-800">{dept}</span>
                            <span className="text-slate-500 font-mono">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-[#17458F] h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* EXACT ACADEMIC YEAR BREAKDOWN CARD (FROM REGISTRATIONS PAGE) */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-[#E78023]" />
                    <h3 className="font-heading font-bold text-sm text-slate-900 uppercase">
                      Academic Year Distribution
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    {metrics.years.length} Cohorts
                  </span>
                </div>

                <div className="space-y-3">
                  {metrics.years.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No academic year data recorded.</p>
                  ) : (
                    metrics.years.map(([year, count]) => {
                      const pct = Math.round((count / metrics.total) * 100);
                      return (
                        <div key={year} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-800">{year}</span>
                            <span className="text-slate-500 font-mono">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-[#E78023] h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>


              {/* Custom Questions Breakdown Cards (Excluding Standard Dept and Year so they never repeat) */}
              {availableQuestions
                .filter((q) => !q.isStandard)
                .map((q, idx) => {
                  const agg = getQuestionAggregation(q);
                  return (
                    <div
                      key={q.id}
                      className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 lg:col-span-2"
                    >
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-[#E78023] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              Q{idx + 1}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {getQuestionTypeLabel(q.type)}
                            </span>
                          </div>
                          <h4 className="font-heading font-extrabold text-sm sm:text-base text-[#17458F]">
                            {q.title}
                          </h4>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                          {agg.totalAnswered} / {responses.length} Answered
                        </span>
                      </div>

                      {/* Choice Breakdown */}
                      {agg.isChoice && agg.optionCounts.length > 0 ? (
                        <div className="space-y-3 pt-1">
                          {agg.optionCounts.map(([optText, data]) => {
                            const pct = agg.totalAnswered > 0 ? Math.round((data.count / agg.totalAnswered) * 100) : 0;
                            return (
                              <div key={optText} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span className="text-slate-800">{optText}</span>
                                  <span className="text-slate-500 font-mono text-[11px]">
                                    {data.count} ({pct}%)
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-[#17458F] h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Text Answers Feed */
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {agg.records.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">No responses provided.</p>
                          ) : (
                            agg.records.map((item, respIdx) => (
                              <div
                                key={respIdx}
                                className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-slate-900">
                                    {item.respondent.userName || "Candidate"}
                                  </span>
                                  <span className="font-mono text-[10px] text-[#E78023] font-bold">
                                    {item.respondent.btId || item.respondent.ticketCode}
                                  </span>
                                </div>
                                <p className="text-slate-800 font-medium leading-relaxed">
                                  {Array.isArray(item.answer) ? item.answer.join(", ") : String(item.answer)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: QUESTION (STEPPER BY QUESTION) */}
      {/* ========================================================================= */}
      {activeTab === "question" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {availableQuestions.length === 0 ? (
            <div className="p-16 rounded-3xl bg-white border border-slate-200 text-center">
              <p className="text-xs text-slate-500 font-medium">No questions defined for this listing.</p>
            </div>
          ) : (
            <>
              {/* Stepper Navigation Bar */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={selectedQuestionIndex === 0}
                    onClick={() => setSelectedQuestionIndex((prev) => Math.max(0, prev - 1))}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                    title="Previous Question"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <select
                    value={selectedQuestionIndex}
                    onChange={(e) => setSelectedQuestionIndex(Number(e.target.value))}
                    className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer max-w-sm truncate"
                  >
                    {availableQuestions.map((q, idx) => (
                      <option key={q.id} value={idx}>
                        Q{idx + 1}: {q.title}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={selectedQuestionIndex === availableQuestions.length - 1}
                    onClick={() => setSelectedQuestionIndex((prev) => Math.min(availableQuestions.length - 1, prev + 1))}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                    title="Next Question"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-xs font-mono font-bold text-slate-500">
                  Question {selectedQuestionIndex + 1} of {availableQuestions.length}
                </span>
              </div>

              {/* Active Question Response Breakdown */}
              {(() => {
                const currentQ = availableQuestions[selectedQuestionIndex];
                if (!currentQ) return null;
                const agg = getQuestionAggregation(currentQ);

                return (
                  <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
                    <div className="border-b border-slate-100 pb-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="orange" size="sm">
                          Question {selectedQuestionIndex + 1}
                        </Badge>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {getQuestionTypeLabel(currentQ.type)}
                        </span>
                      </div>
                      <h3 className="font-heading font-extrabold text-xl text-[#17458F]">
                        {currentQ.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium font-mono">
                        {agg.totalAnswered} of {responses.length} candidates answered
                      </p>
                    </div>

                    {/* Grouped Option Cards */}
                    {agg.isChoice && agg.optionCounts.length > 0 ? (
                      <div className="space-y-4">
                        {agg.optionCounts.map(([optionText, optData]) => (
                          <div
                            key={optionText}
                            className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-slate-900">
                                {optionText}
                              </span>
                              <span className="text-xs font-mono font-bold text-[#E78023] bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                {optData.count} Responses
                              </span>
                            </div>

                            {/* Interactive Respondent Pills */}
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              {optData.respondents.map((resp) => (
                                <button
                                  key={resp.id}
                                  type="button"
                                  onClick={() => {
                                    const foundIdx = responses.findIndex((r) => r.id === resp.id);
                                    if (foundIdx !== -1) {
                                      setIndividualIndex(foundIdx);
                                      setActiveTab("individual");
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-medium text-slate-700 hover:border-[#17458F] hover:text-[#17458F] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                  title="Click to view full individual response"
                                >
                                  <span>{resp.userName || "Candidate"}</span>
                                  {resp.btId && (
                                    <span className="font-mono text-[9px] text-[#E78023]">
                                      ({resp.btId})
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Flat Response Stream */
                      <div className="space-y-3">
                        {agg.records.map((item, i) => (
                          <div
                            key={i}
                            className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-bold text-slate-900">
                                  {item.respondent.userName || "Candidate"}
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-500 font-mono text-[11px]">
                                  {item.respondent.btId || item.respondent.ticketCode}
                                </span>
                              </div>
                              <p className="text-xs text-slate-800 font-medium">
                                {Array.isArray(item.answer) ? item.answer.join(", ") : String(item.answer)}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const foundIdx = responses.findIndex((r) => r.id === item.respondent.id);
                                if (foundIdx !== -1) {
                                  setIndividualIndex(foundIdx);
                                  setActiveTab("individual");
                                }
                              }}
                              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-[#17458F] hover:text-white text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
                            >
                              View Individual Sheet
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INDIVIDUAL (GOOGLE FORMS 1-OF-N RESPONDER VIEW) */}
      {/* ========================================================================= */}
      {activeTab === "individual" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {responses.length === 0 ? (
            <div className="p-16 rounded-3xl bg-white border border-slate-200 text-center space-y-2">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">No individual submissions found.</p>
            </div>
          ) : (
            <>
              {/* Responder Navigation & Action Bar */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={individualIndex === 0}
                    onClick={() => setIndividualIndex((prev) => Math.max(0, prev - 1))}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                    title="Previous Responder"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <select
                    value={individualIndex}
                    onChange={(e) => setIndividualIndex(Number(e.target.value))}
                    className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer max-w-xs truncate"
                  >
                    {responses.map((r, idx) => (
                      <option key={r.id} value={idx}>
                        #{idx + 1}: {r.userName || "Candidate"} ({r.btId || r.ticketCode || r.id.slice(0, 6)})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={individualIndex === responses.length - 1}
                    onClick={() => setIndividualIndex((prev) => Math.min(responses.length - 1, prev + 1))}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                    title="Next Responder"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Status Change Toolbar */}
                {currentIndividual && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(currentIndividual.id, "approved")}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        currentIndividual.status === "approved"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                      )}
                    >
                      ✓ Approve
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateStatus(currentIndividual.id, "resolved")}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        currentIndividual.status === "resolved"
                          ? "bg-[#17458F] text-white shadow-xs"
                          : "bg-blue-50 text-[#17458F] hover:bg-blue-100 border border-blue-200"
                      )}
                    >
                      ✓ Resolve
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateStatus(currentIndividual.id, "rejected")}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        currentIndividual.status === "rejected"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                      )}
                    >
                      ✕ Reject
                    </button>

                    {onDeleteResponse && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete response from "${currentIndividual.userName || 'Candidate'}"?`)) {
                            onDeleteResponse(currentIndividual.id);
                            setIndividualIndex((prev) => Math.max(0, prev - 1));
                          }
                        }}
                        className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete response record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Candidate Form Sheet (Google Forms Style) */}
              {currentIndividual && (
                <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
                  
                  {/* Header Banner */}
                  <div className="p-6 rounded-2xl bg-[#17458F] text-white space-y-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/20 text-white inline-block">
                          {currentIndividual.listingType.toUpperCase()} SUBMISSION
                        </span>
                        <h3 className="font-heading font-extrabold text-xl sm:text-2xl">
                          {currentIndividual.userName || "Anonymous Student"}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        {currentIndividual.ticketCode && (
                          <span className="font-mono text-xs font-bold px-3 py-1 rounded-xl bg-white/15 text-white border border-white/20">
                            {currentIndividual.ticketCode}
                          </span>
                        )}
                        <span className={cn(
                          "text-xs font-extrabold uppercase px-3 py-1 rounded-xl shadow-xs",
                          currentIndividual.status === "approved"
                            ? "bg-emerald-500 text-white"
                            : currentIndividual.status === "resolved"
                            ? "bg-cyan-500 text-white"
                            : currentIndividual.status === "rejected"
                            ? "bg-rose-500 text-white"
                            : "bg-amber-400 text-slate-900"
                        )}>
                          {currentIndividual.status || "PENDING"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/15 text-xs">
                      <div>
                        <span className="text-white/60 block text-[10px] uppercase font-bold">Email</span>
                        <span className="font-medium truncate block">{currentIndividual.userEmail || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-white/60 block text-[10px] uppercase font-bold">Department</span>
                        <span className="font-medium truncate block">{currentIndividual.userDepartment || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-white/60 block text-[10px] uppercase font-bold">Year</span>
                        <span className="font-medium block">{currentIndividual.userYear || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-white/60 block text-[10px] uppercase font-bold">BT ID / Roll</span>
                        <span className="font-mono font-bold block">{currentIndividual.btId || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* External Link Card (if submitted) */}
                  {currentIndividual.submissionLink && (
                    <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-800 block">
                          External Submission / Portfolio Link
                        </span>
                        <p className="text-xs text-cyan-950 font-medium truncate max-w-lg">
                          {currentIndividual.submissionLink}
                        </p>
                      </div>
                      <a
                        href={currentIndividual.submissionLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <span>Open Link</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  {/* Form Questions & Answers Cards */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      Candidate Questionnaire Answers
                    </h4>

                    {listing.customQuestions && listing.customQuestions.length > 0 ? (
                      listing.customQuestions.map((q, qIdx) => {
                        if (q.type === "note") return null;
                        const rawAnswer = currentIndividual.answers ? currentIndividual.answers[q.id] : undefined;

                        return (
                          <div
                            key={q.id}
                            className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                <span className="text-[#E78023] font-mono text-[11px]">0{qIdx + 1}.</span>
                                <span>{q.question}</span>
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                                {getQuestionTypeLabel(q.type)}
                              </span>
                            </div>

                            <div className="pt-1">
                              {rawAnswer === undefined || rawAnswer === null || rawAnswer === "" ? (
                                <span className="text-xs text-slate-400 italic">No response provided</span>
                              ) : Array.isArray(rawAnswer) ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {rawAnswer.map((item) => (
                                    <span
                                      key={item}
                                      className="px-2.5 py-1 rounded-lg bg-[#17458F]/10 text-[#17458F] font-bold text-xs border border-[#17458F]/20"
                                    >
                                      ✓ {item}
                                    </span>
                                  ))}
                                </div>
                              ) : q.type === "multiple_choice" || q.type === "dropdown" ? (
                                <span className="px-2.5 py-1 rounded-lg bg-[#17458F]/10 text-[#17458F] font-bold text-xs border border-[#17458F]/20 inline-block">
                                  {String(rawAnswer)}
                                </span>
                              ) : (
                                <p className="text-xs text-slate-800 font-medium whitespace-pre-line leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200">
                                  {String(rawAnswer)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 font-medium">
                        No custom questions configured for this listing. Standard registration metadata logged above.
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>Submitted: {currentIndividual.createdAt ? new Date(currentIndividual.createdAt).toLocaleString() : "Recently"}</span>
                    <span className="font-mono text-[11px]">ID: {currentIndividual.id}</span>
                  </div>

                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SPREADSHEET / LEDGER (TABLE VIEW) */}
      {/* ========================================================================= */}
      {activeTab === "table" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, department, BT ID, ticket..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#17458F]"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto">
              {["all", "pending", "approved", "resolved", "rejected"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer shrink-0",
                    statusFilter === st
                      ? "bg-[#17458F] text-white shadow-2xs"
                      : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {tableFilteredResponses.length === 0 ? (
            <div className="p-16 rounded-3xl bg-white border border-slate-200 text-center space-y-2">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">No matching submissions found.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">#</th>
                      <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Ticket</th>
                      <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Candidate</th>
                      <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Department</th>
                      <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Status</th>
                      <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Date</th>
                      <th className="py-3 px-4 font-bold text-slate-600 uppercase tracking-wider text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableFilteredResponses.map((r, idx) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-[#17458F] text-[11px]">
                          {r.ticketCode || r.id.slice(0, 7)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{r.userName || "Candidate"}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">{r.userEmail}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-700">{r.userDepartment || "N/A"}</div>
                          <div className="text-[10px] text-slate-400">{r.userYear || "N/A"} • {r.btId || "N/A"}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full inline-block",
                            r.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : r.status === "resolved"
                              ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                              : r.status === "rejected"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          )}>
                            {r.status || "PENDING"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const foundIdx = responses.findIndex((item) => item.id === r.id);
                              if (foundIdx !== -1) {
                                setIndividualIndex(foundIdx);
                                setActiveTab("individual");
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#17458F] hover:text-white text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
