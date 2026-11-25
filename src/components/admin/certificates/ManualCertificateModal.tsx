"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Award,
  Calendar,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Upload,
  X,
  Plus,
  Eye,
  Check,
  AlertCircle,
  Users,
  Trash2,
  CheckCircle2,
  Layers,
  Loader2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EventItem } from "@/types";
import { CouncilTenure } from "@/lib/tenureStore";
import {
  CertificateRecord,
  CertificateType,
  CertificateSignatory,
  CertificateColorPalette,
} from "@/types/certificates";
import { findStudentByBtId, lookupUserByBtId, syncUsersFromFirestore } from "@/lib/usersStore";
import { resolveTenureForEvent } from "@/lib/eventsStore";
import {
  generateCertificateNumber,
  batchSaveCertificatesToFirestore,
  DEFAULT_CITATION_TEMPLATE,
  DEFAULT_ACHIEVEMENT_CITATION_TEMPLATE,
  getDefaultCitationForType,
  compactCertificateForRegistry,
  isCentralizedCertificate,
} from "@/lib/certificatesStore";
import {
  extractPosterColorPalette,
  generatePaletteFromBaseHex,
  DEFAULT_CERTIFICATE_PALETTES,
} from "@/lib/colorExtractor";
import { cleanUndefined, saveSiteContentToFirestore } from "@/lib/firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface ManualStudentEntry {
  btId: string;
  name: string;
  department: string;
  year: string;
  email: string;
  isAutoResolved: boolean;
}

interface ManualCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenuresList: CouncilTenure[];
  allEvents: EventItem[];
  defaultSignatories: CertificateSignatory[];
  initialTenureId?: string;
  initialEventId?: string;
  onSuccessPublished?: (count: number) => void;
  onOpenLivePreview?: (previewRecord: CertificateRecord) => void;
}

export function ManualCertificateModal({
  isOpen,
  onClose,
  tenuresList,
  allEvents,
  defaultSignatories,
  initialTenureId,
  initialEventId,
  onSuccessPublished,
  onOpenLivePreview,
}: ManualCertificateModalProps) {
  const { user } = useAuth();

  // 1. Tenure & Event Filtering
  const [selectedTenureId, setSelectedTenureId] = useState<string>(
    initialTenureId || (tenuresList.find((t) => t.isCurrent)?.id || (tenuresList[0]?.id || "all"))
  );
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId || "");

  // Update tenure selection if initial changes
  useEffect(() => {
    if (initialTenureId) setSelectedTenureId(initialTenureId);
  }, [initialTenureId]);

  useEffect(() => {
    if (initialEventId) setSelectedEventId(initialEventId);
  }, [initialEventId]);

  // Compute events belonging strictly to the selected tenure
  const tenureFilteredEvents = useMemo(() => {
    if (!selectedTenureId || selectedTenureId === "all") return allEvents;
    const matchedTenure = tenuresList.find((t) => t.id === selectedTenureId);
    if (!matchedTenure) return allEvents;

    if (matchedTenure.isCurrent || matchedTenure.status === "active") {
      // Current tenure: strictly show events that belong to this tenure only!
      return allEvents.filter((e) => {
        // Exclude snapshot events stored inside another past tenure's t.events
        const isFromPastSnapshot = tenuresList.some(
          (otherT) =>
            otherT.id !== matchedTenure.id &&
            Array.isArray(otherT.events) &&
            otherT.events.some((pastEv) => (pastEv.id && pastEv.id === e.id) || (pastEv.slug && pastEv.slug === e.slug))
        );
        if (isFromPastSnapshot) return false;

        // If explicitly tagged to another tenure, exclude
        if (e.tenureId && e.tenureId !== matchedTenure.id) return false;

        const resolved = resolveTenureForEvent(e, tenuresList);
        return resolved ? resolved.id === matchedTenure.id : (e.tenureId === matchedTenure.id || !e.tenureId);
      });
    } else {
      // Past / Archived tenure: load events from this past tenure's snapshot + store tagged events
      const snapshotEvents = Array.isArray(matchedTenure.events) ? matchedTenure.events : [];
      const pastFromStore = allEvents.filter((e) => {
        if (e.tenureId) return e.tenureId === matchedTenure.id;
        const resolved = resolveTenureForEvent(e, tenuresList);
        return resolved?.id === matchedTenure.id;
      });

      const map = new Map<string, EventItem>();
      [...snapshotEvents, ...pastFromStore].forEach((ev) => {
        if (ev && (ev.id || ev.slug)) map.set(ev.id || ev.slug, ev);
      });
      return Array.from(map.values());
    }
  }, [allEvents, selectedTenureId, tenuresList]);

  // Current selected event object
  const currentEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return (
      tenureFilteredEvents.find(
        (e) =>
          e.id === selectedEventId ||
          e.slug.toLowerCase() === selectedEventId.toLowerCase() ||
          e.name.toLowerCase() === selectedEventId.toLowerCase()
      ) ||
      allEvents.find(
        (e) =>
          e.id === selectedEventId ||
          e.slug.toLowerCase() === selectedEventId.toLowerCase() ||
          e.name.toLowerCase() === selectedEventId.toLowerCase()
      ) ||
      null
    );
  }, [allEvents, tenureFilteredEvents, selectedEventId]);

  // When tenureFilteredEvents changes, ensure selectedEventId is a valid event within this tenure
  useEffect(() => {
    if (tenureFilteredEvents.length > 0) {
      const isCurrentSelectionValid = tenureFilteredEvents.some(
        (e) =>
          (e.id && e.id === selectedEventId) ||
          (e.slug && e.slug.toLowerCase() === selectedEventId.toLowerCase())
      );
      if (!isCurrentSelectionValid) {
        setSelectedEventId(tenureFilteredEvents[0].id || tenureFilteredEvents[0].slug);
      }
    } else {
      setSelectedEventId("");
    }
  }, [tenureFilteredEvents, selectedEventId]);

  // 2. Template Styling States
  const [certType, setCertType] = useState<CertificateType>("PARTICIPATION");
  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [rankOrPosition, setRankOrPosition] = useState<string>("1st");
  const [certTitle, setCertTitle] = useState<string>("CERTIFICATE OF PARTICIPATION");
  const [citationTemplate, setCitationTemplate] = useState<string>(DEFAULT_CITATION_TEMPLATE);
  const [colorPalette, setColorPalette] = useState<CertificateColorPalette>(
    DEFAULT_CERTIFICATE_PALETTES.ocean
  );
  const [clubLogoUrl, setClubLogoUrl] = useState<string>("");
  const [isExtractingColor, setIsExtractingColor] = useState(false);

  // Sync users store from Firestore on mount so offline resolution has the freshest directory
  useEffect(() => {
    if (isOpen) {
      syncUsersFromFirestore().catch(() => {});
      setCitationTemplate(getDefaultCitationForType(certType));
      setIssueDate(new Date().toISOString().split("T")[0]);
    }
  }, [isOpen, certType]);

  // Centralised Event Determination (SRC JDCOEM Central Council vs Student Club)
  const isCurrentEventCentral = useMemo(() => {
    if (!currentEvent) return false;
    return isCentralizedCertificate({
      eventId: currentEvent.id,
      eventSlug: currentEvent.slug,
      eventName: currentEvent.name,
      organizerClub: currentEvent.organizer,
      organizerClubSlug: currentEvent.organizerClubSlug,
    });
  }, [currentEvent]);

  // Resolve active tenure label for session subtext in manual certificates
  const modalActiveTenure = useMemo(() => {
    if (selectedTenureId && selectedTenureId !== "all") {
      return tenuresList.find((t) => t.id === selectedTenureId) || null;
    }
    if (currentEvent) {
      const resolved = resolveTenureForEvent(currentEvent, tenuresList);
      if (resolved) return resolved;
    }
    return tenuresList.find((t) => t.isCurrent) || tenuresList[0] || null;
  }, [selectedTenureId, tenuresList, currentEvent]);

  const modalActiveSessionSubtext = useMemo(() => {
    if (!modalActiveTenure) return "Session 2026-27";
    const raw = modalActiveTenure.label || modalActiveTenure.academicYear || "";
    const clean = raw.trim();
    if (clean.toLowerCase().startsWith("session")) return clean;
    const match = clean.match(/(\d{4})\s*[-–/]\s*(\d{2,4})/);
    if (match) {
      const startYear = match[1];
      const endYear = match[2].length === 4 ? match[2].slice(-2) : match[2];
      return `Session ${startYear}-${endYear}`;
    }
    return clean ? `Session ${clean}` : "Session 2026-27";
  }, [modalActiveTenure]);

  const resolvedSignatories = useMemo(() => {
    return (defaultSignatories || []).map((sig, idx) => {
      const isPresident = idx === 0 || /president/i.test(sig.designation || sig.name || "");
      if (isPresident) {
        return { ...sig, organization: modalActiveSessionSubtext };
      }
      return sig;
    });
  }, [defaultSignatories, modalActiveSessionSubtext]);

  // Sync event changes to template styling
  useEffect(() => {
    if (!currentEvent) return;

    if (isCurrentEventCentral) {
      setClubLogoUrl("");
    } else {
      // Try finding cached/stored club logo
      if (typeof window !== "undefined") {
        const stored =
          localStorage.getItem(`src_club_logo_${currentEvent.slug}`) ||
          localStorage.getItem(`src_club_logo_${currentEvent.id}`);
        if (stored) {
          setClubLogoUrl(stored);
        } else {
          const eventLogo =
            (currentEvent as any).clubLogo ||
            (currentEvent as any).organizerLogo ||
            (currentEvent as any).organizerClubLogo ||
            "";
          if (eventLogo) setClubLogoUrl(eventLogo);
        }
      }
    }

    // Extract poster color palette
    const poster =
      currentEvent.posterImage ||
      currentEvent.poster ||
      currentEvent.cardImage ||
      currentEvent.headerImage;

    if (poster) {
      setIsExtractingColor(true);
      extractPosterColorPalette(poster)
        .then((pal) => {
          setColorPalette(pal);
          setIsExtractingColor(false);
        })
        .catch(() => setIsExtractingColor(false));
    }
  }, [currentEvent, isCurrentEventCentral]);

  // 3. BT IDs Input & Enter-Key Verification Engine
  const [bulkBtInput, setBulkBtInput] = useState<string>("");
  const [invalidBtIds, setInvalidBtIds] = useState<string[]>([]);
  const [verifiedStudents, setVerifiedStudents] = useState<ManualStudentEntry[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Process entered BT IDs on Enter key or button click
  const handleProcessBtIds = async () => {
    const raw = bulkBtInput.trim();
    if (!raw) return;

    // Normalize patterns like "bt 23" -> "BT23"
    const normalizedRaw = raw.replace(/\b([a-zA-Z]{2,5})\s+(\d+)/g, "$1$2");

    // Split by commas, newlines, semicolons, or whitespace
    const tokens = normalizedRaw
      .split(/[\n,;\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    if (tokens.length === 0) return;

    // Deduplicate tokens in current batch
    const uniqueTokens = Array.from(new Set(tokens));

    const notFoundTokens: string[] = [];
    const newValidEntries: ManualStudentEntry[] = [];
    const existingBtIds = new Set(verifiedStudents.map((s) => s.btId));

    for (const bt of uniqueTokens) {
      // 1. Synchronous lookup across users, council, hosting, clubs, founders, registrations
      let studentInfo = findStudentByBtId(bt);

      // 2. Asynchronous fallback lookup in Firestore if not cached locally
      if (!studentInfo || !studentInfo.name) {
        try {
          const remoteUser = await lookupUserByBtId(bt);
          if (remoteUser && (remoteUser.displayName || remoteUser.name)) {
            studentInfo = {
              name: remoteUser.displayName || remoteUser.name || "",
              department: remoteUser.department || undefined,
              year: remoteUser.year || undefined,
              email: remoteUser.email || undefined,
              source: "user",
            };
          }
        } catch {}
      }

      if (studentInfo && studentInfo.name && studentInfo.name.trim()) {
        // Valid student found in the system!
        if (!existingBtIds.has(bt)) {
          existingBtIds.add(bt);
          newValidEntries.push({
            btId: bt,
            name: studentInfo.name.trim(),
            department: studentInfo.department || "Computer Science & Engineering",
            year: studentInfo.year || "3rd Year",
            email: studentInfo.email || `${bt.toLowerCase()}@jdcoem.ac.in`,
            isAutoResolved: true,
          });
        }
      } else {
        // Not found in system -> Invalid!
        notFoundTokens.push(bt);
      }
    }

    if (newValidEntries.length > 0) {
      setVerifiedStudents((prev) => [...prev, ...newValidEntries]);
    }

    if (notFoundTokens.length > 0) {
      // Invalid IDs continue to display in the box with small red alert
      setBulkBtInput(notFoundTokens.join(", "));
      setInvalidBtIds(notFoundTokens);
    } else {
      // All were valid and processed: clear box and dismiss invalid alert
      setBulkBtInput("");
      setInvalidBtIds([]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBulkBtInput(e.target.value);
    if (invalidBtIds.length > 0) {
      setInvalidBtIds([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleProcessBtIds();
    }
  };

  // Update specific student field
  const handleUpdateStudent = (btId: string, field: keyof ManualStudentEntry, value: string) => {
    setVerifiedStudents((prev) =>
      prev.map((s) => (s.btId === btId ? { ...s, [field]: value } : s))
    );
  };

  // Remove a verified student from list
  const handleRemoveStudent = (btToRemove: string) => {
    setVerifiedStudents((prev) => prev.filter((s) => s.btId !== btToRemove));
  };

  // Club logo image upload handler
  const handleClubLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file (PNG, WebP, or SVG)");
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
            saveSiteContentToFirestore(`cert_logo_${currentEvent.slug}`, {
              logoUrl: reader.result,
            }).catch(() => {});
          } catch {}
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Live preview handler
  const handleTriggerLivePreview = () => {
    if (!currentEvent) {
      setErrorMessage("Please select an event first.");
      return;
    }

    const firstStudent = verifiedStudents[0];
    if (!firstStudent) {
      setErrorMessage("Please enter and verify at least one student BT ID.");
      return;
    }

    const recipientName = firstStudent.name?.trim() || "Harsh Shende";
    const recipientDept = firstStudent.department || "Computer Science & Engineering";
    const recipientBtId = firstStudent.btId || "BT230036CS";
    const recipientEmail = firstStudent.email || user?.email || "student@jdcoem.ac.in";
    const eventName = currentEvent.name;

    const resolvedCitation = citationTemplate
      .replace(/{name}/g, recipientName)
      .replace(/{rank}/g, rankOrPosition || "1st")
      .replace(/{event}/g, eventName)
      .replace(/{date}/g, currentEvent.date || issueDate)
      .replace(/{department}/g, recipientDept);

    const isCentral = isCentralizedCertificate({
      eventId: currentEvent.id,
      eventSlug: currentEvent.slug,
      eventName: currentEvent.name,
      organizerClub: currentEvent.organizer,
      organizerClubSlug: currentEvent.organizerClubSlug,
    });

    const certNum = generateCertificateNumber(currentEvent.slug, recipientBtId.slice(-4) || "001");
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "https://srcjdcoem.in";

    const previewPayload: CertificateRecord = cleanUndefined({
      id: "preview-cert",
      certificateNumber: certNum,
      type: certType,
      title: certTitle,
      rankOrPosition: certType === "ACHIEVEMENT" ? rankOrPosition || "1st" : undefined,
      recipientName,
      recipientEmail,
      recipientBtId,
      recipientDepartment: recipientDept,
      recipientYear: firstStudent.year || "3rd Year",
      recipientCollege: "JDCOEM Nagpur",
      registrationId: `offline-${recipientBtId.toLowerCase()}`,
      ticketCode: recipientBtId.slice(-6),
      eventId: currentEvent.id,
      eventSlug: currentEvent.slug,
      eventName: currentEvent.name,
      eventDate: currentEvent.date || issueDate,
      organizerClub: currentEvent.organizer || "Student Representation Council",
      organizerClubSlug: currentEvent.organizerClubSlug || (isCentral ? "src-council" : ""),
      clubLogoUrl: isCentral ? "" : (clubLogoUrl || ""),
      posterUrl: currentEvent.posterImage || currentEvent.poster || "",
      colorPalette,
      citation: resolvedCitation,
      signatories: resolvedSignatories,
      issueDate,
      status: "PUBLISHED",
      verificationUrl: `${origin}/verify/certificate/preview-cert`,
      qrPayload: `${origin}/verify/certificate/preview-cert`,
      issuedBy: user?.displayName || user?.email || "SRC Admin",
      issuedAt: new Date().toISOString(),
    });

    if (onOpenLivePreview) {
      onOpenLivePreview(previewPayload);
    }
  };

  // Batch Publish Handler for Manual/Offline BT IDs
  const handlePublishManualCertificates = async () => {
    setErrorMessage(null);

    if (!currentEvent) {
      setErrorMessage("Please select an event for the certificate.");
      return;
    }

    if (verifiedStudents.length === 0) {
      setErrorMessage("Please enter and verify at least one student BT ID.");
      return;
    }

    // Verify all entered BT IDs have a name
    for (const st of verifiedStudents) {
      if (!st.name.trim()) {
        setErrorMessage(`Please enter student full name for BT ID: ${st.btId}`);
        return;
      }
    }

    const confirmed = window.confirm(
      `Issue and publish ${verifiedStudents.length} official digital certificate(s) for "${currentEvent.name}"? They will appear immediately on the students' dashboards and public verification.`
    );
    if (!confirmed) return;

    setIsPublishing(true);

    try {
      const certsToSave: CertificateRecord[] = [];
      const origin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "https://srcjdcoem.in";

      const isCentral = isCentralizedCertificate({
        eventId: currentEvent.id,
        eventSlug: currentEvent.slug,
        eventName: currentEvent.name,
        organizerClub: currentEvent.organizer,
        organizerClubSlug: currentEvent.organizerClubSlug,
      });

      for (let i = 0; i < verifiedStudents.length; i++) {
        const st = verifiedStudents[i];
        const cleanBtId = st.btId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const cleanSlug = (currentEvent.slug || "event").replace(/[^a-zA-Z0-9_-]/g, "_");
        const certId = `cert_${cleanSlug}_${cleanBtId}_${Date.now()}_${i + 1}`;
        const certNum = generateCertificateNumber(currentEvent.slug, cleanBtId.slice(-4));

        const resolvedCitation = citationTemplate
          .replace(/{name}/g, st.name.trim())
          .replace(/{rank}/g, rankOrPosition || "1st")
          .replace(/{event}/g, currentEvent.name)
          .replace(/{date}/g, currentEvent.date || issueDate)
          .replace(/{department}/g, st.department || "Engineering");

        const verificationUrl = `${origin}/verify/certificate/${certId}`;

        certsToSave.push(
          cleanUndefined({
            id: certId,
            certificateNumber: certNum,
            type: certType,
            title: certTitle,
            rankOrPosition: certType === "ACHIEVEMENT" ? rankOrPosition || "1st" : undefined,
            recipientName: st.name.trim(),
            recipientEmail: (st.email || `${cleanBtId.toLowerCase()}@jdcoem.ac.in`).trim().toLowerCase(),
            recipientBtId: cleanBtId,
            recipientDepartment: st.department || "Engineering",
            recipientYear: st.year || "3rd Year",
            recipientCollege: "JDCOEM Nagpur",
            registrationId: `offline-${cleanBtId.toLowerCase()}`,
            ticketCode: cleanBtId.slice(-6),
            eventId: currentEvent.id,
            eventSlug: currentEvent.slug,
            eventName: currentEvent.name,
            eventDate: currentEvent.date || issueDate,
            organizerClub: currentEvent.organizer || "SRC, JDCOEM",
            organizerClubSlug: currentEvent.organizerClubSlug || (isCentral ? "src-council" : ""),
            clubLogoUrl: isCentral ? "" : (clubLogoUrl || ""),
            posterUrl: currentEvent.posterImage || currentEvent.poster || "",
            colorPalette,
            citation: resolvedCitation,
            signatories: resolvedSignatories,
            issueDate,
            status: "PUBLISHED" as const,
            issuanceMode: "MANUAL" as const,
            verificationUrl,
            qrPayload: verificationUrl,
            issuedBy: user?.displayName || user?.email || "SRC Admin",
            issuedAt: new Date().toISOString(),
          })
        );
      }

      await batchSaveCertificatesToFirestore(certsToSave);

      // Save club logo to local cache if present and not centralized
      if (clubLogoUrl && currentEvent && !isCentral) {
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(`src_club_logo_${currentEvent.slug}`, clubLogoUrl);
            localStorage.setItem(`src_club_logo_${currentEvent.id}`, clubLogoUrl);
          }
        } catch {}
      }

      if (onSuccessPublished) {
        onSuccessPublished(certsToSave.length);
      }

      onClose();
    } catch (err: any) {
      console.error("Error issuing manual certificates:", err);
      setErrorMessage(err?.message || "Failed to issue certificates. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Certificate (Manual / Offline BT ID)"
      subtitle="Issue official digital credentials directly for students who attended offline or were not registered online."
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {/* Error Notice */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. TOP BAR: TENURE PERIOD FILTER & EVENT NAME FILTER */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#17458F]" />
            <span>Target Tenure &amp; Event Scope</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tenure Filter */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Tenure Period
              </label>
              <div className="relative">
                <select
                  value={selectedTenureId}
                  onChange={(e) => {
                    setSelectedTenureId(e.target.value);
                    setSelectedEventId("");
                  }}
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#17458F] appearance-none cursor-pointer shadow-2xs"
                >
                  <option value="all">All Tenures</option>
                  {tenuresList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tenureNumber} ({t.label})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Event Name Filter */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Event / Competition Name
              </label>
              <div className="relative">
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#17458F] appearance-none cursor-pointer shadow-2xs"
                >
                  <option value="" disabled>
                    Select an Event...
                  </option>
                  {tenureFilteredEvents.map((evt) => (
                    <option key={evt.id || evt.slug} value={evt.id || evt.slug}>
                      {evt.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {currentEvent && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-900">{currentEvent.name}</span>
              {currentEvent.date && (
                <>
                  <span>•</span>
                  <span>{currentEvent.date}</span>
                </>
              )}
              {currentEvent.organizer && (
                <>
                  <span>•</span>
                  <span className="text-[#17458F] font-medium">{currentEvent.organizer}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* 2. TEMPLATE STYLING OPTIONS */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
          <h4 className="font-heading font-extrabold text-sm text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#E78023]" />
            Template Styling
          </h4>

          {/* Certificate Type & Issue Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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

          {/* Rank / Position Control (if Achievement) */}
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

          {/* Pill Banner Title */}
          <div className="text-xs">
            <label className="font-bold text-slate-700 block mb-1">Pill Banner Title</label>
            <input
              type="text"
              value={certTitle}
              onChange={(e) => setCertTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
            />
          </div>

          {/* Citation Description */}
          <div className="text-xs">
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 block">Citation Description</label>
              <button
                type="button"
                onClick={() => {
                  setCitationTemplate(getDefaultCitationForType(certType));
                }}
                className="text-[10px] text-[#17458F] hover:underline font-semibold cursor-pointer"
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

          {/* Poster Theme Color Scheme */}
          <div className="text-xs space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
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
                className="text-[10px] font-bold text-[#17458F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isExtractingColor ? "animate-spin" : ""}`} />
                Re-extract
              </button>
            </div>

            <div className="flex items-center gap-2">
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

          {/* Center Club Emblem (Header) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#E78023]" />
                Center Club Emblem (Header)
              </label>
              {currentEvent?.organizer && (
                <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[150px]">
                  {currentEvent.organizer}
                </span>
              )}
            </div>

            {isCurrentEventCentral && (
              <p className="text-[11px] text-amber-700 bg-amber-50/80 border border-amber-200/70 rounded-lg p-2 font-medium leading-relaxed">
                <strong>Centralised Event:</strong> Organised by SRC JDCOEM. The center club emblem is cleanly omitted so only the official SRC and College headers appear.
              </p>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={clubLogoUrl}
                onChange={(e) => setClubLogoUrl(e.target.value)}
                placeholder="Club logo URL or upload..."
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
              />

              <label
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer text-xs flex items-center gap-1 shrink-0 font-medium transition-colors shadow-2xs"
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

          {/* 3. ADD BT ID OPTION (BELOW CENTER CLUB EMBLEM) */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#17458F]" />
                  Enter Student BT IDs
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Type or paste BT ID(s) and press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[10px] font-bold text-slate-700">Enter ↵</kbd>. Names are auto-resolved from system records.
                </p>
              </div>

              {verifiedStudents.length > 0 && (
                <Badge variant="navy" size="sm">
                  {verifiedStudents.length} Recipient{verifiedStudents.length === 1 ? "" : "s"}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="relative">
                <textarea
                  rows={2}
                  value={bulkBtInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. BT22CS001, BT23CS002 (Press Enter to verify & add)"
                  className={`w-full px-3 py-2 pr-24 rounded-xl border text-xs font-mono uppercase tracking-wide focus:outline-none transition-colors ${
                    invalidBtIds.length > 0
                      ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                      : "border-slate-300 bg-white focus:border-[#17458F]"
                  }`}
                />
                <button
                  type="button"
                  onClick={handleProcessBtIds}
                  disabled={!bulkBtInput.trim()}
                  className="absolute right-2.5 bottom-3 px-2.5 py-1 rounded-lg bg-[#17458F] hover:bg-[#123673] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-[11px] shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  title="Press Enter or click to verify & add"
                >
                  <span>Add</span>
                  <span className="font-mono text-[10px] opacity-80">↵</span>
                </button>
              </div>

              {/* Small Red Alert for Invalid BT IDs */}
              {invalidBtIds.length > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/90 text-rose-800 text-xs flex items-start justify-between gap-2 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-900">
                        {invalidBtIds.length === 1 ? "Invalid BT ID" : "Invalid BT IDs"}
                      </p>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        {invalidBtIds.length === 1 ? (
                          <>
                            <span className="font-mono font-bold text-rose-900 bg-rose-100/70 px-1 py-0.5 rounded">{invalidBtIds[0]}</span> does not exist in the system.
                          </>
                        ) : (
                          <>
                            The following BT IDs do not exist in the system:{" "}
                            {invalidBtIds.map((id, idx) => (
                              <span key={id} className="font-mono font-bold text-rose-900 bg-rose-100/70 px-1 py-0.5 rounded mr-1">
                                {id}{idx < invalidBtIds.length - 1 ? "," : ""}
                              </span>
                            ))}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInvalidBtIds([])}
                    className="text-rose-400 hover:text-rose-700 p-0.5"
                    title="Dismiss alert"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Resolved Students Table / List */}
            {verifiedStudents.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <span>Verified Recipients ({verifiedStudents.length}):</span>
                  <span className="text-[10px] text-slate-400">
                    Names appear directly on issued certificates
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50/70 scrollbar-thin">
                  {verifiedStudents.map((st) => (
                    <div
                      key={st.btId}
                      className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-xs text-[#17458F]">
                            {st.btId}
                          </span>
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Verified in Records
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(st.btId)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Remove this recipient"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Inline Student Form Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            Student Full Name *
                          </label>
                          <input
                            type="text"
                            value={st.name}
                            onChange={(e) => handleUpdateStudent(st.btId, "name", e.target.value)}
                            placeholder="e.g. Rahul Sharma"
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            Department / Branch
                          </label>
                          <input
                            type="text"
                            value={st.department}
                            onChange={(e) => handleUpdateStudent(st.btId, "department", e.target.value)}
                            placeholder="Department"
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                            Academic Year
                          </label>
                          <input
                            type="text"
                            value={st.year}
                            onChange={(e) => handleUpdateStudent(st.btId, "year", e.target.value)}
                            placeholder="e.g. 3rd Year"
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. MODAL ACTION FOOTER */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleTriggerLivePreview}
            disabled={verifiedStudents.length === 0}
            className="w-full sm:w-auto text-xs"
          >
            <Eye className="w-3.5 h-3.5 mr-1 text-slate-600" />
            Live Preview
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPublishing}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="primary"
              onClick={handlePublishManualCertificates}
              disabled={isPublishing || verifiedStudents.length === 0}
              className="text-xs bg-[#17458F] hover:bg-[#123673] text-white font-bold disabled:opacity-75 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Issuing {verifiedStudents.length} Certificates...</span>
                </>
              ) : (
                <>
                  <Award className="w-3.5 h-3.5 mr-1" />
                  <span>Publish {verifiedStudents.length > 0 ? `${verifiedStudents.length} ` : ""}Certificates</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Active Publishing Loading Overlay */}
        {isPublishing && (
          <div className="absolute inset-0 z-50 bg-white/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center rounded-3xl space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#17458F]/10 border border-[#17458F]/20 text-[#17458F] flex items-center justify-center shadow-inner">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <h4 className="font-heading font-extrabold text-base text-slate-900">
                Issuing Official Certificates...
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                Writing {verifiedStudents.length} digital credentials to cloud database and generating QR verification records.
              </p>
            </div>
            <div className="w-48 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#17458F] h-full rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
