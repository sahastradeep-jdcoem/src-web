"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  FileText, 
  Sparkles, 
  Image as ImageIcon, 
  Trophy, 
  Settings, 
  ArrowLeft, 
  ShieldCheck, 
  ChevronRight,
  Sliders,
  Building2,
  UserCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Active Users", href: "/admin/users", icon: UserCheck },
  { name: "Hero Settings", href: "/admin/hero", icon: Sliders },
  { name: "Events", href: "/admin/events", icon: Calendar },
  { name: "Registrations", href: "/admin/registrations", icon: FileText },
  { name: "Departments", href: "/admin/departments", icon: Building2 },
  { name: "Clubs", href: "/admin/clubs", icon: Sparkles },
  { name: "Team Members", href: "/admin/team", icon: Users },
  { name: "Gallery", href: "/admin/gallery", icon: ImageIcon },
  { name: "Tenures & Archive", href: "/admin/tenures", icon: Trophy },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-4 shrink-0 shadow-xs z-30 overflow-y-auto">
      <div className="space-y-6">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-3 border-b border-slate-100">
          <div className="relative h-9 w-9 shrink-0">
            <Image
              src="/assets/SRC Logo.png"
              alt="SRC Logo"
              fill
              className="object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-[#17458F]">
                SRC ADMIN
              </span>
              <span className="text-[9px] font-bold text-emerald-700 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">JDCOEM Central Council</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                  isActive
                    ? "bg-[#E78023] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-50 hover:text-[#17458F]"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5" />}
              </Link>
            );
          })}
        </nav>

      </div>

      {/* Footer Back to Public Site */}
      <div className="pt-4 border-t border-slate-100 space-y-2">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-600 hover:text-[#17458F] hover:bg-slate-50 transition-colors font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit to Public Site</span>
        </Link>
      </div>
    </aside>
  );
}
