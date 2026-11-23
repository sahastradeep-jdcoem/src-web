"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Award,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  Download,
  Share2,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Ban,
  RotateCcw,
  Eye,
  Calendar,
  Layers,
  Copy,
  Check,
  AlertCircle,
  Upload,
  Palette,
  RefreshCw,
  X,
  FileText,
  Printer,
  ChevronDown,
  PenTool,
  Plus,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EventItem, RegistrationRecord } from "@/types";
import { isEntityOwnedByClub } from "@/types/rbac";
import {
  CertificateRecord,
  CertificateType,
  CertificateSignatory,
  CertificateColorPalette,
} from "@/types/certificates";
import {
  getStoredEvents,
  syncEventsFromFirestore,
  subscribeToEvents,
  resolveTenureForEvent,
  canUserManageEvent,
} from "@/lib/eventsStore";
import {
  getStoredTenures,
  syncTenuresFromFirestore,
  subscribeToTenures,
  getLatestAvailableTenure,
  CouncilTenure,
} from "@/lib/tenureStore";
import { getActiveTenure } from "@/lib/tenureEngine";
import {
  getAllRegistrationsFromFirestore,
  subscribeToRegistrationsFromFirestore,
  cleanUndefined,
  saveSiteContentToFirestore,
} from "@/lib/firebase/firestore";
import {
  getAllCertificatesFromFirestore,
  subscribeToCertificates,
  saveCertificateToFirestore,
  batchSaveCertificatesToFirestore,
  revokeCertificateInFirestore,
  deleteCertificateFromFirestore,
  getCertificateSettings,
  saveCertificateSettings,
  generateCertificateNumber,
  DEFAULT_INSTITUTIONAL_SIGNATORIES,
  DEFAULT_CITATION_TEMPLATE,
  DEFAULT_ACHIEVEMENT_CITATION_TEMPLATE,
  compactCertificateForRegistry,
} from "@/lib/certificatesStore";
import {
  extractPosterColorPalette,
  generatePaletteFromBaseHex,
  DEFAULT_CERTIFICATE_PALETTES,
} from "@/lib/colorExtractor";
import { getStoredClubs, findClub, saveStoredClubs } from "@/lib/councilStore";
import { CertificateView } from "@/components/certificates/CertificateView";
import { downloadCertificateAsImage, printCertificate } from "@/lib/certificateExport";
import { ManualCertificateModal } from "@/components/admin/certificates/ManualCertificateModal";
import { findStudentByBtId } from "@/lib/usersStore";

export interface EventCertificateRecipient {
  uniqueKey: string;
  registrationId: string;
  ticketCode: string;
  name: string;
  btId: string;
  email: string;
  department: string;
  year: string;
  collegeName?: string;
  teamType: "Individual" | "Team";
  teamName?: string;
  isLeader?: boolean;
  memberIndex: number;
  status: string;
}

export default function AdminCertificatesPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-500 font-medium">
          Loading certificate console...
        </div>
      }
    >
      <AdminCertificatesContent />
    </React.Suspense>
  );
}

function AdminCertificatesContent() {
  const { user, isAdmin, isOwner, adminAccess } = useAuth();
  const isClubOwner = adminAccess?.role === "CLUB_OWNER" && adminAccess.active !== false;
  const isScopedEventManager = !isOwner && (isClubOwner || adminAccess?.role === "EVENT_COORDINATOR" || Boolean(adminAccess?.hasEventCoordinatorAccess));
  const searchParams = useSearchParams();
  const initialEventId = searchParams?.get("eventId") || "";

  // Data states
  const [events, setEvents] = useState<EventItem[]>([]);
  const [allRegistrations, setAllRegistrations] = useState<RegistrationRecord[]>([]);
  const [allCertificates, setAllCertificates] = useState<CertificateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tenure filter state
  const [tenuresList, setTenuresList] = useState<CouncilTenure[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return getStoredTenures();
      } catch {}
    }
    return [];
  });
  const [userSelectedTenure, setUserSelectedTenure] = useState(false);
  const [selectedTenureId, setSelectedTenureId] = useState<string>(() => {
    try {
      return getActiveTenure().id;
    } catch {
      return "all";
    }
  });

  // Selected event (can be event id, slug, or "all" / "")
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId);

  // Event Autocomplete & Dropdown filter state
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const eventDropdownRef = useRef<HTMLDivElement | null>(null);
  const optionsListRef = useRef<HTMLDivElement | null>(null);

  // Tab: "generate" | "issued" | "signatures"
  const [activeTab, setActiveTab] = useState<"generate" | "issued" | "signatures">("generate");

  // Institutional Signatures (Single Source of Truth)
  const [savedSignatories, setSavedSignatories] = useState<CertificateSignatory[]>(
    DEFAULT_INSTITUTIONAL_SIGNATORIES
  );
  const [isSavingTruthSignatures, setIsSavingTruthSignatures] = useState(false);
  const [truthSignaturesSuccess, setTruthSignaturesSuccess] = useState(false);

  // Certificate Generator form states
  const [certType, setCertType] = useState<CertificateType>("PARTICIPATION");
  const [certTitle, setCertTitle] = useState("CERTIFICATE OF PARTICIPATION");
  const [rankOrPosition, setRankOrPosition] = useState<string>("1st");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [citationTemplate, setCitationTemplate] = useState(DEFAULT_CITATION_TEMPLATE);
  const [colorPalette, setColorPalette] = useState<CertificateColorPalette>(
    DEFAULT_CERTIFICATE_PALETTES.ocean
  );
  const [isExtractingColor, setIsExtractingColor] = useState(false);
  const [clubLogoUrl, setClubLogoUrl] = useState<string>("");

  // Signatories (4 items)
  const [signatories, setSignatories] = useState<CertificateSignatory[]>(
    DEFAULT_INSTITUTIONAL_SIGNATORIES
  );

  // Participant selection for generation
  const [participantFilter, setParticipantFilter] = useState<"CHECKED_IN" | "ALL" | "UNCERTIFIED">(
    "CHECKED_IN"
  );
  const [selectedRegIds, setSelectedRegIds] = useState<Set<string>>(new Set());
  const [participantSearch, setParticipantSearch] = useState("");

  // Modals & Feedback
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [publishSuccessModal, setPublishSuccessModal] = useState<{ count: number } | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokingCert, setRevokingCert] = useState<CertificateRecord | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);

  // Issued certificates filter
  const [issuedSearch, setIssuedSearch] = useState("");
  const [issuedStatusFilter, setIssuedStatusFilter] = useState<"ALL" | "PUBLISHED" | "REVOKED">(
    "ALL"
  );

  // 1. Initial Data Fetch & Real-Time Subscriptions
  useEffect(() => {
    let isMounted = true;
    const initialEvents = getStoredEvents();
    if (initialEvents.length > 0) setEvents(initialEvents);

    syncEventsFromFirestore().then((evts) => {
      if (isMounted && evts) setEvents(evts);
    });

    const initialTenures = getStoredTenures();
    setTenuresList(initialTenures);
    if (!userSelectedTenure && initialTenures.length > 0) {
      const latest = getLatestAvailableTenure(initialTenures);
      if (latest) setSelectedTenureId(latest.id);
    }

    syncTenuresFromFirestore().then((res) => {
      if (isMounted && res && res.length > 0) {
        setTenuresList(res);
        if (!userSelectedTenure) {
          const latest = getLatestAvailableTenure(res);
          if (latest) setSelectedTenureId(latest.id);
        }
      }
    });

    getAllRegistrationsFromFirestore().then((regs) => {
      if (isMounted && regs) setAllRegistrations(regs as unknown as RegistrationRecord[]);
    });

    getAllCertificatesFromFirestore().then((certs) => {
      if (isMounted && certs) setAllCertificates(certs);
      setIsLoading(false);
    });

    getCertificateSettings().then((settings) => {
      if (isMounted && settings?.defaultSignatories?.length > 0) {
        setSignatories(settings.defaultSignatories);
        setSavedSignatories(settings.defaultSignatories);
      }
      if (isMounted && settings?.defaultCitationTemplate) {
        setCitationTemplate(settings.defaultCitationTemplate);
      }
    });

    const unsubEvents = subscribeToEvents((remoteEvts) => {
      if (isMounted && remoteEvts) setEvents(remoteEvts);
    });

    const unsubTenures = subscribeToTenures((cloudTenures) => {
      if (isMounted && cloudTenures && Array.isArray(cloudTenures) && cloudTenures.length > 0) {
        setTenuresList(cloudTenures);
        if (!userSelectedTenure) {
          const latest = getLatestAvailableTenure(cloudTenures);
          if (latest) setSelectedTenureId(latest.id);
        }
      }
    });

    const unsubRegs = subscribeToRegistrationsFromFirestore((remoteRegs) => {
      if (isMounted && remoteRegs) setAllRegistrations(remoteRegs as unknown as RegistrationRecord[]);
    });

    const unsubCerts = subscribeToCertificates((remoteCerts) => {
      if (isMounted && remoteCerts) setAllCertificates(remoteCerts);
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (eventDropdownRef.current && !eventDropdownRef.current.contains(event.target as Node)) {
        setIsEventDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      isMounted = false;
      unsubEvents();
      unsubTenures();
      unsubRegs();
      unsubCerts();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Comprehensive catalog of all events (live store + past tenure snapshots)
  const allKnownEvents = useMemo(() => {
    const map = new Map<string, EventItem>();
    events.forEach((e) => {
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
  }, [events, tenuresList]);

  // Scoped events list for manual modal & event filters
  const scopedAllKnownEvents = useMemo(() => {
    if (!isScopedEventManager) return allKnownEvents;
    return allKnownEvents.filter((e) => canUserManageEvent(e, adminAccess, user?.btId, allKnownEvents));
  }, [allKnownEvents, isScopedEventManager, adminAccess, user?.btId]);

  // Helper to determine if a registration record strictly belongs to the user's club or event coordinator scope
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

  // Helper to determine if a certificate strictly belongs to the user's club scope
  const isCertificateOwned = useCallback((cert: CertificateRecord) => {
    if (!isScopedEventManager) return true;
    if (!cert) return false;

    // 1. Direct entity check on cert attributes
    if (isClubOwner && isEntityOwnedByClub({
      slug: cert.eventSlug,
      id: cert.eventId,
      organizerClubSlug: cert.organizerClubSlug,
      organizer: cert.organizerClub,
    }, adminAccess)) {
      return true;
    }

    // 2. Lookup event in allKnownEvents
    const matchedEvt = allKnownEvents.find((e) =>
      (cert.eventId && (e.id === cert.eventId || e.slug === cert.eventId)) ||
      (cert.eventSlug && (e.slug === cert.eventSlug || e.id === cert.eventSlug)) ||
      (cert.eventName && e.name.toLowerCase() === cert.eventName.toLowerCase())
    );
    if (matchedEvt) {
      return canUserManageEvent(matchedEvt, adminAccess, user?.btId, allKnownEvents);
    }

    return false;
  }, [isScopedEventManager, isClubOwner, adminAccess, user?.btId, allKnownEvents]);

  // Scoped registrations & certificates for summary counts and lists
  const scopedAllRegistrations = useMemo(() => {
    if (!isScopedEventManager) return allRegistrations;
    return allRegistrations.filter(isRegistrationOwned);
  }, [allRegistrations, isScopedEventManager, isRegistrationOwned]);

  const scopedAllCertificates = useMemo(() => {
    if (!isScopedEventManager) return allCertificates;
    return allCertificates.filter(isCertificateOwned);
  }, [allCertificates, isScopedEventManager, isCertificateOwned]);

  // Sync event query param from URL on initial client load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const evtParam = params.get("eventId") || params.get("event");
      if (evtParam) {
        setSelectedEventId(evtParam);
      }
    }
  }, []);

  // When initialEventId matches an event, ensure its tenure is selected
  useEffect(() => {
    if (initialEventId && allKnownEvents.length > 0 && !userSelectedTenure) {
      const matched = allKnownEvents.find((e) => e.id === initialEventId || e.slug === initialEventId);
      if (matched) {
        setSelectedEventId(matched.id || matched.slug);
        const resolved = resolveTenureForEvent(matched, tenuresList);
        if (resolved) {
          setSelectedTenureId(resolved.id);
        }
      }
    }
  }, [initialEventId, allKnownEvents, tenuresList, userSelectedTenure]);

  // Events available in selected tenure
  const tenureFilteredEvents = useMemo(() => {
    let result: EventItem[] = [];
    const matchedTenure = tenuresList.find((t) => t.id === selectedTenureId);
    if (selectedTenureId === "all" || !matchedTenure) {
      if (selectedTenureId === "all") {
        result = events;
      } else {
        result = events.filter((e) => {
          const resolved = resolveTenureForEvent(e, tenuresList);
          return resolved ? resolved.id === selectedTenureId : e.tenureId === selectedTenureId;
        });
      }
    } else if (matchedTenure.isCurrent || matchedTenure.status === "active") {
      result = events.filter((e) => {
        const resolved = resolveTenureForEvent(e, tenuresList);
        return resolved ? resolved.id === matchedTenure.id : (e.tenureId === matchedTenure.id || !e.tenureId);
      });
    } else {
      // Past tenure: load past tenure events only
      const snapshotEvents = Array.isArray(matchedTenure.events) ? matchedTenure.events : [];
      const pastFromStore = events.filter((e) => {
        const resolved = resolveTenureForEvent(e, tenuresList);
        return resolved ? resolved.id === matchedTenure.id : e.tenureId === matchedTenure.id;
      });

      const map = new Map<string, EventItem>();
      [...snapshotEvents, ...pastFromStore].forEach((ev) => {
        if (ev && (ev.id || ev.slug)) map.set(ev.id || ev.slug, ev);
      });
      result = Array.from(map.values());
    }

    if (isScopedEventManager) {
      return result.filter((e) => canUserManageEvent(e, adminAccess, user?.btId, allKnownEvents));
    }

    return result;
  }, [events, selectedTenureId, tenuresList, isScopedEventManager, adminAccess, user?.btId, allKnownEvents]);

  // Autocomplete / search filtered events for dropdown
  const filteredDropdownEvents = useMemo(() => {
    if (!eventSearchQuery.trim()) return tenureFilteredEvents;
    const q = eventSearchQuery.toLowerCase();
    return tenureFilteredEvents.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.slug.toLowerCase().includes(q) ||
        (e.category && e.category.toLowerCase().includes(q))
    );
  }, [tenureFilteredEvents, eventSearchQuery]);

  // Selectable event options list for keyboard navigation and rendering
  const selectableEventOptions = useMemo(() => {
    const allOption = {
      slug: "all",
      name: isClubOwner
        ? `${adminAccess?.clubNames && adminAccess.clubNames.length > 0 ? adminAccess.clubNames.join(", ") : adminAccess?.clubName || "My Club"} Events & Certificates`
        : "All Events & Forms",
      category: "Overview",
      count: scopedAllRegistrations.length,
      isAll: true,
    };

    const eventOptions = filteredDropdownEvents.map((evt) => {
      // Find all child events if this is an umbrella parent fest
      const childEvents = evt.isParentFest
        ? allKnownEvents.filter(
            (e) =>
              (e.parentEventId && (e.parentEventId === evt.id || e.parentEventId === evt.slug)) ||
              (e.parentEventSlug && (e.parentEventSlug === evt.slug || e.parentEventSlug === evt.id)) ||
              (e.parentEventName && e.parentEventName.toLowerCase().trim() === evt.name.toLowerCase().trim())
          )
        : [];
      const childSlugs = new Set(childEvents.map((c) => (c.slug || "").toLowerCase()));
      const childIds = new Set(childEvents.map((c) => (c.id || "").toLowerCase()));
      const childNames = new Set(childEvents.map((c) => (c.name || "").toLowerCase()));

      const count = scopedAllRegistrations.filter((r) => {
        const rName = (r.eventName || "").toLowerCase();
        const rSlug = (r.eventSlug || "").toLowerCase();
        const rId = (r.eventId || "").toLowerCase();
        const rParentId = (r.parentEventId || "").toLowerCase();
        const rParentName = (r.parentEventName || "").toLowerCase();

        // Direct match
        if (
          rName === evt.name.toLowerCase() ||
          rSlug === evt.slug.toLowerCase() ||
          rId === evt.id.toLowerCase() ||
          rId === evt.slug.toLowerCase() ||
          rSlug === evt.id.toLowerCase()
        ) {
          return true;
        }

        // Umbrella aggregation: if this is a parent fest, count all sub-competition registrations
        if (evt.isParentFest) {
          if (
            childNames.has(rName) ||
            childSlugs.has(rSlug) ||
            childIds.has(rId) ||
            childSlugs.has(rId) ||
            childIds.has(rSlug) ||
            rParentId === evt.id.toLowerCase() ||
            rParentId === evt.slug.toLowerCase() ||
            (rParentName && rParentName === evt.name.toLowerCase())
          ) {
            return true;
          }
        }
        return false;
      }).length;

      return {
        slug: evt.id || evt.slug,
        name: evt.parentEventName ? `${evt.name} (Part of ${evt.parentEventName})` : evt.name,
        category: evt.isParentFest ? "Umbrella Event" : (evt.category || "Event"),
        count,
        isAll: false,
      };
    });

    return [allOption, ...eventOptions];
  }, [filteredDropdownEvents, scopedAllRegistrations, allKnownEvents, isClubOwner, adminAccess]);

  // Keep highlighted index in sync when search changes
  useEffect(() => {
    if (eventSearchQuery.trim() && selectableEventOptions.length > 1) {
      setHighlightedIndex(1); // highlight first matching event
    } else {
      setHighlightedIndex(0);
    }
  }, [eventSearchQuery, selectableEventOptions.length]);

  // Auto-scroll highlighted option into view
  useEffect(() => {
    if (isEventDropdownOpen && optionsListRef.current) {
      const el = optionsListRef.current.querySelector(`[data-option-index="${highlightedIndex}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isEventDropdownOpen]);

  const handleSelectEventOption = (slugOrId: string) => {
    setSelectedEventId(slugOrId);
    setIsEventDropdownOpen(false);
    setEventSearchQuery("");
  };

  const handleEventInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isEventDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsEventDropdownOpen(true);
        setHighlightedIndex(selectableEventOptions.length > 1 && selectedEventId !== "all" ? 1 : 0);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < selectableEventOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : selectableEventOptions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = selectableEventOptions[highlightedIndex];
      if (chosen) {
        handleSelectEventOption(chosen.slug);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEventDropdownOpen(false);
    }
  };

  // Current selected event object
  const currentEvent = useMemo(() => {
    if (!selectedEventId || selectedEventId === "all") return null;
    return allKnownEvents.find((e) => e.id === selectedEventId || e.slug.toLowerCase() === selectedEventId.toLowerCase() || e.name.toLowerCase() === selectedEventId.toLowerCase()) || null;
  }, [allKnownEvents, selectedEventId]);

  // 3. Auto Color Scheme & Logo Extraction when Selected Event Changes
  useEffect(() => {
    if (!currentEvent) return;

    let isCurrent = true;
    setIsExtractingColor(true);

    const poster =
      currentEvent.posterImage ||
      currentEvent.poster ||
      currentEvent.cardImage ||
      currentEvent.headerImage;

    if (poster) {
      extractPosterColorPalette(poster)
        .then((palette) => {
          if (isCurrent) {
            setColorPalette(palette);
            setIsExtractingColor(false);
          }
        })
        .catch(() => {
          if (isCurrent) setIsExtractingColor(false);
        });
    } else {
      setIsExtractingColor(false);
    }

    // Auto-detect club logo from system clubs roster
    try {
      const clubs = getStoredClubs();
      const matchedClub = findClub(
        clubs,
        currentEvent.organizerClubSlug || currentEvent.organizer
      );
      if (matchedClub) {
        const logo =
          matchedClub.logoImage ||
          matchedClub.cardImage ||
          matchedClub.heroImage ||
          "";
        setClubLogoUrl(logo);
      } else {
        setClubLogoUrl("");
      }
    } catch (e) {
      console.warn("Could not lookup club logo", e);
      setClubLogoUrl("");
    }
  }, [currentEvent]);

  // Registrations for the current selected event
  const eventRegistrations = useMemo(() => {
    if (!currentEvent) return [];
    if (isScopedEventManager && !canUserManageEvent(currentEvent, adminAccess, user?.btId, allKnownEvents)) {
      return [];
    }
    const eventId = (currentEvent.id || "").toLowerCase();
    const eventSlug = (currentEvent.slug || "").toLowerCase();
    const eventName = (currentEvent.name || "").toLowerCase();

    return allRegistrations.filter((r) => {
      const rEventId = (r.eventId || "").toLowerCase();
      const rEventSlug = (r.eventSlug || "").toLowerCase();
      const rEventName = (r.eventName || "").toLowerCase();
      return (
        (eventId && rEventId === eventId) ||
        (eventSlug && rEventSlug === eventSlug) ||
        (eventName && rEventName === eventName)
      );
    });
  }, [allRegistrations, currentEvent, isScopedEventManager, adminAccess, user?.btId, allKnownEvents]);

  // Certificates for the current selected event (or filtered by tenure / club scope)
  const eventCertificates = useMemo(() => {
    if (currentEvent) {
      if (isScopedEventManager && !canUserManageEvent(currentEvent, adminAccess, user?.btId, allKnownEvents)) {
        return [];
      }
      return allCertificates.filter(
        (c) => c.eventId === currentEvent.id || c.eventSlug === currentEvent.slug
      );
    }
    if (selectedTenureId !== "all") {
      const tenureEventIds = new Set(tenureFilteredEvents.map((e) => (e.id || "").toLowerCase()));
      const tenureEventSlugs = new Set(tenureFilteredEvents.map((e) => (e.slug || "").toLowerCase()));
      const filtered = allCertificates.filter(
        (c) =>
          tenureEventIds.has((c.eventId || "").toLowerCase()) ||
          tenureEventSlugs.has((c.eventSlug || "").toLowerCase())
      );
      if (isScopedEventManager) {
        return filtered.filter(isCertificateOwned);
      }
      return filtered;
    }
    return scopedAllCertificates;
  }, [allCertificates, currentEvent, selectedTenureId, tenureFilteredEvents, isScopedEventManager, adminAccess, user?.btId, allKnownEvents, isCertificateOwned, scopedAllCertificates]);

  // -------------------------------------------------------------
  // Dynamic Participant & Team Member Expansion for Certificate Issuance
  // -------------------------------------------------------------
  // If the event is a team event, every single member of the squad (leader + teammates)
  // is expanded into an individual recipient record so that separate certificates
  // are issued for all participants (e.g. 62 teams of 2 = 124 certificates).
  const allEventRecipients = useMemo<EventCertificateRecipient[]>(() => {
    if (!currentEvent || eventRegistrations.length === 0) return [];

    const recipients: EventCertificateRecipient[] = [];

    eventRegistrations.forEach((reg, regIndex) => {
      const regId = reg.id || reg.registrationId || `reg_${regIndex}`;
      const ticketCode = reg.ticketCode || "";
      const isTeam =
        reg.teamType === "Team" ||
        Boolean(reg.teamName) ||
        (Array.isArray(reg.teamMembers) && reg.teamMembers.length > 0) ||
        (Array.isArray((reg as any).members) && (reg as any).members.length > 0) ||
        (currentEvent.teamType === "Team");

      if (!isTeam) {
        recipients.push({
          uniqueKey: regId,
          registrationId: regId,
          ticketCode,
          name: reg.participantName || "Delegate",
          btId: reg.btId || "",
          email: reg.email || "",
          department: reg.department || "Engineering",
          year: reg.year || "3rd Year",
          collegeName: reg.collegeName || "JDCOEM Nagpur",
          teamType: "Individual",
          teamName: undefined,
          isLeader: undefined,
          memberIndex: 0,
          status: reg.status || "CONFIRMED",
        });
        return;
      }

      // Team Event: expand all squad members
      const rawMembers = Array.isArray(reg.teamMembers)
        ? reg.teamMembers
        : Array.isArray((reg as any).members)
        ? (reg as any).members
        : [];

      interface ParsedMember {
        name: string;
        btId: string;
        department?: string;
        year?: string;
        email?: string;
        isLeader?: boolean;
      }

      const parsedMembers: ParsedMember[] = [];

      rawMembers.forEach((m: any) => {
        if (!m) return;
        if (typeof m === "string") {
          const str = m.trim();
          const match = str.match(/^(.*?)(?:\s*\((.*?)\))?$/);
          const memberName = match && match[1] ? match[1].trim() : str;
          const memberBtId = match && match[2] ? match[2].trim().toUpperCase() : "";
          parsedMembers.push({
            name: memberName,
            btId: memberBtId,
            isLeader: false,
          });
        } else if (typeof m === "object") {
          parsedMembers.push({
            name: m.name || m.displayName || "",
            btId: (m.btId || "").trim().toUpperCase(),
            department: m.department || "",
            year: m.year || "",
            email: m.email || "",
            isLeader: Boolean(m.isLeader),
          });
        }
      });

      // Check if team leader is already represented in parsedMembers
      const leaderBtId = (reg.btId || "").trim().toUpperCase();
      const leaderName = (reg.participantName || "").trim().toLowerCase();

      const leaderInMembersIndex = parsedMembers.findIndex((m) => {
        if (m.isLeader) return true;
        if (leaderBtId && m.btId && m.btId === leaderBtId) return true;
        if (leaderName && m.name.trim().toLowerCase() === leaderName) return true;
        return false;
      });

      if (leaderInMembersIndex >= 0) {
        parsedMembers[leaderInMembersIndex].isLeader = true;
      } else {
        // Prepend the registered team leader as the first member
        parsedMembers.unshift({
          name: reg.participantName || "Team Leader",
          btId: leaderBtId,
          department: reg.department || "",
          year: reg.year || "",
          email: reg.email || "",
          isLeader: true,
        });
      }

      // Ensure at least one member is marked as leader
      if (!parsedMembers.some((m) => m.isLeader) && parsedMembers.length > 0) {
        parsedMembers[0].isLeader = true;
      }

      // Enrich missing details using findStudentByBtId and college defaults
      parsedMembers.forEach((member, memberIdx) => {
        let name = member.name.trim();
        let btId = (member.btId || "").trim().toUpperCase();
        let dept = member.department || "";
        let yr = member.year || "";
        let email = member.email || "";

        if (btId) {
          const studentProfile = findStudentByBtId(btId);
          if (studentProfile) {
            if (!name || name.toLowerCase() === "student" || name.toLowerCase() === "delegate") {
              name = studentProfile.name || name;
            }
            if (!dept && studentProfile.department) dept = studentProfile.department;
            if (!yr && studentProfile.year) yr = studentProfile.year;
            if (!email && studentProfile.email) email = studentProfile.email;
          }
        }

        if (!name) name = member.isLeader ? (reg.participantName || "Team Leader") : `Teammate ${memberIdx + 1}`;
        if (!dept) dept = reg.department || "Engineering";
        if (!yr) yr = reg.year || "3rd Year";
        if (!email) email = member.isLeader ? (reg.email || "") : (btId ? `${btId.toLowerCase()}@jdcoem.ac.in` : reg.email || "");

        recipients.push({
          uniqueKey: `${regId}_m${memberIdx}`,
          registrationId: regId,
          ticketCode: ticketCode ? `${ticketCode}` : "",
          name,
          btId,
          email,
          department: dept,
          year: yr,
          collegeName: reg.collegeName || "JDCOEM Nagpur",
          teamType: "Team",
          teamName: reg.teamName || undefined,
          isLeader: member.isLeader,
          memberIndex: memberIdx,
          status: reg.status || "CONFIRMED",
        });
      });
    });

    return recipients;
  }, [currentEvent, eventRegistrations]);

  // Set of participant & team member identifier keys that already have a certificate
  const certifiedRecipientKeys = useMemo(() => {
    const set = new Set<string>();
    eventCertificates.forEach((c) => {
      if (c.registrationId) {
        if (c.recipientBtId) {
          set.add(`${c.registrationId}_${c.recipientBtId.trim().toUpperCase()}`);
        }
        if (c.recipientName) {
          set.add(`${c.registrationId}_${c.recipientName.trim().toLowerCase()}`);
        }
        if (c.recipientEmail) {
          set.add(`${c.registrationId}_${c.recipientEmail.trim().toLowerCase()}`);
        }
        set.add(c.registrationId);
      }
    });
    return set;
  }, [eventCertificates]);

  const isRecipientCertified = (r: EventCertificateRecipient): boolean => {
    if (r.teamType === "Team") {
      if (r.btId && certifiedRecipientKeys.has(`${r.registrationId}_${r.btId.trim().toUpperCase()}`)) {
        return true;
      }
      if (r.name && certifiedRecipientKeys.has(`${r.registrationId}_${r.name.trim().toLowerCase()}`)) {
        return true;
      }
      if (r.email && certifiedRecipientKeys.has(`${r.registrationId}_${r.email.trim().toLowerCase()}`)) {
        return true;
      }
      return false;
    }
    return certifiedRecipientKeys.has(r.registrationId);
  };

  // Filtered recipients list for generation
  const filteredParticipants = useMemo(() => {
    return allEventRecipients.filter((p) => {
      // 1. Status Filter
      if (participantFilter === "CHECKED_IN" && p.status !== "CHECKED_IN") {
        return false;
      }
      if (participantFilter === "UNCERTIFIED" && isRecipientCertified(p)) {
        return false;
      }
      if (p.status === "CANCELLED") {
        return false;
      }

      // 2. Search
      if (participantSearch.trim()) {
        const query = participantSearch.toLowerCase();
        const name = (p.name || "").toLowerCase();
        const btId = (p.btId || "").toLowerCase();
        const email = (p.email || "").toLowerCase();
        const dept = (p.department || "").toLowerCase();
        const teamName = (p.teamName || "").toLowerCase();
        return (
          name.includes(query) ||
          btId.includes(query) ||
          email.includes(query) ||
          dept.includes(query) ||
          teamName.includes(query)
        );
      }
      return true;
    });
  }, [allEventRecipients, participantFilter, certifiedRecipientKeys, participantSearch]);

  // Sync selected recipient keys when filtered list changes (auto-select uncertified recipients)
  useEffect(() => {
    if (filteredParticipants.length > 0 && selectedRegIds.size === 0) {
      const newSelected = new Set<string>();
      filteredParticipants.forEach((p) => {
        if (!isRecipientCertified(p)) {
          newSelected.add(p.uniqueKey);
        }
      });
      setSelectedRegIds(newSelected);
    }
  }, [filteredParticipants, certifiedRecipientKeys]);

  // Toggle selection
  const handleToggleParticipant = (uniqueKey: string) => {
    setSelectedRegIds((prev) => {
      const next = new Set(prev);
      if (next.has(uniqueKey)) next.delete(uniqueKey);
      else next.add(uniqueKey);
      return next;
    });
  };

  const handleSelectAllParticipants = () => {
    if (selectedRegIds.size === filteredParticipants.length) {
      setSelectedRegIds(new Set());
    } else {
      const next = new Set<string>();
      filteredParticipants.forEach((p) => next.add(p.uniqueKey));
      setSelectedRegIds(next);
    }
  };

  // Club logo image upload helper
  const handleClubLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setClubLogoUrl(reader.result);
        if (currentEvent) {
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem(`src_club_logo_${currentEvent.slug}`, reader.result);
              localStorage.setItem(`src_club_logo_${currentEvent.id}`, reader.result);
            }
          } catch {}
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Helpers for Institutional Saved Signatures (Single Source of Truth)
  const handleUpdateSavedSignatory = (
    index: number,
    field: keyof CertificateSignatory,
    value: string
  ) => {
    setSavedSignatories((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSavedSignatureUpload = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid PNG or WebP image");
      return;
    }

    try {
      const optimizedUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const maxWidth = 600;
            const maxHeight = 300;
            let width = img.width;
            let height = img.height;
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL("image/png"));
            } else {
              resolve(event.target?.result as string);
            }
          };
          img.onerror = () => resolve(event.target?.result as string);
          img.src = event.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setSavedSignatories((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], signatureImageUrl: optimizedUrl };
        return next;
      });
    } catch (err) {
      console.error(err);
      alert("Could not process signature image.");
    }
  };

  const handleClearSavedSignature = (index: number) => {
    setSavedSignatories((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], signatureImageUrl: "" };
      return next;
    });
  };

  const handleSaveTruthSignatures = async () => {
    if (isScopedEventManager && !isOwner) {
      alert("Unauthorized: Institutional signature templates represent central college governance and cannot be modified by Club Owners.");
      return;
    }
    setIsSavingTruthSignatures(true);
    setTruthSignaturesSuccess(false);
    try {
      await saveCertificateSettings({
        defaultSignatories: savedSignatories,
      });
      // Synchronize in-memory active generator signatories as well
      setSignatories(savedSignatories);
      setTruthSignaturesSuccess(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("src_certificate_settings_updated", { detail: savedSignatories })
        );
      }
      setTimeout(() => setTruthSignaturesSuccess(false), 5000);
    } catch (e) {
      console.error(e);
      alert("Failed to save authoritative institutional signatures. Please retry.");
    } finally {
      setIsSavingTruthSignatures(false);
    }
  };

  const handleResetToStandardSignatures = () => {
    if (isScopedEventManager && !isOwner) {
      alert("Unauthorized: Institutional signature templates represent central college governance and cannot be modified by Club Owners.");
      return;
    }
    if (confirm("Reset all 4 signatory slots back to standard institutional defaults?")) {
      setSavedSignatories(DEFAULT_INSTITUTIONAL_SIGNATORIES);
    }
  };

  // Live preview builder for first selected participant
  const handleOpenLivePreview = () => {
    if (!currentEvent) return;
    if (isScopedEventManager && !canUserManageEvent(currentEvent, adminAccess, user?.btId, allKnownEvents)) {
      alert("Unauthorized: You can only preview certificates for events under your assigned club.");
      return;
    }

    const firstRecipient =
      filteredParticipants.find((p) => selectedRegIds.has(p.uniqueKey)) ||
      filteredParticipants[0] ||
      allEventRecipients[0];

    const recipientName = firstRecipient?.name || "Harsh Shende";
    const recipientDept = firstRecipient?.department || "Computer Science & Engineering";
    const eventName = currentEvent.name;

    const resolvedCitation = citationTemplate
      .replace(/{name}/g, recipientName)
      .replace(/{rank}/g, rankOrPosition || "1st")
      .replace(/{event}/g, eventName)
      .replace(/{date}/g, currentEvent.date || issueDate)
      .replace(/{department}/g, recipientDept);

    const certNum = generateCertificateNumber(
      currentEvent.slug,
      firstRecipient?.btId ? firstRecipient.btId.slice(-4) : (firstRecipient?.ticketCode || "001")
    );
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://srcjdcoem.in";
    const previewPayload: CertificateRecord = cleanUndefined({
      id: "preview-cert",
      certificateNumber: certNum,
      type: certType,
      title: certTitle,
      rankOrPosition: certType === "ACHIEVEMENT" ? (rankOrPosition || "1st") : undefined,
      recipientName,
      recipientEmail: firstRecipient?.email || user?.email || "student@jdcoem.ac.in",
      recipientBtId: firstRecipient?.btId || user?.btId || "BT22CS001",
      recipientDepartment: recipientDept,
      recipientYear: firstRecipient?.year || "3rd Year",
      recipientCollege: firstRecipient?.collegeName || "JDCOEM Nagpur",
      registrationId: firstRecipient?.registrationId || "reg-001",
      ticketCode: firstRecipient?.ticketCode || "TCK-001",
      eventId: currentEvent.id,
      eventSlug: currentEvent.slug,
      eventName: currentEvent.name,
      eventDate: currentEvent.date || "",
      organizerClub: currentEvent.organizer || "Student Representation Council",
      organizerClubSlug: currentEvent.organizerClubSlug || "",
      clubLogoUrl: clubLogoUrl || "",
      posterUrl: currentEvent.posterImage || currentEvent.poster || "",
      colorPalette,
      citation: resolvedCitation,
      signatories: (savedSignatories && savedSignatories.length > 0) ? savedSignatories : (signatories || []),
      issueDate,
      status: "PUBLISHED",
      verificationUrl: `${origin}/verify/certificate/preview-cert`,
      qrPayload: `${origin}/verify/certificate/preview-cert`,
      issuedBy: user?.displayName || "SRC Admin",
      issuedAt: new Date().toISOString(),
    });

    // Isolate live preview: Never publish to the certificates collection until the user clicks "Publish"
    // Delete any stray "preview-cert" from the certificates collection so student dashboards remain pristine
    deleteCertificateFromFirestore("preview-cert").catch(() => {});

    // Save strictly to site_content partition so scanning the QR on live preview can verify on phone without publishing to student dashboard
    saveSiteContentToFirestore("preview_certificate", compactCertificateForRegistry(previewPayload)).catch(console.error);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("src_preview_cert", JSON.stringify(previewPayload));
        if (previewPayload.clubLogoUrl && currentEvent) {
          localStorage.setItem(`src_club_logo_${currentEvent.slug}`, previewPayload.clubLogoUrl);
          localStorage.setItem(`src_club_logo_${currentEvent.id}`, previewPayload.clubLogoUrl);
        }
      } catch {}
    }

    setPreviewCert(previewPayload);
  };

  // 4. Batch Generate and Publish Action
  const handleBatchPublish = async () => {
    if (!currentEvent) return;
    if (isScopedEventManager && !canUserManageEvent(currentEvent, adminAccess, user?.btId, allKnownEvents)) {
      alert(`Unauthorized: You can only publish certificates for events organized by or collaborating with ${adminAccess?.clubNames && adminAccess.clubNames.length > 0 ? adminAccess.clubNames.join(", ") : adminAccess?.clubName || "your assigned club"}.`);
      return;
    }
    if (selectedRegIds.size === 0) {
      alert("Please select at least one participant to issue certificates.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to generate and publish ${selectedRegIds.size} certificates for "${currentEvent.name}"? They will appear immediately on the students' dashboards.`
    );
    if (!confirmed) return;

    setIsPublishing(true);
    setPublishProgress({ current: 0, total: selectedRegIds.size });

    try {
      const selectedList = allEventRecipients.filter((r) =>
        selectedRegIds.has(r.uniqueKey)
      );

      const certsToSave: CertificateRecord[] = [];
      const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://srcjdcoem.in";

      for (let i = 0; i < selectedList.length; i++) {
        const recipient = selectedList[i];
        const rawRegId = recipient.registrationId;
        const cleanRegId = String(rawRegId).replace(/[^a-zA-Z0-9_-]/g, "_");
        const cleanSlug = (currentEvent.slug || "event").replace(/[^a-zA-Z0-9_-]/g, "_");
        const cleanBtId = (recipient.btId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
        const memberKey = recipient.teamType === "Team" ? `${cleanBtId || `m${recipient.memberIndex}`}` : "";
        const certId = memberKey ? `cert_${cleanSlug}_${cleanRegId}_${memberKey}_${Date.now()}_${i + 1}` : `cert_${cleanSlug}_${cleanRegId}_${Date.now()}_${i + 1}`;
        const certNum = generateCertificateNumber(
          currentEvent.slug,
          recipient.btId ? recipient.btId.slice(-4) : (recipient.ticketCode || cleanRegId.slice(-4))
        );

        const resolvedCitation = citationTemplate
          .replace(/{name}/g, recipient.name || "Participant")
          .replace(/{rank}/g, rankOrPosition || "1st")
          .replace(/{event}/g, currentEvent.name)
          .replace(/{date}/g, currentEvent.date || issueDate)
          .replace(/{department}/g, recipient.department || "Engineering");

        const verificationUrl = `${origin}/verify/certificate/${certId}`;

        certsToSave.push(cleanUndefined({
          id: certId,
          certificateNumber: certNum,
          type: certType,
          title: certTitle,
          rankOrPosition: certType === "ACHIEVEMENT" ? (rankOrPosition || "1st") : undefined,
          recipientName: recipient.name || "Delegate",
          recipientEmail: (recipient.email || "").trim().toLowerCase(),
          recipientBtId: (recipient.btId || "").trim().toUpperCase(),
          recipientDepartment: recipient.department || "Engineering",
          recipientYear: recipient.year || "3rd Year",
          recipientCollege: recipient.collegeName || "JDCOEM Nagpur",
          registrationId: rawRegId,
          ticketCode: recipient.ticketCode || "",
          eventId: currentEvent.id,
          eventSlug: currentEvent.slug,
          eventName: currentEvent.name,
          eventDate: currentEvent.date || "",
          organizerClub: currentEvent.organizer || "SRC Council",
          organizerClubSlug: currentEvent.organizerClubSlug || "",
          clubLogoUrl: clubLogoUrl || "",
          posterUrl: currentEvent.posterImage || currentEvent.poster || "",
          colorPalette,
          citation: resolvedCitation,
          signatories: (savedSignatories && savedSignatories.length > 0) ? savedSignatories : (signatories || []),
          issueDate,
          status: "PUBLISHED" as const,
          verificationUrl,
          qrPayload: verificationUrl,
          issuedBy: user?.displayName || user?.email || "SRC Admin",
          issuedAt: new Date().toISOString(),
        }));
      }

      await batchSaveCertificatesToFirestore(certsToSave);

      // Also ensure institutional signatures & event club logo are synced to persistent settings
      saveCertificateSettings({
        defaultSignatories: (savedSignatories && savedSignatories.length > 0) ? savedSignatories : signatories,
        defaultCitationTemplate: citationTemplate,
        defaultClubLogoUrl: clubLogoUrl || undefined,
        clubLogosByEvent: currentEvent ? {
          [currentEvent.slug]: clubLogoUrl,
          [currentEvent.id]: clubLogoUrl,
        } : undefined,
      }).catch(console.warn);

      if (clubLogoUrl && currentEvent) {
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(`src_club_logo_${currentEvent.slug}`, clubLogoUrl);
            localStorage.setItem(`src_club_logo_${currentEvent.id}`, clubLogoUrl);
          }
          saveSiteContentToFirestore(`cert_logo_${currentEvent.slug}`, { logoUrl: clubLogoUrl }).catch(console.warn);
          saveSiteContentToFirestore(`cert_logo_${currentEvent.id}`, { logoUrl: clubLogoUrl }).catch(console.warn);

          // If matched club exists, persist logo to club roster
          const clubs = getStoredClubs();
          const matchedClub = findClub(clubs, currentEvent.organizerClubSlug || currentEvent.organizer || "");
          if (matchedClub && (!matchedClub.logoImage || matchedClub.logoImage !== clubLogoUrl)) {
            matchedClub.logoImage = clubLogoUrl;
            saveStoredClubs(clubs).catch(console.warn);
          }
        } catch {}
      }

      // Instantly update local state so certificates appear immediately
      setAllCertificates((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]));
        certsToSave.forEach((c) => map.set(c.id, c));
        return Array.from(map.values());
      });

      setPublishSuccessModal({ count: certsToSave.length });
      setSelectedRegIds(new Set());
      setActiveTab("issued");
    } catch (err: any) {
      console.error("Batch publish error:", err);
      const errorMsg = err?.message || err?.code || "Please check network and retry.";
      alert(`Failed to publish certificates: ${errorMsg}`);
    } finally {
      setIsPublishing(false);
      setPublishProgress(null);
    }
  };

  // Revoke action
  const handleConfirmRevoke = async () => {
    if (!revokingCert) return;
    if (isScopedEventManager && !isCertificateOwned(revokingCert)) {
      alert("Unauthorized: You can only revoke certificates belonging to your assigned club.");
      return;
    }
    setIsRevoking(true);
    try {
      const ok = await revokeCertificateInFirestore(revokingCert.id, revokeReason);
      if (ok) {
        setAllCertificates((prev) =>
          prev.map((c) => (c.id === revokingCert.id ? { ...c, status: "REVOKED", revocationReason: revokeReason } : c))
        );
        setRevokingCert(null);
        setRevokeReason("");
      } else {
        alert("Could not revoke certificate.");
      }
    } catch (e) {
      console.error(e);
      alert("Error revoking certificate.");
    } finally {
      setIsRevoking(false);
    }
  };

  // Delete action
  const handleDeleteCert = async (certId: string) => {
    const targetCert = allCertificates.find((c) => c.id === certId);
    if (isScopedEventManager && targetCert && !isCertificateOwned(targetCert)) {
      alert("Unauthorized: You can only delete certificates belonging to your assigned club.");
      return;
    }
    if (!window.confirm("Permanently delete this certificate document?")) return;
    try {
      const ok = await deleteCertificateFromFirestore(certId);
      if (ok) {
        setAllCertificates((prev) => prev.filter((c) => c.id !== certId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyVerificationLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER & KPI STATS */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-[#0B132B]">
                CERTIFICATE CONSOLE
              </h1>
              {isClubOwner && (
                <p className="text-xs text-[#E78023] font-bold mt-0.5">
                  Club Scope: {adminAccess?.clubNames && adminAccess.clubNames.length > 0 ? adminAccess.clubNames.join(", ") : adminAccess?.clubName || "My Club"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Global Stats & Add Certificate Button */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              {isScopedEventManager ? "Club Credentials" : "Issued Credentials"}
            </span>
            <span className="font-heading font-extrabold text-lg text-[#17458F]">
              {scopedAllCertificates.filter((c) => c.status === "PUBLISHED").length}
            </span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              {isScopedEventManager ? "Club Events" : "Certified Events"}
            </span>
            <span className="font-heading font-extrabold text-lg text-emerald-600">
              {new Set(scopedAllCertificates.map((c) => c.eventId)).size}
            </span>
          </div>

          <Button
            type="button"
            onClick={() => setIsManualModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123673] text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Certificate
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER MENU BAR: TENURE PERIOD & EVENT FILTER */}
      {/* ------------------------------------------------------------- */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Left Side: Tenure Filter & Autocomplete Event Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          
          {/* 1. Tenure Dropdown Filter */}
          <div className="min-w-[180px] sm:min-w-[210px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Tenure Period
            </span>
            <div className="relative">
              <select
                value={selectedTenureId}
                onChange={(e) => {
                  setUserSelectedTenure(true);
                  setSelectedTenureId(e.target.value);
                  setSelectedEventId("all");
                }}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#17458F] cursor-pointer appearance-none shadow-2xs"
              >
                <option value="all">All Tenures</option>
                {tenuresList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tenureNumber} ({t.label})
                  </option>
                ))}
              </select>
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 2. Autocomplete & Dropdown Supported Event Filter */}
          <div className="relative flex-1 min-w-[240px]" ref={eventDropdownRef}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Event / Competition Filter
            </span>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={
                  isEventDropdownOpen
                    ? eventSearchQuery
                    : !selectedEventId
                    ? ""
                    : selectedEventId === "all"
                    ? "All Events & Forms"
                    : (allKnownEvents.find(e => e.id === selectedEventId || e.slug.toLowerCase() === selectedEventId.toLowerCase() || e.name.toLowerCase() === selectedEventId.toLowerCase())?.name || selectedEventId)
                }
                onFocus={() => {
                  setIsEventDropdownOpen(true);
                  setEventSearchQuery("");
                }}
                onChange={(e) => {
                  setEventSearchQuery(e.target.value);
                  setIsEventDropdownOpen(true);
                }}
                onKeyDown={handleEventInputKeyDown}
                placeholder={
                  !selectedEventId 
                    ? "Select an event or choose 'All Events'..." 
                    : selectedEventId === "all" 
                    ? "All Events selected (search to change)..." 
                    : "Change event (use ↑↓ keys & Enter)..."
                }
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#17458F] shadow-2xs"
              />
              {selectedEventId ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEventId("");
                    setEventSearchQuery("");
                    setIsEventDropdownOpen(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-200 cursor-pointer"
                  title="Clear event filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>

            {/* Autocomplete Dropdown Options Menu with Keyboard Controls */}
            {isEventDropdownOpen && (
              <div 
                ref={optionsListRef}
                className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150 scrollbar-thin"
              >
                {selectableEventOptions.map((opt, idx) => {
                  const isHighlighted = highlightedIndex === idx;
                  const isCurrentActive = opt.isAll 
                    ? selectedEventId === "all" 
                    : (Boolean(selectedEventId) && (selectedEventId === opt.slug || selectedEventId.toLowerCase() === opt.slug.toLowerCase() || (currentEvent && (currentEvent.id === opt.slug || currentEvent.slug.toLowerCase() === opt.slug.toLowerCase()))));

                  return (
                    <button
                      key={opt.slug}
                      type="button"
                      data-option-index={idx}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => handleSelectEventOption(opt.slug)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isHighlighted
                          ? "bg-[#17458F] text-white shadow-xs ring-1 ring-[#17458F]"
                          : isCurrentActive
                          ? "bg-slate-100 text-[#17458F]"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="truncate">{opt.name}</span>
                        {!opt.isAll && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                              isHighlighted 
                                ? "bg-white/20 text-white" 
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {opt.category}
                          </span>
                        )}
                      </div>
                      <Badge 
                        variant={isHighlighted ? "orange" : isCurrentActive ? "orange" : "slate"} 
                        size="sm"
                      >
                        {opt.count}
                      </Badge>
                    </button>
                  );
                })}

                {selectableEventOptions.length === 0 && (
                  <div className="p-3 text-center text-xs text-slate-400">
                    No matching events found
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Right Corner: Poster Extraction status & Tab Switcher */}
        <div className="pt-1 md:pt-0 flex flex-wrap items-end sm:items-center gap-3">
          {isExtractingColor && (
            <span className="text-[11px] text-amber-600 font-bold flex items-center gap-1 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              Sampling Colors...
            </span>
          )}

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("generate")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "generate"
                  ? "bg-white text-[#17458F] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Issue Certificates
            </button>
            <button
              onClick={() => setActiveTab("issued")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "issued"
                  ? "bg-white text-[#17458F] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#17458F]" />
              Issued ({eventCertificates.length})
            </button>
            {(!isScopedEventManager || isOwner) && (
              <button
                onClick={() => setActiveTab("signatures")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "signatures"
                    ? "bg-white text-[#17458F] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                Saved Signatures
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TAB 1: GENERATE CERTIFICATES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "generate" && !currentEvent && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900">
              Select an Event to Issue Certificates
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1">
              Official digital certificates are generated and issued per event or competition. Choose an event from the filter above or pick from the active events below:
            </p>
          </div>

          {tenureFilteredEvents.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto pt-2">
              {tenureFilteredEvents.slice(0, 10).map((evt) => (
                <button
                  key={evt.id || evt.slug}
                  type="button"
                  onClick={() => handleSelectEventOption(evt.id || evt.slug)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-50 hover:bg-[#17458F] hover:text-white text-slate-700 border border-slate-200 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  {evt.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 pt-2">
              No events found in the selected tenure.
            </div>
          )}

          {(!isScopedEventManager || isOwner) && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2">
              <span className="text-xs text-slate-500">Need to update institutional signatures?</span>
              <button
                type="button"
                onClick={() => setActiveTab("signatures")}
                className="text-xs font-bold text-[#17458F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <PenTool className="w-3 h-3 text-indigo-600" />
                Configure Saved Signatures →
              </button>
            </div>
          )}
        </div>
      )}
      {activeTab === "generate" && currentEvent && (
        isScopedEventManager && !canUserManageEvent(currentEvent, adminAccess, user?.btId, allKnownEvents) ? (
          <div className="bg-white rounded-3xl border border-red-200 shadow-xs p-8 sm:p-12 text-center space-y-4 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-lg sm:text-xl text-slate-900">
                Event Certificate Access Restricted
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                You only have management permissions for events belonging to your assigned club ({adminAccess?.clubIds?.join(", ") || "club"}). This event belongs to another entity or central SRC.
              </p>
            </div>
            {scopedAllKnownEvents.length > 0 && (
              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={() => handleSelectEventOption(scopedAllKnownEvents[0].id || scopedAllKnownEvents[0].slug)}
                  className="bg-[#17458F] text-white text-xs"
                >
                  Switch to {scopedAllKnownEvents[0].name}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT 7 COLS: PARTICIPANT SELECTION */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-heading font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#17458F]" />
                    Select Eligible Participants
                  </h3>
                  <p className="text-xs text-slate-500">
                    {filteredParticipants.length} matching recipient{filteredParticipants.length === 1 ? "" : "s"}
                    {allEventRecipients.some((r) => r.teamType === "Team") ? ` (${eventRegistrations.length} squads)` : ""} • {selectedRegIds.size} selected
                  </p>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setParticipantFilter("CHECKED_IN")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      participantFilter === "CHECKED_IN"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Checked-In Only
                  </button>
                  <button
                    onClick={() => setParticipantFilter("ALL")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      participantFilter === "ALL"
                        ? "bg-[#17458F]/10 text-[#17458F] border border-[#17458F]/20"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    All Confirmed
                  </button>
                  <button
                    onClick={() => setParticipantFilter("UNCERTIFIED")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      participantFilter === "UNCERTIFIED"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Uncertified Only
                  </button>
                </div>
              </div>

              {/* Search & Select All */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    placeholder="Search by student name, BT ID, department..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#17458F]"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAllParticipants}
                  className="text-xs shrink-0"
                >
                  {selectedRegIds.size === filteredParticipants.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              {/* Participants Table */}
              <div className="max-h-[380px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
                {filteredParticipants.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No participants found matching this filter.
                  </div>
                ) : (
                  filteredParticipants.map((p) => {
                    const isSelected = selectedRegIds.has(p.uniqueKey);
                    const isAlreadyCertified = isRecipientCertified(p);

                    return (
                      <div
                        key={p.uniqueKey}
                        onClick={() => handleToggleParticipant(p.uniqueKey)}
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          isSelected ? "bg-amber-50/50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div
                            className="rounded text-[#17458F] focus:ring-[#17458F] h-4 w-4"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-xs text-slate-900">
                                {p.name}
                              </p>
                              {p.teamType === "Team" && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                    p.isLeader
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : "bg-slate-100 text-slate-700 border border-slate-200"
                                  }`}
                                >
                                  {p.isLeader ? "Team Leader" : "Teammate"}
                                </span>
                              )}
                              {p.teamName && (
                                <span className="text-[9px] font-medium text-slate-400">
                                  Squad: <span className="font-semibold text-slate-600">{p.teamName}</span>
                                </span>
                              )}
                              {p.status === "CHECKED_IN" && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                  Checked In
                                </span>
                              )}
                              {isAlreadyCertified && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> Certified
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">
                              {p.btId ? (
                                <span className="font-mono text-[#E78023] font-bold mr-1.5">
                                  {p.btId}
                                </span>
                              ) : null}
                              {p.department}{p.email ? ` • ${p.email}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-[10px] text-slate-400 block">
                            {p.ticketCode || p.registrationId.slice(-6)}
                          </span>
                          {p.teamType === "Team" && (
                            <span className="text-[9px] text-slate-400 font-medium">
                              Member #{p.memberIndex + 1}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLS: TEMPLATE CONFIGURATION & SIGNATURES */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="font-heading font-extrabold text-base text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#E78023]" />
                Template Styling
              </h3>

              {/* Certificate Type & Title */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Certificate Type</label>
                  <select
                    value={certType}
                    onChange={(e) => {
                      const t = e.target.value as CertificateType;
                      setCertType(t);
                      if (t === "PARTICIPATION") {
                        setCertTitle("CERTIFICATE OF PARTICIPATION");
                        setCitationTemplate(DEFAULT_CITATION_TEMPLATE);
                      } else if (t === "ACHIEVEMENT") {
                        setCertTitle("CERTIFICATE OF ACHIEVEMENT");
                        setCitationTemplate(DEFAULT_ACHIEVEMENT_CITATION_TEMPLATE);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium"
                  >
                    <option value="PARTICIPATION">1) Participation</option>
                    <option value="ACHIEVEMENT">2) Achievement</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium"
                  />
                </div>
              </div>

              {/* Rank / Position Control (Active for Achievement Certificates) */}
              {certType === "ACHIEVEMENT" && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-amber-950 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-600" />
                      Secured Rank / Position
                    </label>
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                      Token: <code className="font-mono font-bold">&#123;rank&#125;</code>
                    </span>
                  </div>

                  <input
                    type="text"
                    value={rankOrPosition}
                    onChange={(e) => setRankOrPosition(e.target.value)}
                    placeholder="e.g. 1st, 2nd, 3rd, Winner, 1st Runner Up"
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "1st",
                      "2nd",
                      "3rd",
                      "Winner",
                      "1st Runner Up",
                      "2nd Runner Up",
                      "Special Mention",
                      "Consolation",
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRankOrPosition(preset)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                          rankOrPosition === preset
                            ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                            : "bg-white text-slate-700 border-amber-200 hover:bg-amber-100/70"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Certificate Title */}
              <div className="text-xs">
                <label className="font-bold text-slate-700 block mb-1">Pill Banner Title</label>
                <input
                  type="text"
                  value={certTitle}
                  onChange={(e) => setCertTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>

              {/* Citation Template */}
              <div className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 block">
                    Citation Description
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (certType === "ACHIEVEMENT") {
                        setCitationTemplate(DEFAULT_ACHIEVEMENT_CITATION_TEMPLATE);
                      } else {
                        setCitationTemplate(DEFAULT_CITATION_TEMPLATE);
                      }
                    }}
                    className="text-[10px] text-[#17458F] hover:underline font-semibold"
                  >
                    Reset Default Citation
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 font-normal mb-1">
                  Tokens available: <code className="text-slate-600 font-mono">&#123;name&#125;</code>,{" "}
                  <code className="text-amber-600 font-mono">&#123;rank&#125;</code>,{" "}
                  <code className="text-slate-600 font-mono">&#123;event&#125;</code>,{" "}
                  <code className="text-slate-600 font-mono">&#123;date&#125;</code>,{" "}
                  <code className="text-slate-600 font-mono">&#123;department&#125;</code>
                </div>
                <textarea
                  rows={2}
                  value={citationTemplate}
                  onChange={(e) => setCitationTemplate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs leading-relaxed"
                />
              </div>

              {/* Extracted Color Palette Bar & Custom Color Picker */}
              <div className="text-xs space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Poster Theme Color Scheme
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentEvent) return;
                      setIsExtractingColor(true);
                      const poster =
                        currentEvent.posterImage ||
                        currentEvent.poster ||
                        currentEvent.cardImage ||
                        currentEvent.headerImage;
                      if (poster) {
                        extractPosterColorPalette(poster)
                          .then((palette) => {
                            setColorPalette(palette);
                            setIsExtractingColor(false);
                          })
                          .catch(() => setIsExtractingColor(false));
                      } else {
                        setIsExtractingColor(false);
                      }
                    }}
                    className="text-[10px] font-bold text-[#17458F] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isExtractingColor ? "animate-spin" : ""}`} />
                    Re-extract
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Primary Color Picker */}
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                    <input
                      type="color"
                      value={colorPalette.primary}
                      onChange={(e) => {
                        const newHex = e.target.value;
                        setColorPalette(generatePaletteFromBaseHex(newHex));
                      }}
                      className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                      title="Pick Custom Primary Color"
                    />
                    <span className="font-mono text-[10px] text-slate-600 font-bold">
                      {colorPalette.primary}
                    </span>
                  </div>

                  {/* Swatches */}
                  <div
                    className="h-5 w-7 rounded border border-slate-300 shadow-2xs"
                    style={{ backgroundColor: colorPalette.secondary }}
                    title={`Secondary: ${colorPalette.secondary}`}
                  />
                  <div
                    className="h-5 w-7 rounded border border-slate-300 shadow-2xs"
                    style={{ backgroundColor: colorPalette.accent }}
                    title={`Accent: ${colorPalette.accent}`}
                  />
                  <div
                    className="h-5 w-7 rounded border border-slate-300 shadow-2xs"
                    style={{ backgroundColor: colorPalette.pillBg }}
                    title={`Pill: ${colorPalette.pillBg}`}
                  />
                </div>
              </div>

              {/* Club Emblem / Logo Header Configuration */}
              <div className="text-xs space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    Center Club Emblem (Header)
                  </span>
                  {currentEvent?.organizer && (
                    <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[150px]">
                      {currentEvent.organizer}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {clubLogoUrl ? (
                    <div className="relative h-9 w-9 rounded-full overflow-hidden bg-white border border-amber-400 shrink-0 p-0.5">
                      <img
                        src={clubLogoUrl}
                        alt="Club Logo"
                        className="h-full w-full object-contain rounded-full"
                      />
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <Award className="w-4 h-4" />
                    </div>
                  )}

                  <input
                    type="text"
                    value={clubLogoUrl}
                    onChange={(e) => setClubLogoUrl(e.target.value)}
                    placeholder="Club logo URL or upload..."
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />

                  <label
                    className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer text-xs flex items-center gap-1 shrink-0 font-medium transition-colors shadow-2xs"
                    title="Upload club emblem image"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleClubLogoUpload}
                    />
                  </label>

                  {clubLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setClubLogoUrl("")}
                      className="text-slate-400 hover:text-slate-600 p-1"
                      title="Clear Logo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons: Preview & Batch Publish */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenLivePreview}
                  className="flex-1 text-xs"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  Live Preview
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  onClick={handleBatchPublish}
                  disabled={isPublishing || selectedRegIds.size === 0}
                  className="flex-1 text-xs bg-[#17458F] text-white hover:bg-[#0f2e60]"
                >
                  <Award className="w-3.5 h-3.5 mr-1 text-amber-400" />
                  {isPublishing
                    ? `Publishing (${publishProgress?.current || 0}/${publishProgress?.total || 0})...`
                    : `Publish ${selectedRegIds.size} Certs`}
                </Button>
              </div>
            </div>
          </div>
        </div>
        )
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB 2: ISSUED CERTIFICATES TABLE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "issued" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-heading font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#17458F]" />
                Issued Official Credentials ({eventCertificates.length})
              </h3>
              <p className="text-xs text-slate-500">
                All digital certificates published for {currentEvent ? currentEvent.name : (selectedTenureId === "all" ? "all tenures and events" : "all events in selected tenure")}
              </p>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={issuedSearch}
                  onChange={(e) => setIssuedSearch(e.target.value)}
                  placeholder="Search student or cert ID..."
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>

              <select
                value={issuedStatusFilter}
                onChange={(e) => setIssuedStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-100">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="p-3">Credential ID</th>
                  <th className="p-3">Recipient</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Issue Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {eventCertificates
                  .filter((cert) => {
                    if (issuedStatusFilter !== "ALL" && cert.status !== issuedStatusFilter) {
                      return false;
                    }
                    if (issuedSearch.trim()) {
                      const q = issuedSearch.toLowerCase();
                      return (
                        cert.recipientName.toLowerCase().includes(q) ||
                        cert.certificateNumber.toLowerCase().includes(q) ||
                        (cert.recipientBtId || "").toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((cert) => (
                    <tr key={cert.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-[#17458F]">
                        {cert.certificateNumber}
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{cert.recipientName}</p>
                        <p className="text-[10px] text-slate-500">
                          {cert.recipientBtId && (
                            <span className="font-mono text-[#E78023] mr-1">
                              {cert.recipientBtId}
                            </span>
                          )}
                          {cert.recipientDepartment}
                        </p>
                      </td>
                      <td className="p-3 max-w-[160px] truncate">{cert.eventName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {cert.type}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{cert.issueDate}</td>
                      <td className="p-3">
                        {cert.status === "PUBLISHED" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Published
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 flex items-center gap-1 w-fit">
                            <Ban className="w-2.5 h-2.5" /> Revoked
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview */}
                          <button
                            type="button"
                            onClick={() => setPreviewCert(cert)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Inspect Certificate"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Copy URL */}
                          <button
                            type="button"
                            onClick={() => copyVerificationLink(cert.verificationUrl, cert.id)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Copy Public Verification Link"
                          >
                            {copiedId === cert.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Revoke */}
                          {cert.status === "PUBLISHED" && (
                            <button
                              type="button"
                              onClick={() => setRevokingCert(cert)}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                              title="Revoke Credential"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCert(cert.id)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {eventCertificates.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No issued certificates found{currentEvent ? ` for "${currentEvent.name}"` : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB 3: INSTITUTIONAL SAVED SIGNATURES (SINGLE SOURCE OF TRUTH) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "signatures" && (
        isScopedEventManager && !isOwner ? (
          <div className="bg-white rounded-3xl border border-amber-200 shadow-xs p-8 text-center space-y-4 max-w-2xl mx-auto my-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-lg text-slate-900">
                Institutional Clearance Required
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                Institutional Signatures represent central SRC governance (Principal, Dean, Faculty In-Charge, and President) and are managed exclusively by Executive Council Leadership. These signatures are automatically applied to your club&apos;s event certificates.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab("generate")}
              className="text-xs cursor-pointer"
            >
              Return to Certificate Issuance
            </Button>
          </div>
        ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          {/* Header & Truth Declaration */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-2xs">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-lg text-slate-900 flex items-center gap-2">
                    Institutional Signatures
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Single Source of Truth
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    Upload official transparent PNG signatures and configure designations for the 4 institutional signatory slots. Saved signatures are permanently written to Firestore and automatically applied to all newly issued certificates, live preview scans, student dashboard downloads, and cryptographic verification gateways.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetToStandardSignatures}
                className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset Defaults
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveTruthSignatures}
                disabled={isSavingTruthSignatures}
                className="text-xs bg-[#17458F] hover:bg-[#123670] text-white shadow-xs font-bold px-4 py-2 cursor-pointer"
              >
                {isSavingTruthSignatures ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving to Cloud...
                  </>
                ) : truthSignaturesSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
                    Saved to Cloud!
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                    Save as Single Source of Truth
                  </>
                )}
              </Button>
            </div>
          </div>

          {truthSignaturesSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5 shadow-2xs animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Authoritative Signatures Synchronized:</strong> All 4 signature slots have been saved to Firestore and local memory as the persistent single source of truth across the entire platform.
              </span>
            </div>
          )}

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {savedSignatories.map((sig, idx) => {
              const slotMeta = [
                { title: "President, SRC", badge: "Executive Authority", defaultSub: "Session 2026-27" },
                { title: "Faculty Coordinator (1)", badge: "Faculty In-Charge", defaultSub: "SRC, JDCOEM" },
                { title: "Faculty Coordinator (2)", badge: "Faculty In-Charge", defaultSub: "SRC, JDCOEM" },
                { title: "Dean (IQAC)", badge: "Institutional Authority", defaultSub: "IQAC" },
              ][idx] || { title: `Signatory ${idx + 1}`, badge: "Institutional", defaultSub: "" };

              return (
                <div
                  key={sig.id || `truth-sig-${idx}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5 flex flex-col justify-between hover:border-slate-300 hover:shadow-xs transition-all"
                >
                  {/* Slot Header */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        Slot {idx + 1}
                      </span>
                      {sig.signatureImageUrl ? (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> PNG Ready
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" /> Missing PNG
                        </span>
                      )}
                    </div>
                    <div className="pt-1">
                      <h4 className="text-xs font-bold text-slate-900">{slotMeta.title}</h4>
                      <p className="text-[10px] text-slate-400 font-medium">{slotMeta.badge}</p>
                    </div>
                  </div>

                  {/* Visual Signature Preview Box (Checkerboard transparency preview) */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      Signature PNG Preview
                      {sig.signatureImageUrl && (
                        <span className="text-[9px] font-normal text-slate-400">Transparent</span>
                      )}
                    </span>
                    <div
                      className="h-28 rounded-xl border border-slate-200 bg-slate-50 relative flex items-center justify-center p-2 overflow-hidden shadow-inner"
                      style={{
                        backgroundImage:
                          "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
                        backgroundSize: "16px 16px",
                        backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                      }}
                    >
                      {sig.signatureImageUrl ? (
                        <img
                          src={sig.signatureImageUrl}
                          alt={sig.designation || `Signature Slot ${idx + 1}`}
                          className="max-h-20 max-w-[90%] object-contain filter drop-shadow-xs"
                        />
                      ) : (
                        <div className="text-center text-slate-400 p-2">
                          <PenTool className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                          <p className="text-[10px] font-medium">No PNG signature uploaded</p>
                        </div>
                      )}
                    </div>

                    {/* Upload / Replace & Clear buttons */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <label className="flex-1 cursor-pointer px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1 transition-all">
                        <Upload className="w-3 h-3 text-[#17458F]" />
                        {sig.signatureImageUrl ? "Replace PNG" : "Upload PNG"}
                        <input
                          type="file"
                          accept="image/png,image/webp"
                          onChange={(e) => handleSavedSignatureUpload(idx, e)}
                          className="hidden"
                        />
                      </label>
                      {sig.signatureImageUrl && (
                        <button
                          type="button"
                          onClick={() => handleClearSavedSignature(idx)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200 transition-all cursor-pointer"
                          title="Remove signature PNG"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 block uppercase tracking-wider">
                        Printed Designation
                      </label>
                      <input
                        type="text"
                        value={sig.designation}
                        onChange={(e) => handleUpdateSavedSignatory(idx, "designation", e.target.value)}
                        placeholder="e.g. President, SRC"
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-800 focus:outline-none focus:border-[#17458F]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 block uppercase tracking-wider">
                        Subtext / Organization
                      </label>
                      <input
                        type="text"
                        value={sig.organization || ""}
                        onChange={(e) => handleUpdateSavedSignatory(idx, "organization", e.target.value)}
                        placeholder={`e.g. ${slotMeta.defaultSub}`}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 focus:outline-none focus:border-[#17458F]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 block uppercase tracking-wider">
                        Signatory Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={sig.name || ""}
                        onChange={(e) => handleUpdateSavedSignatory(idx, "name", e.target.value)}
                        placeholder="e.g. Dr. Name / Signer"
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 focus:outline-none focus:border-[#17458F]"
                      />
                    </div>
                  </div>

                  {/* Footer Authority Pill */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#17458F]" />
                      Authoritative Slot {idx + 1}
                    </span>
                    <span className="font-mono text-[9px] text-slate-400">1.414:1 Sync</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Callout Bar */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
            <div>
              <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Persistent Cloud Single Source of Truth
              </h4>
              <p className="text-[11px] text-indigo-700 mt-0.5">
                Clicking &quot;Save as Single Source of Truth&quot; stores these 4 signatures in Firestore (`site_content/certificate_settings`) and local storage, immediately serving them to any certificate downloaded by students or scanned via QR.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveTruthSignatures}
              disabled={isSavingTruthSignatures}
              className="text-xs bg-[#17458F] hover:bg-[#123670] text-white shadow-xs font-bold shrink-0 cursor-pointer"
            >
              {isSavingTruthSignatures ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  Save as Single Source of Truth
                </>
              )}
            </Button>
          </div>
        </div>
        )
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4.5 MANUAL / OFFLINE CERTIFICATES MODAL */}
      {/* ------------------------------------------------------------- */}
      <ManualCertificateModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        tenuresList={tenuresList}
        allEvents={scopedAllKnownEvents}
        defaultSignatories={savedSignatories}
        initialTenureId={selectedTenureId !== "all" ? selectedTenureId : undefined}
        initialEventId={
          currentEvent && (!isScopedEventManager || canUserManageEvent(currentEvent, adminAccess, user?.btId, allKnownEvents))
            ? (currentEvent.id || currentEvent.slug)
            : (scopedAllKnownEvents[0]?.id || scopedAllKnownEvents[0]?.slug)
        }
        onSuccessPublished={(count) => {
          setPublishSuccessModal({ count });
        }}
        onOpenLivePreview={(previewPayload) => {
          setPreviewCert(previewPayload);
        }}
      />

      {/* ------------------------------------------------------------- */}
      {/* 5. LIVE PREVIEW / INSPECT MODAL */}
      {/* ------------------------------------------------------------- */}
      {previewCert && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewCert(null)}
          title="Certificate Live Preview"
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="bg-slate-100 p-2 sm:p-4 rounded-2xl overflow-x-auto">
              <CertificateView
                id={`modal-cert-${previewCert.id}`}
                certificate={previewCert}
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Tamper-evident verification URL:{" "}
                <Link
                  href={previewCert.verificationUrl}
                  target="_blank"
                  className="text-[#17458F] font-bold hover:underline"
                >
                  {previewCert.certificateNumber}
                </Link>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => printCertificate()}
                  className="text-xs"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print A4
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    const cleanEvent = (previewCert.eventName || currentEvent?.name || "Event").trim();
                    const cleanRecipient = (previewCert.recipientName || "Student").trim().replace(/\s+/g, "_");
                    downloadCertificateAsImage(
                      `modal-cert-${previewCert.id}`,
                      `SRC-${cleanEvent} Certificate-${cleanRecipient}`
                    );
                  }}
                  className="text-xs bg-[#17458F] text-white"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download 300 DPI PNG
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. REVOCATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {revokingCert && (
        <Modal
          isOpen={true}
          onClose={() => setRevokingCert(null)}
          title="Revoke Official Credential"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs">
              <p className="font-bold">Caution: Public Revocation Stamp</p>
              <p className="mt-0.5">
                Revoking will stamp a red &quot;REVOKED&quot; banner across the public verification
                gateway for certificate <strong>{revokingCert.certificateNumber}</strong>.
              </p>
            </div>

            <div className="text-xs space-y-1">
              <label className="font-bold text-slate-700">Reason for Revocation</label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Erroneous attendance log, administrative reissue..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button size="sm" variant="outline" onClick={() => setRevokingCert(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleConfirmRevoke}
                disabled={isRevoking}
                className="bg-red-600 text-white hover:bg-red-700 text-xs"
              >
                {isRevoking ? "Revoking..." : "Confirm Revocation"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. PUBLISH SUCCESS SUMMARY MODAL */}
      {/* ------------------------------------------------------------- */}
      {publishSuccessModal && (
        <Modal
          isOpen={true}
          onClose={() => setPublishSuccessModal(null)}
          title="Certificates Published Successfully!"
          maxWidth="md"
        >
          <div className="space-y-4 text-center py-4">
            <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-extrabold text-lg text-slate-900">
                {publishSuccessModal.count} Digital Credentials Published
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Certificates have been generated with unique scannable QR verification and are now visible on the recipients&apos; Student Dashboards.
              </p>
            </div>

            <div className="pt-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => setPublishSuccessModal(null)}
                className="bg-[#17458F] text-white text-xs px-6"
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
