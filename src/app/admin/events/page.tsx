"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Ticket,
  Undo2
} from "lucide-react";
import { EventItem, ClubItem, SrcFormField, CustomQuestion, TargetAudience } from "@/types";
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
import { 
  deleteRegistrationsForEvent, 
  cancelEventRegistrations,
  getEventFromFirestore,
  deleteEventPermanentlyFromFirestore,
  deleteActiveCheckoutSessionsForEvent
} from "@/lib/firebase/firestore";
import { purgePendingQueueFor } from "@/lib/dataSyncEngine";

export default function AdminEventsPage() {
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [clubsList, setClubsList] = useState<ClubItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
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

  // Undo-delete state: the event is soft-removed from UI immediately;
  // real Firestore deletion fires only after the 10-second undo window expires.
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<EventItem | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


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
      const synced = await syncEventsFromFirestore();
      if (Array.isArray(synced)) {
        setEventsList(synced);
        showNotice(`Successfully synced ${synced.length} events with live cloud database.`);
      }
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

    const handleUpdate = (e?: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setEventsList(e.detail);
      } else {
        setEventsList(getStoredEvents());
      }
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
    const isUmbrella = Boolean(formData.isParentFest);
    const cleanWhatToExpect = isUmbrella ? [] : Array.from(new Set(formData.whatToExpect.map((s) => s.trim()).filter(Boolean)));
    const cleanRules = isUmbrella ? [] : Array.from(new Set(formData.rules.map((s) => s.trim()).filter(Boolean)));
    const isNoReg = isUmbrella || Boolean(formData.noRegistrationRequired);
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
      date: formData.isDateTbd ? (formData.date?.trim() || "Coming Soon") : (formData.date || "TBD 2026"),
      rawDate: formData.isDateTbd ? undefined : (formData.rawDate || undefined),
      rawEndDate: (!formData.isDateTbd && formData.isMultiDay) ? (formData.rawEndDate || formData.rawDate) : undefined,
      endDate: (!formData.isDateTbd && formData.isMultiDay) ? (formData.endDate || undefined) : undefined,
      isMultiDay: Boolean(!formData.isDateTbd && formData.isMultiDay),
      isDateTbd: Boolean(formData.isDateTbd),
      time: formData.time || "10:00 AM IST",
      venue: formData.venue,
      organizer: formData.organizer?.trim() || "",
      organizerClubSlug: formData.organizerClubSlug || (formData.organizer === "SRC JDCOEM" || formData.organizer?.toLowerCase().includes("council") ? "src-council" : undefined),
      collaboratingClubs: formData.collaboratingClubs && formData.collaboratingClubs.length > 0 ? formData.collaboratingClubs : undefined,
      coOrganizers: formData.collaboratingClubs && formData.collaboratingClubs.length > 0 ? formData.collaboratingClubs.map((c) => c.name) : undefined,
      status: isNoReg && formData.status === "Registration Open" ? "Upcoming" : formData.status,
      poster: formData.poster || formData.cardImage || formData.posterImage || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
      cardImage: formData.cardImage || formData.poster,
      posterImage: formData.posterImage || "",
      headerImage: formData.headerImage || "",
      description: formData.description,
      about: formData.about || formData.description,
      whatToExpect: isUmbrella ? [] : (cleanWhatToExpect.length > 0 ? cleanWhatToExpect : ["High-impact collegiate showcase"]),
      rules: isUmbrella ? [] : (cleanRules.length > 0 ? cleanRules : ["College ID mandatory"]),
      hasSchedule: isUmbrella ? false : Boolean(formData.hasSchedule),
      hasPrizes: isUmbrella ? false : Boolean(formData.hasPrizes),
      schedule: isUmbrella ? [] : (formData.hasSchedule ? (formData.schedule || []) : []),
      prizes: isUmbrella ? [] : (formData.hasPrizes ? (formData.prizes || []) : []),
      teamType: isUmbrella ? "Individual" : formData.teamType,
      minTeamSize: !isUmbrella && formData.teamType !== "Individual" ? formData.minTeamSize : undefined,
      maxTeamSize: !isUmbrella && formData.teamType !== "Individual" ? formData.maxTeamSize : undefined,
      noRegistrationRequired: isNoReg,
      registrationStartDate: isNoReg ? undefined : (formData.registrationStartDate || new Date().toISOString().split("T")[0]),
      registrationDeadline: regDeadlineFormatted,
      entryFee: isUmbrella ? "Free Entry" : entryFeeText,
      isPaid: isNoReg ? false : Boolean(formData.isPaid),
      feeAmount: isNoReg ? 0 : (formData.isPaid ? (Number(formData.feeAmount) > 0 ? Number(formData.feeAmount) : 100) : 0),
      teamFeeAmount: !isNoReg && formData.isPaid && formData.feePricingModel === "per_team" ? Number(formData.teamFeeAmount) || 0 : undefined,
      feePricingModel: isNoReg ? undefined : (formData.isPaid ? formData.feePricingModel : undefined),
      customQuestions: isUmbrella ? undefined : (formData.customQuestions && formData.customQuestions.length > 0 ? formData.customQuestions : undefined),
      isParentFest: isUmbrella,
      parentEventId: isUmbrella ? undefined : (formData.parentEventId || undefined),
      parentEventSlug: isUmbrella ? undefined : (formData.parentEventSlug || undefined),
      parentEventName: isUmbrella ? undefined : (formData.parentEventName || undefined),
      subEventBadge: isUmbrella ? undefined : (formData.subEventBadge || undefined),
      targetAudience: formData.targetAudience || "inter_college",
      isInterCollege: formData.targetAudience === "inter_college",
      isFeatured: Boolean(formData.isFeatured),
      coordinatorContact:
        formData.coordinatorContact &&
        (Boolean(formData.coordinatorContact.name?.trim()) || Boolean(formData.coordinatorContact.phone?.trim()))
          ? {
              name: (formData.coordinatorContact.name || "").trim(),
              role: (formData.coordinatorContact.role || "").trim(),
              phone: (formData.coordinatorContact.phone || "").trim(),
            }
          : undefined,
    };

    const updated = created.isFeatured
      ? [created, ...eventsList.map((e) => ({ ...e, isFeatured: false }))]
      : [created, ...eventsList];
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

  const handleToggleFeatured = async (evt: EventItem) => {
    const nextFeatured = !evt.isFeatured;
    const updated = eventsList.map((e) => {
      if (e.id === evt.id || e.slug === evt.slug) {
        return { ...e, isFeatured: nextFeatured };
      }
      if (nextFeatured) {
        return { ...e, isFeatured: false };
      }
      return e;
    });
    setEventsList(updated);
    try {
      await saveStoredEvents(updated);
      showNotice(
        nextFeatured
          ? `"${evt.name}" is now designated as the Flagship Spotlight event.`
          : `Removed Flagship Spotlight designation from "${evt.name}".`
      );
    } catch (err: any) {
      console.error("Cloud save failed for flagship toggle:", err);
      showNotice("Failed to update flagship status in cloud.");
    }
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
      isDateTbd: Boolean(editingEvent.isDateTbd || (editingEvent.date && /\b(coming soon|to be announced|tba|to be decided|tbd)\b/i.test(editingEvent.date))),
      time: editingEvent.time || "10:00 AM IST",
      venue: editingEvent.venue,
      organizer: editingEvent.organizer || "",
      organizerClubSlug: editingEvent.organizerClubSlug || (editingEvent.organizer === "SRC JDCOEM" || editingEvent.organizer?.toLowerCase().includes("council") ? "src-council" : ""),
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
            : Boolean((editingEvent.feeAmount && editingEvent.feeAmount > 0) || (editingEvent.entryFee && editingEvent.entryFee.includes("₹")))),
      feeAmount: typeof editingEvent.feeAmount === "number" && editingEvent.feeAmount > 0 ? editingEvent.feeAmount : 100,
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
      isFeatured: Boolean(editingEvent.isFeatured),
      hasSchedule: editingEvent.hasSchedule !== undefined ? editingEvent.hasSchedule : Boolean(editingEvent.schedule && editingEvent.schedule.length > 0),
      hasPrizes: editingEvent.hasPrizes !== undefined ? editingEvent.hasPrizes : Boolean(editingEvent.prizes && editingEvent.prizes.length > 0),
      schedule: editingEvent.schedule ? JSON.parse(JSON.stringify(editingEvent.schedule)) : [],
      prizes: editingEvent.prizes ? JSON.parse(JSON.stringify(editingEvent.prizes)) : [],
      coordinatorContact: editingEvent.coordinatorContact
        ? {
            name: editingEvent.coordinatorContact.name || "",
            role: editingEvent.coordinatorContact.role || "",
            phone: editingEvent.coordinatorContact.phone || "",
          }
        : undefined,
    };
  }, [editingEvent]);

  const handleStartEdit = (evt: EventItem) => {
    setEditingEvent(evt);
    if (evt.id || evt.slug) {
      getEventFromFirestore(evt.id || evt.slug)
        .then((fresh) => {
          if (fresh) {
            setEditingEvent((prev) => {
              if (prev && (prev.id === evt.id || prev.slug === evt.slug)) {
                return { ...prev, ...fresh };
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    }
  };

  const handleEditSubmit = async (formData: EventFormData) => {
    if (!editingEvent) return;

    const isUmbrella = Boolean(formData.isParentFest);
    const cleanWhatToExpect = isUmbrella ? [] : Array.from(new Set(formData.whatToExpect.map((s) => s.trim()).filter(Boolean)));
    const cleanRules = isUmbrella ? [] : Array.from(new Set(formData.rules.map((s) => s.trim()).filter(Boolean)));
    const isNoReg = isUmbrella || Boolean(formData.noRegistrationRequired);
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
      date: formData.isDateTbd ? (formData.date?.trim() || "Coming Soon") : formData.date,
      rawDate: formData.isDateTbd ? undefined : (formData.rawDate || undefined),
      rawEndDate: (!formData.isDateTbd && formData.isMultiDay) ? (formData.rawEndDate || formData.rawDate) : undefined,
      endDate: (!formData.isDateTbd && formData.isMultiDay) ? (formData.endDate || undefined) : undefined,
      isMultiDay: Boolean(!formData.isDateTbd && formData.isMultiDay),
      isDateTbd: Boolean(formData.isDateTbd),
      time: formData.time || editingEvent.time || "10:00 AM IST",
      venue: formData.venue,
      organizer: formData.organizer?.trim() || editingEvent.organizer || "",
      organizerClubSlug: formData.organizerClubSlug || editingEvent.organizerClubSlug || (formData.organizer === "SRC JDCOEM" || formData.organizer?.toLowerCase().includes("council") ? "src-council" : ""),
      collaboratingClubs: formData.collaboratingClubs && formData.collaboratingClubs.length > 0 ? formData.collaboratingClubs : undefined,
      coOrganizers: formData.collaboratingClubs && formData.collaboratingClubs.length > 0 ? formData.collaboratingClubs.map((c) => c.name) : undefined,
      status: isNoReg && formData.status === "Registration Open" ? "Upcoming" : formData.status,
      poster: primaryPoster,
      cardImage: formData.cardImage || editingEvent.cardImage || primaryPoster,
      posterImage: formData.posterImage || editingEvent.posterImage || "",
      headerImage: formData.headerImage || editingEvent.headerImage || "",
      description: formData.description,
      about: formData.about || formData.description,
      whatToExpect: isUmbrella ? [] : cleanWhatToExpect,
      rules: isUmbrella ? [] : cleanRules,
      hasSchedule: isUmbrella ? false : Boolean(formData.hasSchedule),
      hasPrizes: isUmbrella ? false : Boolean(formData.hasPrizes),
      schedule: isUmbrella ? [] : (formData.hasSchedule ? (formData.schedule || []) : []),
      prizes: isUmbrella ? [] : (formData.hasPrizes ? (formData.prizes || []) : []),
      teamType: isUmbrella ? "Individual" : formData.teamType,
      minTeamSize: !isUmbrella && formData.teamType !== "Individual" ? formData.minTeamSize : undefined,
      maxTeamSize: !isUmbrella && formData.teamType !== "Individual" ? formData.maxTeamSize : undefined,
      noRegistrationRequired: isNoReg,
      registrationStartDate: isNoReg ? undefined : formData.registrationStartDate,
      registrationDeadline: regDeadlineFormatted || (isNoReg ? "Not Required" : editingEvent.registrationDeadline),
      entryFee: isUmbrella ? "Free Entry" : entryFeeText,
      isPaid: isNoReg ? false : Boolean(formData.isPaid),
      feeAmount: isNoReg ? 0 : (formData.isPaid ? (Number(formData.feeAmount) > 0 ? Number(formData.feeAmount) : 100) : 0),
      teamFeeAmount: !isNoReg && formData.isPaid && formData.feePricingModel === "per_team" ? Number(formData.teamFeeAmount) || 0 : undefined,
      feePricingModel: isNoReg ? undefined : (formData.isPaid ? formData.feePricingModel : undefined),
      customQuestions: isUmbrella ? undefined : (formData.customQuestions && formData.customQuestions.length > 0 ? formData.customQuestions : undefined),
      isParentFest: isUmbrella,
      parentEventId: isUmbrella ? undefined : (formData.parentEventId || undefined),
      parentEventSlug: isUmbrella ? undefined : (formData.parentEventSlug || undefined),
      parentEventName: isUmbrella ? undefined : (formData.parentEventName || undefined),
      subEventBadge: isUmbrella ? undefined : (formData.subEventBadge || undefined),
      targetAudience: formData.targetAudience || "inter_college",
      isInterCollege: formData.targetAudience === "inter_college",
      isFeatured: Boolean(formData.isFeatured),
      coordinatorContact:
        formData.coordinatorContact &&
        (Boolean(formData.coordinatorContact.name?.trim()) || Boolean(formData.coordinatorContact.phone?.trim()))
          ? {
              name: (formData.coordinatorContact.name || "").trim(),
              role: (formData.coordinatorContact.role || "").trim(),
              phone: (formData.coordinatorContact.phone || "").trim(),
            }
          : undefined,
    };

    const hasItem = eventsList.some(targetMatch);
    const updated = hasItem
      ? eventsList.map((item) => {
          if (targetMatch(item)) return { ...item, ...editedItem };
          if (editedItem.isFeatured) return { ...item, isFeatured: false };
          return item;
        })
      : [
          editedItem,
          ...(editedItem.isFeatured
            ? eventsList.map((e) => ({ ...e, isFeatured: false }))
            : eventsList),
        ];

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

  /** Clear any running undo timers */
  const clearUndoTimers = () => {
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
    if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null; }
  };

  /** Fire immediately when user clicks the trash icon — soft-removes from UI and starts 10s undo window */
  const handleDeleteClick = (evt: EventItem) => {
    // If there's already a pending delete for another event, fire it immediately first
    if (pendingDeleteEvent && pendingDeleteEvent.id !== evt.id) {
      clearUndoTimers();
      executePermanentDelete(pendingDeleteEvent);
    }

    // Soft-remove from UI instantly
    setEventsList((prev) => prev.filter((e) => e.id !== evt.id && e.slug !== evt.slug));
    setPendingDeleteEvent(evt);
    setUndoCountdown(10);

    // Tick down every second
    undoIntervalRef.current = setInterval(() => {
      setUndoCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    // After 10s — execute real deletion
    undoTimerRef.current = setTimeout(() => {
      clearInterval(undoIntervalRef.current!);
      undoIntervalRef.current = null;
      executePermanentDelete(evt);
    }, 10000);
  };

  /** User clicked Undo — restore the event back into the list */
  const handleUndoDelete = () => {
    if (!pendingDeleteEvent) return;
    clearUndoTimers();
    const restored = pendingDeleteEvent;
    // Re-insert at original approximate position (prepend; user can reorder)
    setEventsList((prev) => {
      const alreadyPresent = prev.some((e) => e.id === restored.id);
      if (alreadyPresent) return prev;
      return [restored, ...prev];
    });
    setPendingDeleteEvent(null);
    setUndoCountdown(0);
    showNotice(`Restored "${restored.name}".`);
  };

  /** Actually delete — called when countdown reaches 0 or user navigates away */
  const executePermanentDelete = async (evt: EventItem) => {
    setPendingDeleteEvent(null);
    setUndoCountdown(0);
    setIsDeletingEvent(true);
    try {
      const deletedId = evt.id || "";
      const deletedSlug = evt.slug || "";
      const deletedName = evt.name;

      // Purge pending queue so no offline write can resurrect this event
      const purgeKeys = [deletedId, deletedSlug, `event_${deletedId}`, `event_${deletedSlug}`].filter(Boolean);
      purgePendingQueueFor(purgeKeys);

      // Permanently delete from all Firestore locations + write tombstone
      await deleteEventPermanentlyFromFirestore(deletedId, deletedSlug, deletedName);

      // Belt-and-suspenders cascade for checkout sessions
      await deleteActiveCheckoutSessionsForEvent(deletedId, deletedSlug, deletedName);

      // Persist local state (without deleted event)
      const latest = getStoredEvents().filter((e) => e.id !== deletedId && e.slug !== deletedSlug);
      await saveStoredEvents(latest);

      showNotice(`"${deletedName}" permanently deleted.`);
    } catch (err) {
      console.error("Failed to permanently delete event:", err);
      showNotice("Delete failed. Please refresh and try again.");
    } finally {
      setIsDeletingEvent(false);
    }
  };

  /** Legacy confirmDelete kept for any other callers (now a no-op redirect) */
  const confirmDelete = () => {
    if (eventToDelete) {
      handleDeleteClick(eventToDelete);
      setEventToDelete(null);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading font-extrabold text-2xl text-[#0F172A] tracking-tight">
              Event Directory Studio
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#17458F] border border-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
              <span className="tabular-nums font-bold">{eventsList.length}</span> Events
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Manage registrations, schedules, audience access, and live listings across the portal.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-2xs disabled:opacity-60 cursor-pointer"
            title="Force immediate synchronization with Firebase Cloud Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#17458F] ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Live Cloud"}</span>
          </button>

          <Button
            onClick={() => setIsCreateListingPickerOpen(true)}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold border-slate-200 hover:border-slate-300 text-slate-700 hover:text-[#17458F] shadow-2xs cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>Create Listing</span>
          </Button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            variant="primary"
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold bg-[#17458F] hover:bg-[#123670] text-white shadow-xs px-3.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Event</span>
          </Button>

          <Link
            href="/events"
            target="_blank"
            className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-[#17458F] inline-flex items-center justify-center transition-colors shadow-2xs"
            title="Preview Live Events Hub in New Tab"
          >
            <Eye className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs animate-in fade-in duration-300">
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

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events by title, host club, venue, or category..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50/70 border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#17458F] focus:ring-1 focus:ring-[#17458F] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center gap-2.5">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#17458F] transition-colors cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="Technical">Technical</option>
              <option value="Cultural">Cultural</option>
              <option value="Sports">Sports</option>
              <option value="Competitions">Competitions</option>
              <option value="Workshops">Workshops</option>
              <option value="Fest">Fest</option>
              <option value="Flagship">Flagship Umbrella</option>
            </select>

            <select
              value={selectedAudience}
              onChange={(e) => setSelectedAudience(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#17458F] transition-colors cursor-pointer"
            >
              <option value="all">All Audiences</option>
              <option value="inter_college">Open to All (Inter-College)</option>
              <option value="jdcoem_only">JDCOEM Only</option>
            </select>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 border-t border-slate-100 no-scrollbar">
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
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
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

          <div className="ml-auto pl-2 text-[11px] text-slate-400 font-medium whitespace-nowrap hidden sm:block">
            Showing <strong className="text-slate-700">{filteredEvents.length}</strong> of {eventsList.length}
          </div>
        </div>
      </div>

      {/* Events Card Grid View */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-4 shadow-2xs">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
            <Inbox className="w-6 h-6" />
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Undo-delete ghost card — appears for 10s after deletion */}
          {pendingDeleteEvent && (
            <div className="group bg-rose-50 rounded-2xl border-2 border-dashed border-rose-300 overflow-hidden shadow-2xs flex flex-col justify-between animate-in fade-in duration-300">
              {/* Ghost image placeholder */}
              <div className="relative h-48 w-full bg-rose-100 flex items-center justify-center">
                <div className="text-center space-y-2 px-4">
                  <div className="w-10 h-10 rounded-full bg-rose-200 flex items-center justify-center mx-auto">
                    <Trash2 className="w-5 h-5 text-rose-500" />
                  </div>
                  <p className="text-rose-700 font-bold text-sm line-clamp-2">{pendingDeleteEvent.name}</p>
                  <p className="text-rose-500 text-[11px]">Deleting in {undoCountdown}s…</p>
                </div>
                {/* Countdown ring */}
                <svg
                  className="absolute top-3 right-3 w-8 h-8 -rotate-90"
                  viewBox="0 0 36 36"
                >
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#fecaca" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15" fill="none"
                    stroke="#ef4444" strokeWidth="3"
                    strokeDasharray={`${(undoCountdown / 10) * 94.2} 94.2`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 1s linear" }}
                  />
                </svg>
              </div>
              {/* Undo action footer */}
              <div className="px-4 py-3 bg-rose-100/60 border-t border-rose-200 flex items-center justify-between gap-2">
                <p className="text-[11px] text-rose-700 font-medium">Deleted by mistake?</p>
                <button
                  type="button"
                  onClick={handleUndoDelete}
                  className="h-8 px-3 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              </div>
            </div>
          )}
          {filteredEvents.map((evt) => {
            const isCancelled = evt.isCancelled || evt.status === "Cancelled";
            const isWalkIn = Boolean(evt.noRegistrationRequired);
            const isPaid = !isWalkIn && (evt.isPaid || (evt.feeAmount && evt.feeAmount > 0));
            const eventImage = evt.poster || evt.cardImage || evt.posterImage || evt.headerImage || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop";

            return (
              <div
                key={evt.id || evt.slug}
                className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                {/* Visual Banner Header with Event Storage Image */}
                <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                  <img
                    src={eventImage}
                    alt={evt.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                  {/* Overlaid Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider border border-white/20">
                        {evt.category}
                      </span>
                      {evt.isFeatured && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/95 text-white text-[10px] font-extrabold uppercase tracking-wider border border-amber-300 shadow-2xs inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3 fill-white text-white" />
                          <span>Flagship</span>
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleFeatured(evt)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border transition-all cursor-pointer shadow-sm inline-flex items-center gap-1",
                          evt.isFeatured
                            ? "bg-amber-400 text-slate-950 border-amber-300 hover:bg-amber-300 font-extrabold"
                            : "bg-black/55 text-white/90 border-white/20 hover:bg-black/75"
                        )}
                        title={evt.isFeatured ? "Flagship Spotlight Active — Click to remove" : "Click to designate as Flagship Spotlight"}
                      >
                        <Sparkles className={cn("w-3 h-3", evt.isFeatured ? "text-amber-950 fill-amber-950" : "text-amber-400")} />
                        <span>{evt.isFeatured ? "Flagship" : "Feature"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleAudience(evt)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border transition-all cursor-pointer shadow-sm inline-flex items-center gap-1",
                          evt.targetAudience === "jdcoem_only"
                            ? "bg-amber-500/90 text-white border-amber-300 hover:bg-amber-600"
                            : "bg-[#17458F]/90 text-white border-blue-300 hover:bg-[#123670]"
                        )}
                        title="Click to toggle JDCOEM Only vs Open to All"
                      >
                        {evt.targetAudience === "jdcoem_only" ? (
                          <>
                            <GraduationCap className="w-3 h-3" />
                            <span>JDCOEM Only</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3" />
                            <span>Open to All</span>
                          </>
                        )}
                      </button>
                    </div>
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
                        <span className="truncate max-w-[170px]">{evt.organizer || <span className="text-slate-400 font-normal italic">Not specified</span>}</span>
                      </div>
                      {evt.collaboratingClubs && evt.collaboratingClubs.length > 0 && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          +{evt.collaboratingClubs.length} co-host{evt.collaboratingClubs.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CalendarIcon className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>{evt.date}</span>
                        {(evt.isDateTbd || /\b(coming soon|to be announced|tba|to be decided|tbd)\b/i.test(evt.date)) && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded leading-none">
                            TBA
                          </span>
                        )}
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
                          <Ticket className="w-3 h-3 text-emerald-600" />
                          <span>Walk-in Entry</span>
                        </span>
                      ) : (
                        <Badge
                          variant={
                            isCancelled
                              ? "rose"
                              : evt.status === "Registration Open"
                              ? "orange"
                              : evt.status === "Upcoming"
                              ? "warning"
                              : "slate"
                          }
                          size="sm"
                        >
                          {isCancelled ? "Cancelled" : evt.status}
                        </Badge>
                      )}
                    </div>

                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                        isPaid
                          ? "bg-blue-50 text-[#17458F] border-[#17458F]/30"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      )}
                    >
                      {isPaid ? (evt.entryFee || `₹${evt.feeAmount || 0} / person`) : "Free Entry"}
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-1.5">
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
                      onClick={() => handleDeleteClick(evt)}
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
