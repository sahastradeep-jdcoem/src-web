import { ListingItem, ListingResponseRecord } from "@/types/listings";
import { initialListings } from "@/data/listings";
import { 
  saveSiteContentToFirestore, 
  getSiteContentFromFirestore, 
  subscribeToSiteContent,
  saveUserProfileToFirestore,
  cleanUndefined
} from "./firebase/firestore";
import { enqueueCloudWrite } from "./dataSyncEngine";
import { db } from "./firebase/config";
import { doc, setDoc, getDocs, collection, serverTimestamp, deleteDoc, onSnapshot } from "firebase/firestore";

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
  "list-1788524431164",
  "which-pill-1164",
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
    // Filter out any stale mock or deleted items cached in localStorage
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
      // Purge any legacy hardcoded mock or deleted items if found in cloud
      const hasMockItems = remote.some((l) => MOCK_LISTING_IDS.has(l.id) || MOCK_LISTING_IDS.has(l.slug));
      let cleanRemote = remote.filter((l) => !MOCK_LISTING_IDS.has(l.id) && !MOCK_LISTING_IDS.has(l.slug));

      // If all items were wiped, fallback to initialListings
      if (cleanRemote.length === 0 && initialListings.length > 0) {
        cleanRemote = [...initialListings];
      }

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(LISTINGS_STORAGE_KEY, JSON.stringify(cleanRemote));
          window.dispatchEvent(new CustomEvent("src_listings_updated", { detail: cleanRemote }));
        } catch (e) {
          console.warn("Failed to update localStorage with remote listings:", e);
        }
      }

      // If mock or deleted items were detected in remote, immediately flush clean dataset back to Firestore
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

export function parseRegistrationToResponseRecord(docId: string, data: any): ListingResponseRecord | null {
  if (!data) return null;

  // 1. Live Poll Ballots
  if (docId.startsWith("hub_poll_") || data.customAnswers?.isHubBallot) {
    const ca = data.customAnswers || {};
    const optId = ca.optionId;
    return {
      id: docId,
      listingId: ca.listingId || data.eventId || "",
      listingSlug: ca.listingSlug || "",
      listingType: "poll",
      listingTitle: ca.listingTitle || data.eventTitle?.replace(/^\[POLL BALLOT\]\s*/, "") || "",
      userId: ca.voterId,
      userName: ca.voterName || data.leaderName || "Campus Student",
      userEmail: ca.voterEmail || data.email || undefined,
      userDepartment: ca.voterDepartment || data.department,
      userYear: ca.voterYear || data.year,
      btId: ca.voterBtId || data.btId,
      isAnonymous: Boolean(ca.isAnonymous),
      selectedOptionIds: optId ? [optId] : [],
      answers: optId ? { [optId]: ca.optionText || optId } : {},
      createdAt: data.registeredAt || (typeof data.createdAt?.toDate === "function" ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
      status: "approved",
    };
  }

  // 2. Hub Form Submissions (Applications, Recruitments, Contests, Grievances)
  if (docId.startsWith("hub_sub_") || data.customAnswers?.isHubSubmission) {
    const ca = data.customAnswers || {};
    const subId = ca.responseId || docId;
    let normStatus: "pending" | "approved" | "rejected" | "resolved" | "reviewed" = "pending";
    const rawStatus = (ca.status || data.status || "").toLowerCase();
    if (rawStatus === "confirmed" || rawStatus === "approved") normStatus = "approved";
    else if (rawStatus === "rejected" || rawStatus === "declined") normStatus = "rejected";
    else if (rawStatus === "resolved") normStatus = "resolved";
    else if (rawStatus === "reviewed") normStatus = "reviewed";
    else normStatus = "pending";

    return {
      id: subId,
      listingId: ca.listingId || data.eventId || "",
      listingSlug: ca.listingSlug || "",
      listingType: ca.listingType || "application",
      listingTitle: ca.listingTitle || data.eventTitle?.replace(/^\[HUB\]\s*/, "") || "",
      userId: ca.userId || undefined,
      userName: ca.userName || data.leaderName || "Applicant",
      userEmail: ca.userEmail || data.email || undefined,
      userDepartment: ca.userDepartment || data.department || undefined,
      userYear: ca.userYear || data.year || undefined,
      btId: ca.btId || data.btId || undefined,
      isAnonymous: Boolean(ca.isAnonymous),
      answers: ca.answers || {},
      selectedOptionIds: ca.selectedOptionIds || [],
      fileUrl: ca.fileUrl || undefined,
      submissionLink: ca.submissionLink || undefined,
      ticketCode: ca.ticketCode || data.ticketCode || undefined,
      status: normStatus,
      adminFeedback: ca.reviewNotes || ca.adminFeedback || undefined,
      createdAt: ca.createdAt || data.registeredAt || (typeof data.createdAt?.toDate === "function" ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
      updatedAt: ca.updatedAt || undefined,
    };
  }

  return null;
}

export function mergeResponseLists(...lists: ListingResponseRecord[][]): ListingResponseRecord[] {
  const map = new Map<string, ListingResponseRecord>();
  const ticketMap = new Map<string, string>(); // ticketCode -> map key

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || !item.id) continue;
      
      const ticket = item.ticketCode?.trim();
      if (ticket && ticketMap.has(ticket)) {
        const existingKey = ticketMap.get(ticket)!;
        const existing = map.get(existingKey)!;
        const merged: ListingResponseRecord = {
          ...existing,
          ...item,
          status: item.status || existing.status,
          answers: { ...(existing.answers || {}), ...(item.answers || {}) },
          updatedAt: item.updatedAt || existing.updatedAt || new Date().toISOString(),
        };
        map.set(existingKey, merged);
      } else {
        const existing = map.get(item.id);
        if (existing) {
          const merged: ListingResponseRecord = {
            ...existing,
            ...item,
            status: item.status || existing.status,
            answers: { ...(existing.answers || {}), ...(item.answers || {}) },
            updatedAt: item.updatedAt || existing.updatedAt || new Date().toISOString(),
          };
          map.set(item.id, merged);
        } else {
          map.set(item.id, item);
          if (ticket) {
            ticketMap.set(ticket, item.id);
          }
        }
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

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
  
  // Check if updating an existing record by explicit ID, ticketCode, or user+listing matching
  const exactIndex = current.findIndex((r) => r.id === record.id);
  const matchTicketIndex = exactIndex === -1 && record.ticketCode
    ? current.findIndex((r) => r.ticketCode === record.ticketCode)
    : -1;
  const matchUserIndex = exactIndex === -1 && matchTicketIndex === -1
    ? current.findIndex(
        (r) =>
          r.listingId === record.listingId &&
          ((r.userId && record.userId && r.userId === record.userId) ||
           (r.userEmail && record.userEmail && r.userEmail.toLowerCase().trim() === record.userEmail.toLowerCase().trim()))
      )
    : -1;

  const targetIndex = exactIndex !== -1 ? exactIndex : (matchTicketIndex !== -1 ? matchTicketIndex : matchUserIndex);
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

  // 2. CRITICAL DUAL-WRITE: Guaranteed persistence to registrations collection
  // Non-admin students have 'allow create: if true' on registrations, so submissions never fail
  const firestoreDb = db;
  if (firestoreDb && process.env.NEXT_PUBLIC_FIREBASE_API_KEY && record.listingType !== "poll" && !record.id.startsWith("hub_poll_")) {
    const regDocId = `hub_sub_${record.ticketCode || record.id}`;
    const regDocRef = doc(firestoreDb, "registrations", regDocId);
    const regPayload = cleanUndefined({
      id: regDocId,
      eventId: record.listingId,
      eventTitle: `[HUB] ${record.listingTitle || "Form Submission"}`,
      leaderName: record.userName || "Applicant",
      email: record.userEmail || "",
      phone: "",
      college: "JDCOEM",
      department: record.userDepartment || "",
      year: record.userYear || "",
      btId: record.btId || "",
      teamSize: 1,
      status: record.status ? (record.status === "approved" ? "CONFIRMED" : record.status.toUpperCase()) : "PENDING",
      registeredAt: record.createdAt || new Date().toISOString(),
      createdAt: serverTimestamp(),
      ticketCode: record.ticketCode || "",
      qrPayload: `SRC:HUB:${record.listingId}:${record.ticketCode || record.id}`,
      customAnswers: {
        isHubSubmission: true,
        responseId: record.id,
        listingId: record.listingId,
        listingSlug: record.listingSlug || "",
        listingType: record.listingType || "application",
        listingTitle: record.listingTitle || "",
        userId: record.userId || null,
        userName: record.userName || "Applicant",
        userEmail: record.userEmail || null,
        userDepartment: record.userDepartment || "",
        userYear: record.userYear || "",
        btId: record.btId || null,
        answers: record.answers || {},
        selectedOptionIds: record.selectedOptionIds || [],
        submissionLink: record.submissionLink || null,
        fileUrl: record.fileUrl || null,
        ticketCode: record.ticketCode || "",
        status: record.status || "pending",
        adminFeedback: record.adminFeedback || "",
        createdAt: record.createdAt || new Date().toISOString(),
        updatedAt: record.updatedAt || new Date().toISOString(),
      },
    });

    setDoc(regDocRef, regPayload, { merge: true }).catch((e) =>
      console.warn("Firestore registration form submission write notice:", e)
    );
  }

  // 3. Also attempt saveSiteContentToFirestore (works for admins; catch permission errors for students)
  (async () => {
    try {
      const remote = await getSiteContentFromFirestore<ListingResponseRecord[]>("listing_responses");
      const remoteList = Array.isArray(remote) ? remote : [];
      const combined = mergeResponseLists(remoteList, updated, [record]);

      await saveSiteContentToFirestore("listing_responses", combined);
      const listingFiltered = combined.filter((r) => r.listingId === record.listingId);
      await saveSiteContentToFirestore(`responses_${record.listingId}`, listingFiltered);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(combined));
          window.dispatchEvent(
            new CustomEvent("src_listing_responses_updated", { detail: combined })
          );
        } catch {}
      }
    } catch {
      // Permission denied for non-admins on site_content is expected; doc is safely in registrations
    }
  })();
}

export async function syncListingResponsesFromFirestore(): Promise<ListingResponseRecord[] | null> {
  try {
    const remote = await getSiteContentFromFirestore<ListingResponseRecord[]>("listing_responses");
    const remoteList = Array.isArray(remote) ? remote : [];
    const local = getStoredListingResponses();
    const fromRegistrations: ListingResponseRecord[] = [];

    // CRITICAL: Query registrations collection for hub_poll_* and hub_sub_* records
    // so submissions and ballots by non-admin students are immediately synchronized
    const firestoreDb = db;
    if (firestoreDb && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      try {
        const regSnap = await getDocs(collection(firestoreDb, "registrations"));
        const existingRegIds = new Set<string>();

        regSnap.docs.forEach((d) => {
          existingRegIds.add(d.id);
          const parsed = parseRegistrationToResponseRecord(d.id, d.data());
          if (parsed) {
            fromRegistrations.push(parsed);
          }
        });

        // Auto-heal: If any local submission was not yet pushed to registrations, push it now
        local.forEach((localRec) => {
          if (localRec.listingType !== "poll" && !localRec.id.startsWith("hub_poll_")) {
            const expectedDocId = `hub_sub_${localRec.ticketCode || localRec.id}`;
            if (!existingRegIds.has(expectedDocId)) {
              const regDocRef = doc(firestoreDb, "registrations", expectedDocId);
              setDoc(
                regDocRef,
                cleanUndefined({
                  id: expectedDocId,
                  eventId: localRec.listingId,
                  eventTitle: `[HUB] ${localRec.listingTitle || "Form Submission"}`,
                  leaderName: localRec.userName || "Applicant",
                  email: localRec.userEmail || "",
                  phone: "",
                  college: "JDCOEM",
                  department: localRec.userDepartment || "",
                  year: localRec.userYear || "",
                  btId: localRec.btId || "",
                  teamSize: 1,
                  status: localRec.status ? (localRec.status === "approved" ? "CONFIRMED" : localRec.status.toUpperCase()) : "PENDING",
                  registeredAt: localRec.createdAt || new Date().toISOString(),
                  createdAt: serverTimestamp(),
                  ticketCode: localRec.ticketCode || "",
                  qrPayload: `SRC:HUB:${localRec.listingId}:${localRec.ticketCode || localRec.id}`,
                  customAnswers: {
                    isHubSubmission: true,
                    responseId: localRec.id,
                    listingId: localRec.listingId,
                    listingSlug: localRec.listingSlug || "",
                    listingType: localRec.listingType || "application",
                    listingTitle: localRec.listingTitle || "",
                    userId: localRec.userId || null,
                    userName: localRec.userName || "Applicant",
                    userEmail: localRec.userEmail || null,
                    userDepartment: localRec.userDepartment || "",
                    userYear: localRec.userYear || "",
                    btId: localRec.btId || null,
                    answers: localRec.answers || {},
                    selectedOptionIds: localRec.selectedOptionIds || [],
                    submissionLink: localRec.submissionLink || null,
                    fileUrl: localRec.fileUrl || null,
                    ticketCode: localRec.ticketCode || "",
                    status: localRec.status || "pending",
                    adminFeedback: localRec.adminFeedback || "",
                    createdAt: localRec.createdAt || new Date().toISOString(),
                    updatedAt: localRec.updatedAt || new Date().toISOString(),
                  },
                }),
                { merge: true }
              ).catch(() => {});
            }
          }
        });
      } catch (e) {
        console.warn("Notice querying registrations collection:", e);
      }
    }

    const merged = mergeResponseLists(local, remoteList, fromRegistrations);

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
  // 1. Listen to Firestore site_content snapshot
  const unsubFirestore = subscribeToSiteContent<ListingResponseRecord[]>("listing_responses", (data) => {
    if (data && Array.isArray(data)) {
      const currentLocal = getStoredListingResponses();
      const merged = mergeResponseLists(currentLocal, data);
      callback(merged);
    }
  });

  // 2. Listen to real-time registrations collection snapshots (hub_poll_* and hub_sub_*)
  let unsubRegistrations: (() => void) | null = null;
  const firestoreDb = db;
  if (firestoreDb && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    try {
      unsubRegistrations = onSnapshot(
        collection(firestoreDb, "registrations"),
        (snap) => {
          const fromRegs: ListingResponseRecord[] = [];
          snap.docs.forEach((d) => {
            const parsed = parseRegistrationToResponseRecord(d.id, d.data());
            if (parsed) {
              fromRegs.push(parsed);
            }
          });
          if (fromRegs.length > 0) {
            const currentLocal = getStoredListingResponses();
            const merged = mergeResponseLists(currentLocal, fromRegs);
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(merged));
              } catch {}
            }
            callback(merged);
          }
        },
        (err) => {
          console.warn("Notice: registrations snapshot subscription notice:", err);
        }
      );
    } catch (e) {
      console.warn("Failed to attach registrations real-time subscription:", e);
    }
  }

  // 3. Listen to local window events across tabs
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
    if (unsubRegistrations) {
      unsubRegistrations();
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("src_listing_responses_updated", handleLocalEvent);
    }
  };
}

export function deleteStoredListingResponse(responseId: string, listingId: string): void {
  const current = getStoredListingResponses();
  const target = current.find((r) => r.id === responseId);
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

  // Delete from registrations collection
  const firestoreDb = db;
  if (firestoreDb && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    const regDocId = responseId.startsWith("hub_") ? responseId : `hub_sub_${responseId}`;
    deleteDoc(doc(firestoreDb, "registrations", regDocId)).catch(() => {});
    if (target?.ticketCode) {
      deleteDoc(doc(firestoreDb, "registrations", `hub_sub_${target.ticketCode}`)).catch(() => {});
    }
  }

  // Cloud Sync site_content
  saveSiteContentToFirestore("listing_responses", updated).catch((err) => {
    console.warn("Direct write for global response deletion failed, enqueuing:", err);
  });
  saveSiteContentToFirestore(`responses_${listingId}`, updated.filter((r) => r.listingId === listingId)).catch((err) => {
    console.warn("Direct write for per-listing response deletion failed:", err);
  });

  enqueueCloudWrite("listing_responses", updated, "Delete Listing Response");
}

