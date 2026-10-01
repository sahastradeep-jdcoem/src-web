"use client";

import React, { useState } from "react";
import { 
  ShieldCheck, 
  Scale, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  BadgeAlert,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EventRulesSectionProps {
  rules: string[];
}

interface ParsedRule {
  id: string;
  num: string;
  topic: string;
  primaryText: string;
  detailedText?: string;
  isDetailed: boolean;
}

/**
 * Infer professional category topic from rule keywords if no explicit header is given.
 */
function inferRuleTopic(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("id card") || lower.includes("college id") || lower.includes("identity") || lower.includes("accreditation")) return "Identity Verification";
  if (lower.includes("team") || lower.includes("squad") || lower.includes("register") || lower.includes("registration")) return "Team Registration";
  if (lower.includes("discipline") || lower.includes("decorum") || lower.includes("misconduct") || lower.includes("behavior")) return "Code of Conduct";
  if (lower.includes("referee") || lower.includes("umpire") || lower.includes("official") || lower.includes("decision")) return "Match Officiating";
  if (lower.includes("dress") || lower.includes("shoe") || lower.includes("uniform") || lower.includes("kit") || lower.includes("attire")) return "Dress Code & Attire";
  if (lower.includes("eligib") || lower.includes("exclusiv") || lower.includes("girl") || lower.includes("boy") || lower.includes("student")) return "Eligibility Criteria";
  if (lower.includes("fee") || lower.includes("payment") || lower.includes("refund")) return "Fees & Cancellation";
  if (lower.includes("time") || lower.includes("late") || lower.includes("punctual") || lower.includes("reporting") || lower.includes("schedule")) return "Reporting & Timings";
  if (lower.includes("safety") || lower.includes("medical") || lower.includes("injury") || lower.includes("hazard")) return "Safety Protocol";
  if (lower.includes("prize") || lower.includes("award") || lower.includes("certificate") || lower.includes("trophy")) return "Prizes & Recognition";
  return "General Regulation";
}

/**
 * Intelligently parse raw rule strings without arbitrary chopped ellipsis.
 */
function parseRuleItem(raw: string, index: number): ParsedRule {
  const clean = raw.trim();
  const num = String(index + 1).padStart(2, "0");
  const id = `regulation-${index + 1}`;

  // Check for explicit topic format (e.g. "Topic: Content" or "Topic - Content")
  const separatorMatch = clean.match(/^([A-Za-z0-9\s&/]{3,35})\s*[:–—]\s*(.+)$/);
  if (separatorMatch) {
    const customTopic = separatorMatch[1].trim();
    const rest = separatorMatch[2].trim();
    
    // Check if the rest has multiple sentences for deep drawer
    const periodIdx = rest.indexOf(". ");
    if (periodIdx > 25 && periodIdx < rest.length - 15) {
      return {
        id,
        num,
        topic: customTopic,
        primaryText: rest.slice(0, periodIdx + 1).trim(),
        detailedText: rest.slice(periodIdx + 2).trim(),
        isDetailed: true,
      };
    }

    return {
      id,
      num,
      topic: customTopic,
      primaryText: rest,
      isDetailed: false,
    };
  }

  // Automatic semantic topic inference
  const inferred = inferRuleTopic(clean);

  // If multi-sentence paragraph, highlight the first complete takeaway
  const firstPeriod = clean.indexOf(". ");
  if (firstPeriod > 35 && firstPeriod < clean.length - 20) {
    return {
      id,
      num,
      topic: inferred,
      primaryText: clean.slice(0, firstPeriod + 1).trim(),
      detailedText: clean.slice(firstPeriod + 2).trim(),
      isDetailed: true,
    };
  }

  // Self-contained statement
  return {
    id,
    num,
    topic: inferred,
    primaryText: clean,
    isDetailed: false,
  };
}

export function EventRulesSection({ rules }: EventRulesSectionProps) {
  if (!rules || rules.length === 0) return null;

  const parsedRules: ParsedRule[] = rules
    .map((r) => (typeof r === "string" ? r.trim() : ""))
    .filter(Boolean)
    .map(parseRuleItem);

  if (parsedRules.length === 0) return null;

  const hasAnyDetails = parsedRules.some((r) => r.isDetailed);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [allExpanded, setAllExpanded] = useState<boolean>(false);

  const toggleItem = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (allExpanded) {
      setOpenIds([]);
      setAllExpanded(false);
    } else {
      setOpenIds(parsedRules.filter((r) => r.isDetailed).map((r) => r.id));
      setAllExpanded(true);
    }
  };

  return (
    <section className="space-y-6">
      {/* ============================================================== */}
      {/* SECTION HEADER — Aligned with JDCOEM Platform Typography       */}
      {/* ============================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#E78023]">
            <ShieldCheck className="w-4 h-4 text-[#E78023]" />
            <span>Official Code of Conduct</span>
          </div>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase tracking-tight">
            RULES &amp; GUIDELINES
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Mandatory delegate directives, match protocols, and campus code of conduct.
          </p>
        </div>

        {/* Action Header Stats & Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-50 text-[#17458F] border border-blue-200/70 shadow-2xs flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-[#17458F]" />
            <span>{parsedRules.length} Directives</span>
          </span>

          {hasAnyDetails && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-[#17458F] border border-slate-200 transition-all cursor-pointer flex items-center gap-1 active:scale-95 min-h-[32px]"
              title={allExpanded ? "Collapse all rule notes" : "Expand all rule notes"}
            >
              {allExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Expand Details</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. DESKTOP EXPERIENCE (hidden md:block)                        */}
      {/* Clean high-contrast card list with clear visual hierarchy      */}
      {/* ============================================================== */}
      <div className="hidden md:block space-y-3.5">
        {parsedRules.map((rule) => {
          const isOpen = openIds.includes(rule.id);
          const hasDetails = rule.isDetailed;

          return (
            <div
              key={rule.id}
              className={cn(
                "rounded-2xl border transition-all duration-200 bg-white shadow-2xs overflow-hidden group",
                isOpen
                  ? "border-[#17458F]/40 shadow-xs bg-gradient-to-r from-blue-50/25 via-white to-white"
                  : "border-slate-200/90 hover:border-slate-300 hover:shadow-xs"
              )}
            >
              <div
                onClick={() => hasDetails && toggleItem(rule.id)}
                className={cn(
                  "p-5 flex items-start justify-between gap-5 transition-colors",
                  hasDetails ? "cursor-pointer" : "cursor-default"
                )}
                role={hasDetails ? "button" : undefined}
                tabIndex={hasDetails ? 0 : undefined}
                onKeyDown={(e) => {
                  if (hasDetails && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    toggleItem(rule.id);
                  }
                }}
                aria-expanded={hasDetails ? isOpen : undefined}
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {/* Monospace Executive Number Badge */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl font-mono font-extrabold text-sm flex items-center justify-center shrink-0 border transition-all duration-200 mt-0.5",
                      isOpen
                        ? "bg-[#17458F] text-white border-[#17458F] shadow-xs"
                        : "bg-blue-50 text-[#17458F] border-blue-200/80 group-hover:bg-[#17458F] group-hover:text-white group-hover:border-[#17458F]"
                    )}
                  >
                    {rule.num}
                  </div>

                  {/* Directive Content Container */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    {/* Topic Badge & Status Tag */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#E78023] bg-orange-50/80 px-2.5 py-0.5 rounded-md border border-orange-200/60">
                        {rule.topic}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Mandatory</span>
                      </span>
                    </div>

                    {/* Complete Statement — Full sentence, zero truncation */}
                    <p className="text-[15px] font-semibold text-[#0F172A] leading-relaxed">
                      {rule.primaryText}
                    </p>
                  </div>
                </div>

                {/* Trailing Indicator / Drawer Toggle */}
                {hasDetails ? (
                  <div className="shrink-0 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleItem(rule.id);
                      }}
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 border border-slate-200/80 transition-all duration-200 cursor-pointer",
                        isOpen
                          ? "bg-[#E78023]/10 text-[#E78023] border-[#E78023]/30 rotate-180"
                          : "hover:bg-slate-100 hover:text-slate-700 group-hover:border-slate-300"
                      )}
                      aria-label={isOpen ? "Collapse elaboration" : "Expand elaboration"}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="shrink-0 pt-1 text-slate-300 group-hover:text-slate-400 transition-colors" title="Official Rule Directive">
                    <ShieldCheck className="w-5 h-5 text-emerald-600/70" />
                  </div>
                )}
              </div>

              {/* Elaboration Drawer */}
              {hasDetails && isOpen && (
                <div className="px-6 pb-5 pt-0 pl-[76px] text-sm text-slate-600 leading-relaxed font-medium animate-in fade-in-50 duration-200">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#17458F]">
                      <Info className="w-3.5 h-3.5 text-[#17458F] shrink-0" />
                      <span>Detailed Protocol Specifics</span>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed">{rule.detailedText}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* 2. MOBILE EXPERIENCE (block md:hidden)                         */}
      {/* Thumb-friendly, touch target >= 48px, compact & legible        */}
      {/* ============================================================== */}
      <div className="block md:hidden space-y-2.5">
        {parsedRules.map((rule) => {
          const isOpen = openIds.includes(rule.id);
          const hasDetails = rule.isDetailed;

          return (
            <div
              key={rule.id}
              className={cn(
                "rounded-2xl border transition-all duration-200 bg-white shadow-2xs overflow-hidden",
                isOpen
                  ? "border-l-4 border-l-[#17458F] border-t-slate-200 border-r-slate-200 border-b-slate-200 bg-slate-50/30"
                  : "border-slate-200"
              )}
            >
              <div
                onClick={() => hasDetails && toggleItem(rule.id)}
                className={cn(
                  "p-4 flex items-start justify-between gap-3 transition-colors min-h-[52px]",
                  hasDetails ? "cursor-pointer active:bg-slate-50" : "cursor-default"
                )}
                role={hasDetails ? "button" : undefined}
                tabIndex={hasDetails ? 0 : undefined}
                aria-expanded={hasDetails ? isOpen : undefined}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Compact Monospace Pill */}
                  <span
                    className={cn(
                      "w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 border mt-0.5",
                      isOpen
                        ? "bg-[#17458F] text-white border-[#17458F]"
                        : "bg-blue-50 text-[#17458F] border-blue-200/80"
                    )}
                  >
                    {rule.num}
                  </span>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#E78023] bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200/50">
                        {rule.topic}
                      </span>
                    </div>

                    {/* Complete Statement — Always legible on phone */}
                    <p className="text-xs sm:text-sm font-semibold text-[#0F172A] leading-snug">
                      {rule.primaryText}
                    </p>
                  </div>
                </div>

                {hasDetails && (
                  <div className="shrink-0 pt-0.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400">
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform duration-200",
                        isOpen && "rotate-180 text-[#E78023]"
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Mobile Drawer Details */}
              {hasDetails && isOpen && (
                <div className="px-4 pb-4 pt-0 pl-[48px] text-xs text-slate-600 leading-relaxed font-medium">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#17458F]">
                      <FileText className="w-3 h-3 text-[#17458F] shrink-0" />
                      <span>Additional Instructions</span>
                    </div>
                    <p className="leading-relaxed">{rule.detailedText}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* 3. OFFICIAL DISCIPLINARY COMPLIANCE BANNER                     */}
      {/* ============================================================== */}
      <div className="p-4 sm:p-4.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-950 flex items-start gap-3 shadow-2xs">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-amber-900 font-medium space-y-0.5">
          <p>
            <strong className="font-bold text-amber-950">Official Compliance Notice:</strong> All student delegates and participants are required to strictly adhere to these regulations throughout the duration of the event.
          </p>
          <p className="text-[11px] text-amber-800">
            The Student Representative Council and presiding match officials reserve the right to forfeit accreditation or disqualify individuals in case of unsporting conduct.
          </p>
        </div>
      </div>
    </section>
  );
}
