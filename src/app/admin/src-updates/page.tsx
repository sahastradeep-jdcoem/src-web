"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { 
  BellRing, 
  Plus, 
  Calendar, 
  CreditCard, 
  Search, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Users, 
  UserCheck, 
  QrCode, 
  Send, 
  Sparkles, 
  X, 
  ExternalLink,
  Filter,
  ShieldCheck,
  Building,
  Target
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";
import { 
  SrcDispatch, 
  SrcDispatchCategory, 
  SrcDispatchPriority, 
  SrcDispatchTarget 
} from "@/types/srcDispatch";
import { 
  getStoredSrcDispatches, 
  saveStoredSrcDispatches, 
  syncSrcDispatchesFromFirestore, 
  subscribeToSrcDispatches 
} from "@/lib/srcDispatchesStore";
import { 
  getAllSavedSrcMembers, 
  verifySrcMemberByBtId, 
  SavedSrcMemberRecord 
} from "@/lib/srcMembership";
import { useAuth } from "@/context/AuthContext";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";

export default function AdminSrcUpdatesPage() {
  const { user } = useAuth();
  const [dispatches, setDispatches] = useState<SrcDispatch[]>([]);
  const [savedMembers, setSavedMembers] = useState<SavedSrcMemberRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | SrcDispatchCategory>("ALL");
  const [targetFilter, setTargetFilter] = useState<"ALL" | "ALL_MEMBERS" | "SINGLE_MEMBER">("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState<SrcDispatch | null>(null);
  const [deletingDispatch, setDeletingDispatch] = useState<SrcDispatch | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    category: SrcDispatchCategory;
    priority: SrcDispatchPriority;
    targetType: SrcDispatchTarget;
    targetBtId: string;
    targetMemberName: string;
    content: string;
    badgeText: string;
    authorName: string;
    authorRole: string;
    // Event Details
    eventName: string;
    eventDate: string;
    eventTime: string;
    eventVenue: string;
    eventActionUrl: string;
    eventMeetingType: "in_person" | "online" | "hybrid";
    eventAgenda: string;
    // Payment Details
    paymentAmount: string;
    paymentPurpose: string;
    paymentUpiId: string;
    paymentPayeeName: string;
    paymentDeadline: string;
    paymentQrImageUrl: string;
    paymentNote: string;
  }>({
    title: "",
    category: "update",
    priority: "normal",
    targetType: "all_members",
    targetBtId: "",
    targetMemberName: "",
    content: "",
    badgeText: "",
    authorName: user?.displayName || "SRC Admin",
    authorRole: user?.designationBadge || "Council Administrator",
    eventName: "",
    eventDate: "",
    eventTime: "",
    eventVenue: "Council Chambers / Seminar Hall 1",
    eventActionUrl: "",
    eventMeetingType: "in_person",
    eventAgenda: "",
    paymentAmount: "",
    paymentPurpose: "",
    paymentUpiId: "srcjdcoem@oksbi",
    paymentPayeeName: "SRC Central JDCOEM",
    paymentDeadline: "",
    paymentQrImageUrl: "",
    paymentNote: "Please include your BT ID in UPI remarks for automatic reconciliation.",
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    // 1. Initial local load
    setDispatches(getStoredSrcDispatches());
    setSavedMembers(getAllSavedSrcMembers());
    setIsLoading(false);

    // 2. Cloud fetch & real-time sync
    syncSrcDispatchesFromFirestore().then((cloud) => {
      if (cloud && cloud.length > 0) setDispatches(cloud);
    });

    const unsub = subscribeToSrcDispatches((updated) => {
      setDispatches(updated);
    });

    return () => unsub();
  }, []);

  // Filtered dispatches
  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      if (categoryFilter !== "ALL" && d.category !== categoryFilter) return false;
      if (targetFilter === "ALL_MEMBERS" && d.targetType !== "all_members") return false;
      if (targetFilter === "SINGLE_MEMBER" && d.targetType !== "single_member") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (d.title || "").toLowerCase().includes(q);
        const matchContent = (d.content || "").toLowerCase().includes(q);
        const matchBt = (d.targetBtId || "").toLowerCase().includes(q);
        const matchName = (d.targetMemberName || "").toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchBt && !matchName) return false;
      }
      return true;
    });
  }, [dispatches, categoryFilter, targetFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = dispatches.length;
    const broadcastCount = dispatches.filter((d) => d.targetType === "all_members").length;
    const directCount = dispatches.filter((d) => d.targetType === "single_member").length;
    const paymentCount = dispatches.filter((d) => d.category === "payment_qr").length;
    const eventCount = dispatches.filter((d) => d.category === "event").length;
    return { total, broadcastCount, directCount, paymentCount, eventCount };
  }, [dispatches]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingDispatch(null);
    setFormData({
      title: "",
      category: "update",
      priority: "normal",
      targetType: "all_members",
      targetBtId: "",
      targetMemberName: "",
      content: "",
      badgeText: "",
      authorName: user?.displayName || "SRC Admin",
      authorRole: user?.designationBadge || "Council Administrator",
      eventName: "",
      eventDate: "",
      eventTime: "",
      eventVenue: "Council Chambers / Seminar Hall 1",
      eventActionUrl: "",
      eventMeetingType: "in_person",
      eventAgenda: "",
      paymentAmount: "",
      paymentPurpose: "",
      paymentUpiId: "srcjdcoem@oksbi",
      paymentPayeeName: "SRC Central JDCOEM",
      paymentDeadline: "",
      paymentQrImageUrl: "",
      paymentNote: "Please include your BT ID in UPI remarks for automatic reconciliation.",
    });
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (dispatch: SrcDispatch) => {
    setEditingDispatch(dispatch);
    setFormData({
      title: dispatch.title || "",
      category: dispatch.category || "update",
      priority: dispatch.priority || "normal",
      targetType: dispatch.targetType || "all_members",
      targetBtId: dispatch.targetBtId || "",
      targetMemberName: dispatch.targetMemberName || "",
      content: dispatch.content || "",
      badgeText: dispatch.badgeText || "",
      authorName: dispatch.authorName || (user?.displayName || "SRC Admin"),
      authorRole: dispatch.authorRole || (user?.designationBadge || "Council Administrator"),
      eventName: dispatch.eventDetails?.eventName || "",
      eventDate: dispatch.eventDetails?.date || "",
      eventTime: dispatch.eventDetails?.time || "",
      eventVenue: dispatch.eventDetails?.venue || "Council Chambers / Seminar Hall 1",
      eventActionUrl: dispatch.eventDetails?.actionUrl || "",
      eventMeetingType: dispatch.eventDetails?.meetingType || "in_person",
      eventAgenda: dispatch.eventDetails?.agenda || "",
      paymentAmount: dispatch.paymentDetails?.amount ? String(dispatch.paymentDetails.amount) : "",
      paymentPurpose: dispatch.paymentDetails?.purpose || "",
      paymentUpiId: dispatch.paymentDetails?.upiId || "srcjdcoem@oksbi",
      paymentPayeeName: dispatch.paymentDetails?.payeeName || "SRC Central JDCOEM",
      paymentDeadline: dispatch.paymentDetails?.deadline || "",
      paymentQrImageUrl: dispatch.paymentDetails?.qrImageUrl || "",
      paymentNote: dispatch.paymentDetails?.note || "Please include your BT ID in UPI remarks for automatic reconciliation.",
    });
    setIsModalOpen(true);
  };

  // Autocomplete select for target member
  const handleSelectMember = (btId: string) => {
    const matched = savedMembers.find((m) => m.btId.toUpperCase() === btId.toUpperCase());
    if (matched) {
      setFormData((prev) => ({
        ...prev,
        targetBtId: matched.btId,
        targetMemberName: `${matched.name} (${matched.designation})`,
      }));
    } else {
      const verified = verifySrcMemberByBtId(btId);
      setFormData((prev) => ({
        ...prev,
        targetBtId: btId.toUpperCase().trim(),
        targetMemberName: verified.isSrcMember ? `${verified.name || "Member"} (${verified.designationBadge})` : "",
      }));
    }
  };

  // Submit Save
  const handleSaveDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("Please enter a dispatch title.");
      return;
    }

    if (formData.targetType === "single_member" && !formData.targetBtId.trim()) {
      alert("Please select or specify a target College BT ID for single-member dispatch.");
      return;
    }

    setIsSaving(true);
    try {
      const isNew = !editingDispatch;
      const dispatchId = editingDispatch ? editingDispatch.id : `dispatch-${Date.now()}`;

      const payload: SrcDispatch = {
        id: dispatchId,
        title: formData.title.trim(),
        category: formData.category,
        priority: formData.priority,
        targetType: formData.targetType,
        targetBtId: formData.targetType === "single_member" ? formData.targetBtId.trim().toUpperCase() : undefined,
        targetMemberName: formData.targetType === "single_member" ? formData.targetMemberName.trim() : undefined,
        content: formData.content.trim(),
        badgeText: formData.badgeText.trim() || undefined,
        authorName: formData.authorName.trim() || "SRC Secretariat",
        authorRole: formData.authorRole.trim() || "Council Administration",
        createdAt: editingDispatch ? editingDispatch.createdAt : new Date().toISOString(),
        status: "active",
      };

      if (formData.category === "event") {
        payload.eventDetails = {
          eventName: formData.eventName.trim() || formData.title.trim(),
          date: formData.eventDate.trim(),
          time: formData.eventTime.trim() || undefined,
          venue: formData.eventVenue.trim(),
          actionUrl: formData.eventActionUrl.trim() || undefined,
          meetingType: formData.eventMeetingType,
          agenda: formData.eventAgenda.trim() || undefined,
        };
      }

      if (formData.category === "payment_qr") {
        payload.paymentDetails = {
          amount: parseFloat(formData.paymentAmount) || 0,
          purpose: formData.paymentPurpose.trim() || formData.title.trim(),
          upiId: formData.paymentUpiId.trim() || "srcjdcoem@oksbi",
          payeeName: formData.paymentPayeeName.trim() || "SRC Central JDCOEM",
          deadline: formData.paymentDeadline.trim() || undefined,
          qrImageUrl: formData.paymentQrImageUrl.trim() || undefined,
          note: formData.paymentNote.trim() || undefined,
        };
      }

      let updatedList: SrcDispatch[];
      if (isNew) {
        updatedList = [payload, ...dispatches];
      } else {
        updatedList = dispatches.map((d) => (d.id === payload.id ? payload : d));
      }

      setDispatches(updatedList);
      await saveStoredSrcDispatches(updatedList);

      setIsModalOpen(false);
      showToast(isNew ? "Dispatch published successfully to SRC portal!" : "Dispatch updated successfully!");
    } catch (err) {
      console.error("Save dispatch error:", err);
      alert("Failed to save dispatch. Please check your connection.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Dispatch
  const handleDeleteDispatch = async () => {
    if (!deletingDispatch) return;
    try {
      const updatedList = dispatches.filter((d) => d.id !== deletingDispatch.id);
      setDispatches(updatedList);
      await saveStoredSrcDispatches(updatedList);
      setDeletingDispatch(null);
      showToast("Dispatch deleted successfully.");
    } catch (err) {
      console.error("Delete dispatch error:", err);
      alert("Failed to delete dispatch.");
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl animate-fade-in border border-emerald-400/30 font-medium text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-100" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A1128] text-white p-6 sm:p-8 relative overflow-hidden shadow-xl border border-slate-700">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#E78023]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-[#17458F]/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E78023]/20 border border-[#E78023]/40 text-[#E78023] text-xs font-extrabold uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SRC Central Operations Studio</span>
            </div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight uppercase">
              SRC Operations Dispatch
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Broadcast executive directives, schedule internal meetings & conclaves, and issue official payment QRs. Target all verified SRC members or direct messages to an individual officer via their College BT ID.
            </p>
          </div>

          <Button
            onClick={handleOpenCreateModal}
            variant="primary"
            size="lg"
            className="self-start md:self-auto shrink-0 flex items-center gap-2.5 font-bold shadow-lg shadow-[#E78023]/25 px-6 py-3.5 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Compose New Dispatch</span>
          </Button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-[#17458F] flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Dispatches</p>
            <p className="font-heading font-extrabold text-xl text-slate-900">{stats.total}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">All Council Broadcasts</p>
            <p className="font-heading font-extrabold text-xl text-emerald-700">{stats.broadcastCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-[#E78023] flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direct BT ID Targeted</p>
            <p className="font-heading font-extrabold text-xl text-[#E78023]">{stats.directCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment QRs & Dues</p>
            <p className="font-heading font-extrabold text-xl text-purple-700">{stats.paymentCount}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by title, description, or College BT ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#17458F] focus:ring-1 focus:ring-[#17458F]"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(["ALL", "update", "event", "payment_qr", "notice"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  categoryFilter === cat
                    ? "bg-[#17458F] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat === "ALL" ? "All Categories" : cat.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Target Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs border-l border-slate-200 pl-3">
            {(["ALL", "ALL_MEMBERS", "SINGLE_MEMBER"] as const).map((tgt) => (
              <button
                key={tgt}
                type="button"
                onClick={() => setTargetFilter(tgt)}
                className={`px-2.5 py-1.5 rounded-xl font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  targetFilter === tgt
                    ? "bg-[#E78023] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tgt === "ALL" ? "All Targets" : tgt === "ALL_MEMBERS" ? "Broadcast" : "Direct BT ID"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dispatches List */}
      <div className="space-y-4">
        {filteredDispatches.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-dashed border-slate-200 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <BellRing className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-base text-slate-700">No Dispatches Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No updates match your current filter criteria. Create a new dispatch or reset filters.
            </p>
          </div>
        ) : (
          filteredDispatches.map((item) => {
            const isDirect = item.targetType === "single_member";
            const isPayment = item.category === "payment_qr";
            const isEvent = item.category === "event";

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all p-5 sm:p-6 bg-white shadow-xs hover:shadow-md ${
                  item.priority === "urgent"
                    ? "border-rose-300 bg-rose-50/20"
                    : isDirect
                    ? "border-amber-200 bg-amber-50/10"
                    : "border-slate-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left content */}
                  <div className="space-y-2.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Priority Badge */}
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                        item.priority === "urgent"
                          ? "bg-rose-500 text-white"
                          : item.priority === "important"
                          ? "bg-amber-500 text-white"
                          : "bg-blue-600 text-white"
                      }`}>
                        {item.priority}
                      </span>

                      {/* Category Badge */}
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {item.category.replace("_", " ")}
                      </span>

                      {/* Target Indicator */}
                      {isDirect ? (
                        <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <Target className="w-3 h-3 text-[#E78023]" />
                          <span>Direct: {item.targetBtId}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>All SRC Members</span>
                        </span>
                      )}

                      {item.badgeText && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
                          {item.badgeText}
                        </span>
                      )}
                    </div>

                    <h3 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 leading-snug">
                      {item.title}
                    </h3>

                    {isDirect && item.targetMemberName && (
                      <p className="text-xs font-semibold text-[#17458F] flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Target Member: {item.targetMemberName}</span>
                      </p>
                    )}

                    <p className="text-xs text-slate-600 leading-relaxed max-w-3xl font-sans">
                      {item.content}
                    </p>

                    {/* Specific Category Details Preview */}
                    {isEvent && item.eventDetails && (
                      <div className="mt-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-wrap items-center gap-4 text-xs font-medium text-[#17458F]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-[#17458F]" />
                          <span>{item.eventDetails.date} {item.eventDetails.time && `• ${item.eventDetails.time}`}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Building className="w-4 h-4 text-slate-500" />
                          <span>{item.eventDetails.venue}</span>
                        </div>
                        {item.eventDetails.meetingType && (
                          <span className="uppercase text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {item.eventDetails.meetingType}
                          </span>
                        )}
                      </div>
                    )}

                    {isPayment && item.paymentDetails && (
                      <div className="mt-3 p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-950">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-extrabold text-base text-purple-900">
                              ₹{item.paymentDetails.amount}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              • {item.paymentDetails.purpose}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono">
                            UPI: {item.paymentDetails.upiId} ({item.paymentDetails.payeeName})
                          </p>
                          {item.paymentDetails.deadline && (
                            <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Deadline: {item.paymentDetails.deadline}</span>
                            </p>
                          )}
                        </div>

                        {item.paymentDetails.qrImageUrl ? (
                          <div className="relative h-16 w-16 rounded-lg border border-purple-200 overflow-hidden shrink-0 bg-white p-1">
                            <Image
                              src={item.paymentDetails.qrImageUrl}
                              alt="Payment QR"
                              fill
                              unoptimized={true}
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <div className="shrink-0">
                            <ScannableQRCode
                              value={`upi://pay?pa=${item.paymentDetails.upiId}&pn=${encodeURIComponent(item.paymentDetails.payeeName)}&am=${item.paymentDetails.amount}&cu=INR`}
                              size={64}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-3">
                      <span>By: <strong className="text-slate-700">{item.authorName}</strong> ({item.authorRole || "Admin"})</span>
                      <span>•</span>
                      <span>{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  </div>

                  {/* Right actions */}
                  <div className="flex sm:flex-col items-center gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0">
                    <Button
                      onClick={() => handleOpenEditModal(item)}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs font-bold text-slate-700 hover:text-[#17458F] cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      onClick={() => setDeletingDispatch(item)}
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingDispatch ? "Edit SRC Operations Dispatch" : "Compose New SRC Operations Dispatch"}
        maxWidth="2xl"
        contentClassName="max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={handleSaveDispatch} className="space-y-6 pt-2">
          {/* Dispatch Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Dispatch Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "update", label: "Official Update", icon: BellRing },
                { id: "event", label: "Council Event", icon: Calendar },
                { id: "payment_qr", label: "Payment QR", icon: CreditCard },
                { id: "notice", label: "Notice / Memo", icon: Sparkles },
              ].map((c) => {
                const Icon = c.icon;
                const isSelected = formData.category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, category: c.id as SrcDispatchCategory }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#17458F] text-white border-[#17458F] shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority & Target Audience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Priority Level
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value as SrcDispatchPriority }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#17458F]"
              >
                <option value="normal">Normal (Routine Dispatch)</option>
                <option value="important">Important (Council Attention)</option>
                <option value="urgent">Urgent (Immediate Action Required)</option>
              </select>
            </div>

            {/* Target Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Target Audience <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, targetType: "all_members" }))}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                    formData.targetType === "all_members"
                      ? "bg-[#E78023] text-white border-[#E78023]"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  All SRC Members
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, targetType: "single_member" }))}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                    formData.targetType === "single_member"
                      ? "bg-[#E78023] text-white border-[#E78023]"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  Single Member (BT ID)
                </button>
              </div>
            </div>
          </div>

          {/* If Target is Single Member: Select or type BT ID */}
          {formData.targetType === "single_member" && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                <Target className="w-4 h-4 text-[#E78023]" />
                <span>Target Member Selection (By BT ID)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    Choose from Registered SRC Roster:
                  </label>
                  <select
                    value={formData.targetBtId}
                    onChange={(e) => handleSelectMember(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs text-slate-800 bg-white focus:outline-none"
                  >
                    <option value="">-- Choose Council Member --</option>
                    {savedMembers.map((m) => (
                      <option key={m.btId} value={m.btId}>
                        {m.name} ({m.btId}) - {m.designation}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    Or Enter BT ID Manually:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BT230036CS"
                    value={formData.targetBtId}
                    onChange={(e) => handleSelectMember(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-mono font-bold uppercase text-slate-900 bg-white focus:outline-none"
                  />
                </div>
              </div>

              {formData.targetBtId && (
                <div className="p-2.5 rounded-xl bg-white/80 border border-amber-200 text-xs flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Verified Target:</span>
                  <span className="font-bold text-[#17458F]">
                    {formData.targetMemberName || formData.targetBtId}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Title & Badge */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Dispatch Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Annual Fest Core Committee Conclave"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#17458F]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Badge / Tag (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Urgent Action, Dues"
                value={formData.badgeText}
                onChange={(e) => setFormData((prev) => ({ ...prev, badgeText: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#17458F]"
              />
            </div>
          </div>

          {/* Category-Specific Fields: Event */}
          {formData.category === "event" && (
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#17458F] uppercase tracking-wider">
                <Calendar className="w-4 h-4" />
                <span>Council Event & Meeting Parameters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Event Date *</label>
                  <input
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, eventDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 text-xs bg-white text-slate-800"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 03:30 PM - 05:00 PM"
                    value={formData.eventTime}
                    onChange={(e) => setFormData((prev) => ({ ...prev, eventTime: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 text-xs bg-white text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Venue</label>
                  <input
                    type="text"
                    value={formData.eventVenue}
                    onChange={(e) => setFormData((prev) => ({ ...prev, eventVenue: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 text-xs bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Meeting Mode</label>
                  <select
                    value={formData.eventMeetingType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, eventMeetingType: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 text-xs bg-white text-slate-800"
                  >
                    <option value="in_person">In-Person (On Campus)</option>
                    <option value="online">Online (Google Meet / Zoom)</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Meeting / Action URL</label>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={formData.eventActionUrl}
                    onChange={(e) => setFormData((prev) => ({ ...prev, eventActionUrl: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 text-xs bg-white text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Category-Specific Fields: Payment QR */}
          {formData.category === "payment_qr" && (
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
                <CreditCard className="w-4 h-4" />
                <span>Council Payment QR & Dues Parameters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Amount (in ₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 450"
                    value={formData.paymentAmount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paymentAmount: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-purple-300 text-xs font-bold text-slate-900 bg-white"
                    required
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Payment Purpose *</label>
                  <input
                    type="text"
                    placeholder="e.g. Council Lapel Pin, Printed ID & Lanyard Kit"
                    value={formData.paymentPurpose}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paymentPurpose: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-purple-300 text-xs text-slate-800 bg-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">UPI ID *</label>
                  <input
                    type="text"
                    value={formData.paymentUpiId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paymentUpiId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-purple-300 text-xs font-mono bg-white text-slate-800"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Payee Name</label>
                  <input
                    type="text"
                    value={formData.paymentPayeeName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paymentPayeeName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-purple-300 text-xs bg-white text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Deadline</label>
                  <input
                    type="date"
                    value={formData.paymentDeadline}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paymentDeadline: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-purple-300 text-xs bg-white text-slate-800"
                  />
                </div>
              </div>

              {/* Upload custom QR or generated fallback */}
              <div className="space-y-2 pt-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Custom QR Code Image (Optional - Auto-generates UPI QR if not uploaded)
                </label>
                <ImageUploadDropzone
                  label="Upload Official Payment QR Code"
                  sublabel="Accepts standard bank / PhonePe / GPay QR image"
                  aspectRatio="1:1"
                  storagePath="src_payment_qrs"
                  previewUrl={formData.paymentQrImageUrl}
                  onUrlChange={(url) => setFormData((prev) => ({ ...prev, paymentQrImageUrl: url }))}
                />
              </div>
            </div>
          )}

          {/* Detailed Message / Announcement Body */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Message Content / Instructions <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Provide comprehensive details, guidelines, agenda, or payment instructions for the member(s)..."
              value={formData.content}
              onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed focus:outline-none focus:border-[#17458F]"
              required
            />
          </div>

          {/* Author Signature */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase">Author Name</label>
              <input
                type="text"
                value={formData.authorName}
                onChange={(e) => setFormData((prev) => ({ ...prev, authorName: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase">Author Role / Council Designation</label>
              <input
                type="text"
                value={formData.authorRole}
                onChange={(e) => setFormData((prev) => ({ ...prev, authorRole: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSaving}
              className="font-bold shadow-md shadow-[#E78023]/20 cursor-pointer"
            >
              {isSaving ? "Saving..." : editingDispatch ? "Update Dispatch" : "Publish Dispatch"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deletingDispatch)}
        onClose={() => setDeletingDispatch(null)}
        title="Delete SRC Dispatch"
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete <strong className="text-slate-900">"{deletingDispatch?.title}"</strong>? This will permanently remove it from the SRC Council portal across all student devices.
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingDispatch(null)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleDeleteDispatch}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
            >
              Delete Immediately
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
