import React from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Sparkles, 
  Music, 
  Theater, 
  Gamepad2, 
  Code2, 
  Bot, 
  Camera, 
  Palette, 
  Network, 
  Dumbbell, 
  CalendarDays, 
  Megaphone, 
  ArrowRight, 
  Users 
} from "lucide-react";
import { ClubItem } from "@/types";
import { Badge } from "@/components/ui/Badge";

interface ClubCardProps {
  club: ClubItem;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="w-5 h-5 text-[#E78023]" />,
  Music: <Music className="w-5 h-5 text-[#E78023]" />,
  Theater: <Theater className="w-5 h-5 text-[#E78023]" />,
  Gamepad2: <Gamepad2 className="w-5 h-5 text-[#E78023]" />,
  Code2: <Code2 className="w-5 h-5 text-[#E78023]" />,
  Bot: <Bot className="w-5 h-5 text-[#E78023]" />,
  Camera: <Camera className="w-5 h-5 text-[#E78023]" />,
  Palette: <Palette className="w-5 h-5 text-[#E78023]" />,
  Network: <Network className="w-5 h-5 text-[#E78023]" />,
  Dumbbell: <Dumbbell className="w-5 h-5 text-[#E78023]" />,
  CalendarDays: <CalendarDays className="w-5 h-5 text-[#E78023]" />,
  Megaphone: <Megaphone className="w-5 h-5 text-[#E78023]" />,
};

export function ClubCard({ club }: ClubCardProps) {
  return (
    <div className="group rounded-2xl bg-white border border-slate-200 hover:border-[#17458F]/30 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xs font-sans">
      
      {/* Background Image Preview */}
      <div className="relative h-44 w-full overflow-hidden">
        <Image
          src={club.cardImage || club.heroImage}
          alt={club.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="absolute top-3.5 left-3.5 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white/90 backdrop-blur-xs border border-white/40 flex items-center justify-center shadow-xs overflow-hidden">
            {club.logoImage ? (
              <Image src={club.logoImage} alt={club.name} width={36} height={36} className="object-cover w-full h-full" />
            ) : (
              ICON_MAP[club.iconName] || <Sparkles className="w-4 h-4 text-[#E78023]" />
            )}
          </div>
          <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/90 text-slate-800 border border-white/40 shadow-xs">
            {club.category}
          </span>
        </div>

        <div className="absolute top-3.5 right-3.5">
          <span className="text-[10px] font-sans font-semibold text-slate-800 px-2.5 py-0.5 rounded-full bg-white/90 border border-white/40 flex items-center gap-1 shadow-xs">
            <Users className="w-3 h-3 text-[#E78023]" />
            <span>{club.memberCount}</span>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-grow flex flex-col justify-between space-y-4 bg-white">
        <div className="space-y-1.5">
          <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[#E78023] block">
            {club.tagline}
          </span>
          {/* Club Heading — Sora Bold */}
          <h3 className="font-heading font-bold text-xl text-[#0F172A] group-hover:text-[#17458F] transition-colors">
            {club.name}
          </h3>
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-sans font-normal">
            {club.description}
          </p>
        </div>

        {/* Lead snippet */}
        <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between font-sans">
          <div className="flex items-center gap-2.5">
            <div className="relative h-7 w-7 rounded-full overflow-hidden border border-slate-200">
              <Image
                src={club.lead.avatar}
                alt={club.lead.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="text-xs">
              <p className="text-slate-800 font-semibold leading-tight">{club.lead.name}</p>
              <p className="text-slate-500 text-[10px] font-medium">{club.lead.role}</p>
            </div>
          </div>

          <Link
            href={`/clubs/${club.slug}`}
            className="inline-flex items-center gap-1 text-xs font-sans font-semibold uppercase tracking-wider text-[#17458F] group-hover:text-[#E78023] group-hover:translate-x-0.5 transition-all cursor-pointer"
          >
            <span>Explore</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

    </div>
  );
}
