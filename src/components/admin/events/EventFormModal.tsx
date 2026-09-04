"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Ticket, 
  Users, 
  Image as ImageIcon, 
  HelpCircle, 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  Layers, 
  Globe, 
  GraduationCap, 
  Plus, 
  Trash2, 
  Sparkles, 
  Loader2, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Building2,
  Info
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";
import { CustomQuestionsBuilder } from "@/components/admin/events/CustomQuestionsBuilder";
import { EventItem, ClubItem, CustomQuestion, TargetAudience } from "@/types";
import { cn } from "@/lib/utils";

export type EventModalSection = "details" | "registration" | "participation" | "visuals" | "qa";

export interface EventFormData {
  name: string;
  category: string;
  rawDate: string;
  date: string;
  venue: string;
  organizer: string;
  organizerClubSlug: string;
  status: "Registration Open" | "Upcoming" | "Completed";
  poster: string;
  cardImage: string;
  posterImage: string;
  headerImage: string;
  description: string;
  about: string;
  whatToExpect: string[];
  rules: string[];
  teamType: "Individual" | "Team" | "Both";
  minTeamSize: number;
  maxTeamSize: number;
  registrationStartDate: string;
  registrationDeadline: string;
  isPaid: boolean;
  feeAmount: number;
  feePricingModel: "per_person" | "per_team";
  teamFeeAmount: number;
  customQuestions: CustomQuestion[];
  isParentFest: boolean;
  parentEventId: string;
  parentEventSlug: string;
  parentEventName: string;
  subEventBadge: string;
  targetAudience: TargetAudience;
  isInterCollege: boolean;
}

export function formatDateToReadable(dateStr: string): string {
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

export function parseToIsoDate(dateStr?: string): string {
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

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initialData?: Partial<EventFormData>;
  eventsList: EventItem[];
  clubsList: ClubItem[];
  editingEventId?: string;
  onSubmit: (data: EventFormData) => void;
  pendingUploads: number;
  onUploadStateChange: (uploading: boolean) => void;
}

const SECTIONS: {
  id: EventModalSection;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    id: "details",
    label: "Event Details",
    shortLabel: "Details",
    icon: FileText,
    description: "Core identity, hierarchy, eligibility, dates, and event descriptions.",
  },
  {
    id: "registration",
    label: "Registration",
    shortLabel: "Registration",
    icon: Ticket,
    description: "Schedules, entry fees, team pricing models, and payment settings.",
  },
  {
    id: "participation",
    label: "Participation",
    shortLabel: "Participation",
    icon: Users,
    description: "Squad formats, team limits, guidelines, and what delegates should expect.",
  },
  {
    id: "visuals",
    label: "Event Visual Asset",
    shortLabel: "Visuals",
    icon: ImageIcon,
    description: "Thumbnails, official vertical posters, and high-impact hero banners.",
  },
  {
    id: "qa",
    label: "Q&A",
    shortLabel: "Q&A",
    icon: HelpCircle,
    description: "Custom delegate questionnaires and registration inquiry forms.",
  },
];

export function EventFormModal({
  isOpen,
  onClose,
  mode,
  initialData,
  eventsList,
  clubsList,
  editingEventId,
  onSubmit,
  pendingUploads,
  onUploadStateChange,
}: EventFormModalProps) {
  const [activeSection, setActiveSection] = useState<EventModalSection>("details");
  const [formError, setFormError] = useState<string | null>(null);

  const defaultRawDate = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState<EventFormData>({
    name: initialData?.name || "",
    category: initialData?.category || "Technical",
    rawDate: initialData?.rawDate || defaultRawDate,
    date: initialData?.date || formatDateToReadable(defaultRawDate),
    venue: initialData?.venue || "JDCOEM Campus",
    organizer: initialData?.organizer || "SRC JDCOEM",
    organizerClubSlug: initialData?.organizerClubSlug || "src-council",
    status: initialData?.status || "Registration Open",
    poster: initialData?.poster || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
    cardImage: initialData?.cardImage || "",
    posterImage: initialData?.posterImage || "",
    headerImage: initialData?.headerImage || "",
    description: initialData?.description || "",
    about: initialData?.about || "",
    whatToExpect: initialData?.whatToExpect && initialData.whatToExpect.length > 0 ? initialData.whatToExpect : [""],
    rules: initialData?.rules && initialData.rules.length > 0 ? initialData.rules : [""],
    teamType: initialData?.teamType || "Both",
    minTeamSize: initialData?.minTeamSize || 2,
    maxTeamSize: initialData?.maxTeamSize || 4,
    registrationStartDate: initialData?.registrationStartDate || defaultRawDate,
    registrationDeadline: initialData?.registrationDeadline || "",
    isPaid: initialData?.isPaid || false,
    feeAmount: initialData?.feeAmount ?? 100,
    feePricingModel: initialData?.feePricingModel || "per_person",
    teamFeeAmount: initialData?.teamFeeAmount ?? 300,
    customQuestions: initialData?.customQuestions || [],
    isParentFest: initialData?.isParentFest || false,
    parentEventId: initialData?.parentEventId || "",
    parentEventSlug: initialData?.parentEventSlug || "",
    parentEventName: initialData?.parentEventName || "",
    subEventBadge: initialData?.subEventBadge || "",
    targetAudience: initialData?.targetAudience || "inter_college",
    isInterCollege: initialData?.isInterCollege !== false,
  });

  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({
        ...prev,
        ...initialData,
        whatToExpect: initialData.whatToExpect && initialData.whatToExpect.length > 0 ? initialData.whatToExpect : [""],
        rules: initialData.rules && initialData.rules.length > 0 ? initialData.rules : [""],
        customQuestions: initialData.customQuestions || [],
      }));
    }
  }, [initialData]);

  const handleDateChange = (val: string) => {
    const formatted = formatDateToReadable(val);
    setForm((prev) => ({
      ...prev,
      rawDate: val,
      date: formatted || val,
    }));
  };

  const currentSectionIndex = SECTIONS.findIndex((s) => s.id === activeSection);
  const prevSection = currentSectionIndex > 0 ? SECTIONS[currentSectionIndex - 1] : null;
  const nextSection = currentSectionIndex < SECTIONS.length - 1 ? SECTIONS[currentSectionIndex + 1] : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setActiveSection("details");
      setFormError("Please enter an Event Title.");
      return;
    }
    setFormError(null);
    onSubmit(form);
  };

  const getSectionBadge = (id: EventModalSection) => {
    switch (id) {
      case "details":
        return form.category;
      case "registration":
        return form.isPaid ? `₹${form.feeAmount}` : "Free";
      case "participation":
        return form.teamType;
      case "visuals": {
        const count = [form.cardImage, form.posterImage, form.headerImage].filter(Boolean).length;
        return count > 0 ? `${count}/3` : null;
      }
      case "qa":
        return form.customQuestions?.length ? `${form.customQuestions.length}` : null;
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "create" ? "Create New Event" : "Edit Event"}
      subtitle={
        mode === "create"
          ? "Publish an official festival, competition, or workshop."
          : `Editing: ${form.name || "Event"}`
      }
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Sticky Tactile Section Navigation Bar */}
        <div className="sticky -top-5 sm:-top-7 z-20 bg-white/95 backdrop-blur-md pt-1 pb-3 border-b border-slate-200/80 -mx-5 sm:-mx-7 px-5 sm:px-7 space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              const badge = getSectionBadge(section.id);

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(section.id);
                    setFormError(null);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border select-none",
                    isActive
                      ? "bg-[#17458F] text-white border-[#17458F] shadow-sm shadow-blue-900/20"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/90 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-[#E78023]" : "text-slate-400")} />
                  <span>{section.label}</span>
                  {badge && (
                    <span
                      className={cn(
                        "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md leading-none",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-200/80 text-slate-700"
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Section Micro-Header */}
          <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E78023]" />
              {SECTIONS[currentSectionIndex].description}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              Section {currentSectionIndex + 1} of {SECTIONS.length}
            </span>
          </div>
        </div>

        {formError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Info className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* 1. EVENT DETAILS SECTION                                   */}
        {/* ========================================================= */}
        {activeSection === "details" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            
            {/* Event Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Event Title *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (formError) setFormError(null);
                }}
                placeholder="e.g. CodeStorm 2026 Hackathon"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Organized By */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#17458F]" />
                <span>Organized By *</span>
              </label>
              <select
                value={form.organizer}
                onChange={(e) => {
                  const val = e.target.value;
                  const matchedClub = clubsList.find((c) => c.name === val || `SRC ${c.name}` === val);
                  setForm({
                    ...form,
                    organizer: val,
                    organizerClubSlug: matchedClub ? matchedClub.slug : (val === "SRC JDCOEM" ? "src-council" : "")
                  });
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
              >
                <optgroup label="Central Student Council">
                  <option value="SRC JDCOEM">SRC JDCOEM</option>
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
                Select whether this is an institutional council flagship event or hosted by one of the 12 chartered student clubs.
              </p>
            </div>

            {/* Dynamic Festival & Competition Hierarchy */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#E78023]" />
                    <span>Event &amp; Competition Hierarchy</span>
                  </label>
                  <p className="text-[11px] text-amber-800">
                    Configure whether this is an umbrella event or a sub-competition/segment under another event.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.isParentFest}
                    onChange={(e) => setForm({ ...form, isParentFest: e.target.checked })}
                    className="w-4 h-4 rounded text-[#17458F] focus:ring-[#17458F] border-slate-300"
                  />
                  <span className="text-xs font-bold text-amber-950">Is Umbrella Event</span>
                </label>
              </div>

              {!form.isParentFest && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/60">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      Part of Umbrella Event (Optional)
                    </label>
                    <select
                      value={form.parentEventId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const parentEvt = eventsList.find((ev) => ev.id === pid || ev.slug === pid);
                        setForm({
                          ...form,
                          parentEventId: pid,
                          parentEventSlug: parentEvt ? parentEvt.slug : "",
                          parentEventName: parentEvt ? parentEvt.name : "",
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#17458F]"
                    >
                      <option value="">None (Standalone Event)</option>
                      {eventsList
                        .filter((ev) => ev.id !== editingEventId && (ev.isParentFest || !ev.parentEventId))
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
                      value={form.subEventBadge}
                      onChange={(e) => setForm({ ...form, subEventBadge: e.target.value.toUpperCase() })}
                      placeholder="e.g. CONTESTANT, AUDITION, SOLO"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-bold tracking-wider uppercase focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Target Audience & Eligibility Toggle Switch */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#17458F]" />
                    <span>Target Audience &amp; Eligibility</span>
                  </label>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Visible to everyone publicly. Control whether registration is campus-only or open.
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all",
                    form.targetAudience === "jdcoem_only"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  )}
                >
                  {form.targetAudience === "jdcoem_only" ? "🎓 JDCOEM Only" : "🌐 Inter-College"}
                </span>
              </div>

              {/* Tactile 2-Segment Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 rounded-xl">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, targetAudience: "jdcoem_only", isInterCollege: false })}
                  className={cn(
                    "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    form.targetAudience === "jdcoem_only"
                      ? "bg-white text-[#17458F] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>JDCOEM Students Only</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, targetAudience: "inter_college", isInterCollege: true })}
                  className={cn(
                    "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    form.targetAudience === "inter_college"
                      ? "bg-white text-[#E78023] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Inter-College (Open to All)</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-medium italic">
                {form.targetAudience === "jdcoem_only"
                  ? "ℹ️ External non-JDCOEM students can view details, but registration will be restricted to verified campus students."
                  : "ℹ️ Open to students and delegates across all colleges and institutions."}
              </p>
            </div>

            {/* Category and Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Category *
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
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

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Event Status *
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-[#E78023]" />
                    <span>Event Date (Calendar) *</span>
                  </label>
                  {form.date && (
                    <span className="text-[10px] text-[#17458F] font-bold truncate">
                      {form.date}
                    </span>
                  )}
                </div>
                
                <input
                  type="date"
                  required
                  value={form.rawDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  Display format: <strong className="text-slate-700">{form.date || "Selected Date"}</strong>
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Venue</span>
                </label>
                <input
                  type="text"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="e.g. Central Auditorium"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            {/* Brief Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Brief Description
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short summary displayed on cards, social previews, and listing strips..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] resize-none"
              />
            </div>

            {/* About The Event */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                About The Event
              </label>
              <textarea
                rows={4}
                value={form.about}
                onChange={(e) => setForm({ ...form, about: e.target.value })}
                placeholder="Detailed description about what the event is, its significance, objectives, and awards..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] resize-none"
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. REGISTRATION SECTION                                   */}
        {/* ========================================================= */}
        {activeSection === "registration" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Registration Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Registration Opens</span>
                </label>
                <input
                  type="date"
                  value={form.registrationStartDate}
                  onChange={(e) => setForm({ ...form, registrationStartDate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  <span>Registration Closes</span>
                </label>
                <input
                  type="date"
                  value={form.registrationDeadline}
                  onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                />
              </div>
            </div>

            {/* Registration Fee & Gateway Pricing */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Registration Fee (Razorpay Gateway)</span>
                </label>
                <span
                  className={cn(
                    "text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border",
                    form.isPaid
                      ? "bg-blue-50 text-[#17458F] border-[#17458F]/30"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  )}
                >
                  {form.isPaid ? "Paid Event" : "Free Entry"}
                </span>
              </div>

              {/* Free vs Paid Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isPaid: false })}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5",
                    !form.isPaid
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <Check className={cn("w-3.5 h-3.5", !form.isPaid ? "opacity-100" : "opacity-0")} />
                  <span>Free Event (₹0)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isPaid: true })}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1.5",
                    form.isPaid
                      ? "bg-[#17458F] text-white border-[#17458F] shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <Sparkles className={cn("w-3.5 h-3.5", form.isPaid ? "opacity-100" : "opacity-0")} />
                  <span>Paid Event (₹ Fees)</span>
                </button>
              </div>

              {form.isPaid && (
                <div className="p-4 rounded-2xl bg-white border border-[#17458F]/20 space-y-3 shadow-xs animate-in fade-in duration-200">
                  {form.teamType !== "Individual" && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Team Pricing Structure
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, feePricingModel: "per_person" })}
                          className={cn(
                            "py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                            form.feePricingModel === "per_person"
                              ? "bg-[#17458F] text-white border-[#17458F]"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          )}
                        >
                          Per Member (₹ × Squad)
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, feePricingModel: "per_team" })}
                          className={cn(
                            "py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                            form.feePricingModel === "per_team"
                              ? "bg-[#17458F] text-white border-[#17458F]"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                          )}
                        >
                          Flat Team Fee (₹ Fixed)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        {form.feePricingModel === "per_team" && form.teamType !== "Individual"
                          ? "Solo Delegate Fee (₹)"
                          : "Fee Per Participant (₹)"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={form.feeAmount}
                        onChange={(e) => setForm({ ...form, feeAmount: Math.max(0, parseInt(e.target.value) || 0) })}
                        placeholder="e.g. 100"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
                      />
                    </div>

                    {form.teamType !== "Individual" && form.feePricingModel === "per_team" && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          Flat Squad Fee (₹ / Team)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={form.teamFeeAmount}
                          onChange={(e) => setForm({ ...form, teamFeeAmount: Math.max(0, parseInt(e.target.value) || 0) })}
                          placeholder="e.g. 300"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
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
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. PARTICIPATION SECTION                                 */}
        {/* ========================================================= */}
        {activeSection === "participation" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Participation Format */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Participation Format *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Individual", "Team", "Both"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setForm({ ...form, teamType: opt })}
                    className={cn(
                      "py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer",
                      form.teamType === opt
                        ? "bg-[#17458F] text-white border-[#17458F] shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {form.teamType !== "Individual" && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Min Team Size
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={form.minTeamSize}
                      onChange={(e) => setForm({ ...form, minTeamSize: parseInt(e.target.value) || 2 })}
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
                      value={form.maxTeamSize}
                      onChange={(e) => setForm({ ...form, maxTeamSize: parseInt(e.target.value) || 4 })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Rules & Guidelines */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Rules &amp; Guidelines
                  </label>
                  <p className="text-[11px] text-slate-400">Specify ground rules, eligibility conditions, or code of conduct.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, rules: [...form.rules, ""] })}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#17458F] hover:bg-blue-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Rule
                </button>
              </div>
              <div className="space-y-2">
                {form.rules.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 w-6 shrink-0 text-center">
                      {(idx + 1).toString().padStart(2, "0")}
                    </span>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const updated = [...form.rules];
                        updated[idx] = e.target.value;
                        setForm({ ...form, rules: updated });
                      }}
                      placeholder="e.g. College ID mandatory at entry"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#17458F]"
                    />
                    {form.rules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = form.rules.filter((_, i) => i !== idx);
                          setForm({ ...form, rules: updated });
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* What To Expect */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    What To Expect
                  </label>
                  <p className="text-[11px] text-slate-400">Highlight key takeaways, perks, and event experiences.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, whatToExpect: [...form.whatToExpect, ""] })}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#17458F] hover:bg-blue-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>
              <div className="space-y-2">
                {form.whatToExpect.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 w-6 shrink-0 text-center">
                      {(idx + 1).toString().padStart(2, "0")}
                    </span>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const updated = [...form.whatToExpect];
                        updated[idx] = e.target.value;
                        setForm({ ...form, whatToExpect: updated });
                      }}
                      placeholder="e.g. Industry-level competition experience & cash prizes"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#17458F]"
                    />
                    {form.whatToExpect.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = form.whatToExpect.filter((_, i) => i !== idx);
                          setForm({ ...form, whatToExpect: updated });
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. EVENT VISUAL ASSETS SECTION                           */}
        {/* ========================================================= */}
        {activeSection === "visuals" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Event Card Thumbnail (16:9) */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                <ImageUploadDropzone
                  label="1. Card Thumbnail"
                  sublabel="For catalog cards & dashboard"
                  aspectRatio="16:9"
                  recommendedSize="1200 x 675 px (16:9)"
                  storagePath="events/cards"
                  previewUrl={form.cardImage}
                  onUploadStateChange={onUploadStateChange}
                  onUrlChange={(url) => {
                    setForm((prev) => ({ ...prev, cardImage: url }));
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
                  previewUrl={form.posterImage}
                  onUploadStateChange={onUploadStateChange}
                  onUrlChange={(url) => {
                    setForm((prev) => ({ ...prev, posterImage: url, poster: url || prev.poster }));
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
                  previewUrl={form.headerImage}
                  onUploadStateChange={onUploadStateChange}
                  onUrlChange={(url) => {
                    setForm((prev) => ({ ...prev, headerImage: url }));
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. Q&A SECTION                                            */}
        {/* ========================================================= */}
        {activeSection === "qa" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <CustomQuestionsBuilder
              questions={form.customQuestions}
              onChange={(qs) => setForm({ ...form, customQuestions: qs })}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL FOOTER & STEPPED NAVIGATION CONTROLS                */}
        {/* ========================================================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-slate-200">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto order-3 sm:order-1"
          >
            Cancel
          </Button>

          {/* Stepper Navigation */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center order-2">
            {prevSection && (
              <button
                type="button"
                onClick={() => {
                  setActiveSection(prevSection.id);
                  setFormError(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{prevSection.shortLabel}</span>
              </button>
            )}

            {nextSection && (
              <button
                type="button"
                onClick={() => {
                  setActiveSection(nextSection.id);
                  setFormError(null);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-[#17458F] text-slate-700 hover:text-[#17458F] text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Next: {nextSection.shortLabel}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Primary Save Button (Accessible from any section) */}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={pendingUploads > 0}
            className="w-full sm:w-auto order-1 sm:order-3 disabled:opacity-50 disabled:cursor-not-allowed gap-2"
          >
            {pendingUploads > 0 ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Uploading ({pendingUploads})...</span>
              </>
            ) : mode === "create" ? (
              <span>Save &amp; Publish Event</span>
            ) : (
              <span>Save Changes</span>
            )}
          </Button>
        </div>

      </form>
    </Modal>
  );
}
