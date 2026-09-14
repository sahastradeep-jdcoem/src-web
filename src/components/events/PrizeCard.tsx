import React from "react";
import { EventPrize } from "@/types";
import { Trophy, Award, Medal, Crown, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrizeCardProps {
  prize: EventPrize;
  index: number;
  totalCount?: number;
  isSpanFull?: boolean;
}

export function PrizeCard({ prize, index, totalCount, isSpanFull = false }: PrizeCardProps) {
  const isWinner = index === 0;
  const isRunnerUp = index === 1;
  const isThird = index === 2;

  // Extract rank prefix and award title if combined (e.g., "1st Place - Champion")
  const parsePosition = () => {
    const raw = (prize.position || "").trim();
    if (!raw) {
      if (isWinner) return { rankText: "1st Place", title: "Champion" };
      if (isRunnerUp) return { rankText: "2nd Place", title: "First Runner-up" };
      if (isThird) return { rankText: "3rd Place", title: "Second Runner-up" };
      return { rankText: `Tier #${index + 1}`, title: `Podium Tier ${index + 1}` };
    }

    const match = raw.match(
      /^(1st(?:\s+place)?|2nd(?:\s+place)?|3rd(?:\s+place)?|winner|champion|runner\s*up|second\s*runner\s*up|first\s*place|second\s*place|third\s*place)\s*[-:—–]\s*(.+)$/i
    );

    if (match) {
      const parsedRank = match[1].trim();
      const parsedTitle = match[2].trim();
      return {
        rankText: parsedRank.toUpperCase(),
        title: parsedTitle,
      };
    }

    const defaultRank = isWinner
      ? "1st Place"
      : isRunnerUp
      ? "2nd Place"
      : isThird
      ? "3rd Place"
      : `Tier #${index + 1}`;

    return {
      rankText: defaultRank,
      title: raw,
    };
  };

  const { rankText, title } = parsePosition();

  // Inspect amount content (cash vs trophy/laurels vs blank)
  const rawAmount = (prize.amount || "").trim();
  const hasCurrencyOrDigits = /[₹$€£]|\d/i.test(rawAmount);
  const isCash = hasCurrencyOrDigits && !/^(trophy|shield|medal|award|certificate)/i.test(rawAmount);

  // Check if amount is redundant with title (e.g. title: "Championship Trophy" & amount: "Championship Trophy")
  const isRedundantAmount =
    !isCash &&
    rawAmount &&
    (title.toLowerCase().includes(rawAmount.toLowerCase()) ||
      rawAmount.toLowerCase().includes(title.toLowerCase()));

  // Podium tier styles configuration
  const getTierTheme = () => {
    if (isWinner) {
      return {
        badgeLabel: "Champion",
        badgeIcon: Crown,
        badgeClass: "bg-gradient-to-r from-amber-500 to-[#E78023] text-white shadow-2xs shadow-amber-500/20",
        containerClass:
          "bg-gradient-to-b from-amber-500/[0.07] via-white to-amber-50/[0.15] border-amber-300/80 shadow-[0_4px_18px_rgba(231,128,35,0.08)] ring-1 ring-amber-300/30",
        accentLine: "bg-gradient-to-r from-amber-400 via-[#E78023] to-amber-500",
        iconBoxClass:
          "bg-gradient-to-br from-amber-400 to-[#E78023] text-white shadow-xs shadow-amber-500/25 ring-2 ring-amber-100",
        icon: Trophy,
        amountColor: "text-[#E78023]",
        accentBg: "bg-amber-500/[0.08] border-amber-500/20 text-amber-900",
      };
    }

    if (isRunnerUp) {
      return {
        badgeLabel: "Runner Up",
        badgeIcon: Medal,
        badgeClass: "bg-slate-800 text-white shadow-2xs",
        containerClass:
          "bg-gradient-to-b from-slate-100/60 via-white to-slate-50/40 border-slate-300 shadow-[0_4px_18px_rgba(100,116,139,0.06)] ring-1 ring-slate-200",
        accentLine: "bg-gradient-to-r from-slate-400 via-slate-600 to-slate-500",
        iconBoxClass:
          "bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-xs shadow-slate-800/20 ring-2 ring-slate-100",
        icon: Medal,
        amountColor: "text-slate-800",
        accentBg: "bg-slate-100 border-slate-200 text-slate-800",
      };
    }

    if (isThird) {
      return {
        badgeLabel: "2nd Runner Up",
        badgeIcon: Award,
        badgeClass: "bg-amber-800 text-white shadow-2xs",
        containerClass:
          "bg-gradient-to-b from-amber-900/[0.04] via-white to-amber-800/[0.02] border-amber-700/25 shadow-[0_4px_18px_rgba(180,83,9,0.06)]",
        accentLine: "bg-gradient-to-r from-amber-700 via-amber-800 to-amber-700",
        iconBoxClass:
          "bg-gradient-to-br from-amber-700 to-amber-900 text-white shadow-xs shadow-amber-900/20 ring-2 ring-amber-100/60",
        icon: Award,
        amountColor: "text-amber-800",
        accentBg: "bg-amber-900/[0.06] border-amber-800/20 text-amber-900",
      };
    }

    return {
      badgeLabel: `Rank #${index + 1}`,
      badgeIcon: Sparkles,
      badgeClass: "bg-[#17458F] text-white shadow-2xs",
      containerClass:
        "bg-gradient-to-b from-blue-50/50 via-white to-slate-50/30 border-[#17458F]/20 hover:border-[#17458F]/40 shadow-xs",
      accentLine: "bg-[#17458F]",
      iconBoxClass:
        "bg-[#17458F] text-white shadow-xs shadow-[#17458F]/20 ring-2 ring-blue-100",
      icon: Award,
      amountColor: "text-[#17458F]",
      accentBg: "bg-blue-50 border-blue-200 text-[#17458F]",
    };
  };

  const theme = getTierTheme();
  const BadgeIcon = theme.badgeIcon;
  const MainIcon = theme.icon;

  // Horizontal wide layout for the 3rd tile going below the top 2
  if (isSpanFull) {
    return (
      <div
        className={cn(
          "relative rounded-2xl sm:rounded-3xl p-4 sm:p-5 border transition-all duration-300 overflow-hidden group hover:-translate-y-0.5",
          theme.containerClass
        )}
      >
        {/* Top Accent Stripe */}
        <div className={cn("absolute top-0 left-0 right-0 h-1", theme.accentLine)} />

        <div className="relative z-1 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-start">
          {/* Left Column: Header, Title & Reward */}
          <div className="space-y-3 sm:border-r sm:border-slate-100 sm:pr-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", theme.iconBoxClass)}>
                  <MainIcon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  {rankText}
                </span>
              </div>
              <div
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0",
                  theme.badgeClass
                )}
              >
                <BadgeIcon className="w-3 h-3" />
                <span>{theme.badgeLabel}</span>
              </div>
            </div>

            <div>
              <h4 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 leading-snug break-normal">
                {title}
              </h4>
            </div>

            <div>
              {isCash ? (
                <div className="p-3 rounded-xl bg-white/95 border border-slate-100 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                      Grant &amp; Cash Prize
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                      Award
                    </span>
                  </div>
                  <div className={cn("text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5", theme.amountColor)}>
                    {rawAmount}
                  </div>
                </div>
              ) : isRedundantAmount ? (
                <div className={cn("p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold", theme.accentBg)}>
                  <Trophy className="w-4 h-4 shrink-0 opacity-80" />
                  <span>Official Championship Trophy &amp; Laurels</span>
                </div>
              ) : rawAmount ? (
                <div className="p-3 rounded-xl bg-white/95 border border-slate-100 shadow-2xs">
                  <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                    Podium Recognition
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight mt-0.5 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{rawAmount}</span>
                  </div>
                </div>
              ) : (
                <div className={cn("p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold", theme.accentBg)}>
                  <Award className="w-4 h-4 shrink-0 opacity-80" />
                  <span>Certificate of Merit &amp; Laurels</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Perks & Benefits */}
          <div className="space-y-2">
            {prize.perks && prize.perks.length > 0 ? (
              <>
                <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#E78023]" />
                  <span>Included Honors &amp; Benefits</span>
                </div>
                <ul className="space-y-1.5">
                  {prize.perks.map((perk, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50/80 hover:bg-slate-100/70 border border-slate-100 text-[11px] sm:text-xs font-medium text-slate-700 leading-snug transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-slate-800">{perk}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-xs text-slate-500 font-medium">
                Official podium distinction certificate awarded to all winning participants.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard Compact "Small Tile"
  return (
    <div
      className={cn(
        "relative rounded-2xl sm:rounded-3xl p-4 sm:p-5 border transition-all duration-300 overflow-hidden flex flex-col justify-between h-full group hover:-translate-y-0.5",
        theme.containerClass
      )}
    >
      {/* Top Accent Stripe */}
      <div className={cn("absolute top-0 left-0 right-0 h-1", theme.accentLine)} />

      <div className="relative z-1 space-y-3.5 flex flex-col justify-between h-full">
        <div>
          {/* Row 1: Icon + Rank Eyebrow on left, Badge on right */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", theme.iconBoxClass)}>
                <MainIcon className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block leading-tight">
                  {rankText}
                </span>
              </div>
            </div>

            <div
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0",
                theme.badgeClass
              )}
            >
              <BadgeIcon className="w-3 h-3" />
              <span>{theme.badgeLabel}</span>
            </div>
          </div>

          {/* Row 2: Dedicated Title across entire width to prevent letter breaks */}
          <div className="mt-2.5">
            <h4 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 leading-snug break-normal">
              {title}
            </h4>
          </div>

          {/* Prize Value / Award Feature Box */}
          <div className="mt-3">
            {isCash ? (
              <div className="p-3 rounded-xl bg-white/95 border border-slate-100 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                    Grant &amp; Cash Prize
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                    Award
                  </span>
                </div>
                <div className={cn("text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5", theme.amountColor)}>
                  {rawAmount}
                </div>
              </div>
            ) : isRedundantAmount ? (
              <div className={cn("p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold", theme.accentBg)}>
                <Trophy className="w-4 h-4 shrink-0 opacity-80" />
                <span>Official Championship Trophy &amp; Laurels</span>
              </div>
            ) : rawAmount ? (
              <div className="p-3 rounded-xl bg-white/95 border border-slate-100 shadow-2xs">
                <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                  Podium Recognition
                </div>
                <div className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight mt-0.5 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="line-clamp-1">{rawAmount}</span>
                </div>
              </div>
            ) : (
              <div className={cn("p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold", theme.accentBg)}>
                <Award className="w-4 h-4 shrink-0 opacity-80" />
                <span>Certificate of Merit &amp; Laurels</span>
              </div>
            )}
          </div>
        </div>

        {/* Perks & Recognition Badges List */}
        {prize.perks && prize.perks.length > 0 && (
          <div className="pt-2.5 border-t border-slate-100/90 mt-auto">
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#E78023]" />
              <span>Included Honors &amp; Benefits</span>
            </div>
            <ul className="space-y-1.5">
              {prize.perks.map((perk, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50/80 hover:bg-slate-100/70 border border-slate-100 text-[11px] sm:text-xs font-medium text-slate-700 leading-snug transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-slate-800">{perk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
