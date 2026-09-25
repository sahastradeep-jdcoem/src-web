"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  GraduationCap, 
  Building2, 
  Users, 
  RefreshCw, 
  FileSpreadsheet, 
  Layers, 
  School, 
  CheckCircle2, 
  Info, 
  TrendingUp, 
  Sparkles, 
  Filter, 
  ChevronRight,
  ShieldCheck,
  Search,
  X
} from "lucide-react";
import { 
  getStoredUsers, 
  syncUsersFromFirestore, 
  mergeRemoteUsers, 
  reconcileAllUserDesignations, 
  isExternalUser, 
  RegisteredUserRecord 
} from "@/lib/usersStore";
import { subscribeToUsersFromFirestore } from "@/lib/firebase/firestore";
import { 
  getStoredDepartments, 
  syncDepartmentsFromFirestore, 
  getDepartmentShortName, 
  resolveCanonicalDepartmentName,
  DEFAULT_DEPARTMENTS 
} from "@/lib/departmentsStore";

interface SliceItem {
  id: string;
  label: string;
  subLabel?: string;
  count: number;
  percentage: number;
  color: string;
}

// -------------------------------------------------------------
// SVG Donut Slice Helper Math
// -------------------------------------------------------------
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSlice(
  cx: number,
  cy: number,
  radius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const span = endAngle - startAngle;
  // Handle edge case of a full 360-degree circle
  if (span >= 359.99) {
    return [
      `M ${cx} ${cy - radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`,
      `M ${cx} ${cy - innerRadius}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy + innerRadius}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy - innerRadius}`,
      "Z",
    ].join(" ");
  }

  const pOuterStart = polarToCartesian(cx, cy, radius, startAngle);
  const pOuterEnd = polarToCartesian(cx, cy, radius, endAngle);
  const pInnerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const pInnerStart = polarToCartesian(cx, cy, innerRadius, startAngle);

  const largeArcFlag = span > 180 ? 1 : 0;

  return [
    `M ${pOuterStart.x} ${pOuterStart.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${pOuterEnd.x} ${pOuterEnd.y}`,
    `L ${pInnerEnd.x} ${pInnerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${pInnerStart.x} ${pInnerStart.y}`,
    "Z",
  ].join(" ");
}

// -------------------------------------------------------------
// Color Palettes (WCAG AA Compliant, Harmonious & Distinct)
// -------------------------------------------------------------
const YEAR_COLORS: Record<string, string> = {
  "1st Year": "#10B981", // Emerald
  "2nd Year": "#06B6D4", // Cyan
  "3rd Year": "#17458F", // SRC Navy Blue
  "4th Year / Final Year": "#E78023", // SRC Warm Orange
  "Postgraduate / Alumni": "#8B5CF6", // Violet
  "Faculty / Staff": "#F59E0B", // Amber
  "Not Specified": "#94A3B8", // Slate
};

const DEPT_COLOR_PALETTE = [
  "#17458F", // Deep Navy Blue
  "#E78023", // SRC Orange
  "#8B5CF6", // Violet
  "#06B6D4", // Cyan
  "#10B981", // Emerald Green
  "#EF4444", // Crimson Red
  "#F59E0B", // Warm Amber
  "#6366F1", // Indigo
  "#EC4899", // Magenta Pink
  "#14B8A6", // Teal
  "#3B82F6", // Sky Blue
  "#84CC16", // Lime Green
  "#D97706", // Ochre
  "#64748B", // Slate
  "#A855F7", // Purple
];

// Helper to normalize academic year strings
function normalizeAcademicYear(user: RegisteredUserRecord): string {
  if (user.role === "FACULTY" || user.userType === "FACULTY") {
    return "Faculty / Staff";
  }
  const rawYear = (user.year || "").trim();
  if (!rawYear) return "Not Specified";

  const lower = rawYear.toLowerCase();
  if (lower.startsWith("1") || lower.includes("first")) return "1st Year";
  if (lower.startsWith("2") || lower.includes("second")) return "2nd Year";
  if (lower.startsWith("3") || lower.includes("third")) return "3rd Year";
  if (lower.startsWith("4") || lower.includes("fourth") || lower.includes("final")) return "4th Year / Final Year";
  if (lower.includes("postgrad") || lower.includes("mba") || lower.includes("mca") || lower.includes("5th") || lower.includes("alumni")) {
    return "Postgraduate / Alumni";
  }
  return rawYear;
}

export default function AdminUsersSummaryPage() {
  const [users, setUsers] = useState<RegisteredUserRecord[]>([]);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Audience Filter: All active accounts vs JDCOEM students vs External delegates
  const [cohortFilter, setCohortFilter] = useState<"ALL" | "JDCOEM_ONLY" | "EXTERNAL_ONLY" | "FACULTY_ONLY">("ALL");

  // Interactive Slice Drilldown
  const [activeYearSlice, setActiveYearSlice] = useState<string | null>(null);
  const [activeDeptSlice, setActiveDeptSlice] = useState<string | null>(null);

  // Hover states for tooltips
  const [hoveredYear, setHoveredYear] = useState<SliceItem | null>(null);
  const [hoveredDept, setHoveredDept] = useState<SliceItem | null>(null);

  const loadData = async () => {
    setUsers(getStoredUsers());
    setDepartments(getStoredDepartments());

    syncDepartmentsFromFirestore().then((remoteDepts) => {
      if (remoteDepts && remoteDepts.length > 0) {
        setDepartments(remoteDepts);
      }
    }).catch(() => {});

    try {
      const synced = await syncUsersFromFirestore();
      if (synced && synced.length > 0) {
        setUsers(synced);
      }
      const reconciled = await reconcileAllUserDesignations();
      if (reconciled && reconciled.length > 0) {
        setUsers(reconciled);
      }
    } catch {}
  };

  useEffect(() => {
    loadData();

    // Live real-time Firestore subscriber
    const unsubscribeFirestore = subscribeToUsersFromFirestore((remoteUsers) => {
      if (remoteUsers && remoteUsers.length > 0) {
        const merged = mergeRemoteUsers(remoteUsers as RegisteredUserRecord[]);
        setUsers(merged);
      }
    });

    const handleUsersUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setUsers(e.detail);
      } else {
        setUsers(getStoredUsers());
      }
    };

    const handleDeptsUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setDepartments(e.detail);
      } else {
        setDepartments(getStoredDepartments());
      }
    };

    window.addEventListener("src_users_updated", handleUsersUpdate);
    window.addEventListener("src_departments_updated", handleDeptsUpdate);
    window.addEventListener("storage", handleUsersUpdate);

    return () => {
      unsubscribeFirestore();
      window.removeEventListener("src_users_updated", handleUsersUpdate);
      window.removeEventListener("src_departments_updated", handleDeptsUpdate);
      window.removeEventListener("storage", handleUsersUpdate);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const synced = await syncUsersFromFirestore();
      const reconciled = await reconcileAllUserDesignations();
      const finalList = (reconciled && reconciled.length > 0) ? reconciled : synced;
      if (finalList && finalList.length > 0) {
        setUsers(finalList);
        showNotice(`Cloud sync complete. ${finalList.length} user records synchronized.`);
      } else {
        showNotice("Local user directory is up to date with Cloud Firestore.");
      }
    } catch {
      showNotice("Cloud sync encountered a network gap. Local cache active.");
    } finally {
      setIsSyncing(false);
    }
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Filter active (non-deleted) users based on cohort filter
  const activeUsers = useMemo(() => {
    return users.filter((u) => !u.isDeleted && u.status !== "deleted");
  }, [users]);

  const cohortUsers = useMemo(() => {
    return activeUsers.filter((u) => {
      if (cohortFilter === "JDCOEM_ONLY") {
        return !isExternalUser(u) && u.role !== "FACULTY" && u.userType !== "FACULTY";
      }
      if (cohortFilter === "EXTERNAL_ONLY") {
        return isExternalUser(u);
      }
      if (cohortFilter === "FACULTY_ONLY") {
        return u.role === "FACULTY" || u.userType === "FACULTY";
      }
      return true;
    });
  }, [activeUsers, cohortFilter]);

  // -------------------------------------------------------------
  // Chart 1: Year of Study Distribution Slices
  // -------------------------------------------------------------
  const yearDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    cohortUsers.forEach((u) => {
      const yearKey = normalizeAcademicYear(u);
      counts[yearKey] = (counts[yearKey] || 0) + 1;
    });

    const total = cohortUsers.length || 1;
    const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    const slices: SliceItem[] = sortedKeys.map((key, idx) => {
      const count = counts[key];
      const percentage = Math.round((count / total) * 1000) / 10;
      return {
        id: key,
        label: key,
        count,
        percentage,
        color: YEAR_COLORS[key] || DEPT_COLOR_PALETTE[idx % DEPT_COLOR_PALETTE.length],
      };
    });

    return { slices, total: cohortUsers.length };
  }, [cohortUsers]);

  // -------------------------------------------------------------
  // Chart 2: Department & Specialization Distribution Slices
  // -------------------------------------------------------------
  const departmentDistribution = useMemo(() => {
    const counts: Record<string, { count: number; canonical: string; shortCode: string }> = {};

    cohortUsers.forEach((u) => {
      let deptName = "";
      if (u.role === "FACULTY" || u.userType === "FACULTY") {
        deptName = u.facultyDepartment || u.department || "Faculty (General)";
      } else if (isExternalUser(u)) {
        deptName = u.customBranch || u.collegeName || "External Visiting Delegates";
      } else {
        deptName = u.department || "Basic Science & Humanities Dept.";
      }

      // Canonical resolution for standard JDCOEM departments
      const canonical = resolveCanonicalDepartmentName(deptName, departments);
      const shortCode = getDepartmentShortName(canonical) || canonical.slice(0, 4).toUpperCase();

      if (!counts[canonical]) {
        counts[canonical] = { count: 0, canonical, shortCode };
      }
      counts[canonical].count += 1;
    });

    const total = cohortUsers.length || 1;
    const sortedKeys = Object.keys(counts).sort((a, b) => counts[b].count - counts[a].count);

    const slices: SliceItem[] = sortedKeys.map((canonical, idx) => {
      const { count, shortCode } = counts[canonical];
      const percentage = Math.round((count / total) * 1000) / 10;
      return {
        id: canonical,
        label: canonical,
        subLabel: shortCode,
        count,
        percentage,
        color: DEPT_COLOR_PALETTE[idx % DEPT_COLOR_PALETTE.length],
      };
    });

    return { slices, total: cohortUsers.length };
  }, [cohortUsers, departments]);

  // Key stats for the top overview
  const stats = useMemo(() => {
    const total = cohortUsers.length;
    const jdStudents = cohortUsers.filter((u) => !isExternalUser(u) && u.role !== "FACULTY" && u.userType !== "FACULTY").length;
    const external = cohortUsers.filter((u) => isExternalUser(u)).length;
    const faculty = cohortUsers.filter((u) => u.role === "FACULTY" || u.userType === "FACULTY").length;
    const verifiedBt = cohortUsers.filter((u) => Boolean(u.btId && u.btId.trim())).length;
    const topYear = yearDistribution.slices[0];
    const topDept = departmentDistribution.slices[0];

    return {
      total,
      jdStudents,
      external,
      faculty,
      verifiedBt,
      topYear: topYear ? `${topYear.label} (${topYear.percentage}%)` : "N/A",
      topDept: topDept ? `${topDept.subLabel || topDept.label} (${topDept.percentage}%)` : "N/A",
    };
  }, [cohortUsers, yearDistribution, departmentDistribution]);

  // Drilldown list of students matching active slice selection
  const drilldownUsers = useMemo(() => {
    if (!activeYearSlice && !activeDeptSlice) return [];

    return cohortUsers.filter((u) => {
      let matchesYear = true;
      let matchesDept = true;

      if (activeYearSlice) {
        matchesYear = normalizeAcademicYear(u) === activeYearSlice;
      }
      if (activeDeptSlice) {
        const canonical = resolveCanonicalDepartmentName(u.facultyDepartment || u.department || u.customBranch || "", departments);
        matchesDept = canonical === activeDeptSlice || (isExternalUser(u) && (u.customBranch === activeDeptSlice || u.collegeName === activeDeptSlice));
      }

      return matchesYear && matchesDept;
    });
  }, [cohortUsers, activeYearSlice, activeDeptSlice, departments]);

  // Quick Excel export helper
  const handleExportSummaryExcel = async () => {
    if (cohortUsers.length === 0) {
      alert("No user records available to export.");
      return;
    }

    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // 1. Year Summary Sheet
    const yearRows = yearDistribution.slices.map((s) => ({
      "Academic Year": s.label,
      "Student Count": s.count,
      "Share (%)": `${s.percentage}%`,
    }));
    const wsYear = XLSX.utils.json_to_sheet(yearRows);
    XLSX.utils.book_append_sheet(wb, wsYear, "Year Distribution");

    // 2. Department Summary Sheet
    const deptRows = departmentDistribution.slices.map((s) => ({
      "Department Code": s.subLabel || "",
      "Department Name": s.label,
      "Registered Count": s.count,
      "Share (%)": `${s.percentage}%`,
    }));
    const wsDept = XLSX.utils.json_to_sheet(deptRows);
    XLSX.utils.book_append_sheet(wb, wsDept, "Department Distribution");

    // 3. User Roster Data Sheet
    const rosterRows = cohortUsers.map((u) => ({
      "Full Name": u.displayName || "",
      "Email Address": u.email || "",
      "BT ID": u.btId || "N/A",
      "Academic Year": normalizeAcademicYear(u),
      "Department": u.facultyDepartment || u.department || u.customBranch || "",
      "College": u.collegeName || "JDCOEM Nagpur",
      "Account Role": u.role,
    }));
    const wsRoster = XLSX.utils.json_to_sheet(rosterRows);
    XLSX.utils.book_append_sheet(wb, wsRoster, "Analyzed Users");

    XLSX.writeFile(wb, `SRC_Academic_Summary_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A] pb-16">
      
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col gap-4 pb-6 border-b border-slate-200/80">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link 
            href="/admin" 
            className="hover:text-[#17458F] transition-colors"
          >
            Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link 
            href="/admin/users" 
            className="hover:text-[#17458F] transition-colors"
          >
            Active Users
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#17458F] font-bold">Roster Summary</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
                USER ROSTER SUMMARY
              </h1>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-[#17458F] tabular-nums text-xs">{cohortUsers.length}</span>
                <span className="text-slate-500 font-medium text-xs">Analyzed</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Interactive distribution analysis of user academic years of study and enrolled institutional departments.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <Link
              href="/admin/users"
              className="h-9 px-3.5 sm:px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-[#17458F] text-xs font-semibold tracking-normal transition-all duration-200 shadow-2xs active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Users Roster</span>
            </Link>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="h-9 px-3 sm:px-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-[#17458F] text-xs font-medium tracking-normal transition-all duration-200 shadow-2xs active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Synchronize live user roster with Cloud Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#17458F] transition-transform duration-500 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Live Cloud"}</span>
            </button>

            <button
              onClick={handleExportSummaryExcel}
              className="h-9 px-3 sm:px-3.5 rounded-xl border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-800 hover:text-emerald-900 text-xs font-medium tracking-normal transition-all duration-200 shadow-2xs active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2"
              title="Download formatted Excel (.xlsx) summary report"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Summary Excel</span>
            </button>
          </div>
        </div>

        {/* Cohort Selector Pills */}
        <div className="flex items-center gap-2 pt-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0 pr-1">
            <Filter className="w-3.5 h-3.5" /> Filter Cohort:
          </span>
          <button
            onClick={() => { setCohortFilter("ALL"); setActiveYearSlice(null); setActiveDeptSlice(null); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              cohortFilter === "ALL"
                ? "bg-[#17458F] text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200/70 text-slate-600"
            }`}
          >
            All Active Users ({activeUsers.length})
          </button>
          <button
            onClick={() => { setCohortFilter("JDCOEM_ONLY"); setActiveYearSlice(null); setActiveDeptSlice(null); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              cohortFilter === "JDCOEM_ONLY"
                ? "bg-[#17458F] text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200/70 text-slate-600"
            }`}
          >
            JDCOEM Students ({activeUsers.filter((u) => !isExternalUser(u) && u.role !== "FACULTY").length})
          </button>
          <button
            onClick={() => { setCohortFilter("EXTERNAL_ONLY"); setActiveYearSlice(null); setActiveDeptSlice(null); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              cohortFilter === "EXTERNAL_ONLY"
                ? "bg-[#17458F] text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200/70 text-slate-600"
            }`}
          >
            External Delegates ({activeUsers.filter((u) => isExternalUser(u)).length})
          </button>
          <button
            onClick={() => { setCohortFilter("FACULTY_ONLY"); setActiveYearSlice(null); setActiveDeptSlice(null); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              cohortFilter === "FACULTY_ONLY"
                ? "bg-[#17458F] text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200/70 text-slate-600"
            }`}
          >
            Faculty &amp; Staff ({activeUsers.filter((u) => u.role === "FACULTY" || u.userType === "FACULTY").length})
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Sample</span>
          <p className="font-hero font-extrabold text-2xl text-[#0F172A]">{stats.total}</p>
          <span className="text-[10px] text-slate-500 font-medium block">Current Cohort</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">JDCOEM Students</span>
          <p className="font-hero font-extrabold text-2xl text-[#17458F]">{stats.jdStudents}</p>
          <span className="text-[10px] text-slate-500 font-medium block">Internal Enrolled</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Verified BT IDs</span>
          <p className="font-hero font-extrabold text-2xl text-emerald-600">{stats.verifiedBt}</p>
          <span className="text-[10px] text-slate-500 font-medium block">Institutional ID Linked</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top Academic Year</span>
          <p className="font-hero font-bold text-base text-[#E78023] truncate" title={stats.topYear}>
            {stats.topYear}
          </p>
          <span className="text-[10px] text-slate-500 font-medium block">Dominant Student Tier</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top Department</span>
          <p className="font-hero font-bold text-base text-[#17458F] truncate" title={stats.topDept}>
            {stats.topDept}
          </p>
          <span className="text-[10px] text-slate-500 font-medium block">Highest Enrollment</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">External Delegates</span>
          <p className="font-hero font-extrabold text-2xl text-violet-600">{stats.external}</p>
          <span className="text-[10px] text-slate-500 font-medium block">Visiting Colleges</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TWO PIE CHARTS SECTION (SIDE BY SIDE ON DESKTOP)          */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ------------------------------------------------------- */}
        {/* PIE CHART 1: YEAR OF STUDY DISTRIBUTION                */}
        {/* ------------------------------------------------------- */}
        <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-6 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-slate-900 tracking-tight">
                    Year of Study Distribution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Breakdown of user population across academic year progression
                  </p>
                </div>
              </div>

              {activeYearSlice && (
                <button
                  onClick={() => setActiveYearSlice(null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" /> Clear Filter
                </button>
              )}
            </div>
          </div>

          {/* Donut Graphic & Center Metric */}
          {yearDistribution.slices.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs font-medium">
              No academic year data available for selected cohort.
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center relative">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
                <svg
                  viewBox="0 0 320 320"
                  className="w-full h-full transform transition-all duration-300"
                >
                  {(() => {
                    let currentAngle = 0;
                    return yearDistribution.slices.map((slice) => {
                      const angle = (slice.count / yearDistribution.total) * 360;
                      const startAngle = currentAngle;
                      const endAngle = currentAngle + angle;
                      currentAngle = endAngle;

                      const isHovered = hoveredYear?.id === slice.id;
                      const isSelected = activeYearSlice === slice.id;
                      const radius = (isHovered || isSelected) ? 132 : 124;
                      const innerRadius = 78;

                      return (
                        <path
                          key={slice.id}
                          d={describeDonutSlice(160, 160, radius, innerRadius, startAngle, endAngle)}
                          fill={slice.color}
                          className="transition-all duration-200 cursor-pointer"
                          style={{
                            opacity: activeYearSlice && !isSelected ? 0.35 : 1,
                            filter: isHovered || isSelected ? `drop-shadow(0 4px 10px ${slice.color}66)` : "none",
                          }}
                          onMouseEnter={() => setHoveredYear(slice)}
                          onMouseLeave={() => setHoveredYear(null)}
                          onClick={() => {
                            setActiveYearSlice(activeYearSlice === slice.id ? null : slice.id);
                          }}
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                  {hoveredYear ? (
                    <div className="space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                      <span 
                        className="text-[11px] font-bold uppercase tracking-wider block"
                        style={{ color: hoveredYear.color }}
                      >
                        {hoveredYear.label}
                      </span>
                      <p className="font-hero font-extrabold text-2xl text-slate-900 leading-none">
                        {hoveredYear.count}
                      </p>
                      <span className="text-[11px] font-bold text-slate-500 block">
                        {hoveredYear.percentage}% of cohort
                      </span>
                    </div>
                  ) : activeYearSlice ? (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Filtered By
                      </span>
                      <p className="font-hero font-extrabold text-lg text-slate-900 leading-tight">
                        {activeYearSlice}
                      </p>
                      <span className="text-[10px] text-emerald-600 font-bold block">
                        Click slice to clear
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Total Cohort
                      </span>
                      <p className="font-hero font-extrabold text-3xl text-slate-900 leading-none">
                        {yearDistribution.total}
                      </p>
                      <span className="text-[11px] text-slate-500 font-medium block">
                        Enrolled Records
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 text-center">
                Hover or click any segment to filter and inspect student records
              </p>
            </div>
          )}

          {/* Breakdown Legend & Percentage Progress Bars */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Year Tiers &amp; Share
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {yearDistribution.slices.map((slice) => {
                const isSelected = activeYearSlice === slice.id;
                return (
                  <button
                    key={slice.id}
                    onClick={() => setActiveYearSlice(isSelected ? null : slice.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-slate-50 border-[#17458F] shadow-xs"
                        : "bg-white hover:bg-slate-50/80 border-slate-200/80"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: slice.color }}
                      />
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {slice.label}
                        </p>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${slice.percentage}%`,
                              backgroundColor: slice.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-900 block tabular-nums">
                        {slice.count}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 block">
                        {slice.percentage}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------- */}
        {/* PIE CHART 2: DEPARTMENT DISTRIBUTION                   */}
        {/* ------------------------------------------------------- */}
        <div className="rounded-3xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-6 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#17458F]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-slate-900 tracking-tight">
                    Department &amp; Specialization Distribution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Breakdown across accredited college departments and visiting institutions
                  </p>
                </div>
              </div>

              {activeDeptSlice && (
                <button
                  onClick={() => setActiveDeptSlice(null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" /> Clear Filter
                </button>
              )}
            </div>
          </div>

          {/* Donut Graphic & Center Metric */}
          {departmentDistribution.slices.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs font-medium">
              No department data available for selected cohort.
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center relative">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
                <svg
                  viewBox="0 0 320 320"
                  className="w-full h-full transform transition-all duration-300"
                >
                  {(() => {
                    let currentAngle = 0;
                    return departmentDistribution.slices.map((slice) => {
                      const angle = (slice.count / departmentDistribution.total) * 360;
                      const startAngle = currentAngle;
                      const endAngle = currentAngle + angle;
                      currentAngle = endAngle;

                      const isHovered = hoveredDept?.id === slice.id;
                      const isSelected = activeDeptSlice === slice.id;
                      const radius = (isHovered || isSelected) ? 132 : 124;
                      const innerRadius = 78;

                      return (
                        <path
                          key={slice.id}
                          d={describeDonutSlice(160, 160, radius, innerRadius, startAngle, endAngle)}
                          fill={slice.color}
                          className="transition-all duration-200 cursor-pointer"
                          style={{
                            opacity: activeDeptSlice && !isSelected ? 0.35 : 1,
                            filter: isHovered || isSelected ? `drop-shadow(0 4px 10px ${slice.color}66)` : "none",
                          }}
                          onMouseEnter={() => setHoveredDept(slice)}
                          onMouseLeave={() => setHoveredDept(null)}
                          onClick={() => {
                            setActiveDeptSlice(activeDeptSlice === slice.id ? null : slice.id);
                          }}
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                  {hoveredDept ? (
                    <div className="space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                      <span 
                        className="text-[10px] font-bold uppercase tracking-wider block truncate max-w-[120px]"
                        style={{ color: hoveredDept.color }}
                        title={hoveredDept.label}
                      >
                        {hoveredDept.subLabel || hoveredDept.label}
                      </span>
                      <p className="font-hero font-extrabold text-2xl text-slate-900 leading-none">
                        {hoveredDept.count}
                      </p>
                      <span className="text-[11px] font-bold text-slate-500 block">
                        {hoveredDept.percentage}% of cohort
                      </span>
                    </div>
                  ) : activeDeptSlice ? (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Filtered By
                      </span>
                      <p className="font-hero font-extrabold text-sm text-slate-900 leading-tight max-w-[130px] truncate" title={activeDeptSlice}>
                        {activeDeptSlice}
                      </p>
                      <span className="text-[10px] text-blue-600 font-bold block">
                        Click slice to clear
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Departments
                      </span>
                      <p className="font-hero font-extrabold text-3xl text-slate-900 leading-none">
                        {departmentDistribution.slices.length}
                      </p>
                      <span className="text-[11px] text-slate-500 font-medium block">
                        Active Disciplines
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 text-center">
                Hover or click any segment to filter and inspect department students
              </p>
            </div>
          )}

          {/* Breakdown Legend & Percentage Progress Bars */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Enrolled Departments &amp; Share
            </h4>
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {departmentDistribution.slices.map((slice) => {
                const isSelected = activeDeptSlice === slice.id;
                return (
                  <button
                    key={slice.id}
                    onClick={() => setActiveDeptSlice(isSelected ? null : slice.id)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-slate-50 border-[#17458F] shadow-xs"
                        : "bg-white hover:bg-slate-50/80 border-slate-200/80"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: slice.color }}
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          {slice.subLabel && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700">
                              {slice.subLabel}
                            </span>
                          )}
                          <p className="text-xs font-bold text-slate-800 truncate" title={slice.label}>
                            {slice.label}
                          </p>
                        </div>
                        <div className="w-28 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${slice.percentage}%`,
                              backgroundColor: slice.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-900 block tabular-nums">
                        {slice.count}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 block">
                        {slice.percentage}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* DETAILED DRILLDOWN ROSTER (FILTERED BY ACTIVE SLICE)       */}
      {/* ========================================================= */}
      {(activeYearSlice || activeDeptSlice) && (
        <div className="rounded-3xl bg-white border border-[#17458F]/30 shadow-md p-6 sm:p-7 space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#17458F]/10 text-[#17458F] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-base text-slate-900">
                  Detailed Student Drilldown ({drilldownUsers.length} records)
                </h3>
                <p className="text-xs text-slate-500">
                  Showing accounts matching {activeYearSlice && <span className="font-bold text-[#17458F]">Year: {activeYearSlice} </span>}
                  {activeDeptSlice && <span className="font-bold text-[#E78023]">Dept: {activeDeptSlice}</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setActiveYearSlice(null); setActiveDeptSlice(null); }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Clear Slice Filter
              </button>
              <Link
                href="/admin/users"
                className="px-3.5 py-1.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Open Full Roster Table
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Student / User</th>
                  <th className="px-4 py-3">BT ID / College</th>
                  <th className="px-4 py-3">Academic Year</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drilldownUsers.map((u) => {
                  const isExt = isExternalUser(u);
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <div>
                          <p>{u.displayName || "Anonymous"}</p>
                          <p className="text-[11px] font-normal text-slate-500">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.btId ? (
                          <span className="font-mono font-bold text-[#17458F] bg-[#17458F]/5 px-2 py-0.5 rounded border border-[#17458F]/20">
                            {u.btId}
                          </span>
                        ) : isExt ? (
                          <span className="text-slate-600 font-medium">
                            {u.collegeName || "External Delegate"}
                          </span>
                        ) : (
                          <span className="text-slate-400">Not Linked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {normalizeAcademicYear(u)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {u.facultyDepartment || u.department || u.customBranch || "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        {u.role === "COUNCIL_ADMIN" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Admin
                          </span>
                        ) : u.role === "FACULTY" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Faculty
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Student
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Institutional Demographics Note Card */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#17458F] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-800">
            About Live Demographic Aggregations
          </p>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Year of study and department statistics are computed dynamically against authoritative Cloud Firestore user profiles and verified student BT records. When new students authenticate or update academic progression credentials, charts reflect changes instantaneously across all active admin terminals.
          </p>
        </div>
      </div>

    </div>
  );
}
