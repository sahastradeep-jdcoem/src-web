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
  RotateCcw,
  Inbox,
  Building2,
  Users,
  RefreshCw,
  Image as ImageIcon,
  Loader2,
  Layers
} from "lucide-react";
import { EventItem, ClubItem, CustomQuestion } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";
import { CustomQuestionsBuilder } from "@/components/admin/events/CustomQuestionsBuilder";
import { CreateListingModal } from "@/components/admin/listings/CreateListingModal";
import { 
  getStoredEvents, 
  saveStoredEvents, 
  resetStoredEvents,
  syncEventsFromFirestore,
  subscribeToEvents
} from "@/lib/eventsStore";
import { getStoredClubs } from "@/lib/councilStore";
import { deleteRegistrationsForEvent } from "@/lib/firebase/firestore";

function formatDateToReadable(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function parseToIsoDate(dateStr?: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {
    // ignore
  }
  return "";
}

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

  // New Event Form State
  const [newEvent, setNewEvent] = useState({
    name: "",
    category: "Technical",
    rawDate: new Date().toISOString().split("T")[0],
    date: formatDateToReadable(new Date().toISOString().split("T")[0]),
    venue: "JDCOEM Campus",
    organizer: "SRC JDCOEM",
    organizerClubSlug: "src-council",
    status: "Registration Open" as "Registration Open" | "Upcoming" | "Completed",
    poster: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
    cardImage: "",
    posterImage: "",
    headerImage: "",
    description: "",
    about: "",
    whatToExpect: [""] as string[],
    rules: [""] as string[],
    teamType: "Both" as "Individual" | "Team" | "Both",
    minTeamSize: 2,
    maxTeamSize: 4,
    registrationStartDate: new Date().toISOString().split("T")[0],
    registrationDeadline: "",
    isPaid: false,
    feeAmount: 100,
    feePricingModel: "per_person" as "per_person" | "per_team",
    teamFeeAmount: 300,
    customQuestions: [] as CustomQuestion[],
    isParentFest: false,
    parentEventId: "",
    parentEventSlug: "",
    parentEventName: "",
    subEventBadge: "",
  });

  // Edit Event Form State
  const [editForm, setEditForm] = useState({
    name: "",
    category: "Technical",
    rawDate: "",
    date: "",
    venue: "JDCOEM Campus",
    organizer: "SRC JDCOEM",
    organizerClubSlug: "src-council",
    status: "Registration Open" as "Registration Open" | "Upcoming" | "Completed",
    poster: "",
    cardImage: "",
    posterImage: "",
    headerImage: "",
    description: "",
    about: "",
    whatToExpect: [""] as string[],
    rules: [""] as string[],
    teamType: "Both" as "Individual" | "Team" | "Both",
    minTeamSize: 2,
    maxTeamSize: 4,
    registrationStartDate: "",
    registrationDeadline: "",
    isPaid: false,
    feeAmount: 100,
    feePricingModel: "per_person" as "per_person" | "per_team",
    teamFeeAmount: 300,
    customQuestions: [] as CustomQuestion[],
    isParentFest: false,
    parentEventId: "",
    parentEventSlug: "",
    parentEventName: "",
    subEventBadge: "",
  });

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

  const handleDateChange = (val: string, isEdit: boolean) => {
    const formatted = formatDateToReadable(val);
    if (isEdit) {
      setEditForm((prev) => ({
        ...prev,
        rawDate: val,
        date: formatted || val,
      }));
    } else {
      setNewEvent((prev) => ({
        ...prev,
        rawDate: val,
        date: formatted || val,
      }));
    }
  };

  const filteredEvents = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return eventsList.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      (e.organizer && e.organizer.toLowerCase().includes(q))
    );
  }, [eventsList, searchQuery]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWhatToExpect = newEvent.whatToExpect.filter((s) => s.trim());
    const cleanRules = newEvent.rules.filter((s) => s.trim());
    const regDeadlineFormatted = newEvent.registrationDeadline
      ? formatDateToReadable(newEvent.registrationDeadline)
      : "TBD";

    const entryFeeText = newEvent.isPaid
      ? (newEvent.feePricingModel === "per_team" && newEvent.teamFeeAmount 
          ? `₹${newEvent.teamFeeAmount} / team`
          : `₹${newEvent.feeAmount} / person`)
      : "Free Entry";

    const created: EventItem = {
      id: `evt-${Date.now()}`,
      slug: newEvent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: newEvent.name,
      category: newEvent.category as any,
      date: newEvent.date || "TBD 2026",
      time: "10:00 AM IST",
      venue: newEvent.venue,
      organizer: newEvent.organizer || "SRC JDCOEM",
      organizerClubSlug: newEvent.organizerClubSlug || (newEvent.organizer === "SRC JDCOEM" ? "src-council" : undefined),
      status: newEvent.status,
      poster: newEvent.poster || newEvent.cardImage || newEvent.posterImage || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
      cardImage: newEvent.cardImage || newEvent.poster,
      posterImage: newEvent.posterImage || newEvent.poster,
      headerImage: newEvent.headerImage || newEvent.cardImage || newEvent.poster,
      description: newEvent.description,
      about: newEvent.about || newEvent.description,
      whatToExpect: cleanWhatToExpect.length > 0 ? cleanWhatToExpect : ["High-impact collegiate showcase"],
      rules: cleanRules.length > 0 ? cleanRules : ["College ID mandatory"],
      schedule: [],
      prizes: [],
      teamType: newEvent.teamType,
      minTeamSize: newEvent.teamType !== "Individual" ? newEvent.minTeamSize : undefined,
      maxTeamSize: newEvent.teamType !== "Individual" ? newEvent.maxTeamSize : undefined,
      registrationStartDate: newEvent.registrationStartDate || new Date().toISOString().split("T")[0],
      registrationDeadline: regDeadlineFormatted,
      entryFee: entryFeeText,
      isPaid: newEvent.isPaid,
      feeAmount: newEvent.isPaid ? Number(newEvent.feeAmount) || 0 : 0,
      teamFeeAmount: newEvent.isPaid && newEvent.feePricingModel === "per_team" ? Number(newEvent.teamFeeAmount) || 0 : undefined,
      feePricingModel: newEvent.isPaid ? newEvent.feePricingModel : undefined,
      customQuestions: newEvent.customQuestions && newEvent.customQuestions.length > 0 ? newEvent.customQuestions : undefined,
      isParentFest: newEvent.isParentFest,
      parentEventId: newEvent.parentEventId || undefined,
      parentEventSlug: newEvent.parentEventSlug || undefined,
      parentEventName: newEvent.parentEventName || undefined,
      subEventBadge: newEvent.subEventBadge || undefined,
    };

    const updated = [created, ...eventsList];
    setEventsList(updated);
    saveStoredEvents(updated);
    setIsCreateOpen(false);
    showNotice(`Event "${created.name}" published by "${created.organizer}".`);

    setNewEvent({
      name: "",
      category: "Technical",
      rawDate: new Date().toISOString().split("T")[0],
      date: formatDateToReadable(new Date().toISOString().split("T")[0]),
      venue: "JDCOEM Campus",
      organizer: "SRC JDCOEM",
      organizerClubSlug: "src-council",
      status: "Registration Open",
      poster: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
      cardImage: "",
      posterImage: "",
      headerImage: "",
      description: "",
      about: "",
      whatToExpect: [""],
      rules: [""],
      teamType: "Both",
      minTeamSize: 2,
      maxTeamSize: 4,
      registrationStartDate: new Date().toISOString().split("T")[0],
      registrationDeadline: "",
      isPaid: false,
      feeAmount: 100,
      feePricingModel: "per_person",
      teamFeeAmount: 300,
      customQuestions: [],
      isParentFest: false,
      parentEventId: "",
      parentEventSlug: "",
      parentEventName: "",
      subEventBadge: "",
    });
  };

  const handleStartEdit = (evt: EventItem) => {
    setEditingEvent(evt);
    const parsedEventDate = parseToIsoDate(evt.date);
    const parsedStartDate = parseToIsoDate(evt.registrationStartDate) || new Date().toISOString().split("T")[0];
    const parsedDeadline = parseToIsoDate(evt.registrationDeadline) || parsedEventDate;

    setEditForm({
      name: evt.name,
      category: evt.category,
      rawDate: parsedEventDate,
      date: evt.date,
      venue: evt.venue,
      organizer: evt.organizer || "SRC JDCOEM",
      organizerClubSlug: evt.organizerClubSlug || (evt.organizer === "SRC JDCOEM" ? "src-council" : ""),
      status: evt.status as any,
      poster: evt.poster || "",
      cardImage: evt.cardImage || "",
      posterImage: evt.posterImage || "",
      headerImage: evt.headerImage || "",
      description: evt.description || "",
      about: evt.about || evt.description || "",
      whatToExpect: evt.whatToExpect && evt.whatToExpect.length > 0 ? [...evt.whatToExpect] : [""],
      rules: evt.rules && evt.rules.length > 0 ? [...evt.rules] : [""],
      teamType: evt.teamType || "Both",
      minTeamSize: evt.minTeamSize || 2,
      maxTeamSize: evt.maxTeamSize || 4,
      registrationStartDate: parsedStartDate,
      registrationDeadline: parsedDeadline,
      isPaid: Boolean(evt.isPaid || (evt.feeAmount && evt.feeAmount > 0)),
      feeAmount: evt.feeAmount || 100,
      feePricingModel: evt.feePricingModel || "per_person",
      teamFeeAmount: evt.teamFeeAmount || 300,
      customQuestions: evt.customQuestions ? JSON.parse(JSON.stringify(evt.customQuestions)) : [],
      isParentFest: Boolean(evt.isParentFest),
      parentEventId: evt.parentEventId || "",
      parentEventSlug: evt.parentEventSlug || "",
      parentEventName: evt.parentEventName || "",
      subEventBadge: evt.subEventBadge || "",
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    const cleanWhatToExpect = editForm.whatToExpect.filter((s) => s.trim());
    const cleanRules = editForm.rules.filter((s) => s.trim());
    const regDeadlineFormatted = editForm.registrationDeadline
      ? formatDateToReadable(editForm.registrationDeadline)
      : undefined;

    const entryFeeText = editForm.isPaid
      ? (editForm.feePricingModel === "per_team" && editForm.teamFeeAmount 
          ? `₹${editForm.teamFeeAmount} / team`
          : `₹${editForm.feeAmount} / person`)
      : "Free Entry";

    const defaultFallback = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop";
    const primaryPoster = editForm.posterImage || editForm.cardImage || editForm.headerImage || editForm.poster || editingEvent.poster || defaultFallback;

    const updated = eventsList.map((item) =>
      item.id === editingEvent.id
        ? {
            ...item,
            name: editForm.name,
            category: editForm.category as any,
            date: editForm.rawDate ? formatDateToReadable(editForm.rawDate) : editForm.date,
            venue: editForm.venue,
            organizer: editForm.organizer,
            organizerClubSlug: editForm.organizerClubSlug || item.organizerClubSlug,
            status: editForm.status,
            poster: primaryPoster,
            cardImage: editForm.cardImage || primaryPoster,
            posterImage: editForm.posterImage || primaryPoster,
            headerImage: editForm.headerImage || editForm.cardImage || primaryPoster,
            description: editForm.description,
            about: editForm.about || editForm.description,
            whatToExpect: cleanWhatToExpect.length > 0 ? cleanWhatToExpect : item.whatToExpect,
            rules: cleanRules.length > 0 ? cleanRules : item.rules,
            teamType: editForm.teamType,
            minTeamSize: editForm.teamType !== "Individual" ? editForm.minTeamSize : undefined,
            maxTeamSize: editForm.teamType !== "Individual" ? editForm.maxTeamSize : undefined,
            registrationStartDate: editForm.registrationStartDate,
            registrationDeadline: regDeadlineFormatted || editForm.date,
            entryFee: entryFeeText,
            isPaid: editForm.isPaid,
            feeAmount: editForm.isPaid ? Number(editForm.feeAmount) || 0 : 0,
            teamFeeAmount: editForm.isPaid && editForm.feePricingModel === "per_team" ? Number(editForm.teamFeeAmount) || 0 : undefined,
            feePricingModel: editForm.isPaid ? editForm.feePricingModel : undefined,
            customQuestions: editForm.customQuestions && editForm.customQuestions.length > 0 ? editForm.customQuestions : undefined,
            isParentFest: editForm.isParentFest,
            parentEventId: editForm.parentEventId || undefined,
            parentEventSlug: editForm.parentEventSlug || undefined,
            parentEventName: editForm.parentEventName || undefined,
            subEventBadge: editForm.subEventBadge || undefined,
          }
        : item
    );

    setEventsList(updated);
    saveStoredEvents(updated);
    setEditingEvent(null);
    showNotice(`Changes saved for "${editForm.name}".`);
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

  const handleResetDefaults = () => {
    const restored = resetStoredEvents();
    setEventsList(restored);
    showNotice("Events reset to default PRARAMBH fest.");
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
              EVENT DIRECTORY STUDIO
            </h1>
            <Badge variant="orange" size="sm">
              {eventsList.length} PUBLISHED
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Create, edit, and organize flagship fests, hackathons, and chartered club events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleManualSync}
            variant="outline"
            size="sm"
            className="gap-1.5 cursor-pointer bg-white"
            disabled={isSyncing}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#17458F] ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Live Cloud"}</span>
          </Button>

          <button
            onClick={handleResetDefaults}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Reset to default PRARAMBH event"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restore PRARAMBH</span>
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
                {eventsList.length === 0 && (
                  <button
                    onClick={handleResetDefaults}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                  >
                    Restore PRARAMBH
                  </button>
                )}
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
                            Umbrella Fest
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
                  The event page and listings across the portal will be removed. You can recreate or restore PRARAMBH anytime.
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
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New Event"
          subtitle="Publish an official festival, competition, or workshop."
          maxWidth="4xl"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Event Title *
              </label>
              <input
                type="text"
                required
                value={newEvent.name}
                onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                placeholder="e.g. CodeStorm 2026 Hackathon"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Organized By Option: SRC Council vs Chartered Clubs */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#17458F]" />
                <span>Organized By *</span>
              </label>
              <select
                value={newEvent.organizer}
                onChange={(e) => {
                  const val = e.target.value;
                  const matchedClub = clubsList.find((c) => c.name === val || `SRC ${c.name}` === val);
                  setNewEvent({
                    ...newEvent,
                    organizer: val,
                    organizerClubSlug: matchedClub ? matchedClub.slug : (val === "SRC JDCOEM" ? "src-council" : "")
                  });
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
              >
                <optgroup label="Central Student Council">
                  <option value="SRC JDCOEM">
                    SRC JDCOEM
                  </option>
                </optgroup>

                <optgroup label="Chartered Student Clubs">
                  {clubsList.map((c) => (
                    <option key={c.id || c.slug} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-[10px] text-slate-400">
                Select whether this is an institutional council flagship event or organized by one of the 12 chartered student clubs.
              </p>
            </div>

            {/* Dynamic Festival & Competition Hierarchy */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#E78023]" />
                    <span>Festival &amp; Competition Hierarchy</span>
                  </label>
                  <p className="text-[11px] text-amber-800">
                    Configure whether this is an umbrella mega-festival or a sub-competition/segment under another event.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newEvent.isParentFest}
                    onChange={(e) => setNewEvent({ ...newEvent, isParentFest: e.target.checked })}
                    className="w-4 h-4 rounded text-[#17458F] focus:ring-[#17458F] border-slate-300"
                  />
                  <span className="text-xs font-bold text-amber-950">Is Umbrella Festival</span>
                </label>
              </div>

              {!newEvent.isParentFest && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/60">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      Part of Umbrella Festival (Optional)
                    </label>
                    <select
                      value={newEvent.parentEventId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const parentEvt = eventsList.find((ev) => ev.id === pid || ev.slug === pid);
                        setNewEvent({
                          ...newEvent,
                          parentEventId: pid,
                          parentEventSlug: parentEvt ? parentEvt.slug : "",
                          parentEventName: parentEvt ? parentEvt.name : "",
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#17458F]"
                    >
                      <option value="">None (Standalone Event)</option>
                      {eventsList
                        .filter((ev) => ev.isParentFest || !ev.parentEventId)
                        .map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.name} ({ev.category})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      Sub-Event Badge / Tag (Optional)
                    </label>
                    <input
                      type="text"
                      value={newEvent.subEventBadge}
                      onChange={(e) => setNewEvent({ ...newEvent, subEventBadge: e.target.value.toUpperCase() })}
                      placeholder="e.g. CONTESTANT, AUDITION, SOLO"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold tracking-wider uppercase focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Category *
                </label>
                <select
                  value={newEvent.category}
                  onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                >
                  <option value="Fest">Fest</option>
                  <option value="Technical">Technical</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Competitions">Competitions</option>
                  <option value="Workshops">Workshops</option>
                  <option value="Sports">Sports</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Event Status *
                </label>
                <select
                  value={newEvent.status}
                  onChange={(e) => setNewEvent({ ...newEvent, status: e.target.value as any })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                >
                  <option value="Registration Open">Registration Open</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Event Date (Interactive Calendar Picker) & Venue */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-[#E78023]" />
                    <span>Event Date (Calendar) *</span>
                  </label>
                  {newEvent.date && (
                    <span className="text-[10px] text-[#17458F] font-bold truncate">
                      {newEvent.date}
                    </span>
                  )}
                </div>
                
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={newEvent.rawDate}
                    onChange={(e) => handleDateChange(e.target.value, false)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Selected date: <strong className="text-slate-700">{newEvent.date || "Selected Date"}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Venue</span>
                </label>
                <input
                  type="text"
                  value={newEvent.venue}
                  onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                  placeholder="e.g. Central Auditorium"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Brief Description
              </label>
              <textarea
                rows={3}
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Overview of rules, themes, and awards..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] resize-none"
              />
            </div>

            {/* About The Event */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                About The Event
              </label>
              <textarea
                rows={3}
                value={newEvent.about}
                onChange={(e) => setNewEvent({ ...newEvent, about: e.target.value })}
                placeholder="Detailed description about what the event is, its significance, and goals..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] resize-none"
              />
            </div>

            {/* What To Expect (Dynamic List) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  What To Expect
                </label>
                <button
                  type="button"
                  onClick={() => setNewEvent({ ...newEvent, whatToExpect: [...newEvent.whatToExpect, ""] })}
                  className="text-[10px] font-bold text-[#17458F] hover:text-[#E78023] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Item
                </button>
              </div>
              {newEvent.whatToExpect.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">0{idx + 1}</span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const updated = [...newEvent.whatToExpect];
                      updated[idx] = e.target.value;
                      setNewEvent({ ...newEvent, whatToExpect: updated });
                    }}
                    placeholder="e.g. Industry-level competition experience"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#17458F]"
                  />
                  {newEvent.whatToExpect.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = newEvent.whatToExpect.filter((_, i) => i !== idx);
                        setNewEvent({ ...newEvent, whatToExpect: updated });
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Rules & Guidelines (Dynamic List) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Rules &amp; Guidelines
                </label>
                <button
                  type="button"
                  onClick={() => setNewEvent({ ...newEvent, rules: [...newEvent.rules, ""] })}
                  className="text-[10px] font-bold text-[#17458F] hover:text-[#E78023] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Rule
                </button>
              </div>
              {newEvent.rules.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">0{idx + 1}</span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const updated = [...newEvent.rules];
                      updated[idx] = e.target.value;
                      setNewEvent({ ...newEvent, rules: updated });
                    }}
                    placeholder="e.g. College ID mandatory at entry"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#17458F]"
                  />
                  {newEvent.rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = newEvent.rules.filter((_, i) => i !== idx);
                        setNewEvent({ ...newEvent, rules: updated });
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Participation Format & Team Size */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Participation Format *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Individual", "Team", "Both"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setNewEvent({ ...newEvent, teamType: opt })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                      newEvent.teamType === opt
                        ? "bg-[#17458F] text-white border-[#E78023] shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {newEvent.teamType !== "Individual" && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Min Team Size
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={newEvent.minTeamSize}
                      onChange={(e) => setNewEvent({ ...newEvent, minTeamSize: parseInt(e.target.value) || 2 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Max Team Size
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={newEvent.maxTeamSize}
                      onChange={(e) => setNewEvent({ ...newEvent, maxTeamSize: parseInt(e.target.value) || 4 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Registration Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Registration Opens</span>
                </label>
                <input
                  type="date"
                  value={newEvent.registrationStartDate}
                  onChange={(e) => setNewEvent({ ...newEvent, registrationStartDate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  <span>Registration Closes</span>
                </label>
                <input
                  type="date"
                  value={newEvent.registrationDeadline}
                  onChange={(e) => setNewEvent({ ...newEvent, registrationDeadline: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                />
              </div>
            </div>

            {/* Registration Fee & Gateway Pricing */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Registration Fee (Razorpay Gateway)</span>
                </label>
                <span className="text-[10px] font-bold text-slate-500">
                  {newEvent.isPaid ? "Paid Event" : "Free Entry"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewEvent({ ...newEvent, isPaid: false })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    !newEvent.isPaid
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Free Event (₹0)
                </button>
                <button
                  type="button"
                  onClick={() => setNewEvent({ ...newEvent, isPaid: true })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    newEvent.isPaid
                      ? "bg-[#17458F] text-white border-[#E78023] shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Paid Event (₹ Fees)
                </button>
              </div>

              {newEvent.isPaid && (
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-[#17458F]/20 space-y-3 animate-in fade-in duration-200">
                  {newEvent.teamType !== "Individual" && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Team Pricing Structure
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewEvent({ ...newEvent, feePricingModel: "per_person" })}
                          className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            newEvent.feePricingModel === "per_person"
                              ? "bg-[#17458F] text-white border-[#17458F]"
                              : "bg-white text-slate-700 border-slate-200"
                          }`}
                        >
                          Per Member (₹ × Squad)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewEvent({ ...newEvent, feePricingModel: "per_team" })}
                          className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            newEvent.feePricingModel === "per_team"
                              ? "bg-[#17458F] text-white border-[#17458F]"
                              : "bg-white text-slate-700 border-slate-200"
                          }`}
                        >
                          Flat Team Fee (₹ Fixed)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        {newEvent.feePricingModel === "per_team" && newEvent.teamType !== "Individual"
                          ? "Solo Delegate Fee (₹)"
                          : "Fee Per Participant (₹)"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={newEvent.feeAmount}
                        onChange={(e) => setNewEvent({ ...newEvent, feeAmount: Math.max(0, parseInt(e.target.value) || 0) })}
                        placeholder="e.g. 100"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
                      />
                    </div>

                    {newEvent.teamType !== "Individual" && newEvent.feePricingModel === "per_team" && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          Flat Squad Fee (₹ / Team)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={newEvent.teamFeeAmount}
                          onChange={(e) => setNewEvent({ ...newEvent, teamFeeAmount: Math.max(0, parseInt(e.target.value) || 0) })}
                          placeholder="e.g. 300"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
                        />
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500 font-medium">
                    Integrated with Razorpay Gateway. Registrations will securely charge this amount via UPI (GPay/PhonePe), Cards, or NetBanking before issuing delegate passes.
                  </p>
                </div>
              )}
            </div>

            {/* Multi-Size Visual Asset Suite */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="space-y-1">
                <label className="text-xs font-extrabold uppercase tracking-wider text-[#17458F] flex items-center gap-1.5 font-heading">
                  <ImageIcon className="w-4 h-4 text-[#E78023]" />
                  <span>Event Visual Asset Suite (Multi-Size Imagery)</span>
                </label>
                <p className="text-[11px] text-slate-500 font-sans">
                  Upload dedicated photos optimized for different screens and layouts across the portal.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Event Card Thumbnail (16:9) */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                  <ImageUploadDropzone
                    label="1. Card Thumbnail"
                    sublabel="For event catalog cards & dashboard"
                    aspectRatio="16:9"
                    recommendedSize="1200 x 675 px (16:9)"
                    storagePath="events/cards"
                    previewUrl={newEvent.cardImage}
                    onUploadStateChange={handleUploadStateChange}
                    onUrlChange={(url) => {
                      setNewEvent((prev) => ({ ...prev, cardImage: url }));
                    }}
                  />
                </div>

                {/* 2. Official Vertical Poster (4:5) */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                  <ImageUploadDropzone
                    label="2. Vertical Poster"
                    sublabel="For official notices & passes"
                    aspectRatio="4:5"
                    recommendedSize="1080 x 1350 px (4:5)"
                    storagePath="events/posters"
                    previewUrl={newEvent.posterImage}
                    onUploadStateChange={handleUploadStateChange}
                    onUrlChange={(url) => {
                      setNewEvent((prev) => ({ ...prev, posterImage: url, poster: url || prev.poster }));
                    }}
                  />
                </div>

                {/* 3. Hero Header Backdrop (21:9) */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                  <ImageUploadDropzone
                    label="3. Header Banner"
                    sublabel="Cinematic backdrop on detail page"
                    aspectRatio="21:9"
                    recommendedSize="1920 x 820 px (21:9)"
                    storagePath="events/headers"
                    previewUrl={newEvent.headerImage}
                    onUploadStateChange={handleUploadStateChange}
                    onUrlChange={(url) => {
                      setNewEvent((prev) => ({ ...prev, headerImage: url }));
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Custom Registration Questions & Notes (Q&N) */}
            <CustomQuestionsBuilder
              questions={newEvent.customQuestions}
              onChange={(qs) => setNewEvent({ ...newEvent, customQuestions: qs })}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={pendingUploads > 0}
                className="disabled:opacity-50 disabled:cursor-not-allowed gap-2"
              >
                {pendingUploads > 0 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Uploading ({pendingUploads})...</span>
                  </>
                ) : (
                  <span>Save & Publish Event</span>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Edit Event */}
      {editingEvent && (
        <Modal
          isOpen={!!editingEvent}
          onClose={() => setEditingEvent(null)}
          title="Edit Event"
          subtitle={`Editing: ${editingEvent.name}`}
          maxWidth="4xl"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Event Title *
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Organized By Option */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#17458F]" />
                <span>Organized By *</span>
              </label>
              <select
                value={editForm.organizer}
                onChange={(e) => {
                  const val = e.target.value;
                  const matchedClub = clubsList.find((c) => c.name === val || `SRC ${c.name}` === val);
                  setEditForm({
                    ...editForm,
                    organizer: val,
                    organizerClubSlug: matchedClub ? matchedClub.slug : (val === "SRC JDCOEM" ? "src-council" : "")
                  });
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
              >
                <optgroup label="Central Student Council">
                  <option value="SRC JDCOEM">
                    SRC JDCOEM
                  </option>
                </optgroup>

                <optgroup label="Chartered Student Clubs">
                  {clubsList.map((c) => (
                    <option key={c.id || c.slug} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Dynamic Festival & Competition Hierarchy */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#E78023]" />
                    <span>Festival &amp; Competition Hierarchy</span>
                  </label>
                  <p className="text-[11px] text-amber-800">
                    Configure whether this is an umbrella mega-festival or a sub-competition/segment under another event.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editForm.isParentFest}
                    onChange={(e) => setEditForm({ ...editForm, isParentFest: e.target.checked })}
                    className="w-4 h-4 rounded text-[#17458F] focus:ring-[#17458F] border-slate-300"
                  />
                  <span className="text-xs font-bold text-amber-950">Is Umbrella Festival</span>
                </label>
              </div>

              {!editForm.isParentFest && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/60">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      Part of Umbrella Festival (Optional)
                    </label>
                    <select
                      value={editForm.parentEventId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const parentEvt = eventsList.find((ev) => ev.id === pid || ev.slug === pid);
                        setEditForm({
                          ...editForm,
                          parentEventId: pid,
                          parentEventSlug: parentEvt ? parentEvt.slug : "",
                          parentEventName: parentEvt ? parentEvt.name : "",
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#17458F]"
                    >
                      <option value="">None (Standalone Event)</option>
                      {eventsList
                        .filter((ev) => ev.id !== editingEvent?.id && (ev.isParentFest || !ev.parentEventId))
                        .map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.name} ({ev.category})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      Sub-Event Badge / Tag (Optional)
                    </label>
                    <input
                      type="text"
                      value={editForm.subEventBadge}
                      onChange={(e) => setEditForm({ ...editForm, subEventBadge: e.target.value.toUpperCase() })}
                      placeholder="e.g. CONTESTANT, AUDITION, SOLO"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold tracking-wider uppercase focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Category *
                </label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                >
                  <option value="Fest">Fest</option>
                  <option value="Technical">Technical</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Competitions">Competitions</option>
                  <option value="Workshops">Workshops</option>
                  <option value="Sports">Sports</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Event Status *
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                >
                  <option value="Registration Open">Registration Open</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Event Date (Interactive Calendar Picker) & Venue */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-[#E78023]" />
                    <span>Event Date (Calendar) *</span>
                  </label>
                  {editForm.date && (
                    <span className="text-[10px] text-[#17458F] font-bold truncate">
                      {editForm.date}
                    </span>
                  )}
                </div>
                
                <input
                  type="date"
                  value={editForm.rawDate}
                  onChange={(e) => handleDateChange(e.target.value, true)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                />
                <input
                  type="text"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  placeholder="e.g. 15 February 2026"
                  className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Venue</span>
                </label>
                <input
                  type="text"
                  value={editForm.venue}
                  onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Brief Description
              </label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] resize-none"
              />
            </div>

            {/* About The Event */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                About The Event
              </label>
              <textarea
                rows={3}
                value={editForm.about}
                onChange={(e) => setEditForm({ ...editForm, about: e.target.value })}
                placeholder="Detailed description about what the event is, its significance, and goals..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] resize-none"
              />
            </div>

            {/* What To Expect (Dynamic List) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  What To Expect
                </label>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, whatToExpect: [...editForm.whatToExpect, ""] })}
                  className="text-[10px] font-bold text-[#17458F] hover:text-[#E78023] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Item
                </button>
              </div>
              {editForm.whatToExpect.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">0{idx + 1}</span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const updated = [...editForm.whatToExpect];
                      updated[idx] = e.target.value;
                      setEditForm({ ...editForm, whatToExpect: updated });
                    }}
                    placeholder="e.g. Industry-level competition experience"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#17458F]"
                  />
                  {editForm.whatToExpect.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = editForm.whatToExpect.filter((_, i) => i !== idx);
                        setEditForm({ ...editForm, whatToExpect: updated });
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Rules & Guidelines (Dynamic List) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Rules &amp; Guidelines
                </label>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, rules: [...editForm.rules, ""] })}
                  className="text-[10px] font-bold text-[#17458F] hover:text-[#E78023] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Rule
                </button>
              </div>
              {editForm.rules.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0">0{idx + 1}</span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const updated = [...editForm.rules];
                      updated[idx] = e.target.value;
                      setEditForm({ ...editForm, rules: updated });
                    }}
                    placeholder="e.g. College ID mandatory at entry"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#17458F]"
                  />
                  {editForm.rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = editForm.rules.filter((_, i) => i !== idx);
                        setEditForm({ ...editForm, rules: updated });
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Participation Format & Team Size */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Participation Format *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Individual", "Team", "Both"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setEditForm({ ...editForm, teamType: opt })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                      editForm.teamType === opt
                        ? "bg-[#17458F] text-white border-[#E78023] shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {editForm.teamType !== "Individual" && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Min Team Size
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={editForm.minTeamSize}
                      onChange={(e) => setEditForm({ ...editForm, minTeamSize: parseInt(e.target.value) || 2 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Max Team Size
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={editForm.maxTeamSize}
                      onChange={(e) => setEditForm({ ...editForm, maxTeamSize: parseInt(e.target.value) || 4 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Registration Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Registration Opens</span>
                </label>
                <input
                  type="date"
                  value={editForm.registrationStartDate}
                  onChange={(e) => setEditForm({ ...editForm, registrationStartDate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  <span>Registration Closes</span>
                </label>
                <input
                  type="date"
                  value={editForm.registrationDeadline}
                  onChange={(e) => setEditForm({ ...editForm, registrationDeadline: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                />
              </div>
            </div>

            {/* Registration Fee & Gateway Pricing */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Registration Fee (Razorpay Gateway)</span>
                </label>
                <span className="text-[10px] font-bold text-slate-500">
                  {editForm.isPaid ? "Paid Event" : "Free Entry"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, isPaid: false })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    !editForm.isPaid
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Free Event (₹0)
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, isPaid: true })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    editForm.isPaid
                      ? "bg-[#17458F] text-white border-[#E78023] shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Paid Event (₹ Fees)
                </button>
              </div>

              {editForm.isPaid && (
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-[#17458F]/20 space-y-3 animate-in fade-in duration-200">
                  {editForm.teamType !== "Individual" && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Team Pricing Structure
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, feePricingModel: "per_person" })}
                          className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            editForm.feePricingModel === "per_person"
                              ? "bg-[#17458F] text-white border-[#17458F]"
                              : "bg-white text-slate-700 border-slate-200"
                          }`}
                        >
                          Per Member (₹ × Squad)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, feePricingModel: "per_team" })}
                          className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            editForm.feePricingModel === "per_team"
                              ? "bg-[#17458F] text-white border-[#17458F]"
                              : "bg-white text-slate-700 border-slate-200"
                          }`}
                        >
                          Flat Team Fee (₹ Fixed)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        {editForm.feePricingModel === "per_team" && editForm.teamType !== "Individual"
                          ? "Solo Delegate Fee (₹)"
                          : "Fee Per Participant (₹)"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={editForm.feeAmount}
                        onChange={(e) => setEditForm({ ...editForm, feeAmount: Math.max(0, parseInt(e.target.value) || 0) })}
                        placeholder="e.g. 100"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
                      />
                    </div>

                    {editForm.teamType !== "Individual" && editForm.feePricingModel === "per_team" && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          Flat Squad Fee (₹ / Team)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={editForm.teamFeeAmount}
                          onChange={(e) => setEditForm({ ...editForm, teamFeeAmount: Math.max(0, parseInt(e.target.value) || 0) })}
                          placeholder="e.g. 300"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
                        />
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500 font-medium">
                    Integrated with Razorpay Gateway. Registrations will securely charge this amount via UPI (GPay/PhonePe), Cards, or NetBanking before issuing delegate passes.
                  </p>
                </div>
              )}
            </div>

            {/* Multi-Size Visual Asset Suite */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="space-y-1">
                <label className="text-xs font-extrabold uppercase tracking-wider text-[#17458F] flex items-center gap-1.5 font-heading">
                  <ImageIcon className="w-4 h-4 text-[#E78023]" />
                  <span>Event Visual Asset Suite (Multi-Size Imagery)</span>
                </label>
                <p className="text-[11px] text-slate-500 font-sans">
                  Upload dedicated photos optimized for different screens and layouts across the portal.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Event Card Thumbnail (16:9) */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                  <ImageUploadDropzone
                    label="1. Card Thumbnail"
                    sublabel="For event catalog cards & dashboard"
                    aspectRatio="16:9"
                    recommendedSize="1200 x 675 px (16:9)"
                    storagePath="events/cards"
                    previewUrl={editForm.cardImage}
                    onUploadStateChange={handleUploadStateChange}
                    onUrlChange={(url) => {
                      setEditForm((prev) => ({ ...prev, cardImage: url }));
                    }}
                  />
                </div>

                {/* 2. Official Vertical Poster (4:5) */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                  <ImageUploadDropzone
                    label="2. Vertical Poster"
                    sublabel="For official notices & passes"
                    aspectRatio="4:5"
                    recommendedSize="1080 x 1350 px (4:5)"
                    storagePath="events/posters"
                    previewUrl={editForm.posterImage}
                    onUploadStateChange={handleUploadStateChange}
                    onUrlChange={(url) => {
                      setEditForm((prev) => ({ ...prev, posterImage: url, poster: url || prev.poster }));
                    }}
                  />
                </div>

                {/* 3. Hero Header Backdrop (21:9) */}
                <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                  <ImageUploadDropzone
                    label="3. Header Banner"
                    sublabel="Cinematic backdrop on detail page"
                    aspectRatio="21:9"
                    recommendedSize="1920 x 820 px (21:9)"
                    storagePath="events/headers"
                    previewUrl={editForm.headerImage}
                    onUploadStateChange={handleUploadStateChange}
                    onUrlChange={(url) => {
                      setEditForm((prev) => ({ ...prev, headerImage: url }));
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Custom Registration Questions & Notes (Q&N) */}
            <CustomQuestionsBuilder
              questions={editForm.customQuestions}
              onChange={(qs) => setEditForm({ ...editForm, customQuestions: qs })}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setEditingEvent(null)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={pendingUploads > 0}
                className="disabled:opacity-50 disabled:cursor-not-allowed gap-2"
              >
                {pendingUploads > 0 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Uploading ({pendingUploads})...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
