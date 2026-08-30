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
  Lock
} from "lucide-react";

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
  "Postgraduate (MBA/MCA)",
  "Faculty / Alumni",
];

export function ProfileSetupModal() {
  const { user, isProfileModalOpen, closeProfileModal, updateUserProfile } = useAuth();
  
  const [departmentsList, setDepartmentsList] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [btId, setBtId] = useState("");
  const [department, setDepartment] = useState(DEFAULT_DEPARTMENTS[1]);
  const [year, setYear] = useState(STUDY_YEARS[2]);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detectedDesignation, setDetectedDesignation] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      if (user.btId) {
        setBtId(user.btId);
        const match = resolveDesignationByBtId(user.btId);
        if (match) setDetectedDesignation(match.designationBadge);
      }
      if (user.department) setDepartment(user.department);
      if (user.year) setYear(user.year);
      if (user.phone) setPhone(user.phone);
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
    const cleanBtId = btId.trim().toUpperCase();

    if (!cleanFirst || !cleanLast) {
      setError("Please enter both your First Name and Last Name.");
      return;
    }

    if (!cleanBtId) {
      setError("Please enter your official College BT ID (e.g. BT22CSE045).");
      return;
    }

    // 1. Uniqueness check: Is this BT ID already linked to another email?
    const availability = checkBtIdAvailability(cleanBtId, user?.uid);
    if (!availability.available) {
      const masked = maskEmail(availability.linkedEmail || "");
      setError(
        `This BT ID (${cleanBtId}) is already linked to ${masked}. If this is your BT ID, please sign in with that Google account or contact the Student Council.`
      );
      return;
    }

    // 2. Resolve designation badge
    const designationInfo = resolveDesignationByBtId(cleanBtId);

    setIsSubmitting(true);
    try {
      await updateUserProfile({
        firstName: cleanFirst,
        lastName: cleanLast,
        displayName: `${cleanFirst} ${cleanLast}`,
        btId: cleanBtId,
        department,
        year,
        phone: phone.trim(),
        profileCompleted: true,
        designationBadge: designationInfo ? designationInfo.designationBadge : undefined,
        isCouncilOfficer: designationInfo ? true : false,
        role: user?.role || "STUDENT",
      });
      closeProfileModal();
    } catch (err: any) {
      setError(err?.message || "Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isProfileModalOpen}
      onClose={closeProfileModal}
      maxWidth="md"
      title=""
    >
      <div className="space-y-6 text-[#0F172A]">
        
        {/* Header Banner */}
        <div className="text-center space-y-2 pb-2 border-b border-slate-100">
          <div className="relative mx-auto h-14 w-14 rounded-2xl bg-white p-2 border border-slate-200 shadow-sm flex items-center justify-center">
            <Image
              src="/assets/SRC Logo.png"
              alt="SRC Emblem"
              fill
              className="object-contain p-1"
            />
          </div>
          
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#E78023] flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>COLLEGIATE ACCREDITATION</span>
            </span>
            <h3 className="font-heading font-extrabold text-2xl text-[#0F172A]">
              Complete Your Student Profile
            </h3>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
              Your BT ID acts as your unique student ID. It verifies your enrollment, passes, and attached council badges.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-start gap-2.5 shadow-xs">
            <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-rose-800">BT ID Conflict</p>
              <p className="text-[11px] leading-relaxed text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* Live Detected Council Designation Banner */}
        {detectedDesignation && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2.5 shadow-xs animate-in fade-in">
            <Award className="w-5 h-5 text-[#E78023] shrink-0" />
            <div>
              <p className="text-[10px] uppercase font-bold text-[#E78023] tracking-wider">Official Appointment Recognized</p>
              <p className="font-bold text-slate-900">{detectedDesignation}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* First & Last Name */}
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

          {/* BT ID (Acts as Username & Unique Identifier) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-[#17458F]" />
                <span>College BT ID (Unique Username) <span className="text-rose-500">*</span></span>
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
              Each BT ID is permanently bound to one Google account. Council appointments and club badges link to this BT ID.
            </p>
          </div>

          {/* Department / Branch */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#E78023]" />
              <span>Department / Branch <span className="text-rose-500">*</span></span>
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

          {/* WhatsApp / Phone (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              WhatsApp Contact Number (Optional)
            </label>
            <input
              type="tel"
              placeholder="+91 98230 11223"
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
              <span>{isSubmitting ? "Verifying & Saving..." : "Save & Complete Profile"}</span>
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

      </div>
    </Modal>
  );
}
