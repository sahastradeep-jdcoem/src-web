"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  X
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { getStoredEvents, syncEventsFromFirestore } from "@/lib/eventsStore";
import { getStoredTenures, syncTenuresFromFirestore, subscribeToTenures, CouncilTenure } from "@/lib/tenureStore";
import { 
  getAllRegistrationsFromFirestore, 
  subscribeToRegistrationsFromFirestore, 
  updateRegistrationRefundInFirestore, 
  updateRegistrationPaymentStatus,
  subscribeToSiteContent,
  isTestPassRecord,
  isHubRecord,
  StudentRegistrationRecord
} from "@/lib/firebase/firestore";
import { db } from "@/lib/firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import { PaymentConfigModal } from "@/components/admin/registrations/PaymentConfigModal";
import { 
  getStoredPaymentConfig, 
  subscribeToPaymentConfig, 
  PaymentConfig 
} from "@/lib/paymentConfigStore";
import { EventItem, RegistrationRecord } from "@/types";

type PaymentTabFilter = "all" | "completed" | "pending" | "refunded" | "cancelled";

function getTimestampMs(val: any): number {
  if (!val) return NaN;
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val).getTime();
    return isNaN(d) ? NaN : d;
  }
  if (val instanceof Date) return val.getTime();
  if (typeof val === "object" && typeof val.seconds === "number") {
    return val.seconds * 1000;
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
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [tenuresList, setTenuresList] = useState<CouncilTenure[]>([]);
  const [selectedTenureId, setSelectedTenureId] = useState<string>("all");
  const [selectedEventSlug, setSelectedEventSlug] = useState<string>("all");
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
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Payment gateway config modal
  const [isPaymentConfigOpen, setIsPaymentConfigOpen] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(getStoredPaymentConfig());

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
    setTenuresList(getStoredTenures());
    syncTenuresFromFirestore().then((res) => {
      if (res && res.length > 0) setTenuresList(res);
    });

    const unsubscribeEvents = subscribeToSiteContent<EventItem[]>("events", (cloudEvts) => {
      if (cloudEvts && Array.isArray(cloudEvts) && cloudEvts.length > 0) {
        setEventsList(cloudEvts);
      }
    });

    const unsubscribeTenures = subscribeToTenures((cloudTenures) => {
      if (cloudTenures && Array.isArray(cloudTenures) && cloudTenures.length > 0) {
        setTenuresList(cloudTenures);
      }
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (eventDropdownRef.current && !eventDropdownRef.current.contains(event.target as Node)) {
        setIsEventDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      unsubscribeEvents();
      unsubscribeTenures();
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

        return {
          id: r.id,
          registrationId: r.registrationId || r.id,
          eventId: r.eventId || "",
          eventSlug: r.eventSlug || r.eventId || "general-event",
          eventName: r.eventTitle || r.eventName || "Event Delegate Pass",
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
          refundId: r.refundId,
          refundStatus: r.refundStatus,
          refundAmount: r.refundAmount,
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
    // 1. Local Cache
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      if (Array.isArray(local) && local.length > 0) {
        setRegistrations(formatRecords(local));
      }
    } catch {}

    // 2. Direct Asynchronous Fetch
    getAllRegistrationsFromFirestore().then((cloud) => {
      if (cloud && cloud.length > 0) {
        const formatted = formatRecords(cloud);
        setRegistrations(formatted);
        try {
          localStorage.setItem("src_local_registrations", JSON.stringify(formatted));
        } catch {}
      }
    });

    // 3. Real-Time Snapshot Listener
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

  // Filter Payments by Tenure & Event
  const filteredByTenure = useMemo(() => {
    if (selectedTenureId === "all") return registrations;
    const currentTenure = tenuresList.find((t) => t.id === selectedTenureId);
    if (!currentTenure) return registrations;

    const startYear = parseInt(currentTenure.academicYear.split("-")[0]);
    const endYear = parseInt(currentTenure.academicYear.split("-")[1] || (startYear + 1).toString());
    const tenureStart = new Date(startYear, 5, 1).getTime();
    const tenureEnd = new Date(endYear, 5, 30, 23, 59, 59).getTime();

    return registrations.filter((r) => {
      const targetTime = r.paidAt || r.registeredAt || r.createdAt;
      if (!targetTime) return true;
      const t = getTimestampMs(targetTime);
      return !isNaN(t) ? t >= tenureStart && t <= tenureEnd : true;
    });
  }, [registrations, selectedTenureId, tenuresList]);

  const filteredByEvent = useMemo(() => {
    if (selectedEventSlug === "all") return filteredByTenure;
    const selectedEvt = eventsList.find((e) => (e.slug && e.slug.toLowerCase() === selectedEventSlug.toLowerCase()) || (e.name && e.name.toLowerCase() === selectedEventSlug.toLowerCase()) || e.id === selectedEventSlug);
    
    const childNames = new Set<string>();
    if (selectedEvt && selectedEvt.isParentFest) {
      eventsList.forEach((e) => {
        if (
          (e.parentEventId && (e.parentEventId === selectedEvt.id || e.parentEventId === selectedEvt.slug)) ||
          (e.parentEventSlug && (e.parentEventSlug === selectedEvt.slug || e.parentEventSlug === selectedEvt.id))
        ) {
          if (e.name) childNames.add(e.name.toLowerCase());
          if (e.slug) childNames.add(e.slug.toLowerCase());
          if (e.id) childNames.add(e.id.toLowerCase());
        }
      });
    }

    return filteredByTenure.filter((r) => {
      const rName = (r.eventName || "").toLowerCase();
      const rSlug = (r.eventSlug || "").toLowerCase();
      const rId = (r.eventId || "").toLowerCase();

      const matchesDirect =
        rName === selectedEventSlug.toLowerCase() ||
        rSlug === selectedEventSlug.toLowerCase() ||
        rId === selectedEventSlug.toLowerCase() ||
        (selectedEvt && (
          rName === (selectedEvt.name || "").toLowerCase() || 
          rSlug === (selectedEvt.slug || "").toLowerCase() ||
          rId === selectedEvt.id.toLowerCase()
        ));

      const matchesChild = childNames.has(rName) || childNames.has(rSlug) || childNames.has(rId);

      return matchesDirect || matchesChild;
    });
  }, [filteredByTenure, selectedEventSlug, eventsList]);

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

    return list;
  }, [filteredByEvent, statusTab, searchQuery]);

  // KPI Metrics Calculation
  const kpiStats = useMemo(() => {
    const paidList = filteredByEvent.filter((r) => r.paymentStatus === "PAID");
    const totalGrossRevenue = paidList.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);
    const pendingList = filteredByEvent.filter((r) => r.paymentStatus === "PENDING" || (r.status === "PENDING" && r.paymentStatus !== "PAID"));
    const refundedList = filteredByEvent.filter((r) => r.refundStatus === "PROCESSED" || r.paymentStatus === "REFUNDED");
    const totalRefundsAmount = refundedList.reduce((acc, curr) => acc + (curr.refundAmount || curr.amountPaid || 0), 0);

    return {
      totalGrossRevenue,
      totalPaidCount: paidList.length,
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
      "Refund Amount": r.refundAmount || 0,
      "Refund ID": r.refundId || "N/A",
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

  // Approve Payment Action
  const handleApproveConfirm = async () => {
    if (!approveTargetRecord) return;
    const regId = approveTargetRecord.registrationId || approveTargetRecord.id;
    const finalUtr = approveUtrInput.trim() || approveTargetRecord.paymentId || `MANUAL-${Date.now().toString().slice(-6)}`;

    setIsApproving(true);
    try {
      await updateRegistrationPaymentStatus(regId, "PAID", "SRC Admin / Treasurer");
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const docRef = doc(db, "student_registrations", regId);
        await updateDoc(docRef, {
          paymentStatus: "PAID",
          status: "CONFIRMED",
          paymentId: finalUtr,
          paidAt: new Date().toISOString(),
          verifiedBy: "SRC Admin / Treasurer",
          verifiedAt: new Date().toISOString(),
        });
      }

      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === approveTargetRecord.id || r.registrationId === regId
            ? {
                ...r,
                paymentStatus: "PAID",
                status: "CONFIRMED",
                paymentId: finalUtr,
                paidAt: new Date().toISOString(),
                verifiedBy: "SRC Admin / Treasurer",
                verifiedAt: new Date().toISOString(),
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

  // Refund Payment Action
  const handleRefundConfirm = async () => {
    if (!refundTargetRecord) return;
    const regId = refundTargetRecord.registrationId || refundTargetRecord.id;
    const amountNum = parseFloat(refundAmountInput) || (refundTargetRecord.amountPaid ?? 0);

    if (amountNum <= 0) {
      alert("Please enter a valid refund amount.");
      return;
    }

    setIsRefunding(true);
    try {
      const res = await fetch("/api/paytm/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: refundTargetRecord.paymentId,
          orderId: refundTargetRecord.orderId,
          amount: amountNum,
          registrationId: regId,
          reason: refundReasonInput || "Refund issued via SRC Admin Payments Studio",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const nowIso = new Date().toISOString();
        await updateRegistrationRefundInFirestore(regId, {
          refundId: data.refundId,
          refundStatus: "PROCESSED",
          refundAmount: amountNum,
          refundedAt: nowIso,
        });

        // Invalidate pass in Firestore
        if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
          const docRef = doc(db, "student_registrations", regId);
          await updateDoc(docRef, {
            status: "CANCELLED",
            paymentStatus: "REFUNDED",
            cancellationReason: `Refunded: ${refundReasonInput} (Refund ID: ${data.refundId})`,
            cancelledAt: nowIso,
            cancelledBy: "SRC Admin / Treasurer",
          });
        }

        setRegistrations((prev) =>
          prev.map((r) =>
            r.id === refundTargetRecord.id || r.registrationId === regId
              ? {
                  ...r,
                  status: "CANCELLED",
                  paymentStatus: "REFUNDED",
                  refundId: data.refundId,
                  refundStatus: "PROCESSED",
                  refundAmount: amountNum,
                  refundedAt: nowIso,
                  cancellationReason: `Refunded: ${refundReasonInput} (Refund ID: ${data.refundId})`,
                  cancelledAt: nowIso,
                }
              : r
          )
        );

        setFeedbackNotice(`Refund Processed: ₹${amountNum} for ${refundTargetRecord.participantName} (ID: ${data.refundId}).`);
        setTimeout(() => setFeedbackNotice(null), 5000);
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

  // Cancel Transaction Action
  const handleCancelConfirm = async () => {
    if (!cancelTargetRecord) return;
    const regId = cancelTargetRecord.registrationId || cancelTargetRecord.id;

    setIsCancelling(true);
    try {
      const nowIso = new Date().toISOString();
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const docRef = doc(db, "student_registrations", regId);
        await updateDoc(docRef, {
          status: "CANCELLED",
          paymentStatus: "FAILED",
          cancellationReason: cancelReasonInput || "Cancelled by SRC Admin",
          cancelledAt: nowIso,
          cancelledBy: "SRC Admin / Treasurer",
        });
      }

      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === cancelTargetRecord.id || r.registrationId === regId
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
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-[#17458F]">
              <CreditCard className="w-5 h-5" />
            </div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
              PAYMENTS &amp; TREASURY STUDIO
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Institutional Financial Ledger • Real-time UPI &amp; Paytm Settlements
          </p>
        </div>

        {/* Header Actions: Gateway Settings & Export Excel */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPaymentConfigOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-all cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-[#17458F]" />
            <span>Gateway Settings</span>
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
        {/* Gross Revenue */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Gross Collections</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
              ₹{kpiStats.totalGrossRevenue.toLocaleString("en-IN")}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              From {kpiStats.totalPaidCount} successful transactions
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
              {kpiStats.totalPaidCount}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Active delegate passes issued
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
              {kpiStats.pendingCount}
            </div>
            {kpiStats.pendingCount > 0 && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse">
                Action Required
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            Submitted UTRs awaiting admin check
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
              ₹{kpiStats.totalRefundsAmount.toLocaleString("en-IN")}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              {kpiStats.refundedCount} transactions refunded &amp; voided
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
                  onChange={(e) => setSelectedTenureId(e.target.value)}
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
                    {selectedEventSlug === "all" 
                      ? "All Events & Fests" 
                      : (eventsList.find((e) => e.slug === selectedEventSlug || e.id === selectedEventSlug)?.name || selectedEventSlug)}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isEventDropdownOpen ? "rotate-180" : ""}`} />
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
                    {eventsList
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
            All Payments ({filteredByEvent.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("completed")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusTab === "completed" ? "bg-emerald-700 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Approved / Paid ({kpiStats.totalPaidCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("pending")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusTab === "pending" ? "bg-amber-600 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Pending Verification ({kpiStats.pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("refunded")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusTab === "refunded" ? "bg-purple-700 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Refunded ({kpiStats.refundedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab("cancelled")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusTab === "cancelled" ? "bg-rose-600 text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Cancelled ({filteredByEvent.filter((r) => r.status === "CANCELLED" || r.paymentStatus === "FAILED").length})
          </button>
        </div>
      </div>

      {/* 4. TRANSACTIONS LEDGER TABLE */}
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
              {displayedPayments.length === 0 ? (
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
                        <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded inline-block mt-0.5">
                          Zero Surcharge
                        </span>
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending UTR
                          </span>
                        )}
                        {isRefunded && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <RotateCcw className="w-3 h-3 text-purple-600" />
                              Refunded
                            </span>
                            {r.refundId && (
                              <div className="text-[9px] font-mono text-purple-600">ID: {r.refundId}</div>
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
                          {/* Approve (For Pending) */}
                          {isPending && (
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

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Refund Amount (₹)
              </label>
              <input
                type="number"
                step="1"
                max={refundTargetRecord.amountPaid ?? 0}
                value={refundAmountInput}
                onChange={(e) => setRefundAmountInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
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
          maxWidth="lg"
        >
          <div className="space-y-5 pt-2 text-left">
            {/* Meta summary */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Participant</span>
                <span className="font-bold text-slate-900">{historyRecord.participantName}</span>
                <span className="text-slate-500 block text-[11px]">{historyRecord.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Event</span>
                <span className="font-semibold text-slate-900">{historyRecord.eventName}</span>
                <span className="font-mono font-bold text-slate-700 block">₹{(historyRecord.amountPaid ?? 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Visual Timeline */}
            <div className="space-y-4 pl-2 border-l-2 border-slate-200 ml-3">
              {/* Event 1: Registration Session Initialized */}
              <div className="relative pl-6">
                <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                <div className="font-bold text-xs text-slate-900">Registration Initiated</div>
                <div className="text-[11px] text-slate-500">
                  {formatTimestamp(historyRecord.createdAt)}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Dynamic UPI QR code and Order ID generated.</p>
              </div>

              {/* Event 2: Payment / UTR Submission */}
              {historyRecord.paymentId && (
                <div className="relative pl-6">
                  <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-white" />
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
                <div className="relative pl-6">
                  <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
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
                <div className="relative pl-6">
                  <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-purple-500 border-2 border-white" />
                  <div className="font-bold text-xs text-purple-900">Refund Processed</div>
                  <div className="text-[11px] text-slate-600">
                    Refund of <strong>₹{historyRecord.refundAmount || historyRecord.amountPaid || 0}</strong> issued.
                  </div>
                  <div className="text-[10px] font-mono text-purple-700">
                    Refund ID: {historyRecord.refundId || "N/A"}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {historyRecord.refundedAt ? new Date(historyRecord.refundedAt).toLocaleString("en-IN") : "Processed"}
                  </div>
                </div>
              )}

              {/* Event 5: Cancellation Record */}
              {historyRecord.status === "CANCELLED" && (
                <div className="relative pl-6">
                  <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-rose-500 border-2 border-white" />
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

      {/* GATEWAY SETTINGS MODAL */}
      <PaymentConfigModal
        isOpen={isPaymentConfigOpen}
        onClose={() => setIsPaymentConfigOpen(false)}
      />

    </div>
  );
}
