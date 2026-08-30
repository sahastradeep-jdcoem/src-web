"use client";

import React, { useState, useEffect } from "react";
import { EventItem } from "@/types";
import { TicketPass } from "@/components/registration/TicketPass";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { saveRegistrationToFirestore } from "@/lib/firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { 
  User, 
  Mail, 
  Phone, 
  GraduationCap, 
  Users, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  Sparkles, 
  Plus, 
  Trash2,
  Hash
} from "lucide-react";
import confetti from "canvas-confetti";

import { 
  getStoredDepartments, 
  DEFAULT_DEPARTMENTS 
} from "@/lib/departmentsStore";

interface RegistrationWizardProps {
  event: EventItem;
}

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export function RegistrationWizard({ event }: RegistrationWizardProps) {
  const { user } = useAuth();
  const [departmentsList, setDepartmentsList] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    setDepartmentsList(getStoredDepartments());
    const handleUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setDepartmentsList(e.detail);
      } else {
        setDepartmentsList(getStoredDepartments());
      }
    };
    window.addEventListener("src_departments_updated", handleUpdate);
    return () => window.removeEventListener("src_departments_updated", handleUpdate);
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    fullName: user?.displayName || "Aryan Sharma",
    email: user?.email || "aryan.sharma@jdcoem.ac.in",
    btId: user?.btId || "BT22CSE045",
    phone: user?.phone || "+91 98230 11223",
    department: user?.department || DEFAULT_DEPARTMENTS[1],
    year: user?.year || YEARS[2],
    teamType: (event.teamType === "Team" ? "Team" : "Individual") as "Individual" | "Team",
    teamName: "Phantom Protocol",
    teamMembers: ["Aryan Sharma", "Rohan Verma", "Sneha Patil"],
  });

  const [newMemberName, setNewMemberName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedTicket, setGeneratedTicket] = useState<{
    registrationId: string;
    ticketCode: string;
  } | null>(null);

  const handleAddMember = () => {
    if (newMemberName.trim()) {
      setFormData((prev) => ({
        ...prev,
        teamMembers: [...prev.teamMembers, newMemberName.trim()],
      }));
      setNewMemberName("");
    }
  };

  const handleRemoveMember = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.filter((_, i) => i !== index),
    }));
  };

  const handleConfirmRegistration = async () => {
    setIsSubmitting(true);
    const regId = `SRC-${event.slug.slice(0, 3).toUpperCase()}-26-${Math.floor(10000 + Math.random() * 90000)}`;
    const tkCode = `${event.slug.slice(0, 3).toUpperCase()}26-TK-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      await saveRegistrationToFirestore({
        id: regId,
        eventId: event.id,
        eventTitle: event.name,
        leaderName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        college: "JD College of Engineering & Management",
        department: formData.department,
        year: formData.year,
        btId: formData.btId,
        teamSize: formData.teamType === "Team" ? formData.teamMembers.length : 1,
        teamName: formData.teamType === "Team" ? formData.teamName : undefined,
        qrPayload: `SRC:JDCOEM:${regId}:${tkCode}:${event.id}`,
      });
    } catch (e) {
      console.warn("Firestore registration save fallback handled", e);
    }

    setTimeout(() => {
      setGeneratedTicket({
        registrationId: regId,
        ticketCode: tkCode,
      });
      setIsSubmitting(false);
      setCurrentStep(4);

      // Fire celebratory confetti!
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#E78023", "#17458F", "#FFFFFF", "#3D406B"],
        });
      } catch (e) {
        // Ignore if confetti is unsupported
      }
    }, 600);
  };

  const steps = [
    { number: 1, title: "01 DETAILS" },
    { number: 2, title: "02 PARTICIPATION" },
    { number: 3, title: "03 REVIEW" },
    { number: 4, title: "04 DONE" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      
      {/* Progress Stepper Bar */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        {steps.map((step) => {
          const isActive = currentStep === step.number;
          const isCompleted = currentStep > step.number;

          return (
            <div
              key={step.number}
              className={`relative p-3 sm:p-4 rounded-2xl border transition-all ${
                isActive
                  ? "bg-[#17458F] border-[#E78023] text-white shadow-md"
                  : isCompleted
                  ? "bg-white border-slate-200 text-slate-800"
                  : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  {step.title}
                </span>
                {isCompleted && (
                  <div className="h-4 w-4 rounded-full bg-[#E78023] text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* STEP 1: PARTICIPANT DETAILS */}
      {currentStep === 1 && (
        <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-10 space-y-8 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
              Step 01 of 03
            </span>
            <h3 className="font-extrabold text-2xl text-[#17458F] uppercase mt-1">
              PRIMARY PARTICIPANT INFORMATION
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Enter your credentials for verified college accreditation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Full Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#E78023]" />
                <span>Full Name *</span>
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. Aryan Sharma"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* BT ID (Replaced Roll No) */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-[#17458F]" />
                <span>College BT ID *</span>
              </label>
              <input
                type="text"
                required
                value={formData.btId}
                onChange={(e) => setFormData({ ...formData, btId: e.target.value.toUpperCase() })}
                placeholder="e.g. BT22CSE045"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono font-bold uppercase focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#E78023]" />
                <span>College / Personal Email *</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="student@jdcoem.ac.in"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#E78023]" />
                <span>WhatsApp Contact Phone *</span>
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98230 11223"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Year */}
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#E78023]" />
                <span>Academic Year *</span>
              </label>
              <select
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
              >
                {YEARS.map((yr) => (
                  <option key={yr} value={yr} className="bg-white text-slate-900">
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="sm:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Department / Branch *
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
              >
                {departmentsList.map((dept) => (
                  <option key={dept} value={dept} className="bg-white text-slate-900">
                    {dept}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button
              onClick={() => setCurrentStep(2)}
              variant="primary"
              size="md"
              className="gap-2 cursor-pointer"
            >
              <span>Continue to Participation</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: PARTICIPATION FORMAT */}
      {currentStep === 2 && (
        <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-10 space-y-8 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
              Step 02 of 03
            </span>
            <h3 className="font-extrabold text-2xl text-[#17458F] uppercase mt-1">
              PARTICIPATION FORMAT & TEAM ROSTER
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Configure solo registration or team roster entry.
            </p>
          </div>

          <div className="space-y-6">
            
            {/* Format Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Entry Category
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, teamType: "Individual" })}
                  className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                    formData.teamType === "Individual"
                      ? "bg-[#17458F] border-[#E78023] text-white shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <User className="w-5 h-5 mx-auto mb-1" />
                  <span className="font-bold text-xs uppercase tracking-wider block">
                    Individual Entry
                  </span>
                  <span className="text-[11px] opacity-80">Single participant pass</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, teamType: "Team" })}
                  className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                    formData.teamType === "Team"
                      ? "bg-[#17458F] border-[#E78023] text-white shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-5 h-5 mx-auto mb-1" />
                  <span className="font-bold text-xs uppercase tracking-wider block">
                    Team Entry
                  </span>
                  <span className="text-[11px] opacity-80">Squad with multiple members</span>
                </button>
              </div>
            </div>

            {/* Team Specific Inputs */}
            {formData.teamType === "Team" && (
              <div className="space-y-6 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Team / Squad Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.teamName}
                    onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                    placeholder="e.g. Phantom Protocol"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                  />
                </div>

                {/* Team Members List */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Team Members ({formData.teamMembers.length})
                  </label>
                  
                  <div className="space-y-2">
                    {formData.teamMembers.map((member, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-xs text-[#E78023]">
                            0{idx + 1}
                          </span>
                          <span className="font-medium text-slate-800">{member}</span>
                          {idx === 0 && (
                            <Badge variant="navy" size="sm">
                              Team Leader
                            </Badge>
                          )}
                        </div>

                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Member Row */}
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="Add teammate full name..."
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                    />
                    <Button
                      type="button"
                      onClick={handleAddMember}
                      variant="secondary"
                      size="sm"
                      className="gap-1 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Button
              onClick={() => setCurrentStep(1)}
              variant="outline"
              size="md"
              className="gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>

            <Button
              onClick={() => setCurrentStep(3)}
              variant="primary"
              size="md"
              className="gap-2 cursor-pointer"
            >
              <span>Review Summary</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & CONFIRM */}
      {currentStep === 3 && (
        <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-10 space-y-8 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
              Step 03 of 03
            </span>
            <h3 className="font-extrabold text-2xl text-[#17458F] uppercase mt-1">
              REVIEW & CONFIRM REGISTRATION
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Please check your information before generating your official verified pass.
            </p>
          </div>

          {/* Review Card */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E78023]">
                  Selected Event
                </span>
                <h4 className="font-extrabold text-xl text-[#0F172A]">
                  {event.name}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {event.date} • {event.venue}
                </p>
              </div>
              <Badge variant="orange" size="md">
                {event.entryFee || "Free Entry"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-medium">
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  Participant Name
                </span>
                <p className="font-bold text-slate-900">{formData.fullName}</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  Email
                </span>
                <p className="font-semibold text-slate-800">{formData.email}</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  Contact Phone
                </span>
                <p className="font-semibold text-slate-800">{formData.phone}</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  Department
                </span>
                <p className="font-semibold text-slate-800">{formData.department}</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  Year
                </span>
                <p className="font-semibold text-slate-800">{formData.year}</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  Participation
                </span>
                <p className="font-bold text-[#17458F]">
                  {formData.teamType === "Team" ? formData.teamName : "Solo"}
                </p>
              </div>
            </div>

            {formData.teamType === "Team" && (
              <div className="pt-3 border-t border-slate-200 text-xs font-medium">
                <span className="text-[10px] text-slate-500 uppercase font-bold">
                  Team Members:
                </span>
                <p className="text-slate-700 mt-0.5">
                  {formData.teamMembers.join(" • ")}
                </p>
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1 font-medium">
            <p className="font-bold">Important Notice:</p>
            <p>
              By proceeding, you confirm all details provided are authentic. Your digital pass with QR verification will be issued immediately.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Button
              onClick={() => setCurrentStep(2)}
              variant="outline"
              size="md"
              className="gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>

            <Button
              onClick={handleConfirmRegistration}
              isLoading={isSubmitting}
              variant="primary"
              size="md"
              className="gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Official Pass</span>
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: PASS TICKET DISPLAY */}
      {currentStep === 4 && generatedTicket && (
        <TicketPass
          registrationId={generatedTicket.registrationId}
          eventName={event.name}
          eventDate={event.date}
          eventVenue={event.venue}
          participantName={formData.fullName}
          department={formData.department}
          year={formData.year}
          teamType={formData.teamType}
          teamName={formData.teamName}
          teamMembers={formData.teamType === "Team" ? formData.teamMembers : undefined}
          ticketCode={generatedTicket.ticketCode}
        />
      )}

    </div>
  );
}
