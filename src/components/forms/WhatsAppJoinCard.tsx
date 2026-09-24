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
    "Connect with coordinators, receive circulars, and collaborate with members.";

  if (isCompact) {
    return (
      <div className={`p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-3 text-xs ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <MessageCircle className="w-4 h-4 fill-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-emerald-950 truncate text-xs">
              {displayTitle}
            </p>
            <p className="text-[11px] text-emerald-700 truncate">
              Click to join discussion & announcements
            </p>
          </div>
        </div>

        <a
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs shrink-0 shadow-2xs transition-all active:scale-95 cursor-pointer"
        >
          <span>Join</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl bg-white border border-emerald-200/90 p-4 sm:p-5 shadow-2xs text-left ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#25D366] border border-emerald-100 flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 fill-[#25D366]" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-heading font-bold text-sm text-slate-900 leading-tight">
                {displayTitle}
              </h4>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100/70 text-emerald-800">
                WhatsApp Group
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {displayDescription}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center">
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>Join Group</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>
      </div>
    </div>
  );
}
