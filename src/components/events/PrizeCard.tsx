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

  const medalIcon = isWinner ? "🥇" : isRunnerUp ? "🥈" : "🥉";

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
      {isWinner && (
        <div className="absolute top-0 right-0 bg-[#E78023] text-white text-[10px] font-extrabold uppercase tracking-widest px-4 py-1 rounded-bl-xl shadow-xs">
          Champion
        </div>
      )}

      <div>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{medalIcon}</span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              {isWinner ? "1st Place" : isRunnerUp ? "2nd Place" : "3rd Place"}
            </span>
            <h4 className="font-bold text-lg text-[#0F172A]">
              {prize.position}
            </h4>
          </div>
        </div>

        <div className="mt-6 mb-4">
          <span className="text-3xl sm:text-4xl font-extrabold text-[#E78023] tracking-tight">
            {prize.amount}
          </span>
          <span className="text-xs text-slate-500 ml-2 font-medium">Cash Prize & Grant</span>
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
