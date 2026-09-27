import React from "react";
import { EventCardSkeleton } from "@/components/ui/SkeletonCard";

export default function EventsLoading() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 lg:px-8 space-y-16 text-[#0F172A]">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header Skeleton */}
        <div className="space-y-4 max-w-3xl">
          <div className="h-6 w-40 rounded-full bg-slate-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-12 sm:h-16 w-3/4 rounded-xl bg-slate-200 animate-pulse" />
            <div className="h-12 sm:h-16 w-1/2 rounded-xl bg-slate-200 animate-pulse" />
          </div>
          <div className="h-5 w-2/3 rounded-lg bg-slate-100 animate-pulse" />
        </div>

        {/* Search Bar Skeleton */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="h-12 w-full rounded-2xl bg-slate-100 animate-pulse" />
        </div>

        {/* Event Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
