import React from "react";
import { Zap, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiDimensionalMatch } from "@/lib/payments/types";

interface MultiDimensionalMatchBadgeProps {
  match: MultiDimensionalMatch;
  className?: string;
}

export const MultiDimensionalMatchBadge: React.FC<MultiDimensionalMatchBadgeProps> = ({
  match,
  className
}) => {
  const isEligible = match.isEligibleForAutoApproval;

  return (
    <div className={cn("space-y-0.5", className)}>
      <div
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border",
          isEligible
            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
            : "bg-amber-50 text-amber-800 border-amber-300"
        )}
      >
        <Zap className={cn("w-2.5 h-2.5", isEligible ? "text-emerald-600" : "text-amber-600")} />
        <span>
          {match.matchedDimensionsCount} Dims ({match.confidence}% Match)
        </span>
        {match.timeDeltaSeconds !== undefined && (
          <span className={cn("text-[8px] font-medium", isEligible ? "text-emerald-600" : "text-amber-600")}>
            • Δ{Math.round(match.timeDeltaSeconds / 60)}m
          </span>
        )}
      </div>
      {match.matchedDimensions && match.matchedDimensions.length > 0 && (
        <div
          className="text-[9px] text-slate-500 font-medium truncate max-w-[150px]"
          title={match.matchedDimensions.join(" + ")}
        >
          {match.matchedDimensions.join(" + ")}
        </div>
      )}
    </div>
  );
};
