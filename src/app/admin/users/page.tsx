"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { 
  Search, 
  Download, 
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
  changeUserRole, 
  mergeRemoteUsers,
  syncUsersFromFirestore,
  RegisteredUserRecord 
} from "@/lib/usersStore";
import { subscribeToUsersFromFirestore } from "@/lib/firebase/firestore";
import { getStoredDepartments, getDepartmentShortName } from "@/lib/departmentsStore";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<RegisteredUserRecord[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
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
    } catch {}
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

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const synced = await syncUsersFromFirestore();
      setUsers(synced);
      showNotice(`Successfully synced ${synced.length} active registered users from cloud database.`);
    } catch (e) {
      showNotice("Could not reach cloud database, displaying cached roster.");
    } finally {
      setIsSyncing(false);
    }
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
    deleteRegisteredUser(userToDelete.uid);
    setUserToDelete(null);
    showNotice(`Removed user record for ${name}.`);
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const name = (u.displayName || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const btId = (u.btId || "").toLowerCase();
      const dept = (u.department || "").toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchesSearch =
        name.includes(query) ||
        email.includes(query) ||
        btId.includes(query) ||
        dept.includes(query);

      const matchesRole =
        roleFilter === "All" || u.role === roleFilter;

      const matchesDept =
        deptFilter === "All" || u.department === deptFilter;

      return matchesSearch && matchesRole && matchesDept;
    });
  }, [users, searchQuery, roleFilter, deptFilter]);

  const handleExportCSV = () => {
    if (filteredUsers.length === 0) {
      alert("No user records available to export.");
      return;
    }

    const headers = "Full Name,Email,BT ID,Department,Year of Study,Phone,Role,Profile Completed,Registered Date\n";
    const rows = filteredUsers
      .map(
        (u) =>
          `"${u.displayName || ""}","${u.email || ""}","${u.btId || ""}","${u.department || ""}","${u.year || ""}","${u.phone || ""}","${u.role}","${u.profileCompleted ? "YES" : "NO"}","${u.createdAt || ""}"`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SRC_Active_Users_Roster_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const studentCount = users.filter((u) => u.role === "STUDENT").length;
  const adminCount = users.filter((u) => u.role === "COUNCIL_ADMIN").length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
              ACTIVE USERS & STUDENT DIRECTORY
            </h1>
            <Badge variant="orange" size="sm">
              {users.length} REGISTERED
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time roster of authenticated students, college BT IDs, academic branches, and council access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsAddUserOpen(true)}
            variant="primary"
            size="md"
            className="gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </Button>

          <Button
            onClick={handleManualSync}
            variant="outline"
            size="md"
            className="gap-2 cursor-pointer bg-white"
            disabled={isSyncing}
          >
            <RefreshCw className={`w-4 h-4 text-[#17458F] ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Live Cloud"}</span>
          </Button>

          <Button
            onClick={handleExportCSV}
            variant="secondary"
            size="md"
            className="gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Users CSV</span>
          </Button>
        </div>
      </div>

      {notice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Active Users</span>
          <p className="font-hero font-extrabold text-2xl text-[#0F172A]">{users.length}</p>
          <span className="text-[10px] text-slate-500 font-medium">Google Authenticated</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enrolled Students</span>
          <p className="font-hero font-extrabold text-2xl text-[#17458F]">{studentCount}</p>
          <span className="text-[10px] text-slate-500 font-medium">General Delegates</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admins</span>
          <p className="font-hero font-extrabold text-2xl text-[#E78023]">{adminCount}</p>
          <span className="text-[10px] text-slate-500 font-medium">Admin Studio Privileges</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Academic Branches</span>
          <p className="font-hero font-extrabold text-2xl text-emerald-600">{departments.length}</p>
          <span className="text-[10px] text-slate-500 font-medium">Official Departments</span>
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
            placeholder="Search by student name, BT ID, email, or branch..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#17458F]"
          />
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500">Role:</span>
            {["All", "STUDENT", "COUNCIL_ADMIN"].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  roleFilter === r
                    ? "bg-[#E78023] text-white shadow-xs"
                    : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {r === "COUNCIL_ADMIN" ? "Admins" : r === "STUDENT" ? "Students" : "All"}
              </button>
            ))}
          </div>

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
                No Active User Records Found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {users.length === 0
                  ? "As students and council members log in via Google OAuth and complete their profiles, their verified student accounts will appear here."
                  : "No registered users match your search query."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-4 px-6">Student / Officer</th>
                  <th className="py-4 px-6">College BT ID</th>
                  <th className="py-4 px-6">Department & Year</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Profile Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                    
                    {/* User Column */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="relative h-9 w-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                          {u.photoURL ? (
                            <Image
                              src={u.photoURL}
                              alt={u.displayName || "User"}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <span>{(u.displayName || "S").charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block text-sm">
                            {u.displayName || "JDCOEM Student"}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* BT ID */}
                    <td className="py-4 px-6">
                      {u.btId ? (
                        <span className="font-mono font-bold text-[#E78023] px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200">
                          {u.btId}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic font-sans">
                          Not set
                        </span>
                      )}
                    </td>

                    {/* Department & Year */}
                    <td className="py-4 px-6">
                      <div className="text-slate-900 font-bold max-w-xs truncate" title={u.department}>
                        <span className="lg:hidden inline-block px-2 py-0.5 rounded-md bg-slate-100 text-[#17458F] font-mono text-[11px] font-bold">
                          {getDepartmentShortName(u.department || "Basic Science & Humanities Dept.")}
                        </span>
                        <span className="hidden lg:inline">
                          {u.department || "Basic Science & Humanities"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans">
                        {u.year || "—"}
                      </div>
                    </td>

                    {/* Role & Designation */}
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <Badge
                          variant={u.role === "COUNCIL_ADMIN" ? "orange" : "slate"}
                          size="sm"
                        >
                          {u.role === "COUNCIL_ADMIN" ? "Admin" : "Student"}
                        </Badge>
                        {u.designationBadge && (
                          <div className="pt-0.5">
                            <span className="inline-block text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md max-w-xs truncate">
                              🏅 {u.designationBadge}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Profile Status */}
                    <td className="py-4 px-6">
                      {u.profileCompleted ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Verified</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Pending BT ID</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-[#17458F] transition-colors cursor-pointer"
                          title="Inspect Student Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#17458F] transition-colors cursor-pointer"
                          title="Edit Student Profile & Year"
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
                      </div>
                    </td>

                  </tr>
                ))}
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
          title="Student Profile Inspection"
          subtitle={`UID: ${selectedUser.uid}`}
          maxWidth="lg"
        >
          <div className="space-y-6 pt-2 text-[#0F172A]">
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
                  <span>{(selectedUser.displayName || "S").charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-extrabold text-lg text-slate-900">
                    {selectedUser.displayName}
                  </h3>
                  <Badge variant={selectedUser.role === "COUNCIL_ADMIN" ? "orange" : "slate"} size="sm">
                    {selectedUser.role}
                  </Badge>
                  {selectedUser.designationBadge && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
                      🏅 {selectedUser.designationBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-mono">{selectedUser.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">College BT ID</span>
                <p className="font-mono font-bold text-[#E78023] text-sm">
                  {selectedUser.btId || "Not registered"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Academic Branch</span>
                <p className="font-bold text-slate-900">
                  {selectedUser.department || "Basic Science & Humanities"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Year of Study</span>
                <p className="font-bold text-slate-900">{selectedUser.year || "—"}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Contact Phone</span>
                <p className="font-mono text-slate-800">{selectedUser.phone || "Not provided"}</p>
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

      {/* Modal: Add Registered Student */}
      {isAddUserOpen && (
        <Modal
          isOpen={isAddUserOpen}
          onClose={() => setIsAddUserOpen(false)}
          title="Add Student / Officer to Directory"
          subtitle="Manually register or sync an authenticated student account with college BT ID and branch."
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
                College Email Address <span className="text-rose-500">*</span>
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
                  College BT ID
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
                  <option value="COUNCIL_ADMIN">Admin</option>
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

      {/* Modal: Edit Student Record */}
      {userToEdit && (
        <Modal
          isOpen={!!userToEdit}
          onClose={() => setUserToEdit(null)}
          title="Edit Student Record"
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
                College Email Address <span className="text-rose-500">*</span>
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
                  College BT ID
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
                <option value="COUNCIL_ADMIN">Admin</option>
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
