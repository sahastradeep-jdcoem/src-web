"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Calendar, 
  RotateCcw, 
  Sparkles, 
  ExternalLink, 
  ShieldCheck, 
  Layers, 
  ChevronDown,
  Clock
} from "lucide-react";
import { getCurrentTenure, getStoredTenures, CouncilTenure } from "@/lib/tenureStore";
import { TenureSwitcherModal } from "./TenureSwitcherModal";

export function AdminTopBar() {
  const [currentTenure, setCurrentTenure] = useState<CouncilTenure | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const refreshTenure = () => {
    setCurrentTenure(getCurrentTenure());
  };

  useEffect(() => {
    refreshTenure();

    const handleUpdate = () => {
      refreshTenure();
    };

    window.addEventListener("src_tenure_changed", handleUpdate);
    window.addEventListener("src_tenures_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("src_tenure_changed", handleUpdate);
      window.removeEventListener("src_tenures_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return (
    <>
      <header className="mb-6 pb-4 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
        
        {/* Left: Active Tenure Switcher Trigger */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#E78023]">
            <Calendar className="w-4 h-4" />
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Session
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-sm text-[#17458F]">
                {currentTenure?.tenureNumber ? `${currentTenure.tenureNumber} (${currentTenure.label})` : `Tenure ${currentTenure?.label || "2025-26"}`}
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-xs text-slate-600 font-medium">
                {currentTenure?.theme || currentTenure?.academicYear || "Sahastradeep"}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="ml-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-[#17458F] text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Switch or Advance Council Academic Tenure"
          >
            <Clock className="w-3.5 h-3.5 text-[#E78023]" />
            <span>Change Tenure</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>

        {/* Right: Quick Links */}
        <div className="flex items-center gap-2">
          <Link
            href="/team"
            target="_blank"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>Live /team</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>
          <Link
            href="/archive"
            target="_blank"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>Live /archive</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>
        </div>

      </header>

      <TenureSwitcherModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
