"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Calendar, 
  FileText, 
  Sparkles, 
  Users, 
  TrendingUp, 
  ArrowRight, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Building2,
  Sliders
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { getStoredClubs, getStoredCouncilMembers } from "@/lib/councilStore";
import { getStoredEvents } from "@/lib/eventsStore";
import { getStoredUsers, syncUsersFromFirestore, mergeRemoteUsers } from "@/lib/usersStore";
import { subscribeToUsersFromFirestore } from "@/lib/firebase/firestore";

export default function AdminOverviewPage() {
  const [councilCount, setCouncilCount] = useState(0);
  const [clubsCount, setClubsCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [registrationsCount, setRegistrationsCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);

  const refreshCounts = () => {
    setCouncilCount(getStoredCouncilMembers().length);
    setClubsCount(getStoredClubs().length);
    setEventsCount(getStoredEvents().length);
    setUsersCount(getStoredUsers().length);
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      setRegistrationsCount(Array.isArray(local) ? local.length : 0);
    } catch {
      setRegistrationsCount(0);
    }
  };

  useEffect(() => {
    refreshCounts();
    syncUsersFromFirestore().then((synced) => {
      if (synced) setUsersCount(synced.length);
    });

    const unsubscribeFirestore = subscribeToUsersFromFirestore((remoteUsers) => {
      if (remoteUsers && remoteUsers.length > 0) {
        const merged = mergeRemoteUsers(remoteUsers as any);
        setUsersCount(merged.length);
      }
    });

    window.addEventListener("src_council_team_updated", refreshCounts);
    window.addEventListener("src_clubs_updated", refreshCounts);
    window.addEventListener("src_events_updated", refreshCounts);
    window.addEventListener("src_users_updated", refreshCounts);
    window.addEventListener("storage", refreshCounts);

    return () => {
      unsubscribeFirestore();
      window.removeEventListener("src_council_team_updated", refreshCounts);
      window.removeEventListener("src_clubs_updated", refreshCounts);
      window.removeEventListener("src_events_updated", refreshCounts);
      window.removeEventListener("src_users_updated", refreshCounts);
      window.removeEventListener("storage", refreshCounts);
    };
  }, []);

  const metrics = [
    {
      title: "Active Users",
      value: String(usersCount),
      change: "Google Auth",
      isPositive: true,
      icon: UserCheck,
      sub: "Student Directory",
    },
    {
      title: "Active Events",
      value: String(eventsCount),
      change: "Directory Studio",
      isPositive: true,
      icon: Calendar,
      sub: "Council Flagship",
    },
    {
      title: "Verified Passes",
      value: String(registrationsCount),
      change: "Live Database",
      isPositive: true,
      icon: FileText,
      sub: "Active Roster",
    },
    {
      title: "Active Clubs",
      value: String(clubsCount),
      change: "100% Chartered",
      isPositive: true,
      icon: Sparkles,
      sub: "Official Roster",
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Top Admin Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight font-heading">
              ADMIN DASHBOARD
            </h1>
            <Badge variant="orange" size="sm">
              LIVE CONTROL
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Centralized operations, positions, active users, clubs, hero customization, and registrations console.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/users"
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#17458F]" />
            <span>Active Users</span>
          </Link>
          <Link
            href="/admin/events"
            className="px-4 py-2 rounded-xl bg-[#17458F] hover:bg-[#0E2F66] text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span>Events Manager</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, i) => {
          const Icon = metric.icon;
          return (
            <div
              key={i}
              className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 hover:border-[#17458F]/30 transition-all shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {metric.title}
                </span>
                <div className="h-8 w-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#17458F]">
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-hero font-extrabold text-3xl text-[#0F172A]">
                  {metric.value}
                </h3>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-600">
                    {metric.change}
                  </span>
                  <span className="text-slate-400 font-medium">
                    {metric.sub}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Access Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <Link
          href="/admin/users"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-blue-50 text-[#17458F] flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#17458F] transition-colors">
            Active Users & Student Directory
          </h4>
          <p className="text-xs text-slate-500">
            View all authenticated students, search by BT ID, branch, or email, and manage council admin permissions.
          </p>
        </Link>

        <Link
          href="/admin/hero"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#E78023] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-amber-50 text-[#E78023] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#E78023] transition-colors">
            Hero Studio & Mottos
          </h4>
          <p className="text-xs text-slate-500">
            Change the 100vh background wallpaper, 3 hero motto texts, and live banner ribbons.
          </p>
        </Link>

        <Link
          href="/admin/team"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-[#17458F] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#17458F] transition-colors">
            Council & Positions Roster
          </h4>
          <p className="text-xs text-slate-500">
            Create, edit, or remove executive positions, student officers, departments, and avatars.
          </p>
        </Link>

        <Link
          href="/admin/clubs"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#E78023] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#E78023] transition-colors">
            Clubs Directory Studio
          </h4>
          <p className="text-xs text-slate-500">
            Add new clubs, edit club names, domains, taglines, club heads, and hero banners.
          </p>
        </Link>

        <Link
          href="/admin/departments"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#17458F] transition-colors">
            Academic Departments Roster
          </h4>
          <p className="text-xs text-slate-500">
            Add, rename, or discontinue college branches and degree programs with live sync.
          </p>
        </Link>

        <Link
          href="/admin/registrations"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#17458F] transition-colors">
            Delegate Passes & Check-Ins
          </h4>
          <p className="text-xs text-slate-500">
            Real-time participant accreditation roster with live QR check-ins and CSV export.
          </p>
        </Link>

      </div>

    </div>
  );
}
