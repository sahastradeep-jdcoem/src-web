import React from "react";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10 px-4 sm:px-6 lg:px-8 space-y-8 text-[#0F172A] font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Profile Card Header Skeleton */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-200 animate-pulse shrink-0" />
            <div className="space-y-2">
              <div className="h-6 w-44 rounded-lg bg-slate-200 animate-pulse" />
              <div className="h-4 w-32 rounded-md bg-slate-100 animate-pulse" />
              <div className="h-5 w-24 rounded-full bg-slate-100 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-28 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-10 w-28 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        </div>

        {/* Navigation Tabs Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-32 rounded-xl bg-white border border-slate-200 animate-pulse shrink-0" />
          ))}
        </div>

        {/* Content Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-5 w-24 rounded-full bg-slate-100 animate-pulse" />
                <div className="h-5 w-16 rounded-md bg-slate-100 animate-pulse" />
              </div>
              <div className="h-6 w-3/4 rounded-lg bg-slate-200 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-full rounded-md bg-slate-100 animate-pulse" />
                <div className="h-4 w-2/3 rounded-md bg-slate-100 animate-pulse" />
              </div>
              <div className="h-10 w-full rounded-xl bg-slate-100 animate-pulse mt-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
