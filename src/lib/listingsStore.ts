import { ListingItem, ListingResponseRecord } from "@/types/listings";
import { initialListings } from "@/data/listings";
import { 
  saveSiteContentToFirestore, 
  getSiteContentFromFirestore, 
  subscribeToSiteContent 
} from "./firebase/firestore";
import { enqueueCloudWrite } from "./dataSyncEngine";

export const LISTINGS_STORAGE_KEY = "src_listings_v1";
export const RESPONSES_STORAGE_KEY = "src_listing_responses_v1";

// Helper: Compact listings to keep LocalStorage strictly below 5MB quota
export function compactListingsDataset(listings: ListingItem[]): ListingItem[] {
  return listings.map((item) => ({
    ...item,
    // Strip oversized base64 strings if accidentally passed
    coverImage: item.coverImage && item.coverImage.startsWith("data:") && item.coverImage.length > 350000 
      ? "" 
      : item.coverImage,
    bannerImage: item.bannerImage && item.bannerImage.startsWith("data:") && item.bannerImage.length > 350000 
      ? "" 
      : item.bannerImage,
  }));
}

// --------------------------------------------------------------------------
// 1. LISTINGS STORE OPERATIONS
// --------------------------------------------------------------------------

export function getStoredListings(): ListingItem[] {
  if (typeof window === "undefined") return initialListings;

  try {
    const raw = localStorage.getItem(LISTINGS_STORAGE_KEY);
    if (!raw) {
      saveStoredListings(initialListings);
      return initialListings;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveStoredListings(initialListings);
      return initialListings;
    }
    return parsed;
  } catch (err) {
    console.warn("Failed to read listings from localStorage, fallback to initial:", err);
    return initialListings;
  }
}

export function saveStoredListings(listings: ListingItem[]): void {
  const compacted = compactListingsDataset(listings);

  // 1. Safe localStorage write
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(compacted));
    } catch (lsErr) {
      console.warn("localStorage quota exceeded for listings:", lsErr);
    }

    // 2. Dispatch cross-tab sync event
    try {
      window.dispatchEvent(
        new CustomEvent("src_listings_updated", { detail: compacted })
      );
    } catch (evtErr) {
      console.warn("CustomEvent dispatch failed for listings:", evtErr);
    }
  }

  // 3. Instant Cloud Dual-Write Invariant: Direct Firestore + Atomic Offline Queue
  saveSiteContentToFirestore("listings", compacted).catch((cloudErr) => {
    console.warn("Firestore direct write for listings failed, enqueuing:", cloudErr);
  });

  enqueueCloudWrite("listings", compacted, "Listings Update");
}

export async function syncListingsFromFirestore(): Promise<ListingItem[] | null> {
  try {
    const remote = await getSiteContentFromFirestore<ListingItem[]>("listings");
    if (remote && Array.isArray(remote) && remote.length > 0) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(remote));
          window.dispatchEvent(new CustomEvent("src_listings_updated", { detail: remote }));
        } catch (e) {
          console.warn("Failed to update localStorage with remote listings:", e);
        }
      }
      return remote;
    }
  } catch (err) {
    console.warn("Error syncing listings from Firestore:", err);
  }
  return null;
}

export function subscribeToListings(callback: (listings: ListingItem[]) => void): () => void {
  // Listen to Firestore real-time snapshot
  const unsubFirestore = subscribeToSiteContent<ListingItem[]>("listings", (data) => {
    if (data && Array.isArray(data)) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
          console.warn("Failed to cache listings snapshot to localStorage:", e);
        }
      }
      callback(data);
    }
  });

  // Listen to local window events across tabs
  const handleLocalEvent = (e: any) => {
    if (e?.detail && Array.isArray(e.detail)) {
      callback(e.detail);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("src_listings_updated", handleLocalEvent);
  }

  return () => {
    unsubFirestore();
    if (typeof window !== "undefined") {
      window.removeEventListener("src_listings_updated", handleLocalEvent);
    }
  };
}

// --------------------------------------------------------------------------
// 2. POLL VOTING ENGINE
// --------------------------------------------------------------------------

export function getStoredVotedPolls(userId?: string): Record<string, string> {
  if (typeof window === "undefined" || !userId) return {};
  try {
    localStorage.removeItem("src_voted_polls");
    return JSON.parse(localStorage.getItem(`src_voted_polls_${userId}`) || "{}");
  } catch {
    return {};
  }
}

export function voteOnListingPoll(
  listingId: string, 
  optionId: string, 
  userVoterKey: string,
  voterInfo?: {
    userId?: string;
    userName?: string;
    userEmail?: string | null;
    userDepartment?: string;
    userYear?: string;
    btId?: string;
    isAnonymous?: boolean;
  }
): { success: boolean; updatedListing?: ListingItem; error?: string } {
  // STRICT: Require authentication to cast a vote on campus polls
  const voterId = voterInfo?.userId;
  if (!voterId || userVoterKey.startsWith("anon-")) {
    return { success: false, error: "Please sign in with your student account to cast your vote." };
  }

  const currentListings = getStoredListings();
  const index = currentListings.findIndex((l) => l.id === listingId);

  if (index === -1) {
    return { success: false, error: "Listing not found. Please refresh the page." };
  }

  const target = currentListings[index];
  if (target.type !== "poll" || !target.pollConfig) {
    return { success: false, error: "Target is not an active poll" };
  }

  // Prevent multiple votes from same voter in user-scoped localStorage
  const votedPollsKey = `src_voted_polls_${voterId}`;
  let votedMap: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      votedMap = JSON.parse(localStorage.getItem(votedPollsKey) || "{}");
      localStorage.removeItem("src_voted_polls");
    } catch {}
  }

  const existingVoteOptionId = votedMap[listingId];
  const optionStillExists = target.pollConfig.options.some((o) => o.id === existingVoteOptionId);
  const totalVotesSoFar = target.pollConfig.totalVotes || 0;

  // Only consider previously voted if the option still exists and totalVotes > 0
  if (existingVoteOptionId && optionStillExists && totalVotesSoFar > 0) {
    return { success: false, error: "You have already cast your vote on this poll." };
  }

  // Find target option
  const chosenOption = target.pollConfig.options.find((opt) => opt.id === optionId);
  if (!chosenOption) {
    return { success: false, error: "Selected option is no longer valid." };
  }

  // Increment option votes
  const updatedOptions = target.pollConfig.options.map((opt) =>
    opt.id === optionId ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
  );

  const updatedListing: ListingItem = {
    ...target,
    pollConfig: {
      ...target.pollConfig,
      options: updatedOptions,
      totalVotes: totalVotesSoFar + 1,
    },
  };

  const updatedList = [...currentListings];
  updatedList[index] = updatedListing;
  saveStoredListings(updatedList);

  // Record voter locally
  if (typeof window !== "undefined") {
    try {
      votedMap[listingId] = optionId;
      localStorage.setItem(votedPollsKey, JSON.stringify(votedMap));
      localStorage.removeItem("src_voted_polls");
    } catch {}
  }

  // Record official ListingResponseRecord so votes appear in Admin Voter Log and can be audited/exported
  try {
    const isAnon = Boolean(target.pollConfig.isAnonymous || voterInfo?.isAnonymous);
    const ballotRecord: ListingResponseRecord = {
      id: `ballot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      listingId: target.id,
      listingSlug: target.slug,
      listingType: "poll",
      listingTitle: target.title,
      userId: isAnon ? undefined : voterInfo?.userId,
      userName: isAnon ? "Anonymous Voter" : (voterInfo?.userName || "Campus Student"),
      userEmail: isAnon ? undefined : (voterInfo?.userEmail || undefined),
      userDepartment: voterInfo?.userDepartment,
      userYear: voterInfo?.userYear,
      btId: isAnon ? undefined : voterInfo?.btId,
      isAnonymous: isAnon,
      selectedOptionIds: [optionId],
      answers: {
        [optionId]: chosenOption.text,
      },
      createdAt: new Date().toISOString(),
      status: "approved",
    };
    saveStoredListingResponse(ballotRecord);
  } catch (err) {
    console.warn("Failed to persist ballot response record:", err);
  }

  return { success: true, updatedListing };
}

// --------------------------------------------------------------------------
// 3. RESPONSES STORE OPERATIONS (Applications, Submissions, Grievances)
// --------------------------------------------------------------------------

export function getStoredListingResponses(): ListingResponseRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(RESPONSES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Failed to load listing responses from localStorage:", err);
    return [];
  }
}

export function saveStoredListingResponse(record: ListingResponseRecord): void {
  const current = getStoredListingResponses();
  
  // Check if updating an existing record by explicit ID or by user+listing matching
  const exactIndex = current.findIndex((r) => r.id === record.id);
  const matchUserIndex = exactIndex === -1 
    ? current.findIndex(
        (r) =>
          r.listingId === record.listingId &&
          ((r.userId && record.userId && r.userId === record.userId) ||
           (r.userEmail && record.userEmail && r.userEmail.toLowerCase().trim() === record.userEmail.toLowerCase().trim()))
      )
    : -1;

  const targetIndex = exactIndex !== -1 ? exactIndex : matchUserIndex;
  let updated: ListingResponseRecord[];

  if (targetIndex !== -1) {
    const existing = current[targetIndex];
    const mergedRecord: ListingResponseRecord = {
      ...existing,
      ...record,
      id: existing.id,
      ticketCode: existing.ticketCode || record.ticketCode,
      createdAt: existing.createdAt || record.createdAt,
      updatedAt: new Date().toISOString(),
    };
    updated = [...current];
    updated[targetIndex] = mergedRecord;
  } else {
    updated = [record, ...current];
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("localStorage quota exceeded for listing responses:", e);
    }

    try {
      window.dispatchEvent(
        new CustomEvent("src_listing_responses_updated", { detail: updated })
      );
    } catch {}
  }

  // Cloud Sync: Dual-write to global responses index & per-listing partition
  const listingFiltered = updated.filter((r) => r.listingId === record.listingId);
  saveSiteContentToFirestore("listing_responses", updated).catch((err) => {
    console.warn("Direct write for global listing responses failed, enqueuing:", err);
  });
  saveSiteContentToFirestore(`responses_${record.listingId}`, listingFiltered).catch((err) => {
    console.warn("Direct write for per-listing response failed:", err);
  });

  enqueueCloudWrite("listing_responses", updated, "Listing Response");
}

export async function syncListingResponsesFromFirestore(): Promise<ListingResponseRecord[] | null> {
  try {
    const remote = await getSiteContentFromFirestore<ListingResponseRecord[]>("listing_responses");
    if (remote && Array.isArray(remote)) {
      // Remote Firestore state is authoritative (Invariant 9: Cloud-Authoritative Dataset Invariant)
      const merged = [...remote].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(merged));
          window.dispatchEvent(
            new CustomEvent("src_listing_responses_updated", { detail: merged })
          );
        } catch (e) {
          console.warn("Failed to persist synced listing responses:", e);
        }
      }
      return merged;
    }
  } catch (err) {
    console.warn("Error syncing listing responses from Firestore:", err);
  }
  return null;
}

export function subscribeToListingResponses(
  callback: (responses: ListingResponseRecord[]) => void
): () => void {
  // Listen to Firestore real-time snapshot
  const unsubFirestore = subscribeToSiteContent<ListingResponseRecord[]>("listing_responses", (data) => {
    if (data && Array.isArray(data)) {
      callback(data);
    }
  });

  // Listen to local window events across tabs
  const handleLocalEvent = (e: any) => {
    if (e?.detail && Array.isArray(e.detail)) {
      callback(e.detail);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("src_listing_responses_updated", handleLocalEvent);
  }

  return () => {
    unsubFirestore();
    if (typeof window !== "undefined") {
      window.removeEventListener("src_listing_responses_updated", handleLocalEvent);
    }
  };
}

export function deleteStoredListingResponse(responseId: string, listingId: string): void {
  const current = getStoredListingResponses();
  const updated = current.filter((r) => r.id !== responseId);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("localStorage quota exceeded for listing responses:", e);
    }

    try {
      window.dispatchEvent(
        new CustomEvent("src_listing_responses_updated", { detail: updated })
      );
    } catch {}
  }

  // Cloud Sync
  saveSiteContentToFirestore("listing_responses", updated).catch((err) => {
    console.warn("Direct write for global response deletion failed, enqueuing:", err);
  });
  saveSiteContentToFirestore(`responses_${listingId}`, updated.filter((r) => r.listingId === listingId)).catch((err) => {
    console.warn("Direct write for per-listing response deletion failed:", err);
  });

  enqueueCloudWrite("listing_responses", updated, "Delete Listing Response");
}

