"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { 
  User, 
  GraduationCap, 
  Hash, 
  Building2, 
  CheckCircle2, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Award,
  Lock,
  School,
  MapPin,
  Briefcase,
  Clock, 
  Globe, 
  HelpCircle,
  Trash2,
  ChevronDown,
  Check,
  Search,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";

import { 
  getStoredDepartments, 
  DEFAULT_DEPARTMENTS,
  syncDepartmentsFromFirestore,
  subscribeToDepartments,
  resolveCanonicalDepartmentName,
  getDepartmentShortName
} from "@/lib/departmentsStore";
import { 
  checkBtIdAvailability, 
  checkBtIdAvailabilityAsync,
  resolveDesignationByBtId, 
  maskEmail,
  isExternalUser 
} from "@/lib/usersStore";
import { SearchableDegreeSelect } from "@/components/ui/SearchableDegreeSelect";

export const STUDY_YEARS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year / Final Year",
  "5th Year (Dual/Integrated)",
  "Postgraduate (MBA/MCA/M.Tech/M.Sc/M.A.)",
  "Doctoral / Ph.D. Scholar",
  "Graduated / Alumni",
];

export const FACULTY_TITLES = [
  "Prof.",
  "Dr.",
  "Mr.",
  "Ms.",
  "Mrs.",
];

export const FACULTY_DESIGNATIONS = [
  "Assistant Professor",
  "Associate Professor",
  "Professor",
  "Head of Department (HOD)",
  "Dean / Director",
  "Faculty In-Charge",
  "Lab Assistant / Technical Staff",
  "Administrative Staff",
];

export function ProfileSetupModal() {
  const { 
    user, 
    isProfileModalOpen, 
    closeProfileModal, 
    updateUserProfile, 
    deleteAccount, 
    logout, 
    pendingUserType 
  } = useAuth();
  
  // Category Switcher: JDCOEM_STUDENT | FACULTY | EXTERNAL_STUDENT
  const [accountType, setAccountType] = useState<"JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT">("JDCOEM_STUDENT");

  const [departmentsList, setDepartmentsList] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  
  // JDCOEM Student Fields (Not prefilled - user must click to unveil)
  const [btId, setBtId] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");

  // Dropdown unveil & search states for JDCOEM student
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [deptSearchTerm, setDeptSearchTerm] = useState("");
  const deptDropdownRef = useRef<HTMLDivElement>(null);

  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  // Faculty Fields
  const [title, setTitle] = useState(FACULTY_TITLES[0]);
  const [facultyDesignation, setFacultyDesignation] = useState(FACULTY_DESIGNATIONS[0]);
  const [facultyDepartment, setFacultyDepartment] = useState(DEFAULT_DEPARTMENTS[1]);
  const [employeeId, setEmployeeId] = useState("");
  
  // External Student Fields
  const [collegeName, setCollegeName] = useState("");
  const [city, setCity] = useState("");
  const [degree, setDegree] = useState("");
  const [customBranch, setCustomBranch] = useState("");
  const [externalYear, setExternalYear] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [detectedDesignation, setDetectedDesignation] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFacultyPendingNotice, setShowFacultyPendingNotice] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingRole, setIsChangingRole] = useState(false);

  // Real-time BT ID availability and conflict state
  const [btIdAvailability, setBtIdAvailability] = useState<{
    checking: boolean;
    available: boolean;
    linkedEmail?: string;
    linkedName?: string;
    isCouncilOwnerMismatch?: boolean;
  }>({ checking: false, available: true });
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, []);

  // Close custom click-to-unveil dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setIsDeptDropdownOpen(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
        setIsYearDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredDepartments = useMemo(() => {
    const query = deptSearchTerm.toLowerCase().trim();
    if (!query) return departmentsList;
    return departmentsList.filter((dept) => {
      const short = getDepartmentShortName(dept).toLowerCase();
      return dept.toLowerCase().includes(query) || short.includes(query);
    });
  }, [departmentsList, deptSearchTerm]);

  useEffect(() => {
    setDepartmentsList(getStoredDepartments());

    syncDepartmentsFromFirestore().then((remote) => {
      if (remote && Array.isArray(remote) && remote.length > 0) {
        setDepartmentsList(remote);
      }
    });

    const unsubscribe = subscribeToDepartments((fresh) => {
      if (fresh && Array.isArray(fresh) && fresh.length > 0) {
        setDepartmentsList(fresh);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      if (user.firstName && user.lastName) {
        setFirstName(user.firstName);
        setLastName(user.lastName);
      } else if (user.displayName) {
        const parts = user.displayName.trim().split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      }

      // Infer account type from pending selection or existing user attributes
      if (pendingUserType) {
        setAccountType(pendingUserType);
      } else if (user.role === "FACULTY" || user.userType === "FACULTY") {
        setAccountType("FACULTY");
      } else if (isExternalUser(user)) {
        setAccountType("EXTERNAL_STUDENT");
      } else {
        setAccountType("JDCOEM_STUDENT");
      }

      if (user.btId) {
        setBtId(user.btId);
        const match = resolveDesignationByBtId(user.btId, user.displayName || user.name || user.email);
        if (match) setDetectedDesignation(match.designationBadge);
      } else {
        setBtId("");
        setDetectedDesignation(null);
      }
      if (user.department) {
        const canonical = resolveCanonicalDepartmentName(user.department, departmentsList);
        setDepartment(canonical);
        setFacultyDepartment(canonical);
      } else {
        setDepartment("");
        setFacultyDepartment(departmentsList[1] || DEFAULT_DEPARTMENTS[1]);
      }
      if (user.year) {
        setYear(user.year);
        setExternalYear(user.year);
      } else {
        setYear("");
        setExternalYear("");
      }
      if (user.phone) setPhone(user.phone);
      if (user.title) setTitle(user.title);
      if (user.facultyDesignation) setFacultyDesignation(user.facultyDesignation);
      if (user.employeeId) setEmployeeId(user.employeeId);
      if (user.collegeName) setCollegeName(user.collegeName);
      if (user.city) setCity(user.city);
      if (user.degree || user.customBranch) {
        setDegree(user.degree || user.customBranch || "");
        setCustomBranch(user.customBranch || user.degree || "");
      }
    }
  }, [user]);

  // Live check on BT ID change for uniqueness and council designation
  const handleBtIdChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    setBtId(clean);
    setError(null);

    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    if (clean.length < 3) {
      setBtIdAvailability({ checking: false, available: true });
      setDetectedDesignation(null);
      return;
    }

    // 1. Instant synchronous check (checks canonical council, local cache, hardcoded defaults)
    const syncCheck = checkBtIdAvailability(clean, user?.uid, user?.email);
    if (!syncCheck.available) {
      setBtIdAvailability({
        checking: false,
        available: false,
        linkedEmail: syncCheck.linkedEmail,
        linkedName: syncCheck.linkedName,
        isCouncilOwnerMismatch: syncCheck.isCouncilOwnerMismatch,
      });
      setDetectedDesignation(null);
      return;
    }

    // 2. Debounced asynchronous check querying Cloud Firestore in real time
    setBtIdAvailability((prev) => ({ ...prev, checking: true }));

    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const asyncCheck = await checkBtIdAvailabilityAsync(clean, user?.uid, user?.email);
        setBtIdAvailability({
          checking: false,
          available: asyncCheck.available,
          linkedEmail: asyncCheck.linkedEmail,
          linkedName: asyncCheck.linkedName,
          isCouncilOwnerMismatch: asyncCheck.isCouncilOwnerMismatch,
        });

        if (asyncCheck.available) {
          const currentName = `${firstName} ${lastName}`.trim() || user?.displayName || user?.name || user?.email;
          const match = resolveDesignationByBtId(clean, currentName);
          if (match) {
            setDetectedDesignation(match.designationBadge);
          } else {
            setDetectedDesignation(null);
          }
        } else {
          setDetectedDesignation(null);
        }
      } catch (e) {
        setBtIdAvailability((prev) => ({ ...prev, checking: false }));
      }
    }, 400);
  };

  const handleBtIdBlur = async () => {
    const clean = btId.toUpperCase().trim();
    if (clean.length < 3) return;

    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    setBtIdAvailability((prev) => ({ ...prev, checking: true }));
    try {
      const asyncCheck = await checkBtIdAvailabilityAsync(clean, user?.uid, user?.email);
      setBtIdAvailability({
        checking: false,
        available: asyncCheck.available,
        linkedEmail: asyncCheck.linkedEmail,
        linkedName: asyncCheck.linkedName,
        isCouncilOwnerMismatch: asyncCheck.isCouncilOwnerMismatch,
      });

      if (asyncCheck.available) {
        const currentName = `${firstName} ${lastName}`.trim() || user?.displayName || user?.name || user?.email;
        const match = resolveDesignationByBtId(clean, currentName);
        if (match) {
          setDetectedDesignation(match.designationBadge);
        } else {
          setDetectedDesignation(null);
        }
      } else {
        setDetectedDesignation(null);
      }
    } catch (e) {
      setBtIdAvailability((prev) => ({ ...prev, checking: false }));
    }
  };

  // Form validity across all roles - all required fields must be filled
  const isJdcoemStudentValid = Boolean(
    firstName.trim() &&
    lastName.trim() &&
    phone.trim() &&
    btId.trim().length >= 3 &&
    btIdAvailability.available &&
    !btIdAvailability.checking &&
    department.trim() &&
    year.trim()
  );

  const isFacultyValid = Boolean(
    firstName.trim() &&
    lastName.trim() &&
    phone.trim() &&
    title.trim() &&
    facultyDesignation.trim() &&
    facultyDepartment.trim()
  );

  const isExternalValid = Boolean(
    firstName.trim() &&
    lastName.trim() &&
    phone.trim() &&
    collegeName.trim() &&
    city.trim() &&
    (degree.trim() || customBranch.trim()) &&
    externalYear.trim()
  );

  const isFormValid = 
    accountType === "JDCOEM_STUDENT" ? isJdcoemStudentValid :
    accountType === "FACULTY" ? isFacultyValid :
    isExternalValid;

  if (!isProfileModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanPhone = phone.trim();

    if (!cleanFirst || !cleanLast) {
      setError("Please enter both your First Name and Last Name.");
      return;
    }

    if (!cleanPhone) {
      setError("Please enter your WhatsApp contact number.");
      return;
    }

    // -------------------------------------------------------------
    // 1. JDCOEM STUDENT FLOW
    // -------------------------------------------------------------
    if (accountType === "JDCOEM_STUDENT") {
      const cleanBtId = btId.trim().toUpperCase();
      if (!cleanBtId || cleanBtId.length < 3) {
        setError("Please enter your official College BT ID (e.g. BT22CSE045).");
        return;
      }

      if (!department || !department.trim()) {
        setError("Please click to unveil and select your JDCOEM Department.");
        return;
      }

      if (!year || !year.trim()) {
        setError("Please click to unveil and select your Year of Study.");
        return;
      }

      // Check BT ID Uniqueness against Cloud Firestore and local data
      setIsSubmitting(true);
      const availability = await checkBtIdAvailabilityAsync(cleanBtId, user?.uid, user?.email);
      if (!availability.available) {
        setIsSubmitting(false);
        setBtIdAvailability({
          checking: false,
          available: false,
          linkedEmail: availability.linkedEmail,
          linkedName: availability.linkedName,
          isCouncilOwnerMismatch: availability.isCouncilOwnerMismatch,
        });
        const masked = maskEmail(availability.linkedEmail || "");
        setError(
          availability.isCouncilOwnerMismatch
            ? `College ID (${cleanBtId}) is assigned to Student Council official (${availability.linkedName || "Council Officer"}). It can only be activated with their official email (${masked}).`
            : `College ID (${cleanBtId}) is already linked to another account (${masked}). Each student BT ID can only be bound to one Google account.`
        );
        return;
      }

      const designationInfo = resolveDesignationByBtId(cleanBtId, `${cleanFirst} ${cleanLast}`);
      try {
        await updateUserProfile({
          firstName: cleanFirst,
          lastName: cleanLast,
          displayName: `${cleanFirst} ${cleanLast}`,
          userType: "JDCOEM_STUDENT",
          isCollegeStudent: true,
          btId: cleanBtId,
          department,
          year,
          phone: cleanPhone,
          collegeName: "",
          city: "",
          degree: "",
          customBranch: "",
          profileCompleted: true,
          designationBadge: designationInfo ? designationInfo.designationBadge : undefined,
          isCouncilOfficer: designationInfo ? designationInfo.isCouncilOfficer : false,
          role: user?.role === "COUNCIL_ADMIN" ? "COUNCIL_ADMIN" : "STUDENT",
        });
        closeProfileModal();
      } catch (err: any) {
        setError(err?.message || "Failed to save profile. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // -------------------------------------------------------------
    // 2. FACULTY / STAFF FLOW (Requires Admin Council Approval)
    // -------------------------------------------------------------
    if (accountType === "FACULTY") {
      setIsSubmitting(true);
      try {
        await updateUserProfile({
          firstName: cleanFirst,
          lastName: cleanLast,
          displayName: `${title} ${cleanFirst} ${cleanLast}`,
          role: "FACULTY",
          userType: "FACULTY",
          isCollegeStudent: true,
          title,
          facultyDesignation,
          facultyDepartment,
          department: facultyDepartment,
          employeeId: employeeId.trim() || undefined,
          facultyApprovalStatus: user?.facultyApprovalStatus === "approved" ? "approved" : "pending",
          phone: cleanPhone,
          profileCompleted: true,
          btId: undefined, // Faculty have NO BT ID
        });

        if (user?.facultyApprovalStatus !== "approved") {
          setShowFacultyPendingNotice(true);
        } else {
          closeProfileModal();
        }
      } catch (err: any) {
        setError(err?.message || "Failed to submit faculty profile. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // -------------------------------------------------------------
    // 3. OTHER COLLEGE / EXTERNAL STUDENT FLOW (Instant Auto-Approval)
    // -------------------------------------------------------------
    if (accountType === "EXTERNAL_STUDENT") {
      const cleanCollege = collegeName.trim();
      const cleanCity = city.trim();
      const cleanDegree = degree.trim() || customBranch.trim();

      if (!cleanCollege) {
        setError("Please enter your College or University Name.");
        return;
      }
      if (!cleanCity) {
        setError("Please enter your City / Location.");
        return;
      }
      if (!cleanDegree) {
        setError("Please search and select your Degree.");
        return;
      }

      setIsSubmitting(true);
      try {
        await updateUserProfile({
          firstName: cleanFirst,
          lastName: cleanLast,
          displayName: `${cleanFirst} ${cleanLast}`,
          role: "STUDENT",
          userType: "EXTERNAL_STUDENT",
          isCollegeStudent: false,
          collegeName: cleanCollege,
          city: cleanCity,
          degree: cleanDegree,
          customBranch: cleanDegree,
          department: `${cleanDegree} • ${cleanCollege}`,
          year: externalYear,
          phone: cleanPhone,
          profileCompleted: true,
          btId: undefined, // External students have NO BT ID
        });
        closeProfileModal();
      } catch (err: any) {
        setError(err?.message || "Failed to save profile. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      setShowDeleteConfirm(false);
    } catch (err: any) {
      setError(err?.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isProfileModalOpen}
      onClose={user?.profileCompleted ? closeProfileModal : () => {}}
      maxWidth="2xl"
      title=""
      closeOnBackdropClick={Boolean(user?.profileCompleted)}
      closeOnEscape={Boolean(user?.profileCompleted)}
      showCloseButton={Boolean(user?.profileCompleted)}
      contentClassName="p-4 sm:p-6"
      dialogClassName="sm:max-w-xl md:max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl border-slate-200/90"
    >
      <div className="space-y-3.5 sm:space-y-4 text-slate-800">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="relative mx-auto h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-white p-1.5 border border-slate-200/80 shadow-xs flex items-center justify-center">
            <Image
              src="/assets/SRC Logo.png"
              alt="SRC Logo"
              fill
              className="object-contain p-0.5"
            />
          </div>
          
          <div className="space-y-0.5">
            <h3 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
              Complete Your Profile
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Complete your details to access the SRC portal.
            </p>
          </div>
        </div>

        {/* Account Type Display & Change Option */}
        {!isChangingRole ? (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {accountType === "JDCOEM_STUDENT" && (
                <>
                  <div className="w-5 h-5 rounded-md bg-[#17458F]/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-3.5 h-3.5 text-[#17458F]" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800">JDCOEM Student</span>
                    <span className="text-[10px] text-slate-400 font-medium ml-1.5 hidden sm:inline">(College Account)</span>
                  </div>
                </>
              )}
              {accountType === "FACULTY" && (
                <>
                  <div className="w-5 h-5 rounded-md bg-[#E78023]/10 flex items-center justify-center shrink-0">
                    <School className="w-3.5 h-3.5 text-[#E78023]" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800">Faculty &amp; Staff</span>
                    <span className="text-[10px] text-amber-600 font-medium ml-1.5 hidden sm:inline">(Accredited Staff)</span>
                  </div>
                </>
              )}
              {accountType === "EXTERNAL_STUDENT" && (
                <>
                  <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800">Other College Student</span>
                    <span className="text-[10px] text-emerald-600 font-medium ml-1.5 hidden sm:inline">(Open Delegate)</span>
                  </div>
                </>
              )}
            </div>
            
            <button
              type="button"
              onClick={() => setIsChangingRole(true)}
              className="text-[11px] font-bold text-[#17458F] hover:text-[#123673] hover:underline cursor-pointer transition-colors shrink-0 ml-2"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-1.5 p-2 rounded-xl bg-slate-100/90 border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-500">
              <span>Choose your account type:</span>
              <button
                type="button"
                onClick={() => setIsChangingRole(false)}
                className="text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setAccountType("JDCOEM_STUDENT");
                  setError(null);
                  setIsChangingRole(false);
                }}
                className={cn(
                  "py-2 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[38px]",
                  accountType === "JDCOEM_STUDENT"
                    ? "bg-white text-[#17458F] shadow-xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900 bg-transparent"
                )}
              >
                <GraduationCap className={cn("w-3.5 h-3.5 shrink-0", accountType === "JDCOEM_STUDENT" ? "text-[#17458F]" : "text-slate-400")} />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAccountType("FACULTY");
                  setError(null);
                  setIsChangingRole(false);
                }}
                className={cn(
                  "py-2 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[38px]",
                  accountType === "FACULTY"
                    ? "bg-white text-[#17458F] shadow-xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900 bg-transparent"
                )}
              >
                <School className={cn("w-3.5 h-3.5 shrink-0", accountType === "FACULTY" ? "text-[#E78023]" : "text-slate-400")} />
                <span className="truncate">Faculty</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAccountType("EXTERNAL_STUDENT");
                  setError(null);
                  setIsChangingRole(false);
                }}
                className={cn(
                  "py-2 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[38px]",
                  accountType === "EXTERNAL_STUDENT"
                    ? "bg-white text-[#17458F] shadow-xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900 bg-transparent"
                )}
              >
                <Globe className={cn("w-3.5 h-3.5 shrink-0", accountType === "EXTERNAL_STUDENT" ? "text-emerald-600" : "text-slate-400")} />
                <span className="truncate">Other College</span>
              </button>
            </div>
          </div>
        )}

        {/* Account Deletion Confirmation Dialog */}
        {showDeleteConfirm ? (
          <div className="p-5 rounded-2xl bg-rose-50/90 border border-rose-200 space-y-4 animate-in fade-in">
            <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-center">
              <h4 className="font-heading font-extrabold text-base text-rose-950">
                Permanently Delete Account?
              </h4>
              <p className="text-xs text-rose-700 font-medium max-w-sm mx-auto">
                Are you sure you want to permanently delete your account (<strong>{user?.email}</strong>)? This action cannot be reversed.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full sm:w-1/2 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer text-center"
              >
                Cancel &amp; Keep Account
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAccount}
                className="w-full sm:w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? "Deleting..." : "Permanently Delete"}</span>
              </button>
            </div>
          </div>
        ) : showFacultyPendingNotice ? (
          <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 text-center space-y-3.5 animate-in fade-in">
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="font-heading font-extrabold text-base text-slate-900">
                Verification Request Sent
              </h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-sm mx-auto">
                Thank you, <strong>{title} {firstName} {lastName}</strong>. Your faculty profile has been created and submitted to the <strong>SRC Admin Council</strong> for verification.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setShowFacultyPendingNotice(false);
                closeProfileModal();
              }}
              className="w-full justify-center"
            >
              Continue to Portal
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-start gap-2 shadow-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-rose-700">{error}</p>
              </div>
            )}

            {/* Live Detected Council Designation Banner for JDCOEM Students */}
            {accountType === "JDCOEM_STUDENT" && detectedDesignation && btIdAvailability.available && (
              <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <Award className="w-4 h-4 text-[#E78023] shrink-0" />
                <span className="truncate">
                  <strong className="text-[#E78023]">Council Appointment:</strong> {detectedDesignation}
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
              
              {/* -------------------------------------------------------- */}
              {/* SECTION A: JDCOEM STUDENT SPECIFIC FIELDS               */}
              {/* -------------------------------------------------------- */}
              {accountType === "JDCOEM_STUDENT" && (
                <>
                  {/* First & Last Name (2 cols on desktop, 1 on mobile) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Harsh"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Shende"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                      />
                    </div>
                  </div>

                  {/* College BT ID (Full width) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">
                        College BT ID <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {btIdAvailability.checking && (
                          <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3 text-[#E78023]" />
                            <span>Checking...</span>
                          </span>
                        )}
                        {!btIdAvailability.checking && btId.trim().length >= 3 && btIdAvailability.available && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Available</span>
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">Format: BT22CSE045</span>
                      </div>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BT22CSE045"
                      value={btId}
                      onChange={(e) => handleBtIdChange(e.target.value)}
                      onBlur={handleBtIdBlur}
                      className={cn(
                        "w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider focus:outline-none transition-all min-h-[44px]",
                        !btIdAvailability.available
                          ? "bg-rose-50/50 border-rose-300 text-rose-700 focus:border-rose-500 ring-2 ring-rose-500/10"
                          : "bg-slate-50/80 border-slate-200 text-[#E78023] focus:bg-white focus:border-[#17458F]"
                      )}
                    />

                    {/* Conflict card if BT ID already linked to another Google account */}
                    {!btIdAvailability.available && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2 animate-in fade-in">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-0.5">
                            <p className="font-bold text-rose-800">College ID Already Linked</p>
                            <p className="text-[11px] leading-relaxed text-rose-700">
                              {btIdAvailability.isCouncilOwnerMismatch ? (
                                <>
                                  College ID <strong className="font-mono">{btId}</strong> is reserved for Student Council official{" "}
                                  <strong>{btIdAvailability.linkedName || "Council Officer"}</strong>. It can only be activated with their official email{" "}
                                  <strong className="font-mono">{maskEmail(btIdAvailability.linkedEmail || "")}</strong>.
                                </>
                              ) : (
                                <>
                                  College ID <strong className="font-mono">{btId}</strong> is already linked to another account (
                                  <strong className="font-mono">{maskEmail(btIdAvailability.linkedEmail || "")}</strong>).
                                  Each student BT ID can only be bound to one Google account.
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-rose-200/60 text-[11px]">
                          <span className="text-rose-700 font-medium">Wrong Google account?</span>
                          <button
                            type="button"
                            onClick={async () => {
                              await logout();
                              closeProfileModal();
                            }}
                            className="inline-flex items-center gap-1 font-bold text-rose-700 hover:text-rose-900 hover:underline cursor-pointer"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Sign Out &amp; Switch Account</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Department & Year (2 cols on desktop, 1 on mobile) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                    {/* Department Selector */}
                    <div ref={deptDropdownRef} className="space-y-1 relative">
                      <label className="text-xs font-semibold text-slate-700">
                        Department <span className="text-rose-500">*</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setIsDeptDropdownOpen(!isDeptDropdownOpen);
                          setIsYearDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full px-3.5 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer min-h-[44px]",
                          isDeptDropdownOpen
                            ? "bg-white border-[#17458F] ring-2 ring-[#17458F]/15"
                            : department
                            ? "bg-slate-50/80 border-slate-300 text-slate-900 hover:border-slate-400"
                            : "bg-slate-50/80 border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-white"
                        )}
                        aria-haspopup="listbox"
                        aria-expanded={isDeptDropdownOpen}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {department ? (
                            <>
                              {/* Mobile: Short code as primary */}
                              <span className="sm:hidden font-extrabold text-slate-900 text-xs">
                                {getDepartmentShortName(department) || department}
                              </span>
                              {/* Desktop: Full Department name */}
                              <span className="hidden sm:inline font-semibold text-slate-900 truncate">
                                {department}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400 font-normal">Select Department...</span>
                          )}
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200", isDeptDropdownOpen && "rotate-180 text-[#17458F]")} />
                      </button>

                      {isDeptDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Search (e.g. CSE, AI, IT)..."
                                value={deptSearchTerm}
                                onChange={(e) => setDeptSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#17458F]"
                                autoFocus
                              />
                            </div>
                          </div>

                          <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5" role="listbox">
                            {filteredDepartments.length === 0 ? (
                              <p className="p-3 text-center text-xs text-slate-400">No departments matching &quot;{deptSearchTerm}&quot;</p>
                            ) : (
                              filteredDepartments.map((dept) => {
                                const isSelected = department === dept;
                                const shortCode = getDepartmentShortName(dept);
                                return (
                                  <button
                                    key={dept}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                      setDepartment(dept);
                                      setIsDeptDropdownOpen(false);
                                      setDeptSearchTerm("");
                                      setError(null);
                                    }}
                                    className={cn(
                                      "w-full px-2.5 py-2 rounded-xl text-left text-xs font-medium transition-all flex items-center justify-between gap-2 cursor-pointer",
                                      isSelected
                                        ? "bg-[#17458F] text-white shadow-xs font-semibold"
                                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                    )}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0",
                                        isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-[#17458F]"
                                      )}>
                                        {shortCode || "DEPT"}
                                      </span>
                                      <span className="truncate">{dept}</span>
                                    </div>
                                    {isSelected && (
                                      <Check className="w-3.5 h-3.5 text-white shrink-0" />
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Year Selector */}
                    <div ref={yearDropdownRef} className="space-y-1 relative">
                      <label className="text-xs font-semibold text-slate-700">
                        <span className="sm:hidden">Year</span>
                        <span className="hidden sm:inline">Year of Study</span>
                        {" "}<span className="text-rose-500">*</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setIsYearDropdownOpen(!isYearDropdownOpen);
                          setIsDeptDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full px-3.5 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer min-h-[44px]",
                          isYearDropdownOpen
                            ? "bg-white border-[#17458F] ring-2 ring-[#17458F]/15"
                            : year
                            ? "bg-slate-50/80 border-slate-300 text-slate-900 hover:border-slate-400"
                            : "bg-slate-50/80 border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-white"
                        )}
                        aria-haspopup="listbox"
                        aria-expanded={isYearDropdownOpen}
                      >
                        <span className={year ? "font-semibold text-slate-900 truncate" : "text-slate-400 font-normal"}>
                          {year || "Select Year..."}
                        </span>
                        <ChevronDown className={cn("w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200", isYearDropdownOpen && "rotate-180 text-[#17458F]")} />
                      </button>

                      {isYearDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-1.5 space-y-0.5 max-h-52 overflow-y-auto" role="listbox">
                          {STUDY_YEARS.map((yr) => {
                            const isSelected = year === yr;
                            return (
                              <button
                                key={yr}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setYear(yr);
                                  setIsYearDropdownOpen(false);
                                  setError(null);
                                }}
                                className={cn(
                                  "w-full px-2.5 py-2 rounded-xl text-left text-xs font-medium transition-all flex items-center justify-between gap-2 cursor-pointer",
                                  isSelected
                                    ? "bg-[#17458F] text-white shadow-xs font-semibold"
                                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                                )}
                              >
                                <span className="truncate">{yr}</span>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-white shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WhatsApp Contact Number */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      WhatsApp Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      placeholder="e.g. 9823011223"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                    />
                  </div>
                </>
              )}

              {/* -------------------------------------------------------- */}
              {/* SECTION B: FACULTY / STAFF SPECIFIC FIELDS             */}
              {/* -------------------------------------------------------- */}
              {accountType === "FACULTY" && (
                <div className="space-y-3">
                  {/* Academic Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Academic Title <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {FACULTY_TITLES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTitle(t)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                            title === t
                              ? "bg-[#17458F] text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* First & Last Name (2 cols on desktop) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rajesh"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sharma"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                      />
                    </div>
                  </div>

                  {/* Designation & Department (2 cols on desktop) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Designation <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={facultyDesignation}
                        onChange={(e) => setFacultyDesignation(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] min-h-[44px]"
                      >
                        {FACULTY_DESIGNATIONS.map((desig) => (
                          <option key={desig} value={desig}>
                            {desig}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Department <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={facultyDepartment}
                        onChange={(e) => setFacultyDepartment(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] min-h-[44px]"
                      >
                        {departmentsList.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Staff ID & WhatsApp Number (2 cols on desktop) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Staff / Employee ID <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. EMP-1024"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        WhatsApp Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        required
                        placeholder="e.g. 9823011223"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-700 bg-amber-50/80 border border-amber-200/70 rounded-xl px-3 py-2 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#E78023] shrink-0" />
                    <span>Faculty registrations are reviewed by the SRC Admin Council.</span>
                  </p>
                </div>
              )}

              {/* -------------------------------------------------------- */}
              {/* SECTION C: EXTERNAL / OTHER COLLEGE STUDENT FIELDS     */}
              {/* -------------------------------------------------------- */}
              {accountType === "EXTERNAL_STUDENT" && (
                <div className="space-y-3">
                  {/* First & Last Name (2 cols on desktop) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ananya"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Verma"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                      />
                    </div>
                  </div>

                  {/* College Name & City (2 cols on desktop) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        College / University <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. VNIT, RCOEM, GHRCE..."
                        value={collegeName}
                        onChange={(e) => setCollegeName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        City <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Nagpur"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                      />
                    </div>
                  </div>

                  {/* Degree & Year (2 cols on desktop) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Degree / Course <span className="text-rose-500">*</span>
                      </label>
                      <SearchableDegreeSelect
                        value={degree}
                        onChange={setDegree}
                        placeholder="Search degree..."
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Year of Study <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={externalYear}
                        onChange={(e) => setExternalYear(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] min-h-[44px]"
                      >
                        <option value="">Select Year...</option>
                        {STUDY_YEARS.map((yr) => (
                          <option key={yr} value={yr}>
                            {yr}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* WhatsApp Number (Full width) */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      WhatsApp Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      placeholder="e.g. 9823011223"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#17458F] transition-all min-h-[44px]"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-1.5 space-y-1.5">
                <Button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  variant="primary"
                  size="md"
                  className={cn(
                    "w-full justify-center gap-2 font-bold min-h-[44px] transition-all",
                    !isFormValid || isSubmitting
                      ? "opacity-50 cursor-not-allowed shadow-none"
                      : "cursor-pointer bg-[#17458F] hover:bg-[#123673] text-white shadow-md shadow-[#17458F]/20"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {accountType === "FACULTY" ? "Submit Faculty Request" : "Complete Profile"}
                      </span>
                    </>
                  )}
                </Button>

                {accountType === "JDCOEM_STUDENT" && !btIdAvailability.available && (
                  <p className="text-[11px] text-rose-600 font-medium text-center">
                    This College BT ID is already bound to another Google account.
                  </p>
                )}
              </div>

              {/* Subtle footer */}
              {!user?.profileCompleted ? (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      closeProfileModal();
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-600 font-medium transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeProfileModal}
                    className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Account</span>
                  </button>
                </div>
              )}

            </form>
          </>
        )}

      </div>
    </Modal>
  );
}

