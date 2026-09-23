import React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200/70",
        className
      )}
    />
  );
}

export function EventCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col justify-between shadow-xs font-sans">
      {/* Top Image Placeholder */}
      <div className="relative h-48 w-full bg-slate-100 animate-pulse">
        <div className="absolute top-3 left-3 flex gap-2">
          <div className="h-5 w-20 rounded-full bg-slate-200" />
          <div className="h-5 w-24 rounded-full bg-slate-200" />
        </div>
      </div>

      {/* Content Area */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div className="h-3 w-20 rounded-full bg-slate-200 animate-pulse" />
          <div className="h-6 w-4/5 rounded-lg bg-slate-200 animate-pulse" />
          <div className="space-y-1.5 pt-1">
            <div className="h-3.5 w-full rounded-sm bg-slate-100 animate-pulse" />
            <div className="h-3.5 w-2/3 rounded-sm bg-slate-100 animate-pulse" />
          </div>

          <div className="pt-3 space-y-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-slate-200 animate-pulse shrink-0" />
              <div className="h-3.5 w-32 rounded-sm bg-slate-100 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-slate-200 animate-pulse shrink-0" />
              <div className="h-3.5 w-40 rounded-sm bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
          <div className="h-10 flex-1 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function MemberCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 flex flex-col items-center text-center space-y-4 shadow-xs">
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-100 animate-pulse border-2 border-slate-200" />
      <div className="space-y-2 w-full flex flex-col items-center">
        <div className="h-5 w-32 rounded-md bg-slate-200 animate-pulse" />
        <div className="h-4 w-24 rounded-full bg-slate-100 animate-pulse" />
        <div className="h-3 w-40 rounded-sm bg-slate-100 animate-pulse" />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <div className="w-7 h-7 rounded-full bg-slate-100 animate-pulse" />
        <div className="w-7 h-7 rounded-full bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}

export function ClubCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
        <div className="h-5 w-20 rounded-full bg-slate-100 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-5 w-36 rounded-md bg-slate-200 animate-pulse" />
        <div className="h-3.5 w-full rounded-sm bg-slate-100 animate-pulse" />
        <div className="h-3.5 w-4/5 rounded-sm bg-slate-100 animate-pulse" />
      </div>
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="h-4 w-24 rounded-md bg-slate-100 animate-pulse" />
        <div className="w-6 h-6 rounded-full bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 rounded-full bg-slate-100 animate-pulse" />
        <div className="h-4 w-16 rounded-md bg-slate-100 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-5 w-3/4 rounded-md bg-slate-200 animate-pulse" />
        <div className="h-3.5 w-full rounded-sm bg-slate-100 animate-pulse" />
        <div className="h-3.5 w-2/3 rounded-sm bg-slate-100 animate-pulse" />
      </div>
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="h-8 w-28 rounded-lg bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}

export function GalleryCardSkeleton() {
  return (
    <div className="rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden h-64 sm:h-72 animate-pulse" />
  );
}
