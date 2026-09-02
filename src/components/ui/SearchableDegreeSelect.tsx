"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check, X, GraduationCap, Sparkles } from "lucide-react";
import { INDIAN_DEGREES_BY_CATEGORY, ALL_INDIAN_DEGREES } from "@/data/degrees";
import { cn } from "@/lib/utils";

interface SearchableDegreeSelectProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function SearchableDegreeSelect({
  value,
  onChange,
  placeholder = "Search or select degree (e.g. B.Tech, BCA, MBA, B.Sc...)",
  className = "",
  required = false,
}: SearchableDegreeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter categories and degrees based on search term
  const query = searchTerm.toLowerCase().trim();

  const filteredCategories = INDIAN_DEGREES_BY_CATEGORY.map((cat) => {
    const matchedDegrees = cat.degrees.filter((deg) => {
      if (!query) return true;
      const cleanDeg = deg.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cleanQuery = query.replace(/[^a-z0-9]/g, "");
      return (
        deg.toLowerCase().includes(query) ||
        cleanDeg.includes(cleanQuery) ||
        cat.category.toLowerCase().includes(query)
      );
    });
    return {
      category: cat.category,
      degrees: matchedDegrees,
    };
  }).filter((cat) => cat.degrees.length > 0);

  const totalMatches = filteredCategories.reduce((acc, cat) => acc + cat.degrees.length, 0);

  const handleSelect = (degree: string) => {
    onChange(degree);
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full font-sans", className)}>
      {/* Trigger Box */}
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={cn(
          "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border transition-all flex items-center justify-between gap-2 cursor-pointer",
          isOpen
            ? "border-[#17458F] ring-2 ring-[#17458F]/10 bg-white"
            : "border-slate-200 hover:border-slate-300"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-grow">
          <GraduationCap className="w-4 h-4 text-[#17458F] shrink-0" />
          {value ? (
            <span className="text-xs font-semibold text-slate-900 truncate">
              {value}
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-medium truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
              title="Clear degree"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-slate-400 transition-transform duration-200",
              isOpen && "rotate-180 text-[#17458F]"
            )}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-80">
          
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/70 sticky top-0 z-10">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type to filter degree (e.g. BTech, MBA, BCA, Law...)"
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#17458F]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto flex-grow divide-y divide-slate-100/80 p-1">
            {totalMatches > 0 ? (
              filteredCategories.map((cat, catIdx) => (
                <div key={catIdx} className="py-1.5 px-1 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#E78023]">
                    {cat.category}
                  </div>
                  <div className="space-y-0.5">
                    {cat.degrees.map((deg, degIdx) => {
                      const isSelected = value === deg;
                      return (
                        <button
                          key={degIdx}
                          type="button"
                          onClick={() => handleSelect(deg)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between gap-2",
                            isSelected
                              ? "bg-[#17458F] text-white font-semibold shadow-xs"
                              : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                          )}
                        >
                          <span className="truncate">{deg}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[#E78023]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs text-slate-500 font-medium">
                  No standard degree matched &ldquo;{searchTerm}&rdquo;.
                </p>
                {searchTerm.trim().length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleSelect(searchTerm.trim())}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all border border-emerald-200 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Use &ldquo;{searchTerm.trim()}&rdquo; as Custom Degree</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Custom Degree Fallback Footer */}
          {searchTerm.trim() && totalMatches > 0 && (
            <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-600">
              <span className="truncate">Not in list?</span>
              <button
                type="button"
                onClick={() => handleSelect(searchTerm.trim())}
                className="text-xs font-bold text-[#17458F] hover:underline shrink-0 cursor-pointer"
              >
                Use &ldquo;{searchTerm.trim()}&rdquo;
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
