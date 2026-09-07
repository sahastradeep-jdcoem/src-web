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
  GraduationCap
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
  subscribeToEvents
} from "@/lib/eventsStore";
import { getStoredClubs } from "@/lib/councilStore";
import { deleteRegistrationsForEvent } from "@/lib/firebase/firestore";

export default function AdminEventsPage() {
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [clubsList, setClubsList] = useState<ClubItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateListingPickerOpen, setIsCreateListingPickerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);
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
      if (res) {
        setEventsList(res);
      } else {
        // If Firestore had no record, push the current local state
        saveStoredEvents(stored);
      }
    });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      saveStoredEvents(eventsList);
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
      if (remoteEvents && remoteEvents.length > 0) {
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
    const q = searchQuery.toLowerCase();
    return eventsList.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      (e.organizer && e.organizer.toLowerCase().includes(q))
    );
  }, [eventsList, searchQuery]);

  const handleCreateSubmit = (formData: EventFormData) => {
    const cleanWhatToExpect = Array.from(new Set(formData.whatToExpect.map((s) => s.trim()).filter(Boolean)));
    const cleanRules = Array.from(new Set(formData.rules.map((s) => s.trim()).filter(Boolean)));
    const regDeadlineFormatted = formData.registrationDeadline
      ? formatDateToReadable(formData.registrationDeadline)
      : "TBD";

    const entryFeeText = formData.isPaid
      ? (formData.feePricingModel === "per_team" && formData.teamFeeAmount 
          ? `₹${formData.teamFeeAmount} / team`
          : `₹${formData.feeAmount} / person`)
      : "Free Entry";

    const created: EventItem = {
      id: `evt-${Date.now()}`,
      slug: formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: formData.name,
      category: formData.category as any,
      date: formData.date || "TBD 2026",
      time: "10:00 AM IST",
      venue: formData.venue,
      organizer: formData.organizer || "SRC JDCOEM",
      organizerClubSlug: formData.organizerClubSlug || (formData.organizer === "SRC JDCOEM" ? "src-council" : undefined),
      status: formData.status,
      poster: formData.poster || formData.cardImage || formData.posterImage || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
      cardImage: formData.cardImage || formData.poster,
      posterImage: formData.posterImage || formData.poster,
      headerImage: formData.headerImage || formData.cardImage || formData.poster,
      description: formData.description,
      about: formData.about || formData.description,
      whatToExpect: cleanWhatToExpect.length > 0 ? cleanWhatToExpect : ["High-impact collegiate showcase"],
      rules: cleanRules.length > 0 ? cleanRules : ["College ID mandatory"],
      schedule: [],
      prizes: [],
      teamType: formData.teamType,
      minTeamSize: formData.teamType !== "Individual" ? formData.minTeamSize : undefined,
      maxTeamSize: formData.teamType !== "Individual" ? formData.maxTeamSize : undefined,
      registrationStartDate: formData.registrationStartDate || new Date().toISOString().split("T")[0],
      registrationDeadline: regDeadlineFormatted,
      entryFee: entryFeeText,
      isPaid: formData.isPaid,
      feeAmount: formData.isPaid ? Number(formData.feeAmount) || 0 : 0,
      teamFeeAmount: formData.isPaid && formData.feePricingModel === "per_team" ? Number(formData.teamFeeAmount) || 0 : undefined,
      feePricingModel: formData.isPaid ? formData.feePricingModel : undefined,
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
    saveStoredEvents(updated);
    setIsCreateOpen(false);
    showNotice(`Event "${created.name}" published by "${created.organizer}".`);
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
    const parsedEventDate = parseToIsoDate(editingEvent.date);
    const parsedStartDate = parseToIsoDate(editingEvent.registrationStartDate) || new Date().toISOString().split("T")[0];
    const parsedDeadline = parseToIsoDate(editingEvent.registrationDeadline) || parsedEventDate;

    return {
      name: editingEvent.name,
      category: editingEvent.category,
      rawDate: parsedEventDate,
      date: editingEvent.date,
      venue: editingEvent.venue,
      organizer: editingEvent.organizer || "SRC JDCOEM",
      organizerClubSlug: editingEvent.organizerClubSlug || (editingEvent.organizer === "SRC JDCOEM" ? "src-council" : ""),
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
      registrationStartDate: parsedStartDate,
      registrationDeadline: parsedDeadline,
      isPaid: Boolean(editingEvent.isPaid || (editingEvent.feeAmount && editingEvent.feeAmount > 0)),
      feeAmount: editingEvent.feeAmount || 100,
      feePricingModel: editingEvent.feePricingModel || "per_person",
      teamFeeAmount: editingEvent.teamFeeAmount || 300,
      customQuestions: editingEvent.customQuestions ? JSON.parse(JSON.stringify(editingEvent.customQuestions)) : [],
      isParentFest: Boolean(editingEvent.isParentFest),
      parentEventId: editingEvent.parentEventId || "",
      parentEventSlug: editingEvent.parentEventSlug || "",
      parentEventName: editingEvent.parentEventName || "",
      subEventBadge: editingEvent.subEventBadge || "",
      targetAudience: (editingEvent.targetAudience || (editingEvent.isInterCollege === false ? "jdcoem_only" : "inter_college")) as TargetAudience,
      isInterCollege: editingEvent.targetAudience ? editingEvent.targetAudience === "inter_college" : editingEvent.isInterCollege !== false,
    };
  }, [editingEvent]);

  const handleStartEdit = (evt: EventItem) => {
    setEditingEvent(evt);
  };

  const handleEditSubmit = (formData: EventFormData) => {
    if (!editingEvent) return;

    const cleanWhatToExpect = Array.from(new Set(formData.whatToExpect.map((s) => s.trim()).filter(Boolean)));
    const cleanRules = Array.from(new Set(formData.rules.map((s) => s.trim()).filter(Boolean)));
    const regDeadlineFormatted = formData.registrationDeadline
      ? formatDateToReadable(formData.registrationDeadline)
      : undefined;

    const entryFeeText = formData.isPaid
      ? (formData.feePricingModel === "per_team" && formData.teamFeeAmount 
          ? `₹${formData.teamFeeAmount} / team`
          : `₹${formData.feeAmount} / person`)
      : "Free Entry";

    const defaultFallback = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop";
    const primaryPoster = formData.posterImage || formData.cardImage || formData.headerImage || formData.poster || editingEvent.poster || defaultFallback;

    const updated = eventsList.map((item) =>
      item.id === editingEvent.id
        ? {
            ...item,
            name: formData.name,
            category: formData.category as any,
            date: formData.rawDate ? formatDateToReadable(formData.rawDate) : formData.date,
            venue: formData.venue,
            organizer: formData.organizer,
            organizerClubSlug: formData.organizerClubSlug || item.organizerClubSlug,
            status: formData.status,
            poster: primaryPoster,
            cardImage: formData.cardImage || primaryPoster,
            posterImage: formData.posterImage || primaryPoster,
            headerImage: formData.headerImage || formData.cardImage || primaryPoster,
            description: formData.description,
            about: formData.about || formData.description,
            whatToExpect: cleanWhatToExpect,
            rules: cleanRules,
            teamType: formData.teamType,
            minTeamSize: formData.teamType !== "Individual" ? formData.minTeamSize : undefined,
            maxTeamSize: formData.teamType !== "Individual" ? formData.maxTeamSize : undefined,
            registrationStartDate: formData.registrationStartDate,
            registrationDeadline: regDeadlineFormatted || item.registrationDeadline,
            entryFee: entryFeeText,
            isPaid: formData.isPaid,
            feeAmount: formData.isPaid ? Number(formData.feeAmount) || 0 : 0,
            teamFeeAmount: formData.isPaid && formData.feePricingModel === "per_team" ? Number(formData.teamFeeAmount) || 0 : undefined,
            feePricingModel: formData.isPaid ? formData.feePricingModel : undefined,
            customQuestions: formData.customQuestions && formData.customQuestions.length > 0 ? formData.customQuestions : undefined,
            isParentFest: formData.isParentFest,
            parentEventId: formData.parentEventId || undefined,
            parentEventSlug: formData.parentEventSlug || undefined,
            parentEventName: formData.parentEventName || undefined,
            subEventBadge: formData.subEventBadge || undefined,
            targetAudience: formData.targetAudience || "inter_college",
            isInterCollege: formData.targetAudience === "inter_college",
          }
        : item
    );

    setEventsList(updated);
    saveStoredEvents(updated);
    setEditingEvent(null);
    showNotice(`Changes saved for "${formData.name}".`);
  };

  const handleDuplicate = (evt: EventItem) => {
    const duplicated: EventItem = {
      ...evt,
      id: `evt-${Date.now()}`,
      name: `${evt.name} (Copy)`,
      slug: `${evt.slug}-copy-${Date.now()}`,
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
      saveStoredEvents(updated);
      
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

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
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
              <span className="text-slate-500 font-medium text-xs">Published</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Create, edit, and organize flagship fests, hackathons, and chartered club events.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="h-9 px-3 sm:px-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-[#17458F] text-xs font-medium tracking-normal transition-all duration-200 shadow-2xs active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#17458F] transition-transform duration-500 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Live Cloud"}</span>
          </button>

          <Button
            onClick={() => setIsCreateListingPickerOpen(true)}
            variant="primary"
            size="sm"
            className="gap-1.5 cursor-pointer shadow-xs bg-[#17458F] hover:bg-[#123670]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Listing</span>
          </Button>

          <Link
            href="/events"
            target="_blank"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Preview Live Events Hub"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {notice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Events Table View */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by event name, club, or category..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredEvents.length} of {eventsList.length} events
          </span>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                <Inbox className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-base text-slate-800">
                  No Events in Directory
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {eventsList.length === 0
                    ? "All events have been deleted. You can create a new event organized by SRC or any chartered club."
                    : "No events matched your search query."}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  variant="primary"
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Event</span>
                </Button>
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-6">Event Name</th>
                  <th className="py-3.5 px-6">Organized By</th>
                  <th className="py-3.5 px-6">Category</th>
                  <th className="py-3.5 px-6">Scheduled Date</th>
                  <th className="py-3.5 px-6">Audience</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id || evt.slug} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-slate-900 block text-sm">{evt.name}</span>
                        {evt.isParentFest && (
                          <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-[#17458F] border border-indigo-200">
                            Umbrella Event
                          </span>
                        )}
                        {evt.parentEventName && (
                          <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            Part of {evt.parentEventName}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-sans">{evt.venue}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Users className="w-3.5 h-3.5 text-[#17458F] shrink-0" />
                        <span className="truncate max-w-xs">{evt.organizer || "SRC Sahastradeep"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                        {evt.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-sans">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <CalendarIcon className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>{evt.date}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        type="button"
                        onClick={() => handleToggleAudience(evt)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                          evt.targetAudience === "jdcoem_only"
                            ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                        }`}
                        title="Click to toggle between JDCOEM Only and Inter-College"
                      >
                        {evt.targetAudience === "jdcoem_only" ? "🎓 JDCOEM Only" : "🌐 Inter-College"}
                      </button>
                    </td>
                    <td className="py-4 px-6">
                      <Badge
                        variant={evt.status === "Registration Open" ? "orange" : "slate"}
                        size="sm"
                      >
                        {evt.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/registrations?event=${encodeURIComponent(evt.name)}`}
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#17458F] transition-colors"
                          title="View Registrations & Responses"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          href={`/events/${evt.slug}`}
                          target="_blank"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-[#17458F] transition-colors"
                          title="View Public Page"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleStartEdit(evt)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-[#17458F] transition-colors cursor-pointer"
                          title="Edit Event"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(evt)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-[#17458F] transition-colors cursor-pointer"
                          title="Duplicate Event"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEventToDelete(evt)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

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
