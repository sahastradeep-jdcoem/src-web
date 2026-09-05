"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Monitor, 
  ArrowRight, 
  Home, 
  Smartphone, 
  Lock, 
  LogIn, 
  ShieldAlert, 
  ShieldCheck, 
  Shield, 
  UserCheck 
} from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isAdmin, openAuthModal } = useAuth();

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#17458F]/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-[#E78023]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center animate-spin">
            <Shield className="w-7 h-7 text-[#E78023]" />
          </div>
          <div className="space-y-1">
            <p className="font-heading font-extrabold text-lg text-white tracking-wide uppercase">
              Verifying Administrative Access
            </p>
            <p className="text-xs text-slate-400 font-medium animate-pulse">
              Checking authenticated credentials & security clearance...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated (Signed Out) State
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-between p-6 relative overflow-hidden">
        {/* Background decorative glows */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#17458F]/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-[#E78023]/25 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="relative h-8 w-8">
              <Image
                src="/assets/SRC Logo.png"
                alt="SRC Logo"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-sm text-white">SAHASTRADEEP</h2>
              <p className="text-[10px] text-slate-400 font-medium">SRC • JDCOEM Nagpur</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Access Restricted
          </span>
        </div>

        {/* Center Card */}
        <div className="relative z-10 my-auto py-8 text-center space-y-6 max-w-sm mx-auto">
          <div className="relative mx-auto w-20 h-20 rounded-3xl bg-slate-900 border border-slate-700 flex items-center justify-center shadow-2xl">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#17458F] to-[#E78023] opacity-20 animate-pulse" />
            <Lock className="w-10 h-10 text-[#E78023]" />
          </div>

          <div className="space-y-2">
            <Badge variant="orange" size="md">
              AUTHENTICATION REQUIRED
            </Badge>
            <h1 className="font-heading font-extrabold text-2xl text-white tracking-tight uppercase">
              Admin Console Locked
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              You must sign in with an authorized Administrator college account to access the SRC Management Studio.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <Button
              onClick={openAuthModal}
              variant="primary"
              size="lg"
              className="w-full justify-center gap-2 font-bold cursor-pointer shadow-lg shadow-[#E78023]/25"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Admin Portal</span>
            </Button>

            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
          SRC Central Administration • JD College of Engineering & Management
        </div>
      </div>
    );
  }

  // 3. Authenticated but Non-Admin (General Student) State
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-between p-6 relative overflow-hidden">
        {/* Background decorative glows */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#17458F]/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="relative h-8 w-8">
              <Image
                src="/assets/SRC Logo.png"
                alt="SRC Logo"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-sm text-white">SAHASTRADEEP</h2>
              <p className="text-[10px] text-slate-400 font-medium">SRC • JDCOEM Nagpur</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Unauthorized
          </span>
        </div>

        {/* Center Card */}
        <div className="relative z-10 my-auto py-8 text-center space-y-6 max-w-sm mx-auto">
          <div className="relative mx-auto w-20 h-20 rounded-3xl bg-slate-900 border border-rose-500/30 flex items-center justify-center shadow-2xl">
            <ShieldAlert className="w-10 h-10 text-rose-400" />
          </div>

          <div className="space-y-2">
            <Badge variant="warning" size="md">
              ADMIN PRIVILEGES REQUIRED
            </Badge>
            <h1 className="font-heading font-extrabold text-2xl text-white tracking-tight uppercase">
              Access Restricted
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Logged in as <strong className="text-white">{user.displayName || user.email}</strong>. This account does not have Administrative Console authorization.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <Link
              href="/dashboard"
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#E78023]/25 transition-all"
            >
              <UserCheck className="w-4 h-4" />
              <span>Go to Student Portal</span>
            </Link>

            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
          SRC Central Administration • JD College of Engineering & Management
        </div>
      </div>
    );
  }

  // 4. Authenticated & Verified Admin User
  return (
    <>
      {/* MOBILE DEVICE PROMPT (< md) */}
      <div className="md:hidden min-h-screen bg-[#0F172A] text-white flex flex-col justify-between p-6 relative overflow-hidden">
        {/* Background decorative glows */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#17458F]/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-[#E78023]/25 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="relative h-8 w-8">
              <Image
                src="/assets/SRC Logo.png"
                alt="SRC Logo"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-sm text-white">SAHASTRADEEP</h2>
              <p className="text-[10px] text-slate-400 font-medium">SRC • JDCOEM Nagpur</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Admin Portal
          </span>
        </div>

        {/* Center Prompt Card */}
        <div className="relative z-10 my-auto py-8 text-center space-y-6 max-w-sm mx-auto">
          {/* Animated Device Graphic */}
          <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#17458F] to-[#E78023] opacity-20 animate-pulse" />
            <div className="relative h-20 w-20 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center shadow-xl">
              <Monitor className="w-10 h-10 text-[#E78023]" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-slate-900 shadow-md">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2">
            <Badge variant="orange" size="md">
              DESKTOP REQUIRED
            </Badge>
            <h1 className="font-heading font-extrabold text-2xl text-white tracking-tight uppercase">
              Use Desktop to Access Admin Portal
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed font-sans font-normal pt-1">
              The Council Administrative Studio is built for wide workstation displays to ensure accurate table auditing, live cloud roster sync, and rich media management.
            </p>
          </div>

          {/* Helpful Tips Card */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-left space-y-2.5 text-xs text-slate-300">
            <div className="flex items-start gap-2.5">
              <span className="text-amber-400 font-bold">💻</span>
              <span>Open <strong>srcjdcoem.in/admin</strong> on a PC, Mac, or Laptop.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold">📱</span>
              <span>On mobile, explore events and digital delegate passes via the Student Portal.</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <Link
              href="/dashboard"
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#E78023]/25 transition-all"
            >
              <span>Go to Student Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
          SRC Central Administration • JD College of Engineering & Management
        </div>
      </div>

      {/* DESKTOP ADMIN WORKSPACE (>= md) */}
      <div className="hidden md:flex min-h-[calc(100vh-4rem)] bg-[#F8FAFC] text-[#0F172A] flex-row">
        <div className="w-64 shrink-0">
          <AdminSidebar />
        </div>
        <main className="flex-1 min-w-0 p-6 sm:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </>
  );
}
