"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { EventItem } from "@/types";
import { TicketPass } from "@/components/registration/TicketPass";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { saveRegistrationToFirestore, checkExistingStudentRegistration, StudentRegistrationRecord } from "@/lib/firebase/firestore";
import { db } from "@/lib/firebase/config";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { 
  User, 
  Mail, 
  Phone, 
  GraduationCap, 
  Users, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  Sparkles, 
  Plus, 
  Trash2,
  Hash,
  AlertCircle,
  LogIn,
  CheckCircle2,
  UserCheck,
  Building2,
  Search,
  CreditCard,
  QrCode,
  Copy,
  ExternalLink,
  XCircle,
  Clock
} from "lucide-react";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";
import { CancelRegistrationModal } from "@/components/registration/CancelRegistrationModal";
import confetti from "canvas-confetti";
import { 
  getStoredDepartments, 
  DEFAULT_DEPARTMENTS,
  syncDepartmentsFromFirestore,
  subscribeToDepartments,
  resolveCanonicalDepartmentName
} from "@/lib/departmentsStore";
import { 
  findRegisteredUserByBtId, 
  lookupUserByBtId, 
  RegisteredUserRecord,
  saveRegisteredUser,
  isExternalUser
} from "@/lib/usersStore";

import { 
  getStoredPaymentConfig,
  syncPaymentConfigFromFirestore,
  subscribeToPaymentConfig,
  PaymentConfig 
} from "@/lib/paymentConfigStore";

interface RegistrationWizardProps {
  event: EventItem;
}

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "4th Year / Final Year"];

export interface TeamMemberEntry {
  name: string;
  btId: string;
  department?: string;
  year?: string;
  email?: string;
  isLeader?: boolean;
}

export function RegistrationWizard({ event }: RegistrationWizardProps) {
  const { user, openAuthModal, updateUserProfile } = useAuth();
  const [departmentsList, setDepartmentsList] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const stepContainerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Smoothly scroll the window to the top of the step card when switching wizard steps
  const scrollToStepTop = () => {
    // Dismiss virtual keyboard if active to prevent erratic mobile viewport jumps
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const performScroll = () => {
      const target = stepContainerRef.current || (typeof document !== "undefined" ? document.getElementById("registration-step-card") : null);
      if (target) {
        const yOffset = -75; // Account for 65px fixed navbar + 10px breathing space
        const y = target.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }
    };

    // Trigger across animation frame and post-keyboard retraction delays
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        performScroll();
        setTimeout(performScroll, 50);
        setTimeout(performScroll, 160);
      });
    }
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scrollToStepTop();
  }, [currentStep]);

  // Determine available format
  const initialFormat = event.teamType === "Team" ? "Team" : "Individual";

  const isFaculty = user?.role === "FACULTY" || user?.userType === "FACULTY";
  const isExternal = isExternalUser(user);
  const isJdcoemOnly = event.targetAudience === "jdcoem_only" || event.isInterCollege === false;

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    btId: "",
    phone: "",
    department: "",
    year: "",
    teamType: initialFormat as "Individual" | "Team",
    teamName: "",
    collegeName: "",
    city: "",
  });

  // Team Roster State
  const [teamMembers, setTeamMembers] = useState<TeamMemberEntry[]>([]);
  const [teammateBtIdInput, setTeammateBtIdInput] = useState("");
  const [manualTeammate, setManualTeammate] = useState({
    name: "",
    college: "",
    department: "",
  });
  const [teamAddMode, setTeamAddMode] = useState<"external" | "btId">(isExternal ? "external" : "btId");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupSuccess, setLookupSuccess] = useState<string | null>(null);
  const [isVerifyingTeammate, setIsVerifyingTeammate] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paytmCheckoutData, setPaytmCheckoutData] = useState<{
    orderId: string;
    amount: number;
    formattedAmount: string;
    upiLink: string;
    gpayLink?: string;
    phonepeLink?: string;
    paytmLink?: string;
    bhimLink?: string;
    payeeName: string;
    upiId: string;
  } | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(() => getStoredPaymentConfig());
  const [showQrOnMobile, setShowQrOnMobile] = useState(false);
  const [showManualUtr, setShowManualUtr] = useState(false);
  const [isAutoDetectingPayment, setIsAutoDetectingPayment] = useState(false);
  const autoDetectCompletedRef = useRef(false);
  const [paytmUtr, setPaytmUtr] = useState("");
  const [isVerifyingPaytm, setIsVerifyingPaytm] = useState(false);
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [existingRegistration, setExistingRegistration] = useState<StudentRegistrationRecord | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [generatedTicket, setGeneratedTicket] = useState<{
    registrationId: string;
    ticketCode: string;
    paymentStatus?: string;
    paymentId?: string;
  } | null>(null);

  // Realtime synchronization of Payment Gateway and Treasurer UPI settings
  useEffect(() => {
    let isMounted = true;
    syncPaymentConfigFromFirestore().then((cfg) => {
      if (isMounted && cfg) {
        setPaymentConfig(cfg);
      }
    });
    const unsub = subscribeToPaymentConfig((cfg) => {
      if (isMounted && cfg) {
        setPaymentConfig(cfg);
      }
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  // Realtime subscription for instant auto-approval when phone webhook lands
  useEffect(() => {
    if (!generatedTicket || generatedTicket.paymentStatus !== "PENDING" || !generatedTicket.registrationId) {
      return;
    }

    // 1. Listen to Firestore doc
    let unsubFirestore: (() => void) | null = null;
    try {
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const docRef = doc(db, "student_registrations", generatedTicket.registrationId);
        unsubFirestore = onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data?.paymentStatus === "PAID") {
              setGeneratedTicket((prev) => prev ? { ...prev, paymentStatus: "PAID" } : null);
              confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }
          }
        });
      }
    } catch (e) {
      console.warn("Realtime pass subscription error:", e);
    }

    // 2. Also listen for custom event across tabs
    const handleUpdate = (e: any) => {
      const list = e.detail || [];
      const item = list.find((r: any) => r.id === generatedTicket.registrationId || r.registrationId === generatedTicket.registrationId);
      if (item && item.paymentStatus === "PAID") {
        setGeneratedTicket((prev) => prev ? { ...prev, paymentStatus: "PAID" } : null);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    };
    window.addEventListener("src_registrations_updated", handleUpdate);

    return () => {
      if (unsubFirestore) unsubFirestore();
      window.removeEventListener("src_registrations_updated", handleUpdate);
    };
  }, [generatedTicket?.registrationId, generatedTicket?.paymentStatus]);

  // Check if current user is already registered for this event
  useEffect(() => {
    let isMounted = true;
    const checkDuplicate = async () => {
      const targetEmail = user?.email || formData.email;
      const targetBtId = isExternal ? undefined : (user?.btId || formData.btId);
      if (!targetEmail && !targetBtId) return;

      setIsCheckingDuplicate(true);
      try {
        const found = await checkExistingStudentRegistration(
          event.id,
          event.slug,
          targetEmail,
          targetBtId
        );
        if (isMounted && found) {
          setExistingRegistration(found);
        }
      } catch (e) {
        console.warn("Existing registration check warning", e);
      } finally {
        if (isMounted) setIsCheckingDuplicate(false);
      }
    };
    checkDuplicate();
    return () => { isMounted = false; };
  }, [user, event.id, event.slug, formData.btId, formData.email, isExternal]);

  // Sync profile data directly from authenticated user and live Firestore departments
  useEffect(() => {
    setDepartmentsList(getStoredDepartments());

    syncDepartmentsFromFirestore().then((remote) => {
      if (remote && Array.isArray(remote) && remote.length > 0) {
        setDepartmentsList(remote);
      }
    });

    const unsubscribe = subscribeToDepartments((fresh) => {
      if (fresh && Array.isArray(fresh) && fresh.length > 0) {
        setDepartmentsList(fresh);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      const userIsFaculty = user.role === "FACULTY" || user.userType === "FACULTY";
      const userIsExternal = isExternalUser(user);

      const leaderName = user.displayName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email?.split("@")[0] || "Delegate";
      const leaderBtId = userIsExternal ? "" : (user.btId || (userIsFaculty ? (user.employeeId || "FACULTY") : ""));
      const leaderCollege = userIsExternal ? (user.collegeName || "") : "JDCOEM Nagpur";
      const leaderCity = userIsExternal ? (user.city || "Nagpur") : "Nagpur";
      const rawDept = userIsFaculty 
        ? (user.facultyDepartment || user.department || "Academic Faculty") 
        : userIsExternal 
        ? (user.customBranch || user.department || "General Stream") 
        : (user.department || departmentsList[0] || DEFAULT_DEPARTMENTS[0] || "Computer Science and Engineering");

      const leaderDept = (userIsFaculty || userIsExternal)
        ? rawDept
        : resolveCanonicalDepartmentName(rawDept, departmentsList);

      const leaderYear = userIsFaculty ? (user.facultyDesignation || "Faculty Member") : (user.year || "3rd Year");
      const leaderPhone = user.phone || "";
      const leaderEmail = user.email || "";

      setFormData((prev) => ({
        ...prev,
        fullName: leaderName,
        email: leaderEmail,
        btId: leaderBtId,
        phone: leaderPhone,
        department: leaderDept,
        year: leaderYear,
        collegeName: leaderCollege,
        city: leaderCity,
      }));

      // Initialize team leader in roster
      setTeamMembers([
        {
          name: leaderName,
          btId: userIsExternal ? (leaderCollege || "External Delegate") : (leaderBtId || "Leader"),
          department: userIsExternal ? `${leaderCollege} • ${leaderDept}` : leaderDept,
          year: leaderYear,
          email: leaderEmail,
          isLeader: true,
        },
      ]);

      if (userIsExternal) {
        setTeamAddMode("external");
      }
    }
  }, [user, departmentsList]);

  // Automatically keep formData.department aligned when departmentsList is refreshed from Firestore
  useEffect(() => {
    if (!isExternal && !isFaculty && formData.department && departmentsList.length > 0) {
      const canonical = resolveCanonicalDepartmentName(formData.department, departmentsList);
      if (canonical && canonical !== formData.department) {
        setFormData((prev) => ({ ...prev, department: canonical }));
        setTeamMembers((prev) =>
          prev.map((m) => (m.isLeader ? { ...m, department: canonical } : m))
        );
      }
    }
  }, [departmentsList, isExternal, isFaculty, formData.department]);

  const minTeamSize = event.minTeamSize || (event.teamType === "Individual" ? 1 : 2);
  const maxTeamSize = event.maxTeamSize || 4;

  const handleAddExternalTeammate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLookupError(null);
    setLookupSuccess(null);

    const cleanName = manualTeammate.name.trim();
    if (!cleanName || cleanName.length < 2) {
      setLookupError("Please provide teammate's full name (at least 2 characters).");
      return;
    }

    if (teamMembers.length >= maxTeamSize) {
      setLookupError(`Maximum team size of ${maxTeamSize} members reached for this event.`);
      return;
    }

    const memberCollege = manualTeammate.college.trim() || formData.collegeName || "Visiting College";
    const memberDept = manualTeammate.department.trim() || "Visiting Student";

    const newEntry: TeamMemberEntry = {
      name: cleanName,
      btId: memberCollege,
      department: `${memberCollege} • ${memberDept}`,
      year: "Delegate",
      isLeader: false,
    };

    setTeamMembers((prev) => [...prev, newEntry]);
    setManualTeammate({ name: "", college: formData.collegeName || "", department: "" });
    setLookupSuccess(`Added ${cleanName} (${memberCollege}) to squad!`);
    setTimeout(() => setLookupSuccess(null), 3000);
  };

  const handleVerifyAndAddTeammate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLookupError(null);
    setLookupSuccess(null);

    const cleanBtId = teammateBtIdInput.trim().toUpperCase();
    if (!cleanBtId) {
      setLookupError("Please enter a College BT ID to verify.");
      return;
    }

    // 1. Check if same as leader
    if (formData.btId && cleanBtId === formData.btId.trim().toUpperCase()) {
      setLookupError("You are already registered as the Team Leader for this entry.");
      return;
    }

    // 2. Check if already added
    if (teamMembers.some((m) => m.btId.trim().toUpperCase() === cleanBtId)) {
      setLookupError(`Teammate with BT ID ${cleanBtId} is already in your team roster.`);
      return;
    }

    // 3. Check team limit
    if (teamMembers.length >= maxTeamSize) {
      setLookupError(`Maximum team size of ${maxTeamSize} members reached for this event.`);
      return;
    }

    setIsVerifyingTeammate(true);

    try {
      const found = await lookupUserByBtId(cleanBtId);

      if (!found) {
        setLookupError(
          `BT ID "${cleanBtId}" is not registered on the portal. Please verify the BT ID or add them as a Visiting Teammate.`
        );
        setIsVerifyingTeammate(false);
        return;
      }

      // Check if teammate is already registered for this event
      const teammateDuplicate = await checkExistingStudentRegistration(
        event.id,
        event.slug,
        found.email || undefined,
        cleanBtId
      );

      if (teammateDuplicate) {
        setLookupError(
          `Teammate "${found.displayName || cleanBtId}" is already registered for this event under Pass ID: ${teammateDuplicate.id}.`
        );
        setIsVerifyingTeammate(false);
        return;
      }

      const memberName = found.displayName || `${found.firstName || ""} ${found.lastName || ""}`.trim() || found.email || "Student";
      const newEntry: TeamMemberEntry = {
        name: memberName,
        btId: cleanBtId,
        department: found.department,
        year: found.year,
        email: found.email || undefined,
        isLeader: false,
      };

      setTeamMembers((prev) => [...prev, newEntry]);
      setTeammateBtIdInput("");
      setLookupSuccess(`Verified: ${memberName} (${found.department || "Student"}) added to squad!`);
      setTimeout(() => setLookupSuccess(null), 3000);
    } catch (err) {
      setLookupError("Error connecting to member registry. Please try again.");
    } finally {
      setIsVerifyingTeammate(false);
    }
  };

  const handleRemoveTeammate = (indexToRemove: number) => {
    if (indexToRemove === 0) return; // Cannot remove team leader
    setTeamMembers((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleProceedToStep2 = async () => {
    if (event.status === "Completed" || event.status?.toLowerCase() === "completed" || (event.status && event.status !== "Registration Open")) {
      alert(`Registrations are closed for this event (${event.status}). Registration cannot happen.`);
      return;
    }
    if (!user) {
      openAuthModal();
      return;
    }

    const isNonBtIdUser = user?.role === "FACULTY" || user?.userType === "FACULTY" || isExternalUser(user);

    if (!isNonBtIdUser && !formData.btId.trim()) {
      alert("Please ensure your College BT ID is saved in your profile.");
      return;
    }
    const cleanPhone = formData.phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      alert("Please provide a valid 10-digit Indian mobile / WhatsApp number (e.g. 9876543210).");
      return;
    }

    // Check if user already registered for this event
    const dup = await checkExistingStudentRegistration(
      event.id,
      event.slug,
      formData.email || user.email,
      formData.btId || user.btId
    );

    if (dup) {
      setExistingRegistration(dup);
      alert(`You are already registered for this event (Registration ID: ${dup.id}). Duplicate registrations for the same participant are not permitted.`);
      return;
    }

    // If user edited their phone or dept in step 1, persist to profile
    if (updateUserProfile) {
      updateUserProfile({
        phone: cleanPhone,
        department: formData.department,
        year: formData.year,
        ...(formData.btId ? { btId: formData.btId } : {}),
      });
    }

    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setCurrentStep(2);
    scrollToStepTop();
  };

  const handleProceedToStep3 = () => {
    if (formData.teamType === "Team") {
      const trimmedTeam = formData.teamName.trim();
      if (!trimmedTeam || trimmedTeam.length < 2) {
        alert("Please enter a valid Team / Squad Name (at least 2 characters).");
        return;
      }
      if (trimmedTeam.length > 60) {
        alert("Team name cannot exceed 60 characters.");
        return;
      }
      if (teamMembers.length < minTeamSize) {
        alert(
          `This event requires at least ${minTeamSize} members per team. You currently have ${teamMembers.length} member(s). Please add ${minTeamSize - teamMembers.length} more verified teammate(s).`
        );
        return;
      }
    }

    // Validate custom registration questions
    if (event.customQuestions && event.customQuestions.length > 0) {
      const errors: Record<string, string> = {};
      for (const q of event.customQuestions) {
        if (q.type === "note") continue;
        if (q.required) {
          const val = customAnswers[q.id];
          if (
            val === undefined || 
            val === null || 
            (typeof val === "string" && !val.trim()) ||
            (Array.isArray(val) && val.length === 0)
          ) {
            errors[q.id] = "This question is required by the organizers.";
          }
        }
      }
      if (Object.keys(errors).length > 0) {
        setCustomErrors(errors);
        alert("Please complete all required event-specific questions before proceeding.");
        return;
      }
      setCustomErrors({});
    }

    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setCurrentStep(3);
    scrollToStepTop();
  };

  // Dynamic Fee Calculation
  const isPaidEvent = Boolean(
    event.isPaid || 
    (event.feeAmount && event.feeAmount > 0) || 
    (event.teamFeeAmount && event.teamFeeAmount > 0)
  );

  let totalPayableAmount = 0;
  if (isPaidEvent) {
    if (formData.teamType === "Team") {
      if (event.feePricingModel === "per_team" && event.teamFeeAmount) {
        totalPayableAmount = Number(event.teamFeeAmount);
      } else {
        totalPayableAmount = (Number(event.feeAmount) || 100) * teamMembers.length;
      }
    } else {
      totalPayableAmount = Number(event.feeAmount) || 100;
    }
  }

  const completeRegistration = async (paymentDetails?: {
    paymentStatus: "FREE" | "PAID" | "PENDING";
    paymentId?: string;
    orderId?: string;
    amountPaid?: number;
  }) => {
    if (!user) {
      openAuthModal();
      return;
    }
    const regId = `SRC-${event.slug.slice(0, 3).toUpperCase()}-26-${Math.floor(10000 + Math.random() * 90000)}`;
    const tkCode = `${event.slug.slice(0, 3).toUpperCase()}26-TK-${Math.floor(1000 + Math.random() * 9000)}`;

    // Build structured custom answers preserving human-readable question titles
    const structuredAnswers: Record<string, any> = {};
    if (event.customQuestions && event.customQuestions.length > 0) {
      event.customQuestions.forEach((q) => {
        if (q.type !== "note" && customAnswers[q.id] !== undefined) {
          structuredAnswers[q.id] = {
            id: q.id,
            question: q.question || "Custom Question",
            type: q.type || "short_text",
            options: q.options || [],
            value: customAnswers[q.id],
          };
        }
      });
    }
    // Also include any raw key answers not matching current customQuestions list
    Object.entries(customAnswers).forEach(([k, v]) => {
      if (!structuredAnswers[k]) {
        structuredAnswers[k] = v;
      }
    });

    try {
      await saveRegistrationToFirestore({
        id: regId,
        eventId: event.id,
        eventTitle: event.name,
        parentEventName: event.parentEventName,
        parentEventId: event.parentEventId,
        subEventBadge: event.subEventBadge,
        leaderName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        college: isExternal ? (formData.collegeName || user?.collegeName || "Other College") : "JD College of Engineering & Management",
        collegeName: isExternal ? (formData.collegeName || user?.collegeName || "Other College") : undefined,
        city: isExternal ? (formData.city || user?.city || "Nagpur") : undefined,
        customBranch: isExternal ? (formData.department || user?.customBranch) : undefined,
        userType: isExternal ? "EXTERNAL_STUDENT" : isFaculty ? "FACULTY" : "JDCOEM_STUDENT",
        isCollegeStudent: !isExternal,
        department: formData.department,
        year: formData.year,
        btId: isExternal ? undefined : formData.btId,
        teamSize: formData.teamType === "Team" ? teamMembers.length : 1,
        teamName: formData.teamType === "Team" ? formData.teamName : undefined,
        teamMembers: formData.teamType === "Team" ? teamMembers : undefined,
        qrPayload: isExternal 
          ? `SRC:EXTERNAL:${regId}:${tkCode}:${event.id}:${user?.uid || "EXT"}`
          : `SRC:JDCOEM:${regId}:${tkCode}:${event.id}:${formData.btId}`,
        paymentStatus: paymentDetails?.paymentStatus || "FREE",
        paymentId: paymentDetails?.paymentId,
        orderId: paymentDetails?.orderId,
        amountPaid: paymentDetails?.amountPaid || 0,
        currency: "INR",
        paidAt: paymentDetails?.paymentStatus === "PAID" ? new Date().toISOString() : undefined,
        registeredAt: new Date().toISOString(),
        tenureId: "tenure-2025-26",
        customAnswers: Object.keys(structuredAnswers).length > 0 ? structuredAnswers : undefined,
      });
    } catch (e) {
      console.warn("Firestore registration save fallback handled", e);
    }

    setTimeout(() => {
      setGeneratedTicket({
        registrationId: regId,
        ticketCode: tkCode,
        paymentStatus: paymentDetails?.paymentStatus,
        paymentId: paymentDetails?.paymentId,
      });
      setIsSubmitting(false);
      setCurrentStep(4);

      // Fire celebratory confetti!
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#E78023", "#17458F", "#FFFFFF", "#3D406B"],
        });
      } catch (e) {
        // Ignore if confetti is unsupported
      }
    }, 500);
  };

  const handleConfirmRegistration = async () => {
    if (isSubmitting) return;
    if (event.status === "Completed" || event.status?.toLowerCase() === "completed" || (event.status && event.status !== "Registration Open")) {
      alert(`Registrations are closed for this event (${event.status}). Registration cannot happen.`);
      return;
    }
    setIsSubmitting(true);

    // Safeguard duplicate check before processing registration
    try {
      const dup = await checkExistingStudentRegistration(
        event.id,
        event.slug,
        formData.email || user?.email,
        formData.btId || user?.btId
      );
      if (dup) {
        setExistingRegistration(dup);
        setIsSubmitting(false);
        alert(`You are already registered for this event (Registration ID: ${dup.id}). Duplicate registrations are not allowed.`);
        return;
      }
    } catch (e) {
      console.warn("Duplicate safeguard check notice", e);
    }

    // 1. Free Event Direct Flow
    if (totalPayableAmount === 0) {
      await completeRegistration({
        paymentStatus: "FREE",
        amountPaid: 0,
      });
      return;
    }

    // 2. Paid Event Paytm for Business Gateway Flow
    try {
      const orderRes = await fetch("/api/paytm/initiate-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalPayableAmount,
          eventId: event.id,
          eventName: event.name,
          participantName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          btId: formData.btId,
          teamType: formData.teamType,
          teamSize: formData.teamType === "Team" ? teamMembers.length : 1,
          tenureId: "2025-26",
          upiId: paymentConfig.upiId,
          payeeName: paymentConfig.payeeName,
          paytmMid: paymentConfig.paytmMid,
        }),
      });

      if (!orderRes.ok) {
        const errJson = await orderRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Could not initialize payment gateway order.");
      }

      const orderData = await orderRes.json();
      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to generate payment payload.");
      }

      setShowManualUtr(false);
      setPaytmUtr("");
      autoDetectCompletedRef.current = false;
      setPaytmCheckoutData({
        orderId: orderData.orderId,
        amount: orderData.amount,
        formattedAmount: orderData.formattedAmount,
        upiLink: orderData.upiLink,
        gpayLink: orderData.gpayLink,
        phonepeLink: orderData.phonepeLink,
        paytmLink: orderData.paytmLink,
        bhimLink: orderData.bhimLink,
        payeeName: orderData.payeeName || paymentConfig.payeeName,
        upiId: orderData.upiId || paymentConfig.upiId,
      });

      if (db && orderData.orderId) {
        try {
          await setDoc(doc(db, "active_checkout_sessions", orderData.orderId), {
            orderId: orderData.orderId,
            amount: Number(orderData.amount),
            eventId: event.id,
            eventName: event.name,
            participantName: formData.fullName || user?.displayName || user?.name || "Student",
            email: formData.email || user?.email || "",
            phone: formData.phone || user?.phone || "",
            status: "WAITING",
            createdAt: new Date().toISOString(),
          }, { merge: true });
        } catch (e) {
          console.warn("Client active_checkout_sessions mirror notice:", e);
        }
      }
      setIsSubmitting(false);
    } catch (err: any) {
      console.error("Payment initialization error:", err);
      alert(
        err?.message ||
        "Failed to initiate payment gateway. Please check your connection or contact the coordinator."
      );
      setIsSubmitting(false);
    }
  };

  const handleVerifyPaytmPayment = async () => {
    if (!paytmCheckoutData) return;

    const cleanedUtr = paytmUtr.trim();
    if (!cleanedUtr) {
      alert("Please enter the 12-digit UPI Reference (UTR) Number from your Google Pay, PhonePe, or Paytm receipt.");
      return;
    }

    if (!/^\d{12}$/.test(cleanedUtr)) {
      alert(`Invalid UTR: "${cleanedUtr}". All Indian UPI payment receipts provide an exact 12-digit numeric reference (e.g. 425512345678).`);
      return;
    }

    setIsVerifyingPaytm(true);
    try {
      const verifyRes = await fetch("/api/paytm/verify-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: paytmCheckoutData.orderId,
          txnId: cleanedUtr,
          amount: paytmCheckoutData.amount,
        }),
      });

      const verifyData = await verifyRes.json();
      if (verifyData.verified) {
        autoDetectCompletedRef.current = true;
        // Sets status to "PENDING" (awaiting Treasurer confirmation) or "PAID"
        const targetPaymentStatus = (verifyData.paymentStatus as "PAID" | "PENDING") || "PENDING";

        await completeRegistration({
          paymentStatus: targetPaymentStatus,
          paymentId: verifyData.paymentId || cleanedUtr,
          orderId: paytmCheckoutData.orderId,
          amountPaid: totalPayableAmount,
        });
        setPaytmCheckoutData(null);
      } else {
        alert(verifyData.error || "Payment verification failed. Please check your transaction details.");
      }
    } catch (err: any) {
      console.error("Payment verification error:", err);
      alert("Error verifying payment. Please ensure your transaction completed successfully.");
    } finally {
      setIsVerifyingPaytm(false);
    }
  };

  // Hands-Free Auto-Detection: Listen for incoming MacroDroid webhook payment confirmation
  useEffect(() => {
    if (!paytmCheckoutData?.orderId) {
      setIsAutoDetectingPayment(false);
      return;
    }

    setIsAutoDetectingPayment(true);
    autoDetectCompletedRef.current = false;
    const currentOrderId = paytmCheckoutData.orderId;
    const currentAmount = paytmCheckoutData.amount;

    const handleAutoSuccess = async (completedUtr: string) => {
      if (autoDetectCompletedRef.current) return;
      autoDetectCompletedRef.current = true;
      setIsAutoDetectingPayment(false);

      await completeRegistration({
        paymentStatus: "PAID",
        paymentId: completedUtr || `UPI-AUTO-${Date.now().toString().slice(-8)}`,
        orderId: currentOrderId,
        amountPaid: currentAmount,
      });
      setPaytmCheckoutData(null);
    };

    // 1. Real-time Firestore snapshot listener on active_checkout_sessions doc
    let unsubscribeSnapshot: (() => void) | null = null;
    if (db) {
      try {
        const sessionDocRef = doc(db, "active_checkout_sessions", currentOrderId);
        unsubscribeSnapshot = onSnapshot(
          sessionDocRef,
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              if (data?.status === "COMPLETED" && !autoDetectCompletedRef.current) {
                handleAutoSuccess(data.utr || "");
              }
            }
          },
          (err) => {
            console.warn("active_checkout_sessions listener notice:", err);
          }
        );
      } catch (e) {
        console.warn("Failed to attach session listener:", e);
      }
    }

    // 2. Fallback polling interval every 3 seconds
    const pollInterval = setInterval(async () => {
      if (autoDetectCompletedRef.current) return;
      try {
        const res = await fetch(`/api/upi/check-status?orderId=${encodeURIComponent(currentOrderId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.status === "PAID" && !autoDetectCompletedRef.current) {
            handleAutoSuccess(data.utr || "");
          }
        }
      } catch (e) {
        // Silent polling error catch
      }
    }, 3000);

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      clearInterval(pollInterval);
    };
  }, [paytmCheckoutData?.orderId]);


  if (event.status === "Completed" || event.status?.toLowerCase() === "completed") {
    return (
      <div className="max-w-xl mx-auto p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-5 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <Badge variant="slate" size="md">Registration Closed • Event Completed</Badge>
          <h3 className="font-heading font-extrabold text-2xl text-[#0F172A] uppercase">
            {event.name}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            This event has officially concluded and is marked as <strong>Completed</strong>. Registration is closed and cannot be submitted.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/events"
            className="inline-flex px-6 py-3 rounded-2xl bg-[#17458F] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#123670] transition-all shadow-sm"
          >
            &larr; Explore Available Events
          </Link>
        </div>
      </div>
    );
  }

  const steps = [
    { number: 1, title: "01 DETAILS", shortTitle: "01 INFO" },
    { number: 2, title: "02 PARTICIPATION", shortTitle: "02 SQUAD" },
    { number: 3, title: "03 REVIEW", shortTitle: "03 REVIEW" },
    { number: 4, title: "04 PASS", shortTitle: "04 PASS" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-10 font-sans">
      
      {/* Progress Stepper Bar */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-4">
        {steps.map((step) => {
          const isActive = currentStep === step.number;
          const isCompleted = currentStep > step.number;

          return (
            <div
              key={step.number}
              className={`relative p-2.5 sm:p-4 rounded-2xl border transition-all ${
                isActive
                  ? "bg-[#17458F] border-[#E78023] text-white shadow-md"
                  : isCompleted
                  ? "bg-white border-slate-200 text-slate-800"
                  : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider font-heading truncate">
                  <span className="sm:hidden">{step.shortTitle}</span>
                  <span className="hidden sm:inline">{step.title}</span>
                </span>
                {isCompleted && (
                  <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-[#E78023] text-white flex items-center justify-center shrink-0">
                    <Check className="w-2 sm:w-2.5 h-2 sm:h-2.5 stroke-[3]" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* STEP 1: PARTICIPANT DETAILS (LOADED DIRECTLY FROM PROFILE) */}
      {currentStep === 1 && (
        <div 
          ref={stepContainerRef}
          id="registration-step-card"
          className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-10 space-y-8 shadow-sm scroll-mt-20"
        >
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
                Step 01 of 03
              </span>
              <h3 className="font-heading font-extrabold text-2xl text-[#17458F] uppercase mt-1">
                PRIMARY PARTICIPANT INFORMATION
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Accredited automatically from your verified student profile.
              </p>
            </div>

            {user && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Verified Profile</span>
              </span>
            )}
          </div>

          {!user ? (
            /* Unauthenticated Prompt */
            <div className="p-8 rounded-3xl bg-amber-50/70 border border-amber-200 text-center space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-[#17458F] text-white flex items-center justify-center mx-auto shadow-md">
                <UserCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-heading font-extrabold text-lg text-[#0F172A]">
                  {isJdcoemOnly ? "JDCOEM Student Sign-In Required" : "Student Sign-In Required"}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {isJdcoemOnly
                    ? "This event is exclusively reserved for JDCOEM students. Please sign in with your official @jdcoem.ac.in Google account to verify your student credentials."
                    : "Primary participation details are verified directly from your student Google profile. Please sign in to continue your event accreditation."}
                </p>
              </div>
              <Button
                onClick={openAuthModal}
                variant="primary"
                size="md"
                className="gap-2 mx-auto cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with College Account</span>
              </Button>
            </div>
          ) : isJdcoemOnly && isExternal ? (
            /* Ineligible External Student Alert */
            <div className="p-8 sm:p-10 rounded-3xl bg-amber-50/90 border-2 border-amber-300 text-amber-950 space-y-5 max-w-xl mx-auto text-center shadow-md animate-in fade-in">
              <div className="w-14 h-14 rounded-3xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/25">
                <GraduationCap className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Campus Exclusive Listing
                </span>
                <h4 className="font-heading font-extrabold text-2xl text-[#0F172A] tracking-tight">
                  JDCOEM Students Only
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  This listing is strictly reserved for verified students of <strong>JD College of Engineering &amp; Management (JDCOEM)</strong>. 
                  Your signed-in profile is registered as an external delegate from <strong className="text-slate-800">{formData.collegeName || user?.collegeName || "another institution"}</strong>.
                </p>
                <p className="text-xs text-slate-500 font-medium pt-1">
                  Registration for this event is unavailable for non-JDCOEM students. You can explore and register for institutional events that are open to all colleges!
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link
                  href="/events"
                  className="px-5 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs"
                >
                  Browse Inter-College Events
                </Link>
                <Link
                  href={`/events/${event.slug}`}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Return to Event Details
                </Link>
              </div>
            </div>
          ) : (
            /* Verified Student Profile Display */
            <div className="space-y-6">
              
              {/* Duplicate Pass Alert Banner (If already registered) */}
              {existingRegistration && (
                <div className="p-6 sm:p-8 rounded-3xl bg-emerald-50/80 border-2 border-emerald-500/30 text-emerald-950 space-y-4 shadow-sm animate-in fade-in duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        Duplicate Entry Prevented
                      </span>
                      <h4 className="font-heading font-extrabold text-xl text-emerald-900">
                        You Are Already Registered for This Event
                      </h4>
                      <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                        A confirmed delegate accreditation pass already exists for your profile for <strong>{event.name}</strong>. Multiple entries by the same student are restricted.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-emerald-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Registration Pass ID</span>
                      <span className="font-mono font-bold text-[#17458F]">{existingRegistration.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Entry Status</span>
                      <span className="font-bold text-emerald-700">{existingRegistration.status}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Participation Format</span>
                      <span className="font-semibold text-slate-800">
                        {(existingRegistration.teamSize && existingRegistration.teamSize > 1) || existingRegistration.teamName ? `Squad: ${existingRegistration.teamName || "Team"}` : "Solo Individual"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button
                      onClick={() => {
                        setGeneratedTicket({
                          registrationId: existingRegistration.id,
                          ticketCode: (existingRegistration as any).ticketCode || `${existingRegistration.id}-TK`,
                          paymentStatus: existingRegistration.paymentStatus,
                          paymentId: existingRegistration.paymentId,
                        });
                        setCurrentStep(4);
                        scrollToStepTop();
                      }}
                      variant="primary"
                      size="md"
                      className="gap-2 cursor-pointer shadow-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>View &amp; Download Your Pass</span>
                    </Button>
                    <Link
                      href={`/verify/${encodeURIComponent(existingRegistration.id)}`}
                      target="_blank"
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-900 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <span>Public Verification Link</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    {!event.isPaid && (!event.feeAmount || event.feeAmount === 0) && existingRegistration.status !== "CANCELLED" && existingRegistration.status !== "CHECKED_IN" && (
                      <button
                        type="button"
                        onClick={() => setIsCancelModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 hover:text-rose-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Cancel Registration</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!existingRegistration && (
                <>
                  <div className="p-5 rounded-2xl bg-blue-50/50 border border-[#17458F]/20 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#17458F] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <ShieldCheck className="w-5 h-5 text-[#E78023]" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-[#17458F]">
                        {isFaculty
                          ? "Faculty / Staff Accreditation Details"
                          : isExternal
                          ? "Inter-Collegiate Visiting Delegate Profile"
                          : "Authenticated JDCOEM Student Profile"}
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {isFaculty
                          ? "Your institutional academic designation and department will be attached to your delegate pass."
                          : isExternal
                          ? `Registered as an external visiting delegate from ${formData.collegeName || "Other College"}. No JDCOEM BT ID is required.`
                          : "Your official college BT ID, department, and credentials will be encoded into your digital delegate entry pass."}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>Full Name *</span>
                      </label>
                      <input
                        type="text"
                        disabled
                        value={formData.fullName}
                        className="w-full px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 text-sm font-semibold cursor-not-allowed"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>Email Address *</span>
                      </label>
                      <input
                        type="email"
                        disabled
                        value={formData.email}
                        className="w-full px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 text-sm font-medium cursor-not-allowed"
                      />
                    </div>

                    {/* INTER-COLLEGE SPECIFIC FIELDS: College & City (NO BT ID) */}
                    {isExternal ? (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-[#17458F]" />
                            <span>College / University Name *</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.collegeName}
                            onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })}
                            placeholder="e.g. VNIT Nagpur or Raisoni College"
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F]"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-[#E78023]" />
                            <span>City / Location *</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            placeholder="e.g. Nagpur, Pune, Mumbai"
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F]"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-[#17458F]" />
                            <span>Degree *</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.department}
                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            placeholder="e.g. B.Tech, BCA, MBA, B.Sc..."
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F]"
                          />
                        </div>
                      </>
                    ) : isFaculty ? (
                      /* FACULTY SPECIFIC FIELDS */
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-[#E78023]" />
                            <span>Academic Designation *</span>
                          </label>
                          <input
                            type="text"
                            value={formData.year}
                            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-[#17458F]"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-[#17458F]" />
                            <span>Academic Department *</span>
                          </label>
                          <select
                            value={resolveCanonicalDepartmentName(formData.department, departmentsList)}
                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-[#17458F]"
                          >
                            {departmentsList.map((dept) => (
                              <option key={dept} value={dept} className="bg-white text-slate-900">
                                {dept}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      /* JDCOEM STUDENT SPECIFIC FIELDS (Requires BT ID) */
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-[#17458F]" />
                            <span>College BT ID *</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.btId}
                            onChange={(e) => setFormData({ ...formData, btId: e.target.value.toUpperCase() })}
                            placeholder="e.g. BT230036CS"
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-mono font-bold uppercase focus:outline-none focus:border-[#17458F]"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-[#17458F]" />
                            <span>Department / Branch *</span>
                          </label>
                          <select
                            value={resolveCanonicalDepartmentName(formData.department, departmentsList)}
                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-[#17458F]"
                          >
                            {departmentsList.map((dept) => (
                              <option key={dept} value={dept} className="bg-white text-slate-900">
                                {dept}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {/* Academic Year (For Students) */}
                    {!isFaculty && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-[#E78023]" />
                          <span>Academic Year *</span>
                        </label>
                        <select
                          value={formData.year}
                          onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-[#17458F]"
                        >
                          {YEARS.map((yr) => (
                            <option key={yr} value={yr} className="bg-white text-slate-900">
                              {yr}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* WhatsApp Phone */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>WhatsApp Contact Phone *</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="e.g. 9823011223"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-[#17458F]"
                      />
                    </div>

                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-end pt-4 border-t border-slate-100">
                    <Button
                      onClick={handleProceedToStep2}
                      variant="primary"
                      size="md"
                      className="w-full sm:w-auto justify-center gap-2 cursor-pointer min-h-[44px]"
                    >
                      <span className="sm:hidden">Continue to Participation</span>
                      <span className="hidden sm:inline">Continue to Participation Format</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: PARTICIPATION FORMAT & TEAM ROSTER */}
      {currentStep === 2 && (
        <div 
          ref={stepContainerRef}
          id="registration-step-card"
          className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-10 space-y-8 shadow-sm scroll-mt-20"
        >
          <div className="border-b border-slate-100 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
              Step 02 of 03
            </span>
            <h3 className="font-heading font-extrabold text-2xl text-[#17458F] uppercase mt-1">
              PARTICIPATION FORMAT &amp; TEAM ROSTER
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {isExternal 
                ? "Configure solo entry or assemble an inter-collegiate squad with other college teammates." 
                : "Configure solo registration or add verified team members by BT ID."}
            </p>
          </div>

          <div className="space-y-6">
            
            {/* Format Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Entry Category
              </label>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  disabled={event.teamType === "Team"}
                  onClick={() => setFormData({ ...formData, teamType: "Individual" })}
                  className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                    formData.teamType === "Individual"
                      ? "bg-[#17458F] border-[#E78023] text-white shadow-sm"
                      : event.teamType === "Team"
                      ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <User className="w-5 h-5 mx-auto mb-1" />
                  <span className="font-heading font-bold text-xs uppercase tracking-wider block">
                    Individual Entry
                  </span>
                  <span className="text-[11px] opacity-80">Single participant pass</span>
                </button>

                <button
                  type="button"
                  disabled={event.teamType === "Individual"}
                  onClick={() => setFormData({ ...formData, teamType: "Team" })}
                  className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                    formData.teamType === "Team"
                      ? "bg-[#17458F] border-[#E78023] text-white shadow-sm"
                      : event.teamType === "Individual"
                      ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-5 h-5 mx-auto mb-1" />
                  <span className="font-heading font-bold text-xs uppercase tracking-wider block">
                    Team Entry
                  </span>
                  <span className="text-[11px] opacity-80">
                    Squad ({minTeamSize} - {maxTeamSize} Members)
                  </span>
                </button>
              </div>

              {event.teamType !== "Both" && (
                <p className="text-[11px] text-slate-500 font-medium">
                  Note: This event is chartered specifically as a <strong>{event.teamType}</strong> competition.
                </p>
              )}
            </div>

            {/* Team Specific Inputs & Squad Roster */}
            {formData.teamType === "Team" && (
              <div className="space-y-6 pt-4 border-t border-slate-100">
                
                {/* Team Name */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Team / Squad Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.teamName}
                    onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                    placeholder="e.g. Code Ninjas or Matrix Squad"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F]"
                  />
                </div>

                {/* Team Members List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Team Roster ({teamMembers.length} of max {maxTeamSize})
                    </label>
                    <span className="text-[11px] font-bold text-[#E78023]">
                      Requirement: {minTeamSize} – {maxTeamSize} Members
                    </span>
                  </div>
                  
                  <div className="space-y-2.5">
                    {teamMembers.map((member, idx) => (
                      <div
                        key={member.btId || idx}
                        className={`flex items-center justify-between p-4 rounded-2xl border text-sm transition-all ${
                          idx === 0
                            ? "bg-blue-50/70 border-[#17458F]/30 shadow-xs"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-[#17458F] shrink-0">
                            0{idx + 1}
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">{member.name}</span>
                              {member.btId && !isExternal && (
                                <span className="font-mono text-xs font-bold text-[#E78023] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                                  {member.btId}
                                </span>
                              )}
                              {idx === 0 ? (
                                <Badge variant="navy" size="sm">
                                  Team Leader (Primary)
                                </Badge>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  Squad Member
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              {member.department} {member.year ? `• ${member.year}` : ""}
                            </p>
                          </div>
                        </div>

                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTeammate(idx)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-2 rounded-lg hover:bg-rose-50 cursor-pointer"
                            title="Remove Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Teammate Section */}
                  {teamMembers.length < maxTeamSize ? (
                    <div className="pt-3 space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      
                      {/* Mode Switcher for External vs BT ID lookup */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#17458F]" />
                          <span>Add Squad Member</span>
                        </span>
                        
                        <div className="flex gap-1.5 text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => setTeamAddMode("external")}
                            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                              teamAddMode === "external"
                                ? "bg-[#17458F] text-white shadow-xs"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            Visiting Teammate
                          </button>
                          <button
                            type="button"
                            onClick={() => setTeamAddMode("btId")}
                            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                              teamAddMode === "btId"
                                ? "bg-[#17458F] text-white shadow-xs"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            By JDCOEM BT ID
                          </button>
                        </div>
                      </div>

                      {teamAddMode === "external" ? (
                        /* Manual External Teammate Form (NO BT ID REQUIRED) */
                        <form onSubmit={handleAddExternalTeammate} className="space-y-3 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input
                              type="text"
                              required
                              value={manualTeammate.name}
                              onChange={(e) => setManualTeammate({ ...manualTeammate, name: e.target.value })}
                              placeholder="Teammate Full Name *"
                              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#17458F]"
                            />
                            <input
                              type="text"
                              value={manualTeammate.college}
                              onChange={(e) => setManualTeammate({ ...manualTeammate, college: e.target.value })}
                              placeholder={`College (Defaults to ${formData.collegeName || "Same College"})`}
                              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#17458F]"
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={manualTeammate.department}
                              onChange={(e) => setManualTeammate({ ...manualTeammate, department: e.target.value })}
                              placeholder="Branch / Stream (e.g. Mechanical, CSE)"
                              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F]"
                            />
                            <Button
                              type="submit"
                              variant="primary"
                              size="sm"
                              className="w-full sm:w-auto justify-center gap-1.5 shrink-0 cursor-pointer text-xs min-h-[44px] sm:min-h-0 py-2.5 px-4"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add to Squad</span>
                            </Button>
                          </div>
                        </form>
                      ) : (
                        /* Lookup by JDCOEM BT ID */
                        <form onSubmit={handleVerifyAndAddTeammate} className="flex flex-col sm:flex-row gap-2 pt-1">
                          <input
                            type="text"
                            value={teammateBtIdInput}
                            onChange={(e) => setTeammateBtIdInput(e.target.value.toUpperCase())}
                            placeholder="e.g. BT240115DS"
                            className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-mono font-bold uppercase focus:outline-none focus:border-[#17458F]"
                          />
                          <Button
                            type="submit"
                            isLoading={isVerifyingTeammate}
                            variant="primary"
                            size="sm"
                            className="w-full sm:w-auto justify-center gap-1.5 shrink-0 cursor-pointer text-xs min-h-[44px] sm:min-h-0 py-2.5 px-4"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Verify &amp; Add</span>
                          </Button>
                        </form>
                      )}

                      {lookupError && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in duration-200 font-medium">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>{lookupError}</span>
                        </div>
                      )}

                      {lookupSuccess && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-200 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{lookupSuccess}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold text-center">
                      Maximum squad limit of {maxTeamSize} members reached.
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Custom Event Questions & Notes Section (Q&N) */}
            {event.customQuestions && event.customQuestions.length > 0 && (
              <div className="space-y-6 pt-6 border-t border-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#17458F] font-heading flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                      <span>Event-Specific Questions &amp; Guidelines</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Please review the notes and complete the custom details required by event organizers.
                  </p>
                </div>

                <div className="space-y-4">
                  {event.customQuestions.map((q, qIdx) => {
                    const isError = Boolean(customErrors[q.id]);
                    const currentVal = customAnswers[q.id];

                    if (q.type === "note") {
                      return (
                        <div key={q.id} className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                            <AlertCircle className="w-4 h-4 text-[#E78023] shrink-0" />
                            <span>{q.question || "Important Notice"}</span>
                          </div>
                          {q.noteContent && (
                            <p className="text-xs text-slate-700 leading-relaxed pl-6 whitespace-pre-line">
                              {q.noteContent}
                            </p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={q.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 ${
                          isError
                            ? "bg-rose-50/50 border-rose-300 ring-2 ring-rose-200"
                            : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[#E78023] font-mono text-[11px]">0{qIdx + 1}.</span>
                            <span>{q.question}</span>
                            {q.required && <span className="text-rose-500 font-bold">*</span>}
                          </label>
                          {q.description && (
                            <p className="text-[11px] text-slate-500 font-medium leading-normal">
                              {q.description}
                            </p>
                          )}
                        </div>

                        {/* Question Inputs by Type */}
                        {q.type === "short_text" && (
                          <input
                            type="text"
                            value={currentVal || ""}
                            onChange={(e) => {
                              setCustomAnswers({ ...customAnswers, [q.id]: e.target.value });
                              if (customErrors[q.id]) {
                                const errs = { ...customErrors };
                                delete errs[q.id];
                                setCustomErrors(errs);
                              }
                            }}
                            placeholder={q.placeholder || "Your answer..."}
                            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F]"
                          />
                        )}

                        {q.type === "long_text" && (
                          <textarea
                            rows={3}
                            value={currentVal || ""}
                            onChange={(e) => {
                              setCustomAnswers({ ...customAnswers, [q.id]: e.target.value });
                              if (customErrors[q.id]) {
                                const errs = { ...customErrors };
                                delete errs[q.id];
                                setCustomErrors(errs);
                              }
                            }}
                            placeholder={q.placeholder || "Enter detailed response..."}
                            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-[#17458F]"
                          />
                        )}

                        {q.type === "multiple_choice" && (
                          <div className="space-y-2">
                            {(q.options || []).map((opt) => {
                              const isSelected = currentVal === opt;
                              return (
                                <label
                                  key={opt}
                                  onClick={() => {
                                    setCustomAnswers({ ...customAnswers, [q.id]: opt });
                                    if (customErrors[q.id]) {
                                      const errs = { ...customErrors };
                                      delete errs[q.id];
                                      setCustomErrors(errs);
                                    }
                                  }}
                                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-[#17458F]/5 border-[#17458F] text-[#17458F] font-bold shadow-2xs"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <div
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                      isSelected ? "border-[#17458F] bg-[#17458F]" : "border-slate-300"
                                    }`}
                                  >
                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </div>
                                  <span className="text-xs">{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {q.type === "checkboxes" && (
                          <div className="space-y-2">
                            {(q.options || []).map((opt) => {
                              const selectedList: string[] = Array.isArray(currentVal) ? currentVal : [];
                              const isChecked = selectedList.includes(opt);
                              return (
                                <label
                                  key={opt}
                                  onClick={() => {
                                    const next = isChecked
                                      ? selectedList.filter((item) => item !== opt)
                                      : [...selectedList, opt];
                                    setCustomAnswers({ ...customAnswers, [q.id]: next });
                                    if (customErrors[q.id]) {
                                      const errs = { ...customErrors };
                                      delete errs[q.id];
                                      setCustomErrors(errs);
                                    }
                                  }}
                                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                    isChecked
                                      ? "bg-emerald-50/60 border-emerald-600 text-emerald-950 font-bold shadow-2xs"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <div
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                                      isChecked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"
                                    }`}
                                  >
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span className="text-xs">{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {q.type === "dropdown" && (
                          <select
                            value={currentVal || ""}
                            onChange={(e) => {
                              setCustomAnswers({ ...customAnswers, [q.id]: e.target.value });
                              if (customErrors[q.id]) {
                                const errs = { ...customErrors };
                                delete errs[q.id];
                                setCustomErrors(errs);
                              }
                            }}
                            className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#17458F] cursor-pointer"
                          >
                            <option value="">-- Choose an option --</option>
                            {(q.options || []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}

                        {isError && (
                          <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>{customErrors[q.id]}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <Button
              onClick={() => {
                setCurrentStep(1);
                scrollToStepTop();
              }}
              variant="outline"
              size="md"
              className="w-full sm:w-auto justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>

            <Button
              onClick={handleProceedToStep3}
              variant="primary"
              size="md"
              className="w-full sm:w-auto justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <span>Review Summary</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & CONFIRM */}
      {currentStep === 3 && (
        <div 
          ref={stepContainerRef}
          id="registration-step-card"
          className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-10 space-y-8 shadow-sm scroll-mt-20"
        >
          <div className="border-b border-slate-100 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
              Step 03 of 03
            </span>
            <h3 className="font-heading font-extrabold text-2xl text-[#17458F] uppercase mt-1">
              REVIEW &amp; CONFIRM REGISTRATION
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Please inspect your accredited details before generating your verified digital entry pass.
            </p>
          </div>

          {/* Review Card */}
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E78023]">
                  Selected Event
                </span>
                <h4 className="font-heading font-extrabold text-xl text-[#0F172A]">
                  {event.name}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {event.date} • {event.venue}
                </p>
              </div>
              <Badge variant="orange" size="md">
                {event.entryFee || "Free Entry"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-medium">
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  {isExternal ? "Visiting Delegate" : "Participant / Leader"}
                </span>
                <p className="font-bold text-slate-900">{formData.fullName}</p>
                {isExternal ? (
                  <p className="text-[11px] text-[#17458F] font-bold">📍 {formData.collegeName || "Visiting College"}</p>
                ) : (
                  <p className="font-mono text-[11px] text-[#E78023] font-bold">{formData.btId}</p>
                )}
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  Email
                </span>
                <p className="font-semibold text-slate-800 truncate">{formData.email}</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  Contact Phone
                </span>
                <p className="font-semibold text-slate-800">{formData.phone}</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  {isExternal ? "Stream / Branch" : "Department"}
                </span>
                <p className="font-semibold text-slate-800">{formData.department}</p>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  {isExternal ? "City & Year" : "Year"}
                </span>
                <p className="font-semibold text-slate-800">
                  {isExternal ? `${formData.city || "Nagpur"} • ${formData.year}` : formData.year}
                </p>
              </div>

              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold">
                  Format
                </span>
                <p className="font-bold text-[#17458F]">
                  {formData.teamType === "Team" ? `Team: ${formData.teamName}` : "Solo Entry"}
                </p>
              </div>
            </div>

            {formData.teamType === "Team" && (
              <div className="pt-4 border-t border-slate-200 text-xs space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Team Squad Roster ({teamMembers.length} Members):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {teamMembers.map((m, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{m.name}</span>
                        <span className="text-[10px] text-slate-500 block">{m.department}</span>
                      </div>
                      {m.btId && !isExternal && (
                        <span className="font-mono text-xs font-bold text-[#E78023] px-2 py-0.5 rounded-full bg-amber-50">
                          {m.btId}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Question Answers Review */}
            {event.customQuestions && event.customQuestions.some((q) => q.type !== "note" && customAnswers[q.id]) && (
              <div className="pt-4 border-t border-slate-200 text-xs space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Event-Specific Answers:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {event.customQuestions
                    .filter((q) => q.type !== "note" && customAnswers[q.id])
                    .map((q) => {
                      const val = customAnswers[q.id];
                      const displayVal = Array.isArray(val) ? val.join(", ") : String(val);
                      return (
                        <div key={q.id} className="p-3 rounded-xl bg-white border border-slate-200 space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">
                            {q.question}
                          </span>
                          <span className="font-semibold text-slate-900 block text-xs break-words">
                            {displayVal}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}


          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1 font-medium">
            <p className="font-bold">Accreditation Notice:</p>
            <p>
              {isExternal 
                ? "By proceeding, your inter-collegiate entry is confirmed. A digital delegate pass with a secure QR code will be generated instantly."
                : "By proceeding, your registration is locked and linked to your verified BT ID. Digital passes with QR security codes are issued instantly upon confirmation."}
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <Button
              onClick={() => {
                setCurrentStep(2);
                scrollToStepTop();
              }}
              variant="outline"
              size="md"
              className="w-full sm:w-auto justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>

            <Button
              onClick={handleConfirmRegistration}
              isLoading={isSubmitting}
              variant="primary"
              size="md"
              className="w-full sm:w-auto justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              {totalPayableAmount > 0 ? (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Pay ₹{totalPayableAmount} &amp; Generate Pass</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Official Pass</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: PASS TICKET DISPLAY */}
      {currentStep === 4 && generatedTicket && (
        <div ref={stepContainerRef} id="registration-step-card" className="scroll-mt-20">
          <TicketPass
            registrationId={generatedTicket.registrationId}
            eventName={event.name}
            eventDate={event.date}
            eventVenue={event.venue}
            participantName={formData.fullName}
            department={isExternal ? (formData.collegeName ? `${formData.collegeName} • ${formData.department}` : formData.department) : formData.department}
            year={isExternal ? (formData.city ? `📍 ${formData.city} • ${formData.year}` : formData.year) : formData.year}
            teamType={formData.teamType}
            teamName={formData.teamName}
            teamMembers={formData.teamType === "Team" ? teamMembers.map((m) => isExternal ? `${m.name} (${m.department})` : `${m.name} (${m.btId})`) : undefined}
            ticketCode={generatedTicket.ticketCode}
            parentEventName={event.parentEventName}
            subEventBadge={event.subEventBadge}
            paymentStatus={generatedTicket.paymentStatus}
            paymentId={generatedTicket.paymentId}
          />
        </div>
      )}

      {/* Modal: Cancel Registration Dialog */}
      {existingRegistration && (
        <CancelRegistrationModal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          registration={existingRegistration}
          onCancelled={() => {
            setExistingRegistration(null);
          }}
        />
      )}

      {/* Modal: Paytm for Business & Direct UPI Checkout */}
      {paytmCheckoutData && (
        <Modal
          isOpen={Boolean(paytmCheckoutData)}
          onClose={() => {
            if (!isVerifyingPaytm) setPaytmCheckoutData(null);
          }}
          title="Secure UPI & Paytm Checkout"
          subtitle={`Delegate Registration Fee for ${event.name}`}
          maxWidth="md"
        >
          <div className="space-y-5 text-center">
            {/* Amount Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-[#002970]/20 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Payable
                </span>
                <span className="font-heading font-extrabold text-2xl text-[#002970]">
                  ₹{paytmCheckoutData.formattedAmount}
                </span>
              </div>
              <div className="text-right">
                <Badge variant="navy" size="sm">
                  LOCKED AMOUNT
                </Badge>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  0% Gateway Fee
                </span>
              </div>
            </div>

            {/* Choose Your UPI App (Mobile-First 1-Tap App Grid) */}
            <div className="space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Tap to Pay with your UPI App
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  Pre-Locked ₹{paytmCheckoutData.formattedAmount}
                </span>
              </div>

              {/* Grid of Dedicated UPI Apps */}
              <div className="grid grid-cols-3 gap-2">
                {/* Google Pay */}
                <a
                  href={paytmCheckoutData.gpayLink || paytmCheckoutData.upiLink}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm active:scale-95 transition-all text-center min-h-[64px] no-underline"
                >
                  <span className="text-sm font-extrabold text-slate-800 flex items-center gap-0.5 tracking-tight">
                    <span className="text-[#4285F4]">G</span>
                    <span className="text-[#EA4335]">P</span>
                    <span className="text-[#FBBC05]">a</span>
                    <span className="text-[#34A853]">y</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium mt-0.5">Google Pay</span>
                </a>

                {/* PhonePe */}
                <a
                  href={paytmCheckoutData.phonepeLink || paytmCheckoutData.upiLink}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#5f259f]/20 bg-[#5f259f]/5 hover:bg-[#5f259f]/10 hover:border-[#5f259f]/40 shadow-sm active:scale-95 transition-all text-center min-h-[64px] no-underline"
                >
                  <span className="text-sm font-extrabold text-[#5f259f] tracking-tight">PhonePe</span>
                  <span className="text-[10px] text-[#5f259f]/80 font-medium mt-0.5">Instant App</span>
                </a>

                {/* Paytm */}
                <a
                  href={paytmCheckoutData.paytmLink || paytmCheckoutData.upiLink}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#00b9f5]/30 bg-[#00b9f5]/5 hover:bg-[#00b9f5]/10 hover:border-[#00b9f5]/50 shadow-sm active:scale-95 transition-all text-center min-h-[64px] no-underline"
                >
                  <span className="text-sm font-extrabold text-[#002970] tracking-tight">Paytm</span>
                  <span className="text-[10px] text-[#00b9f5] font-bold mt-0.5">Fast UPI</span>
                </a>
              </div>

              {/* Any / Other UPI App (WhatsApp, Cred, BHIM, Bank Apps) */}
              <a
                href={paytmCheckoutData.upiLink}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 min-h-[42px] no-underline"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-600" />
                <span>Other UPI Apps (WhatsApp, Cred, BHIM, Bank Apps)</span>
              </a>
            </div>

            {/* Dynamic QR Code Section (Prominent on desktop/laptop, compact/toggleable on mobile) */}
            <div className="pt-1">
              <div className="hidden sm:block p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center shadow-sm">
                <div className="p-3 bg-white rounded-xl inline-block border border-slate-200">
                  <ScannableQRCode value={paytmCheckoutData.upiLink} size={160} />
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-2">
                  Scan QR with any UPI App on your phone
                </p>
              </div>

              {/* Mobile QR Toggle */}
              <div className="sm:hidden text-center">
                {!showQrOnMobile ? (
                  <button
                    type="button"
                    onClick={() => setShowQrOnMobile(true)}
                    className="text-xs text-[#002970] font-bold hover:underline py-1.5 inline-flex items-center gap-1.5 min-h-[36px]"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#002970]" />
                    <span>Paying from another phone? Show QR Code</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 inline-block mx-auto text-center">
                    <div className="p-2 bg-white rounded-lg inline-block border border-slate-200">
                      <ScannableQRCode value={paytmCheckoutData.upiLink} size={140} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQrOnMobile(false)}
                      className="block mx-auto text-[11px] text-slate-500 hover:text-slate-700 font-semibold mt-1 py-1"
                    >
                      Hide QR Code
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Live Auto-Approval Radar Banner */}
            <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-left space-y-2.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
                </span>
                <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                  Auto-Approval Radar Active
                </span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                Pay using Google Pay, PhonePe, Paytm, or scan the QR code. Once payment completes, your registration pass will <strong>automatically generate on this screen</strong> within seconds!
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-mono">
                <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Waiting for payment signal • Listening live...</span>
              </div>
            </div>

            {/* Manual Fallback (If phone was off or notification delayed) */}
            <div className="pt-2 text-center">
              {!showManualUtr ? (
                <button
                  type="button"
                  onClick={() => setShowManualUtr(true)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold underline underline-offset-4 py-1.5 transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <span>Paid but pass didn&apos;t auto-activate? Enter 12-digit UTR manually &rarr;</span>
                </button>
              ) : (
                <div className="pt-3 border-t border-slate-200 text-left space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      12-Digit UPI Reference / UTR Number
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowManualUtr(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                    >
                      Hide manual entry
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    If auto-detection was delayed, copy the 12-digit UTR from your UPI payment receipt and paste below.
                  </p>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="e.g. 425512345678 (12 digits)"
                    value={paytmUtr}
                    onChange={(e) => {
                      const onlyNums = e.target.value.replace(/\D/g, "");
                      setPaytmUtr(onlyNums);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 tracking-wider focus:outline-none focus:ring-2 focus:ring-[#002970]/30"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                    <span>Digits: {paytmUtr.length}/12</span>
                    {paytmUtr.length === 12 ? (
                      <span className="text-emerald-600 font-bold">✓ Complete 12-digit UTR</span>
                    ) : (
                      <span>Enter exactly 12 digits</span>
                    )}
                  </div>

                  <Button
                    onClick={handleVerifyPaytmPayment}
                    isLoading={isVerifyingPaytm}
                    disabled={paytmUtr.length !== 12 || isVerifyingPaytm}
                    variant="primary"
                    size="md"
                    className="w-full justify-center gap-2 cursor-pointer min-h-[46px] disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Submit UTR &amp; Register for Event</span>
                  </Button>

                  <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Manual Fallback:</strong> If submitted manually, the pass will be issued in <strong>Pending Verification</strong> status and cross-verified against the ledger before gate clearance.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
