"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Search, 
  Download, 
  FileSpreadsheet,
  PieChart,
  Eye, 
  ShieldCheck, 
  ShieldAlert, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
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
  RotateCcw,
  Edit3,
  ArrowUpDown,
  Calendar,
  Crown
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { 
  getStoredUsers, 
  saveRegisteredUser, 
  deleteRegisteredUser, 
  purgeRegisteredUser,
  reactivateUserAccount,
  changeUserRole, 
  approveFacultyUser,
  rejectFacultyUser,
  mergeRemoteUsers,
  syncUsersFromFirestore,
  reconcileAllUserDesignations,
  resolveDesignationByBtId, 
  formatDesignationBadge,
  isExternalUser,
  RegisteredUserRecord,
  parseUserDate,
  formatUserRegistrationDate,
  formatUserRelativeTime,
  compareUsersNewestFirst
} from "@/lib/usersStore";
import { subscribeToUsersFromFirestore } from "@/lib/firebase/firestore";
import { 
  getStoredDepartments, 
  getDepartmentShortName, 
  resolveCanonicalDepartmentName, 
  syncDepartmentsFromFirestore,
  validateStudentBtId,
  type BtIdValidationResult
} from "@/lib/departmentsStore";
import { FACULTY_DESIGNATIONS, FACULTY_TITLES } from "@/components/auth/ProfileSetupModal";
import { isOwnerEmail } from "@/types/rbac";
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
  const [categoryFilter, setCategoryFilter] = useState<
    "All" | "PENDING_FACULTY" | "VERIFIED_FACULTY" | "JDCOEM_STUDENTS" | "EXTERNAL_STUDENTS" | "COUNCIL_ADMIN" | "DELETED_ACCOUNTS" | "FLAGGED_IDS"
  >("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "name_asc" | "name_desc" | "bt_asc" | "bt_desc" | "dept_asc"
  >("newest");
  const [selectedUser, setSelectedUser] = useState<RegisteredUserRecord | null>(null);
  const [userToEdit, setUserToEdit] = useState<RegisteredUserRecord | null>(null);
  const [userToDelete, setUserToDelete] = useState<RegisteredUserRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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
    employeeId: "",
    department: "",
    year: "1st Year",
    facultyDesignation: "Assistant Professor",
    title: "Prof.",
    role: "STUDENT" as "STUDENT" | "COUNCIL_ADMIN" | "FACULTY" | "OWNER",
    userType: "JDCOEM_STUDENT" as "JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT",
    collegeName: "",
    city: "",
    degree: "",
    customBranch: "",
  });

  const [editUserForm, setEditUserForm] = useState({
    displayName: "",
    email: "",
    btId: "",
    employeeId: "",
    department: "Computer Science and Engineering",
    year: "3rd Year",
    phone: "",
    role: "STUDENT" as "STUDENT" | "COUNCIL_ADMIN" | "FACULTY" | "OWNER",
    userType: "JDCOEM_STUDENT" as "JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT",
    facultyDesignation: "Assistant Professor",
    title: "Prof.",
    collegeName: "JDCOEM Nagpur",
    city: "",
    degree: "",
    customBranch: "",
  });

  const openEditModal = (u: RegisteredUserRecord) => {
    const isFaculty = u.role === "FACULTY" || u.userType === "FACULTY" || Boolean(u.employeeId);
    const isExternal = isExternalUser(u);
    const isOwner = u.role === "OWNER" || u.adminAccess?.role === "OWNER" || isOwnerEmail(u.email);

    const initialUserType: "JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT" = 
      isFaculty ? "FACULTY" : (isExternal ? "EXTERNAL_STUDENT" : "JDCOEM_STUDENT");

    setUserToEdit(u);
    setEditUserForm({
      displayName: u.displayName || "",
      email: u.email || "",
      btId: isFaculty || isExternal ? "" : (u.btId || ""),
      employeeId: u.employeeId || "",
      department: resolveCanonicalDepartmentName(u.facultyDepartment || u.department || "Computer Science and Engineering", departments),
      year: u.year || "3rd Year",
      phone: u.phone || "",
      role: isOwner ? "OWNER" : (u.role === "COUNCIL_ADMIN" ? "COUNCIL_ADMIN" : isFaculty ? "FACULTY" : "STUDENT"),
      userType: initialUserType,
      facultyDesignation: u.facultyDesignation || "Assistant Professor",
      title: u.title || "Prof.",
      collegeName: u.collegeName || (isExternal ? "Other College" : "JDCOEM Nagpur"),
      city: u.city || "",
      degree: u.degree || "",
      customBranch: u.customBranch || "",
    });
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;

    const isUserFaculty = editUserForm.userType === "FACULTY";
    const isUserExternal = editUserForm.userType === "EXTERNAL_STUDENT";
    const isUserJdcoem = editUserForm.userType === "JDCOEM_STUDENT";

    const cleanBt = isUserJdcoem ? editUserForm.btId.trim().toUpperCase() : "";
    const cleanEmpId = isUserFaculty ? editUserForm.employeeId.trim().toUpperCase() : "";
    const parts = editUserForm.displayName.trim().split(" ");
    const isOwner = editUserForm.role === "OWNER";

    // Reconcile role with chosen userType
    let targetRole = editUserForm.role;
    if (isUserFaculty && targetRole === "STUDENT") {
      targetRole = "FACULTY";
    } else if (!isUserFaculty && targetRole === "FACULTY") {
      targetRole = "STUDENT";
    }

    const updatedRecord: RegisteredUserRecord = {
      ...userToEdit,
      displayName: editUserForm.displayName.trim(),
      email: editUserForm.email.trim().toLowerCase(),
      btId: cleanBt,
      employeeId: cleanEmpId || undefined,
      department: isUserJdcoem
        ? editUserForm.department
        : isUserFaculty
        ? editUserForm.department
        : (editUserForm.customBranch.trim() || editUserForm.department || "General Stream"),
      facultyDepartment: isUserFaculty ? editUserForm.department : undefined,
      facultyDesignation: isUserFaculty ? editUserForm.facultyDesignation : undefined,
      title: isUserFaculty ? editUserForm.title : undefined,
      facultyApprovalStatus: isUserFaculty ? (userToEdit.facultyApprovalStatus || "approved") : undefined,
      year: isUserFaculty ? "" : editUserForm.year,
      phone: editUserForm.phone.trim(),
      role: targetRole,
      userType: editUserForm.userType,
      isCollegeStudent: !isUserExternal,
      collegeName: isUserExternal 
        ? (editUserForm.collegeName.trim() || "Other College") 
        : "JDCOEM Nagpur",
      degree: isUserExternal ? editUserForm.degree.trim() : undefined,
      customBranch: isUserExternal ? editUserForm.customBranch.trim() : undefined,
      city: isUserExternal ? editUserForm.city.trim() : (userToEdit.city || undefined),
      firstName: parts[0] || userToEdit.firstName || "",
      lastName: parts.slice(1).join(" ") || userToEdit.lastName || "",
      profileCompleted: isUserFaculty 
        ? Boolean(editUserForm.department && editUserForm.facultyDesignation)
        : isUserExternal 
        ? Boolean(editUserForm.collegeName.trim()) 
        : Boolean(cleanBt),
      lastActive: new Date().toISOString(),
      adminAccess: isOwner
        ? {
            uid: userToEdit.uid,
            btId: cleanBt || cleanEmpId || editUserForm.email.trim().toLowerCase(),
            email: editUserForm.email.trim().toLowerCase(),
            name: editUserForm.displayName.trim(),
            role: "OWNER",
            active: true,
            grantedBy: "admin",
            grantedAt: userToEdit.adminAccess?.grantedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : userToEdit.adminAccess?.role === "OWNER" && targetRole !== "OWNER"
        ? undefined
        : userToEdit.adminAccess,
    };

    saveRegisteredUser(updatedRecord);
    setUsers(getStoredUsers());
    showNotice(
      isOwner 
        ? `Successfully updated ${updatedRecord.displayName} as System Owner.`
        : `Successfully updated profile & account type for ${updatedRecord.displayName}.`
    );
    setUserToEdit(null);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const isFacultyRole = newUserForm.userType === "FACULTY" || newUserForm.role === "FACULTY";
    const isExternal = newUserForm.userType === "EXTERNAL_STUDENT";
    const isJdcoem = newUserForm.userType === "JDCOEM_STUDENT";

    if (!newUserForm.email.trim() || !newUserForm.displayName.trim()) {
      alert("Please fill in required fields (Full Name and Email).");
      return;
    }
    if (isJdcoem && !newUserForm.department.trim()) {
      alert("Please select Department for the JDCOEM student record.");
      return;
    }
    if (!isFacultyRole && !newUserForm.year.trim()) {
      alert("Please select Academic Year.");
      return;
    }
    if (isExternal && !newUserForm.collegeName.trim()) {
      alert("Please enter the Institution / College Name for external delegate.");
      return;
    }

    const email = newUserForm.email.trim().toLowerCase();
    const cleanBt = isJdcoem ? newUserForm.btId.trim().toUpperCase() : "";
    const cleanEmpId = isFacultyRole ? newUserForm.employeeId.trim().toUpperCase() : "";
    const parts = newUserForm.displayName.trim().split(" ");
    const isOwner = newUserForm.role === "OWNER";

    const record: RegisteredUserRecord = {
      uid: `${isFacultyRole ? "faculty" : isExternal ? "external" : "student"}-${Date.now()}`,
      email: email,
      displayName: newUserForm.displayName.trim(),
      photoURL: null,
      role: isFacultyRole ? (newUserForm.role === "STUDENT" ? "FACULTY" : newUserForm.role) : newUserForm.role,
      userType: newUserForm.userType,
      isCollegeStudent: !isExternal,
      collegeName: isExternal ? (newUserForm.collegeName.trim() || "Other College") : "JDCOEM Nagpur",
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ") || "",
      btId: cleanBt,
      employeeId: cleanEmpId || undefined,
      department: isJdcoem ? newUserForm.department : (newUserForm.customBranch.trim() || newUserForm.department || "General Stream"),
      facultyDepartment: isFacultyRole ? newUserForm.department : undefined,
      facultyDesignation: isFacultyRole ? newUserForm.facultyDesignation : undefined,
      facultyApprovalStatus: isFacultyRole ? "approved" : undefined,
      title: isFacultyRole ? newUserForm.title : undefined,
      year: isFacultyRole ? "" : newUserForm.year,
      city: isExternal ? newUserForm.city.trim() : undefined,
      degree: isExternal ? newUserForm.degree.trim() : undefined,
      customBranch: isExternal ? newUserForm.customBranch.trim() : undefined,
      phone: "",
      profileCompleted: isFacultyRole 
        ? Boolean(newUserForm.department && newUserForm.facultyDesignation) 
        : isExternal 
        ? Boolean(newUserForm.collegeName.trim()) 
        : Boolean(cleanBt && newUserForm.department && newUserForm.year),
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      adminAccess: isOwner
        ? {
            uid: `admin-${Date.now()}`,
            btId: cleanBt || cleanEmpId || email,
            email: email,
            name: newUserForm.displayName.trim(),
            role: "OWNER",
            active: true,
            grantedBy: "owner",
            grantedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : undefined,
    };

    saveRegisteredUser(record);
    setUsers(getStoredUsers());
    showNotice(`Successfully added ${isFacultyRole ? "faculty member" : isExternal ? "external delegate" : "student"}: ${record.displayName} (${record.email})`);
    setIsAddUserOpen(false);
    setNewUserForm({
      displayName: "",
      email: "",
      btId: "",
      employeeId: "",
      department: "",
      year: "1st Year",
      facultyDesignation: "Assistant Professor",
      title: "Prof.",
      role: "STUDENT",
      userType: "JDCOEM_STUDENT",
      collegeName: "",
      city: "",
      degree: "",
      customBranch: "",
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
    const isFaculty = user.role === "FACULTY" || user.userType === "FACULTY";
    const isOwner = user.role === "OWNER" || user.adminAccess?.role === "OWNER" || isOwnerEmail(user.email);
    const isAdmin = user.role === "COUNCIL_ADMIN";

    let newRole: "STUDENT" | "COUNCIL_ADMIN" | "FACULTY" | "OWNER";
    let actionName: string;

    if (isOwner) {
      newRole = isFaculty ? "FACULTY" : "STUDENT";
      actionName = isFaculty ? "Demoted from Owner to Faculty" : "Demoted from Owner to Student";
    } else if (isAdmin) {
      newRole = isFaculty ? "FACULTY" : "STUDENT";
      actionName = isFaculty ? "Demoted from Admin to Faculty" : "Demoted to Student";
    } else {
      newRole = "COUNCIL_ADMIN";
      actionName = isFaculty ? "Promoted Faculty to Admin" : "Promoted to Admin";
    }

    changeUserRole(user.uid, newRole);
    showNotice(`${actionName}: ${user.displayName || user.email}`);
  };

  const handleReactivateUser = (user: RegisteredUserRecord) => {
    reactivateUserAccount(user.uid);
    showNotice(`Account reactivated for ${user.displayName || user.email}. They can now sign in.`);
    if (selectedUser?.uid === user.uid) {
      setSelectedUser((prev) => prev ? { ...prev, isDeleted: false, status: "active", deletedAt: undefined } : null);
    }
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
      (u) => !u.isDeleted && u.status !== "deleted" && !isExternalUser(u) && u.role !== "FACULTY"
    );
  }, [users]);

  const externalStudents = useMemo(() => {
    return users.filter(
      (u) => !u.isDeleted && u.status !== "deleted" && isExternalUser(u)
    );
  }, [users]);

  const adminUsers = useMemo(() => {
    return users.filter((u) => !u.isDeleted && u.status !== "deleted" && (u.role === "COUNCIL_ADMIN" || u.role === "OWNER" || u.adminAccess?.role === "OWNER" || isOwnerEmail(u.email)));
  }, [users]);

  const deletedUsers = useMemo(() => {
    return users.filter((u) => u.isDeleted || u.status === "deleted");
  }, [users]);

  // Flagged Student IDs for review (BT ID format or department mismatch)
  // NOTE: In accordance with directives, flagging NEVER pauses or blocks registration.
  const flaggedUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.isDeleted || u.status === "deleted") return false;
      if (isExternalUser(u) || u.role === "FACULTY" || u.userType === "FACULTY") return false;
      return validateStudentBtId(u.btId, u.department).isFlagged;
    });
  }, [users]);

  const filteredUsers = useMemo(() => {
    const list = users.filter((u) => {
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
        matchesCategory = !u.isDeleted && u.status !== "deleted" && !isExternalUser(u) && u.role !== "FACULTY" && u.userType !== "FACULTY";
      } else if (categoryFilter === "EXTERNAL_STUDENTS") {
        matchesCategory = !u.isDeleted && u.status !== "deleted" && isExternalUser(u);
      } else if (categoryFilter === "COUNCIL_ADMIN") {
        matchesCategory = !u.isDeleted && u.status !== "deleted" && (u.role === "COUNCIL_ADMIN" || u.role === "OWNER" || u.adminAccess?.role === "OWNER" || isOwnerEmail(u.email));
      } else if (categoryFilter === "FLAGGED_IDS") {
        matchesCategory = !u.isDeleted && u.status !== "deleted" && !isExternalUser(u) && u.role !== "FACULTY" && u.userType !== "FACULTY" && validateStudentBtId(u.btId, u.department).isFlagged;
      }

      const matchesDept =
        deptFilter === "All" || u.department === deptFilter || u.facultyDepartment === deptFilter;

      return matchesSearch && matchesCategory && matchesDept;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "newest") {
        return compareUsersNewestFirst(a, b);
      }
      if (sortBy === "oldest") {
        const timeA = parseUserDate(a);
        const timeB = parseUserDate(b);
        if (timeA !== timeB) return timeA - timeB;
        const nameA = (a.displayName || a.name || a.email || "").toLowerCase();
        const nameB = (b.displayName || b.name || b.email || "").toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === "name_asc") {
        const nameA = (a.displayName || a.name || a.email || "").toLowerCase();
        const nameB = (b.displayName || b.name || b.email || "").toLowerCase();
        const comp = nameA.localeCompare(nameB);
        return comp !== 0 ? comp : compareUsersNewestFirst(a, b);
      }
      if (sortBy === "name_desc") {
        const nameA = (a.displayName || a.name || a.email || "").toLowerCase();
        const nameB = (b.displayName || b.name || b.email || "").toLowerCase();
        const comp = nameB.localeCompare(nameA);
        return comp !== 0 ? comp : compareUsersNewestFirst(a, b);
      }
      if (sortBy === "bt_asc") {
        const btA = (a.btId || "ZZZZZZ").toUpperCase();
        const btB = (b.btId || "ZZZZZZ").toUpperCase();
        const comp = btA.localeCompare(btB);
        return comp !== 0 ? comp : compareUsersNewestFirst(a, b);
      }
      if (sortBy === "bt_desc") {
        const btA = (a.btId || "").toUpperCase();
        const btB = (b.btId || "").toUpperCase();
        const comp = btB.localeCompare(btA);
        return comp !== 0 ? comp : compareUsersNewestFirst(a, b);
      }
      if (sortBy === "dept_asc") {
        const deptA = (a.department || a.facultyDepartment || "").toLowerCase();
        const deptB = (b.department || b.facultyDepartment || "").toLowerCase();
        const comp = deptA.localeCompare(deptB);
        return comp !== 0 ? comp : compareUsersNewestFirst(a, b);
      }
      return 0;
    });
  }, [users, searchQuery, categoryFilter, deptFilter, sortBy]);

  const handleExportExcel = async () => {
    if (filteredUsers.length === 0) {
      alert("No user records available to export.");
      return;
    }

    const XLSX = await import("xlsx");

    const rows = filteredUsers.map((u) => {
      const isStudent = !isExternalUser(u) && u.role !== "FACULTY" && u.userType !== "FACULTY" && !u.isDeleted;
      const validation = isStudent ? validateStudentBtId(u.btId, u.department) : { isFlagged: false };

      return {
        "User Type": u.role === "FACULTY" || u.userType === "FACULTY" ? "FACULTY" : u.userType === "EXTERNAL_STUDENT" ? "EXTERNAL STUDENT" : "JDCOEM STUDENT",
        "Full Name": u.displayName || "",
        "Email Address": u.email || "",
        "College BT ID": u.btId || "N/A",
        "Flagged Status": validation.isFlagged ? "FLAGGED FOR REVIEW" : "VALID",
        "Flag Reason": validation.isFlagged ? (validation.reason || "Format mismatch") : "N/A",
        "College / University": u.collegeName || "JDCOEM Nagpur",
        "City": u.city || "Nagpur",
        "Department / Branch": u.facultyDepartment || u.department || u.customBranch || "",
        "Academic Year / Role": u.facultyDesignation || u.year || "",
        "Faculty Status": u.facultyApprovalStatus || "N/A",
        "WhatsApp Contact": u.phone || "",
        "Access Role": u.role,
        "Profile Completed": u.profileCompleted ? "YES" : "NO",
        "Registration Date": formatUserRegistrationDate(u.createdAt),
      };
    });

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

          <Link
            href="/admin/users/summary"
            className="h-9 px-3 sm:px-3.5 rounded-xl border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-indigo-900 text-xs font-medium tracking-normal transition-all duration-200 shadow-2xs active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2"
            title="Open Academic Year & Department visual pie charts and analytics"
          >
            <PieChart className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Roster Summary</span>
            <span className="sm:hidden">Summary</span>
          </Link>
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

      {/* Summary KPI Badges (7 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
        <button
          type="button"
          onClick={() => setCategoryFilter("All")}
          className={`p-4 rounded-2xl bg-white border shadow-xs space-y-1 text-left transition-all hover:border-[#17458F]/40 cursor-pointer ${
            categoryFilter === "All" ? "ring-2 ring-[#17458F] border-[#17458F]" : "border-slate-200"
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Users</span>
          <p className="font-hero font-extrabold text-2xl text-[#0F172A]">{users.length}</p>
          <span className="text-[10px] text-slate-500 font-medium block">All Accounts</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter("JDCOEM_STUDENTS")}
          className={`p-4 rounded-2xl bg-white border shadow-xs space-y-1 text-left transition-all hover:border-[#17458F]/40 cursor-pointer ${
            categoryFilter === "JDCOEM_STUDENTS" ? "ring-2 ring-[#17458F] border-[#17458F]" : "border-slate-200"
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">JDCOEM Students</span>
          <p className="font-hero font-extrabold text-2xl text-[#17458F]">{jdcoemStudents.length}</p>
          <span className="text-[10px] text-slate-500 font-medium block">Verified BT IDs</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter(pendingFaculty.length > 0 ? "PENDING_FACULTY" : "VERIFIED_FACULTY")}
          className={`p-4 rounded-2xl bg-white border shadow-xs space-y-1 text-left transition-all hover:border-[#E78023]/40 cursor-pointer ${
            categoryFilter === "VERIFIED_FACULTY" || categoryFilter === "PENDING_FACULTY" ? "ring-2 ring-[#E78023] border-[#E78023]" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Faculty &amp; Staff</span>
            {pendingFaculty.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[9px]">
                {pendingFaculty.length} Pending
              </span>
            )}
          </div>
          <p className="font-hero font-extrabold text-2xl text-[#E78023]">{verifiedFaculty.length + pendingFaculty.length}</p>
          <span className="text-[10px] text-slate-500 font-medium block">{verifiedFaculty.length} Approved</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter("EXTERNAL_STUDENTS")}
          className={`p-4 rounded-2xl bg-white border shadow-xs space-y-1 text-left transition-all hover:border-emerald-500/40 cursor-pointer ${
            categoryFilter === "EXTERNAL_STUDENTS" ? "ring-2 ring-emerald-600 border-emerald-600" : "border-slate-200"
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Other Colleges</span>
          <p className="font-hero font-extrabold text-2xl text-emerald-600">{externalStudents.length}</p>
          <span className="text-[10px] text-slate-500 font-medium block">Visiting Delegates</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter("COUNCIL_ADMIN")}
          className={`p-4 rounded-2xl bg-white border shadow-xs space-y-1 text-left transition-all hover:border-slate-900/40 cursor-pointer ${
            categoryFilter === "COUNCIL_ADMIN" ? "ring-2 ring-slate-900 border-slate-900" : "border-slate-200"
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Council Admins</span>
          <p className="font-hero font-extrabold text-2xl text-slate-900">{adminUsers.length}</p>
          <span className="text-[10px] text-slate-500 font-medium block">Full Studio Access</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter("FLAGGED_IDS")}
          className={`p-4 rounded-2xl bg-white border shadow-xs space-y-1 text-left transition-all hover:border-amber-500/40 cursor-pointer ${
            categoryFilter === "FLAGGED_IDS" ? "ring-2 ring-amber-500 border-amber-500 bg-amber-50/20" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Flagged IDs</span>
            {flaggedUsers.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[9px] animate-pulse">
                {flaggedUsers.length} Review
              </span>
            )}
          </div>
          <p className="font-hero font-extrabold text-2xl text-amber-600">{flaggedUsers.length}</p>
          <span className="text-[10px] text-slate-500 font-medium block">Format / Dept Issue</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter("DELETED_ACCOUNTS")}
          className={`p-4 rounded-2xl bg-white border shadow-xs space-y-1 text-left transition-all hover:border-rose-500/40 cursor-pointer ${
            categoryFilter === "DELETED_ACCOUNTS" ? "ring-2 ring-rose-600 border-rose-600" : "border-slate-200"
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Deleted Accounts</span>
          <p className="font-hero font-extrabold text-2xl text-rose-600">{deletedUsers.length}</p>
          <span className="text-[10px] text-slate-500 font-medium block">Deactivated</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, BT ID, email, college, or branch..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#17458F]"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          {/* Sort Selector */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#17458F] shrink-0" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
            >
              <option value="newest">Newest Registered</option>
              <option value="oldest">Oldest Registered</option>
              <option value="name_asc">Name (A → Z)</option>
              <option value="name_desc">Name (Z → A)</option>
              <option value="bt_asc">BT ID (A → Z)</option>
              <option value="bt_desc">BT ID (Z → A)</option>
              <option value="dept_asc">Department (A → Z)</option>
            </select>
          </div>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#17458F] cursor-pointer"
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

      {/* Flagged IDs Section Header / Explanatory Alert Banner */}
      {categoryFilter === "FLAGGED_IDS" && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/90 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-2xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h4 className="font-heading font-extrabold text-sm text-amber-950">
                  Flagged Student IDs Review ({flaggedUsers.length} Account{flaggedUsers.length === 1 ? "" : "s"})
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 text-[10px] font-bold">
                  Admin Audit
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                These accounts have a BT ID that does not match the department format or has a branch code discrepancy.
                <span className="font-bold text-amber-950 block mt-0.5">
                  🛡️ Registrations &amp; Logins are NOT paused for these accounts — students continue participating without interruption.
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCategoryFilter("All")}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer self-start sm:self-center"
          >
            Clear Filter (Show All)
          </button>
        </div>
      )}

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
                  <th 
                    onClick={() => setSortBy(sortBy === "name_asc" ? "name_desc" : "name_asc")}
                    className="py-4 px-6 cursor-pointer select-none hover:text-[#17458F] transition-colors"
                    title="Click to sort by Full Name"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>User / Delegate</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === "name_asc" || sortBy === "name_desc" ? "text-[#17458F]" : "text-slate-300"}`} />
                    </div>
                  </th>
                  <th 
                    onClick={() => setSortBy(sortBy === "bt_asc" ? "bt_desc" : "bt_asc")}
                    className="py-4 px-6 cursor-pointer select-none hover:text-[#17458F] transition-colors"
                    title="Click to sort by College BT ID"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Affiliation / BT ID</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === "bt_asc" || sortBy === "bt_desc" ? "text-[#17458F]" : "text-slate-300"}`} />
                    </div>
                  </th>
                  <th 
                    onClick={() => setSortBy(sortBy === "dept_asc" ? "newest" : "dept_asc")}
                    className="py-4 px-6 cursor-pointer select-none hover:text-[#17458F] transition-colors"
                    title="Click to sort by Department"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Department &amp; Specialization</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === "dept_asc" ? "text-[#17458F]" : "text-slate-300"}`} />
                    </div>
                  </th>
                  <th className="py-4 px-6">Account Category</th>
                  <th 
                    onClick={() => setSortBy(sortBy === "newest" ? "oldest" : "newest")}
                    className="py-4 px-6 cursor-pointer select-none hover:text-[#17458F] transition-colors"
                    title="Click to toggle Newest / Oldest Registered"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Registered</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortBy === "newest" || sortBy === "oldest" ? "text-[#17458F]" : "text-slate-300"}`} />
                    </div>
                  </th>
                  <th className="py-4 px-6">Verification Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredUsers.map((u) => {
                  const isDeleted = Boolean(u.isDeleted || u.status === "deleted");
                  const isFaculty = u.role === "FACULTY" || u.userType === "FACULTY";
                  const isExternal = isExternalUser(u);
                  const isPendingFaculty = !isDeleted && isFaculty && u.facultyApprovalStatus === "pending";
                  const validation = !isDeleted && !isFaculty && !isExternal 
                    ? validateStudentBtId(u.btId, u.department) 
                    : { isFlagged: false };

                  return (
                    <tr 
                      key={u.uid} 
                      className={`hover:bg-slate-50 transition-colors ${
                        isDeleted ? "bg-rose-50/30" : isPendingFaculty ? "bg-amber-50/40" : validation.isFlagged ? "bg-amber-50/20" : ""
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
                          validation.isFlagged ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-amber-900 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300">
                                  {u.btId}
                                </span>
                                <span 
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                                  title={validation.reason}
                                >
                                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Flagged</span>
                                </span>
                              </div>
                              <span className="block text-[10px] font-semibold text-amber-800 leading-tight max-w-[210px]">
                                {validation.reason}
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono font-bold text-[#17458F] px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200">
                              {u.btId}
                            </span>
                          )
                        ) : (
                          <div className="space-y-1">
                            <span className="text-slate-400 text-xs italic font-sans block">
                              Pending BT ID
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Missing ID</span>
                            </span>
                          </div>
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
                                u.role === "OWNER" || u.adminAccess?.role === "OWNER" || isOwnerEmail(u.email)
                                  ? "purple"
                                  : u.role === "COUNCIL_ADMIN"
                                  ? "orange"
                                  : isFaculty
                                  ? "navy"
                                  : isExternal
                                  ? "success"
                                  : "slate"
                              }
                              size="sm"
                            >
                              {u.role === "OWNER" || u.adminAccess?.role === "OWNER" || isOwnerEmail(u.email)
                                ? (isFaculty ? "Faculty (Owner)" : "Owner")
                                : u.role === "COUNCIL_ADMIN"
                                ? (isFaculty ? "Faculty (Admin)" : "Admin")
                                : isFaculty
                                ? "Faculty"
                                : isExternal
                                ? "Other College"
                                : "JDCOEM Student"}
                            </Badge>
                          )}
                          {!isDeleted && (() => {
                            const effectiveBadge = formatDesignationBadge((u.btId ? resolveDesignationByBtId(u.btId, u.displayName || u.name || undefined)?.designationBadge : null) || u.designationBadge);
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

                      {/* Registered Date */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-800 block text-xs tabular-nums">
                            {formatUserRegistrationDate(u.createdAt)}
                          </span>
                          {formatUserRelativeTime(u.createdAt) ? (
                            <span className="inline-block text-[10px] text-slate-400 font-medium">
                              {formatUserRelativeTime(u.createdAt)}
                            </span>
                          ) : null}
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
                        ) : u.role === "COUNCIL_ADMIN" || u.profileCompleted ? (
                          validation.isFlagged ? (
                            <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold bg-amber-100/70 px-2.5 py-1 rounded-xl border border-amber-300 w-fit shadow-2xs">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Flagged for Review</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Verified BT ID</span>
                            </div>
                          )
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
                                onClick={() => handleReactivateUser(u)}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
                                title="Reactivate User Account"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
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
                                  u.role === "OWNER"
                                    ? "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200"
                                    : u.role === "COUNCIL_ADMIN"
                                    ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                }`}
                                title={
                                  u.role === "OWNER"
                                    ? (isFaculty ? "Demote from Owner to Faculty" : "Demote from Owner to Student")
                                    : u.role === "COUNCIL_ADMIN"
                                    ? (isFaculty ? "Demote from Admin to Faculty" : "Demote to Student")
                                    : (isFaculty ? "Promote Faculty to Admin" : "Promote to Admin")
                                }
                              >
                                {u.role === "OWNER" ? (
                                  <Crown className="w-3.5 h-3.5 text-purple-600" />
                                ) : u.role === "COUNCIL_ADMIN" ? (
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
              <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="font-heading font-extrabold text-sm text-rose-950">
                      Account Permanently Deactivated
                    </h4>
                    <p className="text-xs text-rose-700 font-medium">
                      This account was deleted on {selectedUser.deletedAt ? new Date(selectedUser.deletedAt).toLocaleString() : "record"}.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => handleReactivateUser(selectedUser)}
                  variant="primary"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 text-xs font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Reactivate
                </Button>
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
                        selectedUser.role === "OWNER" || selectedUser.adminAccess?.role === "OWNER" || isOwnerEmail(selectedUser.email)
                          ? "purple"
                          : selectedUser.role === "COUNCIL_ADMIN" 
                          ? "orange" 
                          : selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY" 
                          ? "navy" 
                          : selectedUser.userType === "EXTERNAL_STUDENT" 
                          ? "success" 
                          : "slate"
                      } 
                      size="sm"
                    >
                      {selectedUser.role === "OWNER" || selectedUser.adminAccess?.role === "OWNER" || isOwnerEmail(selectedUser.email)
                        ? (selectedUser.userType === "FACULTY" || selectedUser.employeeId ? "Faculty (Owner)" : "Platform Owner")
                        : selectedUser.role === "COUNCIL_ADMIN" 
                        ? (selectedUser.userType === "FACULTY" || selectedUser.employeeId ? "Council Admin (Faculty)" : "Council Admin")
                        : selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY" 
                        ? "Faculty Member" 
                        : selectedUser.userType === "EXTERNAL_STUDENT" 
                        ? "Visiting Delegate" 
                        : "JDCOEM Student"}
                    </Badge>
                  )}
                  {!selectedUser.isDeleted && (() => {
                    const effectiveBadge = formatDesignationBadge((selectedUser.btId ? resolveDesignationByBtId(selectedUser.btId, selectedUser.displayName || selectedUser.name || undefined)?.designationBadge : null) || selectedUser.designationBadge);
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

            {/* Flagged Student BT ID Alert Callout */}
            {!isExternalUser(selectedUser) &&
              selectedUser.role !== "FACULTY" &&
              selectedUser.userType !== "FACULTY" &&
              !selectedUser.employeeId &&
              (() => {
                const validation = validateStudentBtId(selectedUser.btId, selectedUser.department);
                if (!validation.isFlagged) return null;
                return (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="text-xs space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-900">Student BT ID Flagged for Review</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-200/60 text-amber-800 font-semibold">
                          Audit Warning
                        </span>
                      </div>
                      <p className="text-amber-800 leading-relaxed font-medium">
                        {validation.reason}
                      </p>
                      {validation.expectedExample && (
                        <p className="text-[11px] text-amber-700/80 pt-0.5">
                          Example format: <span className="font-mono font-semibold">{validation.expectedExample}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Box 1: Affiliation / College */}
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Institution / College</span>
                <p className="font-bold text-slate-900">
                  {isExternalUser(selectedUser) ? (selectedUser.collegeName || "Other College") : "JDCOEM Nagpur"}
                </p>
                {selectedUser.city && (
                  <p className="text-[11px] text-slate-500 font-medium">📍 {selectedUser.city}</p>
                )}
              </div>

              {/* Box 2: BT ID or Staff ID */}
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">
                  {selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY" || Boolean(selectedUser.employeeId)
                    ? "Staff / Employee ID"
                    : "College BT ID"}
                </span>
                <p className="font-mono font-bold text-[#E78023] text-sm flex items-center flex-wrap gap-1.5">
                  {selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY" || Boolean(selectedUser.employeeId)
                    ? (selectedUser.employeeId || "No ID Required")
                    : (selectedUser.btId || (selectedUser.userType === "EXTERNAL_STUDENT" ? "External Delegate" : "Not registered"))}
                  {!isExternalUser(selectedUser) &&
                    selectedUser.role !== "FACULTY" &&
                    selectedUser.userType !== "FACULTY" &&
                    !selectedUser.employeeId &&
                    validateStudentBtId(selectedUser.btId, selectedUser.department).isFlagged && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                        Flagged
                      </span>
                  )}
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
                  {selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY" || Boolean(selectedUser.employeeId)
                    ? "Academic Title & Role"
                    : "Year of Study"}
                </span>
                <p className="font-bold text-slate-900">
                  {selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY" || Boolean(selectedUser.employeeId)
                    ? (selectedUser.facultyDesignation || "Faculty Member")
                    : (selectedUser.year || "—")}
                </p>
              </div>

              {/* Box 5: Contact */}
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">WhatsApp Contact Phone</span>
                <p className="font-mono text-slate-800 font-semibold text-xs">{selectedUser.phone || "Not provided"}</p>
              </div>

              {/* Box 6: Registration Date */}
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1 border border-slate-100">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Registration Timestamp</span>
                <p className="font-mono text-slate-800 font-semibold text-xs">
                  {formatUserRegistrationDate(selectedUser.createdAt)}
                  {formatUserRelativeTime(selectedUser.createdAt) ? ` (${formatUserRelativeTime(selectedUser.createdAt)})` : ""}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 flex-wrap">
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
                  const targetUser = selectedUser;
                  setSelectedUser(null);
                  openEditModal(targetUser);
                }}
                variant="outline"
                size="sm"
                className="border-[#17458F]/30 text-[#17458F] hover:bg-[#17458F]/5 font-bold cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                Edit Profile &amp; Account Type
              </Button>
              {selectedUser.isDeleted || selectedUser.status === "deleted" ? (
                <Button
                  type="button"
                  onClick={() => {
                    handleReactivateUser(selectedUser);
                  }}
                  variant="primary"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  Reactivate Account
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    handleRoleToggle(selectedUser);
                    setSelectedUser(null);
                  }}
                  variant="primary"
                  size="sm"
                >
                  {selectedUser.role === "OWNER" || selectedUser.adminAccess?.role === "OWNER" || isOwnerEmail(selectedUser.email)
                    ? (selectedUser.userType === "FACULTY" || selectedUser.employeeId ? "Demote to Faculty" : "Demote to Student")
                    : selectedUser.role === "COUNCIL_ADMIN"
                    ? (selectedUser.userType === "FACULTY" || selectedUser.employeeId ? "Demote to Faculty" : "Demote to Student")
                    : (selectedUser.role === "FACULTY" || selectedUser.userType === "FACULTY" ? "Promote Faculty to Admin" : "Promote to Admin")}
                </Button>
              )}
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

            {/* Account Type Selector */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Account Type</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] font-medium text-slate-400">
                  Select membership classification
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNewUserForm({ ...newUserForm, userType: "JDCOEM_STUDENT", role: "STUDENT", collegeName: "JDCOEM Nagpur" })}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                    newUserForm.userType === "JDCOEM_STUDENT"
                      ? "bg-white border-[#17458F] text-[#17458F] shadow-xs ring-2 ring-[#17458F]/15"
                      : "bg-white/70 border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="text-base leading-none">🎓</span>
                  <div className="min-w-0">
                    <p className="font-bold leading-tight">JDCOEM Student</p>
                    <p className="text-[10px] font-normal text-slate-400">Regular student</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNewUserForm({ ...newUserForm, userType: "FACULTY", role: "FACULTY", collegeName: "JDCOEM Nagpur" })}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                    newUserForm.userType === "FACULTY"
                      ? "bg-white border-[#17458F] text-[#17458F] shadow-xs ring-2 ring-[#17458F]/15"
                      : "bg-white/70 border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="text-base leading-none">🏛️</span>
                  <div className="min-w-0">
                    <p className="font-bold leading-tight">Faculty Member</p>
                    <p className="text-[10px] font-normal text-slate-400">Professor / Staff</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNewUserForm({ ...newUserForm, userType: "EXTERNAL_STUDENT", role: "STUDENT", collegeName: "" })}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                    newUserForm.userType === "EXTERNAL_STUDENT"
                      ? "bg-white border-[#17458F] text-[#17458F] shadow-xs ring-2 ring-[#17458F]/15"
                      : "bg-white/70 border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="text-base leading-none">🌐</span>
                  <div className="min-w-0">
                    <p className="font-bold leading-tight">External Delegate</p>
                    <p className="text-[10px] font-normal text-slate-400">Other college</p>
                  </div>
                </button>
              </div>
            </div>

            {newUserForm.userType === "EXTERNAL_STUDENT" ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Institution / College Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newUserForm.collegeName}
                      onChange={(e) => setNewUserForm({ ...newUserForm, collegeName: e.target.value })}
                      placeholder="e.g. VNIT Nagpur, RCOEM, GHRCE"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={newUserForm.city}
                      onChange={(e) => setNewUserForm({ ...newUserForm, city: e.target.value })}
                      placeholder="e.g. Nagpur"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Degree / Program
                    </label>
                    <input
                      type="text"
                      value={newUserForm.degree}
                      onChange={(e) => setNewUserForm({ ...newUserForm, degree: e.target.value })}
                      placeholder="e.g. B.Tech, MBA, BCA"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Department / Branch
                    </label>
                    <input
                      type="text"
                      value={newUserForm.customBranch}
                      onChange={(e) => setNewUserForm({ ...newUserForm, customBranch: e.target.value })}
                      placeholder="e.g. Computer Engineering"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Year of Study <span className="text-rose-500">*</span>
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
                      <option value="Postgraduate (MBA/MCA)">Postgraduate (MBA/MCA)</option>
                    </select>
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
              </>
            ) : newUserForm.userType === "FACULTY" ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Staff / Employee ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={newUserForm.employeeId}
                      onChange={(e) => setNewUserForm({ ...newUserForm, employeeId: e.target.value.toUpperCase() })}
                      placeholder="e.g. EMP-1042"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-[#17458F] focus:outline-none focus:border-[#17458F]"
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
                      <option value="FACULTY">Faculty Member</option>
                      <option value="COUNCIL_ADMIN">Council Admin (Faculty)</option>
                      <option value="OWNER">Owner (Full Governance)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Department / Branch <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newUserForm.department}
                      onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer"
                      required
                    >
                      <option value="" disabled>-- Click to select department --</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Faculty Designation <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newUserForm.facultyDesignation}
                      onChange={(e) => setNewUserForm({ ...newUserForm, facultyDesignation: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer"
                      required
                    >
                      {FACULTY_DESIGNATIONS.map((desig) => (
                        <option key={desig} value={desig}>
                          {desig}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      College BT ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={newUserForm.btId}
                      onChange={(e) => setNewUserForm({ ...newUserForm, btId: e.target.value.toUpperCase() })}
                      placeholder="e.g. BT210115DS"
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
                      <option value="OWNER">Owner (Full Governance)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Department / Branch <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newUserForm.department}
                      onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer"
                      required
                    >
                      <option value="" disabled>-- Click to select department --</option>
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
                      value={newUserForm.year}
                      onChange={(e) => setNewUserForm({ ...newUserForm, year: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer"
                      required
                    >
                      <option value="" disabled>-- Click to select year of study --</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year / Final Year">4th Year / Final Year</option>
                      <option value="Postgraduate (MBA/MCA)">Postgraduate (MBA/MCA)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

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
                disabled={
                  !newUserForm.displayName.trim() || 
                  !newUserForm.email.trim() || 
                  (newUserForm.userType === "JDCOEM_STUDENT" && (!newUserForm.department.trim() || !newUserForm.year.trim())) ||
                  (newUserForm.userType === "FACULTY" && !newUserForm.department.trim()) ||
                  (newUserForm.userType === "EXTERNAL_STUDENT" && (!newUserForm.collegeName.trim() || !newUserForm.year.trim()))
                }
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

            {/* Account Type Selector Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Account Type / Classification</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] font-medium text-slate-400">
                  Switch account category &amp; role
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditUserForm((prev) => ({
                      ...prev,
                      userType: "JDCOEM_STUDENT",
                      role: prev.role === "FACULTY" ? "STUDENT" : prev.role,
                      collegeName: "JDCOEM Nagpur",
                    }));
                  }}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                    editUserForm.userType === "JDCOEM_STUDENT"
                      ? "bg-white border-[#17458F] text-[#17458F] shadow-xs ring-2 ring-[#17458F]/15"
                      : "bg-white/70 border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="text-base leading-none">🎓</span>
                  <div className="min-w-0">
                    <p className="font-bold leading-tight">JDCOEM Student</p>
                    <p className="text-[10px] font-normal text-slate-400">Enrolled student</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditUserForm((prev) => ({
                      ...prev,
                      userType: "FACULTY",
                      role: prev.role === "STUDENT" ? "FACULTY" : prev.role,
                      collegeName: "JDCOEM Nagpur",
                    }));
                  }}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                    editUserForm.userType === "FACULTY"
                      ? "bg-white border-[#17458F] text-[#17458F] shadow-xs ring-2 ring-[#17458F]/15"
                      : "bg-white/70 border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="text-base leading-none">🏛️</span>
                  <div className="min-w-0">
                    <p className="font-bold leading-tight">Faculty Member</p>
                    <p className="text-[10px] font-normal text-slate-400">Professor / Staff</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditUserForm((prev) => ({
                      ...prev,
                      userType: "EXTERNAL_STUDENT",
                      role: prev.role === "FACULTY" ? "STUDENT" : prev.role,
                      collegeName: prev.collegeName && !prev.collegeName.toLowerCase().includes("jdcoem") ? prev.collegeName : "",
                    }));
                  }}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                    editUserForm.userType === "EXTERNAL_STUDENT"
                      ? "bg-white border-[#17458F] text-[#17458F] shadow-xs ring-2 ring-[#17458F]/15"
                      : "bg-white/70 border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="text-base leading-none">🌐</span>
                  <div className="min-w-0">
                    <p className="font-bold leading-tight">External Delegate</p>
                    <p className="text-[10px] font-normal text-slate-400">Other institution</p>
                  </div>
                </button>
              </div>
            </div>

            {(() => {
              if (editUserForm.userType === "FACULTY") {
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Staff / Employee ID
                        </label>
                        <input
                          type="text"
                          value={editUserForm.employeeId}
                          onChange={(e) => setEditUserForm({ ...editUserForm, employeeId: e.target.value.toUpperCase() })}
                          placeholder="e.g. EMP-1042"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-[#17458F] focus:outline-none focus:border-[#17458F]"
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
                          Department / Branch <span className="text-rose-500">*</span>
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
                          Faculty Designation <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={editUserForm.facultyDesignation}
                          onChange={(e) => setEditUserForm({ ...editUserForm, facultyDesignation: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-[#17458F] focus:outline-none focus:border-[#17458F] cursor-pointer"
                        >
                          {FACULTY_DESIGNATIONS.map((desig) => (
                            <option key={desig} value={desig}>
                              {desig}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Academic Title
                        </label>
                        <select
                          value={editUserForm.title}
                          onChange={(e) => setEditUserForm({ ...editUserForm, title: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer"
                        >
                          {FACULTY_TITLES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
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
                          <option value="FACULTY">Faculty Member (Standard Access)</option>
                          <option value="COUNCIL_ADMIN">Council Admin (Faculty Administrator)</option>
                          <option value="OWNER">Owner (Full System &amp; Council Governance)</option>
                        </select>
                      </div>
                    </div>
                  </>
                );
              }

              if (editUserForm.userType === "EXTERNAL_STUDENT") {
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Institution / College Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editUserForm.collegeName}
                          onChange={(e) => setEditUserForm({ ...editUserForm, collegeName: e.target.value })}
                          placeholder="e.g. VNIT Nagpur, RCOEM, GHRCE"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={editUserForm.city}
                          onChange={(e) => setEditUserForm({ ...editUserForm, city: e.target.value })}
                          placeholder="e.g. Nagpur"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Degree / Program
                        </label>
                        <input
                          type="text"
                          value={editUserForm.degree}
                          onChange={(e) => setEditUserForm({ ...editUserForm, degree: e.target.value })}
                          placeholder="e.g. B.Tech, MBA, BCA"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Department / Branch
                        </label>
                        <input
                          type="text"
                          value={editUserForm.customBranch}
                          onChange={(e) => setEditUserForm({ ...editUserForm, customBranch: e.target.value })}
                          placeholder="e.g. Computer Science"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        </select>
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
                        <option value="OWNER">Owner (Full Governance)</option>
                      </select>
                    </div>
                  </>
                );
              }

              // JDCOEM Student
              const btValidation = editUserForm.btId
                ? validateStudentBtId(editUserForm.btId, editUserForm.department)
                : { isFlagged: false };

              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          College BT ID
                        </label>
                        {btValidation.isFlagged && (
                          <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Format Mismatch
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={editUserForm.btId}
                        onChange={(e) => setEditUserForm({ ...editUserForm, btId: e.target.value.toUpperCase() })}
                        placeholder="e.g. BT210036CS"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold focus:outline-none ${
                          btValidation.isFlagged
                            ? "border-amber-400 bg-amber-50/40 text-amber-900 focus:border-amber-600"
                            : "border-slate-200 text-[#E78023] focus:border-[#17458F]"
                        }`}
                      />
                      {btValidation.isFlagged && (
                        <p className="text-[10px] text-amber-700 font-medium mt-1">
                          ⚠️ {btValidation.reason}
                        </p>
                      )}
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
                      <option value="OWNER">Owner (Full Governance)</option>
                    </select>
                  </div>
                </>
              );
            })()}

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
