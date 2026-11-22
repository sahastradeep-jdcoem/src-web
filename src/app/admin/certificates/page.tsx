"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EventItem, RegistrationRecord } from "@/types";
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
} from "@/lib/eventsStore";
import {
  getAllRegistrationsFromFirestore,
  subscribeToRegistrationsFromFirestore,
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
} from "@/lib/certificatesStore";
import {
  extractPosterColorPalette,
  generatePaletteFromBaseHex,
  DEFAULT_CERTIFICATE_PALETTES,
} from "@/lib/colorExtractor";
import { getStoredClubs, findClub } from "@/lib/councilStore";
import { CertificateView } from "@/components/certificates/CertificateView";
import { downloadCertificateAsImage, printCertificate } from "@/lib/certificateExport";

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
  const { user, isAdmin, isOwner } = useAuth();
  const searchParams = useSearchParams();
  const initialEventId = searchParams?.get("eventId") || "";

  // Data states
  const [events, setEvents] = useState<EventItem[]>([]);
  const [allRegistrations, setAllRegistrations] = useState<RegistrationRecord[]>([]);
  const [allCertificates, setAllCertificates] = useState<CertificateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected event
  const [selectedEventId, setSelectedEventId] = useState<string>(initialEventId);

  // Tab: "generate" | "issued"
  const [activeTab, setActiveTab] = useState<"generate" | "issued">("generate");

  // Certificate Generator form states
  const [certType, setCertType] = useState<CertificateType>("PARTICIPATION");
  const [certTitle, setCertTitle] = useState("CERTIFICATE OF PARTICIPATION");
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
  const [isSavingSignatories, setIsSavingSignatories] = useState(false);

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
      }
      if (isMounted && settings?.defaultCitationTemplate) {
        setCitationTemplate(settings.defaultCitationTemplate);
      }
    });

    const unsubEvents = subscribeToEvents((remoteEvts) => {
      if (isMounted && remoteEvts) setEvents(remoteEvts);
    });

    const unsubRegs = subscribeToRegistrationsFromFirestore((remoteRegs) => {
      if (isMounted && remoteRegs) setAllRegistrations(remoteRegs as unknown as RegistrationRecord[]);
    });

    const unsubCerts = subscribeToCertificates((remoteCerts) => {
      if (isMounted && remoteCerts) setAllCertificates(remoteCerts);
    });

    return () => {
      isMounted = false;
      unsubEvents();
      unsubRegs();
      unsubCerts();
    };
  }, []);

  // 2. Select default event if query param provided or fallback
  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      if (initialEventId && events.some((e) => e.id === initialEventId || e.slug === initialEventId)) {
        setSelectedEventId(initialEventId);
      } else {
        setSelectedEventId(events[0].id);
      }
    }
  }, [events, selectedEventId, initialEventId]);

  // Current selected event object
  const currentEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId || e.slug === selectedEventId);
  }, [events, selectedEventId]);

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
  }, [allRegistrations, currentEvent]);

  // Certificates for the current selected event
  const eventCertificates = useMemo(() => {
    if (!currentEvent) return allCertificates;
    return allCertificates.filter(
      (c) => c.eventId === currentEvent.id || c.eventSlug === currentEvent.slug
    );
  }, [allCertificates, currentEvent]);

  // Set of participant registration IDs that already have a certificate
  const certifiedRegIds = useMemo(() => {
    const set = new Set<string>();
    eventCertificates.forEach((c) => {
      if (c.registrationId) set.add(c.registrationId);
    });
    return set;
  }, [eventCertificates]);

  // Filtered participants list for generation
  const filteredParticipants = useMemo(() => {
    return eventRegistrations.filter((reg) => {
      // 1. Status Filter
      if (participantFilter === "CHECKED_IN" && reg.status !== "CHECKED_IN") {
        return false;
      }
      if (participantFilter === "UNCERTIFIED" && certifiedRegIds.has(reg.id || reg.registrationId)) {
        return false;
      }
      if (reg.status === "CANCELLED") {
        return false;
      }

      // 2. Search
      if (participantSearch.trim()) {
        const query = participantSearch.toLowerCase();
        const name = (reg.participantName || "").toLowerCase();
        const btId = (reg.btId || "").toLowerCase();
        const email = (reg.email || "").toLowerCase();
        const dept = (reg.department || "").toLowerCase();
        return (
          name.includes(query) ||
          btId.includes(query) ||
          email.includes(query) ||
          dept.includes(query)
        );
      }
      return true;
    });
  }, [eventRegistrations, participantFilter, certifiedRegIds, participantSearch]);

  // Sync selected participant IDs when filtered list changes (auto-select checked-in participants)
  useEffect(() => {
    if (filteredParticipants.length > 0 && selectedRegIds.size === 0) {
      const newSelected = new Set<string>();
      filteredParticipants.forEach((p) => {
        const id = p.id || p.registrationId;
        if (!certifiedRegIds.has(id)) {
          newSelected.add(id);
        }
      });
      setSelectedRegIds(newSelected);
    }
  }, [filteredParticipants, certifiedRegIds]);

  // Toggle selection
  const handleToggleParticipant = (id: string) => {
    setSelectedRegIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllParticipants = () => {
    if (selectedRegIds.size === filteredParticipants.length) {
      setSelectedRegIds(new Set());
    } else {
      const next = new Set<string>();
      filteredParticipants.forEach((p) => next.add(p.id || p.registrationId));
      setSelectedRegIds(next);
    }
  };

  // Signatory update helper
  const handleUpdateSignatory = (
    index: number,
    field: keyof CertificateSignatory,
    value: string
  ) => {
    setSignatories((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Signature image upload helper (converts to data URL for zero latency)
  const handleSignatureUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid PNG or image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        handleUpdateSignatory(index, "signatureImageUrl", reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save current signatories as persistent default settings
  const handleSaveDefaultSignatories = async () => {
    setIsSavingSignatories(true);
    try {
      await saveCertificateSettings({
        defaultSignatories: signatories,
        defaultCitationTemplate: citationTemplate,
      });
      alert("Institutional signatories saved as default for future certificates!");
    } catch (e) {
      console.error(e);
      alert("Could not save default signatories. Please retry.");
    } finally {
      setIsSavingSignatories(false);
    }
  };

  // Live preview builder for first selected participant
  const handleOpenLivePreview = () => {
    if (!currentEvent) return;

    const firstReg =
      filteredParticipants.find((p) => selectedRegIds.has(p.id || p.registrationId)) ||
      filteredParticipants[0] ||
      eventRegistrations[0];

    const recipientName = firstReg?.participantName || "Harsh Shende";
    const recipientDept = firstReg?.department || "Computer Science & Engineering";
    const eventName = currentEvent.name;

    const resolvedCitation = citationTemplate
      .replace(/{name}/g, recipientName)
      .replace(/{event}/g, eventName)
      .replace(/{date}/g, currentEvent.date || issueDate)
      .replace(/{department}/g, recipientDept);

    const certNum = generateCertificateNumber(currentEvent.slug, firstReg?.ticketCode || "001");
    const previewPayload: CertificateRecord = {
      id: "preview-cert",
      certificateNumber: certNum,
      type: certType,
      title: certTitle,
      recipientName,
      recipientEmail: firstReg?.email || user?.email || "student@jdcoem.ac.in",
      recipientBtId: firstReg?.btId || user?.btId || "BT22CS001",
      recipientDepartment: recipientDept,
      recipientCollege: firstReg?.collegeName || "JDCOEM Nagpur",
      registrationId: firstReg?.id || firstReg?.registrationId || "reg-001",
      ticketCode: firstReg?.ticketCode || "TCK-001",
      eventId: currentEvent.id,
      eventSlug: currentEvent.slug,
      eventName: currentEvent.name,
      eventDate: currentEvent.date,
      organizerClub: currentEvent.organizer || "Student Representation Council",
      clubLogoUrl,
      colorPalette,
      citation: resolvedCitation,
      signatories,
      issueDate,
      status: "PUBLISHED",
      verificationUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/verify/certificate/preview-cert`,
      qrPayload: `${typeof window !== "undefined" ? window.location.origin : ""}/verify/certificate/preview-cert`,
      issuedBy: user?.displayName || "SRC Admin",
      issuedAt: new Date().toISOString(),
    };

    // Save to Firestore and local storage so that scanning the QR on live preview instantly verifies on phone
    saveCertificateToFirestore(previewPayload).catch(console.error);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("src_preview_cert", JSON.stringify(previewPayload));
      } catch {}
    }

    setPreviewCert(previewPayload);
  };

  // 4. Batch Generate and Publish Action
  const handleBatchPublish = async () => {
    if (!currentEvent) return;
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
      const selectedList = eventRegistrations.filter((r) =>
        selectedRegIds.has(r.id || r.registrationId)
      );

      const certsToSave: CertificateRecord[] = [];
      const origin = typeof window !== "undefined" ? window.location.origin : "";

      for (let i = 0; i < selectedList.length; i++) {
        const reg = selectedList[i];
        const regId = reg.id || reg.registrationId;
        const certId = `cert_${currentEvent.slug}_${regId}`;
        const certNum = generateCertificateNumber(currentEvent.slug, reg.ticketCode || regId.slice(-4));

        const resolvedCitation = citationTemplate
          .replace(/{name}/g, reg.participantName || "Participant")
          .replace(/{event}/g, currentEvent.name)
          .replace(/{date}/g, currentEvent.date || issueDate)
          .replace(/{department}/g, reg.department || "Engineering");

        const verificationUrl = `${origin}/verify/certificate/${certId}`;

        certsToSave.push({
          id: certId,
          certificateNumber: certNum,
          type: certType,
          title: certTitle,
          recipientName: reg.participantName || "Delegate",
          recipientEmail: (reg.email || "").trim().toLowerCase(),
          recipientBtId: (reg.btId || "").trim().toUpperCase(),
          recipientDepartment: reg.department || "Engineering",
          recipientYear: reg.year || "Year",
          recipientCollege: reg.collegeName || "JDCOEM Nagpur",
          registrationId: regId,
          ticketCode: reg.ticketCode || "",
          eventId: currentEvent.id,
          eventSlug: currentEvent.slug,
          eventName: currentEvent.name,
          eventDate: currentEvent.date,
          organizerClub: currentEvent.organizer || "SRC Council",
          organizerClubSlug: currentEvent.organizerClubSlug,
          clubLogoUrl,
          posterUrl: currentEvent.posterImage || currentEvent.poster,
          colorPalette,
          citation: resolvedCitation,
          signatories,
          issueDate,
          status: "PUBLISHED",
          verificationUrl,
          qrPayload: verificationUrl,
          issuedBy: user?.displayName || user?.email || "SRC Admin",
          issuedAt: new Date().toISOString(),
        });
      }

      await batchSaveCertificatesToFirestore(certsToSave);

      setPublishSuccessModal({ count: certsToSave.length });
      setSelectedRegIds(new Set());
      setActiveTab("issued");
    } catch (err) {
      console.error("Batch publish error:", err);
      alert("Failed to publish certificates. Please check network and retry.");
    } finally {
      setIsPublishing(false);
      setPublishProgress(null);
    }
  };

  // Revoke action
  const handleConfirmRevoke = async () => {
    if (!revokingCert) return;
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
                Certificate Issuance & Credentials Console
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Generate authentic digital certificates with scannable QR verification & direct student dashboard publishing
              </p>
            </div>
          </div>
        </div>

        {/* Global Stats */}
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Issued Credentials
            </span>
            <span className="font-heading font-extrabold text-lg text-[#17458F]">
              {allCertificates.filter((c) => c.status === "PUBLISHED").length}
            </span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Certified Events
            </span>
            <span className="font-heading font-extrabold text-lg text-emerald-600">
              {new Set(allCertificates.map((c) => c.eventId)).size}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. EVENT SELECTOR BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#17458F]" />
            Target Event:
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="flex-1 max-w-md px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
          >
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.name} ({evt.date || "Scheduled"})
              </option>
            ))}
          </select>

          {isExtractingColor && (
            <span className="text-[11px] text-amber-600 font-bold flex items-center gap-1 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              Sampling 4:5 Poster Colors...
            </span>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("generate")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "issued"
                ? "bg-white text-[#17458F] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#17458F]" />
            Issued ({eventCertificates.length})
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TAB 1: GENERATE CERTIFICATES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "generate" && currentEvent && (
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
                    {filteredParticipants.length} matching delegates • {selectedRegIds.size} selected
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
                  filteredParticipants.map((reg) => {
                    const id = reg.id || reg.registrationId;
                    const isSelected = selectedRegIds.has(id);
                    const isAlreadyCertified = certifiedRegIds.has(id);

                    return (
                      <div
                        key={id}
                        onClick={() => handleToggleParticipant(id)}
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
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-xs text-slate-900">
                                {reg.participantName || "Delegate"}
                              </p>
                              {reg.status === "CHECKED_IN" && (
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
                              {reg.btId ? (
                                <span className="font-mono text-[#E78023] font-bold mr-1.5">
                                  {reg.btId}
                                </span>
                              ) : null}
                              {reg.department} • {reg.email}
                            </p>
                          </div>
                        </div>

                        <span className="font-mono text-[10px] text-slate-400">
                          {reg.ticketCode || id.slice(-6)}
                        </span>
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
                Template Styling & Signatures
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
                        setCitationTemplate("For active and enthusiastic participation in {event}, in recognition of your dedicated presence and technical engagement.");
                      } else if (t === "ACHIEVEMENT") {
                        setCertTitle("CERTIFICATE OF ACHIEVEMENT");
                        setCitationTemplate("For outstanding performance, exceptional dedication, and meritorious achievement in {event}.");
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
                <label className="font-bold text-slate-700 block mb-1">
                  Citation Description
                  <span className="text-[10px] text-slate-400 font-normal ml-1">
                    (Use tokens: &#123;name&#125;, &#123;event&#125;, &#123;date&#125;)
                  </span>
                </label>
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

                  {/* Preset quick buttons */}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setColorPalette(DEFAULT_CERTIFICATE_PALETTES.ocean)}
                      className="w-5 h-5 rounded-full bg-[#0B2545] border border-white shadow-2xs"
                      title="Ocean Blue"
                    />
                    <button
                      type="button"
                      onClick={() => setColorPalette(DEFAULT_CERTIFICATE_PALETTES.royalPurple)}
                      className="w-5 h-5 rounded-full bg-[#2E1065] border border-white shadow-2xs"
                      title="Royal Purple"
                    />
                    <button
                      type="button"
                      onClick={() => setColorPalette(DEFAULT_CERTIFICATE_PALETTES.emerald)}
                      className="w-5 h-5 rounded-full bg-[#064E3B] border border-white shadow-2xs"
                      title="Emerald Forest"
                    />
                    <button
                      type="button"
                      onClick={() => setColorPalette(DEFAULT_CERTIFICATE_PALETTES.crimson)}
                      className="w-5 h-5 rounded-full bg-[#831843] border border-white shadow-2xs"
                      title="Crimson"
                    />
                    <button
                      type="button"
                      onClick={() => setColorPalette(DEFAULT_CERTIFICATE_PALETTES.amberGold)}
                      className="w-5 h-5 rounded-full bg-[#78350F] border border-white shadow-2xs"
                      title="Amber Gold"
                    />
                  </div>
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

              {/* 4 Signatories & PNG Uploads */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Signatory Lines & PNG Signatures
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveDefaultSignatories}
                    disabled={isSavingSignatories}
                    className="text-[10px] font-bold text-[#17458F] hover:underline"
                  >
                    {isSavingSignatories ? "Saving..." : "Save Signatures as Default"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {signatories.map((sig, idx) => (
                    <div
                      key={sig.id || idx}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white text-xs space-y-1.5"
                    >
                      <input
                        type="text"
                        value={sig.designation}
                        onChange={(e) => handleUpdateSignatory(idx, "designation", e.target.value)}
                        placeholder="Designation"
                        className="w-full px-2 py-1 rounded border border-slate-200 font-bold text-[11px]"
                      />
                      <input
                        type="text"
                        value={sig.organization || ""}
                        onChange={(e) => handleUpdateSignatory(idx, "organization", e.target.value)}
                        placeholder="Subtext / Org"
                        className="w-full px-2 py-0.5 rounded border border-slate-200 text-[10px] text-slate-500"
                      />

                      {/* Signature PNG Upload */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <label className="cursor-pointer px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 flex items-center gap-1">
                          <Upload className="w-3 h-3 text-[#17458F]" />
                          {sig.signatureImageUrl ? "Replace PNG" : "Upload PNG"}
                          <input
                            type="file"
                            accept="image/png,image/webp"
                            onChange={(e) => handleSignatureUpload(idx, e)}
                            className="hidden"
                          />
                        </label>
                        {sig.signatureImageUrl && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Ready
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
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
                All digital certificates published for {currentEvent ? currentEvent.name : "all events"}
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
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                  onClick={() =>
                    downloadCertificateAsImage(
                      `modal-cert-${previewCert.id}`,
                      `SRC-Certificate-${previewCert.recipientName.replace(/\s+/g, "_")}`
                    )
                  }
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
