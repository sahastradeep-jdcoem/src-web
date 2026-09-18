import { SrcDispatch, SrcDispatchResponseRecord } from "@/types/srcDispatch";
import { 
  saveSiteContentToFirestore, 
  getSiteContentFromFirestore, 
  subscribeToSiteContent,
  cleanUndefined 
} from "./firebase/firestore";
import { enqueueCloudWrite, reconcileArrayDatasets } from "./dataSyncEngine";

export const SRC_DISPATCHES_STORAGE_KEY = "src_dispatches_v1";
export const SRC_DISPATCH_RESPONSES_STORAGE_KEY = "src_dispatch_responses_v1";

export const initialSrcDispatches: SrcDispatch[] = [
  {
    id: "dispatch-welcome-01",
    title: "Official Council Communications & Portal Activation",
    category: "update",
    priority: "important",
    targetType: "all_members",
    content: "Welcome to the central JDCOEM Student Representative Council Operations Desk. All council officers, committee heads, club leaders, and active members now receive synchronized administrative dispatches, meeting notices, event directives, and official payment reconciliations directly within this verified suite.",
    badgeText: "Council Directorate",
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    authorName: "SRC Executive Secretariat",
    authorRole: "Central Governance",
    status: "active",
  },
  {
    id: "dispatch-meet-02",
    title: "All-Council General Assembly & Fest Planning Conclave",
    category: "event",
    priority: "important",
    targetType: "all_members",
    content: "Mandatory review of festival timeline deliverables, club allocations, stage logistics, and budget requisitions. All Admin Council officers, Club Heads, and designated spokespersons are required to attend in official council attire.",
    badgeText: "Conclave",
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    eventDetails: {
      eventName: "SRC Annual General Assembly 2026",
      date: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
      time: "03:30 PM - 05:30 PM",
      venue: "Central Seminar Hall 1 (Admin Block)",
      meetingType: "in_person",
      agenda: "1. Fest Blueprint Review\n2. Sponsorship Progress\n3. Club Budget Disbursals",
    },
    authorName: "Harsh Shende",
    authorRole: "Technical Affairs Secretary",
    status: "active",
  },
  {
    id: "dispatch-form-04",
    title: "Council Operations Logistics & Committee Preference Intake",
    category: "form",
    priority: "important",
    targetType: "all_members",
    content: "Official SRC Operations intake form. Please specify your preferred committee domain, logistical availability on campus, and verified polo shirt sizing for festival accreditation.",
    badgeText: "SRC Forms",
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    formDeadline: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
    allowResponseEditing: true,
    requiresApproval: true,
    formFields: [
      {
        id: "f-track",
        type: "multiple_choice",
        question: "Preferred Committee Track",
        description: "Select the operational domain you wish to lead during the upcoming festival.",
        required: true,
        options: ["Hospitality & VIP Protocol", "Stage & Production Logistics", "Technical & Web Operations", "Sponsorship & PR"],
      },
      {
        id: "f-tshirt",
        type: "dropdown",
        question: "Official Council Polo / T-Shirt Size",
        description: "Collegiate unisex sizing for badges and attire.",
        required: true,
        options: ["S (38)", "M (40)", "L (42)", "XL (44)", "XXL (46)"],
      },
      {
        id: "f-availability",
        type: "checkboxes",
        question: "Campus Availability Windows",
        description: "Select all shift slots you can commit to.",
        required: true,
        options: ["Morning Rehearsals (9 AM - 12 PM)", "Afternoon Logistics (1 PM - 4 PM)", "Evening Main Stage (4 PM - 8 PM)"],
      },
      {
        id: "f-notes",
        type: "long_text",
        question: "Operational Experience / Special Skills",
        description: "Mention any relevant skills (e.g., sound engineering, crowd control, videography).",
        required: false,
        placeholder: "e.g. Led technical coordination last semester, certified in first-aid...",
      }
    ],
    authorName: "SRC Executive Secretariat",
    authorRole: "Central Governance",
    status: "active",
  },
  {
    id: "dispatch-payment-03",
    title: "Official Council Insignia, Badge & Kit Requisition",
    category: "payment_qr",
    priority: "normal",
    targetType: "all_members",
    content: "Requisition for the official 2025-26 Council Delegate Package including metallic laser-engraved council pin, gold-embossed credential lanyard, and festival access pass badge.",
    badgeText: "Dues Clearance",
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    paymentDetails: {
      amount: 450,
      purpose: "Council ID Kit & Metallic Lapel Pin",
      upiId: "srcjdcoem@oksbi",
      payeeName: "SRC JDCOEM Central Account",
      deadline: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
      note: "Please enter your College BT ID in the UPI transaction remarks for instant verification.",
    },
    authorName: "SRC Finance Wing",
    authorRole: "Treasury Committee",
    status: "active",
  }
];

export function compactSrcDispatches(dispatches: SrcDispatch[]): SrcDispatch[] {
  return dispatches.map((d) => ({
    ...d,
    content: d.content || "",
    paymentDetails: d.paymentDetails ? {
      ...d.paymentDetails,
      qrImageUrl: d.paymentDetails.qrImageUrl && d.paymentDetails.qrImageUrl.length > 350000 
        ? "" 
        : d.paymentDetails.qrImageUrl,
    } : undefined,
  }));
}

export function getStoredSrcDispatches(): SrcDispatch[] {
  if (typeof window === "undefined") return initialSrcDispatches;
  try {
    const raw = localStorage.getItem(SRC_DISPATCHES_STORAGE_KEY);
    if (!raw) return initialSrcDispatches;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return initialSrcDispatches;
    return parsed;
  } catch (err) {
    console.warn("Failed to read src dispatches from localStorage:", err);
    return initialSrcDispatches;
  }
}

export async function saveStoredSrcDispatches(dispatches: SrcDispatch[]): Promise<void> {
  const compacted = compactSrcDispatches(dispatches);

  // 1. Safe local storage write
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SRC_DISPATCHES_STORAGE_KEY, JSON.stringify(compacted));
    } catch (e) {
      console.warn("LocalStorage quota warning on src dispatches:", e);
    }

    try {
      window.dispatchEvent(
        new CustomEvent("src_dispatches_updated", { detail: compacted })
      );
    } catch {}
  }

  // 2. Direct instant cloud write + atomic queue fallback
  let cloudError: any = null;
  try {
    await saveSiteContentToFirestore("src_dispatches", cleanUndefined(compacted));
  } catch (err) {
    cloudError = err;
    console.warn("Direct cloud save for src_dispatches failed, queuing offline write:", err);
  }

  try {
    enqueueCloudWrite(
      "src_dispatches",
      cleanUndefined(compacted),
      "SRC Dispatches Update"
    );
  } catch (qErr) {
    console.error("Failed to enqueue cloud write for src_dispatches:", qErr);
  }

  if (cloudError) {
    // Non-fatal because local cache and offline queue are preserved
  }
}

export async function syncSrcDispatchesFromFirestore(): Promise<SrcDispatch[]> {
  try {
    const remote = await getSiteContentFromFirestore("src_dispatches");
    if (remote && Array.isArray(remote)) {
      const local = getStoredSrcDispatches();
      const reconciled = reconcileArrayDatasets(local, remote);
      const compacted = compactSrcDispatches(reconciled);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(SRC_DISPATCHES_STORAGE_KEY, JSON.stringify(compacted));
        } catch {}
        try {
          window.dispatchEvent(
            new CustomEvent("src_dispatches_updated", { detail: compacted })
          );
        } catch {}
      }
      return compacted;
    }
  } catch (err) {
    console.warn("Could not fetch src_dispatches from Firestore:", err);
  }
  return getStoredSrcDispatches();
}

export function subscribeToSrcDispatches(callback: (dispatches: SrcDispatch[]) => void): () => void {
  const handleLocalUpdate = (e: Event) => {
    const custom = e as CustomEvent<SrcDispatch[]>;
    if (custom && custom.detail && Array.isArray(custom.detail)) {
      callback(custom.detail);
    } else {
      callback(getStoredSrcDispatches());
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("src_dispatches_updated", handleLocalUpdate);
  }

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = subscribeToSiteContent("src_dispatches", (remote) => {
      if (remote && Array.isArray(remote)) {
        const compacted = compactSrcDispatches(remote);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(SRC_DISPATCHES_STORAGE_KEY, JSON.stringify(compacted));
          } catch {}
        }
        callback(compacted);
      }
    });
  } catch (err) {
    console.warn("Firestore subscription error for src_dispatches:", err);
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("src_dispatches_updated", handleLocalUpdate);
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
}

/* ========================================================================== */
/* SRC FORMS: OPERATIONS DISPATCH RESPONSES ENGINE                            */
/* ========================================================================== */

export function getStoredDispatchResponses(): SrcDispatchResponseRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SRC_DISPATCH_RESPONSES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to read dispatch responses from localStorage:", err);
    return [];
  }
}

export async function saveStoredDispatchResponse(record: SrcDispatchResponseRecord): Promise<void> {
  const existing = getStoredDispatchResponses();
  const idx = existing.findIndex((r) => r.id === record.id || (r.dispatchId === record.dispatchId && r.userId === record.userId && Boolean(record.userId)));
  
  let updated: SrcDispatchResponseRecord[];
  if (idx !== -1) {
    updated = [...existing];
    updated[idx] = { ...existing[idx], ...record, updatedAt: new Date().toISOString() };
  } else {
    updated = [record, ...existing];
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SRC_DISPATCH_RESPONSES_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("LocalStorage quota warning on dispatch responses:", e);
    }

    try {
      window.dispatchEvent(
        new CustomEvent("src_dispatch_responses_updated", { detail: updated })
      );
    } catch {}
  }

  try {
    await saveSiteContentToFirestore("src_dispatch_responses", cleanUndefined(updated));
  } catch (err) {
    console.warn("Direct cloud save for dispatch responses failed, enqueuing:", err);
  }

  enqueueCloudWrite("src_dispatch_responses", cleanUndefined(updated), "Dispatch Response Recorded");
}

export async function updateDispatchResponseStatus(
  respId: string, 
  status: "pending" | "approved" | "rejected" | "resolved" | "reviewed",
  adminFeedback?: string
): Promise<void> {
  const existing = getStoredDispatchResponses();
  const updated = existing.map((r) => {
    if (r.id !== respId) return r;
    return {
      ...r,
      status,
      adminFeedback: adminFeedback !== undefined ? adminFeedback : r.adminFeedback,
      updatedAt: new Date().toISOString(),
    };
  });

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SRC_DISPATCH_RESPONSES_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("src_dispatch_responses_updated", { detail: updated }));
    } catch {}
  }

  try {
    await saveSiteContentToFirestore("src_dispatch_responses", cleanUndefined(updated));
  } catch (err) {
    console.warn("Failed to update response status in Firestore:", err);
  }

  enqueueCloudWrite("src_dispatch_responses", cleanUndefined(updated), "Dispatch Response Status Updated");
}

export async function deleteStoredDispatchResponse(respId: string): Promise<void> {
  const existing = getStoredDispatchResponses();
  const updated = existing.filter((r) => r.id !== respId);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SRC_DISPATCH_RESPONSES_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("src_dispatch_responses_updated", { detail: updated }));
    } catch {}
  }

  try {
    await saveSiteContentToFirestore("src_dispatch_responses", cleanUndefined(updated));
  } catch (err) {
    console.warn("Failed to delete response from Firestore:", err);
  }

  enqueueCloudWrite("src_dispatch_responses", cleanUndefined(updated), "Dispatch Response Deleted");
}

export async function syncDispatchResponsesFromFirestore(): Promise<SrcDispatchResponseRecord[]> {
  try {
    const remote = await getSiteContentFromFirestore("src_dispatch_responses");
    if (remote && Array.isArray(remote)) {
      const local = getStoredDispatchResponses();
      const reconciled = reconcileArrayDatasets(local, remote);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(SRC_DISPATCH_RESPONSES_STORAGE_KEY, JSON.stringify(reconciled));
          window.dispatchEvent(new CustomEvent("src_dispatch_responses_updated", { detail: reconciled }));
        } catch {}
      }
      return reconciled;
    }
  } catch (err) {
    console.warn("Could not sync dispatch responses from Firestore:", err);
  }
  return getStoredDispatchResponses();
}

export function subscribeToDispatchResponses(callback: (responses: SrcDispatchResponseRecord[]) => void): () => void {
  const handleLocalUpdate = (e: Event) => {
    const custom = e as CustomEvent<SrcDispatchResponseRecord[]>;
    if (custom && custom.detail && Array.isArray(custom.detail)) {
      callback(custom.detail);
    } else {
      callback(getStoredDispatchResponses());
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("src_dispatch_responses_updated", handleLocalUpdate);
  }

  let unsubFirestore: (() => void) | null = null;
  try {
    unsubFirestore = subscribeToSiteContent("src_dispatch_responses", (remote) => {
      if (remote && Array.isArray(remote)) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(SRC_DISPATCH_RESPONSES_STORAGE_KEY, JSON.stringify(remote));
          } catch {}
        }
        callback(remote);
      }
    });
  } catch (err) {
    console.warn("Firestore subscription error for dispatch responses:", err);
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("src_dispatch_responses_updated", handleLocalUpdate);
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
}
