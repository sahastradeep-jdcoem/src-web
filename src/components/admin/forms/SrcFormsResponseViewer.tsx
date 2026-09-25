"use client";

import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { 
  ArrowLeft, 
  Download, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  Sparkles, 
  FileSpreadsheet, 
  Building2, 
  GraduationCap, 
  Calendar,
  Check,
  X,
  Trash2,
  HelpCircle,
  BarChart3,
  ListFilter,
  Power,
  Pencil,
  MessageCircle,
  ExternalLink,
  GitBranch
} from "lucide-react";
import { SrcFormField } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { getFormSectionGroups, analyzeSectionResponses } from "@/lib/srcFormsHelper";

export interface SrcFormsResponseRecord {
  id: string;
  formId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userBtId?: string;
  userDepartment?: string;
  userYear?: string;
  userPhone?: string;
  submittedAt: string;
  updatedAt?: string;
  status?: "pending" | "approved" | "rejected" | "resolved" | "reviewed";
  adminFeedback?: string;
  answers: Record<string, any>;
  sectionPath?: string[]; // Visited sections along the branching route
}

export interface SrcFormsResponseViewerProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  fields: SrcFormField[];
  responses: SrcFormsResponseRecord[];
  onBack: () => void;
  onUpdateStatus?: (respId: string, status: "pending" | "approved" | "rejected" | "resolved" | "reviewed", feedback?: string) => void;
  onDeleteResponse?: (respId: string) => void;
  allowStatusResolution?: boolean;
  itemNameLabel?: string;
  isAcceptingResponses?: boolean;
  onToggleAcceptingResponses?: (accepting: boolean) => void;
  onEditForm?: () => void;
}

type ActiveTab = "summary" | "question" | "individual" | "table";

export function SrcFormsResponseViewer({
  title,
  subtitle,
  badgeText = "SRC Forms",
  fields = [],
  responses = [],
  onBack,
  onUpdateStatus,
  onDeleteResponse,
  allowStatusResolution = true,
  itemNameLabel = "Dispatch",
  isAcceptingResponses = true,
  onToggleAcceptingResponses,
  onEditForm,
}: SrcFormsResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [individualIndex, setIndividualIndex] = useState<number>(0);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Non-note, non-section, non-whatsapp fields eligible for analysis
  const activeQuestions = useMemo(() => {
    return fields.filter((f) => f.type !== "note" && f.type !== "section" && f.type !== "whatsapp_link");
  }, [fields]);

  // Aggregate Metrics & Demographics
  const metrics = useMemo(() => {
    const total = responses.length;
    const approved = responses.filter((r) => r.status === "approved" || r.status === "resolved").length;
    const pending = responses.filter((r) => !r.status || r.status === "pending").length;
    const rejected = responses.filter((r) => r.status === "rejected").length;
    const reviewed = responses.filter((r) => r.status === "reviewed").length;
    const approvedPct = total > 0 ? Math.round((approved / total) * 100) : 0;

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
      reviewed,
      approvedPct,
      departments: Object.entries(depts).sort((a, b) => b[1] - a[1]),
      years: Object.entries(years).sort((a, b) => b[1] - a[1]),
    };
  }, [responses]);

  // Question Aggregation Helper
  const getQuestionAggregation = (q: SrcFormField) => {
    const isChoice = q.type === "multiple_choice" || q.type === "checkboxes" || q.type === "dropdown";
    const optionCounts: Record<string, { count: number; respondents: SrcFormsResponseRecord[] }> = {};

    if (isChoice && q.options) {
      q.options.forEach((opt) => {
        optionCounts[opt] = { count: 0, respondents: [] };
      });
    }

    const textAnswers: { respondent: SrcFormsResponseRecord; answer: string }[] = [];
    let totalAnswered = 0;

    responses.forEach((r) => {
      const raw = r.answers ? r.answers[q.id] : undefined;
      if (raw !== undefined && raw !== null && raw !== "") {
        totalAnswered += 1;
        if (isChoice) {
          const selectedList = Array.isArray(raw) ? raw : [raw];
          selectedList.forEach((choice) => {
            const strChoice = String(choice);
            if (!optionCounts[strChoice]) {
              optionCounts[strChoice] = { count: 0, respondents: [] };
            }
            optionCounts[strChoice].count += 1;
            optionCounts[strChoice].respondents.push(r);
          });
        } else {
          textAnswers.push({ respondent: r, answer: String(raw) });
        }
      }
    });

    return {
      totalAnswered,
      isChoice,
      optionCounts: Object.entries(optionCounts).sort((a, b) => b[1].count - a[1].count),
      textAnswers,
    };
  };

  // Filtered responses for Table Tab
  const filteredResponses = useMemo(() => {
    return responses.filter((r) => {
      // Status Filter
      if (statusFilter !== "all") {
        const currentStatus = r.status || "pending";
        if (currentStatus !== statusFilter) return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (r.userName || "").toLowerCase().includes(q);
        const btMatch = (r.userBtId || "").toLowerCase().includes(q);
        const emailMatch = (r.userEmail || "").toLowerCase().includes(q);
        const deptMatch = (r.userDepartment || "").toLowerCase().includes(q);
        const answerMatch = Object.values(r.answers || {}).some((ans) =>
          String(ans).toLowerCase().includes(q)
        );
        return nameMatch || btMatch || emailMatch || deptMatch || answerMatch;
      }

      return true;
    });
  }, [responses, searchQuery, statusFilter]);

  // Current individual respondent
  const currentIndividual = responses[individualIndex] || null;

  // Google Forms–style section grouping
  const formSections = useMemo(() => {
    return getFormSectionGroups(fields);
  }, [fields]);

  // Section analysis for the current individual respondent
  const currentIndividualSections = useMemo(() => {
    if (!currentIndividual) return [];
    return analyzeSectionResponses(formSections, currentIndividual.answers || {});
  }, [formSections, currentIndividual]);

  // Excel / Spreadsheet Export
  const handleExportExcel = () => {
    if (responses.length === 0) {
      alert("No responses recorded to export.");
      return;
    }

    const sanitize = (val: any): string | number => {
      if (val === null || val === undefined) return "";
      if (typeof val === "boolean") return val ? "Yes" : "No";
      if (typeof val === "number") return val;
      const str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
      return str;
    };

    const rows = responses.map((r) => {
      const rowData: Record<string, any> = {
        "Timestamp": sanitize(new Date(r.submittedAt).toLocaleString("en-IN")),
        "Full Name": sanitize(r.userName || "Anonymous Member"),
        "College BT ID": sanitize(r.userBtId || "—"),
        "Email Address": sanitize(r.userEmail || "—"),
        "WhatsApp / Contact": sanitize(r.userPhone || "—"),
        "Department / Branch": sanitize(r.userDepartment || "—"),
        "Academic Year": sanitize(r.userYear || "—"),
        "Resolution Status": sanitize((r.status || "pending").toUpperCase()),
      };

      if (formSections.length > 1) {
        const visitedNames = r.sectionPath && r.sectionPath.length > 0
          ? r.sectionPath.map((sId) => formSections.find((s) => s.id === sId)?.title || sId).join(" → ")
          : "Standard Flow";
        rowData["Visited Sections"] = sanitize(visitedNames);
      }

      // Dedicated column for every form field prompt
      activeQuestions.forEach((q) => {
        const rawAns = r.answers ? r.answers[q.id] : "";
        const formattedAns = Array.isArray(rawAns) ? rawAns.join(", ") : String(rawAns || "");
        rowData[q.question || "Untitled Question"] = sanitize(formattedAns);
      });

      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Form Responses");

    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `SRC_Forms_${safeTitle}_${dateStr}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* TOP BAR: BACK, TITLE & EXCEL EXPORT                      */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0"
            title="Back to Operations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-2xs">
                {badgeText}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {itemNameLabel} Forms Response Viewer
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-heading font-extrabold text-slate-900 leading-snug">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-500 font-medium">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Status Badge */}
          <span
            className={cn(
              "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs transition-all",
              isAcceptingResponses
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            )}
          >
            {isAcceptingResponses ? "ACCEPTING RESPONSES" : "RESPONSES CLOSED"}
          </span>

          {/* Toggle Accept Responses */}
          {onToggleAcceptingResponses && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/80 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Power className={cn("w-3.5 h-3.5", isAcceptingResponses ? "text-emerald-600" : "text-slate-400")} />
                <span>Accept Responses</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isAcceptingResponses}
                onClick={() => onToggleAcceptingResponses(!isAcceptingResponses)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  isAcceptingResponses ? "bg-emerald-600" : "bg-slate-300"
                )}
                title={
                  isAcceptingResponses
                    ? "Click to stop accepting new responses"
                    : "Click to resume accepting responses"
                }
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                    isAcceptingResponses ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          )}

          {/* Edit Form Button */}
          {onEditForm && (
            <Button
              onClick={onEditForm}
              variant="outline"
              size="sm"
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 text-xs font-bold gap-1.5 cursor-pointer shadow-2xs"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-600" />
              <span>Edit Form</span>
            </Button>
          )}

          <Button
            onClick={handleExportExcel}
            variant="outline"
            size="sm"
            className="bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 text-xs font-bold gap-1.5 cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Export to Excel</span>
          </Button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4 GOOGLE FORMS-STYLE TABS                                 */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("summary")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none",
            activeTab === "summary"
              ? "bg-[#17458F] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          )}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Summary</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
            {metrics.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("question")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none",
            activeTab === "question"
              ? "bg-[#17458F] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          )}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Question</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
            {activeQuestions.length} Qs
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("individual")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none",
            activeTab === "individual"
              ? "bg-[#17458F] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          )}
        >
          <User className="w-3.5 h-3.5" />
          <span>Individual</span>
          {metrics.total > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
              {individualIndex + 1}/{metrics.total}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("table")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none",
            activeTab === "table"
              ? "bg-[#17458F] text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          )}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Table Log</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: SUMMARY TAB                                        */}
      {/* ========================================================= */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Submissions
              </span>
              <p className="font-heading font-extrabold text-2xl text-slate-900">
                {metrics.total}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Approved / Resolved
              </span>
              <div className="flex items-baseline gap-2">
                <p className="font-heading font-extrabold text-2xl text-emerald-700">
                  {metrics.approved}
                </p>
                <span className="text-xs font-bold text-emerald-600">
                  ({metrics.approvedPct}%)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Pending Review
              </span>
              <p className="font-heading font-extrabold text-2xl text-amber-700">
                {metrics.pending}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Reviewed / Other
              </span>
              <p className="font-heading font-extrabold text-2xl text-slate-700">
                {metrics.reviewed + metrics.rejected}
              </p>
            </div>
          </div>

          {/* Demographic Distributions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Department Breakdown */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building2 className="w-4 h-4 text-[#17458F]" />
                <h3 className="font-heading font-bold text-sm text-slate-900 uppercase tracking-wider">
                  Department / Branch Breakdown
                </h3>
              </div>
              <div className="space-y-2.5 pt-1">
                {metrics.departments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">No department data recorded yet.</p>
                ) : (
                  metrics.departments.map(([dept, count]) => {
                    const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                    return (
                      <div key={dept} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-800">{dept}</span>
                          <span className="text-slate-500 font-mono">{count} ({pct}%)</span>
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

            {/* Academic Year Breakdown */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <GraduationCap className="w-4 h-4 text-[#E78023]" />
                <h3 className="font-heading font-bold text-sm text-slate-900 uppercase tracking-wider">
                  Academic Year Distribution
                </h3>
              </div>
              <div className="space-y-2.5 pt-1">
                {metrics.years.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">No academic year data recorded yet.</p>
                ) : (
                  metrics.years.map(([year, count]) => {
                    const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                    return (
                      <div key={year} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-800">{year}</span>
                          <span className="text-slate-500 font-mono">{count} ({pct}%)</span>
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
          </div>

          {/* Form Questions Statistical Cards */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E78023]" />
              <h3 className="font-heading font-bold text-sm text-slate-900 uppercase tracking-wider">
                Questionnaire Statistical Breakdown
              </h3>
            </div>

            {activeQuestions.length === 0 ? (
              <div className="p-8 text-center rounded-3xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                No active questions found in this SRC Form.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {activeQuestions.map((q, idx) => {
                  const agg = getQuestionAggregation(q);
                  return (
                    <div
                      key={q.id}
                      className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-[#E78023] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              Q{idx + 1}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {q.type.replace("_", " ")}
                            </span>
                          </div>
                          <h4 className="font-heading font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                            {q.question}
                          </h4>
                          {q.description && (
                            <p className="text-[11px] text-slate-500">{q.description}</p>
                          )}
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                          {agg.totalAnswered}/{responses.length} Answered
                        </span>
                      </div>

                      {/* Distribution Bars for Choice Types */}
                      {agg.isChoice ? (
                        <div className="space-y-2.5">
                          {agg.optionCounts.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No responses recorded yet.</p>
                          ) : (
                            agg.optionCounts.map(([opt, data]) => {
                              const pct = agg.totalAnswered > 0 ? Math.round((data.count / agg.totalAnswered) * 100) : 0;
                              return (
                                <div key={opt} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs font-semibold">
                                    <span className="text-slate-800">{opt}</span>
                                    <span className="text-slate-500 font-mono">{data.count} ({pct}%)</span>
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
                      ) : (
                        /* Text Answers Feed */
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {agg.textAnswers.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No written responses recorded yet.</p>
                          ) : (
                            agg.textAnswers.map((item, tIdx) => (
                              <div
                                key={tIdx}
                                className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                              >
                                <p className="font-medium text-slate-900 leading-relaxed break-words">
                                  "{item.answer}"
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                                  <span>{item.respondent.userName || "Anonymous"}</span>
                                  <span>{new Date(item.respondent.submittedAt).toLocaleDateString("en-IN")}</span>
                                </div>
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
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: QUESTION TAB                                       */}
      {/* ========================================================= */}
      {activeTab === "question" && (
        <div className="space-y-5">
          {activeQuestions.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
              No active questions found in this form.
            </div>
          ) : (
            <>
              {/* Question Selector Dropdown */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Question To Inspect
                </label>
                <select
                  value={selectedQuestionIndex}
                  onChange={(e) => setSelectedQuestionIndex(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#17458F] cursor-pointer"
                >
                  {formSections.length > 1 ? (
                    formSections.map((sec) => {
                      const secQuestions = sec.fields.filter(
                        (f) => f.type !== "note" && f.type !== "section" && f.type !== "whatsapp_link"
                      );
                      if (secQuestions.length === 0) return null;
                      return (
                        <optgroup
                          key={sec.id}
                          label={`Section ${sec.sectionIndex}: ${sec.title}`}
                        >
                          {secQuestions.map((q) => {
                            const globalIdx = activeQuestions.findIndex((aq) => aq.id === q.id);
                            return (
                              <option key={q.id} value={globalIdx}>
                                Q{globalIdx + 1}: {q.question} ({q.type.replace("_", " ")})
                              </option>
                            );
                          })}
                        </optgroup>
                      );
                    })
                  ) : (
                    activeQuestions.map((q, idx) => (
                      <option key={q.id} value={idx}>
                        Q{idx + 1}: {q.question} ({q.type.replace("_", " ")})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Answers under Selected Question */}
              {(() => {
                const currentQ = activeQuestions[selectedQuestionIndex];
                if (!currentQ) return null;
                const agg = getQuestionAggregation(currentQ);

                return (
                  <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-[#E78023] uppercase tracking-wider">
                          Question {selectedQuestionIndex + 1} of {activeQuestions.length}
                        </span>
                        <h3 className="text-lg font-heading font-extrabold text-slate-900">
                          {currentQ.question}
                        </h3>
                        {currentQ.description && (
                          <p className="text-xs text-slate-500">{currentQ.description}</p>
                        )}
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 shrink-0">
                        {agg.totalAnswered} Responses
                      </span>
                    </div>

                    {/* Respondent Answers List */}
                    <div className="space-y-3">
                      {responses.map((r, rIdx) => {
                        const rawAns = r.answers ? r.answers[currentQ.id] : undefined;
                        if (rawAns === undefined || rawAns === null || rawAns === "") {
                          return null;
                        }
                        const displayAns = Array.isArray(rawAns) ? rawAns.join(", ") : String(rawAns);

                        return (
                          <div
                            key={r.id || rIdx}
                            className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-slate-900">
                                {displayAns}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span className="font-semibold text-slate-700">{r.userName || "Anonymous"}</span>
                                {r.userBtId && <span>• {r.userBtId}</span>}
                                {r.userDepartment && <span>• {r.userDepartment}</span>}
                              </div>
                            </div>

                            <span className="text-[11px] text-slate-400 font-mono shrink-0">
                              {new Date(r.submittedAt).toLocaleDateString("en-IN")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: INDIVIDUAL TAB                                     */}
      {/* ========================================================= */}
      {activeTab === "individual" && (
        <div className="space-y-5">
          {responses.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
              No submissions recorded yet.
            </div>
          ) : (
            <>
              {/* Stepper Navigation Toolbar */}
              <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIndividualIndex((prev) => Math.max(0, prev - 1))}
                    disabled={individualIndex === 0}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-700 px-2">
                    {individualIndex + 1} of {responses.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIndividualIndex((prev) => Math.min(responses.length - 1, prev + 1))}
                    disabled={individualIndex === responses.length - 1}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Status Resolution Actions */}
                {allowStatusResolution && onUpdateStatus && currentIndividual && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(currentIndividual.id, "approved")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        currentIndividual.status === "approved"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(currentIndividual.id, "reviewed")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        currentIndividual.status === "reviewed"
                          ? "bg-[#17458F] text-white shadow-2xs"
                          : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                      }`}
                    >
                      <span>Reviewed</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(currentIndividual.id, "rejected")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        currentIndividual.status === "rejected"
                          ? "bg-rose-600 text-white shadow-2xs"
                          : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Responder Card */}
              {currentIndividual && (
                <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
                  {/* Responder Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-extrabold text-lg text-slate-900">
                          {currentIndividual.userName || "Anonymous Council Member"}
                        </h3>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          currentIndividual.status === "approved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : currentIndividual.status === "rejected"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : currentIndividual.status === "reviewed"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {currentIndividual.status || "Pending Review"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {currentIndividual.userBtId && <span>BT ID: <strong>{currentIndividual.userBtId}</strong></span>}
                        {currentIndividual.userDepartment && <span>• Dept: <strong>{currentIndividual.userDepartment}</strong></span>}
                        {currentIndividual.userYear && <span>• Year: <strong>{currentIndividual.userYear}</strong></span>}
                        {currentIndividual.userEmail && <span>• {currentIndividual.userEmail}</span>}
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-400 font-mono shrink-0">
                      <span>Submitted: {new Date(currentIndividual.submittedAt).toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  {/* Form Questions & Answers Cards (Grouped By Sections) */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                        SRC Forms • Submitted Responses by Section
                      </h4>
                      {formSections.length > 1 && (
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {formSections.length} Sections
                        </span>
                      )}
                    </div>

                    {activeQuestions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No questions defined in form.</p>
                    ) : formSections.length > 1 ? (
                      <div className="space-y-5">
                        {/* Respondent Section Journey Path Tracker */}
                        <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold uppercase tracking-wider text-purple-950 flex items-center gap-1.5 text-[11px]">
                              <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                              Respondent Section Journey (Conditional Flow)
                            </span>
                            <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-100/90 px-2 py-0.5 rounded-full">
                              {currentIndividual.sectionPath ? `${currentIndividual.sectionPath.length} Sections Visited` : "Flow Tracked"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
                            {formSections.map((sec, sIdx) => {
                              const wasVisited = currentIndividual.sectionPath && currentIndividual.sectionPath.length > 0
                                ? currentIndividual.sectionPath.includes(sec.id)
                                : (currentIndividualSections.find((s) => s.section.id === sec.id)?.answeredCount || 0) > 0 || sIdx === 0;
                              return (
                                <React.Fragment key={sec.id}>
                                  <span
                                    className={cn(
                                      "px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs",
                                      wasVisited
                                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                        : "bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60"
                                    )}
                                  >
                                    {wasVisited ? (
                                      <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                    ) : (
                                      <X className="w-3 h-3 text-slate-400" />
                                    )}
                                    <span>Sec {sec.sectionIndex}: {sec.title}</span>
                                  </span>
                                  {sIdx < formSections.length - 1 && (
                                    <span className="text-slate-300 font-bold text-xs">→</span>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>

                        {currentIndividualSections.map((secInfo) => {
                          const { section, answeredCount, totalCount, isCompletelySkipped } = secInfo;
                          const eligibleFields = section.fields.filter((f) => f.type !== "note" && f.type !== "section" && f.type !== "whatsapp_link");
                          const waFields = section.fields.filter((f) => f.type === "whatsapp_link");

                          return (
                            <div
                              key={section.id}
                              className={cn(
                                "rounded-2xl border transition-all overflow-hidden",
                                isCompletelySkipped
                                  ? "bg-slate-50/60 border-slate-200/80"
                                  : "bg-white border-slate-200 shadow-2xs"
                              )}
                            >
                              {/* Section Divider Header */}
                              <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#17458F]/10 text-[#17458F]">
                                      Section {section.sectionIndex} of {formSections.length}
                                    </span>
                                    <h5 className="font-heading font-extrabold text-sm text-slate-900">
                                      {section.title}
                                    </h5>
                                  </div>
                                  {section.description && (
                                    <p className="text-xs text-slate-500 mt-1">{section.description}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {isCompletelySkipped ? (
                                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                      <span>↷ Skipped by conditional logic</span>
                                      <span className="text-slate-400 font-normal">(0/{totalCount})</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                      <span>✓ Answered</span>
                                      <span className="text-emerald-600/70 font-normal">({answeredCount}/{totalCount})</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Section Fields */}
                              <div className="p-4 space-y-3">
                                {waFields.length > 0 && !isCompletelySkipped && (
                                  <div className="space-y-2">
                                    {waFields.map((wa) => (
                                      <div key={wa.id} className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-7 h-7 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0">
                                            <MessageCircle className="w-4 h-4 fill-white" />
                                          </div>
                                          <div>
                                            <p className="text-xs font-bold text-emerald-950">{wa.question || "WhatsApp Group Link"}</p>
                                            {wa.waGroupName && <p className="text-[11px] text-emerald-700">{wa.waGroupName}</p>}
                                          </div>
                                        </div>
                                        {wa.waGroupUrl && (
                                          <a
                                            href={wa.waGroupUrl.startsWith("http") ? wa.waGroupUrl : `https://${wa.waGroupUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                                          >
                                            <span>Group Link</span>
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {eligibleFields.length === 0 && waFields.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic">No questions in this section.</p>
                                ) : isCompletelySkipped ? (
                                  <div className="p-3 rounded-xl bg-slate-100/70 border border-dashed border-slate-200 text-xs text-slate-500 italic flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-[10px] font-bold not-italic text-slate-700">↷ Skipped by conditional logic</span>
                                    <span>This section was bypassed based on the responder&apos;s answer branching choices.</span>
                                  </div>
                                ) : (
                                  eligibleFields.map((q, qIdx) => {
                                    const rawAns = currentIndividual.answers ? currentIndividual.answers[q.id] : undefined;
                                    const hasAnswer = rawAns !== undefined && rawAns !== null && rawAns !== "";
                                    const displayAns = Array.isArray(rawAns) ? rawAns.join(", ") : String(rawAns || "—");

                                    return (
                                      <div
                                        key={q.id}
                                        className={cn(
                                          "p-4 rounded-xl border space-y-1.5",
                                          hasAnswer ? "bg-slate-50 border-slate-200" : "bg-slate-50/40 border-slate-200/60 opacity-60"
                                        )}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                            <span className="text-[#E78023] font-mono text-[11px]">Q{qIdx + 1}.</span>
                                            <span>{q.question}</span>
                                          </span>
                                          <div className="flex items-center gap-1.5">
                                            {hasAnswer ? (
                                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                ✓ Answered
                                              </span>
                                            ) : (
                                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                                ↷ Skipped
                                              </span>
                                            )}
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase bg-slate-200/60 px-2 py-0.5 rounded">
                                              {q.type.replace("_", " ")}
                                            </span>
                                          </div>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-900 pl-6 break-words">
                                          {displayAns}
                                        </p>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      activeQuestions.map((q, qIdx) => {
                        const rawAns = currentIndividual.answers ? currentIndividual.answers[q.id] : undefined;
                        const displayAns = Array.isArray(rawAns) ? rawAns.join(", ") : String(rawAns || "—");

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
                              <span className="text-[10px] font-semibold text-slate-400 uppercase bg-slate-200/60 px-2 py-0.5 rounded">
                                {q.type.replace("_", " ")}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 pl-6 break-words">
                              {displayAns}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: TABLE TAB                                          */}
      {/* ========================================================= */}
      {activeTab === "table" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member, BT ID, response..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#17458F] cursor-pointer"
              >
                <option value="all">All Statuses ({responses.length})</option>
                <option value="pending">Pending ({metrics.pending})</option>
                <option value="approved">Approved ({metrics.approved})</option>
                <option value="reviewed">Reviewed ({metrics.reviewed})</option>
                <option value="rejected">Rejected ({metrics.rejected})</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">BT ID</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Year</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResponses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        No responses match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredResponses.map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {r.userName || "Anonymous"}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          {r.userBtId || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {r.userDepartment || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {r.userYear || "—"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                          {new Date(r.submittedAt).toLocaleDateString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            r.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : r.status === "rejected"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : r.status === "reviewed"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {r.status || "Pending"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const targetIdx = responses.findIndex((x) => x.id === r.id);
                              if (targetIdx !== -1) {
                                setIndividualIndex(targetIdx);
                                setActiveTab("individual");
                              }
                            }}
                            className="text-xs font-bold text-[#17458F] hover:underline cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
