import React from "react";
import { EventPrize } from "@/types";
import { Trophy, Award, Medal, Crown, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrizeCardProps {
  prize: EventPrize;
  index: number;
  totalCount?: number;
}

export function PrizeCard({ prize, index, totalCount }: PrizeCardProps) {
  const isWinner = index === 0;
  const isRunnerUp = index === 1;
  const isThird = index === 2;

  // Extract rank prefix and award title if combined (e.g., "1st Place - Championship Trophy")
  const parsePosition = () => {
    const raw = (prize.position || "").trim();
    if (!raw) {
      if (isWinner) return { rankText: "1st Place", title: "Champion" };
      if (isRunnerUp) return { rankText: "2nd Place", title: "Runner Up" };
      if (isThird) return { rankText: "3rd Place", title: "Second Runner Up" };
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
        badgeClass: "bg-gradient-to-r from-amber-500 to-[#E78023] text-white shadow-xs shadow-amber-500/20",
        containerClass:
          "bg-gradient-to-b from-amber-500/[0.08] via-white to-amber-50/[0.2] border-amber-300/90 shadow-[0_10px_30px_rgba(231,128,35,0.12)] ring-1 ring-amber-300/40",
        accentLine: "bg-gradient-to-r from-amber-400 via-[#E78023] to-amber-500",
        iconBoxClass:
          "bg-gradient-to-br from-amber-400 to-[#E78023] text-white shadow-md shadow-amber-500/25 ring-4 ring-amber-100",
        icon: Trophy,
        watermarkIcon: Trophy,
        amountColor: "text-[#E78023]",
        accentBg: "bg-amber-500/[0.08] border-amber-500/20 text-amber-900",
      };
    }

    if (isRunnerUp) {
      return {
        badgeLabel: "Runner Up",
        badgeIcon: Medal,
        badgeClass: "bg-slate-800 text-white shadow-xs",
        containerClass:
          "bg-gradient-to-b from-slate-100/70 via-white to-slate-50/40 border-slate-300 shadow-[0_8px_25px_rgba(100,116,139,0.09)] ring-1 ring-slate-200",
        accentLine: "bg-gradient-to-r from-slate-400 via-slate-600 to-slate-500",
        iconBoxClass:
          "bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-md shadow-slate-800/20 ring-4 ring-slate-100",
        icon: Medal,
        watermarkIcon: Medal,
        amountColor: "text-slate-800",
        accentBg: "bg-slate-100 border-slate-200 text-slate-800",
      };
    }

    if (isThird) {
      return {
        badgeLabel: "2nd Runner Up",
        badgeIcon: Award,
        badgeClass: "bg-amber-800 text-white shadow-xs",
        containerClass:
          "bg-gradient-to-b from-amber-900/[0.04] via-white to-amber-800/[0.02] border-amber-700/30 shadow-[0_6px_20px_rgba(180,83,9,0.08)]",
        accentLine: "bg-gradient-to-r from-amber-700 via-amber-800 to-amber-700",
        iconBoxClass:
          "bg-gradient-to-br from-amber-700 to-amber-900 text-white shadow-md shadow-amber-900/20 ring-4 ring-amber-100/60",
        icon: Award,
        watermarkIcon: Award,
        amountColor: "text-amber-800",
        accentBg: "bg-amber-900/[0.06] border-amber-800/20 text-amber-900",
      };
    }

    return {
      badgeLabel: `Rank #${index + 1}`,
      badgeIcon: Sparkles,
      badgeClass: "bg-[#17458F] text-white shadow-xs",
      containerClass:
        "bg-gradient-to-b from-blue-50/50 via-white to-slate-50/30 border-[#17458F]/20 hover:border-[#17458F]/40 shadow-sm",
      accentLine: "bg-[#17458F]",
      iconBoxClass:
        "bg-[#17458F] text-white shadow-md shadow-[#17458F]/20 ring-4 ring-blue-100",
      icon: Award,
      watermarkIcon: Award,
      amountColor: "text-[#17458F]",
      accentBg: "bg-blue-50 border-blue-200 text-[#17458F]",
    };
  };

  const theme = getTierTheme();
  const BadgeIcon = theme.badgeIcon;
  const MainIcon = theme.icon;
  const WatermarkIcon = theme.watermarkIcon;

  return (
    <div
      className={cn(
        "relative rounded-3xl p-6 sm:p-7 border transition-all duration-300 overflow-hidden flex flex-col justify-between h-full group hover:-translate-y-1",
        theme.containerClass
      )}
    >
      {/* Top Border Accent Stripe */}
      <div className={cn("absolute top-0 left-0 right-0 h-1.5", theme.accentLine)} />

      {/* Subtle Background Watermark Icon */}
      <div className="absolute -right-5 -bottom-5 pointer-events-none opacity-[0.035] group-hover:opacity-[0.06] transition-opacity duration-300">
        <WatermarkIcon className="w-48 h-48 text-slate-950" />
      </div>

      <div className="relative z-1 space-y-5">
        {/* Header Row: Rank Icon + Titles + Rank Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className={cn("w-13 h-13 rounded-2xl flex items-center justify-center shrink-0", theme.iconBoxClass)}>
              <MainIcon className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-0.5">
                {rankText}
              </span>
              <h4 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900 leading-snug break-words">
                {title}
              </h4>
            </div>
          </div>

          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0",
              theme.badgeClass
            )}
          >
            <BadgeIcon className="w-3 h-3" />
            <span>{theme.badgeLabel}</span>
          </div>
        </div>

        {/* Prize Value / Award Feature Box */}
        {isCash ? (
          <div className="p-4 rounded-2xl bg-white/90 border border-slate-100/90 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Grant &amp; Cash Prize
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                Direct Award
              </span>
            </div>
            <div className={cn("text-2xl sm:text-3xl font-extrabold tracking-tight mt-1", theme.amountColor)}>
              {rawAmount}
            </div>
          </div>
        ) : isRedundantAmount ? (
          <div className={cn("p-3.5 rounded-2xl border flex items-center gap-3", theme.accentBg)}>
            <Trophy className="w-5 h-5 shrink-0 opacity-80" />
            <div className="text-xs font-bold leading-tight">
              Official Championship Trophy &amp; Winner Laurels
            </div>
          </div>
        ) : rawAmount ? (
          <div className="p-4 rounded-2xl bg-white/90 border border-slate-100/90 shadow-2xs">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Podium Recognition
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{rawAmount}</span>
            </div>
          </div>
        ) : (
          <div className={cn("p-3.5 rounded-2xl border flex items-center gap-3", theme.accentBg)}>
            <Award className="w-5 h-5 shrink-0 opacity-80" />
            <div className="text-xs font-bold leading-tight">
              Honorary Certificate of Merit &amp; Laurels
            </div>
          </div>
        )}

        {/* Perks & Recognition Badges List */}
        {prize.perks && prize.perks.length > 0 && (
          <div className="pt-3 border-t border-slate-100/90">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#E78023]" />
              <span>Included Honors &amp; Benefits</span>
            </div>
            <ul className="space-y-2">
              {prize.perks.map((perk, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-slate-50/80 hover:bg-slate-100/70 border border-slate-100 text-xs font-medium text-slate-700 leading-snug transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
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
