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
  Award,
  RefreshCw,
  Check,
  Printer,
  Share2, 
  FileText,
  Pencil,
  Lock,
  Sliders
} from "lucide-react";
import { mockRegistrations } from "@/data/registrations";
import { Badge } from "@/components/ui/Badge";
import { getDepartmentShortName } from "@/lib/departmentsStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RegistrationRecord, EventItem } from "@/types";
import { ListingItem, ListingResponseRecord } from "@/types/listings";
import { 
  getStoredListingResponses,
  syncListingResponsesFromFirestore,
  subscribeToListingResponses,
  getStoredListings,
  syncListingsFromFirestore,
  subscribeToListings
} from "@/lib/listingsStore";
import { useAuth } from "@/context/AuthContext";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";
import { downloadPassAsImage } from "@/lib/passExport";
import { getStoredEvents, syncEventsFromFirestore, subscribeToEvents } from "@/lib/eventsStore";
import { 
  getAllRegistrationsFromFirestore, 
  subscribeToRegistrationsFromFirestore, 
  StudentRegistrationRecord 
} from "@/lib/firebase/firestore";
import { cn } from "@/lib/utils";

export default function StudentDashboardPage() {
  const { user, openAuthModal, openProfileModal, logout } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [hubResponses, setHubResponses] = useState<ListingResponseRecord[]>([]);
  const [activeDashboardTab, setActiveDashboardTab] = useState<"passes" | "hub">("passes");
  const [selectedTicket, setSelectedTicket] = useState<RegistrationRecord | null>(null);
  const [selectedHubSubmission, setSelectedHubSubmission] = useState<ListingResponseRecord | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    // Legacy Backwards Compatibility:
    // If an older pass QR code with `/dashboard?passId=...` is scanned, seamlessly forward to `/verify/[passId]`
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const legacyPassId = urlParams.get("passId");
      if (legacyPassId) {
        window.location.replace(`/verify/${encodeURIComponent(legacyPassId)}`);
        return;
      }
    }
    // Load dynamic events from store & cloud
    setEvents(getStoredEvents());
    syncEventsFromFirestore().then((res) => {
      if (res) setEvents(res);
    });
    const unsub = subscribeToEvents((remote) => {
      if (remote) setEvents(remote);
    });

    const formatStudentRecords = (rawRecords: any[], activeStoredEvents: EventItem[]): RegistrationRecord[] => {
      const cleanEmail = user?.email?.trim().toLowerCase();
      const cleanBtId = user?.btId?.trim().toUpperCase();
      const cleanName = user?.displayName?.trim().toLowerCase();

      // 1. All valid registration records (every event pass is included)
      const validRecords = rawRecords.filter((r: any) => {
        return Boolean(r && r.id);
      });

      // 2. Filter records that specifically belong to this authenticated student (as leader OR squad member)
      const userMatched = validRecords.filter((r: any) => {
        if (!cleanEmail && !cleanBtId && !cleanName) return true;

        const rEmail = (r.email || "").trim().toLowerCase();
        const rBtId = (r.btId || "").trim().toUpperCase();
        const rLeader = (r.leaderName || r.participantName || "").trim().toLowerCase();

        // Check if primary leader / registrant
        if (cleanEmail && rEmail === cleanEmail) return true;
        if (cleanBtId && rBtId === cleanBtId) return true;
        if (cleanName && (rLeader === cleanName || rLeader.includes(cleanName) || cleanName.includes(rLeader))) return true;

        // Check if member of squad / team roster
        const membersList = Array.isArray(r.teamMembers) 
          ? r.teamMembers 
          : Array.isArray(r.members) 
          ? r.members 
          : [];

        if (membersList.length > 0) {
          const isMember = membersList.some((m: any) => {
            if (!m) return false;
            if (typeof m === "string") {
              const mUpper = m.toUpperCase().trim();
              const mLower = m.toLowerCase().trim();
              return (
                (cleanBtId && mUpper.includes(cleanBtId)) ||
                (cleanEmail && mLower.includes(cleanEmail)) ||
                (cleanName && (mLower.includes(cleanName) || cleanName.includes(mLower)))
              );
            }
            if (typeof m === "object") {
              const mBtId = (m.btId || "").toUpperCase().trim();
              const mEmail = (m.email || "").toLowerCase().trim();
              const mName = (m.name || m.displayName || "").toLowerCase().trim();
              return (
                (cleanBtId && (mBtId === cleanBtId || mBtId.includes(cleanBtId) || cleanBtId.includes(mBtId))) ||
                (cleanEmail && (mEmail === cleanEmail || mEmail.includes(cleanEmail))) ||
                (cleanName && (mName === cleanName || mName.includes(cleanName) || cleanName.includes(mName)))
              );
            }
            return false;
          });
          if (isMember) return true;
        }

        return false;
      });

      // 3. Deduplicate by unique Registration Pass ID and sort by newest first
      const passMap = new Map<string, any>();
      userMatched.forEach((r: any) => {
        const passId = (r.id || "").trim();
        if (!passId) return;
        const existing = passMap.get(passId);
        if (!existing || r.status === "CHECKED_IN") {
          passMap.set(passId, r);
        }
      });

      const sortedPasses = Array.from(passMap.values()).sort(
        (a: any, b: any) => new Date(b.paidAt || b.registeredAt || 0).getTime() - new Date(a.paidAt || a.registeredAt || 0).getTime()
      );

      return sortedPasses.map((r: any) => ({
        id: r.id,
        registrationId: r.id,
        eventSlug: r.eventId || r.eventSlug || "",
        eventName: r.eventTitle || r.eventName || "Event Delegate Pass",
        participantName: r.leaderName || r.participantName || "Delegate",
        email: r.email,
        phone: r.phone,
        department: r.department,
        year: r.year,
        teamType: (r.teamSize && r.teamSize > 1) || r.teamType === "Team" ? "Team" : "Individual",
        teamName: r.teamName,
        teamMembers: r.teamMembers 
          ? r.teamMembers.map((m: any) => typeof m === "string" ? m : `${m.name}${m.btId ? ` (${m.btId})` : ""}`) 
          : r.members?.map((m: any) => typeof m === "string" ? m : m.name),
        registeredAt: r.registeredAt || (r.paidAt ? new Date(r.paidAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]),
        status: r.status || "CONFIRMED",
        paymentStatus: r.paymentStatus || (r.amountPaid > 0 ? "PAID" : "FREE"),
        ticketCode: r.ticketCode || `${r.id.slice(0, 7)}-TK`,
        qrPayload: r.qrPayload || `SRC:PASS:${r.id}`,
        amountPaid: r.amountPaid || 0,
        customAnswers: r.customAnswers,
      }));
    };

    const syncAndLoadRegistrations = async (cloudList?: StudentRegistrationRecord[]) => {
      try {
        const storedEvents = getStoredEvents();
        let allRecords: any[] = [];

        // If cloud records provided or fetched from Firestore
        let remoteRecords = cloudList;
        if (!remoteRecords) {
          remoteRecords = await getAllRegistrationsFromFirestore();
        }

        // Merge remote and local records by registration ID to guarantee no passes are lost
        const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
        const map = new Map<string, any>();
        if (Array.isArray(local)) {
          local.forEach((r: any) => { if (r?.id) map.set(r.id, r); });
        }
        if (remoteRecords && Array.isArray(remoteRecords)) {
          remoteRecords.forEach((r: any) => { if (r?.id) map.set(r.id, r); });
        }
        allRecords = Array.from(map.values());
        localStorage.setItem("src_local_registrations", JSON.stringify(allRecords));

        const formatted = formatStudentRecords(allRecords, storedEvents);
        setRegistrations(formatted);
      } catch (e) {
        console.warn("Registrations sync error on student dashboard", e);
      }
    };

    syncAndLoadRegistrations();

    // Subscribe to Firestore for real-time deletions and check-ins
    const unsubRegistrations = subscribeToRegistrationsFromFirestore((cloudRegs) => {
      syncAndLoadRegistrations(cloudRegs);
    });

    const handleEventsUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setEvents(e.detail);
      } else {
        setEvents(getStoredEvents());
      }
      syncAndLoadRegistrations();
    };

    // Load dynamic listings for edit permissions & links
    setListings(getStoredListings());
    syncListingsFromFirestore().then((res) => {
      if (res) setListings(res);
    });
    const unsubListings = subscribeToListings((remoteListings) => {
      if (remoteListings) setListings(remoteListings);
    });

    const updateResponses = (overrideList?: ListingResponseRecord[]) => {
      const allResp = overrideList || getStoredListingResponses();
      if (!user) {
        setHubResponses([]);
        return;
      }
      const uEmail = (user.email || "").toLowerCase().trim();
      const uId = user.uid;
      const uBtId = (user.btId || "").toUpperCase().trim();
      const uName = (user.displayName || "").toLowerCase().trim();

      const matched = allResp.filter((r) => {
        const rEmail = (r.userEmail || "").toLowerCase().trim();
        const rId = r.userId;
        const rBtId = (r.btId || "").toUpperCase().trim();
        const rName = (r.userName || "").toLowerCase().trim();

        if (uEmail && rEmail === uEmail) return true;
        if (uId && rId === uId) return true;
        if (uBtId && rBtId === uBtId) return true;
        if (uName && (rName === uName || (uName.length > 3 && rName.includes(uName)))) return true;
        return false;
      });

      setHubResponses(matched);
    };

    updateResponses();
    syncListingResponsesFromFirestore().then((res) => {
      if (res) updateResponses(res);
    });

    const unsubHub = subscribeToListingResponses((remoteResponses) => {
      if (remoteResponses) updateResponses(remoteResponses);
    });

    const handleRegsUpdate = (e: any) => {
      syncAndLoadRegistrations(e?.detail);
    };

    const handleHubUpdate = (e: any) => {
      updateResponses(e?.detail);
    };

    window.addEventListener("src_events_updated", handleEventsUpdate);
    window.addEventListener("src_registrations_updated", handleRegsUpdate);
    window.addEventListener("src_listing_responses_updated", handleHubUpdate);
    window.addEventListener("storage", handleEventsUpdate);

    return () => {
      unsub();
      unsubRegistrations();
      unsubListings();
      unsubHub();
      window.removeEventListener("src_events_updated", handleEventsUpdate);
      window.removeEventListener("src_registrations_updated", handleRegsUpdate);
      window.removeEventListener("src_listing_responses_updated", handleHubUpdate);
      window.removeEventListener("storage", handleEventsUpdate);
    };
  }, [user]);

  const flagshipEvent = events.find(e => e.isFeatured || e.category === "Fest") || events[0] || null;

  const activeRegistrations = registrations.filter((r) => r.status !== "COMPLETED");
  const completedRegistrations = registrations.filter((r) => r.status === "COMPLETED");

  const isFaculty = user?.role === "FACULTY" || user?.userType === "FACULTY";
  const isExternal = user?.userType === "EXTERNAL_STUDENT" || user?.isCollegeStudent === false || Boolean(user?.collegeName);
  const isPendingFaculty = isFaculty && user?.facultyApprovalStatus === "pending";

  const displayName = user?.displayName || (isFaculty ? "Faculty Member" : isExternal ? "Visiting Delegate" : "Aryan Sharma");
  const displayDepartment = user?.facultyDepartment || user?.customBranch || user?.department || "Computer Science & Engineering";
  const displayEmail = user?.email || "aryan.sharma@jdcoem.ac.in";
  const displayBtId = user?.btId || (isFaculty ? (user.employeeId || "Staff Access") : isExternal ? "External" : "BT22CSE045");
  const displayYear = isFaculty ? (user?.facultyDesignation || "Faculty Member") : (user?.year || "3rd Year");

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* PENDING FACULTY ALERT BANNER */}
        {isPendingFaculty && (
          <div className="p-4 rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-heading font-extrabold text-sm text-slate-900">
                  Faculty Verification Pending Admin Council Review
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  Your profile has been created and submitted to SRC Administrators for institutional accreditation. You can browse all events and passes in the meantime.
                </p>
              </div>
            </div>
            <button
              onClick={openProfileModal}
              className="px-3.5 py-1.5 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold transition-all shrink-0 cursor-pointer self-start sm:self-center"
            >
              Review Details
            </button>
          </div>
        )}

        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isFaculty ? "navy" : isExternal ? "success" : "orange"} size="md">
                {isFaculty 
                  ? "FACULTY & ACADEMIC PORTAL" 
                  : isExternal 
                  ? "INTER-COLLEGIATE DELEGATE PORTAL" 
                  : "STUDENT DELEGATE PORTAL"}
              </Badge>
              {user?.designationBadge ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm shadow-amber-500/25">
                  <Award className="w-3.5 h-3.5" />
                  <span>{user.designationBadge}</span>
                </span>
              ) : isFaculty ? (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  user?.facultyApprovalStatus === "approved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {user?.facultyApprovalStatus === "approved" ? "Verified Faculty" : "Approval Pending"}
                </span>
              ) : isExternal ? (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {user?.collegeName ? `${user.collegeName} • ${user.city || "Delegate"}` : "External Student"}
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
              {isFaculty ? (
                <>
                  <strong className="text-[#17458F] font-bold">{user?.facultyDesignation || "Faculty Member"}</strong> • {displayDepartment}
                </>
              ) : isExternal ? (
                <>
                  <strong className="text-[#17458F] font-bold">{user?.collegeName || "Other College"}</strong> • 📍 {user?.city || "Nagpur"} • {displayDepartment} • {displayYear}
                </>
              ) : (
                <>
                  BT ID: <strong className="font-mono text-[#E78023]">{displayBtId}</strong> • {displayDepartment} • {displayYear}
                </>
              )}
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

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          
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

          <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-2 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#E78023]" />
              <span>Engagement Hub</span>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-hero font-extrabold text-3xl text-[#E78023]">
                {hubResponses.length}
              </span>
              <span className="text-xs text-slate-700 font-semibold font-sans">Forms &amp; Tickets</span>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">Applications, contests &amp; inquiries</p>
          </div>

        </div>

        {/* Main Content Grid: Registrations vs Digital Student ID Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left 2 Cols: My Registrations & Engagement Hub Submissions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Tab Selector */}
              <div className="inline-flex p-1 rounded-2xl bg-slate-200/80 border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setActiveDashboardTab("passes")}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
                    activeDashboardTab === "passes"
                      ? "bg-white text-[#17458F] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>Event Passes ({registrations.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDashboardTab("hub")}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
                    activeDashboardTab === "hub"
                      ? "bg-white text-[#E78023] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Hub Submissions ({hubResponses.length})</span>
                </button>
              </div>

              <span className="text-xs text-slate-500 font-medium">
                {activeDashboardTab === "passes"
                  ? `${registrations.length} Total Records`
                  : `${hubResponses.length} Submissions Logged`}
              </span>
            </div>

            {/* Content for Active Tab */}
            {activeDashboardTab === "passes" ? (
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
            ) : (
              <div className="space-y-4">
                {hubResponses.length === 0 ? (
                  <div className="p-10 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                      <FileText className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-heading font-bold text-lg text-slate-900">
                        No Hub Forms Submitted Yet
                      </h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto font-sans font-medium">
                        You haven&apos;t submitted any club recruitment applications, fellowships, or campus inquiry tickets yet. Check out the Student Hub for live forms!
                      </p>
                    </div>
                    <Link
                      href="/hub"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#17458F] hover:bg-[#123670] text-white text-xs font-semibold uppercase tracking-wider transition-all shadow-md shadow-[#17458F]/20"
                    >
                      <span>Explore Student Hub</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  hubResponses.map((item) => {
                    const targetListing = listings.find((l) => l.id === item.listingId || l.slug === item.listingSlug);
                    const canEdit = targetListing ? targetListing.allowResponseEditing !== false : true;
                    const isResolved = item.status === "approved" || item.status === "resolved";
                    const isRejected = item.status === "rejected";

                    return (
                      <div
                        key={item.id}
                        className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F]/30 hover:shadow-md transition-all space-y-4 shadow-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#17458F] text-white">
                              {item.listingType.toUpperCase()}
                            </span>
                            <span className="font-mono text-xs font-bold text-[#E78023]">
                              {item.ticketCode}
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                              isResolved
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : isRejected
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            )}>
                              {item.status?.toUpperCase() || "PENDING REVIEW"}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium font-sans">
                            Submitted: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Recently"}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <h3 className="font-heading font-bold text-lg text-slate-900">
                              {item.listingTitle}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium font-sans">
                              Applicant: {item.userName} • {item.userDepartment || "JDCOEM"}
                              {item.updatedAt && (
                                <span className="text-slate-400"> (Updated {new Date(item.updatedAt).toLocaleDateString()})</span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSelectedHubSubmission(item)}
                              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-[#17458F] text-slate-700 hover:text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer font-sans"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View Answers</span>
                            </button>

                            {canEdit ? (
                              <Link
                                href={`/hub/${item.listingSlug || item.listingId}?edit=true`}
                                className="px-3.5 py-2 rounded-xl bg-[#E78023]/10 hover:bg-[#E78023] text-[#E78023] hover:text-white border border-[#E78023]/30 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 font-sans"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </Link>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium italic flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>Locked</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
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
                      unoptimized={true}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#E78023]">
                      {isFaculty ? "ACADEMIC ACCREDITATION" : isExternal ? "VISITING DELEGATE" : "JDCOEM SRC"}
                    </span>
                    <h4 className="font-heading font-bold text-sm text-white">
                      {isFaculty 
                        ? "FACULTY & STAFF PASS" 
                        : isExternal 
                        ? (user?.collegeName || "INTER-COLLEGIATE DELEGATE") 
                        : user?.designationBadge 
                        ? "COUNCIL OFFICER" 
                        : "STUDENT DELEGATE"}
                    </h4>
                  </div>
                </div>

                <Badge 
                  variant={
                    isFaculty 
                      ? (user?.facultyApprovalStatus === "approved" ? "success" : "orange")
                      : isExternal 
                      ? "success" 
                      : "orange"
                  } 
                  size="sm"
                >
                  {isFaculty 
                    ? (user?.facultyApprovalStatus === "approved" ? "VERIFIED FACULTY" : "PENDING REVIEW")
                    : isExternal 
                    ? "VISITING PASS" 
                    : "VERIFIED"}
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
                      {isExternal ? "Institution" : "Department"}
                    </span>
                    <p className="font-semibold text-slate-100 truncate" title={isExternal ? user?.collegeName : displayDepartment}>
                      {isExternal 
                        ? (user?.collegeName || "Other College")
                        : (
                          <>
                            <span className="sm:hidden">{getDepartmentShortName(displayDepartment)}</span>
                            <span className="hidden sm:inline">{displayDepartment.split("(")[0]}</span>
                          </>
                        )}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">
                      {isFaculty ? "Staff / Employee ID" : isExternal ? "Location" : "College BT ID"}
                    </span>
                    <p className="font-mono font-bold text-[#E78023] truncate">
                      {isFaculty 
                        ? (user?.employeeId || "Faculty Member") 
                        : isExternal 
                        ? (user?.city ? `📍 ${user.city}` : "Visiting") 
                        : displayBtId}
                    </p>
                  </div>
                </div>

                <div className="text-xs pt-1 border-t border-white/10 flex justify-between">
                  <span className="text-[10px] text-slate-300 uppercase tracking-wider font-medium">
                    {isFaculty ? "Academic Role:" : isExternal ? "Degree & Year:" : "Year of Study:"}
                  </span>
                  <span className="text-slate-100 font-bold">
                    {isFaculty 
                      ? (user?.facultyDesignation || "Professor / Staff") 
                      : isExternal 
                      ? `${user?.customBranch || "Student"} • ${user?.year || displayYear}`
                      : displayYear}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white text-slate-900 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                    {isFaculty ? "Faculty Accreditation Pass" : "Universal Check-In Pass"}
                  </span>
                  <p className="font-mono text-xs font-bold text-[#17458F]">
                    {user ? `SRC-${user.uid.slice(0, 8).toUpperCase()}` : "SRC-DELEGATE-2026"}
                  </p>
                </div>
                <div className="p-1 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center">
                  <ScannableQRCode
                    value={user ? `SRC:USER:${user.uid}:${user.role}:${displayBtId}` : "SRC:STUDENT:DELEGATE"}
                    size={38}
                    includeMargin={false}
                    renderAs="canvas"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-300 text-center font-medium font-sans">
                Official Student Accreditation • Academic Year 2025–26
              </p>
            </div>
          </div>

        </div>

        {/* Hub Engagements, Applications & Grievances */}
        <section className="space-y-6 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
                  Student Engagement
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {hubResponses.length} Submissions
                </span>
              </div>
              <h3 className="font-heading font-extrabold text-2xl text-[#17458F] uppercase">
                My Applications, Fellowships &amp; Tickets
              </h3>
            </div>
            <Link
              href="/hub"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs self-start sm:self-center"
            >
              <span>Explore Engagement Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {hubResponses.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 mx-auto flex items-center justify-center text-slate-400">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
                You haven&apos;t submitted any club applications, fellowships, or grievance tickets yet. Check out the Student Hub for active opportunities!
              </p>
              <Link
                href="/hub"
                className="inline-block text-xs font-bold text-[#17458F] hover:underline"
              >
                Browse Student Hub &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {hubResponses.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-3xl bg-white border border-slate-200 space-y-3 shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#17458F] text-white">
                        {item.listingType.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                        {item.status || "RECEIVED"}
                      </span>
                    </div>

                    <h4 className="font-heading font-extrabold text-sm text-[#0F172A] uppercase line-clamp-2">
                      {item.listingTitle}
                    </h4>

                    {item.ticketCode && (
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Reference Ticket</span>
                        <span className="font-mono font-bold text-[#17458F]">{item.ticketCode}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Submitted {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Recently"}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedHubSubmission(item)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#17458F] text-slate-700 hover:text-white text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Answers</span>
                      </button>
                      {(() => {
                        const targetListing = listings.find((l) => l.id === item.listingId || l.slug === item.listingSlug);
                        const canEdit = targetListing ? targetListing.allowResponseEditing !== false : true;
                        if (!canEdit) return null;
                        return (
                          <Link
                            href={`/hub/${item.listingSlug || item.listingId}?edit=true`}
                            className="px-2.5 py-1 rounded-lg bg-[#E78023]/10 hover:bg-[#E78023] text-[#E78023] hover:text-white border border-[#E78023]/30 text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </Link>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Modal: View Participant Official Delegate Pass */}
        {selectedTicket && (() => {
          const matchedEvent = events.find(e => 
            e.name.toLowerCase() === selectedTicket.eventName.toLowerCase() ||
            e.id.toLowerCase() === selectedTicket.eventSlug?.toLowerCase() ||
            e.slug.toLowerCase() === selectedTicket.eventSlug?.toLowerCase()
          );
          const eventDateStr = matchedEvent?.date || "10 September 2026";
          const eventVenueStr = matchedEvent?.venue || "JDCOEM Campus";

          return (
            <Modal
              isOpen={!!selectedTicket}
              onClose={() => setSelectedTicket(null)}
              title="Official Delegate Pass"
              subtitle={`Pass ID: ${selectedTicket.registrationId}`}
              maxWidth="4xl"
            >
              <div className="space-y-6">
                
                {/* Official Digital Ticket Pass Card (Exportable Target) */}
                <div className="w-full py-2">
                  <div
                    id="src-dashboard-delegate-pass"
                    className="relative w-full max-w-[720px] rounded-3xl bg-white border border-slate-200 shadow-xl overflow-hidden text-left mx-auto font-sans"
                  >
                    {/* Ticket Top Strip */}
                    <div className="bg-[#17458F] px-5 py-4 sm:px-8 sm:py-6 flex flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 sm:gap-4">
                        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-white p-1 shrink-0 flex items-center justify-center overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/assets/SRC Logo.png"
                            alt="SRC Logo"
                            width={48}
                            height={48}
                            className="w-full h-full object-contain"
                            crossOrigin="anonymous"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#E78023] block leading-normal">
                            Official Delegate Pass
                          </span>
                          <h3 className="font-bold text-lg sm:text-2xl text-white font-sans leading-snug pb-0.5">
                            SAHASTRADEEP
                          </h3>
                          <p className="text-[11px] sm:text-xs text-slate-200 font-sans leading-normal">Student Representative Council • JDCOEM</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-200 block leading-normal">
                          Pass ID
                        </span>
                        <p className="font-mono font-bold text-sm sm:text-lg text-[#E78023] leading-normal">
                          {selectedTicket.registrationId}
                        </p>
                      </div>
                    </div>

                    {/* Ticket Perforation Notch */}
                    <div className="relative py-2 flex items-center justify-between px-2 sm:px-4 bg-slate-50">
                      <div className="w-5 h-5 -ml-5 sm:-ml-7 rounded-full bg-[#F8FAFC] border border-slate-200" />
                      <div className="w-full border-t-2 border-dashed border-slate-300 mx-4" />
                      <div className="w-5 h-5 -mr-5 sm:-mr-7 rounded-full bg-[#F8FAFC] border border-slate-200" />
                    </div>

                    {/* Ticket Body - Responsive Layout */}
                    <div className="p-5 sm:p-8 flex flex-row items-center justify-between gap-6 sm:gap-8 bg-white">
                      
                      {/* Main Info */}
                      <div className="flex-1 min-w-0 space-y-4">
                        <div>
                          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#E78023] block leading-normal">
                            Event Selection
                          </span>
                          <h4 className="font-extrabold text-xl sm:text-2xl text-[#0F172A] mt-0.5 font-sans leading-snug pb-1">
                            {selectedTicket.eventName}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium font-sans leading-normal">
                            {eventDateStr} • {eventVenueStr}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="min-w-0">
                            <span className="text-slate-500 uppercase font-bold text-[10px] block leading-normal">
                              Participant
                            </span>
                            <p className="font-bold text-slate-900 text-sm font-sans leading-snug pb-0.5">{selectedTicket.participantName}</p>
                            <p className="text-slate-600 text-[11px] font-medium font-sans leading-normal">
                              {selectedTicket.department || displayDepartment} ({selectedTicket.year || displayYear})
                            </p>
                          </div>

                          <div className="min-w-0">
                            <span className="text-slate-500 uppercase font-bold text-[10px] block leading-normal">
                              Category / Squad
                            </span>
                            <p className="font-bold text-slate-900 text-sm font-sans leading-snug pb-0.5">
                              {selectedTicket.teamType === "Team" ? selectedTicket.teamName || "Team Entry" : "Individual Entry"}
                            </p>
                            <Badge variant={selectedTicket.status === "CHECKED_IN" ? "success" : "orange"} size="sm" className="mt-1">
                              {selectedTicket.status}
                            </Badge>
                          </div>
                        </div>

                        {selectedTicket.teamMembers && selectedTicket.teamMembers.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 font-medium">
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block leading-normal">
                              Roster Members:
                            </span>
                            <p className="text-xs text-slate-700 mt-0.5 font-sans leading-relaxed">
                              {selectedTicket.teamMembers.join(" • ")}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Visual Scannable QR Code & Verification Block */}
                      <div className="w-44 sm:w-48 shrink-0 flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2.5">
                        <div className="relative p-2 bg-white rounded-xl shadow-xs border border-slate-200 flex items-center justify-center overflow-hidden">
                          <ScannableQRCode
                            value={
                              typeof window !== "undefined"
                                ? `${window.location.origin}/verify/${encodeURIComponent(selectedTicket.registrationId)}`
                                : `https://src-jdcoem.vercel.app/verify/${encodeURIComponent(selectedTicket.registrationId)}`
                            }
                            size={116}
                            level="H"
                            includeMargin={true}
                            fgColor="#0F172A"
                            bgColor="#FFFFFF"
                            renderAs="canvas"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <span className="font-mono text-[11px] font-bold text-[#E78023] block tracking-wider leading-normal">
                            {selectedTicket.ticketCode}
                          </span>
                          <p className="text-[10px] text-slate-500 font-semibold flex items-center justify-center gap-1 font-sans leading-normal">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>Scan for Gate Check-In</span>
                          </p>
                        </div>
                      </div>

                    </div>

                    {/* Ticket Bottom Endorsement Footer */}
                    <div className="px-6 py-3.5 sm:px-8 sm:py-4 bg-slate-50 border-t border-slate-200 flex flex-row items-center justify-between text-[11px] sm:text-xs text-slate-500 font-medium gap-2 font-sans leading-normal">
                      <p>Entry permitted only with valid physical College ID card.</p>
                      <p className="font-semibold text-slate-700">JDCOEM Nagpur • SRC Sahastradeep</p>
                    </div>
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Link
                    href={`/verify/${encodeURIComponent(selectedTicket.registrationId)}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-xs text-[#17458F] hover:underline font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Public Verification Link</span>
                  </Link>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isDownloading}
                      onClick={async () => {
                        setIsDownloading(true);
                        try {
                          const res = await downloadPassAsImage(
                            "src-dashboard-delegate-pass",
                            `${selectedTicket.registrationId}-${selectedTicket.eventName.replace(/\s+/g, "_")}_Pass.png`
                          );
                          if (res.success) {
                            setDownloadSuccess(true);
                            setTimeout(() => setDownloadSuccess(false), 3000);
                            if (res.isMobile && res.imageUrl) {
                              setPreviewImage(res.imageUrl);
                            }
                          }
                        } catch (e) {
                          console.error("Pass export error", e);
                        } finally {
                          setIsDownloading(false);
                        }
                      }}
                      className="gap-2 shadow-md shadow-[#17458F]/20"
                    >
                      {isDownloading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : downloadSuccess ? (
                        <Check className="w-4 h-4 text-emerald-300" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>{downloadSuccess ? "Pass Ready!" : isDownloading ? "Generating..." : "Save Pass to Phone (PNG)"}</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.print()}
                      className="gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
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

              </div>
            </Modal>
          );
        })()}

        {/* Mobile Photo Save & Share Dialog */}
        {previewImage && selectedTicket && (
          <Modal
            isOpen={!!previewImage}
            onClose={() => setPreviewImage(null)}
            title="Official Delegate Pass Ready"
            subtitle="Save directly to your phone gallery or share via WhatsApp"
            maxWidth="lg"
          >
            <div className="space-y-5 text-center">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-50 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImage}
                  alt="Official Delegate Pass"
                  className="w-full h-auto object-contain rounded-xl"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-semibold">
                💡 <strong>Mobile Save Tip:</strong> Tap and hold the pass image above to select <strong>&quot;Save to Photos&quot;</strong>, or use the Share button below.
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={async () => {
                    try {
                      const res = await fetch(previewImage);
                      const blob = await res.blob();
                      const file = new File([blob], `${selectedTicket.registrationId}_Pass.png`, { type: "image/png" });
                      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                          files: [file],
                          title: "SRC Official Delegate Pass",
                          text: `My Official Delegate Pass for ${selectedTicket.eventName} (${selectedTicket.registrationId})`,
                        });
                      } else if (typeof navigator !== "undefined" && navigator.share) {
                        await navigator.share({
                          title: "SRC Official Delegate Pass",
                          url: window.location.href,
                        });
                      }
                    } catch (e) {
                      console.warn(e);
                    }
                  }}
                  className="w-full sm:w-auto gap-2 bg-[#E78023] hover:bg-[#D26E17] text-white shadow-md"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share / Save Image</span>
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    const w = window.open("");
                    w?.document.write(`<img src="${previewImage}" style="max-width:100%; height:auto;" />`);
                  }}
                  className="w-full sm:w-auto gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Full Image</span>
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setPreviewImage(null)}
                  className="w-full sm:w-auto"
                >
                  Done
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal: Inspect Submitted Hub Form / Application Responses */}
        {selectedHubSubmission && (
          <Modal
            isOpen={!!selectedHubSubmission}
            onClose={() => setSelectedHubSubmission(null)}
            title={selectedHubSubmission.listingTitle}
            subtitle={`Ticket Ref: ${selectedHubSubmission.ticketCode} • Submitted on ${new Date(selectedHubSubmission.createdAt).toLocaleDateString()}`}
            maxWidth="3xl"
          >
            <div className="space-y-6">
              {/* Applicant Header Badge Bar */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Applicant</span>
                  <p className="font-bold text-slate-900 text-sm">{selectedHubSubmission.userName}</p>
                  <p className="text-slate-600 font-medium">{selectedHubSubmission.userEmail}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Department &amp; Year</span>
                  <p className="font-semibold text-slate-900">{selectedHubSubmission.userDepartment} • {selectedHubSubmission.userYear}</p>
                  {selectedHubSubmission.btId && (
                    <p className="font-mono text-slate-500 font-bold">BT ID: {selectedHubSubmission.btId}</p>
                  )}
                </div>
              </div>

              {/* Status & Timing */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Current Status:</span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border",
                    selectedHubSubmission.status === "approved" || selectedHubSubmission.status === "resolved"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : selectedHubSubmission.status === "rejected"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  )}>
                    {selectedHubSubmission.status?.toUpperCase() || "PENDING REVIEW"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  Reference: <span className="font-mono font-bold text-slate-700">{selectedHubSubmission.ticketCode}</span>
                </div>
              </div>

              {/* External link if provided */}
              {selectedHubSubmission.submissionLink && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Portfolio / Submission Link</span>
                  <a
                    href={selectedHubSubmission.submissionLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17458F] hover:underline"
                  >
                    <span>{selectedHubSubmission.submissionLink}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Submitted Q&A Answers */}
              <div className="space-y-3">
                <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#17458F]" />
                  <span>Recorded Form Responses</span>
                </h4>

                {selectedHubSubmission.answers && Object.keys(selectedHubSubmission.answers).length > 0 ? (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {Object.entries(selectedHubSubmission.answers).map(([key, val]) => {
                      const matchedListing = listings.find(
                        (l) => l.id === selectedHubSubmission.listingId || l.slug === selectedHubSubmission.listingSlug
                      );
                      const matchedQuestion = matchedListing?.customQuestions?.find((q) => q.id === key);
                      const questionTitle = matchedQuestion?.question || key.replace(/[-_]/g, " ");

                      return (
                        <div key={key} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                          <span className="font-bold text-slate-600 block text-[11px]">
                            {questionTitle}
                          </span>
                          <p className="font-semibold text-slate-900 bg-white p-2.5 rounded-xl border border-slate-200">
                            {Array.isArray(val) ? val.join(", ") : String(val)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-2xl text-center">
                    No custom question responses recorded.
                  </p>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setSelectedHubSubmission(null)}
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>

                {(() => {
                  const targetListing = listings.find(
                    (l) => l.id === selectedHubSubmission.listingId || l.slug === selectedHubSubmission.listingSlug
                  );
                  const canEdit = targetListing ? targetListing.allowResponseEditing !== false : true;
                  if (!canEdit) return null;

                  return (
                    <Link
                      href={`/hub/${selectedHubSubmission.listingSlug || selectedHubSubmission.listingId}?edit=true`}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Your Response</span>
                    </Link>
                  );
                })()}
              </div>
            </div>
          </Modal>
        )}

      </div>
    </div>
  );
}
