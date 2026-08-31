import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Mail, Linkedin, ArrowRight } from "lucide-react";
import { TeamMember } from "@/types";
import { getDepartmentShortName } from "@/lib/departmentsStore";

interface CouncilMemberCardProps {
  member: TeamMember;
  categoryLabel?: string;
}

export function CouncilMemberCard({ member, categoryLabel = "ADMIN" }: CouncilMemberCardProps) {
  return (
    <div className="group rounded-2xl bg-white border border-slate-200 hover:border-[#17458F]/30 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xs font-sans">
      
      {/* Top Banner / Avatar */}
      <div className="relative h-44 sm:h-72 w-full overflow-hidden bg-slate-100">
        <Image
          src={member.avatar}
          alt={member.role}
          fill
          unoptimized={true}
          className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Club Tag (Only for Club Heads) */}
        {member.clubSlug && (
          <div className="absolute top-2 left-2 sm:top-3.5 sm:left-3.5">
            <span className="text-[8px] sm:text-[10px] font-sans font-semibold uppercase tracking-wider px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/95 text-[#E78023] border border-slate-200 shadow-xs">
              {member.level || "Club Society"}
            </span>
          </div>
        )}
      </div>

      {/* Profile Details */}
      <div className="p-3.5 sm:p-6 flex-grow flex flex-col justify-between space-y-3 sm:space-y-4 bg-white">
        <div className="space-y-0.5 sm:space-y-1">
          <span className="text-[9px] sm:text-[11px] font-sans font-semibold uppercase tracking-wider text-[#E78023] block line-clamp-1">
            {member.role}
          </span>
          {/* Member Name — Sora Bold */}
          <h3 className="font-heading font-bold text-sm sm:text-xl text-[#0F172A] line-clamp-1">
            {member.name}
          </h3>
          <p className="text-[10px] sm:text-xs text-slate-500 font-sans font-medium pt-0.5 line-clamp-1">
            <span className="sm:hidden">{getDepartmentShortName(member.department)}</span>
            <span className="hidden sm:inline">{member.department}</span>
            {member.year && ` • ${member.year}`}
          </p>
        </div>

        {member.bio && (
          <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2 sm:pt-3 line-clamp-2 sm:line-clamp-3 font-sans font-normal">
            {member.bio}
          </p>
        )}

        {/* Contact Links & Club Link */}
        <div className="pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between font-sans gap-1">
          {member.clubSlug ? (
            <Link
              href={`/clubs/${member.clubSlug}`}
              className="inline-flex items-center gap-1 text-[9px] sm:text-[11px] text-[#17458F] hover:text-[#E78023] font-bold uppercase tracking-wider transition-colors group/link"
            >
              <span>View Club</span>
              <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 transition-transform group-hover/link:translate-x-0.5" />
            </Link>
          ) : (
            <span className="text-[9px] sm:text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
              {categoryLabel}
            </span>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2">
            {member.email && (
              <a
                href={`mailto:${member.email}`}
                className="p-1.5 sm:p-2 rounded-lg bg-slate-100 hover:bg-[#E78023] text-slate-700 hover:text-white transition-colors"
                aria-label="Email"
              >
                <Mail className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </a>
            )}
            {member.linkedin && (
              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 sm:p-2 rounded-lg bg-slate-100 hover:bg-[#17458F] text-slate-700 hover:text-white transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </a>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
