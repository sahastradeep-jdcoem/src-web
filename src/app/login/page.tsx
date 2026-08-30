"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already signed in, provide quick redirect
  if (user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white border border-slate-200 shadow-xl text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="font-heading font-extrabold text-2xl text-slate-900">
              Welcome back, {user.displayName}!
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Signed in as <strong className="text-[#17458F]">{user.email}</strong> ({user.role})
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => router.push(user.role === "COUNCIL_ADMIN" ? "/admin" : "/dashboard")}
              className="w-full justify-center gap-2"
            >
              <span>Go to {user.role === "COUNCIL_ADMIN" ? "Admin Console" : "Student Dashboard"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
              Return to Homepage &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message || "Google sign-in could not be completed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        
        {/* Left Side: Brand Story & Student Perks (5 cols) */}
        <div className="md:col-span-5 space-y-6">
          <div className="space-y-2">
            <Badge variant="orange" size="sm">
              JDCOEM STUDENT PORTAL
            </Badge>
            <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#0F172A] leading-tight">
              One Google Login.<br />
              <span className="text-[#17458F]">All 12 Clubs & Flagship Fests.</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
              Authenticate with your official college Google account to unlock fast-track event accreditation and verified passes.
            </p>
          </div>

          <div className="space-y-3.5 pt-2">
            {[
              { title: "Instant QR Delegate Passes", desc: "Downloadable high-res pass image directly to phone gallery." },
              { title: "Single-Click Event Registration", desc: "Auto-fills your BT ID, department, year, and team credentials." },
              { title: "Council Voting & Accreditation", desc: "Participate in student elections and official council voting ballots." },
            ].map((perk, i) => (
              <div key={i} className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <div className="h-6 w-6 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">{perk.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-snug">{perk.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Auth Card (7 cols) */}
        <div className="md:col-span-7">
          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6">
            
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="relative h-12 w-12 rounded-xl bg-white p-1 border border-slate-200 shadow-xs shrink-0">
                <Image
                  src="/assets/SRC Logo.png"
                  alt="SRC Emblem"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#E78023]">
                  SAHASTRADEEP PORTAL
                </span>
                <h3 className="font-heading font-bold text-xl text-slate-900">
                  Student & Council Sign In
                </h3>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 1-Click Google Sign In */}
            <div className="space-y-4 pt-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-4 px-4 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-[#17458F] text-slate-800 text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-3 cursor-pointer group hover:scale-[1.01] active:scale-[0.99]"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                <span>{isSubmitting ? "Signing In with Google..." : "Continue with Google (@jdcoem.ac.in)"}</span>
              </button>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1.5">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#17458F]">
                  <ShieldCheck className="w-4 h-4 text-[#E78023]" />
                  <span>Official Institutional Google OAuth</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Sign in with your official @jdcoem.ac.in account or personal Google account. First-time users will be prompted to enter their BT ID, Department, and Year of Study.
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
