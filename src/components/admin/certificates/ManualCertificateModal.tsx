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
import { findStudentByBtId } from "@/lib/usersStore";
import { resolveTenureForEvent } from "@/lib/eventsStore";
import {
  generateCertificateNumber,
  batchSaveCertificatesToFirestore,
  DEFAULT_CITATION_TEMPLATE,
  DEFAULT_ACHIEVEMENT_CITATION_TEMPLATE,
  compactCertificateForRegistry,
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

  // Sync event changes to template styling
  useEffect(() => {
    if (!currentEvent) return;

    if (currentEvent.date) {
      setIssueDate(currentEvent.date);
    }

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
  }, [currentEvent]);

  // 3. Comma-separated BT IDs Input & Parsing
  const [bulkBtInput, setBulkBtInput] = useState<string>("");
  const [studentsData, setStudentsData] = useState<Record<string, ManualStudentEntry>>({});
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse BT IDs
  const parsedBtIds = useMemo(() => {
    if (!bulkBtInput.trim()) return [];
    const tokens = bulkBtInput
      .split(/[\n,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
    return Array.from(new Set(tokens));
  }, [bulkBtInput]);

  // Sync parsed BT IDs with studentsData map (auto-resolves registered / council data)
  useEffect(() => {
    setStudentsData((prev) => {
      const next: Record<string, ManualStudentEntry> = { ...prev };

      // Initialize any newly entered BT ID
      for (const bt of parsedBtIds) {
        if (!next[bt]) {
          const studentInfo = findStudentByBtId(bt);
          next[bt] = {
            btId: bt,
            name: studentInfo?.name || "",
            department: studentInfo?.department || "Computer Science & Engineering",
            year: studentInfo?.year || "3rd Year",
            email: studentInfo?.email || `${bt.toLowerCase()}@jdcoem.ac.in`,
            isAutoResolved: Boolean(studentInfo?.name),
          };
        }
      }

      // Cleanup entries that were completely removed from input
      for (const key of Object.keys(next)) {
        if (!parsedBtIds.includes(key)) {
          delete next[key];
        }
      }

      return next;
    });
  }, [parsedBtIds]);

  // Update specific student field
  const handleUpdateStudent = (btId: string, field: keyof ManualStudentEntry, value: string) => {
    setStudentsData((prev) => ({
      ...prev,
      [btId]: {
        ...prev[btId],
        [field]: value,
      },
    }));
  };

  // Remove a BT ID
  const handleRemoveBtId = (btToRemove: string) => {
    const updatedTokens = parsedBtIds.filter((id) => id !== btToRemove);
    setBulkBtInput(updatedTokens.join(", "));
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

    const firstBt = parsedBtIds[0];
    const firstStudent = firstBt ? studentsData[firstBt] : null;

    const recipientName = firstStudent?.name?.trim() || "Harsh Shende";
    const recipientDept = firstStudent?.department || "Computer Science & Engineering";
    const recipientBtId = firstStudent?.btId || "BT230036CS";
    const recipientEmail = firstStudent?.email || user?.email || "student@jdcoem.ac.in";
    const eventName = currentEvent.name;

    const resolvedCitation = citationTemplate
      .replace(/{name}/g, recipientName)
      .replace(/{rank}/g, rankOrPosition || "1st")
      .replace(/{event}/g, eventName)
      .replace(/{date}/g, currentEvent.date || issueDate)
      .replace(/{department}/g, recipientDept);

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
      recipientYear: firstStudent?.year || "3rd Year",
      recipientCollege: "JDCOEM Nagpur",
      registrationId: `offline-${recipientBtId.toLowerCase()}`,
      ticketCode: recipientBtId.slice(-6),
      eventId: currentEvent.id,
      eventSlug: currentEvent.slug,
      eventName: currentEvent.name,
      eventDate: currentEvent.date || issueDate,
      organizerClub: currentEvent.organizer || "Student Representative Council",
      organizerClubSlug: currentEvent.organizerClubSlug || "",
      clubLogoUrl: clubLogoUrl || "",
      posterUrl: currentEvent.posterImage || currentEvent.poster || "",
      colorPalette,
      citation: resolvedCitation,
      signatories: defaultSignatories || [],
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

    if (parsedBtIds.length === 0) {
      setErrorMessage("Please enter at least one Student BT ID.");
      return;
    }

    // Verify all entered BT IDs have a name
    for (const bt of parsedBtIds) {
      const st = studentsData[bt];
      if (!st || !st.name.trim()) {
        setErrorMessage(`Please enter student full name for BT ID: ${bt}`);
        return;
      }
    }

    const confirmed = window.confirm(
      `Issue and publish ${parsedBtIds.length} official digital certificate(s) for "${currentEvent.name}"? They will appear immediately on the students' dashboards and public verification.`
    );
    if (!confirmed) return;

    setIsPublishing(true);

    try {
      const certsToSave: CertificateRecord[] = [];
      const origin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "https://srcjdcoem.in";

      for (let i = 0; i < parsedBtIds.length; i++) {
        const bt = parsedBtIds[i];
        const st = studentsData[bt];
        const cleanBtId = bt.replace(/[^a-zA-Z0-9_-]/g, "_");
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
            organizerClub: currentEvent.organizer || "SRC Council",
            organizerClubSlug: currentEvent.organizerClubSlug || "",
            clubLogoUrl: clubLogoUrl || "",
            posterUrl: currentEvent.posterImage || currentEvent.poster || "",
            colorPalette,
            citation: resolvedCitation,
            signatories: defaultSignatories || [],
            issueDate,
            status: "PUBLISHED" as const,
            verificationUrl,
            qrPayload: verificationUrl,
            issuedBy: user?.displayName || user?.email || "SRC Admin",
            issuedAt: new Date().toISOString(),
          })
        );
      }

      await batchSaveCertificatesToFirestore(certsToSave);

      // Save club logo to local cache if present
      if (clubLogoUrl && currentEvent) {
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
      <div className="space-y-5 max-h-[75vh] overflow-y-auto px-1 pr-2 scrollbar-thin">
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
              <span className="text-[10px] text-slate-400 font-medium">SRC JDCOEM</span>
            </div>

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
                  Enter Student BT IDs (Separated by Commas)
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Paste or type student BT IDs separated by commas or newlines. Student names &amp; branches are auto-resolved from records.
                </p>
              </div>

              {parsedBtIds.length > 0 && (
                <Badge variant="navy" size="sm">
                  {parsedBtIds.length} Recipient{parsedBtIds.length === 1 ? "" : "s"}
                </Badge>
              )}
            </div>

            <textarea
              rows={3}
              value={bulkBtInput}
              onChange={(e) => setBulkBtInput(e.target.value)}
              placeholder="e.g. BT230036CS, BT240054DS, BT210115ME"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono uppercase tracking-wide focus:border-[#17458F] focus:outline-none"
            />

            {/* Resolved Students Table / List */}
            {parsedBtIds.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <span>Recipient Verification &amp; Editable Credentials:</span>
                  <span className="text-[10px] text-slate-400">
                    Names appear directly on issued certificates
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50/70 scrollbar-thin">
                  {parsedBtIds.map((bt) => {
                    const st = studentsData[bt] || {
                      btId: bt,
                      name: "",
                      department: "Computer Science & Engineering",
                      year: "3rd Year",
                      email: "",
                      isAutoResolved: false,
                    };

                    return (
                      <div
                        key={bt}
                        className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-xs text-[#17458F]">
                              {bt}
                            </span>
                            {st.isAutoResolved ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Verified in Records
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Offline / Unregistered
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveBtId(bt)}
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
                              onChange={(e) => handleUpdateStudent(bt, "name", e.target.value)}
                              placeholder="e.g. Rahul Sharma"
                              className={`w-full px-2 py-1 rounded-lg border text-xs font-bold ${
                                !st.name.trim()
                                  ? "border-amber-400 bg-amber-50/50"
                                  : "border-slate-200 bg-white"
                              }`}
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                              Department / Branch
                            </label>
                            <input
                              type="text"
                              value={st.department}
                              onChange={(e) =>
                                handleUpdateStudent(bt, "department", e.target.value)
                              }
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
                              onChange={(e) => handleUpdateStudent(bt, "year", e.target.value)}
                              placeholder="e.g. 3rd Year"
                              className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
            disabled={parsedBtIds.length === 0}
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
              disabled={isPublishing || parsedBtIds.length === 0}
              className="text-xs bg-[#17458F] hover:bg-[#123673] text-white font-bold"
            >
              {isPublishing ? (
                <>Issuing {parsedBtIds.length} Certificates...</>
              ) : (
                <>
                  <Award className="w-3.5 h-3.5 mr-1" />
                  Publish {parsedBtIds.length > 0 ? `${parsedBtIds.length} ` : ""}Certificates
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
