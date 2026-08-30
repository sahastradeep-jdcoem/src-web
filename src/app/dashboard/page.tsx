"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  ExternalLink, 
  ShieldCheck, 
  Users, 
  ArrowRight, 
  Sparkles, 
  Ticket,
  User,
  LogOut,
  Award
} from "lucide-react";
import { mockRegistrations } from "@/data/registrations";
import { Badge } from "@/components/ui/Badge";
import { getDepartmentShortName } from "@/lib/departmentsStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RegistrationRecord, EventItem } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { downloadPassAsImage } from "@/lib/passExport";
import { getStoredEvents, syncEventsFromFirestore, subscribeToEvents } from "@/lib/eventsStore";

export default function StudentDashboardPage() {
  const { user, openAuthModal, openProfileModal, logout } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<RegistrationRecord | null>(null);

  useEffect(() => {
    // Load dynamic events from store & cloud
    setEvents(getStoredEvents());
    syncEventsFromFirestore().then((res) => {
      if (res) setEvents(res);
    });
    const unsub = subscribeToEvents((remote) => {
      if (remote) setEvents(remote);
    });

    const handleEventsUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setEvents(e.detail);
      } else {
        setEvents(getStoredEvents());
      }
    };
    window.addEventListener("src_events_updated", handleEventsUpdate);
    window.addEventListener("storage", handleEventsUpdate);

    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      if (Array.isArray(local) && local.length > 0) {
        const formatted: RegistrationRecord[] = local.map((r: any) => ({
          id: r.id,
          registrationId: r.id,
          eventSlug: r.eventId,
          eventName: r.eventTitle || "Event Delegate Pass",
          participantName: r.leaderName,
          email: r.email,
          phone: r.phone,
          department: r.department,
          year: r.year,
          teamType: r.teamSize > 1 ? "Team" : "Individual",
          teamName: r.teamName,
          teamMembers: r.members?.map((m: any) => m.name),
          registeredAt: r.registeredAt || new Date().toISOString().split("T")[0],
          status: r.status || "CONFIRMED",
          ticketCode: `${r.id.slice(0, 7)}-TK`,
          qrPayload: r.qrPayload || `SRC:PASS:${r.id}`,
        }));

        setRegistrations(formatted);
      } else {
        setRegistrations([]);
      }
    } catch (e) {
      console.warn("Local registrations load warning", e);
      setRegistrations([]);
    }

    return () => {
      unsub();
      window.removeEventListener("src_events_updated", handleEventsUpdate);
      window.removeEventListener("storage", handleEventsUpdate);
    };
  }, []);

  const flagshipEvent = events.find(e => e.isFeatured || e.category === "Fest") || events[0] || null;

  const activeRegistrations = registrations.filter((r) => r.status !== "COMPLETED");
  const completedRegistrations = registrations.filter((r) => r.status === "COMPLETED");

  const displayName = user?.displayName || "Aryan Sharma";
  const displayDepartment = user?.department || "Computer Science & Engineering";
  const displayEmail = user?.email || "aryan.sharma@jdcoem.ac.in";
  const displayBtId = user?.btId || "BT22CSE045";
  const displayYear = user?.year || "3rd Year";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="orange" size="md">
                STUDENT DELEGATE PORTAL
              </Badge>
              {user?.designationBadge ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm shadow-amber-500/25">
                  <Award className="w-3.5 h-3.5" />
                  <span>{user.designationBadge}</span>
                </span>
              ) : user ? (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {user.role}
                </span>
              ) : null}
            </div>
            <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-[#0F172A] tracking-tight uppercase">
              WELCOME BACK, <span className="text-[#E78023]">{displayName.split(" ")[0]}</span>
            </h1>
            <p className="text-sm text-slate-600 font-medium font-sans">
              BT ID: <strong className="font-mono text-[#E78023]">{displayBtId}</strong> • {displayDepartment} • {displayYear}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!user ? (
              <button
                type="button"
                onClick={openAuthModal}
                className="px-5 py-2.5 rounded-full bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-semibold uppercase tracking-wider transition-all shadow-md shadow-[#E78023]/25 flex items-center gap-2 font-sans cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Sign In with College ID</span>
              </button>
            ) : (
              <>
                {/* Edit Profile Button */}
                <button
                  type="button"
                  onClick={openProfileModal}
                  className="px-4 py-2.5 rounded-full bg-white hover:bg-slate-50 border border-slate-300 hover:border-[#17458F] text-slate-700 hover:text-[#17458F] text-xs font-semibold uppercase tracking-wider transition-all shadow-xs flex items-center gap-2 cursor-pointer font-sans"
                >
                  <User className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Edit Profile</span>
                </button>

                {/* Sign Out Button */}
                <button
                  type="button"
                  onClick={() => logout()}
                  className="px-4 py-2.5 rounded-full bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-600 text-xs font-semibold uppercase tracking-wider transition-all shadow-xs flex items-center gap-2 cursor-pointer font-sans"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              </>
            )}

            <Link
              href="/events"
              className="px-5 py-2.5 rounded-full bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-semibold uppercase tracking-wider transition-all duration-200 shadow-md shadow-[#E78023]/25 flex items-center gap-2 font-sans cursor-pointer group"
            >
              <span>Explore New Events</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          
          <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-2 shadow-xs flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#E78023]" />
                <span>Flagship Event</span>
              </span>
              <h3 className="font-heading font-bold text-xl text-[#17458F] line-clamp-1">
                {flagshipEvent ? flagshipEvent.name : "No Active Event"}
              </h3>
              <p className="text-xs text-[#E78023] font-bold line-clamp-1">
                {flagshipEvent ? (flagshipEvent.tagline || `${flagshipEvent.category} Showcase`) : "Check back soon for college fests"}
              </p>
            </div>
            {flagshipEvent && (
              <Link 
                href={`/events/${flagshipEvent.slug}`} 
                className="text-[11px] font-bold text-[#17458F] hover:text-[#E78023] transition-colors inline-flex items-center gap-1 pt-1"
              >
                <span>View Event Details</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-2 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Ticket className="w-4 h-4 text-[#17458F]" />
              <span>Active Registrations</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-hero font-extrabold text-3xl text-[#E78023]">
                {activeRegistrations.length}
              </span>
              <span className="text-xs text-slate-700 font-semibold font-sans">Confirmed Passes</span>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">Ready for campus check-in</p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-2 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Events Attended</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-hero font-extrabold text-3xl text-[#17458F]">
                {completedRegistrations.length}
              </span>
              <span className="text-xs text-slate-700 font-semibold font-sans">Verified Records</span>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">Accredited participation history</p>
          </div>

        </div>

        {/* Main Content Grid: Registrations vs Digital Student ID Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left 2 Cols: My Registrations */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-extrabold text-2xl text-[#17458F] uppercase tracking-wide">
                MY REGISTRATIONS
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {registrations.length} Total Records
              </span>
            </div>

            <div className="space-y-4">
              {registrations.length === 0 ? (
                <div className="p-10 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
                  <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-heading font-bold text-lg text-slate-900">
                      No Event Passes Yet
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto font-sans font-medium">
                      {flagshipEvent
                        ? `You haven't registered for any events yet. Explore ${flagshipEvent.name} and generate your instant digital delegate pass.`
                        : `You haven't registered for any events yet. Explore upcoming council events and generate your instant digital delegate pass.`}
                    </p>
                  </div>
                  <Link
                    href={flagshipEvent ? `/events/${flagshipEvent.slug}` : "/events"}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-semibold uppercase tracking-wider transition-all shadow-md shadow-[#E78023]/20"
                  >
                    <span>{flagshipEvent ? `Explore ${flagshipEvent.name}` : "Explore Events"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                registrations.map((reg) => {
                  const isConfirmed = reg.status === "CONFIRMED" || reg.status === "CHECKED_IN";
                  const isPending = reg.status === "PENDING";
                  const statusVariant = reg.status === "CHECKED_IN" ? "success" : isConfirmed ? "orange" : isPending ? "warning" : "slate";

                  return (
                    <div
                      key={reg.id}
                      className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F]/30 hover:shadow-md transition-all space-y-4 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#E78023]">
                            {reg.registrationId}
                          </span>
                          <Badge variant={statusVariant} size="sm">
                            {reg.status}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium font-sans">
                          Registered: {reg.registeredAt}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="font-heading font-bold text-lg text-slate-900">
                            {reg.eventName}
                          </h3>
                          <p className="text-xs text-slate-600 font-medium font-sans mt-0.5">
                            {reg.teamType === "Team" ? `Team: ${reg.teamName || "Squad"}` : "Individual Participation"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedTicket(reg)}
                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-[#17458F] text-slate-700 hover:text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer font-sans"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>View QR Pass</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right 1 Col: Digital Student Accreditation Card */}
          <div className="space-y-6">
            <h2 className="font-heading font-extrabold text-2xl text-[#17458F] uppercase tracking-wide">
              DIGITAL ACCREDITATION
            </h2>

            <div className="rounded-3xl bg-gradient-to-br from-[#17458F] via-[#1E315B] to-[#0E2F66] p-6 text-white shadow-xl space-y-6 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 h-40 w-40 rounded-full bg-white/5 blur-xl pointer-events-none" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-10 w-10 rounded-xl bg-white p-1 shrink-0">
                    <Image
                      src="/assets/SRC Logo.png"
                      alt="SRC Seal"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#E78023]">
                      JDCOEM SRC
                    </span>
                    <h4 className="font-heading font-bold text-sm text-white">
                      {user?.designationBadge ? "COUNCIL OFFICER" : "STUDENT DELEGATE"}
                    </h4>
                  </div>
                </div>

                <Badge variant="orange" size="sm">
                  VERIFIED
                </Badge>
              </div>

              {user?.designationBadge && (
                <div className="px-3 py-2 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/40 flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Award className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">{user.designationBadge}</span>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-white/10 font-sans">
                <div>
                  <span className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">
                    Full Name
                  </span>
                  <p className="font-heading font-bold text-base text-white">{displayName}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">
                      Department
                    </span>
                    <p className="font-semibold text-slate-100 truncate" title={displayDepartment}>
                      <span className="sm:hidden">{getDepartmentShortName(displayDepartment)}</span>
                      <span className="hidden sm:inline">{displayDepartment.split("(")[0]}</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">
                      College BT ID
                    </span>
                    <p className="font-mono font-bold text-[#E78023]">{displayBtId}</p>
                  </div>
                </div>

                <div className="text-xs pt-1 border-t border-white/10 flex justify-between">
                  <span className="text-[10px] text-slate-300 uppercase tracking-wider font-medium">Year of Study:</span>
                  <span className="text-slate-100 font-bold">{displayYear}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white text-slate-900 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                    Universal Check-In Pass
                  </span>
                  <p className="font-mono text-xs font-bold text-[#17458F]">
                    {user ? `SRC-${user.uid.slice(0, 8).toUpperCase()}` : "SRC-DELEGATE-2026"}
                  </p>
                </div>
                <div className="p-1 bg-slate-50 rounded-lg border border-slate-200">
                  <QrCode className="w-9 h-9 text-[#17458F]" />
                </div>
              </div>

              <p className="text-[10px] text-slate-300 text-center font-medium font-sans">
                Official Student Accreditation • Academic Year 2025–26
              </p>
            </div>
          </div>

        </div>

        {/* Modal: View Participant QR & Pass Record */}
        {selectedTicket && (
          <Modal
            isOpen={!!selectedTicket}
            onClose={() => setSelectedTicket(null)}
            title="Digital Delegate Pass"
            subtitle={`Pass ID: ${selectedTicket.registrationId}`}
            maxWidth="md"
          >
            <div className="space-y-6" id="dashboard-ticket-modal">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                <div className="mx-auto w-32 h-32 p-3 bg-white rounded-2xl shadow-xs border border-slate-200 flex items-center justify-center">
                  <QrCode className="w-28 h-28 text-[#17458F]" />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold text-[#E78023]">
                    {selectedTicket.ticketCode}
                  </span>
                  <h4 className="font-heading font-bold text-xl text-slate-900 mt-1">
                    {selectedTicket.eventName}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium font-sans">
                    Delegate: {selectedTicket.participantName} ({selectedTicket.department})
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => downloadPassAsImage("dashboard-ticket-modal", `${selectedTicket.registrationId}-Pass.png`)}
                  className="gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Pass Image</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedTicket(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}

      </div>
    </div>
  );
}
