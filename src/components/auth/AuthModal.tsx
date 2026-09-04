"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { 
  Sparkles, 
  AlertCircle,
  ShieldCheck,
  GraduationCap,
  School,
  Globe,
  ArrowRight,
  ArrowLeft,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

type UserRoleOption = "JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT";

const ROLE_OPTIONS: {
  id: UserRoleOption;
  title: string;
  badge: string;
  description: string;
  icon: typeof GraduationCap;
  accentBorder: string;
  accentBg: string;
  badgeColor: string;
}[] = [
  {
    id: "JDCOEM_STUDENT",
    title: "JDCOEM Student",
    badge: "Official BT ID",
    description: "Enrolled student at JD College of Engineering & Management with a valid BT ID.",
    icon: GraduationCap,
    accentBorder: "hover:border-[#17458F] border-slate-200",
    accentBg: "bg-blue-50/60 text-[#17458F]",
    badgeColor: "bg-blue-100 text-[#17458F]",
  },
  {
    id: "FACULTY",
    title: "Academic Faculty & Staff",
    badge: "VIP Accreditation",
    description: "Professor, Assistant Professor, HOD, Dean, or Staff member of JDCOEM.",
    icon: School,
    accentBorder: "hover:border-[#E78023] border-slate-200",
    accentBg: "bg-amber-50/60 text-[#E78023]",
    badgeColor: "bg-amber-100 text-amber-800",
  },
  {
    id: "EXTERNAL_STUDENT",
    title: "Other College / Visiting Delegate",
    badge: "Open Competitor",
    description: "Student from any other college or university participating in fests & competitions.",
    icon: Globe,
    accentBorder: "hover:border-emerald-600 border-slate-200",
    accentBg: "bg-emerald-50/60 text-emerald-700",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
];

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, loginWithGoogle, pendingUserType, setPendingUserType } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRoleOption | null>(pendingUserType || "JDCOEM_STUDENT");
  const [step, setStep] = useState<"SELECT_ROLE" | "GOOGLE_SIGNIN">("SELECT_ROLE");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSelectRole = (roleId: UserRoleOption) => {
    setSelectedRole(roleId);
    setPendingUserType(roleId);
    setError(null);
    setStep("GOOGLE_SIGNIN");
  };

  const handleGoogleSignIn = async () => {
    if (!selectedRole) {
      setError("Please select your account type first.");
      setStep("SELECT_ROLE");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle(selectedRole);
    } catch (e: any) {
      setError(e.message || "Google sign-in could not be completed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentRoleConfig = ROLE_OPTIONS.find((r) => r.id === selectedRole);

  return (
    <Modal
      isOpen={isAuthModalOpen}
      onClose={closeAuthModal}
      maxWidth="md"
      contentClassName="p-4 sm:p-5 sm:px-6"
    >
      <div className="space-y-3 sm:space-y-3.5 text-[#0F172A]">
        
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <div className="relative mx-auto h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-white p-1 border border-slate-200 shadow-xs flex items-center justify-center">
            <Image
              src="/assets/SRC Logo.png"
              alt="SRC Emblem"
              fill
              className="object-contain p-0.5"
            />
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#E78023] flex items-center justify-center gap-1">
              <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>SAHASTRADEEP PORTAL</span>
            </span>
            <h3 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] leading-tight">
              {step === "SELECT_ROLE" ? "Select Account Type" : "Sahastradeep Sign In"}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium max-w-xs mx-auto leading-tight">
              {step === "SELECT_ROLE" 
                ? "Please tell us who you are before continuing to sign in." 
                : "Sign in with your Google account to access your student portal."}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: ROLE SELECTION */}
        {step === "SELECT_ROLE" && (
          <div className="space-y-2 pt-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-0.5">
              Choose your role to proceed:
            </p>
            <div className="grid grid-cols-1 gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const IconComponent = opt.icon;
                const isSelected = selectedRole === opt.id;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectRole(opt.id)}
                    className={cn(
                      "py-2.5 px-3 sm:py-2.5 sm:px-3.5 rounded-xl sm:rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 group",
                      isSelected 
                        ? "border-[#17458F] bg-blue-50/30 shadow-xs" 
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "h-9 w-9 sm:h-9.5 sm:w-9.5 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                      opt.accentBg
                    )}>
                      <IconComponent className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-heading font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-[#17458F] transition-colors">
                          {opt.title}
                        </span>
                        <span className={cn("text-[8.5px] sm:text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0", opt.badgeColor)}>
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-snug mt-0.5">
                        {opt.description}
                      </p>
                    </div>

                    <div className="text-slate-300 group-hover:text-[#17458F] self-center transition-colors shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-1 text-center">
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
                You will be prompted to complete required details after Google sign-in.
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: GOOGLE SIGN IN */}
        {step === "GOOGLE_SIGNIN" && currentRoleConfig && (
          <div className="space-y-3 pt-0.5">
            
            {/* Selected Role Ribbon */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", currentRoleConfig.accentBg)}>
                  <currentRoleConfig.icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    Signing in as:
                  </span>
                  <span className="text-xs font-extrabold text-slate-900 truncate block">
                    {currentRoleConfig.title}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep("SELECT_ROLE")}
                className="text-xs font-bold text-[#17458F] hover:underline shrink-0 cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Change</span>
              </button>
            </div>

            {/* 1-Click Google Sign-In */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-[#17458F] text-slate-800 text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center justify-center gap-3 cursor-pointer group hover:scale-[1.01] active:scale-[0.99]"
              >
                {/* Google Color G SVG */}
                <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="truncate">
                  {isSubmitting ? "Signing In..." : "Continue with Google"}
                </span>
              </button>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10.5px] font-bold text-[#17458F]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Mandatory Profile Completion Required</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">
                  After Google authentication, you will be prompted to enter your academic credentials before accessing event passes.
                </p>
              </div>

              <div className="text-center pt-0.5">
                <button
                  type="button"
                  onClick={() => setStep("SELECT_ROLE")}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                >
                  ← Back to role selection
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </Modal>
  );
}
