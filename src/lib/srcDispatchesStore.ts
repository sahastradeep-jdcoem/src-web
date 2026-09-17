import { SrcDispatch } from "@/types/srcDispatch";
import { 
  saveSiteContentToFirestore, 
  getSiteContentFromFirestore, 
  subscribeToSiteContent,
  cleanUndefined 
} from "./firebase/firestore";
import { enqueueCloudWrite, reconcileArrayDatasets } from "./dataSyncEngine";

export const SRC_DISPATCHES_STORAGE_KEY = "src_dispatches_v1";

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
  // 1. Local custom event listener
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

  // 2. Real-time Firestore document listener
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
