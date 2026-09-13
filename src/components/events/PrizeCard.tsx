import React from "react";
import { EventPrize } from "@/types";
import { Trophy, Award, Medal, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrizeCardProps {
  prize: EventPrize;
  index: number;
}

export function PrizeCard({ prize, index }: PrizeCardProps) {
  const isWinner = index === 0;
  const isRunnerUp = index === 1;
  const isThird = index === 2;

  const getRankBadge = () => {
    if (isWinner) return { label: "Champion", bg: "bg-[#E78023] text-white" };
    if (isRunnerUp) return { label: "Runner Up", bg: "bg-slate-700 text-white" };
    if (isThird) return { label: "2nd Runner Up", bg: "bg-amber-700 text-white" };
    return { label: `Rank #${index + 1}`, bg: "bg-[#17458F] text-white" };
  };

  const badge = getRankBadge();

  return (
    <div
      className={cn(
        "relative rounded-3xl p-6 sm:p-7 border transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xs",
        isWinner
          ? "bg-white border-[#E78023] shadow-md scale-100 lg:scale-105 z-10"
          : "bg-white border-slate-200 hover:border-[#17458F]/40"
      )}
    >
      {/* Top Banner Tag */}
      <div
        className={cn(
          "absolute top-0 right-0 text-[10px] font-extrabold uppercase tracking-widest px-4 py-1 rounded-bl-xl shadow-xs",
          badge.bg
        )}
      >
        {badge.label}
      </div>

      <div>
        <div className="flex items-center gap-3.5">
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
              isWinner
                ? "bg-amber-50 border-amber-200 text-amber-500 shadow-xs"
                : isRunnerUp
                ? "bg-slate-100 border-slate-200 text-slate-500"
                : isThird
                ? "bg-amber-100/60 border-amber-300/60 text-amber-700"
                : "bg-blue-50 border-blue-200 text-[#17458F]"
            )}
          >
            {isWinner ? (
              <Trophy className="w-6 h-6" />
            ) : isRunnerUp ? (
              <Medal className="w-6 h-6" />
            ) : isThird ? (
              <Award className="w-6 h-6" />
            ) : (
              <Award className="w-6 h-6" />
            )}
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              {isWinner ? "1st Place" : isRunnerUp ? "2nd Place" : isThird ? "3rd Place" : `Podium Tier ${index + 1}`}
            </span>
            <h4 className="font-bold text-lg text-[#0F172A] line-clamp-1">
              {prize.position}
            </h4>
          </div>
        </div>

        <div className="mt-6 mb-4">
          <span className="text-3xl sm:text-4xl font-extrabold text-[#E78023] tracking-tight">
            {prize.amount}
          </span>
          <span className="text-xs text-slate-500 ml-2 font-medium">Cash Prize &amp; Laurels</span>
        </div>

        {/* Perks List */}
        {prize.perks && prize.perks.length > 0 && (
          <ul className="space-y-2 pt-4 border-t border-slate-100 text-xs text-slate-600 font-medium">
            {prize.perks.map((perk, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#E78023] shrink-0" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
