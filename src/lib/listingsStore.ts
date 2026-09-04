import { ListingItem, ListingResponseRecord } from "@/types/listings";
import { initialListings } from "@/data/listings";
import { 
  saveSiteContentToFirestore, 
  getSiteContentFromFirestore, 
  subscribeToSiteContent,
  saveUserProfileToFirestore
} from "./firebase/firestore";
import { enqueueCloudWrite } from "./dataSyncEngine";
import { db } from "./firebase/config";
import { doc, setDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";

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

export const MOCK_LISTING_IDS = new Set([
  "list-poll-01",
  "list-opp-01",
  "list-app-01",
  "list-sub-01",
  "list-issue-01",
  "choose-annual-fest-theme-2026",
  "src-digital-media-fellowship-2026",
  "aeromodelling-club-core-team-selection",
  "monsoon-campus-photography-challenge",
  "campus-amenities-canteen-grievance-desk",
]);

export function getStoredListings(): ListingItem[] {
  if (typeof window === "undefined") return initialListings;

  try {
    const raw = localStorage.getItem(LISTINGS_STORAGE_KEY);
    if (!raw) {
      return initialListings;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return initialListings;
    }
    // Filter out any stale mock items cached in localStorage
    const clean = parsed.filter((l) => !MOCK_LISTING_IDS.has(l.id) && !MOCK_LISTING_IDS.has(l.slug));
    if (clean.length === 0 && initialListings.length > 0) {
      return initialListings;
    }
    return clean;
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
    if (remote && Array.isArray(remote)) {
      // Purge any legacy hardcoded mock items if found in cloud
      const hasMockItems = remote.some((l) => MOCK_LISTING_IDS.has(l.id) || MOCK_LISTING_IDS.has(l.slug));
      let cleanRemote = remote.filter((l) => !MOCK_LISTING_IDS.has(l.id) && !MOCK_LISTING_IDS.has(l.slug));

      // If all manual items were wiped by previous mock overwrite, restore from initialListings
      if (cleanRemote.length === 0 && initialListings.length > 0) {
        cleanRemote = [...initialListings];
      } else {
        // Ensure verified manual listings from initialListings are retained if missing from remote
        for (const item of initialListings) {
          if (!cleanRemote.some((r) => r.id === item.id || r.slug === item.slug)) {
            cleanRemote.push(item);
          }
        }
      }

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(cleanRemote));
          window.dispatchEvent(new CustomEvent("src_listings_updated", { detail: cleanRemote }));
        } catch (e) {
          console.warn("Failed to update localStorage with remote listings:", e);
        }
      }

      // If mock items were detected in remote, sync clean dataset back to Firestore
      if (hasMockItems) {
        saveSiteContentToFirestore("listings", compactListingsDataset(cleanRemote)).catch(() => {});
      }

      return cleanRemote;
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
      const cleanData = data.filter((l) => !MOCK_LISTING_IDS.has(l.id) && !MOCK_LISTING_IDS.has(l.slug));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(cleanData));
        } catch (e) {
          console.warn("Failed to cache listings snapshot to localStorage:", e);
        }
      }
      callback(cleanData);
    }
  });

  // Listen to local window events across tabs
  const handleLocalEvent = (e: any) => {
    if (e?.detail && Array.isArray(e.detail)) {
      const cleanData = e.detail.filter((l: ListingItem) => !MOCK_LISTING_IDS.has(l.id) && !MOCK_LISTING_IDS.has(l.slug));
      callback(cleanData);
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

  // Only consider previously voted if the option still exists
  if (existingVoteOptionId && optionStillExists) {
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
    const ballotId = `hub_poll_${target.id}_${voterId}`;
    const ballotRecord: ListingResponseRecord = {
      id: ballotId,
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

    // CRITICAL: Guaranteed persistence in users/{voterId} (owner write) AND registrations (create: true)
    if (voterId) {
      // 1. Write to student user profile in Firestore
      saveUserProfileToFirestore(voterId, {
        votedPolls: { ...votedMap, [listingId]: optionId },
      }).catch((e) => console.warn("User profile votedPolls save notice:", e));

      // 2. Write ballot to registrations collection in Firestore (create permitted for all students)
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const regDocRef = doc(db, "registrations", `hub_poll_${listingId}_${voterId}`);
        setDoc(regDocRef, {
          id: `hub_poll_${listingId}_${voterId}`,
          eventId: listingId,
          eventTitle: `[POLL BALLOT] ${target.title}`,
          leaderName: isAnon ? "Anonymous Voter" : (voterInfo?.userName || "Campus Student"),
          email: isAnon ? "" : (voterInfo?.userEmail || ""),
          phone: "",
          college: "JDCOEM",
          department: voterInfo?.userDepartment || "",
          year: voterInfo?.userYear || "",
          btId: isAnon ? "" : (voterInfo?.btId || ""),
          teamSize: 1,
          status: "CONFIRMED",
          registeredAt: new Date().toISOString(),
          createdAt: serverTimestamp(),
          qrPayload: `SRC:POLL:${listingId}:${optionId}`,
          customAnswers: {
            isHubBallot: true,
            listingId: target.id,
            listingSlug: target.slug,
            listingType: "poll",
            listingTitle: target.title,
            optionId: optionId,
            optionText: chosenOption.text,
            voterId: voterId,
            voterName: isAnon ? "Anonymous Voter" : (voterInfo?.userName || "Campus Student"),
            voterEmail: isAnon ? null : (voterInfo?.userEmail || null),
            voterDepartment: voterInfo?.userDepartment || "",
            voterYear: voterInfo?.userYear || "",
            voterBtId: isAnon ? null : (voterInfo?.btId || null),
            isAnonymous: isAnon,
          },
        }).catch((e) => console.warn("Firestore registration poll ballot write notice:", e));
      }
    }
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

  // 1. Immediate optimistic local write
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

  // 2. Cloud Sync: Fetch fresh remote state first to avoid overwriting responses from other devices
  (async () => {
    try {
      const remote = await getSiteContentFromFirestore<ListingResponseRecord[]>("listing_responses");
      const remoteList = Array.isArray(remote) ? remote : [];
      
      const map = new Map<string, ListingResponseRecord>();
      // Put existing remote records first
      remoteList.forEach((r) => map.set(r.id, r));
      // Put current local records
      updated.forEach((r) => map.set(r.id, r));
      // Ensure the newly saved record is present
      map.set(record.id, record);

      const combined = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      // Save combined to Firestore
      await saveSiteContentToFirestore("listing_responses", combined);

      // Also partition by listing
      const listingFiltered = combined.filter((r) => r.listingId === record.listingId);
      await saveSiteContentToFirestore(`responses_${record.listingId}`, listingFiltered);

      // Update local storage with full combined set
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(combined));
          window.dispatchEvent(
            new CustomEvent("src_listing_responses_updated", { detail: combined })
          );
        } catch {}
      }
    } catch (cloudErr) {
      console.warn("Direct Firestore merge for listing responses failed, enqueuing:", cloudErr);
      saveSiteContentToFirestore("listing_responses", updated).catch(() => {});
      enqueueCloudWrite("listing_responses", updated, "Listing Response");
    }
  })();
}

export async function syncListingResponsesFromFirestore(): Promise<ListingResponseRecord[] | null> {
  try {
    const remote = await getSiteContentFromFirestore<ListingResponseRecord[]>("listing_responses");
    const remoteList = Array.isArray(remote) ? remote : [];
    const local = getStoredListingResponses();
    const map = new Map<string, ListingResponseRecord>();
    
    // Preserve any local records
    local.forEach((r) => map.set(r.id, r));
    // Overlay authoritative remote records
    remoteList.forEach((r) => map.set(r.id, r));

    // CRITICAL: Also query registrations collection for any hub_poll_* ballots
    // so student votes cast by non-admins are immediately picked up across all devices
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      try {
        const regSnap = await getDocs(collection(db, "registrations"));
        regSnap.docs.forEach((d) => {
          const data = d.data();
          if (d.id.startsWith("hub_poll_") || data.customAnswers?.isHubBallot) {
            const ca = data.customAnswers || {};
            const optId = ca.optionId;
            const ballotRecord: ListingResponseRecord = {
              id: d.id,
              listingId: ca.listingId || data.eventId,
              listingSlug: ca.listingSlug || "",
              listingType: "poll",
              listingTitle: ca.listingTitle || data.eventTitle,
              userId: ca.voterId,
              userName: ca.voterName || data.leaderName || "Campus Student",
              userEmail: ca.voterEmail || data.email,
              userDepartment: ca.voterDepartment || data.department,
              userYear: ca.voterYear || data.year,
              btId: ca.voterBtId || data.btId,
              isAnonymous: Boolean(ca.isAnonymous),
              selectedOptionIds: optId ? [optId] : [],
              answers: optId ? { [optId]: ca.optionText || optId } : {},
              createdAt: data.registeredAt || (typeof data.createdAt?.toDate === "function" ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
              status: "approved",
            };
            map.set(d.id, ballotRecord);
          }
        });
      } catch (e) {
        console.warn("Notice checking registrations for poll ballots:", e);
      }
    }

    const merged = Array.from(map.values()).sort(
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

