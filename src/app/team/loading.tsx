import React from "react";
import { MemberCardSkeleton } from "@/components/ui/SkeletonCard";

export default function TeamLoading() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8 space-y-12 text-[#0F172A]">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header Skeleton */}
        <div className="space-y-4 max-w-3xl">
          <div className="h-6 w-36 rounded-full bg-slate-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-12 sm:h-16 w-3/4 rounded-xl bg-slate-200 animate-pulse" />
            <div className="h-12 sm:h-16 w-1/2 rounded-xl bg-slate-200 animate-pulse" />
          </div>
          <div className="h-5 w-2/3 rounded-lg bg-slate-100 animate-pulse" />
        </div>

        {/* Filter Tabs Skeleton */}
        <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-28 rounded-full bg-white border border-slate-200 animate-pulse shrink-0" />
          ))}
        </div>

        {/* Member Cards Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <MemberCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
