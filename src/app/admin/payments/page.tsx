"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  CreditCard, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RotateCcw, 
  XCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  Eye, 
  History, 
  Sparkles, 
  Sliders, 
  Calendar, 
  Building2, 
  ChevronDown, 
  ArrowUpRight, 
  ShieldCheck, 
  IndianRupee,
  RefreshCw,
  FileSpreadsheet,
  AlertTriangle,
  Radio,
  Zap,
  X
} from "lucide-react";
import { PayhookSignalsSection } from "@/components/admin/payments/PayhookSignalsSection";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { getStoredEvents, syncEventsFromFirestore, subscribeToEvents, canUserManageEvent, saveStoredEvent, resolveTenureForEvent } from "@/lib/eventsStore";
import { getStoredTenures, syncTenuresFromFirestore, subscribeToTenures, CouncilTenure, getLatestAvailableTenure } from "@/lib/tenureStore";
import { getActiveTenure } from "@/lib/tenureEngine";
import { 
  getAllRegistrationsFromFirestore, 
  subscribeToRegistrationsFromFirestore, 
  updateRegistrationRefundInFirestore, 
  updateRegistrationPaymentStatus,
  cancelEventRegistrations,
  subscribeToSiteContent,
  isTestPassRecord,
  isHubRecord,
  StudentRegistrationRecord
} from "@/lib/firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import { PaymentConfigModal } from "@/components/admin/registrations/PaymentConfigModal";
import { SyncCashfreeModal } from "@/components/admin/payments/SyncCashfreeModal";
import { 
  getStoredPaymentConfig, 
  subscribeToPaymentConfig, 
  PaymentConfig 
} from "@/lib/paymentConfigStore";
import { EventItem, RegistrationRecord } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { isEntityOwnedByClub } from "@/types/rbac";

type PaymentTabFilter = "all" | "completed" | "pending" | "refunded" | "cancelled" | "signals";

function getTimestampMs(val: any): number {
  if (!val) return NaN;
  if (typeof val === "number") return val > 1e11 ? val : val * 1000;
  if (typeof val === "string") {
    if (/^\d{10,13}$/.test(val.trim())) {
      const num = Number(val.trim());
      return num > 1e11 ? num : num * 1000;
    }
    const d = new Date(val).getTime();
    return isNaN(d) ? NaN : d;
  }
  if (val instanceof Date) return val.getTime();
  if (typeof val?.toDate === "function") {
    const d = val.toDate();
    return isNaN(d.getTime()) ? NaN : d.getTime();
  }
  if (typeof val === "object" && typeof val.seconds === "number") {
    return val.seconds * 1000 + (val.nanoseconds ? val.nanoseconds / 1000000 : 0);
  }
  if (typeof val === "object" && typeof val._seconds === "number") {
    return val._seconds * 1000 + (val._nanoseconds ? val._nanoseconds / 1000000 : 0);
  }
  return NaN;
}

function formatTimestamp(val: any): string {
  if (!val) return "N/A";
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? val : d.toLocaleString("en-IN");
  }
  if (val instanceof Date) return val.toLocaleString("en-IN");
  if (typeof val === "object" && typeof val.seconds === "number") {
    return new Date(val.seconds * 1000).toLocaleString("en-IN");
  }
  return String(val);
}

export default function AdminPaymentsPage() {
  const { adminAccess, user, isOwner } = useAuth();
  const isClubOwner = adminAccess?.role === "CLUB_OWNER" && adminAccess.active !== false;
  const isScopedEventManager = !isOwner && adminAccess?.role !== "TREASURER" && (isClubOwner || adminAccess?.role === "EVENT_COORDINATOR" || Boolean(adminAccess?.hasEventCoordinatorAccess));
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [tenuresList, setTenuresList] = useState<CouncilTenure[]>([]);

  // Comprehensive lookup of all events across live store and historical tenure snapshots
  const allKnownEvents = useMemo(() => {
    const map = new Map<string, EventItem>();
    eventsList.forEach((e) => {
      if (e && (e.id || e.slug)) map.set(e.id || e.slug, e);
    });
    tenuresList.forEach((t) => {
      if (Array.isArray(t.events)) {
        t.events.forEach((e) => {
          if (e && (e.id || e.slug) && !map.has(e.id || e.slug)) {
            map.set(e.id || e.slug, e);
          }
        });
      }
    });
    return Array.from(map.values());
  }, [eventsList, tenuresList]);

  // Helper to determine if a payment/registration record strictly belongs to the club or event coordinator scope
  const isRegistrationOwned = useCallback((r: any) => {
    if (!isScopedEventManager) return true;
    if (!r) return false;
    if (isClubOwner && isEntityOwnedByClub(r, adminAccess)) return true;
    const rSlug = (r.eventSlug || "").toLowerCase();
    const rId = (r.eventId || "").toLowerCase();
    const rName = (r.eventName || "").toLowerCase();
    const rParentId = (r.parentEventId || "").toLowerCase();
    const rParentSlug = (r.parentEventSlug || "").toLowerCase();
    const rParentName = (r.parentEventName || "").toLowerCase();

    // 1. Direct event check
    const directEvent = allKnownEvents.find((e) =>
      (e.id && (e.id.toLowerCase() === rId || e.id.toLowerCase() === rSlug)) ||
      (e.slug && (e.slug.toLowerCase() === rSlug || e.slug.toLowerCase() === rId)) ||
      (e.name && e.name.toLowerCase() === rName)
    );
    if (directEvent) {
      return canUserManageEvent(directEvent, adminAccess, user?.btId, allKnownEvents);
    }

    // 2. Parent umbrella event check
    if (rParentId || rParentSlug || rParentName) {
      const parentEvent = allKnownEvents.find((e) =>
        (rParentId && e.id && e.id.toLowerCase() === rParentId) ||
        (rParentSlug && e.slug && e.slug.toLowerCase() === rParentSlug) ||
        (rParentName && e.name && e.name.toLowerCase() === rParentName)
      );
      if (parentEvent) {
        return canUserManageEvent(parentEvent, adminAccess, user?.btId, allKnownEvents);
      }
    }
    return false;
  }, [isScopedEventManager, isClubOwner, adminAccess, user?.btId, allKnownEvents]);

  const [userSelectedTenure, setUserSelectedTenure] = useState(false);
  const [selectedTenureId, setSelectedTenureId] = useState<string>(() => {
    return getActiveTenure().id;
  });
  const [selectedEventSlug, setSelectedEventSlug] = useState<string>("");

  const scopedEventsList = useMemo(() => {
    let result: EventItem[] = [];
    const matchedTenure = tenuresList.find((t) => t.id === selectedTenureId);
    if (selectedTenureId === "all" || !matchedTenure) {
      if (selectedTenureId === "all") {
        result = eventsList;
      } else {
        result = eventsList.filter((e) => {
          const resolved = resolveTenureForEvent(e, tenuresList);
          return resolved ? resolved.id === selectedTenureId : e.tenureId === selectedTenureId;
        });
      }
    } else if (matchedTenure.isCurrent || matchedTenure.status === "active") {
      result = eventsList.filter((e) => {
        const resolved = resolveTenureForEvent(e, tenuresList);
        return resolved ? resolved.id === matchedTenure.id : (e.tenureId === matchedTenure.id || !e.tenureId);
      });
    } else {
      // Past tenure: load past tenure events only when user changes the filter manually
      const snapshotEvents = Array.isArray(matchedTenure.events) ? matchedTenure.events : [];
      const pastFromStore = eventsList.filter((e) => {
        const resolved = resolveTenureForEvent(e, tenuresList);
        return resolved ? resolved.id === matchedTenure.id : e.tenureId === matchedTenure.id;
      });

      const map = new Map<string, EventItem>();
      [...snapshotEvents, ...pastFromStore].forEach((ev) => {
        if (ev && (ev.id || ev.slug)) map.set(ev.id || ev.slug, ev);
      });
      result = Array.from(map.values());
    }

    // STRICT INVARIANT: If scoped event manager (Club Owner or Event Coordinator), filter ALL results down strictly to their assigned events
    if (isScopedEventManager) {
      return result.filter((event) => canUserManageEvent(event, adminAccess, user?.btId, allKnownEvents));
    }
    return result;
  }, [eventsList, selectedTenureId, tenuresList, isScopedEventManager, adminAccess, user?.btId, allKnownEvents]);

  // Cleanly deselect event filter if current selected event is not in scopedEventsList
  useEffect(() => {
    if (selectedEventSlug && selectedEventSlug !== "all" && scopedEventsList.length > 0) {
      const existsInScope = scopedEventsList.some(
        (e) => (e.slug && e.slug.toLowerCase() === selectedEventSlug.toLowerCase()) || e.id === selectedEventSlug
      );
      if (!existsInScope) {
        setSelectedEventSlug("");
      }
    }
  }, [scopedEventsList, selectedEventSlug]);
  const [statusTab, setStatusTab] = useState<PaymentTabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Autocomplete Event dropdown
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);
  const eventDropdownRef = useRef<HTMLDivElement | null>(null);

  // Active records & Action modals
  const [selectedRecord, setSelectedRecord] = useState<RegistrationRecord | null>(null);
  const [historyRecord, setHistoryRecord] = useState<RegistrationRecord | null>(null);
  const [refundTargetRecord, setRefundTargetRecord] = useState<RegistrationRecord | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState<string>("");
  const [refundReasonInput, setRefundReasonInput] = useState<string>("Event cancellation / Delegate refund");
  const [isRefunding, setIsRefunding] = useState(false);

  const [approveTargetRecord, setApproveTargetRecord] = useState<RegistrationRecord | null>(null);
  const [approveUtrInput, setApproveUtrInput] = useState<string>("");
  const [isApproving, setIsApproving] = useState(false);

  const [cancelTargetRecord, setCancelTargetRecord] = useState<RegistrationRecord | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>("Payment not received or cancelled by admin");
  const [isCancelling, setIsCancelling] = useState(false);

  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);
  const [checkingStatusId, setCheckingStatusId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Cancel Event & Bulk Refund State
  const [isCancelEventModalOpen, setIsCancelEventModalOpen] = useState(false);
  const [cancellationNoticeInput, setCancellationNoticeInput] = useState(
    "Event cancelled by SRC Council. Full registration fee refunded."
  );
  const [isCancellingAndRefunding, setIsCancellingAndRefunding] = useState(false);
  const [bulkRefundProgress, setBulkRefundProgress] = useState<{
    current: number;
    total: number;
    currentParticipant?: string;
  } | null>(null);
  const [cancellationSummary, setCancellationSummary] = useState<{
    successCount: number;
    failedCount: number;
    voidedFreeCount: number;
    totalRefunded: number;
  } | null>(null);
  const [cancelConfirmationInput, setCancelConfirmationInput] = useState("");
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState(false);

  // Payment gateway config modal
  const [isPaymentConfigOpen, setIsPaymentConfigOpen] = useState(false);
  const [isSyncCashfreeOpen, setIsSyncCashfreeOpen] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(getStoredPaymentConfig());

  // Real-time verified UPI ledger map for instant reconciliation
  const [verifiedUpiMap, setVerifiedUpiMap] = useState<Map<string, { utr: string; amount: number; status: string; receivedAt?: string; payerName?: string }>>(new Map());

  // 1. Initial Load & Subscriptions
  useEffect(() => {
    setPaymentConfig(getStoredPaymentConfig());
    const unsubConfig = subscribeToPaymentConfig((cfg) => setPaymentConfig(cfg));
    return unsubConfig;
  }, []);

  useEffect(() => {
    // Events
    setEventsList(getStoredEvents());
    syncEventsFromFirestore().then((evts) => {
      if (evts && evts.length > 0) setEventsList(evts);
    });

    // Tenures
    const initialTenures = getStoredTenures();
    setTenuresList(initialTenures);
    if (!userSelectedTenure && initialTenures.length > 0) {
      const latest = getLatestAvailableTenure(initialTenures);
      if (latest) setSelectedTenureId(latest.id);
    }

    syncTenuresFromFirestore().then((res) => {
      if (res && res.length > 0) {
        setTenuresList(res);
        if (!userSelectedTenure) {
          const latest = getLatestAvailableTenure(res);
          if (latest) setSelectedTenureId(latest.id);
        }
      }
    });

    const unsubscribeEvents = subscribeToEvents((cloudEvts) => {
      if (cloudEvts && Array.isArray(cloudEvts) && cloudEvts.length > 0) {
        setEventsList(cloudEvts);
      }
    });

    const unsubscribeTenures = subscribeToTenures((cloudTenures) => {
      if (cloudTenures && Array.isArray(cloudTenures) && cloudTenures.length > 0) {
        setTenuresList(cloudTenures);
        if (!userSelectedTenure) {
          const latest = getLatestAvailableTenure(cloudTenures);
          if (latest) setSelectedTenureId(latest.id);
        }
      }
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (eventDropdownRef.current && !eventDropdownRef.current.contains(event.target as Node)) {
        setIsEventDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    const handleEventsUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setEventsList(e.detail);
      } else {
        setEventsList(getStoredEvents());
      }
    };
    window.addEventListener("src_events_updated", handleEventsUpdate);
    window.addEventListener("storage", handleEventsUpdate);

    return () => {
      unsubscribeEvents();
      unsubscribeTenures();
      window.removeEventListener("src_events_updated", handleEventsUpdate);
      window.removeEventListener("storage", handleEventsUpdate);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Format records to standardized RegistrationRecord
  const formatRecords = (records: any[]): RegistrationRecord[] => {
    return records
      .filter((r: any) => !isHubRecord(r) && !isTestPassRecord(r))
      .map((r: any) => {
        let cleanRegisteredAt = "";
        if (typeof r.registeredAt === "string") {
          cleanRegisteredAt = r.registeredAt;
        } else if (r.registeredAt && typeof r.registeredAt.toDate === "function") {
          cleanRegisteredAt = r.registeredAt.toDate().toISOString();
        } else if (r.createdAt && typeof r.createdAt.toDate === "function") {
          cleanRegisteredAt = r.createdAt.toDate().toISOString();
        } else if (r.createdAt && typeof r.createdAt.seconds === "number") {
          cleanRegisteredAt = new Date(r.createdAt.seconds * 1000).toISOString();
        }

        const matchedEvt = allKnownEvents.find((e) =>
          (e.id && (e.id.toLowerCase() === (r.eventId || "").toLowerCase() || e.id.toLowerCase() === (r.eventSlug || "").toLowerCase())) ||
          (e.slug && (e.slug.toLowerCase() === (r.eventSlug || "").toLowerCase() || e.slug.toLowerCase() === (r.eventId || "").toLowerCase())) ||
          (e.name && (e.name.toLowerCase() === (r.eventName || "").toLowerCase() || e.name.toLowerCase() === (r.eventTitle || "").toLowerCase()))
        );

        const enrichedEventName = r.eventTitle || r.eventName || matchedEvt?.name || "Event Delegate Pass";
        const enrichedEventSlug = r.eventSlug || matchedEvt?.slug || r.eventId || "general-event";
        const enrichedParentId = r.parentEventId || matchedEvt?.parentEventId || undefined;
        const enrichedParentName = r.parentEventName || matchedEvt?.parentEventName || undefined;
        const enrichedSubBadge = r.subEventBadge || matchedEvt?.subEventBadge || undefined;

        return {
          id: r.id,
          registrationId: r.registrationId || r.id,
          eventId: r.eventId || matchedEvt?.id || "",
          eventSlug: enrichedEventSlug,
          eventName: enrichedEventName,
          parentEventName: enrichedParentName,
          parentEventId: enrichedParentId,
          subEventBadge: enrichedSubBadge,
          participantName: r.leaderName || r.participantName || "Delegate",
          email: r.email || "",
          phone: r.phone || "",
          department: r.department || "",
          year: r.year || "",
          teamType: (r.teamSize && r.teamSize > 1) || r.teamType === "Team" ? "Team" : "Individual",
          registeredAt: cleanRegisteredAt,
          createdAt: r.createdAt || cleanRegisteredAt,
          paidAt: r.paidAt || (r.paymentStatus === "PAID" ? cleanRegisteredAt : undefined),
          status: r.status || "CONFIRMED",
          paymentStatus: r.paymentStatus || (r.amountPaid > 0 ? "PAID" : "FREE"),
          paymentId: r.paymentId || r.customAnswers?.upiUtr || "",
          orderId: r.orderId || "",
          amountPaid: Number(r.amountPaid || 0),
          ticketCode: r.ticketCode || `${r.id.slice(0, 7)}-TK`,
          qrPayload: r.qrPayload || `SRC:PASS:${r.id}`,
          customAnswers: r.customAnswers || {},
          tenureId: r.tenureId || r.tenure || undefined,
          refundId: r.refundId,
          refundStatus: r.refundStatus,
          refundAmount: r.refundAmount,
          refundArn: r.refundArn,
          refundNote: r.refundNote,
          refundInitiatedBy: r.refundInitiatedBy,
          refundMode: r.refundMode,
          refundedAt: r.refundedAt,
          cancellationReason: r.cancellationReason,
          cancelledAt: r.cancelledAt,
          cancelledBy: r.cancelledBy,
          verifiedBy: r.verifiedBy,
          verifiedAt: r.verifiedAt,
        };
      });
  };

  // Dual-Subscription for Registrations
  useEffect(() => {
    // 1. Local Cache (instant optimistic render)
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      if (Array.isArray(local) && local.length > 0) {
        setRegistrations(formatRecords(local));
      }
    } catch {}

    // 2. Real-Time Multiplexed Snapshot Listener (delivers initial cloud snapshot & all live deltas)
    const unsubscribeSnapshot = subscribeToRegistrationsFromFirestore((liveList) => {
      if (liveList && Array.isArray(liveList)) {
        const formatted = formatRecords(liveList);
        setRegistrations(formatted);
        try {
          localStorage.setItem("src_local_registrations", JSON.stringify(formatted));
        } catch {}
      }
    });

    const handleLocalUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setRegistrations(formatRecords(e.detail));
      }
    };
    window.addEventListener("src_registrations_updated", handleLocalUpdate);

    return () => {
      unsubscribeSnapshot();
      window.removeEventListener("src_registrations_updated", handleLocalUpdate);
    };
  }, []);

  // Dual-Subscription for verified incoming UPI payments ledger
  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const { db } = await import("@/lib/firebase/config");
        const { collection, onSnapshot, query, limit, orderBy } = await import("firebase/firestore");
        if (db) {
          const q = query(collection(db, "verified_upi_payments"), orderBy("receivedAt", "desc"), limit(150));
          unsub = onSnapshot(q, (snap) => {
            const map = new Map<string, { utr: string; amount: number; status: string; receivedAt?: string; payerName?: string }>();
            snap.forEach((d) => {
              const data = d.data();
              if (data?.utr) {
                map.set(String(data.utr).trim(), {
                  utr: String(data.utr).trim(),
                  amount: Number(data.amount || 0),
                  status: data.status || "UNCLAIMED",
                  receivedAt: data.receivedAt,
                  payerName: data.payerName,
                });
              }
            });
            setVerifiedUpiMap(map);
          }, (err) => {
            console.warn("Notice: verified_upi_payments subscription warning:", err);
          });
        }
      } catch (e) {
        console.warn("Notice: verified_upi_payments init error:", e);
      }
    })();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Filter Payments by Tenure & Event
  const filteredByTenure = useMemo(() => {
    const scopedRegistrations = registrations.filter(isRegistrationOwned);
    if (selectedTenureId === "all") return scopedRegistrations;
    const currentTenure = tenuresList.find((t) => t.id === selectedTenureId);
    if (!currentTenure) return scopedRegistrations;

    const tenureEvents = currentTenure.events || [];
    const tenureEventSlugs = new Set(tenureEvents.map((e) => (e.slug || "").toLowerCase()));
    const tenureEventIds = new Set(tenureEvents.map((e) => (e.id || "").toLowerCase()));
    const tenureEventNames = new Set(tenureEvents.map((e) => (e.name || "").toLowerCase()));

    const targetId = selectedTenureId.toLowerCase().trim();
    const targetLabel = (currentTenure.label || "").toLowerCase().trim();
    const targetYearDigits = (currentTenure.academicYear || currentTenure.label || "").replace(/[^0-9]/g, "");

    const tenureStartMs = currentTenure.startDate ? new Date(currentTenure.startDate).getTime() : NaN;
    const tenureEndMs = currentTenure.endDate ? new Date(currentTenure.endDate).getTime() : NaN;

    return scopedRegistrations.filter((r) => {
      // 1. Direct match on explicit tenureId
      if (r.tenureId) {
        const cleanTid = r.tenureId.toLowerCase().trim();
        const rYearDigits = cleanTid.replace(/[^0-9]/g, "");
        if (
          cleanTid === targetId ||
          cleanTid === targetLabel ||
          cleanTid.includes(targetLabel) ||
          targetId.includes(cleanTid) ||
          (targetYearDigits && rYearDigits && (targetYearDigits.includes(rYearDigits) || rYearDigits.includes(targetYearDigits)))
        ) {
          return true;
        }
      }

      // 2. Match via event association (event belongs to this tenure's historical roster)
      const rSlug = (r.eventSlug || "").toLowerCase();
      const rId = (r.eventId || "").toLowerCase();
      const rName = (r.eventName || "").toLowerCase();

      if (
        (rSlug && (tenureEventSlugs.has(rSlug) || tenureEventIds.has(rSlug))) ||
        (rId && (tenureEventIds.has(rId) || tenureEventSlugs.has(rId))) ||
        (rName && tenureEventNames.has(rName))
      ) {
        return true;
      }

      // 3. Current live tenure matches all active events in eventsList
      if (currentTenure.isCurrent || currentTenure.status === "active") {
        const matchesCurrentEvent = eventsList.some((e) =>
          (e.id && (e.id === r.eventId || e.id === r.eventSlug)) ||
          (e.slug && (e.slug === r.eventSlug || e.slug === r.eventId)) ||
          (e.name && e.name.toLowerCase() === rName)
        );
        if (matchesCurrentEvent) return true;

        // If registration was made under active session and not tagged to an older archived tenure
        if (!r.tenureId) return true;
      }

      // 4. Historical archived tenure boundary check (only when both startDate and endDate exist)
      if (!isNaN(tenureStartMs) && !isNaN(tenureEndMs) && !currentTenure.isCurrent) {
        const targetTime = r.paidAt || r.registeredAt || r.createdAt;
        if (targetTime) {
          const t = getTimestampMs(targetTime);
          if (!isNaN(t) && t >= tenureStartMs && t <= tenureEndMs) {
            return true;
          }
        }
      }

      return false;
    });
  }, [registrations, isRegistrationOwned, selectedTenureId, tenuresList, eventsList]);

  const filteredByEvent = useMemo(() => {
    // If no event filter is chosen yet, return empty list to prevent initial load lag
    if (!selectedEventSlug) return [];
    if (selectedEventSlug === "all") return filteredByTenure;
    const selectedEvt = allKnownEvents.find((e) => (e.slug && e.slug.toLowerCase() === selectedEventSlug.toLowerCase()) || (e.name && e.name.toLowerCase() === selectedEventSlug.toLowerCase()) || e.id === selectedEventSlug);
    
    const childNames = new Set<string>();
    const childSlugs = new Set<string>();
    const childIds = new Set<string>();
    if (selectedEvt && selectedEvt.isParentFest) {
      allKnownEvents.forEach((e) => {
        if (
          (e.parentEventId && (e.parentEventId === selectedEvt.id || e.parentEventId === selectedEvt.slug)) ||
          (e.parentEventSlug && (e.parentEventSlug === selectedEvt.slug || e.parentEventSlug === selectedEvt.id)) ||
          (e.parentEventName && e.parentEventName.toLowerCase().trim() === selectedEvt.name.toLowerCase().trim())
        ) {
          if (e.name) childNames.add(e.name.toLowerCase());
          if (e.slug) childSlugs.add(e.slug.toLowerCase());
          if (e.id) childIds.add(e.id.toLowerCase());
        }
      });
    }

    return filteredByTenure.filter((r) => {
      const rName = (r.eventName || "").toLowerCase();
      const rSlug = (r.eventSlug || "").toLowerCase();
      const rId = (r.eventId || "").toLowerCase();
      const rParentId = (r.parentEventId || "").toLowerCase();
      const rParentName = (r.parentEventName || "").toLowerCase();

      const matchesDirect =
        rName === selectedEventSlug.toLowerCase() ||
        rSlug === selectedEventSlug.toLowerCase() ||
        rId === selectedEventSlug.toLowerCase() ||
        (selectedEvt && (
          rName === (selectedEvt.name || "").toLowerCase() || 
          rSlug === (selectedEvt.slug || "").toLowerCase() ||
          rId === selectedEvt.id.toLowerCase()
        ));

      const matchesChild =
        childNames.has(rName) ||
        childSlugs.has(rSlug) ||
        childIds.has(rId) ||
        childSlugs.has(rId) ||
        childIds.has(rSlug) ||
        (selectedEvt && (
          rParentId === selectedEvt.id.toLowerCase() ||
          rParentId === selectedEvt.slug.toLowerCase() ||
          (rParentName && rParentName === selectedEvt.name.toLowerCase())
        ));

      return matchesDirect || matchesChild;
    });
  }, [filteredByTenure, selectedEventSlug, allKnownEvents]);

  // Current selected event object (null if all or empty)
  const currentSelectedEventObj = useMemo(() => {
    if (!selectedEventSlug || selectedEventSlug === "all") return null;
    return (
      allKnownEvents.find(
        (e) =>
          (e.slug && e.slug.toLowerCase() === selectedEventSlug.toLowerCase()) ||
          (e.name && e.name.toLowerCase() === selectedEventSlug.toLowerCase()) ||
          e.id === selectedEventSlug
      ) || null
    );
  }, [selectedEventSlug, allKnownEvents]);

  // Paid delegate passes eligible for automated gateway refund
  const eligibleForBulkRefund = useMemo(() => {
    if (!currentSelectedEventObj) return [];
    return filteredByEvent.filter(
      (r) =>
        ((r.amountPaid && r.amountPaid > 0) || r.paymentStatus === "PAID") &&
        r.refundStatus !== "PROCESSED" &&
        r.paymentStatus !== "REFUNDED"
    );
  }, [currentSelectedEventObj, filteredByEvent]);

  // Complimentary / non-paid passes to mark cancelled/voided
  const eligibleNonPaidForCancel = useMemo(() => {
    if (!currentSelectedEventObj) return [];
    return filteredByEvent.filter(
      (r) =>
        (!r.amountPaid || r.amountPaid === 0) &&
        r.paymentStatus !== "PAID" &&
        r.status !== "CANCELLED"
    );
  }, [currentSelectedEventObj, filteredByEvent]);

  // Total ₹ value of unrefunded paid passes under this event
  const totalBulkRefundAmount = useMemo(() => {
    return eligibleForBulkRefund.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);
  }, [eligibleForBulkRefund]);

  // Authorization check for event cancellation
  const canCancelCurrentEvent = useMemo(() => {
    if (!currentSelectedEventObj) return false;
    return canUserManageEvent(currentSelectedEventObj, adminAccess, user?.btId, allKnownEvents);
  }, [currentSelectedEventObj, adminAccess, user?.btId, allKnownEvents]);

  // Primary Table Rows (Filtered by Status Tab & Search)
  const displayedPayments = useMemo(() => {
    let list = filteredByEvent;

    // Filter by Status Tab
    if (statusTab === "completed") {
      list = list.filter((r) => r.paymentStatus === "PAID" && r.status !== "CANCELLED" && !r.refundStatus);
    } else if (statusTab === "pending") {
      list = list.filter((r) => r.paymentStatus === "PENDING" || (r.status === "PENDING" && r.paymentStatus !== "PAID"));
    } else if (statusTab === "refunded") {
      list = list.filter((r) => r.refundStatus === "PROCESSED" || r.paymentStatus === "REFUNDED");
    } else if (statusTab === "cancelled") {
      list = list.filter((r) => r.status === "CANCELLED" || r.paymentStatus === "FAILED");
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => 
        (r.orderId && r.orderId.toLowerCase().includes(q)) ||
        (r.paymentId && r.paymentId.toLowerCase().includes(q)) ||
        (r.participantName && r.participantName.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.phone && r.phone.includes(q)) ||
        (r.eventName && r.eventName.toLowerCase().includes(q)) ||
        (r.ticketCode && r.ticketCode.toLowerCase().includes(q))
      );
    }

    // Sort Latest First (Newest transactions on top)
    return [...list].sort((a, b) => {
      const targetA = a.paidAt || a.registeredAt || a.createdAt || a.refundedAt;
      const targetB = b.paidAt || b.registeredAt || b.createdAt || b.refundedAt;
      const timeA = getTimestampMs(targetA) || 0;
      const timeB = getTimestampMs(targetB) || 0;
      if (timeB !== timeA) return timeB - timeA;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
  }, [filteredByEvent, statusTab, searchQuery]);

  // Registrations with Pending UTR that have a matching signal in verified_upi_payments
  const pendingVerifiedMatches = useMemo(() => {
    return filteredByEvent.filter(
      (r) =>
        (r.paymentStatus === "PENDING" || (r.status === "PENDING" && r.paymentStatus !== "PAID")) &&
        r.paymentId &&
        verifiedUpiMap.has(r.paymentId.trim())
    );
  }, [filteredByEvent, verifiedUpiMap]);

  // KPI Metrics Calculation (Strict Revenue & Refund Tracking)
  const kpiStats = useMemo(() => {
    // Gross revenue: all transactions that were paid (including those subsequently refunded)
    const allPaidRecords = filteredByEvent.filter(
      (r) => r.paymentStatus === "PAID" || r.refundStatus === "PROCESSED" || r.paymentStatus === "REFUNDED"
    );
    const totalGrossRevenue = allPaidRecords.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);

    // Active paid passes (strictly excluding refunded, voided, and cancelled)
    const activePaidList = filteredByEvent.filter(
      (r) =>
        (r.paymentStatus === "PAID" || (r.amountPaid && r.amountPaid > 0)) &&
        r.refundStatus !== "PROCESSED" &&
        r.paymentStatus !== "REFUNDED" &&
        r.status !== "CANCELLED"
    );

    const pendingList = filteredByEvent.filter(
      (r) => r.paymentStatus === "PENDING" || (r.status === "PENDING" && r.paymentStatus !== "PAID")
    );
    const refundedList = filteredByEvent.filter(
      (r) => r.refundStatus === "PROCESSED" || r.paymentStatus === "REFUNDED"
    );
    const totalRefundsAmount = refundedList.reduce(
      (acc, curr) => acc + (Number(curr.refundAmount) || Number(curr.amountPaid) || 0),
      0
    );

    // Strict Net Revenue Invariant: Net Collections = Gross - Total Refunds
    const totalNetRevenue = Math.max(0, totalGrossRevenue - totalRefundsAmount);

    return {
      totalNetRevenue,
      totalGrossRevenue,
      totalPaidCount: activePaidList.length,
      pendingCount: pendingList.length,
      refundedCount: refundedList.length,
      totalRefundsAmount,
      totalTransactions: filteredByEvent.length,
    };
  }, [filteredByEvent]);

  // Copy UTR helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUtr(id);
    setTimeout(() => setCopiedUtr(null), 2500);
  };

  // Export Excel Functionality
  const handleExportExcel = async () => {
    if (displayedPayments.length === 0) {
      alert("No payment transactions to export.");
      return;
    }

    const XLSX = await import("xlsx");
    const exportRows = displayedPayments.map((r, idx) => ({
      "Sr No": idx + 1,
      "Order ID": r.orderId || "N/A",
      "UPI UTR / Ref": r.paymentId || "N/A",
      "Participant Name": r.participantName,
      "Contact Phone": r.phone,
      "Email Address": r.email,
      "Department": r.department,
      "Event Name": r.eventName,
      "Amount Paid (INR)": r.amountPaid,
      "Payment Status": r.paymentStatus,
      "Pass Status": r.status,
      "Date & Time": r.paidAt || r.registeredAt || "N/A",
      "Refund Status": r.refundStatus || "N/A",
      "Refund Amount (INR)": r.refundAmount || (r.refundStatus === "PROCESSED" ? r.amountPaid : 0),
      "Refund ID": r.refundId || "N/A",
      "Refund Bank ARN": r.refundArn || "N/A",
      "Refund Reason": r.refundNote || r.cancellationReason || "N/A",
      "Refund Initiated By": r.refundInitiatedBy || r.cancelledBy || "N/A",
      "Refund Date": r.refundedAt || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);

    // Auto-fit column widths
    const colKeys = Object.keys(exportRows[0] || {});
    ws["!cols"] = colKeys.map((k) => {
      const maxLen = Math.max(
        k.length,
        ...exportRows.map((r) => String((r as any)[k] !== undefined ? (r as any)[k] : "").length)
      );
      return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments Ledger");
    const safeSlug = selectedEventSlug === "all" ? "All_Events" : selectedEventSlug.replace(/\s+/g, "_");
    XLSX.writeFile(wb, `SRC_Payments_${safeSlug}_${Date.now()}.xlsx`);
  };

  // Dedicated 1-Click Export for Refunds Audit Ledger
  const handleExportRefundsExcel = async () => {
    const refundedRecords = filteredByEvent.filter(
      (r) => r.refundStatus === "PROCESSED" || r.paymentStatus === "REFUNDED"
    );
    if (refundedRecords.length === 0) {
      alert("No refunded transactions found for this scope.");
      return;
    }

    const XLSX = await import("xlsx");
    const exportRows = refundedRecords.map((r, idx) => ({
      "Sr No": idx + 1,
      "Refund ID": r.refundId || "N/A",
      "Bank ARN / RRN": r.refundArn || "Pending Settlement",
      "Order ID": r.orderId || "N/A",
      "Original UPI UTR": r.paymentId || "N/A",
      "Participant Name": r.participantName,
      "Phone": r.phone,
      "Email": r.email,
      "Department": r.department,
      "Event Name": r.eventName,
      "Refund Amount (INR)": r.refundAmount || r.amountPaid || 0,
      "Refund Status": r.refundStatus || "PROCESSED",
      "Refund Mode": r.refundMode || "ORIGINAL_PAYMENT_MODE",
      "Refund Reason": r.refundNote || r.cancellationReason || "N/A",
      "Refund Initiated By": r.refundInitiatedBy || r.cancelledBy || "SRC Admin",
      "Refund Timestamp": r.refundedAt || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const colKeys = Object.keys(exportRows[0] || {});
    ws["!cols"] = colKeys.map((k) => {
      const maxLen = Math.max(
        k.length,
        ...exportRows.map((r) => String((r as any)[k] !== undefined ? (r as any)[k] : "").length)
      );
      return { wch: Math.min(Math.max(maxLen + 3, 14), 45) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Refunds Audit Ledger");
    const safeSlug = selectedEventSlug === "all" ? "All_Events" : selectedEventSlug.replace(/\s+/g, "_");
    XLSX.writeFile(wb, `SRC_Refunds_Ledger_${safeSlug}_${Date.now()}.xlsx`);
  };

  // Approve Payment Action
  const handleApproveConfirm = async () => {
    if (!approveTargetRecord) return;
    if (isScopedEventManager && !isRegistrationOwned(approveTargetRecord)) {
      alert("You can only approve payments for events assigned to your club or BT ID.");
      return;
    }
    const docId = approveTargetRecord.id;
    const regTicketId = approveTargetRecord.registrationId || approveTargetRecord.id;
    const finalUtr = approveUtrInput.trim() || approveTargetRecord.paymentId || `MANUAL-${Date.now().toString().slice(-6)}`;

    setIsApproving(true);
    try {
      const nowIso = new Date().toISOString();
      await updateRegistrationPaymentStatus(docId, "PAID", "SRC Admin / Treasurer");
      if (regTicketId !== docId) {
        await updateRegistrationPaymentStatus(regTicketId, "PAID", "SRC Admin / Treasurer");
      }

      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        try {
          const docRef = doc(db, "registrations", docId);
          await updateDoc(docRef, {
            paymentStatus: "PAID",
            status: "CONFIRMED",
            paymentId: finalUtr,
            paidAt: nowIso,
            verifiedBy: "SRC Admin / Treasurer",
            verifiedAt: nowIso,
          });
        } catch (e) {
          console.warn("Direct doc update warning:", e);
        }
      }

      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === docId || r.registrationId === regTicketId
            ? {
                ...r,
                paymentStatus: "PAID",
                status: "CONFIRMED",
                paymentId: finalUtr,
                paidAt: nowIso,
                verifiedBy: "SRC Admin / Treasurer",
                verifiedAt: nowIso,
              }
            : r
        )
      );

      setFeedbackNotice(`Payment Approved! Pass issued for ${approveTargetRecord.participantName} (UTR: ${finalUtr}).`);
      setTimeout(() => setFeedbackNotice(null), 5000);
      setApproveTargetRecord(null);
    } catch (err) {
      console.error("Failed to approve payment:", err);
      alert("Error approving payment. Please check your connection.");
    } finally {
      setIsApproving(false);
    }
  };

  // Instant 1-Tap Auto-Reconciliation with Verified Bank Signal
  const handle1TapAutoApprove = async (
    targetRecord: RegistrationRecord,
    verifiedPay: { utr: string; amount: number; payerName?: string }
  ) => {
    const docId = targetRecord.id;
    const regTicketId = targetRecord.registrationId || targetRecord.id;
    const finalUtr = verifiedPay.utr;
    const nowIso = new Date().toISOString();

    setIsApproving(true);
    try {
      await updateRegistrationPaymentStatus(docId, "PAID", "SRC Auto-Reconciliation (PayHook)");
      if (regTicketId !== docId) {
        await updateRegistrationPaymentStatus(regTicketId, "PAID", "SRC Auto-Reconciliation (PayHook)");
      }

      const { db } = await import("@/lib/firebase/config");
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const { doc, updateDoc, setDoc } = await import("firebase/firestore");
        try {
          await updateDoc(doc(db, "registrations", docId), {
            paymentStatus: "PAID",
            status: "CONFIRMED",
            paymentId: finalUtr,
            paidAt: nowIso,
            verifiedBy: "Paytm Auto-Gateway (SRC PayHook)",
            verifiedAt: nowIso,
            payerName: verifiedPay.payerName || null,
          });
        } catch (e) {
          console.warn("Direct doc update warning:", e);
        }

        try {
          await setDoc(doc(db, "verified_upi_payments", finalUtr), {
            status: "MATCHED",
            matchedRegistrationId: docId,
            matchedOrderId: targetRecord.orderId || null,
            matchedStudentName: targetRecord.participantName,
            matchedAt: nowIso,
          }, { merge: true });
        } catch (e) {
          console.warn("Verified payment update warning:", e);
        }
      }

      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === docId || r.registrationId === regTicketId
            ? {
                ...r,
                paymentStatus: "PAID",
                status: "CONFIRMED",
                paymentId: finalUtr,
                paidAt: nowIso,
                verifiedBy: "Paytm Auto-Gateway (SRC PayHook)",
                verifiedAt: nowIso,
              }
            : r
        )
      );

      setFeedbackNotice(`Reconciled & Approved! Pass issued for ${targetRecord.participantName} (Verified UTR: ${finalUtr}).`);
      setTimeout(() => setFeedbackNotice(null), 5000);
    } catch (err) {
      console.error("1-Tap Auto-Approve error:", err);
      alert("Could not complete auto-approval. Please try manual approval.");
    } finally {
      setIsApproving(false);
    }
  };

  // Refund Payment Action (Strict 100% Full Ticket Refund)
  const handleRefundConfirm = async () => {
    if (!refundTargetRecord) return;
    if (isScopedEventManager && !isRegistrationOwned(refundTargetRecord)) {
      alert("You can only refund payments for events assigned to your club or BT ID.");
      return;
    }
    const regDocId = refundTargetRecord.id;
    const regTicketId = refundTargetRecord.registrationId || refundTargetRecord.id;
    const amountNum = refundTargetRecord.amountPaid ?? 0;

    if (amountNum <= 0) {
      alert("No valid paid amount found to refund.");
      return;
    }

    setIsRefunding(true);
    try {
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : "";
      const res = await fetch("/api/cashfree/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          orderId: refundTargetRecord.orderId || refundTargetRecord.paymentId,
          registrationId: regDocId,
          refundAmount: amountNum,
          refundId: `ref_${Date.now()}`,
          note: refundReasonInput || "Refund issued via SRC Admin Payments Studio",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const nowIso = new Date().toISOString();
        const reasonStr = `Refunded: ${refundReasonInput || "Event cancellation / Delegate refund"} (Refund ID: ${data.refundId})`;
        const adminEmail = auth?.currentUser?.email || "SRC Admin / Treasurer";

        await updateRegistrationRefundInFirestore(regDocId, {
          refundId: data.refundId,
          refundStatus: data.status || "PROCESSED",
          refundAmount: amountNum,
          refundArn: data.refundArn,
          refundMode: data.refundMode,
          refundNote: refundReasonInput || "Refund issued via SRC Admin Payments Studio",
          refundInitiatedBy: adminEmail,
          refundedAt: nowIso,
          cancellationReason: reasonStr,
          cancelledBy: adminEmail,
        });

        // If regTicketId !== regDocId, also attempt updating document with regTicketId
        if (regTicketId !== regDocId && db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
          try {
            const docRef = doc(db, "registrations", regTicketId);
            await updateDoc(docRef, {
              status: "CANCELLED",
              paymentStatus: "REFUNDED",
              refundId: data.refundId,
              refundStatus: data.status || "PROCESSED",
              refundAmount: amountNum,
              refundArn: data.refundArn || null,
              refundMode: data.refundMode || null,
              refundNote: refundReasonInput || "Refund issued via SRC Admin Payments Studio",
              refundInitiatedBy: adminEmail,
              refundedAt: nowIso,
              cancellationReason: reasonStr,
              cancelledAt: nowIso,
              cancelledBy: adminEmail,
            });
          } catch {}
        }

        setRegistrations((prev) =>
          prev.map((r) =>
            r.id === regDocId || r.registrationId === regTicketId
              ? {
                  ...r,
                  status: "CANCELLED",
                  paymentStatus: "REFUNDED",
                  refundId: data.refundId,
                  refundStatus: data.status || "PROCESSED",
                  refundAmount: amountNum,
                  refundArn: data.refundArn || r.refundArn,
                  refundMode: data.refundMode || r.refundMode,
                  refundNote: refundReasonInput || "Refund issued via SRC Admin Payments Studio",
                  refundInitiatedBy: adminEmail,
                  refundedAt: nowIso,
                  cancellationReason: reasonStr,
                  cancelledAt: nowIso,
                  cancelledBy: adminEmail,
                }
              : r
          )
        );

        setFeedbackNotice(`Refund Processed: ₹${amountNum} for ${refundTargetRecord.participantName} (ID: ${data.refundId}${data.refundArn ? `, Bank ARN: ${data.refundArn}` : ""}).`);
        setTimeout(() => setFeedbackNotice(null), 6000);
        setRefundTargetRecord(null);
      } else {
        alert(data.error || "Could not process refund.");
      }
    } catch (err) {
      console.error("Refund processing error:", err);
      alert("Error processing refund. Please try again.");
    } finally {
      setIsRefunding(false);
    }
  };

  // Cancel Event & Bulk Refund All Registrations
  const handleExecuteCancelAndRefund = async () => {
    if (!currentSelectedEventObj) return;
    if (!canCancelCurrentEvent) {
      alert("You do not have permission to cancel this event. Only authorized SRC Admins or Event Coordinators can perform this action.");
      return;
    }

    setIsCancellingAndRefunding(true);
    setBulkRefundProgress({ current: 0, total: eligibleForBulkRefund.length });

    let successCount = 0;
    let failedCount = 0;
    let totalRefunded = 0;
    let voidedFreeCount = 0;
    const adminEmail = auth?.currentUser?.email || "SRC Admin / Treasurer";
    const nowIso = new Date().toISOString();
    const noticeText = cancellationNoticeInput.trim() || "Event cancelled by SRC Council administration.";

    try {
      // 1. Mark Event as Cancelled in Firestore & local eventsStore
      const updatedEvent: EventItem = {
        ...currentSelectedEventObj,
        isCancelled: true,
        status: "Cancelled",
        cancelledAt: nowIso,
        cancellationNotice: noticeText,
      };
      await saveStoredEvent(updatedEvent);

      // 2. Cascade cancel all non-paid / complimentary passes
      try {
        voidedFreeCount = await cancelEventRegistrations(
          currentSelectedEventObj.id,
          currentSelectedEventObj.slug,
          currentSelectedEventObj.name,
          noticeText
        );
      } catch (e) {
        console.warn("Cascade cancel error for free registrations:", e);
      }

      // 3. Sequential rate-limited loop through all paid registrations eligible for refund
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : "";

      for (let i = 0; i < eligibleForBulkRefund.length; i++) {
        const reg = eligibleForBulkRefund[i];
        setBulkRefundProgress({
          current: i + 1,
          total: eligibleForBulkRefund.length,
          currentParticipant: reg.participantName || reg.email || `Registration #${i + 1}`,
        });

        const refundAmount = Number(reg.amountPaid) || 0;
        const regDocId = reg.id;
        const regTicketId = reg.registrationId || reg.id;

        try {
          const res = await fetch("/api/cashfree/refund", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            },
            body: JSON.stringify({
              orderId: reg.orderId || reg.paymentId,
              registrationId: regDocId,
              refundAmount,
              refundId: `bulk_${(currentSelectedEventObj.slug || currentSelectedEventObj.id).slice(0, 10)}_${regDocId.slice(-6)}_${Date.now()}`,
              note: noticeText,
            }),
          });

          const data = await res.json();
          if (res.ok && data.success) {
            successCount++;
            totalRefunded += refundAmount;

            const refundPayload = {
              refundId: data.refundId,
              refundStatus: data.status || "PROCESSED",
              refundAmount,
              refundArn: data.refundArn || null,
              refundMode: data.refundMode || null,
              refundNote: noticeText,
              refundInitiatedBy: adminEmail,
              refundedAt: nowIso,
              cancellationReason: `Event Cancelled: ${noticeText}`,
              cancelledBy: adminEmail,
            };

            await updateRegistrationRefundInFirestore(regDocId, refundPayload);

            if (regTicketId !== regDocId && db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
              try {
                const docRef = doc(db, "registrations", regTicketId);
                await updateDoc(docRef, {
                  status: "CANCELLED",
                  paymentStatus: "REFUNDED",
                  ...refundPayload,
                  cancelledAt: nowIso,
                });
              } catch {}
            }

            // Optimistically update local state for this item
            setRegistrations((prev) =>
              prev.map((r) =>
                r.id === regDocId || r.registrationId === regTicketId
                  ? {
                      ...r,
                      status: "CANCELLED",
                      paymentStatus: "REFUNDED",
                      ...refundPayload,
                      cancelledAt: nowIso,
                    }
                  : r
              )
            );
          } else {
            console.error(`Refund failed for registration ${regDocId}:`, data.error);
            failedCount++;
          }
        } catch (refundErr) {
          console.error(`Network error refunding registration ${regDocId}:`, refundErr);
          failedCount++;
        }

        // Small pacing pause between refund API calls to avoid gateway rate limits
        if (i < eligibleForBulkRefund.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      // Refresh cached local registrations
      try {
        const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
        const updatedLocal = local.map((r: any) => {
          const matchesEvent =
            r.id?.toLowerCase().includes(currentSelectedEventObj.id.toLowerCase()) ||
            (r.eventId && (r.eventId === currentSelectedEventObj.id || r.eventId === currentSelectedEventObj.slug)) ||
            (r.eventTitle && r.eventTitle.toLowerCase().trim() === currentSelectedEventObj.name.toLowerCase().trim());
          if (matchesEvent) {
            return {
              ...r,
              status: "CANCELLED",
              paymentStatus: r.amountPaid > 0 ? "REFUNDED" : r.paymentStatus,
              cancellationReason: `Event Cancelled: ${noticeText}`,
            };
          }
          return r;
        });
        localStorage.setItem("src_local_registrations", JSON.stringify(updatedLocal));
        window.dispatchEvent(new CustomEvent("src_registrations_updated", { detail: updatedLocal }));
      } catch {}

      setCancellationSummary({
        successCount,
        failedCount,
        voidedFreeCount,
        totalRefunded,
      });

      setFeedbackNotice(
        `Event cancellation complete! ${successCount} refunds processed (₹${totalRefunded.toLocaleString("en-IN")}), ${voidedFreeCount} complimentary passes voided.`
      );
      setTimeout(() => setFeedbackNotice(null), 8000);
    } catch (err: any) {
      console.error("Bulk cancellation error:", err);
      alert(`Error during bulk cancellation: ${err?.message || "Unknown error"}`);
    } finally {
      setIsCancellingAndRefunding(false);
    }
  };

  // Reconcile live status and bank ARN directly from Cashfree Gateway
  const handleCheckRefundStatus = async (record: RegistrationRecord) => {
    const orderId = record.orderId || record.paymentId;
    if (!orderId) {
      alert("No Order ID found to check status with Cashfree.");
      return;
    }
    setCheckingStatusId(record.id);
    try {
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : "";
      const res = await fetch(
        `/api/cashfree/refund-status?orderId=${encodeURIComponent(orderId)}${record.refundId ? `&refundId=${encodeURIComponent(record.refundId)}` : ""}`,
        {
          headers: {
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
        }
      );
      const data = await res.json();
      if (res.ok && data.success && data.refund) {
        const ref = data.refund;
        await updateRegistrationRefundInFirestore(record.id, {
          refundId: ref.refundId,
          refundStatus: ref.status,
          refundAmount: Number(ref.amount) || Number(record.refundAmount) || Number(record.amountPaid) || 0,
          refundArn: ref.refundArn,
          refundMode: ref.refundMode,
          refundedAt: record.refundedAt || new Date().toISOString(),
        });

        setRegistrations((prev) =>
          prev.map((r) =>
            r.id === record.id || r.registrationId === record.registrationId
              ? {
                  ...r,
                  refundId: ref.refundId,
                  refundStatus: ref.status,
                  refundArn: ref.refundArn || r.refundArn,
                  refundMode: ref.refundMode || r.refundMode,
                }
              : r
          )
        );

        setFeedbackNotice(`Cashfree Status Synced: ${ref.status}${ref.refundArn ? ` • Bank ARN: ${ref.refundArn}` : ""}`);
        setTimeout(() => setFeedbackNotice(null), 5000);
      } else {
        alert(data.error || "No matching refund record found on Cashfree.");
      }
    } catch (err) {
      console.error("Error querying refund status:", err);
      alert("Network error checking refund status.");
    } finally {
      setCheckingStatusId(null);
    }
  };

  // Cancel Transaction Action
  const handleCancelConfirm = async () => {
    if (!cancelTargetRecord) return;
    if (isScopedEventManager && !isRegistrationOwned(cancelTargetRecord)) {
      alert("You can only cancel payments for events assigned to your club or BT ID.");
      return;
    }
    const docId = cancelTargetRecord.id;
    const regTicketId = cancelTargetRecord.registrationId || cancelTargetRecord.id;

    setIsCancelling(true);
    try {
      const nowIso = new Date().toISOString();
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        try {
          const docRef = doc(db, "registrations", docId);
          await updateDoc(docRef, {
            status: "CANCELLED",
            paymentStatus: "FAILED",
            cancellationReason: cancelReasonInput || "Cancelled by SRC Admin",
            cancelledAt: nowIso,
            cancelledBy: "SRC Admin / Treasurer",
          });
        } catch (e) {
          console.warn("Direct cancel doc update warning:", e);
        }
      }

      // Also update local storage and dispatch event
      try {
        const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
        const updated = local.map((r: any) =>
          r.id === docId || r.registrationId === regTicketId
            ? {
                ...r,
                status: "CANCELLED",
                paymentStatus: "FAILED",
                cancellationReason: cancelReasonInput || "Cancelled by SRC Admin",
                cancelledAt: nowIso,
                cancelledBy: "SRC Admin / Treasurer",
              }
            : r
        );
        localStorage.setItem("src_local_registrations", JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent("src_registrations_updated", { detail: updated }));
      } catch {}

      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === docId || r.registrationId === regTicketId
            ? {
                ...r,
                status: "CANCELLED",
                paymentStatus: "FAILED",
                cancellationReason: cancelReasonInput || "Cancelled by SRC Admin",
                cancelledAt: nowIso,
                cancelledBy: "SRC Admin / Treasurer",
              }
            : r
        )
      );

      setFeedbackNotice(`Transaction cancelled for ${cancelTargetRecord.participantName}.`);
      setTimeout(() => setFeedbackNotice(null), 5000);
      setCancelTargetRecord(null);
    } catch (err) {
      console.error("Cancel error:", err);
      alert("Error cancelling transaction.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A] font-sans pb-16">
      
      {/* 1. TOP HEADER & STUDIO TITLE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
            PAYMENTS STUDIO
          </h1>
        </div>

        {/* Header Actions: Gateway Settings & Export Excel */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isScopedEventManager && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-[#17458F]">
              <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
              <span>{isClubOwner ? `${adminAccess?.clubName || "Assigned Club"} & Assigned Events` : "Assigned Events Only"}</span>
            </span>
          )}
          {!isScopedEventManager && (
            <button
              type="button"
              onClick={() => setIsPaymentConfigOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#17458F]" />
              <span>Gateway Settings</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide ${
                paymentConfig.gateway === "instamojo"
                  ? "bg-purple-100 text-purple-900 border border-purple-200"
                  : paymentConfig.gateway === "paytm_business"
                  ? "bg-indigo-100 text-indigo-900 border border-indigo-200"
                  : "bg-blue-100 text-blue-900 border border-blue-200"
              }`}>
                {paymentConfig.gateway === "instamojo"
                  ? "Instamojo"
                  : paymentConfig.gateway === "paytm_business"
                  ? "Paytm UPI"
                  : "Cashfree"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsSyncCashfreeOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-all cursor-pointer"
            title="Recover or sync missing passes using Cashfree Order ID"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#17458F]" />
            <span>Sync Cashfree Order</span>
          </button>

          {kpiStats.refundedCount > 0 && (
            <button
              type="button"
              onClick={handleExportRefundsExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold shadow-2xs transition-all cursor-pointer"
              title="Download dedicated Refunds Audit Ledger (.xlsx) with Bank ARNs and reasons"
            >
              <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
              <span>Export Refunds ({kpiStats.refundedCount})</span>
            </button>
          )}

          {/* Cancel Event & Bulk Refund Trigger */}
          {currentSelectedEventObj && (
            <button
              type="button"
              onClick={() => {
                setCancellationSummary(null);
                setCancelConfirmationInput("");
                setHasAcknowledgedRisk(false);
                setIsCancelEventModalOpen(true);
              }}
              disabled={!canCancelCurrentEvent}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                currentSelectedEventObj.isCancelled
                  ? eligibleForBulkRefund.length > 0
                    ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 hover:border-rose-400"
              }`}
              title={
                !canCancelCurrentEvent
                  ? "You do not have permission to cancel this event."
                  : currentSelectedEventObj.isCancelled
                  ? eligibleForBulkRefund.length > 0
                    ? "Refund remaining passes for this cancelled event"
                    : "Event is cancelled and all passes are refunded"
                  : "Mark event as cancelled and trigger bulk refunds for all registrations"
              }
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${currentSelectedEventObj.isCancelled ? "text-amber-700" : "text-rose-600"}`} />
              <span>
                {currentSelectedEventObj.isCancelled
                  ? eligibleForBulkRefund.length > 0
                    ? `Refund Remaining (${eligibleForBulkRefund.length})`
                    : "Event Cancelled"
                  : `Cancel Event & Refund All (${eligibleForBulkRefund.length})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setStatusTab(statusTab === "signals" ? "all" : "signals")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusTab === "signals"
                ? "bg-[#17458F] text-white shadow-xs"
                : "bg-blue-50 text-[#17458F] hover:bg-blue-100 border border-blue-200/80"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${statusTab === "signals" ? "text-cyan-300" : "text-[#17458F]"} animate-pulse`} />
            <span>{statusTab === "signals" ? "← Back to Payments" : "📡 PayHook Live Signals"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={displayedPayments.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-xs font-bold text-white shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
            <span>Export Excel ({displayedPayments.length})</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. KPI METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Collections */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Collections</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
              {!selectedEventSlug ? "—" : `₹${kpiStats.totalNetRevenue.toLocaleString("en-IN")}`}
            </div>
            <p className="text-[10px] text-slate-500 font-medium truncate">
              {!selectedEventSlug ? "Select an event to load records" : `Gross: ₹${kpiStats.totalGrossRevenue.toLocaleString("en-IN")} · Refunds: ₹${kpiStats.totalRefundsAmount.toLocaleString("en-IN")}`}
            </p>
          </div>
        </div>

        {/* Completed Transactions */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed / Approved</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
              {!selectedEventSlug ? "—" : kpiStats.totalPaidCount}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              {!selectedEventSlug ? "Select an event to load records" : "Active delegate passes issued"}
            </p>
          </div>
        </div>

        {/* Pending UTR Verification */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Awaiting Verification</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5 flex items-baseline justify-between">
            <div className="font-heading font-black text-2xl sm:text-3xl text-amber-900 tracking-tight">
              {!selectedEventSlug ? "—" : kpiStats.pendingCount}
            </div>
            {selectedEventSlug && kpiStats.pendingCount > 0 && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse">
                Action Required
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            {!selectedEventSlug ? "Select an event to load records" : "Submitted UTRs awaiting admin check"}
          </p>
        </div>

        {/* Total Refunds */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Refunds Issued</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="font-heading font-black text-2xl sm:text-3xl text-purple-950 tracking-tight">
              {!selectedEventSlug ? "—" : `₹${kpiStats.totalRefundsAmount.toLocaleString("en-IN")}`}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              {!selectedEventSlug ? "Select an event to load records" : `${kpiStats.refundedCount} transactions refunded & voided`}
            </p>
          </div>
        </div>
      </div>

      {/* 3. FILTER CONTROLS BAR */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Left: Tenure & Event Filter */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Tenure Selector */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                  Tenure
                </span>
                <select
                  value={selectedTenureId}
                  onChange={(e) => {
                    setUserSelectedTenure(true);
                    setSelectedTenureId(e.target.value);
                    setSelectedEventSlug("");
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all">All Tenures (Full History)</option>
                  {tenuresList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.academicYear} {t.status === "active" ? "• Active" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Event Autocomplete Filter */}
            <div className="relative min-w-[260px] sm:min-w-[320px]" ref={eventDropdownRef}>
              <button
                type="button"
                onClick={() => setIsEventDropdownOpen(!isEventDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-800 text-left transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">
                    {!selectedEventSlug
                      ? "Select Event or Fest..."
                      : selectedEventSlug === "all" 
                      ? "All Events & Fests" 
                      : (eventsList.find((e) => e.slug === selectedEventSlug || e.id === selectedEventSlug)?.name || selectedEventSlug)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedEventSlug && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEventSlug("");
                      }}
                      className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors"
                      title="Clear event filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isEventDropdownOpen ? "rotate-180" : ""}`} />
                </div>
              </button>

              {isEventDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search event or fest..."
                        value={eventSearchQuery}
                        onChange={(e) => setEventSearchQuery(e.target.value)}
                        className="w-full bg-transparent text-xs font-medium text-slate-800 focus:outline-none placeholder:text-slate-400"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEventSlug("all");
                        setIsEventDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        selectedEventSlug === "all" ? "bg-blue-50 text-[#17458F]" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      All Events &amp; Competitions
                    </button>
                    {scopedEventsList
                      .filter((e) => !eventSearchQuery || e.name.toLowerCase().includes(eventSearchQuery.toLowerCase()))
                      .map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            setSelectedEventSlug(e.slug || e.id);
                            setIsEventDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between ${
                            selectedEventSlug === (e.slug || e.id) ? "bg-blue-50 text-[#17458F] font-bold" : "text-slate-700 hover:bg-slate-50 font-medium"
                          }`}
                        >
                          <span className="truncate">{e.name}</span>
                          {e.isParentFest ? (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded ml-2 shrink-0">Fest</span>
                          ) : e.parentEventId ? (
                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-2 shrink-0">Sub-Event</span>
                          ) : null}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, UTR, Student Name, Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#17458F]/20 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setStatusTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusTab === "all" ? "bg-[#17458F] text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Payments ({!selectedEventSlug ? "—" : filteredByEvent.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("completed")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusTab === "completed" ? "bg-emerald-700 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Approved / Paid ({!selectedEventSlug ? "—" : kpiStats.totalPaidCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("pending")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusTab === "pending" ? "bg-amber-600 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Pending Verification ({!selectedEventSlug ? "—" : kpiStats.pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("refunded")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusTab === "refunded" ? "bg-purple-700 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Refunded ({!selectedEventSlug ? "—" : kpiStats.refundedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("cancelled")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusTab === "cancelled" ? "bg-rose-600 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Cancelled ({!selectedEventSlug ? "—" : filteredByEvent.filter((r) => r.status === "CANCELLED" || r.paymentStatus === "FAILED").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("signals")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              statusTab === "signals"
                ? "bg-[#17458F] text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${statusTab === "signals" ? "text-cyan-300" : "text-[#17458F]"} animate-pulse`} />
            <span>📡 PayHook Signals</span>
          </button>
        </div>
      </div>

      {/* Event Context & Cancellation Action Banner */}
      {currentSelectedEventObj && (
        <div className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200 ${
          currentSelectedEventObj.isCancelled
            ? "bg-rose-50/80 border-2 border-rose-200 text-rose-950"
            : "bg-slate-50 border border-slate-200 text-slate-800"
        }`}>
          <div className="flex items-start sm:items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              currentSelectedEventObj.isCancelled ? "bg-rose-600 text-white" : "bg-[#17458F] text-white"
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  {currentSelectedEventObj.name}
                </h4>
                {currentSelectedEventObj.isCancelled ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-600 text-white shadow-2xs">
                    Event Cancelled
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Active Event
                  </span>
                )}
                {currentSelectedEventObj.isParentFest && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                    Festival Hub
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {currentSelectedEventObj.isCancelled
                  ? currentSelectedEventObj.cancellationNotice || "This event was cancelled by SRC Council. Gate passes are voided."
                  : `Scope includes ${filteredByEvent.length} total registrations (${eligibleForBulkRefund.length} unrefunded paid passes, ₹${totalBulkRefundAmount.toLocaleString("en-IN")} total value).`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {(!currentSelectedEventObj.isCancelled || eligibleForBulkRefund.length > 0) ? (
              <button
                type="button"
                onClick={() => {
                  setCancellationSummary(null);
                  setCancelConfirmationInput("");
                  setHasAcknowledgedRisk(false);
                  setIsCancelEventModalOpen(true);
                }}
                disabled={!canCancelCurrentEvent}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-white" />
                <span>
                  {currentSelectedEventObj.isCancelled
                    ? `Refund Remaining (${eligibleForBulkRefund.length})`
                    : `Cancel Event & Refund All (${eligibleForBulkRefund.length})`}
                </span>
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All Passes Refunded</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Refunds Audit Ledger Banner */}
      {statusTab === "refunded" && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-500/10 via-purple-50 to-indigo-50 border-2 border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-purple-950 uppercase tracking-wider flex items-center gap-2">
                <span>Institutional Refunds Audit Ledger</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[10px] font-mono font-bold">
                  {kpiStats.refundedCount} Refunded Pass{kpiStats.refundedCount !== 1 ? "es" : ""} (₹{kpiStats.totalRefundsAmount.toLocaleString("en-IN")})
                </span>
              </h4>
              <p className="text-[11px] text-purple-800 leading-relaxed">
                All refunded delegate passes are voided from entrance gates. Refunded amounts are strictly excluded from net revenue. Use &ldquo;Sync ARN&rdquo; on any row to reconcile live bank settlement status directly from Cashfree.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExportRefundsExcel}
            disabled={kpiStats.refundedCount === 0}
            className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-purple-200" />
            <span>Export Refunds Ledger (.xlsx)</span>
          </button>
        </div>
      )}

      {/* 4. TRANSACTIONS LEDGER TABLE OR PAYHOOK SIGNALS */}
      {statusTab === "signals" ? (
        <PayhookSignalsSection userEmail={user?.email} />
      ) : (
        <div className="space-y-4">
          {pendingVerifiedMatches.length > 0 && (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>{pendingVerifiedMatches.length} Verified Bank Payment{pendingVerifiedMatches.length !== 1 ? "s" : ""} Awaiting Final Approval</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono">
                      PayHook Verified
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Phone notifications arrived for: <strong>{pendingVerifiedMatches.map((m) => `${m.participantName} (₹${(m.amountPaid ?? 0).toFixed(2)})`).join(", ")}</strong>.
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={async () => {
                  for (const reg of pendingVerifiedMatches) {
                    if (!reg.paymentId) continue;
                    const vPay = verifiedUpiMap.get(reg.paymentId.trim());
                    if (vPay) await handle1TapAutoApprove(reg, vPay);
                  }
                }}
                isLoading={isApproving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 h-auto shadow-xs shrink-0"
              >
                <Zap className="w-3.5 h-3.5 mr-1 text-amber-300 fill-amber-300" />
                <span>Auto-Approve {pendingVerifiedMatches.length === 1 ? "Pass" : "All Passes"}</span>
              </Button>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Order &amp; Reference</th>
                <th className="py-3.5 px-4">Participant</th>
                <th className="py-3.5 px-4">Event / Fee</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {!selectedEventSlug ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#17458F]">
                        <Filter className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-heading font-bold text-slate-800">Select an Event to View Payments</p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Choose a specific event or competition from the filter above to view payment records and manage transactions, or load all records across the tenure.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEventDropdownOpen(true)}
                          className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-[#17458F] text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-all cursor-pointer"
                        >
                          Select Event
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedEventSlug("all")}
                          className="px-3.5 py-2 rounded-xl bg-[#17458F] hover:bg-[#123670] text-xs font-bold text-white shadow-xs transition-all cursor-pointer"
                        >
                          Load All Events
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : displayedPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <CreditCard className="w-8 h-8 text-slate-300 stroke-1" />
                      <p className="text-sm font-bold text-slate-600">No payment records found</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Try adjusting your search query, status tab, or tenure filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedPayments.map((r) => {
                  const isPaid = r.paymentStatus === "PAID" && r.status !== "CANCELLED" && !r.refundStatus;
                  const isPending = r.paymentStatus === "PENDING" || (r.status === "PENDING" && r.paymentStatus !== "PAID");
                  const isRefunded = r.refundStatus === "PROCESSED" || r.paymentStatus === "REFUNDED";
                  const isCancelled = r.status === "CANCELLED" || r.paymentStatus === "FAILED";
                  const verifiedMatch = r.paymentId ? verifiedUpiMap.get(r.paymentId.trim()) : undefined;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/75 transition-colors">
                      {/* Order & Reference */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 tracking-tight">
                            {r.orderId || r.id.slice(0, 14)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(r.orderId || r.id, `ord-${r.id}`)}
                            title="Copy Order ID"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                          >
                            {copiedUtr === `ord-${r.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        {r.paymentId && (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                            <span>UTR:</span>
                            <span className="font-semibold text-slate-700">{r.paymentId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(r.paymentId!, `utr-${r.id}`)}
                              title="Copy UTR"
                              className="p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              {copiedUtr === `utr-${r.id}` ? (
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400">
                          {r.paidAt ? new Date(r.paidAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : (r.registeredAt ? new Date(r.registeredAt).toLocaleDateString("en-IN") : "N/A")}
                        </div>
                      </td>

                      {/* Participant */}
                      <td className="py-3.5 px-4 space-y-0.5">
                        <div className="font-bold text-slate-900">{r.participantName}</div>
                        <div className="text-[11px] text-slate-500">{r.phone}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{r.email}</div>
                      </td>

                      {/* Event / Fee */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="font-semibold text-slate-800 line-clamp-1">{r.eventName}</div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {r.teamType === "Team" && (
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.2 rounded">
                              Team
                            </span>
                          )}
                          {r.department && (
                            <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                              {r.department}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4">
                        <div className="font-heading font-black text-sm text-slate-900">
                          ₹{(r.amountPaid ?? 0).toFixed(2)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 space-y-1">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved / Paid
                          </span>
                        )}
                        {isPending && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pending UTR
                            </span>
                            {verifiedMatch && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                <Zap className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Signal Recvd (₹{verifiedMatch.amount.toFixed(2)})</span>
                              </div>
                            )}
                          </div>
                        )}
                        {isRefunded && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <RotateCcw className="w-3 h-3 text-purple-600" />
                              Refunded
                            </span>
                            {r.refundId && (
                              <div className="text-[9px] font-mono text-purple-700 font-semibold truncate max-w-[140px]" title={r.refundId}>
                                ID: {r.refundId}
                              </div>
                            )}
                            {r.refundArn ? (
                              <div className="text-[9px] font-mono text-slate-600 flex items-center gap-1">
                                <span>ARN:</span>
                                <span className="font-bold text-slate-800">{r.refundArn}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(r.refundArn!, `arn-${r.id}`)}
                                  title="Copy Bank ARN / RRN"
                                  className="p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                                >
                                  {copiedUtr === `arn-${r.id}` ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[9px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 block w-fit">
                                ARN Pending Bank
                              </span>
                            )}
                          </div>
                        )}
                        {isCancelled && !isRefunded && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Cancelled
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Sync ARN (For Refunded records) */}
                          {isRefunded && (
                            <button
                              type="button"
                              onClick={() => handleCheckRefundStatus(r)}
                              disabled={checkingStatusId === r.id}
                              title="Reconcile live bank settlement status and ARN from Cashfree"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 ${checkingStatusId === r.id ? "animate-spin" : ""}`} />
                              <span>Sync ARN</span>
                            </button>
                          )}

                          {/* Approve (For Pending) */}
                          {isPending && (
                            verifiedMatch ? (
                              <Button
                                onClick={() => handle1TapAutoApprove(r, verifiedMatch)}
                                variant="primary"
                                size="sm"
                                isLoading={isApproving}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 h-auto shadow-xs shrink-0"
                              >
                                <Zap className="w-3 h-3 mr-1 text-amber-300 fill-amber-300" />
                                <span>Auto-Approve</span>
                              </Button>
                            ) : (
                              <Button
                                onClick={() => {
                                  setApproveTargetRecord(r);
                                  setApproveUtrInput(r.paymentId || "");
                                }}
                                variant="primary"
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 h-auto"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                <span>Approve</span>
                              </Button>
                            )
                          )}

                          {/* Refund (For Paid records) */}
                          {isPaid && (
                            <Button
                              onClick={() => {
                                setRefundTargetRecord(r);
                                setRefundAmountInput((r.amountPaid ?? 0).toString());
                              }}
                              variant="outline"
                              size="sm"
                              className="text-purple-700 border-purple-200 hover:bg-purple-50 font-bold text-[11px] px-2.5 py-1 h-auto"
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              <span>Refund</span>
                            </Button>
                          )}

                          {/* Cancel (For Pending records) */}
                          {!isCancelled && !isRefunded && (
                            <Button
                              onClick={() => {
                                setCancelTargetRecord(r);
                                setCancelReasonInput("");
                              }}
                              variant="outline"
                              size="sm"
                              className="text-rose-600 border-rose-200 hover:bg-rose-50 font-bold text-[11px] px-2 py-1 h-auto"
                            >
                              <span>Cancel</span>
                            </Button>
                          )}

                          {/* History Timeline */}
                          <button
                            type="button"
                            onClick={() => setHistoryRecord(r)}
                            title="View Transaction Audit History"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Inspect Ticket Pass */}
                          <a
                            href={`/verify/${r.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Inspect Pass / Accreditation Ticket"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    )}

      {/* ========================================================================= */}
      {/* 5. ACTION MODALS */}
      {/* ========================================================================= */}

      {/* APPROVE PAYMENT MODAL */}
      {approveTargetRecord && (
        <Modal
          isOpen={!!approveTargetRecord}
          onClose={() => setApproveTargetRecord(null)}
          title="Approve Payment & Issue Pass"
          subtitle="Manually confirm student payment UTR and activate gate check-in pass"
          maxWidth="md"
        >
          <div className="space-y-4 pt-2 text-left">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Student:</span>
                <span className="font-bold text-slate-900">{approveTargetRecord.participantName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Event:</span>
                <span className="font-semibold text-slate-800">{approveTargetRecord.eventName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Due:</span>
                <span className="font-heading font-black text-slate-900">₹{(approveTargetRecord.amountPaid ?? 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                12-Digit Bank Reference (UTR)
              </label>
              <input
                type="text"
                placeholder="e.g. 425512345678"
                value={approveUtrInput}
                onChange={(e) => setApproveUtrInput(e.target.value.replace(/\s+/g, ""))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="text-[10px] text-slate-400">
                Confirm this UTR matches your Paytm for Business statement.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setApproveTargetRecord(null)}
                disabled={isApproving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleApproveConfirm}
                isLoading={isApproving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="w-4 h-4 mr-1.5" />
                <span>Confirm &amp; Issue Pass</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* REFUND MODAL */}
      {refundTargetRecord && (
        <Modal
          isOpen={!!refundTargetRecord}
          onClose={() => setRefundTargetRecord(null)}
          title="Issue Payment Refund"
          subtitle="Reverses funds and immediately voids the student's entry pass"
          maxWidth="md"
        >
          <div className="space-y-4 pt-2 text-left">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Participant:</span>
                <span className="font-bold text-slate-900">{refundTargetRecord.participantName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order ID:</span>
                <span className="font-mono font-bold text-slate-800">{refundTargetRecord.orderId || refundTargetRecord.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Original Amount:</span>
                <span className="font-heading font-black text-slate-900">₹{(refundTargetRecord.amountPaid ?? 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block">
                  Refund Amount (100% Full Ticket Refund)
                </span>
                <span className="font-heading font-black text-xl text-purple-950">
                  ₹{(refundTargetRecord.amountPaid ?? 0).toFixed(2)}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-200 text-purple-900">
                Direct to Source
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Reason for Refund
              </label>
              <input
                type="text"
                placeholder="e.g. Student unable to attend, duplicate payment"
                value={refundReasonInput}
                onChange={(e) => setRefundReasonInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-[11px] font-medium leading-relaxed">
              💡 <strong>Note:</strong> Processing this refund will permanently void the delegate QR pass so it cannot be scanned at the entrance gate.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setRefundTargetRecord(null)}
                disabled={isRefunding}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRefundConfirm}
                isLoading={isRefunding}
                className="bg-purple-700 hover:bg-purple-800 text-white"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                <span>Process Refund</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* CANCEL MODAL */}
      {cancelTargetRecord && (
        <Modal
          isOpen={!!cancelTargetRecord}
          onClose={() => setCancelTargetRecord(null)}
          title="Cancel Transaction"
          subtitle="Mark this session as cancelled or invalid"
          maxWidth="md"
        >
          <div className="space-y-4 pt-2 text-left">
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel the transaction for <strong>{cancelTargetRecord.participantName}</strong> ({cancelTargetRecord.eventName})?
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Cancellation Reason
              </label>
              <input
                type="text"
                placeholder="e.g. Invalid UTR, Duplicate entry"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setCancelTargetRecord(null)}
                disabled={isCancelling}
              >
                Keep Active
              </Button>
              <Button
                variant="primary"
                onClick={handleCancelConfirm}
                isLoading={isCancelling}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                <span>Cancel Transaction</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* AUDIT HISTORY DRAWER */}
      {historyRecord && (
        <Modal
          isOpen={!!historyRecord}
          onClose={() => setHistoryRecord(null)}
          title="Transaction Audit History"
          subtitle={`Full chronological lifecycle for Order ${historyRecord.orderId || historyRecord.id}`}
          maxWidth="2xl"
        >
          <div className="space-y-6 pt-2 text-left">
            {/* Meta summary */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs shadow-2xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Participant</span>
                <span className="font-bold text-slate-900 text-sm">{historyRecord.participantName}</span>
                <span className="text-slate-500 block text-xs mt-0.5">{historyRecord.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Event</span>
                <span className="font-semibold text-slate-900 text-sm">{historyRecord.eventName}</span>
                <span className="font-mono font-bold text-slate-800 block text-xs mt-0.5">₹{(historyRecord.amountPaid ?? 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Visual Timeline */}
            <div className="space-y-6 relative border-l-2 border-slate-200 ml-4 pl-6 py-1">
              {/* Event 1: Registration Session Initialized */}
              <div className="relative">
                <div className="absolute -left-[32px] top-1 w-3.5 h-3.5 rounded-full bg-blue-500 ring-4 ring-white shadow-2xs" />
                <div className="font-bold text-xs text-slate-900">Registration Initiated</div>
                <div className="text-[11px] text-slate-500">
                  {formatTimestamp(historyRecord.createdAt)}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Dynamic UPI QR code and Order ID generated.</p>
              </div>

              {/* Event 2: Payment / UTR Submission */}
              {historyRecord.paymentId && (
                <div className="relative">
                  <div className="absolute -left-[32px] top-1 w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-white shadow-2xs" />
                  <div className="font-bold text-xs text-slate-900">UTR / Reference Logged</div>
                  <div className="text-[11px] font-mono text-slate-700 font-semibold">
                    UTR: {historyRecord.paymentId}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {historyRecord.paidAt ? new Date(historyRecord.paidAt).toLocaleString("en-IN") : "Submitted by client"}
                  </div>
                </div>
              )}

              {/* Event 3: Approval / Verification */}
              {historyRecord.paymentStatus === "PAID" && (
                <div className="relative">
                  <div className="absolute -left-[32px] top-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-white shadow-2xs" />
                  <div className="font-bold text-xs text-emerald-900">Payment Verified &amp; Pass Activated</div>
                  <div className="text-[11px] text-slate-500">
                    Verified By: {historyRecord.verifiedBy || "Automated Bank Webhook / Auto-Approval"}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Ticket Code: <span className="font-mono font-bold text-slate-700">{historyRecord.ticketCode}</span>
                  </div>
                </div>
              )}

              {/* Event 4: Refund Record */}
              {historyRecord.refundStatus && (
                <div className="relative">
                  <div className="absolute -left-[32px] top-1 w-3.5 h-3.5 rounded-full bg-purple-500 ring-4 ring-white shadow-2xs" />
                  <div className="font-bold text-xs text-purple-900">Refund Processed (100% Full Refund)</div>
                  <div className="text-[11px] text-slate-600">
                    Full refund of <strong>₹{historyRecord.refundAmount || historyRecord.amountPaid || 0}</strong> credited back to source.
                  </div>
                  <div className="text-[10px] font-mono text-purple-700">
                    Refund ID: {historyRecord.refundId || "N/A"}
                  </div>
                  {historyRecord.refundArn && (
                    <div className="text-[10px] font-mono text-slate-700 font-bold">
                      Bank Settlement ARN: {historyRecord.refundArn}
                    </div>
                  )}
                  {historyRecord.refundNote && (
                    <div className="text-[11px] text-slate-500 italic mt-0.5">
                      Note: &ldquo;{historyRecord.refundNote}&rdquo;
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Initiated by {historyRecord.refundInitiatedBy || historyRecord.cancelledBy || "SRC Admin"} • {historyRecord.refundedAt ? new Date(historyRecord.refundedAt).toLocaleString("en-IN") : "Processed"}
                  </div>
                </div>
              )}

              {/* Event 5: Cancellation Record */}
              {historyRecord.status === "CANCELLED" && (
                <div className="relative">
                  <div className="absolute -left-[32px] top-1 w-3.5 h-3.5 rounded-full bg-rose-500 ring-4 ring-white shadow-2xs" />
                  <div className="font-bold text-xs text-rose-900">Pass Voided / Cancelled</div>
                  <p className="text-[11px] text-slate-500">
                    Reason: {historyRecord.cancellationReason || "Cancelled by admin"}
                  </p>
                  <div className="text-[10px] text-slate-400">
                    By: {historyRecord.cancelledBy || "SRC Admin"} {historyRecord.cancelledAt ? `• ${new Date(historyRecord.cancelledAt).toLocaleString("en-IN")}` : ""}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button variant="primary" onClick={() => setHistoryRecord(null)} size="sm">
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* CANCEL EVENT & BULK REFUND MODAL */}
      {isCancelEventModalOpen && currentSelectedEventObj && (
        <Modal
          isOpen={isCancelEventModalOpen}
          onClose={() => {
            if (!isCancellingAndRefunding) {
              setIsCancelEventModalOpen(false);
              setCancellationSummary(null);
            }
          }}
          title={cancellationSummary ? "Event Cancellation Complete" : "Cancel Event & Refund All Registrations"}
          subtitle={
            cancellationSummary
              ? `Refund operations finished for ${currentSelectedEventObj.name}`
              : `Bulk refund and pass cancellation for ${currentSelectedEventObj.name}`
          }
          maxWidth="2xl"
        >
          <div className="space-y-5 pt-1 text-left">
            {cancellationSummary ? (
              // SUMMARY VIEW AFTER EXECUTION
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-emerald-950">
                        Event Successfully Marked Cancelled
                      </h4>
                      <p className="text-xs text-emerald-800">
                        Public status is updated and passes have been processed.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/60 text-xs">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Refunds Issued</span>
                      <span className="font-heading font-black text-lg text-emerald-700">{cancellationSummary.successCount}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Refunded</span>
                      <span className="font-heading font-black text-lg text-purple-700">₹{cancellationSummary.totalRefunded.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Free Voided</span>
                      <span className="font-heading font-black text-lg text-slate-700">{cancellationSummary.voidedFreeCount}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Failed</span>
                      <span className={`font-heading font-black text-lg ${cancellationSummary.failedCount > 0 ? "text-rose-600" : "text-slate-400"}`}>
                        {cancellationSummary.failedCount}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  All processed refunds have been credited back to participants via Cashfree auto-refund, and their passes have been updated to <strong>CANCELLED / REFUNDED</strong>.
                </p>

                <div className="pt-2 flex justify-end">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setIsCancelEventModalOpen(false);
                      setCancellationSummary(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : isCancellingAndRefunding ? (
              // PROCESSING VIEW WITH PROGRESS BAR
              <div className="space-y-5 py-4 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-100 text-rose-600 animate-pulse">
                  <RotateCcw className="w-7 h-7 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-heading font-bold text-base text-slate-900">
                    Processing Bulk Event Refunds...
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Please do not close or refresh this tab. Communicating with Cashfree Gateway and recording audit receipts in Firestore.
                  </p>
                </div>

                {bulkRefundProgress && (
                  <div className="space-y-2 max-w-md mx-auto bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>Pass {bulkRefundProgress.current} of {bulkRefundProgress.total}</span>
                      <span>
                        {bulkRefundProgress.total > 0
                          ? Math.round((bulkRefundProgress.current / bulkRefundProgress.total) * 100)
                          : 100}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-600 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${bulkRefundProgress.total > 0 ? (bulkRefundProgress.current / bulkRefundProgress.total) * 100 : 100}%`,
                        }}
                      />
                    </div>
                    {bulkRefundProgress.currentParticipant && (
                      <p className="text-[11px] text-slate-500 truncate">
                        Refunding: <strong className="text-slate-800">{bulkRefundProgress.currentParticipant}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // CONFIRMATION FORM VIEW
              <div className="space-y-4">
                {/* Warning Alert */}
                <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-950 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-extrabold uppercase tracking-wide block">
                      Critical Event Cancellation &amp; Direct Refund Action
                    </span>
                    <p className="text-rose-900/90 leading-relaxed">
                      Marking <strong>{currentSelectedEventObj.name}</strong> as cancelled will update its public status to <span className="font-bold">Cancelled</span> across the portal.
                      All eligible paid delegate registrations will receive automated 100% full Cashfree refunds directly to their original payment source.
                    </p>
                  </div>
                </div>

                {/* Scope Breakdown Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Eligible for Cashfree Refund</span>
                    <span className="font-heading font-black text-xl text-rose-700">
                      {eligibleForBulkRefund.length} <span className="text-xs font-normal text-slate-500">pass{eligibleForBulkRefund.length !== 1 ? "es" : ""}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Refund Payout</span>
                    <span className="font-heading font-black text-xl text-purple-700 font-mono">
                      ₹{totalBulkRefundAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Complimentary / Free Passes</span>
                    <span className="font-heading font-black text-xl text-slate-700">
                      {eligibleNonPaidForCancel.length} <span className="text-xs font-normal text-slate-500">to void</span>
                    </span>
                  </div>
                </div>

                {/* Public Cancellation Notice */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Public Cancellation Notice &amp; Refund Note <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={cancellationNoticeInput}
                    onChange={(e) => setCancellationNoticeInput(e.target.value)}
                    placeholder="Enter the official reason for cancelling this event and issuing refunds..."
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    This message will be attached to every refunded registration record in Firestore and shown to delegates on their digital passes.
                  </p>
                </div>

                {/* Safety Confirmation & Type-to-Unlock Challenge */}
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 space-y-3.5">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-rose-950 font-medium select-none">
                    <input
                      type="checkbox"
                      checked={hasAcknowledgedRisk}
                      onChange={(e) => setHasAcknowledgedRisk(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer shrink-0"
                    />
                    <span>
                      I understand this action is <strong>permanent and irreversible</strong>. It will immediately cancel the event, void all delegate passes at gate check-in, and initiate automated Cashfree bank refunds totaling <strong>₹{totalBulkRefundAmount.toLocaleString("en-IN")}</strong>.
                    </span>
                  </label>

                  <div className="space-y-1.5 pt-1 border-t border-rose-200/60">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      To prevent accidental execution, type <span className="font-mono bg-rose-200/70 text-rose-900 px-1.5 py-0.5 rounded font-black tracking-widest">CONFIRM</span> below to unlock:
                    </label>
                    <input
                      type="text"
                      value={cancelConfirmationInput}
                      onChange={(e) => setCancelConfirmationInput(e.target.value)}
                      placeholder="Type CONFIRM here..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 uppercase tracking-widest"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <Button
                    variant="outline"
                    onClick={() => setIsCancelEventModalOpen(false)}
                    disabled={isCancellingAndRefunding}
                  >
                    Keep Event Active
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleExecuteCancelAndRefund}
                    disabled={
                      isCancellingAndRefunding ||
                      !canCancelCurrentEvent ||
                      !hasAcknowledgedRisk ||
                      cancelConfirmationInput.trim().toUpperCase() !== "CONFIRM"
                    }
                    className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold"
                  >
                    <AlertTriangle className="w-4 h-4 mr-1.5" />
                    <span>
                      {cancelConfirmationInput.trim().toUpperCase() !== "CONFIRM" || !hasAcknowledgedRisk
                        ? "Confirmation Required to Unlock"
                        : currentSelectedEventObj.isCancelled
                        ? `Process Remaining ${eligibleForBulkRefund.length} Refunds`
                        : `Confirm Cancellation & Refund All (${eligibleForBulkRefund.length})`}
                    </span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* GATEWAY SETTINGS MODAL */}
      <PaymentConfigModal
        isOpen={isPaymentConfigOpen}
        onClose={() => setIsPaymentConfigOpen(false)}
      />

      {/* SYNC CASHFREE MODAL */}
      <SyncCashfreeModal
        isOpen={isSyncCashfreeOpen}
        onClose={() => setIsSyncCashfreeOpen(false)}
        onSuccess={(newReg) => {
          setRegistrations((prev) => [newReg, ...prev.filter((r) => r.id !== newReg.id)]);
          setFeedbackNotice(`Successfully recovered pass for ${newReg.participantName || "Student"}!`);
        }}
      />

    </div>
  );
}
