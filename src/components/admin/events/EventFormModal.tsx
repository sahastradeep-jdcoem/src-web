"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  FileText, 
  Ticket, 
  Users, 
  Image as ImageIcon, 
  HelpCircle, 
  ClipboardList,
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
  Info,
  AlertCircle,
  CheckCircle2,
  X,
  CalendarClock,
  Trophy,
  Medal,
  Award,
  ArrowUp,
  ArrowDown,
  Copy,
  Phone,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { UniversalImageUploader } from "@/components/ui/UniversalImageUploader";
import { SrcFormsBuilder } from "@/components/admin/forms/SrcFormsBuilder";
import { EventItem, ClubItem, SrcFormField, CustomQuestion, TargetAudience, EventScheduleItem, EventPrize } from "@/types";
import { cn } from "@/lib/utils";

export type EventModalSection = "details" | "schedule" | "registration" | "participation" | "visuals" | "qa";

export interface EventFormData {
  name: string;
  category: string;
  rawDate: string;
  date: string;
  isMultiDay?: boolean;
  isDateTbd?: boolean;
  rawEndDate?: string;
  endDate?: string;
  time: string;
  venue: string;
  organizer: string;
  organizerClubSlug: string;
  collaboratingClubs?: { id?: string; name: string; slug: string }[];
  status: "Registration Open" | "Upcoming" | "Completed" | "Cancelled";
  poster: string;
  cardImage: string;
  posterImage: string;
  headerImage: string;
  description: string;
  about: string;
  whatToExpect: string[];
  rules: string[];
  hasSchedule?: boolean;
  hasPrizes?: boolean;
  schedule: EventScheduleItem[];
  prizes: EventPrize[];
  coordinatorContact?: {
    name?: string;
    role?: string;
    phone?: string;
  };
  teamType: "Individual" | "Team" | "Both";
  minTeamSize: number;
  maxTeamSize: number;
  noRegistrationRequired?: boolean;
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
  isFeatured?: boolean;
}

export function formatDateRangeToReadable(startIso: string, endIso: string): string {
  if (!startIso) return "";
  if (!endIso || endIso === startIso) return formatDateToReadable(startIso);
  try {
    const [sYear, sMonth, sDay] = startIso.split("-").map(Number);
    const [eYear, eMonth, eDay] = endIso.split("-").map(Number);
    if (!sYear || !sMonth || !sDay || !eYear || !eMonth || !eDay) {
      return `${formatDateToReadable(startIso)} - ${formatDateToReadable(endIso)}`;
    }
    const sDate = new Date(sYear, sMonth - 1, sDay);
    const eDate = new Date(eYear, eMonth - 1, eDay);

    const sMonthName = sDate.toLocaleDateString("en-GB", { month: "short" });
    const eMonthName = eDate.toLocaleDateString("en-GB", { month: "short" });

    if (sYear === eYear && sMonth === eMonth) {
      return `${sDay} to ${eDay} ${sMonthName} ${sYear}`;
    } else if (sYear === eYear) {
      return `${sDay} ${sMonthName} to ${eDay} ${eMonthName} ${sYear}`;
    } else {
      return `${sDay} ${sMonthName} ${sYear} to ${eDay} ${eMonthName} ${eYear}`;
    }
  } catch {
    return `${formatDateToReadable(startIso)} - ${formatDateToReadable(endIso)}`;
  }
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
  onSubmit: (data: EventFormData) => void | Promise<void>;
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
    id: "schedule",
    label: "Schedule & Prizes",
    shortLabel: "Schedule",
    icon: CalendarClock,
    description: "Timeline itinerary, round timings, milestones, trophies, cash prizes & perks.",
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
    label: "SRC Forms",
    shortLabel: "SRC Forms",
    icon: ClipboardList,
    description: "Custom delegate questionnaires, surveys, and SRC Forms inquiry fields.",
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultRawDate = new Date().toISOString().split("T")[0];

  const isInitialDateTbd = Boolean(
    initialData?.isDateTbd ||
    (initialData?.date && /\b(coming soon|tbd|to be announced|to be decided)\b/i.test(initialData.date))
  );

  const initialIsMulti = !isInitialDateTbd && (initialData?.isMultiDay || (Boolean(initialData?.rawEndDate) && initialData?.rawEndDate !== initialData?.rawDate) || false);
  const initialRawEndDate = initialData?.rawEndDate || initialData?.rawDate || defaultRawDate;

  const initialHasSchedule = initialData?.hasSchedule !== undefined
    ? Boolean(initialData.hasSchedule)
    : Boolean(initialData?.schedule && initialData.schedule.length > 0);

  const initialHasPrizes = initialData?.hasPrizes !== undefined
    ? Boolean(initialData.hasPrizes)
    : Boolean(initialData?.prizes && initialData.prizes.length > 0);

  const [isCustomOrganizer, setIsCustomOrganizer] = useState(() => {
    if (!initialData?.organizer) return false;
    const org = initialData.organizer;
    const isCentral = org === "SRC JDCOEM";
    const isClub = clubsList.some((c) => c.name === org || `SRC ${c.name}` === org);
    return !isCentral && !isClub;
  });

  const [form, setForm] = useState<EventFormData>({
    name: initialData?.name || "",
    category: initialData?.category || "Technical",
    rawDate: initialData?.rawDate || defaultRawDate,
    rawEndDate: initialRawEndDate,
    isDateTbd: isInitialDateTbd,
    date: isInitialDateTbd
      ? (initialData?.date || "Coming Soon")
      : (initialData?.date || (initialIsMulti ? formatDateRangeToReadable(initialData?.rawDate || defaultRawDate, initialRawEndDate) : formatDateToReadable(defaultRawDate))),
    endDate: initialData?.endDate || (initialIsMulti ? formatDateToReadable(initialRawEndDate) : ""),
    isMultiDay: initialIsMulti,
    time: initialData?.time || "10:00 AM IST",
    venue: initialData?.venue || "JDCOEM Campus",
    organizer: initialData?.organizer || "",
    organizerClubSlug: initialData?.organizerClubSlug || "",
    collaboratingClubs: initialData?.collaboratingClubs || [],
    status: initialData?.status || "Registration Open",
    poster: initialData?.poster || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
    cardImage: initialData?.cardImage || "",
    posterImage: initialData?.posterImage || "",
    headerImage: initialData?.headerImage || "",
    description: initialData?.description || "",
    about: initialData?.about || "",
    whatToExpect: initialData?.whatToExpect && initialData.whatToExpect.length > 0 ? initialData.whatToExpect : [""],
    rules: initialData?.rules && initialData.rules.length > 0 ? initialData.rules : [""],
    hasSchedule: initialHasSchedule,
    hasPrizes: initialHasPrizes,
    schedule: initialData?.schedule && Array.isArray(initialData.schedule) ? JSON.parse(JSON.stringify(initialData.schedule)) : [],
    prizes: initialData?.prizes && Array.isArray(initialData.prizes) ? JSON.parse(JSON.stringify(initialData.prizes)) : [],
    coordinatorContact: {
      name: initialData?.coordinatorContact?.name || "",
      role: initialData?.coordinatorContact?.role || "",
      phone: initialData?.coordinatorContact?.phone || "",
    },
    teamType: initialData?.teamType || "Both",
    minTeamSize: initialData?.minTeamSize || 2,
    maxTeamSize: initialData?.maxTeamSize || 4,
    noRegistrationRequired: Boolean(initialData?.noRegistrationRequired),
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
    isFeatured: Boolean(initialData?.isFeatured),
  });

  useEffect(() => {
    if (initialData) {
      if (initialData.organizer) {
        const org = initialData.organizer;
        const isCentral = org === "SRC JDCOEM";
        const isClub = clubsList.some((c) => c.name === org || `SRC ${c.name}` === org);
        setIsCustomOrganizer(!isCentral && !isClub);
      } else {
        setIsCustomOrganizer(false);
      }

      const isMulti = initialData.isMultiDay || (Boolean(initialData.rawEndDate) && initialData.rawEndDate !== initialData.rawDate) || false;
      const endVal = initialData.rawEndDate || initialData.rawDate || form.rawDate;
      const isDateTbdVal = Boolean(
        initialData.isDateTbd ||
        (initialData.date && /\b(coming soon|to be announced|tba|to be decided|tbd)\b/i.test(initialData.date))
      );
      setForm((prev) => ({
        ...prev,
        ...initialData,
        isMultiDay: isMulti,
        isDateTbd: isDateTbdVal,
        rawEndDate: endVal,
        date: isDateTbdVal ? (initialData.date || "Coming Soon") : (initialData.date || (isMulti ? formatDateRangeToReadable(initialData.rawDate || form.rawDate, endVal) : formatDateToReadable(initialData.rawDate || form.rawDate))),
        endDate: initialData.endDate || (isMulti ? formatDateToReadable(endVal) : ""),
        time: initialData.time || prev.time || "10:00 AM IST",
        noRegistrationRequired: Boolean(initialData.noRegistrationRequired),
        collaboratingClubs: initialData.collaboratingClubs || [],
        coordinatorContact: {
          name: initialData.coordinatorContact?.name || "",
          role: initialData.coordinatorContact?.role || "",
          phone: initialData.coordinatorContact?.phone || "",
        },
        whatToExpect: initialData.whatToExpect && initialData.whatToExpect.length > 0 ? initialData.whatToExpect : [""],
        rules: initialData.rules && initialData.rules.length > 0 ? initialData.rules : [""],
        hasSchedule: initialData.hasSchedule !== undefined
          ? Boolean(initialData.hasSchedule)
          : initialData.schedule && initialData.schedule.length > 0
          ? true
          : prev.hasSchedule !== undefined
          ? prev.hasSchedule
          : false,
        hasPrizes: initialData.hasPrizes !== undefined
          ? Boolean(initialData.hasPrizes)
          : initialData.prizes && initialData.prizes.length > 0
          ? true
          : prev.hasPrizes !== undefined
          ? prev.hasPrizes
          : false,
        schedule: initialData.schedule && Array.isArray(initialData.schedule) ? JSON.parse(JSON.stringify(initialData.schedule)) : prev.schedule || [],
        prizes: initialData.prizes && Array.isArray(initialData.prizes) ? JSON.parse(JSON.stringify(initialData.prizes)) : prev.prizes || [],
        customQuestions: initialData.customQuestions || [],
        isFeatured: Boolean(initialData.isFeatured),
        organizer: initialData.organizer || "",
        organizerClubSlug: initialData.organizerClubSlug || "",
        isPaid: initialData.noRegistrationRequired
          ? false
          : initialData.isPaid !== undefined
          ? Boolean(initialData.isPaid)
          : Boolean((initialData.feeAmount && initialData.feeAmount > 0) || (initialData as any).entryFee?.includes("₹")),
        feeAmount: typeof initialData.feeAmount === "number" && initialData.feeAmount > 0 ? initialData.feeAmount : (initialData.isPaid ? 100 : 0),
      }));
    }
  }, [initialData]);

  const handleStartDateChange = (val: string) => {
    setForm((prev) => {
      const isMulti = Boolean(prev.isMultiDay);
      const endVal = prev.rawEndDate && prev.rawEndDate >= val ? prev.rawEndDate : val;
      const formatted = isMulti
        ? formatDateRangeToReadable(val, endVal)
        : formatDateToReadable(val);
      return {
        ...prev,
        isDateTbd: false,
        rawDate: val,
        rawEndDate: isMulti ? endVal : val,
        date: formatted || val,
        endDate: isMulti ? formatDateToReadable(endVal) : "",
      };
    });
  };

  const handleEndDateChange = (val: string) => {
    setForm((prev) => {
      const formatted = formatDateRangeToReadable(prev.rawDate, val);
      return {
        ...prev,
        isDateTbd: false,
        rawEndDate: val,
        date: formatted || prev.rawDate,
        endDate: formatDateToReadable(val),
      };
    });
  };

  const handleToggleMultiDay = (isMulti: boolean) => {
    setForm((prev) => {
      const endVal = prev.rawEndDate && prev.rawEndDate >= prev.rawDate ? prev.rawEndDate : prev.rawDate;
      const formatted = isMulti
        ? formatDateRangeToReadable(prev.rawDate, endVal)
        : formatDateToReadable(prev.rawDate);
      return {
        ...prev,
        isDateTbd: false,
        isMultiDay: isMulti,
        rawEndDate: isMulti ? endVal : prev.rawDate,
        date: formatted || prev.rawDate,
        endDate: isMulti ? formatDateToReadable(endVal) : "",
      };
    });
  };

  const handleToggleDateTbd = (isTbd: boolean) => {
    setForm((prev) => {
      if (isTbd) {
        return {
          ...prev,
          isDateTbd: true,
          date: prev.isDateTbd && prev.date ? prev.date : "Coming Soon",
        };
      } else {
        const isMulti = Boolean(prev.isMultiDay);
        const endVal = prev.rawEndDate && prev.rawEndDate >= prev.rawDate ? prev.rawEndDate : prev.rawDate;
        const formatted = isMulti
          ? formatDateRangeToReadable(prev.rawDate, endVal)
          : formatDateToReadable(prev.rawDate);
        return {
          ...prev,
          isDateTbd: false,
          date: formatted || prev.rawDate,
          endDate: isMulti ? formatDateToReadable(endVal) : "",
        };
      }
    });
  };

  const availableCollabClubs = useMemo(() => {
    const selectedSlugs = new Set((form.collaboratingClubs || []).map((c) => c.slug));
    return clubsList.filter(
      (c) => c.slug !== form.organizerClubSlug && c.name !== form.organizer && !selectedSlugs.has(c.slug)
    );
  }, [clubsList, form.organizerClubSlug, form.organizer, form.collaboratingClubs]);

  const handleAddCollaboratingClub = (clubSlug: string) => {
    if (!clubSlug) return;
    const clubObj = clubsList.find((c) => c.slug === clubSlug);
    if (!clubObj) return;
    setForm((prev) => {
      const exists = (prev.collaboratingClubs || []).some((c) => c.slug === clubSlug);
      if (exists) return prev;
      return {
        ...prev,
        collaboratingClubs: [
          ...(prev.collaboratingClubs || []),
          { id: clubObj.id, name: clubObj.name, slug: clubObj.slug },
        ],
      };
    });
  };

  const handleRemoveCollaboratingClub = (clubSlug: string) => {
    setForm((prev) => ({
      ...prev,
      collaboratingClubs: (prev.collaboratingClubs || []).filter((c) => c.slug !== clubSlug),
    }));
  };

  const [perkDrafts, setPerkDrafts] = useState<Record<number, string>>({});

  // --- SCHEDULE & ITINERARY HANDLERS ---
  const handleAddScheduleSlot = () => {
    setForm((prev) => ({
      ...prev,
      hasSchedule: true,
      schedule: [
        ...(prev.schedule || []),
        { time: "", title: "", venue: "", description: "" },
      ],
    }));
  };

  const handleUpdateScheduleSlot = (index: number, field: keyof EventScheduleItem, value: string) => {
    setForm((prev) => {
      const updated = [...(prev.schedule || [])];
      if (!updated[index]) return prev;
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, schedule: updated };
    });
  };

  const handleRemoveScheduleSlot = (index: number) => {
    setForm((prev) => ({
      ...prev,
      schedule: (prev.schedule || []).filter((_, i) => i !== index),
    }));
  };

  const handleMoveScheduleSlot = (index: number, direction: "up" | "down") => {
    setForm((prev) => {
      const list = [...(prev.schedule || [])];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return { ...prev, schedule: list };
    });
  };

  const handleDuplicateScheduleSlot = (index: number) => {
    setForm((prev) => {
      const list = [...(prev.schedule || [])];
      const source = list[index];
      if (!source) return prev;
      const clone = { ...source, title: `${source.title || "Slot"} (Copy)` };
      list.splice(index + 1, 0, clone);
      return { ...prev, schedule: list };
    });
  };

  const handleLoadSchedulePreset = () => {
    setForm((prev) => ({
      ...prev,
      hasSchedule: true,
      schedule: [
        {
          time: "10:00 AM - 11:00 AM",
          title: "Delegate Reporting & Briefing",
          venue: prev.venue || "Campus Entrance / Helpdesk",
          description: "ID card verification, delegate kit distribution, and event briefing.",
        },
        {
          time: "11:30 AM - 03:30 PM",
          title: "Main Competition & Challenge Round",
          venue: prev.venue || "Auditorium / Tech Labs",
          description: "Live challenge execution, prototype submission, and judge interactions.",
        },
        {
          time: "04:00 PM - 05:30 PM",
          title: "Valedictory & Awards Ceremony",
          venue: "Main Auditorium",
          description: "Jury remarks, announcement of results, and felicitation of winners.",
        },
      ],
    }));
  };

  const handleClearSchedule = () => {
    setForm((prev) => ({ ...prev, schedule: [] }));
  };

  // --- PRIZES & RECOGNITION HANDLERS ---
  const handleAddPrizeTier = () => {
    setForm((prev) => ({
      ...prev,
      hasPrizes: true,
      prizes: [
        ...(prev.prizes || []),
        { position: "", amount: "", perks: [] },
      ],
    }));
  };

  const handleUpdatePrizeTier = (index: number, field: "position" | "amount", value: string) => {
    setForm((prev) => {
      const updated = [...(prev.prizes || [])];
      if (!updated[index]) return prev;
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, prizes: updated };
    });
  };

  const handleRemovePrizeTier = (index: number) => {
    setForm((prev) => ({
      ...prev,
      prizes: (prev.prizes || []).filter((_, i) => i !== index),
    }));
  };

  const handleMovePrizeTier = (index: number, direction: "up" | "down") => {
    setForm((prev) => {
      const list = [...(prev.prizes || [])];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return { ...prev, prizes: list };
    });
  };

  const handleDuplicatePrizeTier = (index: number) => {
    setForm((prev) => {
      const list = [...(prev.prizes || [])];
      const source = list[index];
      if (!source) return prev;
      const clone = {
        ...source,
        position: `${source.position || "Prize"} (Copy)`,
        perks: [...(source.perks || [])],
      };
      list.splice(index + 1, 0, clone);
      return { ...prev, prizes: list };
    });
  };

  const handleLoadPrizePreset = () => {
    setForm((prev) => ({
      ...prev,
      hasPrizes: true,
      prizes: [
        {
          position: "1st Place - Champion",
          amount: "₹10,000 Cash Prize",
          perks: ["Winner Trophy & Certificate of Excellence", "Direct Fast-Track Interview", "Premium Goodies Hamper"],
        },
        {
          position: "2nd Place - First Runner-up",
          amount: "₹5,000 Cash Prize",
          perks: ["Runner-up Trophy & Certificate", "Fast-Track Shortlisting", "Exclusive Tech Merchandise"],
        },
        {
          position: "3rd Place - Second Runner-up",
          amount: "₹2,500 Cash Prize",
          perks: ["Merit Certificate & Memento", "Special Jury Commendation"],
        },
      ],
    }));
  };

  const handleClearPrizes = () => {
    setForm((prev) => ({ ...prev, prizes: [] }));
  };

  const handleAddPerk = (prizeIndex: number) => {
    const raw = (perkDrafts[prizeIndex] || "").trim();
    if (!raw) return;
    handleDirectAddPerk(prizeIndex, raw);
    setPerkDrafts((prev) => ({ ...prev, [prizeIndex]: "" }));
  };

  const handleDirectAddPerk = (prizeIndex: number, perk: string) => {
    const raw = perk.trim();
    if (!raw) return;
    setForm((prev) => {
      const list = [...(prev.prizes || [])];
      const target = list[prizeIndex];
      if (!target) return prev;
      const currentPerks = target.perks || [];
      if (currentPerks.includes(raw)) return prev;
      list[prizeIndex] = {
        ...target,
        perks: [...currentPerks, raw],
      };
      return { ...prev, prizes: list };
    });
  };

  const handleRemovePerk = (prizeIndex: number, perkIndex: number) => {
    setForm((prev) => {
      const list = [...(prev.prizes || [])];
      const target = list[prizeIndex];
      if (!target) return prev;
      const perks = (target.perks || []).filter((_, i) => i !== perkIndex);
      list[prizeIndex] = { ...target, perks };
      return { ...prev, prizes: list };
    });
  };

  const visibleSections = useMemo(() => {
    if (form.isParentFest) {
      return SECTIONS.filter((s) => s.id === "details" || s.id === "visuals");
    }
    return SECTIONS;
  }, [form.isParentFest]);

  useEffect(() => {
    if (form.isParentFest && activeSection !== "details" && activeSection !== "visuals") {
      setActiveSection("details");
    }
  }, [form.isParentFest, activeSection]);

  const currentSectionIndex = Math.max(0, visibleSections.findIndex((s) => s.id === activeSection));
  const prevSection = currentSectionIndex > 0 ? visibleSections[currentSectionIndex - 1] : null;
  const nextSection = currentSectionIndex < visibleSections.length - 1 ? visibleSections[currentSectionIndex + 1] : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setActiveSection("details");
      setFormError("Please enter an Event Title.");
      return;
    }
    if (!form.organizer || !form.organizer.trim() || form.organizer === "__custom__") {
      setActiveSection("details");
      setFormError("Please select or enter the organizing club, council, or department.");
      return;
    }
    if (isSubmitting) return;
    if (pendingUploads > 0) {
      setFormError("Please wait for all images to finish uploading before saving.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      const cleanCoordinator =
        form.coordinatorContact &&
        (Boolean(form.coordinatorContact.name?.trim()) || Boolean(form.coordinatorContact.phone?.trim()))
          ? {
              name: (form.coordinatorContact.name || "").trim(),
              role: (form.coordinatorContact.role || "").trim(),
              phone: (form.coordinatorContact.phone || "").trim(),
            }
          : undefined;

      const payload: EventFormData = form.isParentFest
        ? {
            ...form,
            coordinatorContact: cleanCoordinator,
            hasSchedule: false,
            hasPrizes: false,
            schedule: [],
            prizes: [],
            noRegistrationRequired: true,
            isPaid: false,
            feeAmount: 0,
            feePricingModel: "per_person",
            teamFeeAmount: 0,
            teamType: "Individual",
            minTeamSize: 1,
            maxTeamSize: 1,
            rules: [],
            whatToExpect: [],
            customQuestions: [],
            parentEventId: "",
            parentEventSlug: "",
            parentEventName: "",
            subEventBadge: "",
          }
        : {
            ...form,
            coordinatorContact: cleanCoordinator,
            hasSchedule: Boolean(form.hasSchedule),
            hasPrizes: Boolean(form.hasPrizes),
            schedule: form.hasSchedule ? (form.schedule || []) : [],
            prizes: form.hasPrizes ? (form.prizes || []) : [],
          };

      await onSubmit(payload);
    } catch (err: any) {
      setFormError(err?.message || "Failed to save event to cloud database. Please verify connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSectionBadge = (id: EventModalSection) => {
    switch (id) {
      case "details":
        return form.category;
      case "schedule": {
        if (!form.hasSchedule && !form.hasPrizes) return "Excluded";
        const sCount = form.hasSchedule ? (form.schedule?.length || 0) : 0;
        const pCount = form.hasPrizes ? (form.prizes?.length || 0) : 0;
        if (sCount > 0 && pCount > 0) return `${sCount} slots • ${pCount} prizes`;
        if (sCount > 0) return `${sCount} slots`;
        if (pCount > 0) return `${pCount} prizes`;
        if (form.hasSchedule && form.hasPrizes) return "Active";
        if (form.hasSchedule) return "Timeline";
        if (form.hasPrizes) return "Prizes";
        return "Excluded";
      }
      case "registration":
        return form.noRegistrationRequired ? "Open Walk-in" : form.isPaid ? `₹${form.feeAmount}` : "Free";
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
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        
        {/* Sticky Tactile Section Navigation Bar - solid bg to eliminate GPU compositing lag */}
        <div className="sticky -top-5 sm:-top-7 z-20 bg-white pt-1 pb-3 border-b border-slate-200/80 -mx-5 sm:-mx-7 px-5 sm:px-7 space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {visibleSections.map((section) => {
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
              {visibleSections[currentSectionIndex]?.description}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              Section {currentSectionIndex + 1} of {visibleSections.length}
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
                value={
                  isCustomOrganizer
                    ? (form.organizer &&
                       form.organizer !== "SRC JDCOEM" &&
                       !clubsList.some((c) => c.name === form.organizer)
                        ? form.organizer
                        : "__custom__")
                    : form.organizer
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__custom__") {
                    setIsCustomOrganizer(true);
                    setForm((prev) => ({
                      ...prev,
                      organizer: "",
                      organizerClubSlug: ""
                    }));
                    return;
                  }
                  setIsCustomOrganizer(false);
                  const matchedClub = clubsList.find((c) => c.name === val || `SRC ${c.name}` === val);
                  const isCentral = val === "SRC JDCOEM";
                  setForm((prev) => ({
                    ...prev,
                    organizer: val,
                    organizerClubSlug: matchedClub ? matchedClub.slug : (isCentral ? "src-council" : "")
                  }));
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
              >
                <option value="">-- Select Organizing Body / Club --</option>
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
                {form.organizer &&
                  form.organizer !== "SRC JDCOEM" &&
                  !clubsList.some((c) => c.name === form.organizer) && (
                    <optgroup label="Current Custom Organizer">
                      <option value={form.organizer}>{form.organizer}</option>
                    </optgroup>
                )}
                <optgroup label="Custom / External Body">
                  <option value="__custom__">+ Enter Custom Organizer Name...</option>
                </optgroup>
              </select>

              {isCustomOrganizer && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={form.organizer === "__custom__" ? "" : form.organizer}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        organizer: val,
                        organizerClubSlug: ""
                      }));
                    }}
                    placeholder="Type organizer name (e.g. Department of CSE, Sports Committee, GDG...)"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border-2 border-[#17458F] text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Type the specific organizing club, academic department, cell, or institutional body.
                  </p>
                </div>
              )}

              <p className="text-[10px] text-slate-400">
                Select or specify the student club, council, or academic department responsible for hosting this event.
              </p>
            </div>

            {/* In Collaboration With (Optional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>In Collaboration With (Optional)</span>
                </label>
                {(form.collaboratingClubs || []).length > 0 && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-[#17458F] border border-blue-200">
                    {(form.collaboratingClubs || []).length} Co-Organizing {(form.collaboratingClubs || []).length === 1 ? "Club" : "Clubs"}
                  </span>
                )}
              </div>

              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddCollaboratingClub(e.target.value);
                    e.target.value = "";
                  }
                }}
                disabled={availableCollabClubs.length === 0}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="" disabled>
                  {availableCollabClubs.length > 0
                    ? "+ Select collaborating partner club..."
                    : "All chartered student clubs added"}
                </option>
                {availableCollabClubs.map((club) => (
                  <option key={club.id || club.slug} value={club.slug}>
                    {club.name}
                  </option>
                ))}
              </select>

              <p className="text-[10px] text-slate-400">
                If this event is hosted jointly between multiple chartered student clubs, select them here.
              </p>

              {/* Selected Collaborating Clubs Chips */}
              {(form.collaboratingClubs || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(form.collaboratingClubs || []).map((club) => (
                    <span
                      key={club.slug || club.name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E78023]" />
                      <span>{club.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCollaboratingClub(club.slug)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded-md hover:bg-slate-200 cursor-pointer"
                        title={`Remove ${club.name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
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
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setForm((prev) => ({
                        ...prev,
                        isParentFest: isChecked,
                        ...(isChecked
                          ? {
                              parentEventId: "",
                              parentEventSlug: "",
                              parentEventName: "",
                              subEventBadge: "",
                            }
                          : {}),
                      }));
                      if (isChecked && activeSection !== "details" && activeSection !== "visuals") {
                        setActiveSection("details");
                      }
                    }}
                    className="w-4 h-4 rounded text-[#17458F] focus:ring-[#17458F] border-slate-300"
                  />
                  <span className="text-xs font-bold text-amber-950">Is Umbrella Event</span>
                </label>
              </div>

              {form.isParentFest ? (
                <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-950 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                    <Layers className="w-4 h-4 text-[#E78023]" />
                    <span>Umbrella Festival Mode Active</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    Schedule itineraries, prize distributions, entry fees, and squad participation rules are omitted here because they are configured individually on each sub-competition under this festival. Only festival details, secretariat support, and visual branding assets are required.
                  </p>
                </div>
              ) : (
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
                        .filter((ev) => ev.id !== editingEventId && Boolean(ev.isParentFest))
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

            {/* Flagship Highlight Spotlight Toggle */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#E78023]" />
                    <span>Flagship Highlight Spotlight</span>
                  </label>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Feature this event as the prominent top hero banner highlight on the official events calendar.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(form.isFeatured)}
                    onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                    className="w-4 h-4 rounded text-[#17458F] focus:ring-[#17458F] border-slate-300"
                  />
                  <span className="text-xs font-bold text-amber-950">Feature as Flagship</span>
                </label>
              </div>
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
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Event Date (Interactive Single or Multi-Day Date Range) & Venue */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-[#E78023]" />
                    <span>Event Date &amp; Duration *</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Choose whether the event is held on a single day, across multiple days, or date is coming soon (TBA).
                  </p>
                </div>

                {/* Duration Mode Switch */}
                <div className="inline-flex p-1 bg-slate-200/70 rounded-xl shrink-0 flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleDateTbd(false);
                      handleToggleMultiDay(false);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      !form.isDateTbd && !form.isMultiDay
                        ? "bg-white text-[#17458F] shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Single Day
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleDateTbd(false);
                      handleToggleMultiDay(true);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      !form.isDateTbd && form.isMultiDay
                        ? "bg-white text-[#E78023] shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Multi-Day (Period)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleDateTbd(true)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      form.isDateTbd
                        ? "bg-amber-500 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Coming Soon (TBA)
                  </button>
                </div>
              </div>

              {/* Date & Time Input Fields */}
              {form.isDateTbd ? (
                <div className="space-y-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Date Coming Soon / To Be Announced</span>
                      </span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300">
                        Date TBA Badge Active
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Use this option when the event date is not finalized yet. The website will display a sleek &ldquo;Date TBA&rdquo; badge on event cards and detail hero headers.
                    </p>
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Custom Display Label *
                      </label>
                      <input
                        type="text"
                        required
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        placeholder="e.g. Coming Soon, Date TBA, or Coming Soon • Nov 2026"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-amber-300 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F]"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 font-semibold mr-1">Quick Presets:</span>
                      {["Coming Soon", "Date TBA", "Revealing Soon", "To Be Announced"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setForm({ ...form, date: preset })}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer",
                            form.date === preset
                              ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50"
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>Event Time</span>
                      </label>
                      <input
                        type="text"
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                        placeholder="e.g. Will be announced or 10:00 AM"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>Venue *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.venue}
                        onChange={(e) => setForm({ ...form, venue: e.target.value })}
                        placeholder="e.g. JDCOEM Campus or TBA"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                      />
                    </div>
                  </div>
                </div>
              ) : !form.isMultiDay ? (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      Date (Calendar) *
                    </label>
                    <input
                      type="date"
                      required
                      value={form.rawDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>Event Time *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                        placeholder="e.g. 10:00 AM IST or 10:00 AM - 04:00 PM"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>Venue *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.venue}
                        onChange={(e) => setForm({ ...form, venue: e.target.value })}
                        placeholder="e.g. Central Auditorium"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={form.rawDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        End Date *
                      </label>
                      <input
                        type="date"
                        required
                        min={form.rawDate}
                        value={form.rawEndDate || form.rawDate}
                        onChange={(e) => handleEndDateChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>Event Daily Schedule / Time *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.time}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                        placeholder="e.g. 10:00 AM Daily or 09:30 AM - 05:30 PM"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>Venue *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.venue}
                        onChange={(e) => setForm({ ...form, venue: e.target.value })}
                        placeholder="e.g. Campus Grounds & Auditorium"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2 border-t border-slate-200/70 text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Public Display Format:</span>
                  <span className="font-bold text-[#17458F] bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-md">
                    {form.date || "Selected Date"}
                  </span>
                </div>
                {form.time && (
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md">
                    <Clock className="w-3 h-3 text-[#E78023]" />
                    <span>{form.time}</span>
                  </div>
                )}
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

            {/* Festival Secretariat & Support Helpdesk (Available directly on Umbrella Events) */}
            {form.isParentFest && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-[#E78023]" />
                      <h4 className="font-heading font-bold text-sm text-slate-900 uppercase">
                        Festival Secretariat &amp; Inquiries
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      Primary contact details displayed on the public festival sidebar for student queries. Leave empty to omit.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(form.coordinatorContact?.name || form.coordinatorContact?.phone) && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            coordinatorContact: { name: "", role: "", phone: "" },
                          }))
                        }
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-transparent hover:border-rose-200 transition-colors font-medium cursor-pointer"
                      >
                        Clear / Leave Empty
                      </button>
                    )}
                    <span
                      className={cn(
                        "text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border shrink-0",
                        form.coordinatorContact?.name || form.coordinatorContact?.phone
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      )}
                    >
                      {form.coordinatorContact?.name || form.coordinatorContact?.phone
                        ? "Secretariat Active"
                        : "Secretariat Omitted"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Coordinator Name / Desk */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Secretariat / Desk Name
                    </label>
                    <input
                      type="text"
                      value={form.coordinatorContact?.name || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          coordinatorContact: {
                            ...(prev.coordinatorContact || { role: "", phone: "" }),
                            name: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g., SRC Secretariat Desk"
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/20"
                    />
                  </div>

                  {/* Designation / Role */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Role / Designation (Optional)
                    </label>
                    <input
                      type="text"
                      value={form.coordinatorContact?.role || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          coordinatorContact: {
                            ...(prev.coordinatorContact || { name: "", phone: "" }),
                            role: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g., Festival Convenor"
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/20"
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#E78023]" />
                      <span>Contact Phone / WhatsApp</span>
                    </label>
                    <input
                      type="tel"
                      value={form.coordinatorContact?.phone || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          coordinatorContact: {
                            ...(prev.coordinatorContact || { name: "", role: "" }),
                            phone: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g., +91 9876543210"
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/20"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. SCHEDULE & PRIZES SECTION                              */}
        {/* ========================================================= */}
        {activeSection === "schedule" && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Context Header */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[#17458F]" />
                  <h3 className="font-heading font-bold text-sm text-[#0F172A] uppercase tracking-wide">
                    Schedule &amp; Prize Configuration
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Configure optional timeline slots and podium cash prizes. You can disable either section if not required for this event.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold shadow-2xs transition-colors",
                    form.hasSchedule
                      ? "bg-white border-blue-200/80 text-[#17458F]"
                      : "bg-slate-100 border-slate-200 text-slate-500"
                  )}
                >
                  <Clock className="w-3 h-3" />
                  <span>
                    {form.hasSchedule
                      ? `${form.schedule.length} ${form.schedule.length === 1 ? "Slot" : "Slots"}`
                      : "Itinerary Omitted"}
                  </span>
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold shadow-2xs transition-colors",
                    form.hasPrizes
                      ? "bg-white border-amber-200/80 text-amber-700"
                      : "bg-slate-100 border-slate-200 text-slate-500"
                  )}
                >
                  <Trophy className="w-3 h-3" />
                  <span>
                    {form.hasPrizes
                      ? `${form.prizes.length} ${form.prizes.length === 1 ? "Prize" : "Prizes"}`
                      : "Prizes Omitted"}
                  </span>
                </span>
              </div>
            </div>

            {/* SUB-SECTION 1: SCHEDULE & TIMELINE */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#17458F]" />
                    <h4 className="font-heading font-bold text-sm text-slate-900 uppercase">
                      1. Event Timeline &amp; Itinerary
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500">
                    Defines rounds, keynote sessions, lunch breaks, and judging timings for the public event page.
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border shrink-0 w-fit",
                    form.hasSchedule
                      ? "bg-blue-50 text-[#17458F] border-blue-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  )}
                >
                  {form.hasSchedule ? "Itinerary Active" : "Itinerary Omitted"}
                </span>
              </div>

              {/* 2-Option Card Switch: Schedule Inclusion */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, hasSchedule: true }))}
                  className={cn(
                    "p-3.5 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3",
                    form.hasSchedule
                      ? "bg-white border-[#17458F] shadow-sm ring-2 ring-[#17458F]/20"
                      : "bg-white/60 border-slate-200 hover:bg-white text-slate-600"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                      form.hasSchedule ? "border-[#17458F] bg-[#17458F] text-white" : "border-slate-300"
                    )}
                  >
                    {form.hasSchedule && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Include Schedule &amp; Itinerary</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-blue-50 text-[#17458F] uppercase border border-blue-100">
                        Active
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                      Publish round timings, keynote sessions, arrival reporting, and judging agenda.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, hasSchedule: false }))}
                  className={cn(
                    "p-3.5 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3",
                    !form.hasSchedule
                      ? "bg-white border-amber-500 shadow-sm ring-2 ring-amber-500/20"
                      : "bg-white/60 border-slate-200 hover:bg-white text-slate-600"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                      !form.hasSchedule ? "border-amber-600 bg-amber-600 text-white" : "border-slate-300"
                    )}
                  >
                    {!form.hasSchedule && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>No Schedule Needed</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 uppercase border border-amber-200">
                        Omitted
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                      Omit itinerary section completely. Ideal for single-session lectures, informal meetups, or exhibitions.
                    </div>
                  </div>
                </button>
              </div>

              {!form.hasSchedule ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-200/70 flex items-center justify-center text-slate-500 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">
                        Schedule &amp; Itinerary is Disabled for this Event
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        No timeline section will be shown to delegates on the public event page.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, hasSchedule: true }))}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-[#17458F] text-xs font-bold text-[#17458F] hover:bg-blue-50/50 transition-colors shrink-0 cursor-pointer shadow-2xs"
                  >
                    Enable Schedule Builder
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                    <span className="text-xs font-bold text-slate-700">
                      Configured Timeline Slots ({form.schedule.length})
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {form.schedule.length === 0 && (
                        <button
                          type="button"
                          onClick={handleLoadSchedulePreset}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#17458F] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                          <span>Load 3-Slot Preset</span>
                        </button>
                      )}
                      {form.schedule.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearSchedule}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                        >
                          Clear All Slots
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddScheduleSlot}
                        className="px-3.5 py-1.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Slot</span>
                      </button>
                    </div>
                  </div>

                  {form.schedule.length === 0 ? (
                    <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-3 bg-slate-50/50">
                      <div className="mx-auto w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <CalendarClock className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700">No schedule slots configured</p>
                        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                          Click below to add specific timeline slots or populate the standard 3-slot template.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleAddScheduleSlot}
                          className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-xs font-semibold text-[#17458F] hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          + Add Single Slot
                        </button>
                        <button
                          type="button"
                          onClick={handleLoadSchedulePreset}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-[#17458F] hover:bg-blue-100/70 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                          <span>Load Standard 3-Slot Preset</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {form.schedule.map((slot, sIdx) => (
                        <div
                          key={sIdx}
                          className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-4 shadow-2xs"
                        >
                          {/* Slot Card Header */}
                          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[#17458F] text-[10px] font-extrabold uppercase tracking-wide">
                                Slot #{sIdx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-800 line-clamp-1">
                                {slot.title.trim() || slot.time.trim() || "Untitled Timeline Slot"}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveScheduleSlot(sIdx, "up")}
                                disabled={sIdx === 0}
                                title="Move Up"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveScheduleSlot(sIdx, "down")}
                                disabled={sIdx === form.schedule.length - 1}
                                title="Move Down"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateScheduleSlot(sIdx)}
                                title="Duplicate Slot"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-[#17458F] hover:bg-blue-50 cursor-pointer transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveScheduleSlot(sIdx)}
                                title="Delete Slot"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Slot Inputs Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#17458F]" />
                                <span>Time / Timing</span>
                              </label>
                              <input
                                type="text"
                                value={slot.time}
                                onChange={(e) => handleUpdateScheduleSlot(sIdx, "time", e.target.value)}
                                placeholder="e.g., 10:00 AM - 11:30 AM or Day 1, 02:00 PM"
                                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/20"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                Session / Milestone Title
                              </label>
                              <input
                                type="text"
                                value={slot.title}
                                onChange={(e) => handleUpdateScheduleSlot(sIdx, "title", e.target.value)}
                                placeholder="e.g., Reporting & Briefing or Round 1: Elimination"
                                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/20"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[#E78023]" />
                                <span>Venue / Location (Optional)</span>
                              </label>
                              <input
                                type="text"
                                value={slot.venue}
                                onChange={(e) => handleUpdateScheduleSlot(sIdx, "venue", e.target.value)}
                                placeholder="e.g., Auditorium / Seminar Hall 2"
                                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/20"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                Description / Notes (Optional)
                              </label>
                              <input
                                type="text"
                                value={slot.description}
                                onChange={(e) => handleUpdateScheduleSlot(sIdx, "description", e.target.value)}
                                placeholder="e.g., Mandatory attendance. Bring college ID."
                                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/20"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SUB-SECTION 2: PRIZES & RECOGNITION */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <h4 className="font-heading font-bold text-sm text-slate-900 uppercase">
                      2. Prizes, Recognition &amp; Perks
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500">
                    Display competitive podium grants, champion trophies, merit certificates, and perks on the event landing page.
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border shrink-0 w-fit",
                    form.hasPrizes
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  )}
                >
                  {form.hasPrizes ? "Prizes Active" : "Prizes Omitted"}
                </span>
              </div>

              {/* 2-Option Card Switch: Prizes Inclusion */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, hasPrizes: true }))}
                  className={cn(
                    "p-3.5 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3",
                    form.hasPrizes
                      ? "bg-white border-[#E78023] shadow-sm ring-2 ring-[#E78023]/20"
                      : "bg-white/60 border-slate-200 hover:bg-white text-slate-600"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                      form.hasPrizes ? "border-[#E78023] bg-[#E78023] text-white" : "border-slate-300"
                    )}
                  >
                    {form.hasPrizes && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Include Prizes &amp; Recognition</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 uppercase border border-amber-200">
                        Active
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                      Display podium ranks, cash prize grants, champion trophies, and winner perks.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, hasPrizes: false }))}
                  className={cn(
                    "p-3.5 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3",
                    !form.hasPrizes
                      ? "bg-white border-amber-500 shadow-sm ring-2 ring-amber-500/20"
                      : "bg-white/60 border-slate-200 hover:bg-white text-slate-600"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                      !form.hasPrizes ? "border-amber-600 bg-amber-600 text-white" : "border-slate-300"
                    )}
                  >
                    {!form.hasPrizes && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>No Prizes Awarded</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 uppercase border border-slate-200">
                        Omitted
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                      Omit prize podium. Ideal for non-competitive workshops, orientation fests, webinars, and guest lectures.
                    </div>
                  </div>
                </button>
              </div>

              {!form.hasPrizes ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-200/70 flex items-center justify-center text-slate-500 shrink-0">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">
                        Prizes &amp; Recognition are Disabled for this Event
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        No prize podium or rewards showcase will be displayed on the public event page.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, hasPrizes: true }))}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-[#E78023] text-xs font-bold text-[#E78023] hover:bg-amber-50/50 transition-colors shrink-0 cursor-pointer shadow-2xs"
                  >
                    Enable Prize Builder
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                    <span className="text-xs font-bold text-slate-700">
                      Configured Podium Tiers ({form.prizes.length})
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {form.prizes.length === 0 && (
                        <button
                          type="button"
                          onClick={handleLoadPrizePreset}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-amber-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Load Top-3 Podium Preset</span>
                        </button>
                      )}
                      {form.prizes.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearPrizes}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                        >
                          Clear All Prizes
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddPrizeTier}
                        className="px-3.5 py-1.5 rounded-xl bg-[#E78023] hover:bg-[#cf6f1b] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Prize Tier</span>
                      </button>
                    </div>
                  </div>

                  {form.prizes.length === 0 ? (
                    <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-3 bg-slate-50/50">
                      <div className="mx-auto w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700">No prizes or recognition configured</p>
                        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                          Click below to add specific prize tiers or populate the standard podium ranks.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleAddPrizeTier}
                          className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-xs font-semibold text-amber-700 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          + Add Single Prize Tier
                        </button>
                        <button
                          type="button"
                          onClick={handleLoadPrizePreset}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-100/70 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>Load Top-3 Podium (1st, 2nd, 3rd)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {form.prizes.map((prize, pIdx) => {
                        const isFirst = pIdx === 0;
                        const isSecond = pIdx === 1;
                        const isThird = pIdx === 2;

                        return (
                          <div
                            key={pIdx}
                            className={cn(
                              "p-4 sm:p-5 rounded-2xl border transition-all space-y-4 shadow-2xs",
                              isFirst
                                ? "bg-white border-amber-300 ring-1 ring-amber-200"
                                : "bg-white border-slate-200 hover:border-slate-300"
                            )}
                          >
                            {/* Prize Card Header */}
                            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1",
                                    isFirst
                                      ? "bg-amber-100 text-amber-900 border border-amber-200"
                                      : isSecond
                                      ? "bg-slate-100 text-slate-800 border border-slate-200"
                                      : isThird
                                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                                      : "bg-blue-50 text-blue-900 border border-blue-200"
                                  )}
                                >
                                  {isFirst ? (
                                    <Trophy className="w-3 h-3 text-amber-600" />
                                  ) : isSecond ? (
                                    <Medal className="w-3 h-3 text-slate-500" />
                                  ) : (
                                    <Award className="w-3 h-3 text-amber-700" />
                                  )}
                                  <span>
                                    {isFirst ? "Champion / 1st" : isSecond ? "Runner Up / 2nd" : isThird ? "2nd Runner Up / 3rd" : `Tier #${pIdx + 1}`}
                                  </span>
                                </span>
                                <span className="text-xs font-bold text-slate-800 line-clamp-1">
                                  {prize.position.trim() || prize.amount.trim() || "Untitled Prize Tier"}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMovePrizeTier(pIdx, "up")}
                                  disabled={pIdx === 0}
                                  title="Move Up"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMovePrizeTier(pIdx, "down")}
                                  disabled={pIdx === form.prizes.length - 1}
                                  title="Move Down"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicatePrizeTier(pIdx)}
                                  title="Duplicate Prize"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer transition-colors"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePrizeTier(pIdx)}
                                  title="Delete Prize Tier"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Prize Position & Amount Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                  Position / Rank Title
                                </label>
                                <input
                                  type="text"
                                  value={prize.position}
                                  onChange={(e) => handleUpdatePrizeTier(pIdx, "position", e.target.value)}
                                  placeholder="e.g., 1st Place - Champion or Best Innovation"
                                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#E78023] focus:ring-2 focus:ring-[#E78023]/20"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                  <Trophy className="w-3 h-3 text-[#E78023]" />
                                  <span>Cash Reward / Grant / Trophy</span>
                                </label>
                                <input
                                  type="text"
                                  value={prize.amount}
                                  onChange={(e) => handleUpdatePrizeTier(pIdx, "amount", e.target.value)}
                                  placeholder="e.g., ₹10,000 or ₹5,000 + Trophy"
                                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold text-[#E78023] focus:outline-none focus:border-[#E78023] focus:ring-2 focus:ring-[#E78023]/20"
                                />
                              </div>
                            </div>

                            {/* Perks & Recognition Badges List */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                                <span>Included Perks &amp; Laurels</span>
                                <span className="text-[10px] text-slate-400 font-normal">Press Enter to add perk</span>
                              </label>

                              {prize.perks && prize.perks.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pb-1">
                                  {prize.perks.map((perk, perkIdx) => (
                                    <span
                                      key={perkIdx}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium"
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-[#E78023] shrink-0" />
                                      <span>{perk}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemovePerk(pIdx, perkIdx)}
                                        className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Perk input */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={perkDrafts[pIdx] || ""}
                                  onChange={(e) => setPerkDrafts({ ...perkDrafts, [pIdx]: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleAddPerk(pIdx);
                                    }
                                  }}
                                  placeholder="Add a perk (e.g., Official Winner Trophy, Internship Fast-Track, Merit Certificate)..."
                                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#E78023] focus:ring-2 focus:ring-[#E78023]/20"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddPerk(pIdx)}
                                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0 border border-slate-200"
                                >
                                  + Add Perk
                                </button>
                              </div>

                              {/* Quick Suggestions */}
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                <span className="text-[10px] text-slate-400 font-medium">Quick perks:</span>
                                {[
                                  "Winner Trophy & Shield",
                                  "Certificate of Excellence",
                                  "Direct Interview Fast-Track",
                                  "Exclusive Swag Hamper",
                                  "Letter of Recommendation",
                                ].map((suggestion) => (
                                  <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => handleDirectAddPerk(pIdx, suggestion)}
                                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-600 transition-colors border border-slate-200/60 cursor-pointer"
                                  >
                                    + {suggestion}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. REGISTRATION SECTION                                   */}
        {/* ========================================================= */}
        {activeSection === "registration" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {form.status === "Completed" && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">
                    Registration Locked • Event Marked As Completed
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    Since this event is marked as <strong>Completed</strong>, public registrations are locked on the portal regardless of registration dates or fee configurations.
                  </p>
                </div>
              </div>
            )}

            {/* Registration Requirement Mode Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/70 to-slate-50 border border-blue-100 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#17458F]" />
                    <span>Registration Requirement</span>
                  </label>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    Is student/attendee registration mandatory on the portal for this event?
                  </p>
                </div>
                <span className={cn(
                  "text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border shrink-0",
                  form.noRegistrationRequired
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                )}>
                  {form.noRegistrationRequired ? "No Registration Required" : "Registration Mandatory"}
                </span>
              </div>

              {/* 2-Option Card Switch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, noRegistrationRequired: false })}
                  className={cn(
                    "p-3.5 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3",
                    !form.noRegistrationRequired
                      ? "bg-white border-[#17458F] shadow-sm ring-2 ring-[#17458F]/20"
                      : "bg-white/60 border-slate-200 hover:bg-white text-slate-600"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                    !form.noRegistrationRequired ? "border-[#17458F] bg-[#17458F] text-white" : "border-slate-300"
                  )}>
                    {!form.noRegistrationRequired && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Require Registrations</div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                      Students register via portal, answer questions, receive tickets, and pay fees if applicable.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setForm({ ...form, noRegistrationRequired: true, isPaid: false })}
                  className={cn(
                    "p-3.5 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3",
                    form.noRegistrationRequired
                      ? "bg-white border-amber-500 shadow-sm ring-2 ring-amber-500/20"
                      : "bg-white/60 border-slate-200 hover:bg-white text-slate-600"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                    form.noRegistrationRequired ? "border-amber-600 bg-amber-600 text-white" : "border-slate-300"
                  )}>
                    {form.noRegistrationRequired && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">No Registrations Required</div>
                    <div className="text-[11px] text-slate-500 font-normal mt-0.5 leading-snug">
                      Open attendance / informational listing only. No registration deadlines, tickets, or fees required.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {form.noRegistrationRequired ? (
              <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Open Attendance Listing Active</span>
                </div>
                <p className="text-xs text-emerald-900/90 leading-relaxed font-medium font-sans">
                  This event will be published purely as an informational listing for student and visitor discovery. 
                  No registration fees, opening dates, or closing deadlines are required, and no student signups will be collected on the portal.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px] font-semibold text-emerald-800">
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200/70 flex items-center gap-2 shadow-xs">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Free Walk-in Entry</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200/70 flex items-center gap-2 shadow-xs">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>No Deadlines Enforced</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200/70 flex items-center gap-2 shadow-xs">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>No Ticketing Gateway</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
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
                      <span>Registration Fee (Paytm / UPI Gateway)</span>
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
                      onClick={() => setForm({ ...form, isPaid: false, feeAmount: 0, teamFeeAmount: 0 })}
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
                      onClick={() => setForm({ ...form, isPaid: true, feeAmount: form.feeAmount > 0 ? form.feeAmount : 100 })}
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
                            step={1}
                            value={form.feeAmount === 0 ? "" : form.feeAmount}
                            onChange={(e) => {
                              const val = e.target.value;
                              const parsed = val === "" ? 0 : parseInt(val, 10);
                              setForm({ ...form, feeAmount: isNaN(parsed) ? 0 : Math.max(0, parsed) });
                            }}
                            placeholder="e.g. 150"
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
                              step={1}
                              value={form.teamFeeAmount === 0 ? "" : form.teamFeeAmount}
                              onChange={(e) => {
                                const val = e.target.value;
                                const parsed = val === "" ? 0 : parseInt(val, 10);
                                setForm({ ...form, teamFeeAmount: isNaN(parsed) ? 0 : Math.max(0, parsed) });
                              }}
                              placeholder="e.g. 300"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-[#17458F]"
                            />
                          </div>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-500 font-medium">
                        Integrated with Paytm for Business and UPI Gateway. Registrations will securely collect this amount via UPI (GPay/PhonePe/Paytm) before issuing delegate passes.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* SUB-SECTION: EVENT HELPDESK & COORDINATOR CONTACT */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#E78023]" />
                    <h4 className="font-heading font-bold text-sm text-slate-900 uppercase">
                      Event Helpdesk &amp; Coordinator Contact
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500">
                    Direct support contact displayed on the public event registration card. Leave empty to omit helpdesk completely.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(form.coordinatorContact?.name || form.coordinatorContact?.phone) && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          coordinatorContact: { name: "", role: "", phone: "" },
                        }))
                      }
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-transparent hover:border-rose-200 transition-colors font-medium cursor-pointer"
                    >
                      Clear / Leave Empty
                    </button>
                  )}
                  <span
                    className={cn(
                      "text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border shrink-0",
                      form.coordinatorContact?.name || form.coordinatorContact?.phone
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    )}
                  >
                    {form.coordinatorContact?.name || form.coordinatorContact?.phone
                      ? "Helpdesk Active"
                      : "Helpdesk Omitted"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Coordinator Name / Desk */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Coordinator / Desk Name
                  </label>
                  <input
                    type="text"
                    value={form.coordinatorContact?.name || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        coordinatorContact: {
                          ...(prev.coordinatorContact || { role: "", phone: "" }),
                          name: e.target.value,
                        },
                      }))
                    }
                    placeholder="e.g., SRC Coding & Creative Desk"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/20"
                  />
                </div>

                {/* Designation / Role */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Role / Designation (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.coordinatorContact?.role || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        coordinatorContact: {
                          ...(prev.coordinatorContact || { name: "", phone: "" }),
                          role: e.target.value,
                        },
                      }))
                    }
                    placeholder="e.g., Lead Coordinators"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/20"
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[#E78023]" />
                    <span>Contact Phone / WhatsApp</span>
                  </label>
                  <input
                    type="tel"
                    value={form.coordinatorContact?.phone || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        coordinatorContact: {
                          ...(prev.coordinatorContact || { name: "", role: "" }),
                          phone: e.target.value,
                        },
                      }))
                    }
                    placeholder="e.g., 8237981028 or +91 9876543210"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/20"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <span className="text-[10px] text-slate-400 font-medium">Quick presets:</span>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      coordinatorContact: {
                        name: `${form.organizer || "SRC"} Helpdesk`,
                        role: "Lead Coordinators",
                        phone: prev.coordinatorContact?.phone || "8237981028",
                      },
                    }))
                  }
                  className="text-[10px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-600 transition-colors border border-slate-200/60 cursor-pointer"
                >
                  + {form.organizer || "SRC"} Helpdesk
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      coordinatorContact: {
                        name: "SRC Central Secretariat",
                        role: "Student Council",
                        phone: prev.coordinatorContact?.phone || "8237981028",
                      },
                    }))
                  }
                  className="text-[10px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-600 transition-colors border border-slate-200/60 cursor-pointer"
                >
                  + SRC Central Secretariat
                </button>
                {(form.coordinatorContact?.name || form.coordinatorContact?.phone) && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        coordinatorContact: { name: "", role: "", phone: "" },
                      }))
                    }
                    className="text-[10px] px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors border border-rose-200 cursor-pointer"
                  >
                    ✕ Leave Empty (No Helpdesk)
                  </button>
                )}
              </div>
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
                <UniversalImageUploader
                  purpose="cardCover"
                  label="1. Card Thumbnail"
                  sublabel="For catalog cards & dashboard"
                  recommendedSize="1200 x 675 px (16:9)"
                  storagePath="events/cards"
                  aspectRatioOverride="16:9"
                  allowedAspectRatiosOverride={["16:9"]}
                  lockAspectRatioOverride={true}
                  previewUrl={form.cardImage}
                  onUploadStateChange={onUploadStateChange}
                  onUrlChange={(url) => {
                    setForm((prev) => ({ ...prev, cardImage: url }));
                  }}
                />
              </div>

              {/* 2. Official Vertical Poster (4:5) */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                <UniversalImageUploader
                  purpose="eventPoster"
                  label="2. Vertical Poster"
                  sublabel="For official notices & passes"
                  recommendedSize="1080 x 1350 px (4:5)"
                  storagePath="events/posters"
                  aspectRatioOverride="4:5"
                  allowedAspectRatiosOverride={["4:5"]}
                  lockAspectRatioOverride={true}
                  previewUrl={form.posterImage}
                  onUploadStateChange={onUploadStateChange}
                  onUrlChange={(url) => {
                    setForm((prev) => ({ ...prev, posterImage: url, poster: url || prev.poster }));
                  }}
                />
              </div>

              {/* 3. Hero Header Backdrop (21:9) */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                <UniversalImageUploader
                  purpose="banner"
                  label="3. Header Banner"
                  sublabel="Cinematic backdrop on detail page"
                  recommendedSize="1920 x 820 px (21:9)"
                  storagePath="events/headers"
                  aspectRatioOverride="21:9"
                  allowedAspectRatiosOverride={["21:9"]}
                  lockAspectRatioOverride={true}
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
        {/* 5. SRC FORMS BUILDER SECTION                             */}
        {/* ========================================================= */}
        {activeSection === "qa" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <SrcFormsBuilder
              fields={form.customQuestions}
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
            disabled={pendingUploads > 0 || isSubmitting}
            className="w-full sm:w-auto order-1 sm:order-3 disabled:opacity-50 disabled:cursor-not-allowed gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Saving to Cloud Database...</span>
              </>
            ) : pendingUploads > 0 ? (
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
