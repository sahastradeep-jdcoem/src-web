"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet,
  Eye, 
  CheckCircle2, 
  Clock, 
  QrCode, 
  Users, 
  Sparkles,
  Check,
  ShieldCheck,
  Trash2,
  Inbox,
  CreditCard,
  Receipt,
  BarChart3,
  HelpCircle,
  User,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  ArrowRight,
  Calendar,
  Building2,
  GraduationCap,
  Printer,
  ExternalLink,
  FileText,
  Layers,
  Phone,
  Mail,
  Hash,
  AlertCircle
} from "lucide-react";
import { RegistrationRecord, EventItem, CustomQuestion } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getStoredEvents, syncEventsFromFirestore } from "@/lib/eventsStore";
import { getDepartmentShortName } from "@/lib/departmentsStore";
import { getStoredTenures, syncTenuresFromFirestore, subscribeToTenures, CouncilTenure } from "@/lib/tenureStore";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";
import { 
  checkInStudentPass, 
  getAllRegistrationsFromFirestore, 
  subscribeToRegistrationsFromFirestore, 
  deleteRegistrationFromFirestore,
  subscribeToSiteContent
} from "@/lib/firebase/firestore";

type ActiveTab = "summary" | "question" | "individual" | "table";

export default function AdminRegistrationsPage() {
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [tenuresList, setTenuresList] = useState<CouncilTenure[]>([]);
  const [selectedTenureId, setSelectedTenureId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<ActiveTab>("summary");
  const [selectedEventSlug, setSelectedEventSlug] = useState<string>("all");
  
  // Event Autocomplete & Dropdown filter state
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const eventDropdownRef = useRef<HTMLDivElement | null>(null);
  const optionsListRef = useRef<HTMLDivElement | null>(null);

  // Search & Filters for Table tab
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  
  // Question View State
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  
  // Individual View State (0-indexed responder paging)
  const [individualIndex, setIndividualIndex] = useState(0);
  
  // Modal State
  const [selectedRecord, setSelectedRecord] = useState<RegistrationRecord | null>(null);
  const [checkInNotice, setCheckInNotice] = useState<string | null>(null);

  // Load and sync events & tenures from local store & Firestore
  useEffect(() => {
    setEventsList(getStoredEvents());
    syncEventsFromFirestore().then((evts) => {
      if (evts && evts.length > 0) setEventsList(evts);
    });

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

    const handleEventsUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setEventsList(e.detail);
      } else {
        setEventsList(getStoredEvents());
      }
    };
    window.addEventListener("src_events_updated", handleEventsUpdate);

    const handleClickOutside = (event: MouseEvent) => {
      if (eventDropdownRef.current && !eventDropdownRef.current.contains(event.target as Node)) {
        setIsEventDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      unsubscribeEvents();
      unsubscribeTenures();
      window.removeEventListener("src_events_updated", handleEventsUpdate);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sync event query param from URL on initial client load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const evtParam = params.get("event");
      if (evtParam) {
        setSelectedEventSlug(evtParam);
      }
    }
  }, []);

  const formatRecords = (records: any[]): RegistrationRecord[] => {
    return records.map((r: any) => {
      // Determine the best ISO time string from r.paidAt, r.registeredAt, or r.createdAt
      let fullIsoTime = "";
      if (typeof r.paidAt === "string" && r.paidAt.includes("T")) {
        fullIsoTime = r.paidAt;
      } else if (typeof r.registeredAt === "string" && r.registeredAt.includes("T")) {
        fullIsoTime = r.registeredAt;
      } else if (r.createdAt) {
        if (typeof r.createdAt?.toDate === "function") {
          fullIsoTime = r.createdAt.toDate().toISOString();
        } else if (typeof r.createdAt?.seconds === "number") {
          fullIsoTime = new Date(r.createdAt.seconds * 1000).toISOString();
        } else if (typeof r.createdAt?._seconds === "number") {
          fullIsoTime = new Date(r.createdAt._seconds * 1000).toISOString();
        } else if (typeof r.createdAt === "string" && r.createdAt.includes("T")) {
          fullIsoTime = r.createdAt;
        }
      }

      const cleanRegisteredAt = fullIsoTime || r.registeredAt || (typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString());

      return {
        ...r,
        id: r.id,
        registrationId: r.id,
        eventSlug: r.eventId || r.eventSlug || "",
        eventName: r.eventTitle || r.eventName || "Event Delegate Pass",
        participantName: r.leaderName || r.participantName || "Delegate",
        email: r.email,
        phone: r.phone,
        department: r.department,
        year: r.year,
        teamType: (r.teamSize && r.teamSize > 1) || r.teamType === "Team" ? "Team" : "Individual",
        teamName: r.teamName,
        teamMembers: r.teamMembers ? r.teamMembers.map((m: any) => typeof m === "string" ? m : `${m.name} (${m.btId})`) : r.members?.map((m: any) => typeof m === "string" ? m : m.name),
        registeredAt: cleanRegisteredAt,
        createdAt: r.createdAt || fullIsoTime,
        paidAt: r.paidAt || (cleanRegisteredAt.includes("T") ? cleanRegisteredAt : undefined),
        status: r.status || "CONFIRMED",
        paymentStatus: r.paymentStatus || (r.amountPaid > 0 ? "PAID" : "FREE"),
        paymentId: r.paymentId,
        orderId: r.orderId,
        amountPaid: r.amountPaid || 0,
        ticketCode: r.ticketCode || `${r.id.slice(0, 7)}-TK`,
        qrPayload: r.qrPayload || `SRC:PASS:${r.id}`,
        btId: r.btId,
        customAnswers: r.customAnswers,
      };
    });
  };

  const loadRegistrations = async () => {
    try {
      const localRecords = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      if (Array.isArray(localRecords) && localRecords.length > 0) {
        setRegistrations(formatRecords(localRecords));
      }
    } catch {}

    try {
      const cloud = await getAllRegistrationsFromFirestore();
      if (cloud && cloud.length > 0) {
        setRegistrations(formatRecords(cloud));
      }
    } catch {}
  };

  useEffect(() => {
    loadRegistrations();

    const unsubscribe = subscribeToRegistrationsFromFirestore((cloudRegs) => {
      if (cloudRegs && cloudRegs.length > 0) {
        setRegistrations(formatRecords(cloudRegs));
      }
    });

    const handleStorage = () => loadRegistrations();
    window.addEventListener("storage", handleStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Events available in selected tenure
  const tenureFilteredEvents = useMemo(() => {
    if (selectedTenureId === "all") return eventsList;
    const matchedTenure = tenuresList.find((t) => t.id === selectedTenureId);
    if (!matchedTenure || !matchedTenure.events) return eventsList;
    return matchedTenure.events;
  }, [eventsList, selectedTenureId, tenuresList]);

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
      name: "All Events & Forms",
      category: "Overview",
      count: registrations.length,
      isAll: true,
    };

    const eventOptions = filteredDropdownEvents.map((evt) => ({
      slug: evt.slug,
      name: evt.name,
      category: evt.category || "Event",
      count: registrations.filter(
        (r) =>
          r.eventName.toLowerCase() === evt.name.toLowerCase() ||
          (r.eventSlug && r.eventSlug.toLowerCase() === evt.slug.toLowerCase())
      ).length,
      isAll: false,
    }));

    return [allOption, ...eventOptions];
  }, [filteredDropdownEvents, registrations]);

  // Keep highlighted index in sync when search changes
  useEffect(() => {
    if (eventSearchQuery.trim() && selectableEventOptions.length > 1) {
      setHighlightedIndex(1); // highlight the first matching event
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

  const handleSelectEventOption = (slug: string) => {
    setSelectedEventSlug(slug);
    setIsEventDropdownOpen(false);
    setEventSearchQuery("");
    setIndividualIndex(0);
  };

  const handleEventInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isEventDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsEventDropdownOpen(true);
        setHighlightedIndex(selectableEventOptions.length > 1 && selectedEventSlug !== "all" ? 1 : 0);
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
      if (selectableEventOptions[highlightedIndex]) {
        handleSelectEventOption(selectableEventOptions[highlightedIndex].slug);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEventDropdownOpen(false);
    }
  };

  // Current active event object (if filtered to a specific event)
  const currentSelectedEventObj = useMemo(() => {
    if (selectedEventSlug === "all") return null;
    return (
      eventsList.find(
        (e) =>
          e.slug.toLowerCase() === selectedEventSlug.toLowerCase() ||
          e.name.toLowerCase() === selectedEventSlug.toLowerCase() ||
          e.id.toLowerCase() === selectedEventSlug.toLowerCase()
      ) || null
    );
  }, [selectedEventSlug, eventsList]);

  // Filter registrations by currently selected tenure & event
  const eventRegistrations = useMemo(() => {
    let list = registrations;

    // Filter by tenure
    if (selectedTenureId !== "all") {
      const tenureEvents = tenuresList.find((t) => t.id === selectedTenureId)?.events || [];
      const tenureEventSlugs = new Set(tenureEvents.map((e) => e.slug.toLowerCase()));
      const tenureEventNames = new Set(tenureEvents.map((e) => e.name.toLowerCase()));

      list = list.filter((r: any) => {
        if (r.tenureId && r.tenureId === selectedTenureId) return true;
        const eSlug = (r.eventSlug || r.eventId || "").toLowerCase();
        const eName = (r.eventName || "").toLowerCase();
        return tenureEventSlugs.has(eSlug) || tenureEventNames.has(eName);
      });
    }

    // Filter by event
    if (selectedEventSlug !== "all") {
      list = list.filter((r) => {
        return (
          r.eventName.toLowerCase() === selectedEventSlug.toLowerCase() ||
          (r.eventSlug && r.eventSlug.toLowerCase() === selectedEventSlug.toLowerCase()) ||
          (currentSelectedEventObj && r.eventName.toLowerCase() === currentSelectedEventObj.name.toLowerCase())
        );
      });
    }

    return list;
  }, [registrations, selectedEventSlug, selectedTenureId, currentSelectedEventObj, tenuresList]);

  // Export Excel button is enabled only after selecting a specific event filter
  const isExportDisabled = selectedEventSlug === "all" || eventRegistrations.length === 0;

  // Filtered registrations for the Table tab (with search & status)
  const tableFilteredRegistrations = useMemo(() => {
    return eventRegistrations.filter((r) => {
      const matchesSearch =
        r.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.registrationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.btId && r.btId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "All" || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [eventRegistrations, searchQuery, statusFilter]);

  // Summary Metrics for the active event scope
  const metrics = useMemo(() => {
    const total = eventRegistrations.length;
    const checkedIn = eventRegistrations.filter((r) => r.status === "CHECKED_IN").length;
    const revenue = eventRegistrations.reduce((sum, r) => sum + (r.amountPaid || 0), 0);
    const paidCount = eventRegistrations.filter((r) => r.paymentStatus === "PAID").length;
    const teamCount = eventRegistrations.filter((r) => r.teamType === "Team").length;
    const soloCount = total - teamCount;

    // Department breakdown
    const depts: Record<string, number> = {};
    eventRegistrations.forEach((r) => {
      const d = r.department || "Unspecified";
      depts[d] = (depts[d] || 0) + 1;
    });

    // Year breakdown
    const years: Record<string, number> = {};
    eventRegistrations.forEach((r) => {
      const y = r.year || "Unspecified";
      years[y] = (years[y] || 0) + 1;
    });

    return {
      total,
      checkedIn,
      checkedInPct: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
      revenue,
      paidCount,
      freeCount: total - paidCount,
      teamCount,
      soloCount,
      departments: Object.entries(depts).sort((a, b) => b[1] - a[1]),
      years: Object.entries(years).sort((a, b) => b[1] - a[1]),
    };
  }, [eventRegistrations]);

  // Helper to format question types into friendly display labels
  const getQuestionTypeLabel = (type?: string) => {
    switch (type) {
      case "short_text": return "Short Answer";
      case "long_text": return "Paragraph";
      case "multiple_choice": return "Multiple Choice";
      case "checkboxes": return "Checkboxes";
      case "dropdown": return "Dropdown";
      default: return "Custom Field";
    }
  };

  // Helper to extract clean answer string/array
  const getAnswerValue = (raw: any): any => {
    if (raw === undefined || raw === null) return "";
    if (typeof raw === "object" && !Array.isArray(raw)) {
      if ("value" in raw) return raw.value;
      if ("answer" in raw) return raw.answer;
    }
    return raw;
  };

  // Build a comprehensive Question Meta Map from eventsList and registration records
  const questionMetaMap = useMemo(() => {
    const map = new Map<string, { id: string; question: string; type: string; options?: string[]; eventName?: string }>();
    
    // 1. Map from all loaded events
    eventsList.forEach((evt) => {
      if (evt.customQuestions && Array.isArray(evt.customQuestions)) {
        evt.customQuestions.forEach((q) => {
          if (q && q.id) {
            map.set(q.id, {
              id: q.id,
              question: q.question || "Custom Question",
              type: q.type || "short_text",
              options: q.options || [],
              eventName: evt.name,
            });
          }
        });
      }
    });

    // 2. Scan all registrations for any embedded question definitions
    registrations.forEach((r) => {
      if (r.customAnswers && typeof r.customAnswers === "object") {
        Object.entries(r.customAnswers).forEach(([k, v]) => {
          if (v && typeof v === "object" && "question" in v) {
            const qTitle = (v as any).question;
            if (qTitle && !qTitle.startsWith("q-")) {
              map.set(k, {
                id: k,
                question: qTitle,
                type: (v as any).type || "short_text",
                options: (v as any).options || [],
                eventName: r.eventName,
              });
            }
          }
        });
      }
    });

    return map;
  }, [eventsList, registrations]);

  // Robust Resolver: extracts clean title, type, and options for any question key
  const getQuestionInfo = (key: string, eventName?: string, r?: RegistrationRecord) => {
    // 1. Check if structured inside registration
    if (r?.customAnswers && typeof r.customAnswers[key] === "object" && r.customAnswers[key] !== null) {
      const obj = r.customAnswers[key] as any;
      if (obj.question && !obj.question.startsWith("q-")) {
        return {
          id: key,
          title: obj.question,
          type: obj.type || "short_text",
          options: obj.options || [],
        };
      }
    }

    // 2. Check questionMetaMap
    const meta = questionMetaMap.get(key);
    if (meta && meta.question && !meta.question.startsWith("q-")) {
      return {
        id: key,
        title: meta.question,
        type: meta.type,
        options: meta.options || [],
      };
    }

    // 3. Search across all eventsList
    for (const evt of eventsList) {
      if (evt.customQuestions) {
        const found = evt.customQuestions.find((q) => q.id === key);
        if (found && found.question && !found.question.startsWith("q-")) {
          return {
            id: key,
            title: found.question,
            type: found.type,
            options: found.options || [],
          };
        }
      }
    }

    // 4. If key is already human-readable text
    if (!key.startsWith("q-")) {
      return {
        id: key,
        title: key,
        type: "short_text",
        options: [],
      };
    }

    // 5. Match by event positional index if event is known
    const targetEvtName = eventName || selectedEventSlug;
    if (targetEvtName && targetEvtName !== "all") {
      const evt = eventsList.find((e) => e.name.toLowerCase() === targetEvtName.toLowerCase() || e.slug.toLowerCase() === targetEvtName.toLowerCase());
      if (evt?.customQuestions && evt.customQuestions.length > 0) {
        const idx = evt.customQuestions.findIndex((q) => q.id === key);
        if (idx !== -1) {
          const q = evt.customQuestions[idx];
          return { id: key, title: q.question, type: q.type, options: q.options || [] };
        }
        // If question count matches single custom question
        if (evt.customQuestions.length === 1) {
          const q = evt.customQuestions[0];
          return { id: key, title: q.question, type: q.type, options: q.options || [] };
        }
      }
    }

    // 6. Friendly fallback label
    return {
      id: key,
      title: "Event Participant Response",
      type: "short_text",
      options: [],
    };
  };

  // Questions available for the Question tab & Summary custom questions
  const availableQuestions = useMemo(() => {
    const questions: {
      id: string;
      title: string;
      type: string;
      options?: string[];
      isStandard?: boolean;
    }[] = [
      { id: "participantName", title: "Full Name & BT ID", type: "short_text", isStandard: true },
      { id: "department", title: "Department / Branch", type: "dropdown", isStandard: true },
      { id: "year", title: "Academic Year", type: "dropdown", isStandard: true },
      { id: "teamType", title: "Participation Format", type: "multiple_choice", options: ["Individual", "Team"], isStandard: true },
      { id: "paymentStatus", title: "Payment & Pass Status", type: "multiple_choice", options: ["FREE", "PAID"], isStandard: true },
    ];

    // If a specific event is selected and has defined custom questions
    if (currentSelectedEventObj?.customQuestions && currentSelectedEventObj.customQuestions.length > 0) {
      currentSelectedEventObj.customQuestions.forEach((q) => {
        if (q.type !== "note") {
          questions.push({
            id: q.id,
            title: q.question || "Custom Question",
            type: q.type,
            options: q.options || [],
            isStandard: false,
          });
        }
      });
    } else {
      // Find all custom question IDs that exist across any registration in the current scope
      const customKeyMap = new Map<string, { id: string; title: string; type: string; options?: string[] }>();
      eventRegistrations.forEach((r) => {
        if (r.customAnswers) {
          Object.keys(r.customAnswers).forEach((k) => {
            if (!customKeyMap.has(k)) {
              const info = getQuestionInfo(k, r.eventName, r);
              customKeyMap.set(k, {
                id: k,
                title: info.title,
                type: info.type,
                options: info.options,
              });
            }
          });
        }
      });
      customKeyMap.forEach((qInfo) => {
        questions.push({
          ...qInfo,
          isStandard: false,
        });
      });
    }

    return questions;
  }, [currentSelectedEventObj, eventRegistrations, questionMetaMap, eventsList]);

  // Question aggregation helper for the active question in Question Tab & Summary
  const getQuestionAggregation = (q: { id: string; title: string; type: string; options?: string[]; isStandard?: boolean }) => {
    const responses: { respondent: RegistrationRecord; answer: any }[] = [];
    const optionCounts: Record<string, { count: number; respondents: RegistrationRecord[] }> = {};

    const isChoice = q.type === "multiple_choice" || q.type === "checkboxes" || q.type === "dropdown";

    if (q.options && isChoice) {
      q.options.forEach((opt) => {
        optionCounts[opt] = { count: 0, respondents: [] };
      });
    }

    eventRegistrations.forEach((r) => {
      let rawVal: any = undefined;
      if (q.isStandard) {
        rawVal = (r as any)[q.id];
      } else if (r.customAnswers) {
        rawVal = r.customAnswers[q.id];
      }

      const val = getAnswerValue(rawVal);

      if (val !== undefined && val !== null && val !== "") {
        responses.push({ respondent: r, answer: val });

        if (isChoice) {
          if (Array.isArray(val)) {
            val.forEach((item) => {
              if (!optionCounts[item]) {
                optionCounts[item] = { count: 0, respondents: [] };
              }
              optionCounts[item].count += 1;
              optionCounts[item].respondents.push(r);
            });
          } else {
            const strVal = String(val);
            if (!optionCounts[strVal]) {
              optionCounts[strVal] = { count: 0, respondents: [] };
            }
            optionCounts[strVal].count += 1;
            optionCounts[strVal].respondents.push(r);
          }
        }
      }
    });

    return {
      totalAnswered: responses.length,
      responses,
      isChoice,
      optionCounts: Object.entries(optionCounts).sort((a, b) => b[1].count - a[1].count),
    };
  };

  const handleGateCheckIn = async (record: RegistrationRecord) => {
    await checkInStudentPass(record.registrationId);
    setRegistrations((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, status: "CHECKED_IN" as any } : r))
    );
    if (selectedRecord && selectedRecord.id === record.id) {
      setSelectedRecord({ ...selectedRecord, status: "CHECKED_IN" as any });
    }
    setCheckInNotice(`Verified & Checked-In: ${record.participantName} (${record.registrationId})`);
    setTimeout(() => setCheckInNotice(null), 4000);
  };

  const handleDeleteRegistration = async (regId: string, name: string) => {
    if (confirm(`Delete registration record for "${name}" (${regId})?`)) {
      try {
        await deleteRegistrationFromFirestore(regId);
        setRegistrations((prev) => prev.filter((r) => r.id !== regId && r.registrationId !== regId));
        if (selectedRecord && (selectedRecord.id === regId || selectedRecord.registrationId === regId)) {
          setSelectedRecord(null);
        }
        setCheckInNotice(`Deleted registration for ${name} (${regId}).`);
        setTimeout(() => setCheckInNotice(null), 4000);
      } catch (e) {
        console.error("Error deleting registration", e);
        alert("Failed to delete registration from cloud. Please try again.");
      }
    }
  };

  const handleClearAll = () => {
    const label = selectedEventSlug === "all" ? "ALL registrations" : `all registrations for ${selectedEventSlug}`;
    if (confirm(`Are you sure you want to delete ${label}? This cannot be undone.`)) {
      if (selectedEventSlug === "all") {
        localStorage.removeItem("src_local_registrations");
        setRegistrations([]);
      } else {
        setRegistrations((prev) => prev.filter((r) => r.eventName.toLowerCase() !== selectedEventSlug.toLowerCase()));
      }
    }
  };

  const formatGoogleFormsTimestamp = (r: any): string => {
    const candidates = [
      r.paidAt,
      r.createdAt,
      r.registeredAt,
      r.timestamp,
    ];

    let dateObj: Date | null = null;

    for (const val of candidates) {
      if (!val) continue;

      // 1. Firestore Timestamp instance
      if (typeof val?.toDate === "function") {
        const d = val.toDate();
        if (!isNaN(d.getTime())) {
          dateObj = d;
          break;
        }
      }

      // 2. Firestore Timestamp raw object
      if (typeof val?.seconds === "number") {
        const d = new Date(val.seconds * 1000 + (val.nanoseconds ? val.nanoseconds / 1000000 : 0));
        if (!isNaN(d.getTime())) {
          dateObj = d;
          break;
        }
      }
      if (typeof val?._seconds === "number") {
        const d = new Date(val._seconds * 1000 + (val._nanoseconds ? val._nanoseconds / 1000000 : 0));
        if (!isNaN(d.getTime())) {
          dateObj = d;
          break;
        }
      }

      // 3. Numeric timestamp (epoch ms or s)
      if (typeof val === "number") {
        const d = new Date(val > 1e11 ? val : val * 1000);
        if (!isNaN(d.getTime())) {
          dateObj = d;
          break;
        }
      }
      if (typeof val === "string" && /^\d{10,13}$/.test(val.trim())) {
        const num = Number(val.trim());
        const d = new Date(num > 1e11 ? num : num * 1000);
        if (!isNaN(d.getTime())) {
          dateObj = d;
          break;
        }
      }

      // 4. ISO string containing time (e.g. 2026-09-02T19:45:00.000Z)
      if (typeof val === "string" && val.includes("T")) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          dateObj = d;
          break;
        }
      }

      // 5. String with time colon ":"
      if (typeof val === "string" && val.includes(":")) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          dateObj = d;
          break;
        }
      }
    }

    // 6. If only date-only string was found (e.g. "2026-09-02"), parse without UTC midnight shift
    if (!dateObj) {
      for (const val of candidates) {
        if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
          const parts = val.trim().split("-");
          dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          break;
        }
      }
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }

    // Format in standard Google Forms / Excel format: M/D/YYYY HH:MM:SS
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    const seconds = String(dateObj.getSeconds()).padStart(2, "0");

    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const generateExportData = () => {
    // Collect all custom questions across the current scope
    const customQCols = availableQuestions.filter((q) => !q.isStandard);

    // Check if there are any paid registrations in this export scope
    const hasAnyPaid = eventRegistrations.some(
      (r) => (r.amountPaid && r.amountPaid > 0) || r.paymentStatus === "PAID" || (r.paymentId && r.paymentId !== "N/A")
    );

    // Check if there are any team registrations in this export scope
    const hasAnyTeam = eventRegistrations.some(
      (r) => r.teamType === "Team" || Boolean(r.teamName) || (Array.isArray(r.teamMembers) && r.teamMembers.length > 0)
    );

    const sanitizeExcelCell = (val: any): any => {
      if (typeof val === "number" || typeof val === "boolean") return val;
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        return `'${str}`;
      }
      return str;
    };

    const rows = eventRegistrations.map((r) => {
      const rowData: Record<string, any> = {
        "Timestamp": sanitizeExcelCell(formatGoogleFormsTimestamp(r)),
        "Email Address": sanitizeExcelCell(r.email || ""),
        "Full Name": sanitizeExcelCell(r.participantName || ""),
        "College BT ID": sanitizeExcelCell(r.btId || ""),
        "WhatsApp Contact": sanitizeExcelCell(r.phone || ""),
        "Department / Branch": sanitizeExcelCell(r.department || ""),
        "Academic Year": sanitizeExcelCell(r.year || ""),
        "Event": sanitizeExcelCell(r.eventName || ""),
        "Participation Format": sanitizeExcelCell(r.teamType || "Individual"),
      };

      if (hasAnyTeam) {
        rowData["Team Name"] = sanitizeExcelCell(r.teamName || "");
        rowData["Team Members"] = sanitizeExcelCell(Array.isArray(r.teamMembers) ? r.teamMembers.join("; ") : (r.teamMembers || ""));
      }

      // Each custom question gets its OWN dedicated column with its exact prompt text as header
      customQCols.forEach((qCol) => {
        let answer: any = "";
        if (r.customAnswers) {
          if (r.customAnswers[qCol.id] !== undefined) {
            answer = getAnswerValue(r.customAnswers[qCol.id]);
          } else {
            for (const [k, v] of Object.entries(r.customAnswers)) {
              const info = getQuestionInfo(k, r.eventName, r);
              if (info.title.toLowerCase() === qCol.title.toLowerCase() || k === qCol.id) {
                answer = getAnswerValue(v);
                break;
              }
            }
          }
        }
        const formattedAnswer = Array.isArray(answer) ? answer.join(", ") : String(answer ?? "");
        rowData[qCol.title] = sanitizeExcelCell(formattedAnswer);
      });

      rowData["Registration Pass ID"] = sanitizeExcelCell(r.registrationId);
      rowData["Ticket Code"] = sanitizeExcelCell(r.ticketCode || `${r.registrationId}-TK`);
      rowData["Pass Status"] = sanitizeExcelCell(r.status || "CONFIRMED");

      // Only include payment tracking columns if the event is a paid event or contains paid registrations
      if (hasAnyPaid) {
        rowData["Payment Status"] = sanitizeExcelCell(r.paymentStatus || "FREE");
        rowData["Amount Paid (INR)"] = Number(r.amountPaid) || 0;
        rowData["Payment Transaction ID"] = sanitizeExcelCell(r.paymentId || "N/A");
        rowData["Order ID"] = sanitizeExcelCell(r.orderId || "N/A");
      }

      return rowData;
    });

    return { rows, customQCols };
  };

  const handleExportExcel = async () => {
    if (eventRegistrations.length === 0) {
      alert("No registrations available to export.");
      return;
    }
    const XLSX = await import("xlsx");
    const { rows } = generateExportData();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-fit column widths for clear spreadsheet viewing
    const colKeys = Object.keys(rows[0] || {});
    ws["!cols"] = colKeys.map((k) => {
      const maxLen = Math.max(
        k.length,
        ...rows.map((r) => String(r[k] !== undefined && r[k] !== null ? r[k] : "").length)
      );
      return { wch: Math.min(Math.max(maxLen + 4, 12), 48) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Form Responses");
    const filenameSlug = selectedEventSlug === "all" ? "All_Events" : selectedEventSlug.replace(/\s+/g, "_");
    XLSX.writeFile(wb, `SRC_${filenameSlug}_Responses_${Date.now()}.xlsx`);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Safe current individual respondent
  const currentIndividual = eventRegistrations[individualIndex] || null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A] font-sans pb-16">
      
      {/* Top Header */}
      <div className="pb-1 border-b border-slate-200/60">
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
          REGISTRATION &amp; RESPONSES STUDIO
        </h1>
      </div>

      {/* FILTER MENU BAR */}
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
                  setSelectedTenureId(e.target.value);
                  setIndividualIndex(0);
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
                    : selectedEventSlug === "all"
                    ? ""
                    : (eventsList.find(e => e.slug.toLowerCase() === selectedEventSlug.toLowerCase() || e.name.toLowerCase() === selectedEventSlug.toLowerCase())?.name || selectedEventSlug)
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
                placeholder={selectedEventSlug === "all" ? "Search event (use ↑↓ keys & Enter)..." : "Change event (use ↑↓ keys & Enter)..."}
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#17458F] shadow-2xs"
              />
              {selectedEventSlug !== "all" ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEventSlug("all");
                    setEventSearchQuery("");
                    setIsEventDropdownOpen(false);
                    setIndividualIndex(0);
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
                    ? selectedEventSlug === "all" 
                    : (selectedEventSlug.toLowerCase() === opt.slug.toLowerCase() || selectedEventSlug.toLowerCase() === opt.name.toLowerCase());

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

        {/* Right Corner: Export Excel Button (Enabled only after selecting filter) */}
        <div className="pt-1 md:pt-0 flex items-end">
          <Button
            onClick={handleExportExcel}
            disabled={isExportDisabled}
            variant="primary"
            size="md"
            className={`gap-2 transition-all font-bold ${
              isExportDisabled
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50 shadow-none hover:bg-slate-100"
                : "bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm cursor-pointer"
            }`}
            title={
              isExportDisabled
                ? "Select an event filter to enable Excel export"
                : `Download Excel (.xlsx) responses for ${currentSelectedEventObj?.name || selectedEventSlug}`
            }
          >
            <FileSpreadsheet className={`w-4 h-4 ${isExportDisabled ? "text-slate-400" : "text-emerald-100"}`} />
            <span>Export Excel (.xlsx)</span>
          </Button>
        </div>

      </div>

      {/* Notice Toast */}
      {checkInNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{checkInNotice}</span>
        </div>
      )}

      {/* GOOGLE FORMS STYLE 4-TAB NAVIGATION */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs">
        {[
          { id: "summary", label: "Summary", icon: BarChart3, badge: `${eventRegistrations.length}` },
          { id: "question", label: "Question", icon: HelpCircle, badge: `${availableQuestions.length} Qs` },
          { id: "individual", label: "Individual", icon: User, badge: eventRegistrations.length > 0 ? `${individualIndex + 1} of ${eventRegistrations.length}` : "0" },
          { id: "table", label: "Spreadsheet / Ledger", icon: TableIcon, badge: `${tableFilteredRegistrations.length}` },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isActive
                  ? "bg-[#17458F] text-white shadow-sm font-heading"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[#E78023]" : "text-slate-400"}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SUMMARY (ANALYTICS & AGGREGATE Q&N BREAKDOWNS) */}
      {/* ========================================================================= */}
      {activeTab === "summary" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* Key Metrics Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Total Registrations
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-heading font-extrabold text-2xl text-[#17458F]">
                  {metrics.total}
                </span>
                <span className="text-xs text-slate-500 font-semibold">Passes Issued</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Gate Checked-In
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-heading font-extrabold text-2xl text-emerald-600">
                  {metrics.checkedIn}
                </span>
                <span className="text-xs text-emerald-700 font-semibold">
                  {metrics.checkedInPct}% Verified
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-2">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${metrics.checkedInPct}%` }}
                />
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Revenue (Razorpay)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-heading font-extrabold text-2xl text-[#E78023]">
                  ₹{metrics.revenue.toLocaleString("en-IN")}
                </span>
                <span className="text-xs text-slate-500 font-semibold">{metrics.paidCount} Paid</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Participation Format
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-heading font-extrabold text-2xl text-slate-800">
                  {metrics.soloCount} / {metrics.teamCount}
                </span>
                <span className="text-xs text-slate-500 font-semibold">Solo / Squads</span>
              </div>
            </div>
          </div>

          {metrics.total === 0 ? (
            <div className="p-16 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                <Inbox className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-base text-slate-800">
                  No Responses Recorded Yet
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When students register for this event, response distributions, bar graphs, and individual forms will automatically render here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Department Breakdown Card */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#17458F]" />
                    <h3 className="font-heading font-bold text-sm text-slate-900 uppercase">
                      Department Distribution
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    {metrics.departments.length} Branches
                  </span>
                </div>

                <div className="space-y-3">
                  {metrics.departments.map(([dept, count]) => {
                    const pct = Math.round((count / metrics.total) * 100);
                    return (
                      <div key={dept} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-800">{dept}</span>
                          <span className="text-slate-500 font-mono">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#17458F] h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Academic Year Breakdown Card */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-[#E78023]" />
                    <h3 className="font-heading font-bold text-sm text-slate-900 uppercase">
                      Academic Year Distribution
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    {metrics.years.length} Cohorts
                  </span>
                </div>

                <div className="space-y-3">
                  {metrics.years.map(([year, count]) => {
                    const pct = Math.round((count / metrics.total) * 100);
                    return (
                      <div key={year} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-800">{year}</span>
                          <span className="text-slate-500 font-mono">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#E78023] h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Questions Breakdown Cards */}
              {availableQuestions
                .filter((q) => !q.isStandard)
                .map((q, idx) => {
                  const agg = getQuestionAggregation(q);
                  return (
                    <div
                      key={q.id}
                      className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 lg:col-span-2"
                    >
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-[#E78023] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              Q{idx + 1}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {getQuestionTypeLabel(q.type)}
                            </span>
                          </div>
                          <h4 className="font-heading font-extrabold text-base text-[#17458F]">
                            {q.title}
                          </h4>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full shrink-0">
                          {agg.totalAnswered} Responses
                        </span>
                      </div>

                      {/* Options breakdown with percentage bars if choice question */}
                      {agg.isChoice && agg.optionCounts.length > 0 ? (
                        <div className="space-y-3 pt-2">
                          {agg.optionCounts.map(([opt, data]) => {
                            const pct = agg.totalAnswered > 0 ? Math.round((data.count / agg.totalAnswered) * 100) : 0;
                            return (
                              <div key={opt} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span className="text-slate-800">{opt}</span>
                                  <span className="text-slate-500 font-mono">
                                    {data.count} ({pct}%)
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                  <div
                                    className="bg-[#17458F] h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Text responses feed */
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {agg.responses.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">No responses recorded yet.</p>
                          ) : (
                            agg.responses.map((item, respIdx) => (
                              <div
                                key={respIdx}
                                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-slate-900">
                                    {item.respondent.participantName}
                                  </span>
                                  <span className="font-mono text-[10px] text-[#E78023] font-bold">
                                    {item.respondent.btId || item.respondent.registrationId}
                                  </span>
                                </div>
                                <p className="text-slate-800 leading-relaxed font-medium">
                                  {Array.isArray(item.answer) ? item.answer.join(", ") : String(item.answer)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: QUESTION (QUESTION BY QUESTION INSPECTION) */}
      {/* ========================================================================= */}
      {activeTab === "question" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {availableQuestions.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center">
              <p className="text-xs text-slate-500">No questions available for this form.</p>
            </div>
          ) : (
            <>
              {/* Question Navigation Bar */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    disabled={selectedQuestionIndex === 0}
                    onClick={() => setSelectedQuestionIndex((prev) => Math.max(0, prev - 1))}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <select
                    value={selectedQuestionIndex}
                    onChange={(e) => setSelectedQuestionIndex(Number(e.target.value))}
                    className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer"
                  >
                    {availableQuestions.map((q, idx) => (
                      <option key={q.id} value={idx}>
                        Q{idx + 1}: {q.title}
                      </option>
                    ))}
                  </select>

                  <button
                    disabled={selectedQuestionIndex === availableQuestions.length - 1}
                    onClick={() => setSelectedQuestionIndex((prev) => Math.min(availableQuestions.length - 1, prev + 1))}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-xs font-mono font-bold text-slate-500">
                  Question {selectedQuestionIndex + 1} of {availableQuestions.length}
                </span>
              </div>

              {/* Active Question Response Card */}
              {(() => {
                const currentQ = availableQuestions[selectedQuestionIndex];
                if (!currentQ) return null;
                const agg = getQuestionAggregation(currentQ);

                return (
                  <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
                    <div className="border-b border-slate-100 pb-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="orange" size="sm">
                          Question {selectedQuestionIndex + 1}
                        </Badge>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {getQuestionTypeLabel(currentQ.type)}
                        </span>
                      </div>
                      <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-[#17458F]">
                        {currentQ.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium font-mono">
                        {agg.totalAnswered} of {eventRegistrations.length} delegates responded
                      </p>
                    </div>

                    {/* Grouped Responses if Choice Question */}
                    {agg.isChoice && agg.optionCounts.length > 0 ? (
                      <div className="space-y-4">
                        {agg.optionCounts.map(([optionText, optData]) => (
                          <div
                            key={optionText}
                            className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-slate-900">
                                {optionText}
                              </span>
                              <span className="text-xs font-mono font-bold text-[#E78023] bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                {optData.count} Responses
                              </span>
                            </div>

                            {/* Respondent pills */}
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              {optData.respondents.map((resp) => (
                                <button
                                  key={resp.id}
                                  onClick={() => {
                                    const foundIdx = eventRegistrations.findIndex((r) => r.id === resp.id);
                                    if (foundIdx !== -1) {
                                      setIndividualIndex(foundIdx);
                                      setActiveTab("individual");
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-medium text-slate-700 hover:border-[#17458F] hover:text-[#17458F] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                >
                                  <span>{resp.participantName}</span>
                                  {resp.btId && (
                                    <span className="font-mono text-[9px] text-[#E78023]">
                                      ({resp.btId})
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Flat response stream */
                      <div className="space-y-3">
                        {agg.responses.map((item, i) => (
                          <div
                            key={i}
                            className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900">
                                  {item.respondent.participantName}
                                </span>
                                {item.respondent.btId && (
                                  <span className="font-mono text-[10px] text-[#E78023] font-bold">
                                    {item.respondent.btId}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-700 font-medium">
                                {Array.isArray(item.answer) ? item.answer.join(", ") : String(item.answer)}
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                const foundIdx = eventRegistrations.findIndex((r) => r.id === item.respondent.id);
                                if (foundIdx !== -1) {
                                  setIndividualIndex(foundIdx);
                                  setActiveTab("individual");
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-[#17458F] hover:text-white text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0"
                            >
                              View Individual Pass
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INDIVIDUAL (GOOGLE FORMS 1-OF-N RESPONDER VIEW) */}
      {/* ========================================================================= */}
      {activeTab === "individual" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {eventRegistrations.length === 0 ? (
            <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-2">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">No individual submissions found.</p>
            </div>
          ) : (
            <>
              {/* Responder Paging Navigation Bar */}
              <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    disabled={individualIndex === 0}
                    onClick={() => setIndividualIndex((prev) => Math.max(0, prev - 1))}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                    title="Previous Responder"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <select
                    value={individualIndex}
                    onChange={(e) => setIndividualIndex(Number(e.target.value))}
                    className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F] cursor-pointer max-w-xs truncate"
                  >
                    {eventRegistrations.map((r, idx) => (
                      <option key={r.id} value={idx}>
                        #{idx + 1}: {r.participantName} ({r.btId || r.registrationId})
                      </option>
                    ))}
                  </select>

                  <button
                    disabled={individualIndex === eventRegistrations.length - 1}
                    onClick={() => setIndividualIndex((prev) => Math.min(eventRegistrations.length - 1, prev + 1))}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition-all cursor-pointer"
                    title="Next Responder"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Individual Action Controls */}
                {currentIndividual && (
                  <div className="flex items-center gap-2">
                    {currentIndividual.status !== "CHECKED_IN" ? (
                      <Button
                        onClick={() => handleGateCheckIn(currentIndividual)}
                        variant="primary"
                        size="sm"
                        className="gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Gate Check-In</span>
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Checked-In</span>
                      </span>
                    )}

                    <button
                      onClick={() => handleDeleteRegistration(currentIndividual.id, currentIndividual.participantName)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                      title="Delete this submission"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Detailed Individual Response Sheet */}
              {currentIndividual && (
                <div className="p-6 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-8">
                  
                  {/* Event & Registration Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#E78023]">
                        Verified Delegate Pass
                      </span>
                      <h2 className="font-heading font-extrabold text-2xl text-[#17458F]">
                        {currentIndividual.eventName}
                      </h2>
                      <p className="text-xs text-slate-500 font-mono font-semibold">
                        Reg ID: {currentIndividual.registrationId} • Code: {currentIndividual.ticketCode}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={currentIndividual.status === "CHECKED_IN" ? "success" : "orange"}
                        size="md"
                      >
                        {currentIndividual.status}
                      </Badge>
                      <Badge
                        variant={currentIndividual.paymentStatus === "PAID" ? "navy" : "slate"}
                        size="md"
                      >
                        {currentIndividual.paymentStatus === "PAID" ? `PAID • ₹${currentIndividual.amountPaid}` : "FREE PASS"}
                      </Badge>
                    </div>
                  </div>

                  {/* Top Credentials & QR Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* QR Code Pass */}
                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3 flex flex-col items-center justify-center">
                      <div className="bg-white p-2 rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                        <ScannableQRCode
                          value={
                            typeof window !== "undefined"
                              ? `${window.location.origin}/verify/${encodeURIComponent(currentIndividual.registrationId)}`
                              : `https://src-jdcoem.vercel.app/verify/${encodeURIComponent(currentIndividual.registrationId)}`
                          }
                          size={120}
                          level="H"
                          includeMargin={true}
                          renderAs="canvas"
                        />
                      </div>
                      <span className="font-mono text-xs font-bold text-[#E78023] block">
                        {currentIndividual.ticketCode}
                      </span>
                    </div>

                    {/* Primary Delegate Data */}
                    <div className="md:col-span-2 p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                      <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#17458F]" />
                        <span>Primary Delegate Information</span>
                      </h4>

                      <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Name</span>
                          <p className="font-bold text-slate-900 text-sm">{currentIndividual.participantName}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">College BT ID</span>
                          <p className="font-mono font-bold text-[#E78023] text-sm">{currentIndividual.btId || "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Email</span>
                          <p className="text-slate-800 truncate font-semibold">{currentIndividual.email}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Phone</span>
                          <p className="text-slate-800 font-semibold">{currentIndividual.phone}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Department</span>
                          <p className="text-slate-800 font-semibold">{currentIndividual.department}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold block">Year</span>
                          <p className="text-slate-800 font-semibold">{currentIndividual.year}</p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Team Roster (If Squad) */}
                  {currentIndividual.teamType === "Team" && (
                    <div className="p-6 rounded-2xl bg-blue-50/50 border border-[#17458F]/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#17458F] flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#E78023]" />
                          <span>Squad Roster: {currentIndividual.teamName || "Team"}</span>
                        </h4>
                        <span className="text-[11px] font-bold text-slate-600">
                          {currentIndividual.teamMembers?.length || 1} Members
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {currentIndividual.teamMembers?.map((m, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{m}</span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Verified
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Questions & Answers Studio Section */}
                  {currentIndividual.customAnswers && Object.keys(currentIndividual.customAnswers).length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#E78023]" />
                        <h3 className="font-heading font-bold text-sm text-slate-900 uppercase">
                          Event-Specific Questions &amp; Form Responses
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.entries(currentIndividual.customAnswers).map(([qKey, qVal]) => {
                          const qInfo = getQuestionInfo(qKey, currentIndividual.eventName, currentIndividual);
                          const val = getAnswerValue(qVal);
                          const displayVal = Array.isArray(val) ? val.join(", ") : String(val);
                          return (
                            <div key={qKey} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-[#17458F] block">
                                  {qInfo.title}
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                                  {getQuestionTypeLabel(qInfo.type)}
                                </span>
                              </div>
                              <p className="font-semibold text-slate-900 text-sm break-words">
                                {displayVal || "—"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SPREADSHEET / TABLE VIEW */}
      {/* ========================================================================= */}
      {activeTab === "table" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Search & Status Filters */}
          <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by participant name, BT ID, Reg ID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#17458F]"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-500 mr-1">Status:</span>
                {["All", "CONFIRMED", "CHECKED_IN", "PENDING"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === st
                        ? "bg-[#E78023] text-white shadow-xs"
                        : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-3">
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Download formatted Excel (.xlsx) spreadsheet with all question columns"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-xs">
            {tableFilteredRegistrations.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
                <h3 className="font-heading font-bold text-sm text-slate-800">
                  No Matching Registrations Found
                </h3>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-4 px-6">Registration ID</th>
                      <th className="py-4 px-6">Participant</th>
                      <th className="py-4 px-6">Event</th>
                      <th className="py-4 px-6">Format</th>
                      <th className="py-4 px-6">Payment</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {tableFilteredRegistrations.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 font-mono text-slate-600">
                          <span className="font-bold text-[#17458F] block">{r.registrationId}</span>
                          <span className="text-[10px] text-slate-400">{r.ticketCode}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{r.participantName}</span>
                            {r.btId && (
                              <span className="font-mono text-[10px] text-[#E78023] font-bold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200">
                                {r.btId}
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500 text-[11px] block">{r.email}</span>
                          <span className="text-slate-400 text-[10px] block">{r.department} • {r.year}</span>
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-800">
                          {r.eventName}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.teamType === "Team" ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-slate-100 text-slate-600"
                          }`}>
                            {r.teamType === "Team" ? `Team: ${r.teamName || "Squad"}` : "Solo"}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {r.paymentStatus === "PAID" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CreditCard className="w-3 h-3" />
                              <span>PAID • ₹{r.amountPaid}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <span>FREE PASS</span>
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <Badge
                            variant={r.status === "CHECKED_IN" ? "success" : "orange"}
                            size="sm"
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                          {r.status !== "CHECKED_IN" && (
                            <button
                              onClick={() => handleGateCheckIn(r)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                              title="Mark Gate Check-In"
                            >
                              <Check className="w-3 h-3" />
                              <span>Check In</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedRecord(r)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-[#17458F] transition-colors cursor-pointer"
                            title="Inspect Pass"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRegistration(r.id, r.participantName)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Modal: View Participant QR & Pass Record */}
      {selectedRecord && (
        <Modal
          isOpen={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title="Delegate Record Inspection"
          subtitle={`Registration Code: ${selectedRecord.registrationId}`}
          maxWidth="lg"
        >
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
              <div className="h-32 w-32 mx-auto bg-white p-2 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden shadow-xs">
                <ScannableQRCode
                  value={
                    typeof window !== "undefined"
                      ? `${window.location.origin}/verify/${encodeURIComponent(selectedRecord.registrationId)}`
                      : `https://src-jdcoem.vercel.app/verify/${encodeURIComponent(selectedRecord.registrationId)}`
                  }
                  size={120}
                  level="H"
                  includeMargin={true}
                  renderAs="canvas"
                />
              </div>
              <div>
                <span className="font-mono text-xs font-bold text-[#E78023] block tracking-wider">
                  {selectedRecord.ticketCode || `${selectedRecord.registrationId}-TK`}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  Accreditation Barcode Payload
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1">
                <span className="text-slate-500 uppercase text-[10px] font-bold">Primary Delegate</span>
                <p className="font-bold text-slate-900 text-sm">{selectedRecord.participantName}</p>
                <p className="text-slate-600 text-[11px]">{selectedRecord.email}</p>
                <p className="text-slate-600 text-[11px]">{selectedRecord.phone}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1">
                <span className="text-slate-500 uppercase text-[10px] font-bold">Academic Branch</span>
                <p className="font-bold text-slate-900">{selectedRecord.department || "—"}</p>
                <p className="text-slate-600">{selectedRecord.year || "—"}</p>
                <Badge variant="orange" size="sm" className="mt-1">
                  {selectedRecord.status}
                </Badge>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1">
                <span className="text-slate-500 uppercase text-[10px] font-bold">Finance / Gateway</span>
                <p className="font-bold text-slate-900 text-sm">
                  {selectedRecord.paymentStatus === "PAID" ? `₹${selectedRecord.amountPaid || 0}` : "Free Pass"}
                </p>
                <p className="text-[10px] font-mono text-slate-500 truncate" title={selectedRecord.paymentId || "Free"}>
                  ID: {selectedRecord.paymentId || "N/A (Free)"}
                </p>
              </div>
            </div>

            {selectedRecord.teamType === "Team" && selectedRecord.teamMembers && selectedRecord.teamMembers.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-50 space-y-2">
                <span className="text-slate-500 uppercase text-[10px] font-bold block">
                  Team Members ({selectedRecord.teamName || "Squad"})
                </span>
                <ul className="text-xs space-y-1 text-slate-700">
                  {selectedRecord.teamMembers.map((member, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#E78023]" />
                      <span>{member}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Custom Q&N Answers */}
            {selectedRecord.customAnswers && Object.keys(selectedRecord.customAnswers).length > 0 && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <span className="text-slate-500 uppercase text-[10px] font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Custom Event Q&amp;N Answers</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(selectedRecord.customAnswers).map(([k, v]) => {
                    const qInfo = getQuestionInfo(k, selectedRecord.eventName, selectedRecord);
                    const val = getAnswerValue(v);
                    const displayVal = Array.isArray(val) ? val.join(", ") : String(val);
                    return (
                      <div key={k} className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-[#17458F] block">{qInfo.title}</span>
                          <span className="text-[8px] font-bold uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {getQuestionTypeLabel(qInfo.type)}
                          </span>
                        </div>
                        <span className="font-bold text-slate-900 text-xs break-words block">{displayVal || "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setSelectedRecord(null)}
                variant="outline"
                size="sm"
              >
                Close Inspection
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
