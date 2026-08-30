import React from "react";
import Image from "next/image";
import { Mail, Linkedin } from "lucide-react";
import { TeamMember } from "@/types";

interface CouncilMemberCardProps {
  member: TeamMember;
}

export function CouncilMemberCard({ member }: CouncilMemberCardProps) {
  return (
    <div className="group rounded-2xl bg-white border border-slate-200 hover:border-[#17458F]/30 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xs font-sans">
      
      {/* Top Banner / Avatar */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-slate-100">
        <Image
          src={member.avatar}
          alt={member.role}
          fill
          className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Position Tag */}
        <div className="absolute top-3.5 left-3.5">
          <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-white/95 text-[#E78023] border border-slate-200 shadow-xs">
            {member.level}
          </span>
        </div>
      </div>

      {/* Profile Details */}
      <div className="p-6 flex-grow flex flex-col justify-between space-y-4 bg-white">
        <div className="space-y-1">
          <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#E78023] block">
            {member.role}
          </span>
          {/* Member Name — Sora Bold */}
          <h3 className="font-heading font-bold text-xl text-[#0F172A]">
            {member.name}
          </h3>
          {member.designation && (
            <p className="text-xs font-sans font-medium text-[#17458F]">
              {member.designation}
            </p>
          )}
          <p className="text-xs text-slate-500 font-sans font-medium pt-0.5">
            {member.department} {member.year && `• ${member.year}`}
          </p>
        </div>

        {member.bio && (
          <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3 line-clamp-3 font-sans font-normal">
            {member.bio}
          </p>
        )}

        {/* Contact Links */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between font-sans">
          <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
            SRC Executive Council
          </span>

          <div className="flex items-center gap-2">
            {member.email && (
              <a
                href={`mailto:${member.email}`}
                className="p-2 rounded-lg bg-slate-100 hover:bg-[#E78023] text-slate-700 hover:text-white transition-colors"
                aria-label="Email"
              >
                <Mail className="w-3.5 h-3.5" />
              </a>
            )}
            {member.linkedin && (
              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-slate-100 hover:bg-[#17458F] text-slate-700 hover:text-white transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
