"use client";

import React from "react";
import { MessageCircle, ExternalLink, ShieldCheck, Check } from "lucide-react";
import { formatWhatsAppUrl } from "@/lib/srcFormsHelper";

export interface WhatsAppJoinCardProps {
  whatsappGroupUrl?: string;
  whatsappGroupName?: string;
  title?: string;
  description?: string;
  subtitle?: string;
  compact?: boolean;
  variant?: "card" | "compact";
  className?: string;
}

export function WhatsAppJoinCard({
  whatsappGroupUrl,
  whatsappGroupName,
  title,
  description,
  subtitle,
  compact = false,
  variant,
  className = "",
}: WhatsAppJoinCardProps) {
  const cleanUrl = formatWhatsAppUrl(whatsappGroupUrl);

  if (!cleanUrl) return null;

  const isCompact = compact || variant === "compact";
  const displayTitle = title || (whatsappGroupName ? `Join "${whatsappGroupName}"` : "Join Official WhatsApp Group");
  const displayDescription =
    description ||
    subtitle ||
    "Connect with council leads, organizers, and fellow participants for instant announcements, conclave schedules, and live assistance.";

  if (isCompact) {
    return (
      <div className={`p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between gap-3 text-xs ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
            <MessageCircle className="w-4 h-4 fill-white" />
          </div>
          <div className="min-w-0">
            <p className="font-heading font-bold text-emerald-950 truncate">
              {displayTitle}
            </p>
            <p className="text-[11px] text-emerald-700 truncate">
              Click to join discussion & alerts
            </p>
          </div>
        </div>

        <a
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-xs shrink-0 shadow-xs transition-transform active:scale-95 cursor-pointer"
        >
          <span>Join</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-[#0B3B24] to-[#062416] text-white p-5 sm:p-6 shadow-lg border border-emerald-500/30 ${className}`}
    >
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-[#25D366]/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#25D366]/20 border border-[#25D366]/40 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
            <MessageCircle className="w-3 h-3 fill-emerald-300" />
            <span>Official WhatsApp Community</span>
          </div>

          <h3 className="font-heading font-extrabold text-base sm:text-lg text-white leading-snug">
            {displayTitle}
          </h3>

          <p className="text-xs text-emerald-100/90 leading-relaxed font-sans">
            {displayDescription}
          </p>

          <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-300/80 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-[#25D366]" />
            <span>Encrypted group invite for verified responders</span>
          </div>
        </div>

        <div className="shrink-0 flex sm:flex-col items-center gap-2">
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-md shadow-[#25D366]/25 hover:shadow-lg transition-all active:scale-95 cursor-pointer uppercase"
          >
            <MessageCircle className="w-4 h-4 fill-slate-950" />
            <span>Join WhatsApp Group</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-900" />
          </a>
          <span className="text-[10px] text-emerald-300/70 font-medium hidden sm:block text-center">
            Opens WhatsApp Web / Mobile
          </span>
        </div>
      </div>
    </div>
  );
}
