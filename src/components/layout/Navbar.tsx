"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  Menu, 
  X, 
  ArrowRight, 
  Calendar, 
  Users, 
  Sparkles, 
  Info, 
  LayoutDashboard, 
  ShieldCheck, 
  ChevronRight,
  User,
  LogOut,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
  { name: "Home", href: "/" },
  { name: "Events", href: "/events" },
  { name: "Clubs", href: "/clubs" },
  { name: "Team", href: "/team" },
  { name: "About", href: "/about" },
  { name: "Gallery", href: "/gallery" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, openAuthModal, openProfileModal, logout, isAdmin: isUserAdmin } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdminRoute = pathname.startsWith("/admin");

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  }, [pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-white/95 backdrop-blur-md border-b border-slate-200/90 py-3 shadow-xs"
          : "bg-white/80 backdrop-blur-sm border-b border-slate-200/60 py-4"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Brand Logo & College Crest */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-11 w-11 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1 group-hover:border-[#E78023] transition-colors">
              <Image
                src="/assets/SRC Logo.png"
                alt="SRC Logo"
                fill
                className="object-contain p-1"
                priority
              />
            </div>

            <div className="flex flex-col">
              <span className="font-hero font-extrabold text-sm sm:text-base text-[#17458F] tracking-tight leading-tight group-hover:text-[#E78023] transition-colors uppercase">
                SAHASTRADEEP
              </span>
              <span className="text-[10px] sm:text-[11px] font-sans font-medium text-slate-500 uppercase tracking-widest leading-tight">
                SRC • JDCOEM
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links — Inter Medium */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 border border-slate-200 px-2 py-1.5 rounded-full shadow-inner">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider transition-all duration-200 font-sans",
                    isActive
                      ? "bg-[#E78023] text-white shadow-xs"
                      : "text-slate-600 hover:text-[#17458F] hover:bg-white/70"
                  )}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Right Actions */}
          <div className="hidden md:flex items-center gap-2.5">
            
            {/* Student Portal Quick Access */}
            <Link
              href="/dashboard"
              className={cn(
                "p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-[#17458F] hover:border-[#17458F]/40 shadow-xs transition-all",
                pathname === "/dashboard" && "text-[#E78023] border-[#E78023] bg-[#E78023]/5"
              )}
              title="Student Portal"
            >
              <LayoutDashboard className="w-4 h-4" />
            </Link>

            {/* Admin Console Quick Access (ONLY visible to verified logged-in Council Admins) */}
            {isUserAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 text-[#17458F] hover:text-[#E78023] hover:border-[#E78023] shadow-xs transition-all",
                  isAdminRoute && "text-[#E78023] border-[#E78023] bg-[#E78023]/10"
                )}
                title="Admin Console"
              >
                <ShieldCheck className="w-4 h-4 text-[#17458F]" />
              </Link>
            )}

            {/* Auth Dropdown / Sign In Button */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:border-[#17458F] shadow-xs transition-all cursor-pointer"
                >
                  <div className="h-6 w-6 rounded-full bg-[#17458F] text-white flex items-center justify-center text-xs font-bold font-mono shrink-0">
                    {user.displayName?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <span className="text-xs font-bold text-slate-800 max-w-[100px] truncate">
                    {user.displayName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 space-y-1 z-50 animate-in fade-in zoom-in-95 duration-150 text-left">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.displayName}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{user.email}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {user.designationBadge ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 truncate max-w-full">
                            🏅 {user.designationBadge}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {user.role}
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#17458F] transition-colors"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      <span>Student Dashboard</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        openProfileModal();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#17458F] transition-colors cursor-pointer text-left"
                    >
                      <User className="w-3.5 h-3.5 text-[#E78023]" />
                      <span>Edit Student Profile</span>
                    </button>

                    {isUserAdmin && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[#17458F] hover:bg-[#17458F]/5 transition-colors font-bold"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Admin Console</span>
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => logout()}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="px-4 py-2 rounded-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 hover:text-[#17458F] text-xs font-semibold uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer font-sans"
              >
                <User className="w-3.5 h-3.5 text-[#E78023]" />
                <span>Sign In</span>
              </button>
            )}

            {/* Explore Events CTA */}
            <Link
              href="/events"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-semibold uppercase tracking-wider transition-all duration-200 shadow-md shadow-[#E78023]/25 group cursor-pointer font-sans"
            >
              <span>Explore Events</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex items-center gap-2 md:hidden">
            {user ? (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="h-8 w-8 rounded-full bg-[#17458F] text-white flex items-center justify-center text-xs font-bold"
              >
                {user.displayName?.charAt(0).toUpperCase() || "U"}
              </button>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="px-3 py-1 rounded-full bg-[#E78023] text-white text-xs font-semibold uppercase tracking-wider shadow-xs"
              >
                Sign In
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Menu"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#17458F] focus:outline-none shadow-xs cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top-4 duration-200">
          
          {user && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">{user.displayName}</p>
                <p className="text-[10px] text-slate-500 font-mono">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-[#E78023] hover:text-white transition-all text-center"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <Link
              href="/dashboard"
              className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="w-4 h-4 text-[#E78023]" />
              <span>Student Dashboard</span>
            </Link>

            {/* ONLY visible in mobile menu if verified admin */}
            {isUserAdmin && (
              <Link
                href="/admin"
                className="w-full py-2.5 rounded-xl bg-[#17458F]/10 text-[#17458F] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Console</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
