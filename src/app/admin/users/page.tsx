"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { 
  Search, 
  Download, 
  FileSpreadsheet,
  Eye, 
  ShieldCheck, 
  ShieldAlert, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  UserCheck,
  Building2,
  GraduationCap,
  Sparkles,
  Phone,
  Mail,
  Hash,
  Inbox,
  UserPlus,
  RefreshCw,
  Edit3
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { 
  getStoredUsers, 
  saveRegisteredUser, 
  deleteRegisteredUser, 
  purgeRegisteredUser,
  changeUserRole, 
  approveFacultyUser,
  rejectFacultyUser,
  mergeRemoteUsers,
  syncUsersFromFirestore,
  reconcileAllUserDesignations,
  resolveDesignationByBtId, 
  RegisteredUserRecord 
} from "@/lib/usersStore";
import { subscribeToUsersFromFirestore } from "@/lib/firebase/firestore";
import { getStoredDepartments, getDepartmentShortName } from "@/lib/departmentsStore";
import { 
  School, 
  MapPin, 
  Briefcase, 
  Clock, 
  Check, 
  X, 
  Globe 
} from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<RegisteredUserRecord[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "PENDING_FACULTY" | "VERIFIED_FACULTY" | "JDCOEM_STUDENTS" | "EXTERNAL_STUDENTS" | "COUNCIL_ADMIN" | "DELETED_ACCOUNTS">("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [selectedUser, setSelectedUser] = useState<RegisteredUserRecord | null>(null);
  const [userToEdit, setUserToEdit] = useState<RegisteredUserRecord | null>(null);
  const [userToDelete, setUserToDelete] = useState<RegisteredUserRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadData = async () => {
    setUsers(getStoredUsers());
    setDepartments(getStoredDepartments());
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

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const synced = await syncUsersFromFirestore();
      const reconciled = await reconcileAllUserDesignations();
      const finalList = (reconciled && reconciled.length > 0) ? reconciled : synced;
      if (finalList && finalList.length > 0) {
        setUsers(finalList);
        showNotice(`Cloud sync & roster reconciliation complete. ${finalList.length} user records synchronized.`);
      } else {
        showNotice("Local user directory is up to date with Cloud Firestore.");
      }
    } catch {
      showNotice("Cloud sync encountered a network gap. Local cache active.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApproveFaculty = (u: RegisteredUserRecord) => {
    const updated = approveFacultyUser(u.uid);
    setUsers(updated);
    showNotice(`Approved faculty credentials for ${u.displayName || u.email}.`);
  };

  const handleRejectFaculty = (u: RegisteredUserRecord) => {
    const updated = rejectFacultyUser(u.uid);
    setUsers(updated);
    showNotice(`Revoked faculty approval for ${u.displayName || u.email}.`);
  };

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    displayName: "",
    email: "",
    btId: "",
    department: "Data Science Engineering",
    year: "3rd Year",
    role: "STUDENT" as "STUDENT" | "COUNCIL_ADMIN",
  });

  const [editUserForm, setEditUserForm] = useState({
    displayName: "",
    email: "",
    btId: "",
    department: "Data Science Engineering",
    year: "3rd Year",
    phone: "",
    role: "STUDENT" as "STUDENT" | "COUNCIL_ADMIN",
  });

  const openEditModal = (u: RegisteredUserRecord) => {
    setUserToEdit(u);
    setEditUserForm({
      displayName: u.displayName || "",
      email: u.email || "",
      btId: u.btId || "",
      department: u.department || "Data Science Engineering",
      year: u.year || "3rd Year",
      phone: u.phone || "",
      role: u.role === "COUNCIL_ADMIN" ? "COUNCIL_ADMIN" : "STUDENT",
    });
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;

    const cleanBt = editUserForm.btId.trim().toUpperCase();
    const parts = editUserForm.displayName.trim().split(" ");

    const updatedRecord: RegisteredUserRecord = {
      ...userToEdit,
      displayName: editUserForm.displayName.trim(),
      email: editUserForm.email.trim().toLowerCase(),
      btId: cleanBt,
      department: editUserForm.department,
      year: editUserForm.year,
      phone: editUserForm.phone.trim(),
      role: editUserForm.role,
      firstName: parts[0] || userToEdit.firstName || "",
      lastName: parts.slice(1).join(" ") || userToEdit.lastName || "",
      profileCompleted: Boolean(cleanBt),
      lastActive: new Date().toISOString(),
    };

    saveRegisteredUser(updatedRecord);
    showNotice(`Successfully updated profile for ${updatedRecord.displayName} (${updatedRecord.year}).`);
    setUserToEdit(null);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.email.trim() || !newUserForm.displayName.trim()) {
      alert("Please provide both full name and email.");
      return;
    }

    const email = newUserForm.email.trim().toLowerCase();
    const cleanBt = newUserForm.btId.trim().toUpperCase();
    const parts = newUserForm.displayName.trim().split(" ");

    const record: RegisteredUserRecord = {
      uid: `student-${Date.now()}`,
      email: email,
      displayName: newUserForm.displayName.trim(),
      photoURL: null,
      role: newUserForm.role,
      isCollegeStudent: true,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ") || "",
      btId: cleanBt,
      department: newUserForm.department,
      year: newUserForm.year,
      phone: "",
      profileCompleted: Boolean(cleanBt),
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    saveRegisteredUser(record);
    showNotice(`Successfully added student: ${record.displayName} (${record.email})`);
    setIsAddUserOpen(false);
    setNewUserForm({
      displayName: "",
      email: "",
      btId: "",
      department: "Data Science Engineering",
      year: "3rd Year",
      role: "STUDENT",
    });
  };

  useEffect(() => {
    loadData();

    // 1. Subscribe to Firestore live snapshot for instant cross-device updates
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

    const handleTeamUpdate = () => {
      setUsers(getStoredUsers());
    };

    window.addEventListener("src_users_updated", handleUsersUpdate);
    window.addEventListener("src_departments_updated", handleDeptsUpdate);
    window.addEventListener("src_council_team_updated", handleTeamUpdate);
    window.addEventListener("src_hosting_updated", handleTeamUpdate);
    window.addEventListener("src_clubs_updated", handleTeamUpdate);
    window.addEventListener("storage", handleUsersUpdate);

    return () => {
      unsubscribeFirestore();
      window.removeEventListener("src_users_updated", handleUsersUpdate);
      window.removeEventListener("src_departments_updated", handleDeptsUpdate);
      window.removeEventListener("src_council_team_updated", handleTeamUpdate);
      window.removeEventListener("src_hosting_updated", handleTeamUpdate);
      window.removeEventListener("src_clubs_updated", handleTeamUpdate);
      window.removeEventListener("storage", handleUsersUpdate);
    };
  }, []);

  const handleRoleToggle = (user: RegisteredUserRecord) => {
    const newRole = user.role === "COUNCIL_ADMIN" ? "STUDENT" : "COUNCIL_ADMIN";
    const actionName = newRole === "COUNCIL_ADMIN" ? "Promoted to Admin" : "Demoted to Student";
    changeUserRole(user.uid, newRole);
    showNotice(`${actionName}: ${user.displayName} (${user.email})`);
  };

  const confirmDelete = () => {
    if (!userToDelete) return;
    const name = userToDelete.displayName;
    if (userToDelete.isDeleted || userToDelete.status === "deleted") {
      purgeRegisteredUser(userToDelete.uid);
      showNotice(`Permanently purged record for ${name}.`);
    } else {
      deleteRegisteredUser(userToDelete.uid);
      showNotice(`Marked account as deleted for ${name}.`);
    }
    setUserToDelete(null);
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const pendingFaculty = useMemo(() => {
    return users.filter(
      (u) => !u.isDeleted && u.status !== "deleted" && (u.role === "FACULTY" || u.userType === "FACULTY") && u.facultyApprovalStatus === "pending"
    );
  }, [users]);

  const verifiedFaculty = useMemo(() => {
    return users.filter(
      (u) => !u.isDeleted && u.status !== "deleted" && (u.role === "FACULTY" || u.userType === "FACULTY") && u.facultyApprovalStatus === "approved"
    );
  }, [users]);

  const jdcoemStudents = useMemo(() => {
    return users.filter(
      (u) => !u.isDeleted && u.status !== "deleted" && (u.userType === "JDCOEM_STUDENT" || (u.role === "STUDENT" && !u.collegeName && u.btId)) && u.role !== "FACULTY" && u.role !== "COUNCIL_ADMIN"
    );
  }, [users]);

  const externalStudents = useMemo(() => {
    return users.filter(
      (u) => !u.isDeleted && u.status !== "deleted" && (u.userType === "EXTERNAL_STUDENT" || u.isCollegeStudent === false || Boolean(u.collegeName))
    );
  }, [users]);

  const adminUsers = useMemo(() => {
    return users.filter((u) => !u.isDeleted && u.status !== "deleted" && u.role === "COUNCIL_ADMIN");
  }, [users]);

  const deletedUsers = useMemo(() => {
    return users.filter((u) => u.isDeleted || u.status === "deleted");
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const name = (u.displayName || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const btId = (u.btId || "").toLowerCase();
      const dept = (u.department || u.facultyDepartment || "").toLowerCase();
      const college = (u.collegeName || "").toLowerCase();
      const city = (u.city || "").toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchesSearch =
        name.includes(query) ||
        email.includes(query) ||
        btId.includes(query) ||
        dept.includes(query) ||
        college.includes(query) ||
        city.includes(query);

      let matchesCategory = true;
      if (categoryFilter === "DELETED_ACCOUNTS") {
        matchesCategory = Boolean(u.isDeleted || u.status === "deleted");
      } else if (categoryFilter === "PENDING_FACULTY") {
        matchesCategory = !u.isDeleted && u.status !== "deleted" && (u.role === "FACULTY" || u.userType === "FACULTY") && u.facultyApprovalStatus === "pending";
      } else if (categoryFilter === "VERIFIED_FACULTY") {
        matchesCategory = !u.isDeleted && u.status !== "deleted" && (u.role === "FACULTY" || u.userType === "FACULTY") && u.facultyApprovalStatus === "approved";
      } else if (categoryFilter === "JDCOEM_STUDENTS") {
        matchesCategory = !u.isDeleted && u.status !== "deleted" && (u.userType === "JDCOEM_STUDENT" || (u.role === "STUDENT" && !u.collegeName)) && u.role !== "FACULTY";
      } else if (categoryFilter === "EXTERNAL_STUDENTS") {
        matchesCategory = !u.isDeleted && u.status !== "deleted" && (u.userType === "EXTERNAL_STUDENT" || u.isCollegeStudent === false || Boolean(u.collegeName));
      } else if (categoryFilter === "COUNCIL_ADMIN") {
        matchesCategory = !u.isDeleted && u.status !== "deleted" && u.role === "COUNCIL_ADMIN";
      }

      const matchesDept =
        deptFilter === "All" || u.department === deptFilter || u.facultyDepartment === deptFilter;

      return matchesSearch && matchesCategory && matchesDept;
    });
  }, [users, searchQuery, categoryFilter, deptFilter]);

  const handleExportExcel = async () => {
    if (filteredUsers.length === 0) {
      alert("No user records available to export.");
      return;
    }

    const XLSX = await import("xlsx");

    const rows = filteredUsers.map((u) => ({
      "User Type": u.role === "FACULTY" || u.userType === "FACULTY" ? "FACULTY" : u.userType === "EXTERNAL_STUDENT" ? "EXTERNAL STUDENT" : "JDCOEM STUDENT",
      "Full Name": u.displayName || "",
      "Email Address": u.email || "",
      "College BT ID": u.btId || "N/A",
      "College / University": u.collegeName || "JDCOEM Nagpur",
      "City": u.city || "Nagpur",
      "Department / Branch": u.facultyDepartment || u.department || u.customBranch || "",
      "Academic Year / Role": u.facultyDesignation || u.year || "",
      "Faculty Status": u.facultyApprovalStatus || "N/A",
      "WhatsApp Contact": u.phone || "",
      "Access Role": u.role,
      "Profile Completed": u.profileCompleted ? "YES" : "NO",
      "Registration Date": u.createdAt || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const colKeys = Object.keys(rows[0] || {});
    ws["!cols"] = colKeys.map((k) => {
      const maxLen = Math.max(
        k.length,
        ...rows.map((r: any) => String(r[k] || "").length)
      );
      return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Active Users");
    XLSX.writeFile(wb, `SRC_Active_Users_Roster_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
              USER ROSTER &amp; ACADEMIC DIRECTORY
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-[#17458F] tabular-nums text-xs">{users.length}</span>
              <span className="text-slate-500 font-medium text-xs">Registered</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Real-time roster of authenticated students, faculty credentials, external college delegates, and council access.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="h-9 px-3.5 sm:px-4 rounded-xl bg-gradient-to-r from-[#E78023] to-[#D26E17] hover:from-[#d26e17] hover:to-[#be6113] text-white text-xs font-semibold tracking-normal transition-all duration-200 shadow-xs hover:shadow-md hover:shadow-[#E78023]/25 active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/95" />
            <span>Add Student</span>
          </button>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="h-9 px-3 sm:px-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-[#17458F] text-xs font-medium tracking-normal transition-all duration-200 shadow-2xs active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#17458F] transition-transform duration-500 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Live Cloud"}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="h-9 px-3 sm:px-3.5 rounded-xl border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-800 hover:text-emerald-900 text-xs font-medium tracking-normal transition-all duration-200 shadow-2xs active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2"
            title="Download formatted Excel (.xlsx) spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Export Users Excel</span>
            <span className="sm:hidden">Export Excel</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* PENDING FACULTY APPROVAL ALERT BANNER */}
      {pendingFaculty.length > 0 && (
        <div className="p-4 rounded-3xl bg-amber-500/10 border-2 border-amber-400/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-heading font-extrabold text-sm text-slate-900">
                {pendingFaculty.length} Faculty Verification Request{pendingFaculty.length > 1 ? "s" : ""} Pending Review
              </h4>
              <p className="text-[11px] text-slate-600 font-medium">
                Academic staff members have signed in and are awaiting council accreditation approval.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCategoryFilter("PENDING_FACULTY")}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer text-center"
          >
            View Pending Requests ({pendingFaculty.length})
          </button>
        </div>
      )}

      {/* Summary KPI Badges (6 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Users</span>
          <p className="font-hero font-extrabold text-2xl text-[#0F172A]">{users.length}</p>
          <span className="text-[10px] text-slate-500 font-medium">All Accounts</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">JDCOEM Students</span>
          <p className="font-hero font-extrabold text-2xl text-[#17458F]">{jdcoemStudents.length}</p>
          <span className="text-[10px] text-slate-500 font-medium">Verified BT IDs</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faculty &amp; Staff</span>
            {pendingFaculty.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[9px]">
                {pendingFaculty.length} Pending
              </span>
            )}
          </div>
          <p className="font-hero font-extrabold text-2xl text-[#E78023]">{verifiedFaculty.length + pendingFaculty.length}</p>
          <span className="text-[10px] text-slate-500 font-medium">{verifiedFaculty.length} Approved</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Other Colleges</span>
          <p className="font-hero font-extrabold text-2xl text-emerald-600">{externalStudents.length}</p>
          <span className="text-[10px] text-slate-500 font-medium">Visiting Delegates</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Council Admins</span>
          <p className="font-hero font-extrabold text-2xl text-slate-900">{adminUsers.length}</p>
          <span className="text-[10px] text-slate-500 font-medium">Full Studio Access</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deleted Accounts</span>
          <p className="font-hero font-extrabold text-2xl text-rose-600">{deletedUsers.length}</p>
          <span className="text-[10px] text-slate-500 font-medium">Deactivated</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full lg:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, BT ID, email, college, or branch..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#17458F]"
          />
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
          {/* Category Filter Pills */}
          <button
            onClick={() => setCategoryFilter("All")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              categoryFilter === "All"
                ? "bg-[#17458F] text-white shadow-xs"
                : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            All ({users.length})
          </button>

          <button
            onClick={() => setCategoryFilter("PENDING_FACULTY")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === "PENDING_FACULTY"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Approvals ({pendingFaculty.length})</span>
          </button>

          <button
            onClick={() => setCategoryFilter("VERIFIED_FACULTY")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === "VERIFIED_FACULTY"
                ? "bg-[#E78023] text-white shadow-xs"
                : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <School className="w-3.5 h-3.5" />
            <span>Faculty ({verifiedFaculty.length})</span>
          </button>

          <button
            onClick={() => setCategoryFilter("JDCOEM_STUDENTS")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === "JDCOEM_STUDENTS"
                ? "bg-[#17458F] text-white shadow-xs"
                : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>JDCOEM ({jdcoemStudents.length})</span>
          </button>

          <button
            onClick={() => setCategoryFilter("EXTERNAL_STUDENTS")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === "EXTERNAL_STUDENTS"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Other Colleges ({externalStudents.length})</span>
          </button>

          <button
            onClick={() => setCategoryFilter("DELETED_ACCOUNTS")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              categoryFilter === "DELETED_ACCOUNTS"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Deleted Accounts ({deletedUsers.length})</span>
          </button>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#17458F] cursor-pointer"
          >
            <option value="All">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
              <Inbox className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-base text-slate-800">
                No User Records Found in Selected Filter
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {users.length === 0
                  ? "As students, faculty, and visiting delegates sign in via Google OAuth, their records will appear here."
                  : "No registered users match your search query or selected category filter."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-4 px-6">User / Delegate</th>
                  <th className="py-4 px-6">Affiliation / BT ID</th>
                  <th className="py-4 px-6">Department &amp; Specialization</th>
                  <th className="py-4 px-6">Account Category</th>
                  <th className="py-4 px-6">Verification Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredUsers.map((u) => {
                  const isDeleted = Boolean(u.isDeleted || u.status === "deleted");
                  const isFaculty = u.role === "FACULTY" || u.userType === "FACULTY";
                  const isExternal = u.userType === "EXTERNAL_STUDENT" || u.isCollegeStudent === false || Boolean(u.collegeName);
                  const isPendingFaculty = !isDeleted && isFaculty && u.facultyApprovalStatus === "pending";

                  return (
                    <tr 
                      key={u.uid} 
                      className={`hover:bg-slate-50 transition-colors ${
                        isDeleted ? "bg-rose-50/30" : isPendingFaculty ? "bg-amber-50/40" : ""
                      }`}
                    >
                      
                      {/* User Column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                            {u.photoURL ? (
                              <Image
                                src={u.photoURL}
                                alt={u.displayName || "User"}
                                fill
                                unoptimized={true}
                                className="object-cover"
                              />
                            ) : (
                              <span>{(u.displayName || "U").charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-sm">
                              {u.displayName || (isFaculty ? "Faculty Member" : isExternal ? "External Delegate" : "JDCOEM Student")}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Affiliation / BT ID */}
                      <td className="py-4 px-6">
                        {isDeleted ? (
                          <span className="text-rose-600 text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200">
                            DELETED
                          </span>
                        ) : isFaculty ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs">
                              <School className="w-3.5 h-3.5 text-[#E78023]" />
                              <span>Faculty / Staff</span>
                            </span>
                            {u.employeeId && (
                              <span className="block text-[10px] font-mono text-slate-400">ID: {u.employeeId}</span>
                            )}
                          </div>
                        ) : isExternal ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-xs">
                              <Globe className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="max-w-[140px] truncate">{u.collegeName || "Other College"}</span>
                            </span>
                            {u.city && (
                              <span className="block text-[10px] text-slate-400 font-medium">📍 {u.city}</span>
                            )}
                          </div>
                        ) : u.btId ? (
                          <span className="font-mono font-bold text-[#17458F] px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200">
                            {u.btId}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic font-sans">
                            Pending BT ID
                          </span>
                        )}
                      </td>

                      {/* Department & Specialization */}
                      <td className="py-4 px-6">
                        <div className="text-slate-900 font-bold max-w-xs truncate" title={u.facultyDepartment || u.department || u.customBranch}>
                          {isFaculty ? (
                            <span>{u.facultyDepartment || u.department || "Academic Department"}</span>
                          ) : isExternal ? (
                            <span>{u.degree || u.customBranch || u.department || "Academic Degree"}</span>
                          ) : (
                            <>
                              <span className="lg:hidden inline-block px-2 py-0.5 rounded-md bg-slate-100 text-[#17458F] font-mono text-[11px] font-bold">
                                {getDepartmentShortName(u.department || "Basic Science & Humanities Dept.")}
                              </span>
                              <span className="hidden lg:inline">
                                {u.department || "Basic Science & Humanities"}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-sans">
                          {isFaculty ? (u.facultyDesignation || "Professor / Staff") : (u.year || "—")}
                        </div>
                      </td>

                      {/* Account Category */}
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          {isDeleted ? (
                            <Badge variant="rose" size="sm">
                              DELETED ACCOUNT
                            </Badge>
                          ) : (
                            <Badge
                              variant={
                                u.role === "COUNCIL_ADMIN"
                                  ? "orange"
                                  : isFaculty
                                  ? "navy"
                                  : isExternal
                                  ? "success"
                                  : "slate"
                              }
                              size="sm"
                            >
                              {u.role === "COUNCIL_ADMIN"
                                ? "Admin"
                                : isFaculty
                                ? "Faculty"
                                : isExternal
                                ? "Other College"
                                : "JDCOEM Student"}
                            </Badge>
                          )}
                          {!isDeleted && (() => {
                            const effectiveBadge = (u.btId ? resolveDesignationByBtId(u.btId)?.designationBadge : null) || u.designationBadge;
                            if (!effectiveBadge) return null;
                            return (
                              <div className="pt-0.5">
                                <span className="inline-block text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md max-w-xs truncate">
                                  🏅 {effectiveBadge}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Verification Status */}
                      <td className="py-4 px-6">
                        {isDeleted ? (
                          <div className="flex items-center gap-1.5 text-rose-700 text-xs font-semibold">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>Deactivated {u.deletedAt ? new Date(u.deletedAt).toLocaleDateString() : ""}</span>
                          </div>
                        ) : isFaculty ? (
                          u.facultyApprovalStatus === "pending" ? (
                            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold bg-amber-100/80 px-2.5 py-1 rounded-xl border border-amber-300 w-fit animate-pulse">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Pending Approval</span>
                            </div>
                          ) : u.facultyApprovalStatus === "rejected" ? (
                            <div className="flex items-center gap-1.5 text-rose-700 text-xs font-semibold">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Revoked</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Verified Faculty</span>
                            </div>
                          )
                        ) : isExternal ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Verified Delegate</span>
                          </div>
                        ) : u.profileCompleted ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Verified BT ID</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending Profile</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isDeleted ? (
                            <>
                              <button
                                onClick={() => setSelectedUser(u)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-[#17458F] transition-colors cursor-pointer"
                                title="Inspect Deleted User Record"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setUserToDelete(u)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                title="Permanently Purge Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* 1-Click Approve / Reject for Faculty */}
                              {isFaculty && (
                                <>
                                  {u.facultyApprovalStatus !== "approved" ? (
                                    <button
                                      onClick={() => handleApproveFaculty(u)}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                      title="Approve Faculty Verification"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Approve</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleRejectFaculty(u)}
                                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                      title="Revoke Faculty Verification"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>Revoke</span>
                                    </button>
                                  )}
                                </>
                              )}

                              <button
                                onClick={() => setSelectedUser(u)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-[#17458F] transition-colors cursor-pointer"
                                title="Inspect User Profile"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => openEditModal(u)}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#17458F] transition-colors cursor-pointer"
                                title="Edit User Profile"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleRoleToggle(u)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  u.role === "COUNCIL_ADMIN"
                                    ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                }`}
                                title={u.role === "COUNCIL_ADMIN" ? "Demote to Student" : "Promote to Admin"}
                              >
                                {u.role === "COUNCIL_ADMIN" ? (
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#E78023]" />
                                ) : (
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => setUserToDelete(u)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                title="Delete User Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: View Full User Details */}
      {selectedUser && (
        <Modal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title="User Profile & Accreditation Inspection"
          subtitle={`UID: ${selectedUser.uid}`}
          maxWidth="lg"
        >
          <div className="space-y-5 pt-2 text-[#0F172A]">
            {(selectedUser.isDeleted || selectedUser.status === "deleted") && (
              <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-heading font-extrabold text-sm text-rose-950">
                    Account Permanently Deactivated
                  </h4>
                  <p className="text-xs text-rose-700 font-medium">
                    This account was permanently deleted by the user on {selectedUser.deletedAt ? new Date(selectedUser.deletedAt).toLocaleString() : "record"}. Verified passes and portal rights have been revoked.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="relative h-16 w-16 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-xl text-[#17458F] shrink-0">
                {selectedUser.photoURL ? (
                  <Image
                    src={selectedUser.photoURL}
                    alt={selectedUser.displayName || "User"}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span>{(selectedUser.displayName || "U").charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-extrabold text-lg text-slate-900">
                    {selectedUser.displayName}
                  </h3>
                  {selectedUser.isDeleted || selectedUser.status === "deleted" ? (
                    <Badge variant="rose" size="sm">
                      DELETED ACCOUNT
                    </Badge>
                  ) : (
                    <Badge 
                      variant={
                        selectedUser.role === "COUNCIL_ADMIN" 
                          ? "orange" 
                          : selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY" 
                          ? "navy" 
                          : selectedUser.userType === "EXTERNAL_STUDENT" 
                          ? "success" 
                          : "slate"
                      } 
                      size="sm"
                    >
                      {selectedUser.role === "COUNCIL_ADMIN" 
                        ? "Council Admin" 
                        : selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY" 
                        ? "Faculty Member" 
                        : selectedUser.userType === "EXTERNAL_STUDENT" 
                        ? "Visiting Delegate" 
                        : "JDCOEM Student"}
                    </Badge>
                  )}
                  {!selectedUser.isDeleted && (() => {
                    const effectiveBadge = (selectedUser.btId ? resolveDesignationByBtId(selectedUser.btId)?.designationBadge : null) || selectedUser.designationBadge;
                    if (!effectiveBadge) return null;
                    return (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
                        🏅 {effectiveBadge}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-slate-500 font-mono">{selectedUser.email}</p>
              </div>
            </div>

            {/* FACULTY APPROVAL ACTION CARD IF PENDING */}
            {!selectedUser.isDeleted && (selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY") && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <School className="w-4 h-4 text-[#E78023]" />
                    <span className="text-xs font-bold text-amber-950">Faculty Verification Status:</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    selectedUser.facultyApprovalStatus === "approved" 
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : selectedUser.facultyApprovalStatus === "rejected"
                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                      : "bg-amber-200 text-amber-900 border border-amber-300 animate-pulse"
                  }`}>
                    {selectedUser.facultyApprovalStatus || "pending"}
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  {selectedUser.facultyApprovalStatus !== "approved" ? (
                    <button
                      onClick={() => {
                        handleApproveFaculty(selectedUser);
                        setSelectedUser({ ...selectedUser, facultyApprovalStatus: "approved" });
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve Faculty Credentials</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleRejectFaculty(selectedUser);
                        setSelectedUser({ ...selectedUser, facultyApprovalStatus: "rejected" });
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Revoke Faculty Approval</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Box 1: Affiliation / College */}
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Institution / College</span>
                <p className="font-bold text-slate-900">
                  {selectedUser.collegeName || "JDCOEM Nagpur"}
                </p>
                {selectedUser.city && (
                  <p className="text-[11px] text-slate-500 font-medium">📍 {selectedUser.city}</p>
                )}
              </div>

              {/* Box 2: BT ID or Staff ID */}
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">
                  {selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY" ? "Staff / Employee ID" : "College BT ID"}
                </span>
                <p className="font-mono font-bold text-[#E78023] text-sm">
                  {selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY"
                    ? (selectedUser.employeeId || "No ID Required")
                    : (selectedUser.btId || (selectedUser.userType === "EXTERNAL_STUDENT" ? "External Delegate" : "Not registered"))}
                </p>
              </div>

              {/* Box 3: Department / Branch */}
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Department / Stream</span>
                <p className="font-bold text-slate-900">
                  {selectedUser.facultyDepartment || selectedUser.customBranch || selectedUser.department || "General Stream"}
                </p>
              </div>

              {/* Box 4: Academic Year / Designation */}
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">
                  {selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY" ? "Academic Title & Role" : "Year of Study"}
                </span>
                <p className="font-bold text-slate-900">
                  {selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY"
                    ? (selectedUser.facultyDesignation || "Faculty Member")
                    : (selectedUser.year || "—")}
                </p>
              </div>

              {/* Box 5: Contact */}
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100 sm:col-span-2">
                <span className="text-slate-400 uppercase text-[10px] font-bold">WhatsApp Contact Phone</span>
                <p className="font-mono text-slate-800 font-semibold">{selectedUser.phone || "Not provided"}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setSelectedUser(null)}
                variant="outline"
                size="sm"
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  handleRoleToggle(selectedUser);
                  setSelectedUser(null);
                }}
                variant="primary"
                size="sm"
              >
                {selectedUser.role === "COUNCIL_ADMIN" ? "Demote to Student" : "Promote to Admin"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Delete User Confirmation */}
      {userToDelete && (
        <Modal
          isOpen={!!userToDelete}
          onClose={() => setUserToDelete(null)}
          title="Delete User Record"
          subtitle={`Are you sure you want to remove this user from the roster?`}
          maxWidth="md"
        >
          <div className="space-y-6 pt-2">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">This action will delete user access for:</p>
                <p className="font-semibold text-rose-800 text-sm">{userToDelete.displayName} ({userToDelete.email})</p>
                <p className="text-slate-600 text-[11px]">
                  Their student profile and session cache will be removed. They can log in again with Google anytime to re-onboard.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setUserToDelete(null)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Yes, Delete User
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Add Registered User */}
      {isAddUserOpen && (
        <Modal
          isOpen={isAddUserOpen}
          onClose={() => setIsAddUserOpen(false)}
          title="Add User to Directory"
          subtitle="Manually register or sync an authenticated student or faculty member account."
          maxWidth="lg"
        >
          <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newUserForm.displayName}
                onChange={(e) => setNewUserForm({ ...newUserForm, displayName: e.target.value })}
                placeholder="e.g. Sanskruti Tidke"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="e.g. sanskrutitidke@jdcoem.ac.in"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  College BT ID (Leave empty for Faculty)
                </label>
                <input
                  type="text"
                  value={newUserForm.btId}
                  onChange={(e) => setNewUserForm({ ...newUserForm, btId: e.target.value.toUpperCase() })}
                  placeholder="e.g. BT240115DS"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-[#E78023] focus:outline-none focus:border-[#17458F]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Role
                </label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer"
                >
                  <option value="STUDENT">Student (Delegate)</option>
                  <option value="COUNCIL_ADMIN">Council Admin</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Department / Branch
                </label>
                <select
                  value={newUserForm.department}
                  onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer"
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Year of Study
                </label>
                <select
                  value={newUserForm.year}
                  onChange={(e) => setNewUserForm({ ...newUserForm, year: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year / Final Year">4th Year / Final Year</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
              >
                Save & Link Account
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Edit User Record */}
      {userToEdit && (
        <Modal
          isOpen={!!userToEdit}
          onClose={() => setUserToEdit(null)}
          title="Edit User Record"
          subtitle={`Update profile details for ${userToEdit.displayName}`}
          maxWidth="lg"
        >
          <form onSubmit={handleUpdateUser} className="space-y-4 pt-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editUserForm.displayName}
                onChange={(e) => setEditUserForm({ ...editUserForm, displayName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={editUserForm.email}
                onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  College BT ID (Optional for Faculty)
                </label>
                <input
                  type="text"
                  value={editUserForm.btId}
                  onChange={(e) => setEditUserForm({ ...editUserForm, btId: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-[#E78023] focus:outline-none focus:border-[#17458F]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={editUserForm.phone}
                  onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                  placeholder="e.g. 9075828232"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Department / Branch
                </label>
                <select
                  value={editUserForm.department}
                  onChange={(e) => setEditUserForm({ ...editUserForm, department: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer"
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Year of Study <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editUserForm.year}
                  onChange={(e) => setEditUserForm({ ...editUserForm, year: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-[#17458F] focus:outline-none focus:border-[#17458F] cursor-pointer"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year / Final Year">4th Year / Final Year</option>
                  <option value="Postgraduate (MBA/MCA)">Postgraduate (MBA/MCA)</option>
                  <option value="Faculty / Alumni">Faculty / Alumni</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Access Role
              </label>
              <select
                value={editUserForm.role}
                onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer"
              >
                <option value="STUDENT">Student (Delegate)</option>
                <option value="COUNCIL_ADMIN">Council Admin</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setUserToEdit(null)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
