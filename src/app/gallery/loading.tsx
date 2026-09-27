import React from "react";
import { GalleryCardSkeleton } from "@/components/ui/SkeletonCard";

export default function GalleryLoading() {
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

        {/* Filter Toolbar Skeleton */}
        <div className="p-3 sm:p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-20 rounded-full bg-slate-100 animate-pulse shrink-0" />
            ))}
          </div>
          <div className="h-8 w-full md:w-48 rounded-full bg-slate-100 animate-pulse" />
        </div>

        {/* Gallery Grid Skeleton */}
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-5 space-y-3 sm:space-y-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <GalleryCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
