"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Share2, 
  FileText,
  Pencil,
  Lock,
  Building,
  Target,
  BellRing,
  CreditCard,
  Copy,
  ChevronRight,
  Maximize2,
  CalendarPlus,
  Compass
} from "lucide-react";
import { CancelRegistrationModal } from "@/components/registration/CancelRegistrationModal";
import { Badge } from "@/components/ui/Badge";
import { getDepartmentShortName, resolveCanonicalDepartmentName } from "@/lib/departmentsStore";
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
import { formatDesignationBadge, isExternalUser } from "@/lib/usersStore";
import { useAuth } from "@/context/AuthContext";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";
import { TicketPass } from "@/components/registration/TicketPass";
import { getStoredEvents, syncEventsFromFirestore, subscribeToEvents } from "@/lib/eventsStore";
import { 
  getAllRegistrationsFromFirestore, 
  subscribeToRegistrationsFromFirestore, 
  isTestPassRecord,
  isHubRecord,
  StudentRegistrationRecord 
} from "@/lib/firebase/firestore";
import { cn } from "@/lib/utils";
import { downloadPassAsImage } from "@/lib/passExport";
import { verifySrcMemberByBtId } from "@/lib/srcMembership";
import { 
  SrcDispatch, 
  SrcDispatchCategory 
} from "@/types/srcDispatch";
import { 
  getStoredSrcDispatches, 
  syncSrcDispatchesFromFirestore, 
  subscribeToSrcDispatches 
} from "@/lib/srcDispatchesStore";

export default function StudentDashboardPage() {
  const { user, openAuthModal, openProfileModal, logout } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [hubResponses, setHubResponses] = useState<ListingResponseRecord[]>([]);
  
  // Navigation & Sub-filters
  const [activeDashboardTab, setActiveDashboardTab] = useState<"passes" | "hub" | "src_portal" | "accreditation">("passes");
  const [passFilter, setPassFilter] = useState<"ALL" | "UPCOMING" | "CHECKED_IN">("ALL");
  const [srcFilter, setSrcFilter] = useState<"ALL" | "DIRECT" | "UPDATE" | "EVENT" | "PAYMENT">("ALL");

  // Interaction Modals
  const [selectedTicket, setSelectedTicket] = useState<RegistrationRecord | null>(null);
  const [cancellingTicket, setCancellingTicket] = useState<RegistrationRecord | null>(null);
  const [selectedHubSubmission, setSelectedHubSubmission] = useState<ListingResponseRecord | null>(null);
  const [selectedPaymentQrModal, setSelectedPaymentQrModal] = useState<SrcDispatch | null>(null);

  // States & Feedbacks
  const [isDownloadingTicket, setIsDownloadingTicket] = useState(false);
  const [ticketDownloadSuccess, setTicketDownloadSuccess] = useState(false);
  const [copiedBtId, setCopiedBtId] = useState(false);
  const [copiedUpiId, setCopiedUpiId] = useState<string | null>(null);

  // SRC Dispatches state
  const [srcDispatches, setSrcDispatches] = useState<SrcDispatch[]>([]);
  const [acknowledgedDues, setAcknowledgedDues] = useState<string[]>([]);

  // 1. Authoritative SRC Membership Verification
  const srcVerification = useMemo(() => {
    return verifySrcMemberByBtId(user?.btId, user?.displayName);
  }, [user?.btId, user?.displayName]);

  const isVerifiedSrcMember = srcVerification.isSrcMember || Boolean(user?.isCouncilOfficer);

  // Load acknowledged dues from local storage
  useEffect(() => {
    if (typeof window !== "undefined" && user?.uid) {
      try {
        const stored = localStorage.getItem(`src_ack_dues_${user.uid}`);
        if (stored) {
          setAcknowledgedDues(JSON.parse(stored));
        }
      } catch {}
    }
  }, [user?.uid]);

  const toggleAcknowledgeDue = (dispatchId: string) => {
    if (!user?.uid) return;
    setAcknowledgedDues((prev) => {
      const updated = prev.includes(dispatchId)
        ? prev.filter((id) => id !== dispatchId)
        : [...prev, dispatchId];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`src_ack_dues_${user.uid}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  };

  const copyToClipboard = (text: string, isUpi = false) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (isUpi) {
        setCopiedUpiId(text);
        setTimeout(() => setCopiedUpiId(null), 2500);
      } else {
        setCopiedBtId(true);
        setTimeout(() => setCopiedBtId(false), 2500);
      }
    }
  };

  const handleDownloadSelectedTicket = async () => {
    if (!selectedTicket || isDownloadingTicket) return;
    setIsDownloadingTicket(true);
    try {
      const res = await downloadPassAsImage(
        "src-delegate-pass-card",
        `${selectedTicket.registrationId}-${selectedTicket.eventName.replace(/\s+/g, "_")}_Pass.png`
      );
      if (res.success) {
        setTicketDownloadSuccess(true);
        setTimeout(() => setTicketDownloadSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Pass download error", e);
    } finally {
      setIsDownloadingTicket(false);
    }
  };

  // Generate iCal ICS download for Council Events
  const downloadCalendarEvent = (event: NonNullable<SrcDispatch["eventDetails"]>, title: string) => {
    const startDate = event.date.replace(/-/g, "");
    const icsData = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SRC JDCOEM//Council Conclave//EN",
      "BEGIN:VEVENT",
      `SUMMARY:${title}`,
      `DESCRIPTION:${event.agenda || "SRC JDCOEM Council Meeting"}`,
      `LOCATION:${event.venue}`,
      `DTSTART:${startDate}T090000Z`,
      `DTEND:${startDate}T110000Z`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", `${title.replace(/\s+/g, "_")}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load and Subscribe to Data
  useEffect(() => {
    let isCurrent = true;

    // Legacy backwards compatibility for pass scans
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const legacyPassId = urlParams.get("passId");
      if (legacyPassId) {
        window.location.replace(`/verify/${encodeURIComponent(legacyPassId)}`);
        return;
      }
    }

    // 1. Events
    setEvents(getStoredEvents());
    syncEventsFromFirestore().then((res) => {
      if (res && isCurrent) setEvents(res);
    });
    const unsubEvents = subscribeToEvents((remote) => {
      if (remote && isCurrent) setEvents(remote);
    });

    // 2. SRC Dispatches
    setSrcDispatches(getStoredSrcDispatches());
    syncSrcDispatchesFromFirestore().then((res) => {
      if (res && isCurrent) setSrcDispatches(res);
    });
    const unsubDispatches = subscribeToSrcDispatches((remote) => {
      if (remote && isCurrent) setSrcDispatches(remote);
    });

    const getEffectiveUser = () => {
      if (user) return user;
      if (typeof window !== "undefined") {
        try {
          const c = localStorage.getItem("src_auth_user");
          if (c) return JSON.parse(c);
        } catch {}
      }
      return null;
    };

    const formatStudentRecords = (rawRecords: any[], activeStoredEvents: EventItem[]): RegistrationRecord[] => {
      const effUser = getEffectiveUser();
      if (!effUser) return [];

      const cleanEmail = (effUser.email || "").trim().toLowerCase();
      const cleanBtId = (effUser.btId || "").trim().toUpperCase();
      const cleanName = (effUser.displayName || "").trim().toLowerCase();
      const cleanUid = (effUser.uid || "").trim();

      const validRecords = rawRecords.filter((r: any) => {
        if (!r || !r.id) return false;
        if (isTestPassRecord(r)) return false;
        if (isHubRecord(r)) return false;
        if (typeof r.id === "string" && r.id.startsWith("hub_")) return false;
        if (r.customAnswers?.isHubBallot || r.customAnswers?.isHubSubmission) return false;
        if (r.isPass === false) return false;
        if (typeof r.eventTitle === "string" && (r.eventTitle.startsWith("[POLL BALLOT]") || r.eventTitle.startsWith("[HUB]"))) return false;
        if (typeof r.eventName === "string" && (r.eventName.startsWith("[POLL BALLOT]") || r.eventName.startsWith("[HUB]"))) return false;
        return true;
      });

      const userMatched = validRecords.filter((r: any) => {
        const rEmail = (r.email || "").trim().toLowerCase();
        const rBtId = (r.btId || "").trim().toUpperCase();
        const rLeader = (r.leaderName || r.participantName || "").trim().toLowerCase();
        const rUid = (r.userId || r.uid || r.userUid || "").trim();
        const rQr = (r.qrPayload || "").trim();

        if (cleanUid && rUid && rUid === cleanUid) return true;
        if (cleanEmail && rEmail && rEmail === cleanEmail) return true;
        if (cleanBtId && rBtId && rBtId === cleanBtId) return true;
        if (cleanName && rLeader && rLeader.length > 2 && (rLeader === cleanName || rLeader.includes(cleanName) || cleanName.includes(rLeader))) return true;
        if (cleanBtId && cleanBtId.length > 3 && rQr && rQr.toUpperCase().includes(cleanBtId)) return true;
        if (cleanUid && cleanUid.length > 5 && rQr && rQr.includes(cleanUid)) return true;
        if (cleanEmail && cleanEmail.length > 4 && rQr && rQr.toLowerCase().includes(cleanEmail)) return true;

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
                (cleanBtId && cleanBtId.length > 3 && mUpper.includes(cleanBtId)) ||
                (cleanEmail && cleanEmail.length > 4 && mLower.includes(cleanEmail)) ||
                (cleanName && mLower.length > 2 && (mLower.includes(cleanName) || cleanName.includes(mLower)))
              );
            }
            if (typeof m === "object") {
              const mBtId = (m.btId || "").toUpperCase().trim();
              const mEmail = (m.email || "").toLowerCase().trim();
              const mName = (m.name || m.displayName || "").toLowerCase().trim();
              const mUid = (m.userId || m.uid || "").trim();
              return (
                (cleanUid && mUid && cleanUid.length > 5 && mUid === cleanUid) ||
                (cleanBtId && mBtId && cleanBtId.length > 3 && (mBtId === cleanBtId || mBtId.includes(cleanBtId) || cleanBtId.includes(mBtId))) ||
                (cleanEmail && mEmail && cleanEmail.length > 4 && (mEmail === cleanEmail || mEmail.includes(cleanEmail))) ||
                (cleanName && mName && mName.length > 2 && (mName === cleanName || mName.includes(cleanName) || cleanName.includes(mName)))
              );
            }
            return false;
          });
          if (isMember) return true;
        }

        return false;
      });

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

      return sortedPasses.map((r: any) => {
        const cleanBt = (r.btId || "").trim().toUpperCase();
        let rawDept = (r.department || "").trim();
        if (!rawDept || rawDept.toLowerCase().includes("b.tech") || rawDept.toLowerCase().includes("bachelor") || rawDept.toLowerCase().includes("data science") || rawDept.toLowerCase() === "ds") {
          if (cleanBt.endsWith("DS") || cleanBt.includes("DS") || rawDept.toLowerCase().includes("data science") || rawDept.toLowerCase() === "ds") {
            rawDept = "CSE(Data Science)";
          } else if (cleanBt.endsWith("CY") || cleanBt.includes("CY") || rawDept.toLowerCase().includes("cyber")) {
            rawDept = "CSE(Cyber Security)";
          } else if (cleanBt.endsWith("AI") || cleanBt.includes("AI") || rawDept.toLowerCase().includes("artificial intelligence")) {
            rawDept = "CSE(AI)";
          }
        }
        const canonicalDept = resolveCanonicalDepartmentName(rawDept);

        return {
          id: r.id,
          registrationId: r.id,
          eventSlug: r.eventId || r.eventSlug || "",
          eventName: r.eventTitle || r.eventName || "Event Delegate Pass",
          participantName: r.leaderName || r.participantName || "Delegate",
          email: r.email,
          phone: r.phone,
          department: canonicalDept,
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
          cancellationReason: r.cancellationReason,
          cancelledAt: r.cancelledAt,
          cancelledBy: r.cancelledBy,
          paymentId: r.paymentId,
          orderId: r.orderId,
          refundId: r.refundId,
          refundStatus: r.refundStatus,
          refundAmount: r.refundAmount,
          refundedAt: r.refundedAt,
        };
      });
    };

    // Synchronous hydration from local cache
    try {
      const initialLocal = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      if (Array.isArray(initialLocal) && initialLocal.length > 0) {
        const cleanedLocal = initialLocal.filter(
          (r: any) => !isTestPassRecord(r) && !isHubRecord(r) && !r?.id?.startsWith("hub_") && !r?.customAnswers?.isHubBallot && !r?.customAnswers?.isHubSubmission && !r?.eventTitle?.startsWith("[HUB]")
        );
        const instantFormatted = formatStudentRecords(cleanedLocal, getStoredEvents());
        if (instantFormatted.length > 0) {
          setRegistrations(instantFormatted);
          setIsInitialLoading(false);
        }
      }
    } catch {}

    const syncAndLoadRegistrations = async (cloudList?: StudentRegistrationRecord[]) => {
      try {
        const storedEvents = getStoredEvents();
        let allRecords: any[] = [];
        let remoteRecords = cloudList;
        if (!remoteRecords) {
          remoteRecords = await getAllRegistrationsFromFirestore();
        }

        if (!isCurrent) return;

        if (remoteRecords && Array.isArray(remoteRecords)) {
          allRecords = remoteRecords.filter(
            (r: any) => !isTestPassRecord(r) && !isHubRecord(r)
          );
          try {
            localStorage.setItem("src_local_registrations", JSON.stringify(allRecords));
          } catch {}
        } else {
          let local: any[] = [];
          try {
            local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
          } catch {}
          allRecords = Array.isArray(local)
            ? local.filter((r: any) => !isTestPassRecord(r) && !isHubRecord(r))
            : [];
        }

        const formatted = formatStudentRecords(allRecords, storedEvents);
        if (isCurrent) {
          setRegistrations(formatted);
          setIsInitialLoading(false);
        }
      } catch (e) {
        console.warn("Registrations sync error on student dashboard", e);
        if (isCurrent) setIsInitialLoading(false);
      }
    };

    syncAndLoadRegistrations();

    const unsubRegistrations = subscribeToRegistrationsFromFirestore((cloudRegs) => {
      if (isCurrent) syncAndLoadRegistrations(cloudRegs);
    });

    // 3. Listings & Hub Responses
    setListings(getStoredListings());
    syncListingsFromFirestore().then((res) => {
      if (res && isCurrent) setListings(res);
    });
    const unsubListings = subscribeToListings((remoteListings) => {
      if (remoteListings && isCurrent) setListings(remoteListings);
    });

    const updateResponses = (overrideList?: ListingResponseRecord[]) => {
      const allResp = overrideList || getStoredListingResponses();
      const effUser = getEffectiveUser();
      if (!effUser) {
        if (isCurrent) setHubResponses([]);
        return;
      }
      const uEmail = (effUser.email || "").toLowerCase().trim();
      const uId = effUser.uid;
      const uBtId = (effUser.btId || "").toUpperCase().trim();
      const uName = (effUser.displayName || "").toLowerCase().trim();

      const matched = allResp.filter((r) => {
        if (r.listingType === "poll" || r.id?.startsWith("hub_poll_")) return false;
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

      if (isCurrent) setHubResponses(matched);
    };

    updateResponses();
    syncListingResponsesFromFirestore().then((res) => {
      if (res && isCurrent) updateResponses(res);
    });

    const unsubHub = subscribeToListingResponses((remoteResponses) => {
      if (remoteResponses && isCurrent) updateResponses(remoteResponses);
    });

    return () => {
      isCurrent = false;
      unsubEvents();
      unsubDispatches();
      unsubRegistrations();
      unsubListings();
      unsubHub();
    };
  }, [user]);

  // Filtered SRC dispatches for this user
  const userSrcDispatches = useMemo(() => {
    if (!isVerifiedSrcMember) return [];
    const cleanBt = (user?.btId || "").trim().toUpperCase();
    return srcDispatches.filter((d) => {
      if (d.targetType === "all_members") return true;
      if (d.targetType === "single_member" && d.targetBtId && cleanBt) {
        return d.targetBtId.trim().toUpperCase() === cleanBt;
      }
      return false;
    });
  }, [srcDispatches, isVerifiedSrcMember, user?.btId]);

  const directDispatchesCount = useMemo(() => {
    const cleanBt = (user?.btId || "").trim().toUpperCase();
    if (!cleanBt) return 0;
    return userSrcDispatches.filter(
      (d) => d.targetType === "single_member" && d.targetBtId?.trim().toUpperCase() === cleanBt
    ).length;
  }, [userSrcDispatches, user?.btId]);

  const filteredSrcDispatches = useMemo(() => {
    const cleanBt = (user?.btId || "").trim().toUpperCase();
    return userSrcDispatches.filter((d) => {
      if (srcFilter === "DIRECT") {
        return d.targetType === "single_member" && d.targetBtId?.trim().toUpperCase() === cleanBt;
      }
      if (srcFilter === "UPDATE") return d.category === "update" || d.category === "notice";
      if (srcFilter === "EVENT") return d.category === "event";
      if (srcFilter === "PAYMENT") return d.category === "payment_qr";
      return true;
    });
  }, [userSrcDispatches, srcFilter, user?.btId]);

  // Filtered Passes
  const filteredPasses = useMemo(() => {
    return registrations.filter((r) => {
      if (passFilter === "CHECKED_IN") return r.status === "CHECKED_IN";
      if (passFilter === "UPCOMING") return r.status !== "CHECKED_IN" && r.status !== "CANCELLED";
      return true;
    });
  }, [registrations, passFilter]);

  // User details presentation
  const isFaculty = user?.userType === "FACULTY" || user?.role === "FACULTY";
  const isExternal = isExternalUser(user);
  const displayName = user?.displayName || user?.name || "Delegate";
  const firstName = displayName.split(" ")[0] || "Delegate";
  const displayBtId = user?.btId?.toUpperCase() || (isFaculty ? user?.employeeId || "STAFF" : isExternal ? "EXTERNAL" : "BT ID PENDING");
  const displayDepartment = user?.department || user?.facultyDepartment || (isExternal ? user?.collegeName || "Inter-College" : "Department Pending");
  const displayYear = user?.year || (isFaculty ? "Faculty Staff" : "Student");

  // Dynamic time greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // -------------------------------------------------------------
  // RENDER: Unauthenticated State
  // -------------------------------------------------------------
  if (!user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full rounded-3xl bg-gradient-to-b from-[#0F172A] via-[#162544] to-[#0B132B] text-white p-8 sm:p-10 shadow-2xl border border-slate-700/60 relative overflow-hidden text-center space-y-6">
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-[#E78023]/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-[#17458F]/40 rounded-full blur-3xl pointer-events-none" />

          <div className="relative mx-auto w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
            <Ticket className="w-10 h-10 text-[#E78023]" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-extrabold tracking-widest uppercase px-3 py-1 rounded-full bg-white/10 text-amber-300 border border-white/15">
              Portal Access Required
            </span>
            <h1 className="font-heading font-extrabold text-2xl text-white tracking-tight uppercase">
              Student Delegate Portal
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Sign in with your verified JDCOEM college account or registered visitor credentials to access your live event passes, hub submissions, and council accreditation.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              onClick={openAuthModal}
              variant="primary"
              size="lg"
              className="w-full justify-center gap-2 font-bold shadow-lg shadow-[#E78023]/30 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Sign In to Dashboard</span>
            </Button>

            <Link
              href="/events"
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold transition-all border border-white/10"
            >
              <span>Explore Public Events</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Authenticated Dashboard
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans antialiased overflow-x-hidden">
      
      {/* 1. HERO & IDENTITY EXECUTIVE BANNER */}
      <section className="relative bg-gradient-to-br from-[#0B132B] via-[#0F172A] to-[#17458F] text-white pt-8 pb-12 px-4 sm:px-6 lg:px-8 border-b border-slate-800 overflow-hidden">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-[#E78023]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-24 w-80 h-80 bg-[#17458F]/40 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 space-y-6">
          
          {/* Top Status & Role Pill Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 text-slate-300 border border-white/15 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>STUDENT DELEGATE PORTAL</span>
              </span>

              {isVerifiedSrcMember ? (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1.5 shadow-xs">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {srcVerification.designationBadge 
                      ? formatDesignationBadge(srcVerification.designationBadge) 
                      : user.designationBadge 
                      ? formatDesignationBadge(user.designationBadge) 
                      : "COUNCIL OFFICER"}
                  </span>
                </span>
              ) : (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                  <span>{isFaculty ? "ACADEMIC STAFF" : isExternal ? "VISITING DELEGATE" : "JDCOEM STUDENT"}</span>
                </span>
              )}
            </div>
          </div>

          {/* Main Hero Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs sm:text-sm font-semibold text-slate-300 tracking-wide uppercase">
                {greeting},
              </p>
              <h1 className="font-heading font-black text-3xl sm:text-4xl md:text-5xl text-white tracking-tight uppercase leading-none">
                {displayName}
              </h1>

              {/* Detailed credentials strip */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300 pt-2">
                {/* BT ID Chip with 1-click Copy */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(displayBtId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-slate-200 border border-slate-700/80 font-mono font-bold transition-all cursor-pointer group"
                  title="Click to copy BT ID"
                >
                  <span className="text-[#E78023]">{displayBtId}</span>
                  {copiedBtId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-white" />
                  )}
                  {copiedBtId && <span className="text-[10px] text-emerald-400 font-sans">Copied!</span>}
                </button>

                <span className="hidden sm:inline text-slate-600">•</span>
                <span className="font-medium text-slate-200">{displayDepartment}</span>
                <span className="hidden sm:inline text-slate-600">•</span>
                <span className="text-slate-300">{displayYear}</span>
              </div>
            </div>

            {/* Quick Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
              <Button
                onClick={openProfileModal}
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs py-2.5 px-4 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                <span>Edit Profile</span>
              </Button>

              <Link
                href="/events"
                className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#E78023] hover:bg-[#d57017] text-white font-bold text-xs shadow-md shadow-[#E78023]/20 transition-all cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Explore Events</span>
              </Link>

              <Button
                onClick={() => logout()}
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-white/10 font-bold text-xs py-2.5 px-3 cursor-pointer"
                title="Sign out of student account"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. STATS & KPI RIBBON */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Card 1: Active Passes */}
          <div 
            onClick={() => setActiveDashboardTab("passes")}
            className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active Passes
              </span>
              <div className="h-8 w-8 rounded-xl bg-orange-50 text-[#E78023] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Ticket className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading font-black text-2xl text-slate-900">
              {registrations.filter((r) => r.status !== "CHECKED_IN" && r.status !== "CANCELLED").length}
            </p>
            <p className="text-[11px] text-slate-500 font-medium truncate pt-1">
              Ready for campus check-in
            </p>
          </div>

          {/* Card 2: Events Attended */}
          <div 
            onClick={() => {
              setActiveDashboardTab("passes");
              setPassFilter("CHECKED_IN");
            }}
            className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Events Attended
              </span>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading font-black text-2xl text-emerald-700">
              {registrations.filter((r) => r.status === "CHECKED_IN").length}
            </p>
            <p className="text-[11px] text-slate-500 font-medium truncate pt-1">
              Verified attendance records
            </p>
          </div>

          {/* Card 3: Engagement Hub */}
          <div 
            onClick={() => setActiveDashboardTab("hub")}
            className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Hub Activity
              </span>
              <div className="h-8 w-8 rounded-xl bg-blue-50 text-[#17458F] flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading font-black text-2xl text-[#17458F]">
              {hubResponses.length}
            </p>
            <p className="text-[11px] text-slate-500 font-medium truncate pt-1">
              Contests, ballots & tickets
            </p>
          </div>

          {/* Card 4: Accreditation Clearance */}
          <div 
            onClick={() => {
              if (isVerifiedSrcMember) {
                setActiveDashboardTab("src_portal");
              } else {
                setActiveDashboardTab("accreditation");
              }
            }}
            className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Accreditation Level
              </span>
              <div className="h-8 w-8 rounded-xl bg-amber-50 text-[#E78023] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading font-black text-2xl text-slate-900 truncate">
              {isVerifiedSrcMember 
                ? (srcVerification.level || "Council Member") 
                : isFaculty 
                ? "Faculty Staff" 
                : "Student Delegate"}
            </p>
            <p className="text-[11px] text-slate-500 font-medium truncate pt-1">
              {isVerifiedSrcMember ? "Executive access authorized" : "Universal badge issued"}
            </p>
          </div>

        </div>
      </section>

      {/* 3. MAIN DASHBOARD CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        
        {/* Navigation Switcher Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 gap-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            
            {/* Tab 1: EXCLUSIVE SRC MEMBER PORTAL (ONLY FOR VERIFIED SRC MEMBERS - FIRST POSITION) */}
            {isVerifiedSrcMember && (
              <button
                type="button"
                onClick={() => setActiveDashboardTab("src_portal")}
                className={`px-4 py-2.5 rounded-xl font-heading font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  activeDashboardTab === "src_portal"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/25"
                    : "bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 hover:brightness-95 border border-amber-300/80"
                }`}
              >
                <Award className="w-4 h-4 text-amber-300" />
                <span>SRC Operations</span>
                {directDispatchesCount > 0 ? (
                  <span className="bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full animate-pulse">
                    {directDispatchesCount} Direct
                  </span>
                ) : (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeDashboardTab === "src_portal" ? "bg-white/20 text-white" : "bg-amber-200/70 text-amber-900 font-bold"
                  }`}>
                    {userSrcDispatches.length}
                  </span>
                )}
              </button>
            )}

            {/* Tab 2: Event Passes ("Event Passes" on PC, "Pass" on Mobile) */}
            <button
              type="button"
              onClick={() => setActiveDashboardTab("passes")}
              className={`px-4 py-2.5 rounded-xl font-heading font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeDashboardTab === "passes"
                  ? "bg-[#17458F] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span className="hidden sm:inline">Event Passes</span>
              <span className="sm:hidden">Pass</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeDashboardTab === "passes" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700 font-bold"
              }`}>
                {registrations.length}
              </span>
            </button>

            {/* Tab 3: Hub Activity ("Hub Activity" on PC, "Hub" on Mobile) */}
            <button
              type="button"
              onClick={() => setActiveDashboardTab("hub")}
              className={`px-4 py-2.5 rounded-xl font-heading font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeDashboardTab === "hub"
                  ? "bg-[#17458F] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Hub Activity</span>
              <span className="sm:hidden">Hub</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeDashboardTab === "hub" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700 font-bold"
              }`}>
                {hubResponses.length}
              </span>
            </button>

            {/* Tab 4: Mobile-only Accreditation Card Tab */}
            <button
              type="button"
              onClick={() => setActiveDashboardTab("accreditation")}
              className={`lg:hidden px-4 py-2.5 rounded-xl font-heading font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeDashboardTab === "accreditation"
                  ? "bg-[#17458F] text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Digital Accreditation</span>
              <span className="sm:hidden">Badge</span>
            </button>
          </div>

          <div className="text-xs font-semibold text-slate-400 hidden sm:block">
            {activeDashboardTab === "src_portal" 
              ? "Verified Council Session" 
              : `Total Active Records: ${registrations.length + hubResponses.length}`}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: THE EXCLUSIVE SRC COUNCIL MEMBER EXECUTIVE SUITE */}
        {/* ------------------------------------------------------------- */}
        {activeDashboardTab === "src_portal" && isVerifiedSrcMember && (
          <div className="space-y-6">
            
            {/* VIP Council Header Banner */}
            <div className="rounded-3xl bg-gradient-to-br from-[#0B132B] via-[#111C35] to-[#0A1024] text-white p-6 sm:p-8 relative overflow-hidden shadow-xl border border-amber-500/30">
              <div className="absolute top-0 right-0 -mt-16 -mr-16 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/4 -mb-16 w-72 h-72 bg-[#17458F]/40 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold uppercase tracking-widest">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span>VERIFIED SRC COUNCIL MEMBER • {srcVerification.level || "Central Governance"}</span>
                  </div>

                  <h2 className="font-heading font-black text-2xl sm:text-3xl text-white tracking-tight uppercase">
                    SRC Central Dispatch & Council Headquarters
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    Welcome to the private operational desk for Student Representative Council officers. Receive synchronized administrative directives, conclave schedules, and official payment reconciliations for council kits and dues.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center shrink-0 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Your Council Clearance
                  </span>
                  <p className="font-heading font-extrabold text-base text-amber-300">
                    {srcVerification.designationBadge || user.designationBadge || "Council Officer"}
                  </p>
                  <p className="text-[11px] font-mono text-slate-300">
                    BT ID: {displayBtId}
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-Filters for SRC Portal */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSrcFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    srcFilter === "ALL"
                      ? "bg-[#17458F] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All Dispatches ({userSrcDispatches.length})
                </button>

                {directDispatchesCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSrcFilter("DIRECT")}
                    className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                      srcFilter === "DIRECT"
                        ? "bg-[#E78023] text-white shadow-xs"
                        : "bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300"
                    }`}
                  >
                    <Target className="w-3 h-3" />
                    <span>Direct to Me ({directDispatchesCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSrcFilter("UPDATE")}
                  className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    srcFilter === "UPDATE"
                      ? "bg-[#17458F] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Notices & Updates
                </button>

                <button
                  type="button"
                  onClick={() => setSrcFilter("EVENT")}
                  className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    srcFilter === "EVENT"
                      ? "bg-[#17458F] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Council Meets
                </button>

                <button
                  type="button"
                  onClick={() => setSrcFilter("PAYMENT")}
                  className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    srcFilter === "PAYMENT"
                      ? "bg-[#17458F] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Payment QRs & Dues
                </button>
              </div>

              <span className="text-[11px] text-slate-400 font-medium">
                Live Cloud Synchronized
              </span>
            </div>

            {/* Dispatches Feed */}
            <div className="space-y-4">
              {filteredSrcDispatches.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-white border border-dashed border-slate-200 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto text-[#E78023]">
                    <BellRing className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading font-bold text-base text-slate-800">No Dispatches in this View</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    There are no current notices or payment dues under this filter. Check back soon for council updates.
                  </p>
                </div>
              ) : (
                filteredSrcDispatches.map((item) => {
                  const isDirect = item.targetType === "single_member";
                  const isPayment = item.category === "payment_qr";
                  const isEvent = item.category === "event";
                  const isAcknowledged = acknowledgedDues.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-3xl border transition-all p-5 sm:p-7 shadow-xs hover:shadow-md ${
                        isDirect
                          ? "bg-gradient-to-br from-amber-50/40 via-white to-orange-50/20 border-amber-300"
                          : item.priority === "urgent"
                          ? "bg-rose-50/30 border-rose-300"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="space-y-4">
                        
                        {/* Header metadata */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Direct Target Pill */}
                            {isDirect && (
                              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E78023] text-white flex items-center gap-1 shadow-xs">
                                <Target className="w-3 h-3" />
                                <span>Direct Dispatch to Your BT ID</span>
                              </span>
                            )}

                            {/* Priority */}
                            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider ${
                              item.priority === "urgent"
                                ? "bg-rose-500 text-white animate-pulse"
                                : item.priority === "important"
                                ? "bg-amber-500 text-white"
                                : "bg-blue-600 text-white"
                            }`}>
                              {item.priority}
                            </span>

                            {/* Category */}
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {item.category.replace("_", " ")}
                            </span>

                            {item.badgeText && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
                                {item.badgeText}
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400 font-medium">
                            {new Date(item.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                          </div>
                        </div>

                        {/* Title */}
                        <div>
                          <h3 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900 leading-snug">
                            {item.title}
                          </h3>
                        </div>

                        {/* Message Content */}
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans max-w-4xl">
                          {item.content}
                        </p>

                        {/* Event Details Card */}
                        {isEvent && item.eventDetails && (
                          <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1.5 text-xs text-[#17458F]">
                              <div className="flex items-center gap-2 font-bold text-sm">
                                <Calendar className="w-4 h-4 text-[#17458F]" />
                                <span>{item.eventDetails.eventName}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-slate-700">
                                <span className="font-semibold text-slate-900">{item.eventDetails.date}</span>
                                {item.eventDetails.time && <span>• {item.eventDetails.time}</span>}
                                <span>• 📍 {item.eventDetails.venue}</span>
                              </div>
                              {item.eventDetails.agenda && (
                                <p className="text-[11px] text-slate-500 pt-0.5">
                                  Agenda: {item.eventDetails.agenda}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                onClick={() => downloadCalendarEvent(item.eventDetails!, item.title)}
                                variant="outline"
                                size="sm"
                                className="bg-white text-xs font-bold gap-1.5 text-[#17458F] border-blue-300 hover:bg-blue-100 cursor-pointer"
                              >
                                <CalendarPlus className="w-3.5 h-3.5" />
                                <span>Add to Calendar</span>
                              </Button>

                              {item.eventDetails.actionUrl && (
                                <a
                                  href={item.eventDetails.actionUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                                >
                                  <span>Join Meeting</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Payment QR Card */}
                        {isPayment && item.paymentDetails && (
                          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50 via-white to-purple-50/50 border border-purple-200 shadow-xs space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                                    ₹
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Official Council Dues</p>
                                    <p className="font-heading font-black text-2xl text-purple-950 leading-none">
                                      ₹{item.paymentDetails.amount}
                                    </p>
                                  </div>
                                </div>

                                <p className="text-xs font-bold text-slate-800">
                                  Purpose: {item.paymentDetails.purpose}
                                </p>

                                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                                  <span className="text-slate-600">UPI ID:</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(item.paymentDetails!.upiId, true)}
                                    className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold flex items-center gap-1 transition-all cursor-pointer"
                                  >
                                    <span>{item.paymentDetails.upiId}</span>
                                    {copiedUpiId === item.paymentDetails.upiId ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-purple-600" />
                                    )}
                                    {copiedUpiId === item.paymentDetails.upiId && (
                                      <span className="text-[9px] text-emerald-700 font-sans font-bold">Copied!</span>
                                    )}
                                  </button>
                                </div>

                                {item.paymentDetails.deadline && (
                                  <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Clearance Deadline: {item.paymentDetails.deadline}</span>
                                  </p>
                                )}

                                {item.paymentDetails.note && (
                                  <p className="text-[11px] text-slate-500 italic max-w-xl">
                                    {item.paymentDetails.note}
                                  </p>
                                )}
                              </div>

                              {/* Interactive QR Code Component */}
                              <div className="flex flex-col items-center gap-2 shrink-0">
                                <div 
                                  onClick={() => setSelectedPaymentQrModal(item)}
                                  className="relative p-2 rounded-2xl bg-white border border-purple-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                  title="Click to expand full QR code"
                                >
                                  {item.paymentDetails.qrImageUrl ? (
                                    <div className="relative h-28 w-28 rounded-xl overflow-hidden">
                                      <Image
                                        src={item.paymentDetails.qrImageUrl}
                                        alt="Official Payment QR"
                                        fill
                                        unoptimized={true}
                                        className="object-contain"
                                      />
                                    </div>
                                  ) : (
                                    <ScannableQRCode
                                      value={`upi://pay?pa=${item.paymentDetails.upiId}&pn=${encodeURIComponent(item.paymentDetails.payeeName)}&am=${item.paymentDetails.amount}&cu=INR`}
                                      size={112}
                                    />
                                  )}
                                  <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center text-white">
                                    <Maximize2 className="w-5 h-5" />
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium">Click to enlarge QR</span>
                              </div>
                            </div>

                            {/* Payment Actions Row */}
                            <div className="pt-3 border-t border-purple-100 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <a
                                  href={`upi://pay?pa=${item.paymentDetails.upiId}&pn=${encodeURIComponent(item.paymentDetails.payeeName)}&am=${item.paymentDetails.amount}&cu=INR`}
                                  className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Pay via UPI App</span>
                                </a>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedPaymentQrModal(item)}
                                  className="text-xs font-semibold text-purple-900 border-purple-300 hover:bg-purple-50 cursor-pointer"
                                >
                                  <QrCode className="w-3.5 h-3.5 mr-1" />
                                  <span>View Full QR</span>
                                </Button>
                              </div>

                              {/* Acknowledge Clearance Toggle */}
                              <button
                                type="button"
                                onClick={() => toggleAcknowledgeDue(item.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isAcknowledged
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                                }`}
                              >
                                <CheckCircle2 className={`w-3.5 h-3.5 ${isAcknowledged ? "text-emerald-600" : "text-slate-400"}`} />
                                <span>{isAcknowledged ? "Marked as Cleared" : "Mark as Paid"}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Author signature footer */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>Issued by: <strong className="text-slate-700 font-semibold">{item.authorName}</strong> ({item.authorRole || "Secretariat"})</span>
                          </div>
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Verified Central Dispatch</span>
                          </span>
                        </div>

                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: EVENT PASSES & TICKETS */}
        {/* ------------------------------------------------------------- */}
        {activeDashboardTab === "passes" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left 8 Cols: Passes List & Filters */}
            <div className="lg:col-span-8 space-y-5">
              
              {/* Filter sub-tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPassFilter("ALL")}
                    className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      passFilter === "ALL"
                        ? "bg-[#17458F] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All Passes ({registrations.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setPassFilter("UPCOMING")}
                    className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      passFilter === "UPCOMING"
                        ? "bg-[#17458F] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Upcoming & Active
                  </button>

                  <button
                    type="button"
                    onClick={() => setPassFilter("CHECKED_IN")}
                    className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      passFilter === "CHECKED_IN"
                        ? "bg-[#17458F] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Attended ({registrations.filter((r) => r.status === "CHECKED_IN").length})
                  </button>
                </div>

                <Link
                  href="/events"
                  className="text-xs font-bold text-[#E78023] hover:text-[#d57017] flex items-center gap-1"
                >
                  <span>Explore More</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Passes Cards List */}
              {isInitialLoading ? (
                <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <RefreshCw className="w-8 h-8 text-[#E78023] animate-spin mx-auto" />
                  <p className="font-heading font-bold text-sm text-slate-700">Loading your verified passes...</p>
                </div>
              ) : filteredPasses.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-white border border-dashed border-slate-200 shadow-xs space-y-4">
                  <div className="w-14 h-14 rounded-3xl bg-orange-50 text-[#E78023] flex items-center justify-center mx-auto shadow-inner">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-heading font-bold text-lg text-slate-800">
                      {passFilter === "CHECKED_IN" ? "No Past Attended Events" : "No Active Event Passes Yet"}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Explore ongoing collegiate festivals, hackathons, cultural contests, and workshops to claim your scannable pass.
                    </p>
                  </div>
                  <Link
                    href="/events"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#E78023] hover:bg-[#d57017] text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-[#E78023]/20 transition-all cursor-pointer"
                  >
                    <span>Browse College Events</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPasses.map((pass) => {
                    const matchedEvent = events.find((e) => e.slug === pass.eventSlug || e.id === pass.eventSlug);
                    const isCheckedIn = pass.status === "CHECKED_IN";
                    const isCancelled = pass.status === "CANCELLED";

                    return (
                      <div
                        key={pass.id}
                        className={`rounded-3xl border transition-all p-5 sm:p-6 bg-white shadow-xs hover:shadow-md ${
                          isCheckedIn 
                            ? "border-emerald-200 bg-emerald-50/10" 
                            : isCancelled 
                            ? "border-slate-200 opacity-60" 
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
                          
                          {/* Event Thumbnail & Details */}
                          <div className="flex items-start gap-4 flex-1">
                            {matchedEvent?.posterImage || matchedEvent?.cardImage || matchedEvent?.poster ? (
                              <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl overflow-hidden shrink-0 border border-slate-200 shadow-xs">
                                <Image
                                  src={matchedEvent.posterImage || matchedEvent.cardImage || matchedEvent.poster}
                                  alt={pass.eventName}
                                  fill
                                  unoptimized={true}
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-[#0F172A] text-white flex flex-col items-center justify-center shrink-0 p-2 text-center">
                                <Ticket className="w-6 h-6 text-[#E78023] mb-1" />
                                <span className="text-[9px] font-bold uppercase tracking-wider line-clamp-1">
                                  {pass.teamType}
                                </span>
                              </div>
                            )}

                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                                  isCheckedIn
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : isCancelled
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-orange-100 text-orange-900 border border-orange-300"
                                }`}>
                                  {isCheckedIn ? "Attended & Checked In" : isCancelled ? "Cancelled" : "Confirmed Pass"}
                                </span>

                                <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  {pass.teamType} Pass
                                </span>

                                <span className="text-[10px] font-mono text-slate-400">
                                  #{pass.ticketCode}
                                </span>
                              </div>

                              <h4 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 truncate">
                                {pass.eventName}
                              </h4>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                {matchedEvent?.date && (
                                  <span className="flex items-center gap-1 font-medium">
                                    <Calendar className="w-3.5 h-3.5 text-[#17458F]" />
                                    <span>{matchedEvent.date}</span>
                                  </span>
                                )}
                                {matchedEvent?.venue && (
                                  <span className="flex items-center gap-1 truncate text-slate-500">
                                    <MapPin className="w-3.5 h-3.5 text-[#E78023]" />
                                    <span>{matchedEvent.venue}</span>
                                  </span>
                                )}
                              </div>

                              {pass.teamMembers && pass.teamMembers.length > 0 && (
                                <p className="text-[11px] text-slate-500 truncate pt-0.5">
                                  Squad: <strong className="text-slate-700">{pass.teamMembers.join(", ")}</strong>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Quick Pass Actions */}
                          <div className="flex sm:flex-col items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            <Button
                              onClick={() => setSelectedTicket(pass)}
                              variant="primary"
                              size="sm"
                              className="font-bold text-xs gap-1.5 shadow-sm shadow-[#E78023]/20 cursor-pointer w-full sm:w-auto"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>View QR Pass</span>
                            </Button>

                            {!isCheckedIn && !isCancelled && (
                              <button
                                type="button"
                                onClick={() => setCancellingTicket(pass)}
                                className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors py-1 cursor-pointer"
                              >
                                Cancel Pass
                              </button>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right 4 Cols: Persistent Digital Student / Council Accreditation Card */}
            <div className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider text-slate-700">
                  Digital Accreditation Pass
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  VERIFIED
                </span>
              </div>

              {/* Accreditation Badge Card */}
              <div className="rounded-3xl bg-gradient-to-br from-[#0B132B] via-[#111C35] to-[#0A1024] text-white p-6 shadow-xl border border-slate-700 relative overflow-hidden space-y-5">
                <div className="absolute top-0 right-0 -mr-12 -mt-12 w-44 h-44 bg-[#E78023]/15 rounded-full blur-2xl pointer-events-none" />

                {/* Top Seal */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="relative h-10 w-10 rounded-xl bg-white p-1 shrink-0">
                      <Image
                        src="/assets/SRC Logo.png"
                        alt="SRC Official Seal"
                        fill
                        unoptimized={true}
                        className="object-contain"
                      />
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#E78023]">
                        {isVerifiedSrcMember ? "COUNCIL CREDENTIAL" : "JDCOEM NAGPUR"}
                      </p>
                      <h4 className="font-heading font-bold text-sm text-white">
                        {isVerifiedSrcMember ? "COUNCIL OFFICER" : "STUDENT DELEGATE"}
                      </h4>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300">
                    2025-26
                  </span>
                </div>

                {/* Role Designation Strip if Council */}
                {isVerifiedSrcMember && (
                  <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">
                      {srcVerification.designationBadge || user.designationBadge || "Council Officer"}
                    </span>
                  </div>
                )}

                {/* Member Data */}
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Full Name</span>
                    <p className="font-heading font-extrabold text-base text-white truncate">{displayName}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Department</span>
                      <p className="font-semibold text-slate-200 truncate">{getDepartmentShortName(displayDepartment)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">College BT ID</span>
                      <p className="font-mono font-bold text-[#E78023] truncate">{displayBtId}</p>
                    </div>
                  </div>
                </div>

                {/* Universal Scannable QR Code */}
                <div className="p-4 rounded-2xl bg-white text-slate-900 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Campus Check-In Pass</p>
                    <p className="font-mono text-xs font-bold text-[#17458F]">SRC:ACC:{displayBtId}</p>
                    <p className="text-[10px] text-slate-500">Scan at entry gates</p>
                  </div>
                  <div className="shrink-0">
                    <ScannableQRCode
                      value={`https://srcjdcoem.in/verify/${encodeURIComponent(displayBtId)}`}
                      size={60}
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Authorized by JDCOEM SRC</span>
                  <button
                    type="button"
                    onClick={openProfileModal}
                    className="text-[#E78023] hover:underline font-semibold"
                  >
                    Edit Info
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: ENGAGEMENT HUB ACTIVITY */}
        {/* ------------------------------------------------------------- */}
        {activeDashboardTab === "hub" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-sm text-slate-800 uppercase tracking-wider">
                  Campus Engagement Hub Submissions
                </h3>
                <p className="text-xs text-slate-500">
                  Track the status of your committee applications, contest entries, suggestions, and grievance tickets.
                </p>
              </div>
              <Link
                href="/hub"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#17458F] text-white text-xs font-bold hover:bg-[#123670] transition-all cursor-pointer"
              >
                <span>Visit Hub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {hubResponses.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-white border border-dashed border-slate-200 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#17458F] flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="font-heading font-bold text-base text-slate-800">No Hub Submissions Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Participate in open applications, photo challenges, student voice polls, or submit campus feedback.
                </p>
                <Link
                  href="/hub"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E78023] text-white text-xs font-bold uppercase tracking-wider shadow-sm"
                >
                  Explore Hub Openings
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hubResponses.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedHubSubmission(item)}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-blue-50 text-[#17458F] border border-blue-200">
                        {item.listingType || "Application"}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.createdAt || (item as any).submittedAt || Date.now()).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </span>
                    </div>

                    <h4 className="font-heading font-extrabold text-base text-slate-900 line-clamp-1">
                      {item.listingTitle || "Engagement Submission"}
                    </h4>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Status:</span>
                      <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded ${
                        item.status === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.status === "rejected"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-900"
                      }`}>
                        {item.status || "Submitted"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: MOBILE ACCREDITATION CARD VIEW */}
        {/* ------------------------------------------------------------- */}
        {activeDashboardTab === "accreditation" && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="rounded-3xl bg-gradient-to-br from-[#0B132B] via-[#111C35] to-[#0A1024] text-white p-6 sm:p-8 shadow-2xl border border-slate-700 relative overflow-hidden space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-11 w-11 rounded-xl bg-white p-1 shrink-0">
                    <Image
                      src="/assets/SRC Logo.png"
                      alt="SRC Official Seal"
                      fill
                      unoptimized={true}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#E78023]">
                      {isVerifiedSrcMember ? "COUNCIL CREDENTIAL" : "JDCOEM NAGPUR"}
                    </p>
                    <h4 className="font-heading font-bold text-base text-white">
                      {isVerifiedSrcMember ? "COUNCIL OFFICER" : "STUDENT DELEGATE"}
                    </h4>
                  </div>
                </div>

                <span className="text-xs font-mono px-2.5 py-1 rounded bg-white/10 text-slate-300">
                  2025-26
                </span>
              </div>

              {isVerifiedSrcMember && (
                <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">
                    {srcVerification.designationBadge || user.designationBadge || "Council Officer"}
                  </span>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Full Name</span>
                  <p className="font-heading font-extrabold text-lg text-white">{displayName}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Department</span>
                    <p className="font-semibold text-slate-200">{displayDepartment}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">College BT ID</span>
                    <p className="font-mono font-bold text-[#E78023]">{displayBtId}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white text-slate-900 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Universal Check-In Pass</p>
                  <p className="font-mono text-xs font-bold text-[#17458F]">SRC:ACC:{displayBtId}</p>
                  <p className="text-[10px] text-slate-500">Scan at collegiate event gates</p>
                </div>
                <div className="shrink-0">
                  <ScannableQRCode
                    value={`https://srcjdcoem.in/verify/${encodeURIComponent(displayBtId)}`}
                    size={72}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: PASS VIEWER MODAL */}
      {/* ------------------------------------------------------------- */}
      {selectedTicket && (
        <Modal
          isOpen={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          title="Digital Delegate Pass"
          maxWidth="xl"
          contentClassName="max-h-[90vh] overflow-y-auto"
        >
          <div className="space-y-4 pt-2">
            <div id="src-delegate-pass-card">
              <TicketPass
                registrationId={selectedTicket.id}
                eventName={selectedTicket.eventName}
                eventDate={events.find((e) => e.slug === selectedTicket.eventSlug || e.id === selectedTicket.eventSlug)?.date || selectedTicket.registeredAt}
                eventVenue={events.find((e) => e.slug === selectedTicket.eventSlug || e.id === selectedTicket.eventSlug)?.venue || "Campus Venue"}
                participantName={selectedTicket.participantName}
                department={selectedTicket.department}
                year={selectedTicket.year}
                teamType={selectedTicket.teamType}
                teamName={selectedTicket.teamName}
                teamMembers={selectedTicket.teamMembers}
                ticketCode={selectedTicket.ticketCode}
                status={selectedTicket.status}
                paymentStatus={selectedTicket.paymentStatus}
                paymentId={selectedTicket.paymentId}
                mode="dashboard"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTicket(null)}
                className="w-full sm:w-auto cursor-pointer"
              >
                Close
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadSelectedTicket}
                disabled={isDownloadingTicket}
                className="w-full sm:w-auto font-bold gap-2 cursor-pointer shadow-md shadow-[#E78023]/20"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloadingTicket ? "Exporting PNG..." : ticketDownloadSuccess ? "Pass Saved!" : "Download Pass (PNG)"}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: CANCEL PASS MODAL */}
      {/* ------------------------------------------------------------- */}
      {cancellingTicket && (
        <CancelRegistrationModal
          isOpen={Boolean(cancellingTicket)}
          onClose={() => setCancellingTicket(null)}
          registration={cancellingTicket}
          onCancelled={() => {
            setRegistrations((prev) => prev.filter((r) => r.id !== cancellingTicket.id));
            setCancellingTicket(null);
          }}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: ENLARGED PAYMENT QR MODAL */}
      {/* ------------------------------------------------------------- */}
      {selectedPaymentQrModal && selectedPaymentQrModal.paymentDetails && (
        <Modal
          isOpen={Boolean(selectedPaymentQrModal)}
          onClose={() => setSelectedPaymentQrModal(null)}
          title="Official Council Payment QR"
          maxWidth="md"
        >
          <div className="p-2 space-y-5 text-center">
            <div className="space-y-1">
              <h4 className="font-heading font-extrabold text-xl text-slate-900">
                {selectedPaymentQrModal.paymentDetails.purpose}
              </h4>
              <p className="font-heading font-black text-3xl text-purple-700">
                ₹{selectedPaymentQrModal.paymentDetails.amount}
              </p>
            </div>

            {/* High-density QR view */}
            <div className="mx-auto p-4 rounded-3xl bg-white border-2 border-purple-200 shadow-md inline-block">
              {selectedPaymentQrModal.paymentDetails.qrImageUrl ? (
                <div className="relative h-64 w-64 rounded-2xl overflow-hidden">
                  <Image
                    src={selectedPaymentQrModal.paymentDetails.qrImageUrl}
                    alt="Enlarged Payment QR"
                    fill
                    unoptimized={true}
                    className="object-contain"
                  />
                </div>
              ) : (
                <ScannableQRCode
                  value={`upi://pay?pa=${selectedPaymentQrModal.paymentDetails.upiId}&pn=${encodeURIComponent(selectedPaymentQrModal.paymentDetails.payeeName)}&am=${selectedPaymentQrModal.paymentDetails.amount}&cu=INR`}
                  size={240}
                />
              )}
            </div>

            {/* Payment Details */}
            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-950 space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">UPI Payee:</span>
                <strong className="font-semibold">{selectedPaymentQrModal.paymentDetails.payeeName}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">UPI ID:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedPaymentQrModal.paymentDetails!.upiId, true)}
                  className="font-mono font-bold text-purple-800 hover:underline flex items-center gap-1"
                >
                  <span>{selectedPaymentQrModal.paymentDetails.upiId}</span>
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              {selectedPaymentQrModal.paymentDetails.deadline && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Due Deadline:</span>
                  <strong className="text-rose-600 font-semibold">{selectedPaymentQrModal.paymentDetails.deadline}</strong>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <a
                href={`upi://pay?pa=${selectedPaymentQrModal.paymentDetails.upiId}&pn=${encodeURIComponent(selectedPaymentQrModal.paymentDetails.payeeName)}&am=${selectedPaymentQrModal.paymentDetails.amount}&cu=INR`}
                className="w-full py-3 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md"
              >
                <CreditCard className="w-4 h-4" />
                <span>Open in UPI App (GPay/PhonePe)</span>
              </a>

              <Button
                variant="outline"
                size="md"
                onClick={() => setSelectedPaymentQrModal(null)}
                className="w-full sm:w-auto"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: HUB SUBMISSION REVIEW MODAL */}
      {/* ------------------------------------------------------------- */}
      {selectedHubSubmission && (
        <Modal
          isOpen={Boolean(selectedHubSubmission)}
          onClose={() => setSelectedHubSubmission(null)}
          title="Hub Submission Details"
          maxWidth="lg"
        >
          <div className="space-y-4 pt-2 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Submission Title</span>
              <h4 className="font-heading font-extrabold text-lg text-slate-900">
                {selectedHubSubmission.listingTitle || "Engagement Response"}
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-medium uppercase">Type</span>
                <p className="font-bold text-slate-800 uppercase">{selectedHubSubmission.listingType}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium uppercase">Date Submitted</span>
                <p className="font-semibold text-slate-800">
                  {new Date(selectedHubSubmission.createdAt || (selectedHubSubmission as any).submittedAt || Date.now()).toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            {selectedHubSubmission.answers && (
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Submitted Answers</span>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(selectedHubSubmission.answers).map(([key, val]) => (
                    <div key={key} className="space-y-0.5 border-b border-slate-200/60 pb-1.5 last:border-0">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{key}:</span>
                      <p className="text-slate-800 font-medium">{typeof val === "object" ? JSON.stringify(val) : String(val)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedHubSubmission(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
