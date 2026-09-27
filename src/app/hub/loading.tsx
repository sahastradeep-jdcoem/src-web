import React from "react";
import { ListingCardSkeleton } from "@/components/ui/SkeletonCard";

export default function HubLoading() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans pb-24">
      {/* Top Hero Banner Skeleton */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white pt-12 pb-14 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="h-6 w-36 rounded-full bg-slate-700 animate-pulse" />
          <div className="h-12 w-2/3 max-w-xl rounded-xl bg-slate-700 animate-pulse" />
          <div className="h-4 w-1/2 max-w-md rounded-md bg-slate-800 animate-pulse" />
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Filter Pills Skeleton */}
        <div className="flex gap-2 pb-4 overflow-x-auto no-scrollbar">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-10 w-32 rounded-2xl bg-white border border-slate-200 animate-pulse shrink-0" />
          ))}
        </div>

        {/* Listings Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
