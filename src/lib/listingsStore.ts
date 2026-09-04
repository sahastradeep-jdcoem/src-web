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

export function voteOnListingPoll(
  listingId: string, 
  optionId: string, 
  userVoterKey: string
): { success: boolean; updatedListing?: ListingItem; error?: string } {
  const currentListings = getStoredListings();
  const index = currentListings.findIndex((l) => l.id === listingId);

  if (index === -1) {
    return { success: false, error: "Listing not found" };
  }

  const target = currentListings[index];
  if (target.type !== "poll" || !target.pollConfig) {
    return { success: false, error: "Target is not an active poll" };
  }

  // Prevent multiple votes from same voter key in localStorage
  const votedPollsKey = "src_voted_polls";
  let votedMap: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      votedMap = JSON.parse(localStorage.getItem(votedPollsKey) || "{}");
    } catch {}
  }

  if (votedMap[listingId]) {
    return { success: false, error: "You have already cast your vote on this poll." };
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
      totalVotes: (target.pollConfig.totalVotes || 0) + 1,
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
    } catch {}
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
  const updated = [record, ...current.filter((r) => r.id !== record.id)];

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
  saveSiteContentToFirestore(`responses_${record.listingId}`, updated).catch((err) => {
    console.warn("Direct write for response failed, enqueuing:", err);
  });

  enqueueCloudWrite(`responses_${record.listingId}`, updated, "Listing Response");
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
  saveSiteContentToFirestore(`responses_${listingId}`, updated).catch((err) => {
    console.warn("Direct write for response deletion failed, enqueuing:", err);
  });

  enqueueCloudWrite(`responses_${listingId}`, updated, "Delete Listing Response");
}

