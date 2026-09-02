"use client";

import React, { useState, useEffect } from "react";
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
  HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

import { 
  getStoredDepartments, 
  DEFAULT_DEPARTMENTS 
} from "@/lib/departmentsStore";
import { 
  checkBtIdAvailability, 
  resolveDesignationByBtId, 
  maskEmail 
} from "@/lib/usersStore";

export const STUDY_YEARS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year / Final Year",
  "Postgraduate (MBA/MCA/M.Tech)",
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
  const { user, isProfileModalOpen, closeProfileModal, updateUserProfile } = useAuth();
  
  // Category Switcher: JDCOEM_STUDENT | FACULTY | EXTERNAL_STUDENT
  const [accountType, setAccountType] = useState<"JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT">("JDCOEM_STUDENT");

  const [departmentsList, setDepartmentsList] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  
  // JDCOEM Student Fields
  const [btId, setBtId] = useState("");
  const [department, setDepartment] = useState(DEFAULT_DEPARTMENTS[1]);
  const [year, setYear] = useState(STUDY_YEARS[2]);
  
  // Faculty Fields
  const [title, setTitle] = useState(FACULTY_TITLES[0]);
  const [facultyDesignation, setFacultyDesignation] = useState(FACULTY_DESIGNATIONS[0]);
  const [facultyDepartment, setFacultyDepartment] = useState(DEFAULT_DEPARTMENTS[1]);
  const [employeeId, setEmployeeId] = useState("");
  
  // External Student Fields
  const [collegeName, setCollegeName] = useState("");
  const [city, setCity] = useState("");
  const [customBranch, setCustomBranch] = useState("");
  const [externalYear, setExternalYear] = useState(STUDY_YEARS[2]);

  const [error, setError] = useState<string | null>(null);
  const [detectedDesignation, setDetectedDesignation] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFacultyPendingNotice, setShowFacultyPendingNotice] = useState(false);

  useEffect(() => {
    setDepartmentsList(getStoredDepartments());

    const handleDeptsUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setDepartmentsList(e.detail);
      } else {
        setDepartmentsList(getStoredDepartments());
      }
    };

    window.addEventListener("src_departments_updated", handleDeptsUpdate);
    return () => window.removeEventListener("src_departments_updated", handleDeptsUpdate);
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

      // Infer account type
      if (user.role === "FACULTY" || user.userType === "FACULTY") {
        setAccountType("FACULTY");
      } else if (user.userType === "EXTERNAL_STUDENT" || user.isCollegeStudent === false) {
        setAccountType("EXTERNAL_STUDENT");
      } else {
        setAccountType("JDCOEM_STUDENT");
      }

      if (user.btId) {
        setBtId(user.btId);
        const match = resolveDesignationByBtId(user.btId);
        if (match) setDetectedDesignation(match.designationBadge);
      }
      if (user.department) {
        setDepartment(user.department);
        setFacultyDepartment(user.department);
      }
      if (user.year) {
        setYear(user.year);
        setExternalYear(user.year);
      }
      if (user.phone) setPhone(user.phone);
      if (user.title) setTitle(user.title);
      if (user.facultyDesignation) setFacultyDesignation(user.facultyDesignation);
      if (user.employeeId) setEmployeeId(user.employeeId);
      if (user.collegeName) setCollegeName(user.collegeName);
      if (user.city) setCity(user.city);
      if (user.customBranch) setCustomBranch(user.customBranch);
    }
  }, [user]);

  // Live check on BT ID change for designation
  const handleBtIdChange = (val: string) => {
    const clean = val.toUpperCase().trim();
    setBtId(clean);
    setError(null);

    if (clean.length >= 3) {
      const match = resolveDesignationByBtId(clean);
      if (match) {
        setDetectedDesignation(match.designationBadge);
      } else {
        setDetectedDesignation(null);
      }
    } else {
      setDetectedDesignation(null);
    }
  };

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
      if (!cleanBtId) {
        setError("Please enter your official College BT ID (e.g. BT22CSE045).");
        return;
      }

      // Check BT ID Uniqueness
      const availability = checkBtIdAvailability(cleanBtId, user?.uid);
      if (!availability.available) {
        const masked = maskEmail(availability.linkedEmail || "");
        setError(
          `This BT ID (${cleanBtId}) is already linked to ${masked}. If this is your BT ID, please sign in with that Google account or contact the Student Council.`
        );
        return;
      }

      const designationInfo = resolveDesignationByBtId(cleanBtId);

      setIsSubmitting(true);
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
          profileCompleted: true,
          designationBadge: designationInfo ? designationInfo.designationBadge : undefined,
          isCouncilOfficer: designationInfo ? true : false,
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
      const cleanBranch = customBranch.trim();

      if (!cleanCollege) {
        setError("Please enter your College or University Name.");
        return;
      }
      if (!cleanCity) {
        setError("Please enter your City / Location.");
        return;
      }
      if (!cleanBranch) {
        setError("Please enter your Degree & Branch / Stream (e.g. B.Tech Computer Science).");
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
          customBranch: cleanBranch,
          department: `${cleanBranch} (${cleanCollege})`,
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

  return (
    <Modal
      isOpen={isProfileModalOpen}
      onClose={closeProfileModal}
      maxWidth="md"
      title=""
    >
      <div className="space-y-5 text-[#0F172A] py-1">
        
        {/* Header Banner */}
        <div className="text-center space-y-1.5 pb-2 border-b border-slate-100">
          <div className="relative mx-auto h-12 w-12 rounded-2xl bg-white p-1.5 border border-slate-200 shadow-sm flex items-center justify-center">
            <Image
              src="/assets/SRC Logo.png"
              alt="SRC Emblem"
              fill
              className="object-contain p-0.5"
            />
          </div>
          
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#E78023] flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>COLLEGIATE ACCREDITATION</span>
            </span>
            <h3 className="font-heading font-extrabold text-xl text-[#0F172A]">
              Complete Your Profile
            </h3>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
              Select your academic role to unlock verified event passes and access.
            </p>
          </div>
        </div>

        {/* 3-Way Category Selector */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-center">
          <button
            type="button"
            onClick={() => { setAccountType("JDCOEM_STUDENT"); setError(null); }}
            className={cn(
              "py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5",
              accountType === "JDCOEM_STUDENT"
                ? "bg-white text-[#17458F] shadow-sm font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <GraduationCap className="w-4 h-4 text-[#17458F]" />
            <span className="leading-tight">JDCOEM Student</span>
          </button>

          <button
            type="button"
            onClick={() => { setAccountType("FACULTY"); setError(null); }}
            className={cn(
              "py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5",
              accountType === "FACULTY"
                ? "bg-white text-[#17458F] shadow-sm font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <School className="w-4 h-4 text-[#E78023]" />
            <span className="leading-tight">Faculty / Staff</span>
          </button>

          <button
            type="button"
            onClick={() => { setAccountType("EXTERNAL_STUDENT"); setError(null); }}
            className={cn(
              "py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5",
              accountType === "EXTERNAL_STUDENT"
                ? "bg-white text-[#17458F] shadow-sm font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Globe className="w-4 h-4 text-emerald-600" />
            <span className="leading-tight">Other College</span>
          </button>
        </div>

        {/* Post-Faculty Submission Notice Modal Dialog */}
        {showFacultyPendingNotice ? (
          <div className="p-6 rounded-3xl bg-amber-50/80 border border-amber-200 text-center space-y-4 animate-in fade-in">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="font-heading font-extrabold text-lg text-slate-900">
                Verification Request Sent
              </h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-sm mx-auto">
                Thank you, <strong>{title} {firstName} {lastName}</strong>. Your faculty profile has been created and submitted to the <strong>SRC Admin Council</strong> for verification.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white border border-amber-200 text-[11px] text-amber-900 font-semibold text-left space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-[#E78023]" />
                <span>Next Steps:</span>
              </div>
              <p className="text-slate-600 leading-snug">
                You can browse public events and fests immediately. Once approved by the council administrator, your verified Faculty VIP accreditation will be activated.
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
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-start gap-2 shadow-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-rose-800">Verification Notice</p>
                  <p className="text-[11px] leading-relaxed text-rose-700">{error}</p>
                </div>
              </div>
            )}

            {/* Live Detected Council Designation Banner for JDCOEM Students */}
            {accountType === "JDCOEM_STUDENT" && detectedDesignation && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2.5 shadow-xs animate-in fade-in">
                <Award className="w-5 h-5 text-[#E78023] shrink-0" />
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#E78023] tracking-wider">Council Appointment Recognized</p>
                  <p className="font-bold text-slate-900">{detectedDesignation}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              
              {/* Faculty Title (Only for Faculty) */}
              {accountType === "FACULTY" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Academic Title <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FACULTY_TITLES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTitle(t)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                          title === t
                            ? "bg-[#17458F] text-white shadow-xs"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* First & Last Name (All Roles) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#E78023]" />
                    <span>First Name <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Harsh"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#E78023]" />
                    <span>Last Name <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shende"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>
              </div>

              {/* -------------------------------------------------------- */}
              {/* SECTION A: JDCOEM STUDENT SPECIFIC FIELDS               */}
              {/* -------------------------------------------------------- */}
              {accountType === "JDCOEM_STUDENT" && (
                <>
                  {/* BT ID */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-[#17458F]" />
                        <span>JDCOEM BT ID (College ID) <span className="text-rose-500">*</span></span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">Format: BT22CSE045</span>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BT22CSE045"
                      value={btId}
                      onChange={(e) => handleBtIdChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-[#E78023] uppercase tracking-wider focus:outline-none focus:border-[#17458F]"
                    />
                    <p className="text-[10px] text-slate-400">
                      Bound permanently to your Google account for student council ballots and voting.
                    </p>
                  </div>

                  {/* Department */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#E78023]" />
                      <span>JDCOEM Department <span className="text-rose-500">*</span></span>
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                    >
                      {departmentsList.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Year of Study */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-[#17458F]" />
                      <span>Year of Study <span className="text-rose-500">*</span></span>
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                    >
                      {STUDY_YEARS.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* -------------------------------------------------------- */}
              {/* SECTION B: FACULTY / STAFF SPECIFIC FIELDS             */}
              {/* -------------------------------------------------------- */}
              {accountType === "FACULTY" && (
                <>
                  {/* Academic Designation */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-[#E78023]" />
                      <span>Academic Designation <span className="text-rose-500">*</span></span>
                    </label>
                    <select
                      value={facultyDesignation}
                      onChange={(e) => setFacultyDesignation(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                    >
                      {FACULTY_DESIGNATIONS.map((desig) => (
                        <option key={desig} value={desig}>
                          {desig}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Faculty Department */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#17458F]" />
                      <span>Faculty Department / School <span className="text-rose-500">*</span></span>
                    </label>
                    <select
                      value={facultyDepartment}
                      onChange={(e) => setFacultyDepartment(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                    >
                      {departmentsList.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Staff / Employee ID (Optional) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                        <span>Employee / Staff ID (Optional)</span>
                      </label>
                      <span className="text-[10px] text-slate-400">No BT ID Required</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. EMP-1024 or JDC-FAC-04"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                    />
                  </div>

                  {/* Admin Approval Notice Banner */}
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#E78023] shrink-0" />
                    <span>Faculty registrations are sent to the SRC Admin Console for verification.</span>
                  </div>
                </>
              )}

              {/* -------------------------------------------------------- */}
              {/* SECTION C: EXTERNAL / OTHER COLLEGE STUDENT FIELDS     */}
              {/* -------------------------------------------------------- */}
              {accountType === "EXTERNAL_STUDENT" && (
                <>
                  {/* College Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-[#17458F]" />
                      <span>College / University Name <span className="text-rose-500">*</span></span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. VNIT Nagpur, RCOEM, GHRCE, YCCE..."
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                    />
                  </div>

                  {/* City & Branch 2-Col Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>City / Location <span className="text-rose-500">*</span></span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Nagpur, Pune, Mumbai"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#17458F]" />
                        <span>Degree & Branch <span className="text-rose-500">*</span></span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. B.Tech CSE, B.Sc, MCA"
                        value={customBranch}
                        onChange={(e) => setCustomBranch(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                      />
                    </div>
                  </div>

                  {/* Year of Study */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Current Year of Study <span className="text-rose-500">*</span></span>
                    </label>
                    <select
                      value={externalYear}
                      onChange={(e) => setExternalYear(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                    >
                      {STUDY_YEARS.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Instant access: Register for open competitions, hackathons, and cultural fests.</span>
                  </div>
                </>
              )}

              {/* WhatsApp Contact Number (All Roles) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <span>WhatsApp Contact Number</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9823011223"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="primary"
                  size="md"
                  className="w-full justify-center gap-2 cursor-pointer shadow-md shadow-[#E78023]/25"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? "Saving Profile..."
                      : accountType === "FACULTY"
                      ? "Submit Faculty Request"
                      : "Save & Complete Profile"}
                  </span>
                </Button>
              </div>

              {user?.profileCompleted && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={closeProfileModal}
                    className="text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                  >
                    Close without changes
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

