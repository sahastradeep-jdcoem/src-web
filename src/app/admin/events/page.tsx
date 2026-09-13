"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  Plus, 
  Search, 
  Eye, 
  Edit3, 
  Copy, 
  Trash2, 
  Check, 
  X, 
  Calendar as CalendarIcon, 
  Sparkles,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  Building2,
  Users,
  RefreshCw,
  Image as ImageIcon,
  Loader2,
  Layers,
  Globe,
  GraduationCap,
  Ban,
  LayoutGrid,
  List
} from "lucide-react";
import { EventItem, ClubItem, CustomQuestion, TargetAudience } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CreateListingModal } from "@/components/admin/listings/CreateListingModal";
import { 
  EventFormModal, 
  EventFormData, 
  formatDateToReadable, 
  parseToIsoDate 
} from "@/components/admin/events/EventFormModal";
import { cn } from "@/lib/utils";
import { 
  getStoredEvents, 
  saveStoredEvents, 
  syncEventsFromFirestore,
  subscribeToEvents,
  sortEventsByDate
} from "@/lib/eventsStore";
import { getStoredClubs } from "@/lib/councilStore";
import { deleteRegistrationsForEvent, cancelEventRegistrations } from "@/lib/firebase/firestore";

export default function AdminEventsPage() {
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [clubsList, setClubsList] = useState<ClubItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAudience, setSelectedAudience] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateListingPickerOpen, setIsCreateListingPickerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);
  const [eventToCancel, setEventToCancel] = useState<EventItem | null>(null);
  const [cancellationNotice, setCancellationNotice] = useState("");
  const [isCancellingEvent, setIsCancellingEvent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);

  const handleUploadStateChange = (uploading: boolean) => {
    setPendingUploads((prev) => Math.max(0, prev + (uploading ? 1 : -1)));
  };

  const loadData = () => {
    const stored = getStoredEvents();
    setEventsList(stored);
    setClubsList(getStoredClubs());
    syncEventsFromFirestore().then((res) => {
      if (Array.isArray(res)) {
        setEventsList(res);
      }
    });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await saveStoredEvents(eventsList);
      const synced = await syncEventsFromFirestore();
      setEventsList(synced);
      showNotice(`Successfully synced ${synced.length} events with live cloud database.`);
    } catch (e) {
      showNotice("Could not reach cloud database, displaying cached roster.");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = subscribeToEvents((remoteEvents) => {
      if (Array.isArray(remoteEvents)) {
        setEventsList(remoteEvents);
      }
    });

    const handleUpdate = () => {
      setEventsList(getStoredEvents());
      setClubsList(getStoredClubs());
    };

    window.addEventListener("src_events_updated", handleUpdate);
    window.addEventListener("src_tenure_changed", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener("src_events_updated", handleUpdate);
      window.removeEventListener("src_tenure_changed", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = eventsList.filter((e) => {
      // Search matching
      const matchesSearch = !q || (
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.organizer && e.organizer.toLowerCase().includes(q)) ||
        (e.venue && e.venue.toLowerCase().includes(q))
      );
      if (!matchesSearch) return false;

      // Status matching
      if (selectedStatus === "open") {
        if (e.isCancelled || e.status !== "Registration Open" || e.noRegistrationRequired) return false;
      } else if (selectedStatus === "walkin") {
        if (!e.noRegistrationRequired) return false;
      } else if (selectedStatus === "upcoming") {
        if (e.isCancelled || e.status !== "Upcoming") return false;
      } else if (selectedStatus === "completed") {
        if (e.status !== "Completed") return false;
      } else if (selectedStatus === "cancelled") {
        if (!e.isCancelled && e.status !== "Cancelled") return false;
      }

      // Category matching
      if (selectedCategory !== "all") {
        if (selectedCategory === "Flagship") {
          if (!e.isParentFest) return false;
        } else if (e.category.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // Audience matching
      if (selectedAudience === "inter_college") {
        const isInter = e.targetAudience === "inter_college" || (e.isInterCollege !== false && e.targetAudience !== "jdcoem_only");
        if (!isInter) return false;
      } else if (selectedAudience === "jdcoem_only") {
        const isJdcoem = e.targetAudience === "jdcoem_only" || e.isInterCollege === false;
        if (!isJdcoem) return false;
      }

      return true;
    });
    return sortEventsByDate(filtered);
  }, [eventsList, searchQuery, selectedStatus, selectedCategory, selectedAudience]);

  const handleCreateSubmit = async (formData: EventFormData) => {
    const cleanWhatToExpect = Array.from(new Set(formData.whatToExpect.map((s) => s.trim()).filter(Boolean)));
    const cleanRules = Array.from(new Set(formData.rules.map((s) => s.trim()).filter(Boolean)));
    const isNoReg = Boolean(formData.noRegistrationRequired);
    const regDeadlineFormatted = isNoReg
      ? "Not Required"
      : formData.registrationDeadline
      ? formatDateToReadable(formData.registrationDeadline)
      : (formData.date || "TBD 2026");

    const entryFeeText = isNoReg
      ? "Free Walk-in Entry"
      : formData.isPaid
      ? (formData.feePricingModel === "per_team" && formData.teamFeeAmount 
          ? `₹${formData.teamFeeAmount} / team`
          : `₹${formData.feeAmount} / person`)
      : "Free Entry";

    const randSuffix = Math.random().toString(36).substring(2, 6);
    const created: EventItem = {
      id: `evt-${Date.now()}-${randSuffix}`,
      slug: `${formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${randSuffix}`,
      name: formData.name,
      category: formData.category as any,
      date: formData.date || "TBD 2026",
      rawDate: formData.rawDate || undefined,
      rawEndDate: formData.isMultiDay ? (formData.rawEndDate || formData.rawDate) : undefined,
      endDate: formData.isMultiDay ? (formData.endDate || undefined) : undefined,
      isMultiDay: Boolean(formData.isMultiDay),
      time: formData.time || "10:00 AM IST",
      venue: formData.venue,
      organizer: formData.organizer || "SRC JDCOEM",
      organizerClubSlug: formData.organizerClubSlug || (formData.organizer === "SRC JDCOEM" ? "src-council" : undefined),
      collaboratingClubs: formData.collaboratingClubs && formData.collaboratingClubs.length > 0 ? formData.collaboratingClubs : undefined,
      coOrganizers: formData.collaboratingClubs && formData.collaboratingClubs.length > 0 ? formData.collaboratingClubs.map((c) => c.name) : undefined,
      status: isNoReg && formData.status === "Registration Open" ? "Upcoming" : formData.status,
      poster: formData.poster || formData.cardImage || formData.posterImage || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
      cardImage: formData.cardImage || formData.poster,
      posterImage: formData.posterImage || formData.poster,
      headerImage: formData.headerImage || formData.cardImage || formData.poster,
      description: formData.description,
      about: formData.about || formData.description,
      whatToExpect: cleanWhatToExpect.length > 0 ? cleanWhatToExpect : ["High-impact collegiate showcase"],
      rules: cleanRules.length > 0 ? cleanRules : ["College ID mandatory"],
      hasSchedule: Boolean(formData.hasSchedule),
      hasPrizes: Boolean(formData.hasPrizes),
      schedule: formData.hasSchedule ? (formData.schedule || []) : [],
      prizes: formData.hasPrizes ? (formData.prizes || []) : [],
      teamType: formData.teamType,
      minTeamSize: formData.teamType !== "Individual" ? formData.minTeamSize : undefined,
      maxTeamSize: formData.teamType !== "Individual" ? formData.maxTeamSize : undefined,
      noRegistrationRequired: isNoReg,
      registrationStartDate: isNoReg ? undefined : (formData.registrationStartDate || new Date().toISOString().split("T")[0]),
      registrationDeadline: regDeadlineFormatted,
      entryFee: entryFeeText,
      isPaid: isNoReg ? false : formData.isPaid,
      feeAmount: isNoReg ? 0 : (formData.isPaid ? Number(formData.feeAmount) || 0 : 0),
      teamFeeAmount: !isNoReg && formData.isPaid && formData.feePricingModel === "per_team" ? Number(formData.teamFeeAmount) || 0 : undefined,
      feePricingModel: isNoReg ? undefined : (formData.isPaid ? formData.feePricingModel : undefined),
      customQuestions: formData.customQuestions && formData.customQuestions.length > 0 ? formData.customQuestions : undefined,
      isParentFest: formData.isParentFest,
      parentEventId: formData.parentEventId || undefined,
      parentEventSlug: formData.parentEventSlug || undefined,
      parentEventName: formData.parentEventName || undefined,
      subEventBadge: formData.subEventBadge || undefined,
      targetAudience: formData.targetAudience || "inter_college",
      isInterCollege: formData.targetAudience === "inter_college",
    };

    const updated = [created, ...eventsList];
    setEventsList(updated);
    try {
      await saveStoredEvents(updated);
      setIsCreateOpen(false);
      showNotice(`Event "${created.name}" published by "${created.organizer}".`);
    } catch (saveErr: any) {
      console.error("Cloud save failed for event:", saveErr);
      throw saveErr;
    }
  };

  const handleToggleAudience = (evt: EventItem) => {
    const nextAudience: TargetAudience = evt.targetAudience === "jdcoem_only" ? "inter_college" : "jdcoem_only";
    const updated = eventsList.map((e) =>
      e.id === evt.id || e.slug === evt.slug
        ? {
            ...e,
            targetAudience: nextAudience,
            isInterCollege: nextAudience === "inter_college",
          }
        : e
    );
    setEventsList(updated);
    saveStoredEvents(updated);
    showNotice(
      `Updated eligibility for "${evt.name}" to ${
        nextAudience === "inter_college" ? "INTER-COLLEGE (OPEN TO ALL)" : "JDCOEM STUDENTS ONLY"
      }.`
    );
  };

  const editingInitialData: Partial<EventFormData> | undefined = useMemo(() => {
    if (!editingEvent) return undefined;
    const rawStartDate = editingEvent.rawDate || parseToIsoDate(editingEvent.date);
    const rawEndDate = editingEvent.rawEndDate || parseToIsoDate(editingEvent.endDate) || rawStartDate;
    const parsedStartDate = parseToIsoDate(editingEvent.registrationStartDate) || new Date().toISOString().split("T")[0];
    const parsedDeadline = parseToIsoDate(editingEvent.registrationDeadline) || rawStartDate;

    return {
      name: editingEvent.name,
      category: editingEvent.category,
      rawDate: rawStartDate,
      rawEndDate: rawEndDate,
      date: editingEvent.date,
      endDate: editingEvent.endDate || "",
      isMultiDay: Boolean(editingEvent.isMultiDay || (editingEvent.rawEndDate && editingEvent.rawEndDate !== editingEvent.rawDate)),
      time: editingEvent.time || "10:00 AM IST",
      venue: editingEvent.venue,
      organizer: editingEvent.organizer || "SRC JDCOEM",
      organizerClubSlug: editingEvent.organizerClubSlug || (editingEvent.organizer === "SRC JDCOEM" ? "src-council" : ""),
      collaboratingClubs: editingEvent.collaboratingClubs ? JSON.parse(JSON.stringify(editingEvent.collaboratingClubs)) : [],
      status: editingEvent.status as any,
      poster: editingEvent.poster || "",
      cardImage: editingEvent.cardImage || "",
      posterImage: editingEvent.posterImage || "",
      headerImage: editingEvent.headerImage || "",
      description: editingEvent.description || "",
      about: editingEvent.about || editingEvent.description || "",
      whatToExpect: editingEvent.whatToExpect && editingEvent.whatToExpect.length > 0 ? editingEvent.whatToExpect : [""],
      rules: editingEvent.rules && editingEvent.rules.length > 0 ? editingEvent.rules : [""],
      teamType: editingEvent.teamType || "Both",
      minTeamSize: editingEvent.minTeamSize || 2,
      maxTeamSize: editingEvent.maxTeamSize || 4,
      noRegistrationRequired: Boolean(editingEvent.noRegistrationRequired),
      registrationStartDate: parsedStartDate,
      registrationDeadline: parsedDeadline,
      isPaid: editingEvent.noRegistrationRequired
        ? false
        : (editingEvent.isPaid !== undefined
            ? Boolean(editingEvent.isPaid)
            : Boolean(editingEvent.feeAmount && editingEvent.feeAmount > 0)),
      feeAmount: typeof editingEvent.feeAmount === "number" ? editingEvent.feeAmount : 100,
      feePricingModel: editingEvent.feePricingModel || "per_person",
      teamFeeAmount: typeof editingEvent.teamFeeAmount === "number" ? editingEvent.teamFeeAmount : 300,
      customQuestions: editingEvent.customQuestions ? JSON.parse(JSON.stringify(editingEvent.customQuestions)) : [],
      isParentFest: Boolean(editingEvent.isParentFest),
      parentEventId: editingEvent.parentEventId || "",
      parentEventSlug: editingEvent.parentEventSlug || "",
      parentEventName: editingEvent.parentEventName || "",
      subEventBadge: editingEvent.subEventBadge || "",
      targetAudience: (editingEvent.targetAudience || (editingEvent.isInterCollege === false ? "jdcoem_only" : "inter_college")) as TargetAudience,
      isInterCollege: editingEvent.targetAudience ? editingEvent.targetAudience === "inter_college" : editingEvent.isInterCollege !== false,
      hasSchedule: editingEvent.hasSchedule !== undefined ? editingEvent.hasSchedule : Boolean(editingEvent.schedule && editingEvent.schedule.length > 0),
      hasPrizes: editingEvent.hasPrizes !== undefined ? editingEvent.hasPrizes : Boolean(editingEvent.prizes && editingEvent.prizes.length > 0),
      schedule: editingEvent.schedule ? JSON.parse(JSON.stringify(editingEvent.schedule)) : [],
      prizes: editingEvent.prizes ? JSON.parse(JSON.stringify(editingEvent.prizes)) : [],
    };
  }, [editingEvent]);

  const handleStartEdit = (evt: EventItem) => {
    setEditingEvent(evt);
  };

  const handleEditSubmit = async (formData: EventFormData) => {
    if (!editingEvent) return;

    const cleanWhatToExpect = Array.from(new Set(formData.whatToExpect.map((s) => s.trim()).filter(Boolean)));
    const cleanRules = Array.from(new Set(formData.rules.map((s) => s.trim()).filter(Boolean)));
    const isNoReg = Boolean(formData.noRegistrationRequired);
    const regDeadlineFormatted = isNoReg
      ? "Not Required"
      : formData.registrationDeadline
      ? formatDateToReadable(formData.registrationDeadline)
      : undefined;

    const entryFeeText = isNoReg
      ? "Free Walk-in Entry"
      : formData.isPaid
      ? (formData.feePricingModel === "per_team" && formData.teamFeeAmount 
          ? `₹${formData.teamFeeAmount} / team`
          : `₹${formData.feeAmount} / person`)
      : "Free Entry";

    const defaultFallback = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop";
    const primaryPoster = formData.posterImage || formData.cardImage || formData.headerImage || formData.poster || editingEvent.poster || defaultFallback;

    const targetMatch = (item: EventItem) =>
      item.id === editingEvent.id || (Boolean(editingEvent.slug) && item.slug === editingEvent.slug);

    const editedItem: EventItem = {
      ...editingEvent,
      name: formData.name,
      category: formData.category as any,
      date: formData.date,
      rawDate: formData.rawDate || undefined,
      rawEndDate: formData.isMultiDay ? (formData.rawEndDate || formData.rawDate) : undefined,
      endDate: formData.isMultiDay ? (formData.endDate || undefined) : undefined,
      isMultiDay: Boolean(formData.isMultiDay),
      time: formData.time || editingEvent.time || "10:00 AM IST",
      venue: formData.venue,
      organizer: formData.organizer,
      organizerClubSlug: formData.organizerClubSlug || editingEvent.organizerClubSlug,
      collaboratingClubs: formData.collaboratingClubs && formData.collaboratingClubs.length > 0 ? formData.collaboratingClubs : undefined,
      coOrganizers: formData.collaboratingClubs && formData.collaboratingClubs.length > 0 ? formData.collaboratingClubs.map((c) => c.name) : undefined,
      status: isNoReg && formData.status === "Registration Open" ? "Upcoming" : formData.status,
      poster: primaryPoster,
      cardImage: formData.cardImage || primaryPoster,
      posterImage: formData.posterImage || primaryPoster,
      headerImage: formData.headerImage || formData.cardImage || primaryPoster,
      description: formData.description,
      about: formData.about || formData.description,
      whatToExpect: cleanWhatToExpect,
      rules: cleanRules,
      hasSchedule: Boolean(formData.hasSchedule),
      hasPrizes: Boolean(formData.hasPrizes),
      schedule: formData.hasSchedule ? (formData.schedule || []) : [],
      prizes: formData.hasPrizes ? (formData.prizes || []) : [],
      teamType: formData.teamType,
      minTeamSize: formData.teamType !== "Individual" ? formData.minTeamSize : undefined,
      maxTeamSize: formData.teamType !== "Individual" ? formData.maxTeamSize : undefined,
      noRegistrationRequired: isNoReg,
      registrationStartDate: isNoReg ? undefined : formData.registrationStartDate,
      registrationDeadline: regDeadlineFormatted || (isNoReg ? "Not Required" : editingEvent.registrationDeadline),
      entryFee: entryFeeText,
      isPaid: isNoReg ? false : Boolean(formData.isPaid),
      feeAmount: isNoReg ? 0 : (formData.isPaid ? Number(formData.feeAmount) || 0 : 0),
      teamFeeAmount: !isNoReg && formData.isPaid && formData.feePricingModel === "per_team" ? Number(formData.teamFeeAmount) || 0 : undefined,
      feePricingModel: isNoReg ? undefined : (formData.isPaid ? formData.feePricingModel : undefined),
      customQuestions: formData.customQuestions && formData.customQuestions.length > 0 ? formData.customQuestions : undefined,
      isParentFest: formData.isParentFest,
      parentEventId: formData.parentEventId || undefined,
      parentEventSlug: formData.parentEventSlug || undefined,
      parentEventName: formData.parentEventName || undefined,
      subEventBadge: formData.subEventBadge || undefined,
      targetAudience: formData.targetAudience || "inter_college",
      isInterCollege: formData.targetAudience === "inter_college",
    };

    const hasItem = eventsList.some(targetMatch);
    const updated = hasItem
      ? eventsList.map((item) => (targetMatch(item) ? { ...item, ...editedItem } : item))
      : [editedItem, ...eventsList];

    setEventsList(updated);
    try {
      await saveStoredEvents(updated);
      setEditingEvent(null);
      showNotice(`Changes saved for "${formData.name}".`);
    } catch (saveErr: any) {
      console.error("Cloud save failed for event edit:", saveErr);
      throw saveErr;
    }
  };

  const handleDuplicate = (evt: EventItem) => {
    const randSuffix = Math.random().toString(36).substring(2, 6);
    const duplicated: EventItem = {
      ...evt,
      id: `evt-${Date.now()}-${randSuffix}`,
      name: `${evt.name} (Copy)`,
      slug: `${evt.slug}-copy-${randSuffix}`,
    };
    const updated = [duplicated, ...eventsList];
    setEventsList(updated);
    saveStoredEvents(updated);
    showNotice(`Duplicated "${evt.name}".`);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    setIsDeletingEvent(true);
    try {
      const deletedName = eventToDelete.name;
      const deletedId = eventToDelete.id;
      const deletedSlug = eventToDelete.slug;

      const updated = eventsList.filter(
        (e) => e.id !== deletedId && e.slug !== deletedSlug
      );
      setEventsList(updated);
      await saveStoredEvents(updated);
      
      // Cascade-delete registrations & passes for this deleted event
      await deleteRegistrationsForEvent(deletedId, deletedSlug, deletedName);

      setEventToDelete(null);
      showNotice(`Deleted event "${deletedName}" and purged all associated passes.`);
    } catch (err) {
      console.error("Failed to delete event:", err);
      showNotice("Failed to delete event. Please try again.");
    } finally {
      setIsDeletingEvent(false);
    }
  };

  const confirmCancelEvent = async () => {
    if (!eventToCancel) return;
    const cleanNotice = cancellationNotice.trim();
    if (!cleanNotice || cleanNotice.length < 5) {
      showNotice("Please provide a valid cancellation notice (minimum 5 characters).");
      return;
    }
    setIsCancellingEvent(true);
    try {
      const targetId = eventToCancel.id;
      const targetSlug = eventToCancel.slug;
      const targetName = eventToCancel.name;
      const nowIso = new Date().toISOString();

      const updated = eventsList.map((e) =>
        e.id === targetId || e.slug === targetSlug
          ? {
              ...e,
              status: "Cancelled" as const,
              isCancelled: true,
              cancelledAt: nowIso,
              cancellationNotice: cleanNotice,
            }
          : e
      );

      setEventsList(updated);
      saveStoredEvents(updated);

      // Bulk-cancel all active delegate passes in Firestore & local storage
      const count = await cancelEventRegistrations(targetId, targetSlug, targetName, cleanNotice);

      setEventToCancel(null);
      setCancellationNotice("");
      showNotice(`Cancelled "${targetName}". ${count} active registration pass${count === 1 ? "" : "es"} marked as cancelled.`);
    } catch (err) {
      console.error("Failed to cancel event:", err);
      showNotice("Failed to cancel event. Please try again.");
    } finally {
      setIsCancellingEvent(false);
    }
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
              EVENT DIRECTORY STUDIO
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-[#17458F] tabular-nums text-xs">{eventsList.length}</span>
              <span className="text-slate-500 font-medium text-xs">Total Records</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Publish, curate, and monitor campus flagships, hackathons, and chartered club assemblies with live cloud synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="h-9 px-3 sm:px-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-[#17458F] text-xs font-medium tracking-normal transition-all duration-200 shadow-2xs active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Force immediate synchronization with Firebase Cloud Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#17458F] transition-transform duration-500 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Live Cloud"}</span>
          </button>

          <Button
            onClick={() => setIsCreateListingPickerOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 cursor-pointer shadow-2xs border-slate-200 hover:border-slate-300 text-slate-700 hover:text-[#17458F] h-9"
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Create Listing</span>
          </Button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            variant="primary"
            size="sm"
            className="gap-1.5 cursor-pointer shadow-xs bg-[#17458F] hover:bg-[#123670] h-9 font-semibold text-white px-3.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </Button>

          <Link
            href="/events"
            target="_blank"
            className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center justify-center shadow-2xs"
            title="Preview Live Events Hub in New Tab"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {notice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button 
            onClick={() => setNotice(null)} 
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg hover:bg-emerald-100/60"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Executive Metric Pulse Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Events</span>
            <div className="h-7 w-7 rounded-lg bg-blue-50 text-[#17458F] flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-extrabold text-2xl text-slate-900 tabular-nums">
              {eventsList.length}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">listings</span>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>{eventsList.filter((e) => e.isParentFest).length} flagship / umbrella fests</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Registrations</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-extrabold text-2xl text-slate-900 tabular-nums">
              {eventsList.filter((e) => !e.isCancelled && e.status === "Registration Open" && !e.noRegistrationRequired).length}
            </span>
            <span className="text-[11px] text-emerald-600 font-bold">open now</span>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
            <span>{eventsList.filter((e) => e.noRegistrationRequired).length} walk-in entry formats</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Commercial & Paid</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-extrabold text-2xl text-slate-900 tabular-nums">
              {eventsList.filter((e) => !e.noRegistrationRequired && (e.isPaid || (e.feeAmount && e.feeAmount > 0))).length}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">ticketed</span>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
            <span>{eventsList.filter((e) => !e.isPaid || e.noRegistrationRequired).length} free / complimentary events</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Inter-College Scope</span>
            <div className="h-7 w-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-extrabold text-2xl text-slate-900 tabular-nums">
              {eventsList.filter((e) => e.targetAudience === "inter_college" || (e.isInterCollege !== false && e.targetAudience !== "jdcoem_only")).length}
            </span>
            <span className="text-[11px] text-sky-700 font-bold">open to all</span>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
            <span>{eventsList.filter((e) => e.targetAudience === "jdcoem_only" || e.isInterCollege === false).length} JDCOEM-exclusive</span>
          </p>
        </div>
      </div>

      {/* Filter Toolbar & View Switcher */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by event title, organizer club, venue, or category..."
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50/70 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#17458F] focus:ring-1 focus:ring-[#17458F] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/60 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-between lg:justify-end">
            {/* Category quick dropdown filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#17458F] transition-colors cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="Technical">Technical</option>
                <option value="Cultural">Cultural</option>
                <option value="Sports">Sports</option>
                <option value="Workshops">Workshops</option>
                <option value="Literary">Literary</option>
                <option value="Social">Social</option>
                <option value="Flagship">Flagship Umbrella</option>
              </select>
            </div>

            {/* Audience filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedAudience}
                onChange={(e) => setSelectedAudience(e.target.value)}
                className="h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#17458F] transition-colors cursor-pointer"
              >
                <option value="all">All Audiences</option>
                <option value="inter_college">🌐 Inter-College</option>
                <option value="jdcoem_only">🎓 JDCOEM Only</option>
              </select>
            </div>

            {/* View switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-[#17458F] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Table Roster View"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Roster</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white text-[#17458F] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Studio Cards Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-100 no-scrollbar">
          {[
            { id: "all", label: "All Events", count: eventsList.length },
            { 
              id: "open", 
              label: "Registration Open", 
              count: eventsList.filter((e) => !e.isCancelled && e.status === "Registration Open" && !e.noRegistrationRequired).length 
            },
            { 
              id: "walkin", 
              label: "Open Walk-in", 
              count: eventsList.filter((e) => e.noRegistrationRequired).length 
            },
            { 
              id: "upcoming", 
              label: "Upcoming", 
              count: eventsList.filter((e) => !e.isCancelled && e.status === "Upcoming").length 
            },
            { 
              id: "completed", 
              label: "Completed", 
              count: eventsList.filter((e) => e.status === "Completed").length 
            },
            { 
              id: "cancelled", 
              label: "Cancelled", 
              count: eventsList.filter((e) => e.isCancelled || e.status === "Cancelled").length 
            },
          ].map((tab) => {
            const isActive = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#17458F] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-200/90 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}

          <div className="ml-auto pl-2 text-[11px] text-slate-400 font-medium whitespace-nowrap">
            Showing <strong className="text-slate-700">{filteredEvents.length}</strong> of {eventsList.length}
          </div>
        </div>
      </div>

      {/* Events View (Table or Grid) */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-4 shadow-xs">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
            <Inbox className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-base text-slate-800">
              No Events Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {eventsList.length === 0
                ? "No events are currently scheduled. Use the button below to publish your first campus event."
                : "No events match your current filter and search criteria."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {eventsList.length > 0 && (
              <Button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStatus("all");
                  setSelectedCategory("all");
                  setSelectedAudience("all");
                }}
                variant="outline"
                size="sm"
              >
                Reset Filters
              </Button>
            )}
            <Button
              onClick={() => setIsCreateOpen(true)}
              variant="primary"
              size="sm"
              className="gap-1.5 bg-[#17458F]"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Event</span>
            </Button>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* Studio Cards Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((evt) => {
            const isCancelled = evt.isCancelled || evt.status === "Cancelled";
            const isWalkIn = Boolean(evt.noRegistrationRequired);
            const isPaid = !isWalkIn && (evt.isPaid || (evt.feeAmount && evt.feeAmount > 0));

            return (
              <div
                key={evt.id || evt.slug}
                className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                {/* Visual Banner Header */}
                <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
                  <img
                    src={evt.poster || evt.cardImage || evt.headerImage || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop"}
                    alt={evt.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                  {/* Overlaid Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider border border-white/20">
                      {evt.category}
                    </span>
                    
                    <button
                      type="button"
                      onClick={() => handleToggleAudience(evt)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border transition-all cursor-pointer shadow-sm ${
                        evt.targetAudience === "jdcoem_only"
                          ? "bg-amber-500/90 text-white border-amber-300 hover:bg-amber-600"
                          : "bg-[#17458F]/90 text-white border-blue-300 hover:bg-[#123670]"
                      }`}
                      title="Click to toggle JDCOEM Only vs Inter-College"
                    >
                      {evt.targetAudience === "jdcoem_only" ? "🎓 JDCOEM Only" : "🌐 Open to All"}
                    </button>
                  </div>

                  {/* Bottom Title on Image */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {evt.isParentFest && (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E78023] text-white shadow-2xs">
                          Umbrella Fest
                        </span>
                      )}
                      {evt.parentEventName && (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/90 text-slate-900">
                          Part of {evt.parentEventName}
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading font-bold text-base line-clamp-1 leading-snug drop-shadow-sm">
                      {evt.name}
                    </h3>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Users className="w-3.5 h-3.5 text-[#17458F] shrink-0" />
                        <span className="truncate max-w-[170px]">{evt.organizer || "SRC Sahastradeep"}</span>
                      </div>
                      {evt.collaboratingClubs && evt.collaboratingClubs.length > 0 && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          +{evt.collaboratingClubs.length} co-host{evt.collaboratingClubs.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pt-1">
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>{evt.date}</span>
                      </div>
                      {evt.time && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{evt.time}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{evt.venue}</span>
                    </div>
                  </div>

                  {/* Status & Fee Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      {isWalkIn ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                          🚶 Walk-in Entry
                        </span>
                      ) : (
                        <Badge
                          variant={
                            isCancelled
                              ? "rose"
                              : evt.status === "Registration Open"
                              ? "orange"
                              : "slate"
                          }
                          size="sm"
                        >
                          {isCancelled ? "Cancelled" : evt.status}
                        </Badge>
                      )}
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isPaid
                          ? "bg-blue-50 text-[#17458F] border-[#17458F]/30"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {isPaid ? (evt.entryFee || `₹${evt.feeAmount || 0} / person`) : "Free Entry"}
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {!isWalkIn && (
                      <Link
                        href={`/admin/registrations?event=${encodeURIComponent(evt.name)}`}
                        className="h-8 px-2.5 rounded-lg bg-white hover:bg-blue-50 text-[#17458F] border border-slate-200 hover:border-blue-200 text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-2xs"
                        title="View Registrations & Responses"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Passes</span>
                      </Link>
                    )}
                    <Link
                      href={`/events/${evt.slug}`}
                      target="_blank"
                      className="h-8 w-8 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-[#17458F] border border-slate-200 transition-all inline-flex items-center justify-center shadow-2xs"
                      title="View Public Page"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="flex items-center gap-1">
                    {!isCancelled && (
                      <>
                        <button
                          onClick={() => handleStartEdit(evt)}
                          className="h-8 w-8 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-[#17458F] border border-slate-200 transition-all inline-flex items-center justify-center cursor-pointer shadow-2xs"
                          title="Edit Event"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(evt)}
                          className="h-8 w-8 rounded-lg bg-white hover:bg-slate-100 text-slate-700 hover:text-[#17458F] border border-slate-200 transition-all inline-flex items-center justify-center cursor-pointer shadow-2xs"
                          title="Duplicate Event"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEventToCancel(evt);
                            setCancellationNotice("");
                          }}
                          className="h-8 w-8 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all inline-flex items-center justify-center cursor-pointer shadow-2xs"
                          title="Cancel Event"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setEventToDelete(evt)}
                      className="h-8 w-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all inline-flex items-center justify-center cursor-pointer shadow-2xs"
                      title="Delete Event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Enhanced Table Roster View */
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">Event & Venue</th>
                  <th className="py-3.5 px-5">Host & Collaborators</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-5">Date & Time</th>
                  <th className="py-3.5 px-4">Audience</th>
                  <th className="py-3.5 px-4">Status & Pricing</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredEvents.map((evt) => {
                  const isCancelled = evt.isCancelled || evt.status === "Cancelled";
                  const isWalkIn = Boolean(evt.noRegistrationRequired);
                  const isPaid = !isWalkIn && (evt.isPaid || (evt.feeAmount && evt.feeAmount > 0));
                  const posterUrl = evt.poster || evt.cardImage || evt.posterImage || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop";

                  return (
                    <tr key={evt.id || evt.slug} className="hover:bg-slate-50/70 transition-colors">
                      {/* Event Name & Poster */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-2xs">
                            <img
                              src={posterUrl}
                              alt={evt.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop";
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                              <span className="font-bold text-slate-900 text-sm hover:text-[#17458F] transition-colors leading-tight">
                                {evt.name}
                              </span>
                              {evt.isParentFest && (
                                <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.2 rounded-full bg-[#E78023]/10 text-[#E78023] border border-[#E78023]/30">
                                  Umbrella Fest
                                </span>
                              )}
                              {evt.parentEventName && (
                                <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                  Part of {evt.parentEventName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-sans">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[220px]">{evt.venue}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Organized By */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Users className="w-3.5 h-3.5 text-[#17458F] shrink-0" />
                          <span className="truncate max-w-[160px]">{evt.organizer || "SRC Sahastradeep"}</span>
                        </div>
                        {evt.collaboratingClubs && evt.collaboratingClubs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-[9px] text-slate-400 font-medium">with</span>
                            {evt.collaboratingClubs.map((collab) => (
                              <span
                                key={collab.slug || collab.name}
                                className="text-[9px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200"
                              >
                                {collab.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider border border-slate-200/80 whitespace-nowrap">
                          {evt.category}
                        </span>
                      </td>

                      {/* Scheduled Date */}
                      <td className="py-3.5 px-5 text-slate-600 font-sans">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 whitespace-nowrap">
                          <CalendarIcon className="w-3.5 h-3.5 text-[#E78023] shrink-0" />
                          <span>{evt.date}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {evt.time && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{evt.time}</span>
                            </div>
                          )}
                          {evt.isMultiDay && (
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 whitespace-nowrap">
                              Multi-Day
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Audience / Eligibility */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleAudience(evt)}
                          className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold tracking-normal transition-all cursor-pointer border shadow-2xs inline-flex items-center gap-1.5 ${
                            evt.targetAudience === "jdcoem_only"
                              ? "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
                              : "bg-sky-50 text-sky-800 border-sky-200/80 hover:bg-sky-100"
                          }`}
                          title="Click to toggle between JDCOEM Only and Inter-College"
                        >
                          {evt.targetAudience === "jdcoem_only" ? (
                            <>
                              <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                              <span>JDCOEM Only</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-3.5 h-3.5 text-sky-600" />
                              <span>Open to All</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Status & Pricing */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {isWalkIn ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 whitespace-nowrap">
                              🚶 Walk-in Entry
                            </span>
                          ) : (
                            <Badge
                              variant={
                                isCancelled
                                  ? "rose"
                                  : evt.status === "Registration Open"
                                  ? "orange"
                                  : "slate"
                              }
                              size="sm"
                            >
                              {isCancelled ? "Cancelled" : evt.status}
                            </Badge>
                          )}
                          <span
                            className={`px-2 py-0.2 rounded-full text-[9px] font-bold border whitespace-nowrap ${
                              isPaid
                                ? "bg-blue-50 text-[#17458F] border-[#17458F]/30"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {isPaid ? (evt.entryFee || `₹${evt.feeAmount || 0} / person`) : "Free Entry"}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/70 shadow-2xs">
                          {!isWalkIn && (
                            <Link
                              href={`/admin/registrations?event=${encodeURIComponent(evt.name)}`}
                              className="p-1.5 rounded-lg text-[#17458F] hover:bg-blue-50 hover:text-[#123670] transition-colors"
                              title="View Delegate Registrations"
                            >
                              <Users className="w-3.5 h-3.5" />
                            </Link>
                          )}
                          <Link
                            href={`/events/${evt.slug}`}
                            target="_blank"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                            title="Open Public Event Page"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          {!isCancelled && (
                            <>
                              <button
                                onClick={() => handleStartEdit(evt)}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-[#17458F] hover:bg-slate-200/60 transition-colors cursor-pointer"
                                title="Edit Event Details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDuplicate(evt)}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-[#17458F] hover:bg-slate-200/60 transition-colors cursor-pointer"
                                title="Duplicate Event Record"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEventToCancel(evt);
                                  setCancellationNotice("");
                                }}
                                className="p-1.5 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-100/60 transition-colors cursor-pointer"
                                title="Cancel Event & Bulk Cancel Passes"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setEventToDelete(evt)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100/60 transition-colors cursor-pointer"
                            title="Delete Event Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: In-App Delete Confirmation */}
      {eventToDelete && (
        <Modal
          isOpen={!!eventToDelete}
          onClose={() => setEventToDelete(null)}
          title="Delete Event"
          subtitle={`Are you sure you want to remove this event?`}
          maxWidth="md"
        >
          <div className="space-y-6 pt-2">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">This action will immediately delete:</p>
                <p className="font-semibold text-rose-800 text-sm">{eventToDelete.name}</p>
                <p className="text-slate-600 text-[11px]">
                  The event page and listings across the portal will be removed. All associated registrations will be cleaned up.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setEventToDelete(null)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeletingEvent}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                {isDeletingEvent ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete Event</span>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: In-App Cancel Event Confirmation */}
      {eventToCancel && (
        <Modal
          isOpen={!!eventToCancel}
          onClose={() => {
            if (!isCancellingEvent) {
              setEventToCancel(null);
              setCancellationNotice("");
            }
          }}
          title="Cancel Event"
          subtitle={`Officially cancel "${eventToCancel.name}"`}
          maxWidth="md"
        >
          <div className="space-y-5 pt-2">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Important Notice:</p>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Cancelling this event will officially mark it as <strong>Cancelled</strong>. All active student and participant registration passes will be automatically converted to <strong>CANCELLED</strong>.
                </p>
                <p className="text-amber-800 text-[11px] font-semibold mt-1">
                  For paid events, you can initiate refunds for all registered delegates from the Registrations Console.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Official Reason / Notice for Cancellation *</span>
                <span className="text-[10px] font-normal text-slate-400">Visible to registrants</span>
              </label>
              <textarea
                value={cancellationNotice}
                onChange={(e) => setCancellationNotice(e.target.value)}
                placeholder="e.g., Postponed due to college schedule conflict, emergency circumstances, or academic exams..."
                rows={3}
                disabled={isCancellingEvent}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all resize-none disabled:opacity-50"
              />
              <p className="text-[10px] text-slate-400">Minimum 5 characters required.</p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => {
                  setEventToCancel(null);
                  setCancellationNotice("");
                }}
                variant="outline"
                size="sm"
                disabled={isCancellingEvent}
              >
                Close
              </Button>
              <button
                type="button"
                onClick={confirmCancelEvent}
                disabled={isCancellingEvent || cancellationNotice.trim().length < 5}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                {isCancellingEvent ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling Event & Passes...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Confirm Event Cancellation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Polymorphic Listing Type Picker Modal */}
      {isCreateListingPickerOpen && (
        <CreateListingModal
          isOpen={isCreateListingPickerOpen}
          onClose={() => setIsCreateListingPickerOpen(false)}
          onOpenEventModal={() => setIsCreateOpen(true)}
          onSuccess={(item) => {
            showNotice(`Published "${item.title}" to student engagement hub.`);
          }}
        />
      )}

      {/* Modal: Create Event */}
      {isCreateOpen && (
        <EventFormModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          mode="create"
          eventsList={eventsList}
          clubsList={clubsList}
          onSubmit={handleCreateSubmit}
          pendingUploads={pendingUploads}
          onUploadStateChange={handleUploadStateChange}
        />
      )}

      {/* Modal: Edit Event */}
      {editingEvent && (
        <EventFormModal
          isOpen={!!editingEvent}
          onClose={() => setEditingEvent(null)}
          mode="edit"
          initialData={editingInitialData}
          eventsList={eventsList}
          clubsList={clubsList}
          editingEventId={editingEvent.id}
          onSubmit={handleEditSubmit}
          pendingUploads={pendingUploads}
          onUploadStateChange={handleUploadStateChange}
        />
      )}

    </div>
  );
}
