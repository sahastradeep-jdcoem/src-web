"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { 
  Vote, 
  Briefcase, 
  Users, 
  UploadCloud, 
  ShieldAlert, 
  Calendar, 
  Clock, 
  ArrowLeft, 
  CheckCircle2, 
  Share2, 
  Lock, 
  Send,
  Building,
  Check,
  AlertCircle,
  GraduationCap,
  Globe,
  Pencil,
  FileText,
  Sliders,
  ArrowRight,
  ExternalLink,
  LogIn,
  MessageCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { WhatsAppJoinCard } from "@/components/forms/WhatsAppJoinCard";
import { 
  getFormSectionGroups, 
  getVisitedSectionPath, 
  getWhatsAppLinkForPath, 
  getNextSectionTarget, 
  getActiveRouteInfo, 
  pruneSkippedSectionAnswers 
} from "@/lib/srcFormsHelper";
import { Button } from "@/components/ui/Button";
import { DEFAULT_DEPARTMENTS } from "@/data/departments";
import { 
  getStoredListings, 
  subscribeToListings, 
  syncListingsFromFirestore,
  voteOnListingPoll, 
  saveStoredListingResponse,
  getStoredVotedPolls,
  getStoredListingResponses,
  syncListingResponsesFromFirestore,
  subscribeToListingResponses,
  getPollStats
} from "@/lib/listingsStore";
import { ListingItem, ListingResponseRecord } from "@/types/listings";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { isExternalUser as checkIsExternalUser } from "@/lib/usersStore";
import confetti from "canvas-confetti";

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { user, openAuthModal } = useAuth();
  const isExternalUser = checkIsExternalUser(user);

  const [listing, setListing] = useState<ListingItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [allResponses, setAllResponses] = useState<ListingResponseRecord[]>([]);
  const [isEditingResponse, setIsEditingResponse] = useState(false);

  // Form State
  const [candidateName, setCandidateName] = useState(user?.displayName || "");
  const [candidateEmail, setCandidateEmail] = useState(user?.email || "");
  const [candidateDept, setCandidateDept] = useState(user?.department || "");
  const [candidateYear, setCandidateYear] = useState(user?.year || "");
  const [candidateBtId, setCandidateBtId] = useState(user?.btId || "");
  const [submissionLink, setSubmissionLink] = useState("");
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptCode, setReceiptCode] = useState<string | null>(null);
  const [submittedSectionPath, setSubmittedSectionPath] = useState<string[] | undefined>(undefined);
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [sectionHistory, setSectionHistory] = useState<string[]>([]);
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});

  useEffect(() => {
    // Purge any obsolete un-scoped legacy voted key from storage
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("src_voted_polls");
      } catch {}
    }

    if (user?.uid) {
      setVotedPolls(getStoredVotedPolls(user.uid));
    } else {
      setVotedPolls({});
    }
  }, [user]);

  useEffect(() => {
    setAllResponses(getStoredListingResponses());

    syncListingResponsesFromFirestore().then((res) => {
      if (res) setAllResponses(res);
    });

    const unsubResponses = subscribeToListingResponses((updated) => {
      if (updated) setAllResponses(updated);
    });

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("edit") === "true") {
        setIsEditingResponse(true);
      }
    }

    const resolveListing = (list: ListingItem[]) => {
      if (!slug) return null;
      const clean = slug.toLowerCase().trim();
      const matched = list.find(
        (l) =>
          l.isLive !== false &&
          l.status !== "draft" &&
          (l.slug.toLowerCase().trim() === clean ||
           l.id.toLowerCase().trim() === clean ||
           l.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") === clean)
      );
      if (matched) {
        if (matched.type === "poll") {
          router.replace("/hub");
          return null;
        }
        setListing(matched);
        return matched;
      }
      return null;
    };

    // 1. Check local storage
    const initial = getStoredListings();
    const foundInitial = resolveListing(initial);
    if (foundInitial) {
      setIsLoading(false);
    }

    // 2. Fetch fresh from Firestore (CRITICAL for shared direct links e.g. via WhatsApp)
    syncListingsFromFirestore()
      .then((remote) => {
        if (remote && Array.isArray(remote)) {
          const match = resolveListing(remote);
          if (match) setListing(match);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });

    // 3. Real-time live listener
    const unsubListings = subscribeToListings((updated) => {
      if (updated && Array.isArray(updated)) {
        const match = resolveListing(updated);
        if (match) setListing(match);
        setVotedPolls(getStoredVotedPolls());
        setIsLoading(false);
      }
    });

    return () => {
      unsubListings();
      unsubResponses();
    };
  }, [slug]);

  useEffect(() => {
    if (user) {
      if (!candidateName && user.displayName) setCandidateName(user.displayName);
      if (!candidateEmail && user.email) setCandidateEmail(user.email);
      if (user.department && (!candidateDept || candidateDept === "Computer Science & Engineering")) {
        setCandidateDept(user.department);
      }
      if (user.year && (!candidateYear || candidateYear === "3rd Year")) {
        setCandidateYear(user.year);
      }
      if (user.btId && !candidateBtId) setCandidateBtId(user.btId);
    }
  }, [user]);

  // Check if current user has already submitted a response for this listing
  const existingResponse = useMemo(() => {
    if (!listing) return null;
    const cleanListingId = listing.id;
    const cleanSlug = listing.slug;
    const uEmail = (user?.email || "").toLowerCase().trim();
    const uId = user?.uid;
    const cEmail = candidateEmail.toLowerCase().trim();

    return allResponses.find((r) => {
      const matchesListing = r.listingId === cleanListingId || r.listingSlug === cleanSlug;
      if (!matchesListing) return false;

      if (uId && r.userId && r.userId === uId) return true;
      if (uEmail && r.userEmail && r.userEmail.toLowerCase().trim() === uEmail) return true;
      if (cEmail && r.userEmail && r.userEmail.toLowerCase().trim() === cEmail) return true;
      return false;
    }) || null;
  }, [listing, allResponses, user, candidateEmail]);

  // Prepopulate form fields if an existing response exists
  useEffect(() => {
    if (existingResponse) {
      if (existingResponse.userName) setCandidateName(existingResponse.userName);
      if (existingResponse.userEmail) setCandidateEmail(existingResponse.userEmail);
      // Prioritize user's actual profile department if existing response had the old hardcoded fallback
      if (user?.department && (existingResponse.userDepartment === "Computer Science & Engineering" || !existingResponse.userDepartment)) {
        setCandidateDept(user.department);
      } else if (existingResponse.userDepartment) {
        setCandidateDept(existingResponse.userDepartment);
      }
      if (user?.year && (existingResponse.userYear === "3rd Year" || !existingResponse.userYear)) {
        setCandidateYear(user.year);
      } else if (existingResponse.userYear) {
        setCandidateYear(existingResponse.userYear);
      }
      if (existingResponse.btId) setCandidateBtId(existingResponse.btId);
      if (existingResponse.submissionLink) setSubmissionLink(existingResponse.submissionLink);
      if (existingResponse.answers) setCustomAnswers(existingResponse.answers);
    }
  }, [existingResponse, user]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleShare = async () => {
    if (!listing) return;

    const canonicalUrl = typeof window !== "undefined"
      ? `${window.location.origin}/hub/${listing.slug || slug}`
      : `https://www.srcjdcoem.in/hub/${listing.slug || slug}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(canonicalUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = canonicalUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedLink(true);
      showToast("Link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast("Failed to copy link. Please copy from address bar.");
    }
  };

  const handleVote = (optionId: string) => {
    if (!listing) return;
    if (listing.status === "closed" || listing.isAcceptingResponses === false) {
      showToast("Voting is closed for this poll.");
      return;
    }
    if (!user) {
      openAuthModal();
      showToast("Please sign in with your student account to cast your vote.");
      return;
    }
    if ((listing.targetAudience === "jdcoem_only" || listing.isInterCollege === false) && isExternalUser) {
      showToast("Voting is strictly reserved for JDCOEM students.");
      return;
    }
    const voterKey = user.email || user.uid;
    const voterInfo = {
      userId: user.uid,
      userName: user.displayName || (user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : undefined),
      userEmail: user.email,
      userDepartment: user.department,
      userYear: user.year,
      btId: user.btId,
      isAnonymous: Boolean(listing.pollConfig?.isAnonymous),
    };
    const res = voteOnListingPoll(listing.id, optionId, voterKey, voterInfo);
    if (res.success) {
      if (res.updatedListing) {
        setListing(res.updatedListing);
      }
      setAllResponses(getStoredListingResponses());
      setVotedPolls(getStoredVotedPolls(user.uid));
      showToast("Vote recorded successfully!");
      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } catch {}
    } else {
      showToast(res.error || "Failed to submit vote.");
    }
  };

  const formSections = useMemo(() => {
    return getFormSectionGroups(listing?.customQuestions || []);
  }, [listing?.customQuestions]);

  const currentSectionId = activeSectionId && formSections.some((s) => s.id === activeSectionId)
    ? activeSectionId
    : formSections[0]?.id || "section-1";

  const currentSection = formSections.find((s) => s.id === currentSectionId) || formSections[0];
  const currentSectionIdx = formSections.findIndex((s) => s.id === currentSection?.id);
  const isFirstSection = currentSectionIdx <= 0;
  const canGoBack = sectionHistory.length > 0;

  const activeRouteInfo = useMemo(() => {
    return getActiveRouteInfo(formSections, customAnswers, currentSectionId, sectionHistory);
  }, [formSections, customAnswers, currentSectionId, sectionHistory]);

  const isLastStep = activeRouteInfo.isLastStep;

  const scrollToFormTop = () => {
    if (typeof window === "undefined") return;
    const card = document.getElementById("form-card-root") || document.getElementById("apply");
    if (card) {
      const yOffset = -76;
      const y = card.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  };

  const scrollToField = (fieldId: string) => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(`field-${fieldId}`) || document.getElementById(`field-container-${fieldId}`);
    if (el) {
      const yOffset = -110;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      const focusable = (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")
        ? el
        : el.querySelector("input, textarea, select, button");
      (focusable as HTMLElement)?.focus?.();
    }
  };

  const handleNextSection = () => {
    if (!currentSection) return;

    // Validate Section 1 identity info
    if (isFirstSection) {
      if (!candidateName.trim()) {
        showToast("Please enter your full name.");
        scrollToField("candidateName");
        return;
      }
      if (!candidateEmail.trim() || !candidateEmail.includes("@")) {
        showToast("Please enter a valid email address.");
        scrollToField("candidateEmail");
        return;
      }
      if (listing?.type === "submission" && !submissionLink.trim()) {
        showToast("Please provide your submission drive/portfolio link.");
        scrollToField("submissionLink");
        return;
      }
    }

    // Validate required questions in current section
    for (const q of currentSection.fields) {
      if (q.type === "note" || q.type === "section" || q.type === "whatsapp_link") continue;
      if (q.required) {
        const val = customAnswers[q.id];
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          (typeof val === "string" && !val.trim()) ||
          (Array.isArray(val) && val.length === 0)
        ) {
          showToast(`Please answer required question: "${q.question}"`);
          scrollToField(q.id);
          return;
        }
      }
    }

    const target = activeRouteInfo.nextTarget;
    if (target === "submit") {
      handleFormSubmit();
    } else {
      setSectionHistory((prev) => [...prev, currentSection.id]);
      setActiveSectionId(target);
      scrollToFormTop();
    }
  };

  const handlePrevSection = () => {
    if (sectionHistory.length === 0) return;
    const prevSecId = sectionHistory[sectionHistory.length - 1];
    setSectionHistory((prev) => prev.slice(0, -1));
    setActiveSectionId(prevSecId);
    scrollToFormTop();
  };

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!listing) return;
    if (listing.status === "closed" || listing.isAcceptingResponses === false) {
      showToast("This form is no longer accepting responses.");
      return;
    }
    if (!user) {
      openAuthModal();
      showToast("Please sign in with your student account to submit this form.");
      return;
    }
    if ((listing.targetAudience === "jdcoem_only" || listing.isInterCollege === false) && isExternalUser) {
      showToast("Submissions are strictly reserved for JDCOEM students.");
      return;
    }

    // Validate participant identity
    if (!candidateName.trim()) {
      showToast("Please enter your full name.");
      scrollToField("candidateName");
      return;
    }
    if (!candidateEmail.trim() || !candidateEmail.includes("@")) {
      showToast("Please enter a valid email address.");
      scrollToField("candidateEmail");
      return;
    }
    if (listing.type === "submission" && !submissionLink.trim()) {
      showToast("Please provide your submission drive/portfolio link.");
      scrollToField("submissionLink");
      return;
    }

    // Validate required questions along the traversed branching path only
    const allSections = getFormSectionGroups(listing.customQuestions || []);
    if (allSections.length > 1) {
      const visited = new Set<string>();
      let curSec: typeof allSections[0] | undefined = allSections[0];

      while (curSec && !visited.has(curSec.id)) {
        visited.add(curSec.id);
        for (const field of curSec.fields) {
          if (field.type === "note" || field.type === "section" || field.type === "whatsapp_link") continue;
          if (field.required) {
            const val = customAnswers[field.id];
            if (
              val === undefined ||
              val === null ||
              val === "" ||
              (typeof val === "string" && !val.trim()) ||
              (Array.isArray(val) && val.length === 0)
            ) {
              setActiveSectionId(curSec.id);
              showToast(`Please answer required question: "${field.question}"`);
              setTimeout(() => scrollToField(field.id), 60);
              return;
            }
          }
        }

        const nextTarget = getNextSectionTarget(curSec, allSections, customAnswers);
        if (nextTarget === "submit") break;
        curSec = allSections.find((s) => s.id === nextTarget);
      }
    } else if (allSections.length === 1) {
      for (const q of allSections[0].fields) {
        if (q.type === "note" || q.type === "section" || q.type === "whatsapp_link") continue;
        if (q.required) {
          const val = customAnswers[q.id];
          if (
            val === undefined ||
            val === null ||
            val === "" ||
            (typeof val === "string" && !val.trim()) ||
            (Array.isArray(val) && val.length === 0)
          ) {
            showToast(`Please answer required question: "${q.question}"`);
            scrollToField(q.id);
            return;
          }
        }
      }
    }

    setIsSubmitting(true);

    const isUpdate = Boolean(existingResponse);
    const ticketCode = existingResponse?.ticketCode || `SRC-${listing.type.toUpperCase().slice(0, 3)}-${Math.floor(10000 + Math.random() * 90000)}`;

    const finalSectionPath = activeRouteInfo.visitedPath.length > 0
      ? activeRouteInfo.visitedPath
      : (listing.customQuestions ? getVisitedSectionPath(formSections, customAnswers) : undefined);

    const prunedAnswers = pruneSkippedSectionAnswers(
      formSections,
      finalSectionPath || [],
      customAnswers
    );

    const responseRecord: ListingResponseRecord = {
      id: existingResponse ? existingResponse.id : `resp-${Date.now()}`,
      listingId: listing.id,
      listingSlug: listing.slug,
      listingType: listing.type,
      listingTitle: listing.title,
      userId: user?.uid || existingResponse?.userId,
      userEmail: candidateEmail,
      userName: candidateName,
      userDepartment: candidateDept,
      userYear: candidateYear,
      btId: candidateBtId || existingResponse?.btId || undefined,
      isAnonymous: Boolean(listing.issueConfig?.allowAnonymous),
      answers: Object.keys(prunedAnswers).length > 0 ? prunedAnswers : undefined,
      sectionPath: finalSectionPath,
      submissionLink: submissionLink || undefined,
      ticketCode,
      status: (listing.requiresApproval === false && existingResponse?.status !== "rejected")
        ? "approved"
        : (existingResponse?.status || "pending"),
      createdAt: existingResponse?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveStoredListingResponse(responseRecord);

    setTimeout(() => {
      setIsSubmitting(false);
      if (isUpdate) {
        setIsEditingResponse(false);
        showToast("Your response has been updated successfully!");
        scrollToFormTop();
      } else {
        setReceiptCode(ticketCode);
        setSubmittedSectionPath(finalSectionPath);
        scrollToFormTop();
      }
      try {
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });
      } catch {}
    }, 450);
  };

  if (isLoading && !listing) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="space-y-4 text-center">
          <div className="w-10 h-10 rounded-full border-3 border-[#17458F]/20 border-t-[#17458F] animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Loading Engagement Listing...
          </p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-4 max-w-md shadow-xs">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="font-heading font-extrabold text-xl text-slate-900 uppercase">
            Listing Not Found
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            The requested student engagement listing may have closed, been archived, or does not exist.
          </p>
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#17458F] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#123670] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Engagement Hub</span>
          </Link>
        </div>
      </div>
    );
  }

  const isPoll = listing.type === "poll";
  const isOpp = listing.type === "opportunity";
  const isSub = listing.type === "submission";
  const isIssue = listing.type === "issue";
  const isJdcoemOnly = listing.targetAudience === "jdcoem_only" || listing.isInterCollege === false;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans pb-24">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb Nav */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-6 flex items-center justify-between">
        <Link
          href="/hub"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#17458F] uppercase tracking-wider transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Student Hub</span>
        </Link>

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#17458F] text-slate-700 hover:text-[#17458F] text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{copiedLink ? "Copied" : "Share"}</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        
        {/* Main Card */}
        <div id="form-card-root" className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden space-y-6 scroll-mt-24 sm:scroll-mt-28">
          
          {/* Cover Header */}
          {listing.coverImage ? (
            <div className="relative h-64 sm:h-80 w-full bg-slate-100">
              <Image
                src={listing.coverImage}
                alt={listing.title}
                fill
                unoptimized={true}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-[#E78023] text-white">
                    {listing.type.toUpperCase()}
                  </span>
                  <span className={cn(
                    "text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full text-white inline-flex items-center gap-1",
                    isJdcoemOnly ? "bg-amber-600/90" : "bg-emerald-600/90"
                  )}>
                    {isJdcoemOnly ? <GraduationCap className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                    <span>{isJdcoemOnly ? "JDCOEM Only" : "Inter-College"}</span>
                  </span>
                  {(listing.status === "closed" || listing.isAcceptingResponses === false) && (
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-rose-600 text-white inline-flex items-center gap-1 shadow-xs">
                      <Lock className="w-3 h-3" />
                      <span>Responses Closed</span>
                    </span>
                  )}
                </div>
                <h1 className="font-heading font-extrabold text-2xl sm:text-4xl uppercase tracking-tight text-white">
                  {listing.title}
                </h1>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-gradient-to-br from-[#17458F] to-slate-900 text-white space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-[#E78023] text-white">
                  {listing.type.toUpperCase()}
                </span>
                <span className={cn(
                  "text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full text-white inline-flex items-center gap-1",
                  isJdcoemOnly ? "bg-amber-600" : "bg-emerald-600"
                )}>
                  {isJdcoemOnly ? <GraduationCap className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                  <span>{isJdcoemOnly ? "JDCOEM Only" : "Inter-College"}</span>
                </span>
                {(listing.status === "closed" || listing.isAcceptingResponses === false) && (
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-rose-600 text-white inline-flex items-center gap-1 shadow-xs">
                    <Lock className="w-3 h-3" />
                    <span>Responses Closed</span>
                  </span>
                )}
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-4xl uppercase tracking-tight text-white">
                {listing.title}
              </h1>
            </div>
          )}

          {/* Metadata Badges & Overview: Displayed on the first section only */}
          {isFirstSection && (
            <>
              {/* Metadata Badges */}
              <div className="px-6 sm:px-8 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                {(listing.status === "closed" || listing.isAcceptingResponses === false) ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-rose-50 text-rose-700 border-rose-200">
                    <Lock className="w-3.5 h-3.5 text-rose-600" />
                    <span>Responses Closed</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Accepting Responses</span>
                  </span>
                )}
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                  isJdcoemOnly
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                )}>
                  {isJdcoemOnly ? <GraduationCap className="w-3.5 h-3.5 text-amber-600" /> : <Globe className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{isJdcoemOnly ? "JDCOEM Students Only" : "Open Inter-College"}</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                  <Building className="w-4 h-4 text-[#17458F]" />
                  <span>Organized by {listing.organizer}</span>
                </span>
                {listing.deadline && (
                  <span className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                    <Clock className="w-4 h-4 text-[#E78023]" />
                    <span>Deadline: {listing.deadline}</span>
                  </span>
                )}
                {isIssue && (
                  <span className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                    <Lock className="w-3.5 h-3.5 text-rose-600" />
                    <span>Confidential Channel</span>
                  </span>
                )}
              </div>

              {/* Description Body */}
              <div className="px-6 sm:px-8 space-y-4">
                <h2 className="font-heading font-bold text-base text-slate-800 uppercase tracking-wider">
                  Overview &amp; Guidelines
                </h2>
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-line">
                  {listing.description || listing.summary}
                </div>
              </div>
            </>
          )}

          {/* LIVE POLL PARTICIPATION */}
          {isPoll && listing.pollConfig && (() => {
            const userVotedOptionId = user && listing ? votedPolls[listing.id] : null;
            const isOptionValid = Boolean(listing && userVotedOptionId && listing.pollConfig.options.some((o) => o.id === userVotedOptionId));
            const hasVoted = Boolean(user) && Boolean(userVotedOptionId) && isOptionValid;
            const isPollClosed = listing.status === "closed" || listing.isAcceptingResponses === false;
            const pollStats = getPollStats(listing, allResponses, user?.uid, userVotedOptionId);

            return (
              <div className="p-6 sm:p-8 border-t border-slate-200 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-extrabold text-lg text-[#17458F] uppercase">
                    {hasVoted ? "Poll Results" : isPollClosed ? "Poll Results (Closed)" : "Cast Your Vote"}
                  </h3>
                  <span className="text-xs font-bold text-slate-400">
                    {isPollClosed
                      ? "🔒 Voting is closed"
                      : !user
                      ? "Sign in to vote"
                      : hasVoted
                      ? "✓ Vote Submitted"
                      : "Select an option below"}
                  </span>
                </div>

                {isPollClosed && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-rose-800 text-xs font-bold">
                    <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>This poll is closed and no longer accepting votes.</span>
                  </div>
                )}

                {!user && !isPollClosed && (
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-[#17458F]">
                    <div className="flex items-center gap-2.5">
                      <Lock className="w-4 h-4 text-[#17458F] shrink-0" />
                      <span>Sign in with your student account to participate in this poll.</span>
                    </div>
                    <button
                      type="button"
                      onClick={openAuthModal}
                      className="px-4 py-2 rounded-xl bg-[#17458F] text-white hover:bg-[#123670] transition-colors shrink-0 cursor-pointer text-xs font-bold text-center"
                    >
                      Sign In to Vote
                    </button>
                  </div>
                )}

                {isJdcoemOnly && isExternalUser && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-amber-800 text-xs font-bold">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Voting is restricted to JDCOEM students.</span>
                  </div>
                )}

                <div className="space-y-3">
                  {pollStats.computedOptions.map((opt) => {
                    const pct = pollStats.totalVotes > 0 ? Math.round((opt.votes / pollStats.totalVotes) * 100) : 0;
                    const isSelectedByUser = userVotedOptionId === opt.id;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={(isJdcoemOnly && isExternalUser) || hasVoted || isPollClosed}
                        onClick={() => {
                          if (isPollClosed) {
                            showToast("Voting is closed for this poll.");
                            return;
                          }
                          if (!user) {
                            openAuthModal();
                            showToast("Please sign in with your student account to cast your vote.");
                            return;
                          }
                          if (!hasVoted) {
                            handleVote(opt.id);
                          }
                        }}
                        className={cn(
                          "w-full relative overflow-hidden rounded-2xl border p-4 text-left transition-all",
                          (isJdcoemOnly && isExternalUser) || (isPollClosed && !hasVoted)
                            ? "border-slate-200 bg-slate-50/70 opacity-80 cursor-not-allowed"
                            : (hasVoted || isPollClosed)
                            ? isSelectedByUser
                              ? "border-[#17458F] bg-blue-50/40 cursor-default"
                              : "border-slate-200 bg-slate-50/60 cursor-default"
                            : "border-slate-200 bg-slate-50 hover:bg-white hover:border-[#17458F] cursor-pointer group"
                        )}
                      >
                        {/* Background percentage fill bar — shown after selecting vote or when poll closed */}
                        {(hasVoted || isPollClosed) && (
                          <div
                            className={cn(
                              "absolute left-0 top-0 bottom-0 -z-10 transition-all duration-700",
                              isSelectedByUser ? "bg-[#17458F]/15" : "bg-slate-200/60"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        )}

                        <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800">
                          <div className="flex items-center gap-3">
                            {isPollClosed && !hasVoted ? (
                              <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                            ) : !hasVoted ? (
                              <span className="w-4 h-4 rounded-full border-2 border-slate-300 group-hover:border-[#17458F] flex items-center justify-center shrink-0">
                                <span className="w-2 h-2 rounded-full bg-transparent group-hover:bg-[#17458F] transition-colors" />
                              </span>
                            ) : isSelectedByUser ? (
                              <span className="w-4 h-4 rounded-full bg-[#17458F] text-white flex items-center justify-center shrink-0 text-[10px]">
                                ✓
                              </span>
                            ) : (
                              <span className="w-4 h-4 rounded-full border border-slate-200 shrink-0" />
                            )}
                            <span className={cn(
                              (hasVoted || isPollClosed)
                                ? isSelectedByUser ? "text-[#17458F] font-extrabold" : "text-slate-700"
                                : (isJdcoemOnly && isExternalUser ? "" : "group-hover:text-[#17458F] transition-colors")
                            )}>
                              {opt.text}
                            </span>
                          </div>

                          {/* Show percent after selecting vote or if poll is closed */}
                          {(hasVoted || isPollClosed) && (
                            <div className="flex items-center gap-2 shrink-0">
                              {isSelectedByUser && (
                                <span className="text-[10px] font-mono font-bold text-[#17458F] bg-blue-100 px-2 py-0.5 rounded-md">
                                  Your Vote
                                </span>
                              )}
                              <span className="font-mono text-sm font-extrabold text-[#17458F]">{pct}%</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* APPLICATION / SUBMISSION / GRIEVANCE FORM */}
          {!isPoll && (() => {
            const isClosed = listing.status === "closed" || listing.isAcceptingResponses === false;

            return (
              <div id="apply" className={cn("p-6 sm:p-8 space-y-6 scroll-mt-24", isFirstSection && "border-t border-slate-200")}>
                {(isIssue || isClosed) && (
                  <div className="flex items-center justify-between gap-3">
                    {isIssue && (
                      <h3 className="font-heading font-extrabold text-lg text-[#17458F] uppercase">
                        Submit Confidential Inquiry
                      </h3>
                    )}
                    {isClosed && (
                      <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1 shadow-2xs ml-auto">
                        <Lock className="w-3 h-3 text-rose-600" />
                        <span>Responses Closed</span>
                      </span>
                    )}
                  </div>
                )}

                {isJdcoemOnly && isExternalUser ? (
                  <div className="p-8 rounded-3xl bg-amber-50/80 border border-amber-200/80 text-center space-y-4">
                    <div className="inline-flex p-3 rounded-2xl bg-amber-100 text-amber-700">
                      <Lock className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-heading font-extrabold text-lg text-amber-950 uppercase">
                        Restricted to JDCOEM Students
                      </h4>
                      <p className="text-xs text-amber-800 max-w-md mx-auto leading-relaxed">
                        This initiative is reserved exclusively for enrolled students of JDCOEM. While external guests can view the guidelines and announcements, submissions and voting require a verified JDCOEM student account.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
                      >
                        <span>Sign in with JDCOEM Account</span>
                      </Link>
                    </div>
                  </div>
                ) : receiptCode ? (
                  <div className="p-8 rounded-3xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
                    <div className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h4 className="font-heading font-extrabold text-xl text-emerald-950 uppercase">
                      Submission Received
                    </h4>
                    <p className="text-xs text-emerald-800 font-sans max-w-sm mx-auto">
                      Your response has been registered and synced to the central database.
                    </p>
                    <div className="p-3 bg-white rounded-xl border border-emerald-200 max-w-xs mx-auto">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Reference ID</span>
                      <span className="font-mono font-extrabold text-lg text-[#17458F]">{receiptCode}</span>
                    </div>
                    {(() => {
                      const sections = getFormSectionGroups(listing.customQuestions || []);
                      const pathWa = submittedSectionPath
                        ? getWhatsAppLinkForPath(sections, submittedSectionPath)
                        : null;
                      const fallbackWa = listing.customQuestions?.find((q) => q.type === "whatsapp_link" && q.waGroupUrl);
                      const effectiveWaUrl = pathWa?.waGroupUrl || listing.whatsappGroupUrl || fallbackWa?.waGroupUrl;
                      const effectiveWaName = pathWa?.waGroupName || pathWa?.question || listing.whatsappGroupName || fallbackWa?.waGroupName || fallbackWa?.question || "Official WhatsApp Group";
                      if (!effectiveWaUrl) return null;
                      return (
                        <div className="pt-2 max-w-lg mx-auto text-left">
                          <WhatsAppJoinCard
                            whatsappGroupUrl={effectiveWaUrl}
                            whatsappGroupName={effectiveWaName}
                            variant="card"
                            title="Official WhatsApp Group"
                            subtitle="Join the group for quick updates and coordinator contact."
                          />
                        </div>
                      );
                    })()}
                    <div className="pt-1">
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-2xs"
                      >
                        <span>Track in Student Dashboard</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ) : existingResponse && !isEditingResponse ? (
                  /* PREVENT DUPLICATES: ALREADY SUBMITTED VIEW */
                  <div className="p-6 sm:p-8 rounded-3xl bg-slate-50/80 border border-slate-200 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-heading font-extrabold text-base text-slate-900 uppercase">
                              You&apos;ve Already Submitted This Form
                            </h4>
                            <span className={cn(
                              "text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                              existingResponse.status === "approved" || existingResponse.status === "resolved"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : existingResponse.status === "rejected"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            )}>
                              {existingResponse.status?.toUpperCase() || "PENDING REVIEW"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium pt-0.5">
                            Submitted on {new Date(existingResponse.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            {existingResponse.updatedAt && (
                              <span className="text-slate-400"> • Updated {new Date(existingResponse.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex sm:flex-col items-center sm:items-end justify-between gap-0.5 shrink-0 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Reference Ticket</span>
                        <span className="font-mono font-extrabold text-xs text-[#17458F]">{existingResponse.ticketCode}</span>
                      </div>
                    </div>

                    {/* Summary of Recorded Responses */}
                    <div className="space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                        Your Recorded Responses
                      </span>
                      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs shadow-2xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-100 text-slate-600">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Applicant Name</span>
                            <span className="font-bold text-slate-900">{existingResponse.userName}</span> ({existingResponse.userEmail})
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Academic Details</span>
                            <span className="font-medium text-slate-900">{existingResponse.userDepartment} • {existingResponse.userYear}</span>
                            {existingResponse.btId && <span className="font-mono text-slate-500 block">BT ID: {existingResponse.btId}</span>}
                          </div>
                        </div>

                        {existingResponse.submissionLink && (
                          <div className="pb-3 border-b border-slate-100">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Portfolio / Repo Link</span>
                            <a
                              href={existingResponse.submissionLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17458F] hover:underline"
                            >
                              <span>{existingResponse.submissionLink}</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        )}

                        {listing.customQuestions && listing.customQuestions.length > 0 && (
                          <div className="space-y-2.5 pt-1">
                            {listing.customQuestions.filter(q => q.type !== "note" && q.type !== "section" && q.type !== "whatsapp_link").map((q) => {
                              const ans = existingResponse.answers?.[q.id];
                              return (
                                <div key={q.id} className="space-y-1">
                                  <span className="text-[11px] font-bold text-slate-500 block">{q.question}</span>
                                  <p className="text-xs font-semibold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                    {Array.isArray(ans) ? ans.join(", ") : ans ? String(ans) : "No response provided"}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* WhatsApp Group Join Card for existing submission — section-path aware */}
                        {(() => {
                          const sections = getFormSectionGroups(listing.customQuestions || []);
                          const pathWa = existingResponse?.sectionPath
                            ? getWhatsAppLinkForPath(sections, existingResponse.sectionPath)
                            : null;
                          const fallbackWa = listing.customQuestions?.find((q) => q.type === "whatsapp_link" && q.waGroupUrl);
                          const effectiveWaUrl = pathWa?.waGroupUrl || listing.whatsappGroupUrl || fallbackWa?.waGroupUrl;
                          const effectiveWaName = pathWa?.waGroupName || pathWa?.question || listing.whatsappGroupName || fallbackWa?.waGroupName || fallbackWa?.question || "Official WhatsApp Group";
                          if (!effectiveWaUrl) return null;
                          return (
                            <div className="pt-2">
                              <WhatsAppJoinCard
                                whatsappGroupUrl={effectiveWaUrl}
                                whatsappGroupName={effectiveWaName}
                                variant="card"
                                title="Official WhatsApp Group"
                                subtitle="Join the group for real-time circulars, coordinator updates, and team collaboration."
                              />
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                      {isClosed ? (
                        <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold py-1">
                          <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>Responses are closed. Edits are no longer accepted.</span>
                        </div>
                      ) : listing.allowResponseEditing !== false ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingResponse(true);
                            setActiveSectionId(formSections[0]?.id || "section-1");
                            setSectionHistory([]);
                            scrollToFormTop();
                          }}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit Your Response</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium py-1">
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Response editing is disabled for this listing by council administrators.</span>
                        </div>
                      )}

                      <Link
                        href="/dashboard"
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <span>View in Student Dashboard</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ) : isClosed ? (
                  /* RESPONSES CLOSED GUARD FOR UNREGISTERED STUDENTS */
                  <div className="p-8 sm:p-10 rounded-3xl bg-slate-50 border border-slate-200 text-center space-y-4 max-w-lg mx-auto shadow-2xs animate-in fade-in duration-300">
                    <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-heading font-extrabold text-xl text-slate-900 uppercase">
                        Responses Are Closed
                      </h4>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-sm mx-auto">
                        This {isIssue ? "confidential inquiry channel" : isSub ? "submission portal" : isOpp ? "application form" : "form"} is no longer accepting new responses. Thank you for your interest!
                      </p>
                    </div>
                    <div className="pt-2">
                      <Link
                        href="/hub"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Engagement Hub</span>
                      </Link>
                    </div>
                  </div>
                ) : !user ? (
                  /* Unauthenticated Guard: Student Sign-In Required */
                  <div className="p-8 sm:p-10 rounded-3xl bg-blue-50/70 border border-blue-200 text-center space-y-4 max-w-lg mx-auto shadow-xs animate-in fade-in duration-300">
                    <div className="w-14 h-14 rounded-2xl bg-[#17458F] text-white flex items-center justify-center mx-auto shadow-md">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-heading font-extrabold text-xl text-[#0F172A] uppercase">
                        Student Authentication Required
                      </h4>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed max-w-sm mx-auto">
                        Please sign in with your student Google account to fill out and submit this {isIssue ? "confidential inquiry" : isSub ? "submission" : isOpp ? "application" : "form"}.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button
                        onClick={openAuthModal}
                        variant="primary"
                        size="md"
                        className="gap-2 mx-auto cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>Sign In with Student Account</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form
                    id="hub-form-container"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (isLastStep) {
                        handleFormSubmit(e);
                      } else {
                        handleNextSection();
                      }
                    }}
                    className="space-y-5"
                  >
                  {existingResponse && isEditingResponse && (
                    <div className="p-4 rounded-2xl bg-blue-50/90 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-blue-950 animate-in fade-in">
                      <div className="flex items-center gap-2.5">
                        <span className="p-1.5 bg-[#17458F] text-white rounded-lg shrink-0">
                          <Pencil className="w-4 h-4" />
                        </span>
                        <div>
                          <p className="text-xs font-bold">You are editing your previously submitted response</p>
                          <p className="text-[11px] text-blue-800">Ticket Ref: <span className="font-mono font-bold">{existingResponse.ticketCode}</span> • Changes will update your active response.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingResponse(false);
                          setActiveSectionId(formSections[0]?.id || "section-1");
                          setSectionHistory([]);
                        }}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-white border border-slate-200 self-start sm:self-center transition-colors cursor-pointer"
                      >
                        Cancel Editing
                      </button>
                    </div>
                  )}

                  {/* Section Progress Header for multi-section forms */}
                  {formSections.length > 1 && currentSection && (
                    <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/90 via-slate-50 to-indigo-50/80 border border-blue-100 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#17458F]/10 text-[#17458F]">
                          Section {activeRouteInfo.currentStepNumber} of {activeRouteInfo.totalSteps}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {activeRouteInfo.progressPercent}% Completed
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={activeRouteInfo.progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Form completion progress: ${activeRouteInfo.progressPercent}%`}
                        className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden"
                      >
                        <div
                          className="h-full bg-[#17458F] transition-all duration-500 ease-out rounded-full"
                          style={{ width: `${activeRouteInfo.progressPercent}%` }}
                        />
                      </div>
                      {currentSection.title && !/^section(\s*\d+)?$/i.test(currentSection.title.trim()) && (
                        <h4 className="font-heading font-extrabold text-sm text-slate-900 pt-0.5">
                          {currentSection.title}
                        </h4>
                      )}
                      {currentSection.description && (
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {currentSection.description}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Section 1 Identity Fields (or only section if single-section) */}
                  {(isFirstSection || formSections.length <= 1) && (
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div id="field-container-candidateName" className="space-y-1">
                          <label htmlFor="field-candidateName" className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                            <span>Full Name</span>
                            <span className="text-rose-500 font-bold">*</span>
                          </label>
                          <input
                            id="field-candidateName"
                            type="text"
                            required
                            value={candidateName}
                            onChange={(e) => setCandidateName(e.target.value)}
                            className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/15 transition-all"
                          />
                        </div>
                        <div id="field-container-candidateEmail" className="space-y-1">
                          <label htmlFor="field-candidateEmail" className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                            <span>Email Address</span>
                            <span className="text-rose-500 font-bold">*</span>
                          </label>
                          <input
                            id="field-candidateEmail"
                            type="email"
                            required
                            value={candidateEmail}
                            onChange={(e) => setCandidateEmail(e.target.value)}
                            className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/15 transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div id="field-container-candidateDept">
                          <label htmlFor="field-candidateDept" className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Department
                          </label>
                          <input
                            id="field-candidateDept"
                            type="text"
                            list="hub-dept-list"
                            value={candidateDept}
                            onChange={(e) => setCandidateDept(e.target.value)}
                            placeholder="Select or enter department"
                            className="w-full px-3.5 py-3 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/15 transition-all"
                          />
                          <datalist id="hub-dept-list">
                            {DEFAULT_DEPARTMENTS.map((d) => (
                              <option key={d} value={d} />
                            ))}
                          </datalist>
                        </div>
                        <div id="field-container-candidateYear">
                          <label htmlFor="field-candidateYear" className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Academic Year
                          </label>
                          <input
                            id="field-candidateYear"
                            type="text"
                            value={candidateYear}
                            onChange={(e) => setCandidateYear(e.target.value)}
                            className="w-full px-3.5 py-3 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/15 transition-all"
                          />
                        </div>
                        <div id="field-container-candidateBtId">
                          <label htmlFor="field-candidateBtId" className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            BT ID
                          </label>
                          <input
                            id="field-candidateBtId"
                            type="text"
                            value={candidateBtId}
                            onChange={(e) => setCandidateBtId(e.target.value.toUpperCase())}
                            placeholder="BT23..."
                            className="w-full px-3.5 py-3 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/15 transition-all"
                          />
                        </div>
                      </div>

                      {listing.type === "submission" && (
                        <div id="field-container-submissionLink" className="space-y-1 pt-1">
                          <label htmlFor="field-submissionLink" className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                            <span>Submission Drive / Portfolio Link</span>
                            <span className="text-rose-500 font-bold">*</span>
                          </label>
                          <input
                            id="field-submissionLink"
                            type="url"
                            required
                            value={submissionLink}
                            onChange={(e) => setSubmissionLink(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/15 transition-all"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section Fields */}
                  <div className="space-y-4 pt-1">
                    {(currentSection ? currentSection.fields : (listing.customQuestions || [])).map((q) => {
                      if (q.type === "note") {
                        return (
                          <div key={q.id} className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1 my-2">
                            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                              <AlertCircle className="w-4 h-4 text-[#E78023] shrink-0" />
                              <span>{q.question || "Important Notice"}</span>
                            </div>
                            {q.noteContent && (
                              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line pl-6">
                                {q.noteContent}
                              </p>
                            )}
                          </div>
                        );
                      }

                      if (q.type === "section") {
                        return null;
                      }

                      if (q.type === "whatsapp_link") {
                        return (
                          <div key={q.id} className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 flex items-center gap-3.5 my-2">
                            <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
                              <MessageCircle className="w-5 h-5 fill-[#25D366]" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-emerald-950">
                                {q.question || "Official WhatsApp Group"}
                              </p>
                              <p className="text-[11px] text-emerald-700 font-medium">
                                {q.description || "The official WhatsApp group invite link will be provided immediately upon submitting your response."}
                              </p>
                              {q.waGroupName && (
                                <p className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-wider">
                                  Group: {q.waGroupName}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={q.id} id={`field-container-${q.id}`} className="space-y-1.5 pt-2">
                          <div className="space-y-0.5">
                            <label htmlFor={`field-${q.id}`} className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span>{q.question}</span>
                              {q.required && <span className="text-rose-500 font-bold">*</span>}
                            </label>
                            {q.description && (
                              <p className="text-[11px] text-slate-500 font-medium leading-normal">
                                {q.description}
                              </p>
                            )}
                          </div>

                          {q.type === "long_text" ? (
                            <textarea
                              id={`field-${q.id}`}
                              rows={3}
                              required={q.required}
                              placeholder={q.placeholder || "Enter detailed response..."}
                              value={customAnswers[q.id] || ""}
                              onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                              className="w-full px-3.5 py-3 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/15 transition-all resize-y min-h-[90px]"
                            />
                          ) : q.type === "checkboxes" ? (
                            <div className="space-y-2 pt-1">
                              {(q.options || []).map((opt) => {
                                const selectedList: string[] = Array.isArray(customAnswers[q.id])
                                  ? customAnswers[q.id]
                                  : [];
                                const isChecked = selectedList.includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                      const next = isChecked
                                        ? selectedList.filter((item) => item !== opt)
                                        : [...selectedList, opt];
                                      setCustomAnswers({ ...customAnswers, [q.id]: next });
                                    }}
                                    className={cn(
                                      "w-full flex items-center gap-3.5 px-4 py-3 rounded-xl border text-left text-sm sm:text-xs font-semibold transition-all cursor-pointer min-h-[44px] active:scale-[0.99] select-none",
                                      isChecked
                                        ? "bg-[#17458F]/5 border-[#17458F] text-[#17458F] shadow-2xs"
                                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all",
                                        isChecked
                                          ? "bg-[#17458F] border-[#17458F] text-white"
                                          : "bg-white border-slate-300"
                                      )}
                                    >
                                      {isChecked && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                    </div>
                                    <span className="flex-1">{opt}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : q.type === "multiple_choice" ? (
                            <div className="space-y-2 pt-1">
                              {(q.options || []).map((opt) => {
                                const isSelected = customAnswers[q.id] === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setCustomAnswers({ ...customAnswers, [q.id]: opt })}
                                    className={cn(
                                      "w-full flex items-center gap-3.5 px-4 py-3 rounded-xl border text-left text-sm sm:text-xs font-semibold transition-all cursor-pointer min-h-[44px] active:scale-[0.99] select-none",
                                      isSelected
                                        ? "bg-[#17458F]/5 border-[#17458F] text-[#17458F] shadow-2xs"
                                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all",
                                        isSelected
                                          ? "border-[#17458F] bg-[#17458F]"
                                          : "border-slate-300 bg-white"
                                      )}
                                    >
                                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <span className="flex-1">{opt}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : q.type === "dropdown" ? (
                            <select
                              id={`field-${q.id}`}
                              required={q.required}
                              value={customAnswers[q.id] || ""}
                              onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                              className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-xs font-semibold focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/15 transition-all min-h-[44px]"
                            >
                              <option value="">Select an option...</option>
                              {q.options?.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              id={`field-${q.id}`}
                              type="text"
                              required={q.required}
                              placeholder={q.placeholder || "Your answer..."}
                              value={customAnswers[q.id] || ""}
                              onChange={(e) => setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })}
                              className="w-full px-3.5 py-3 sm:py-2 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-xs font-medium focus:outline-none focus:border-[#17458F] focus:ring-2 focus:ring-[#17458F]/15 transition-all min-h-[44px]"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Navigation and Submit Row */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {canGoBack && formSections.length > 1 && (
                        <button
                          type="button"
                          onClick={handlePrevSection}
                          className="px-5 py-3 sm:py-2.5 min-h-[44px] rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.98]"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Back</span>
                        </button>
                      )}
                      {existingResponse && isEditingResponse && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingResponse(false);
                            setActiveSectionId(formSections[0]?.id || "section-1");
                            setSectionHistory([]);
                            scrollToFormTop();
                          }}
                          className="px-4 py-3 sm:py-2.5 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      {!isLastStep && formSections.length > 1 ? (
                        <button
                          type="button"
                          onClick={handleNextSection}
                          className="px-6 py-3 sm:py-2.5 min-h-[44px] rounded-xl bg-[#17458F] hover:bg-[#123670] active:bg-[#0e2a56] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98]"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-7 sm:px-8 py-3 min-h-[44px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-lg hover:shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                        >
                          {isSubmitting ? (
                            <span>Submitting...</span>
                          ) : (
                            <>
                              <Check className="w-4 h-4 text-white stroke-[2.5]" />
                              <span>{existingResponse ? "Update & Submit" : "Submit"}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </div>
          );
        })()}

        </div>

      </div>

    </div>
  );
}
