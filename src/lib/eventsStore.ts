import { EventItem } from "@/types";
import { 
  saveSiteContentToFirestore, 
  getSiteContentFromFirestore, 
  subscribeToSiteContent,
  cleanUndefined
} from "./firebase/firestore";
import { 
  enqueueCloudWrite, 
  reconcileArrayDatasets, 
  hasPendingWritesFor, 
  compactEventDataset,
  markLocalWrite,
  getLastLocalWriteTime,
  isLocalWriteRecent
} from "./dataSyncEngine";

const EVENTS_STORAGE_KEY = "src_events";

export interface EventMediaDocument {
  eventId: string;
  eventSlug: string;
  poster?: string;
  posterImage?: string;
  cardImage?: string;
  headerImage?: string;
  updatedAt: number;
}

/**
 * Normalizes event slug / ID into the dedicated Firestore document ID.
 * Each event gets its own dedicated 1MB document in site_content (e.g. `event_media_aarohan-2025`).
 * This prevents the monolithic master events document from ever exceeding Firestore's 750KB threshold.
 */
export function getEventMediaDocId(slugOrId: string): string {
  let clean = (slugOrId || "").toLowerCase().trim();
  clean = clean.replace(/^evt-/, "");
  return `event_media_${clean}`;
}

export async function saveEventMediaDocument(
  slugOrId: string,
  media: Partial<EventMediaDocument>
): Promise<void> {
  const docId = getEventMediaDocId(slugOrId);
  // Deduplicate: if posterImage is identical to poster, avoid storing redundant base64 strings
  const poster = media.poster || "";
  const posterImage = media.posterImage === poster ? "" : (media.posterImage || "");
  const cardImage = media.cardImage === poster ? "" : (media.cardImage || "");
  const headerImage = media.headerImage === poster ? "" : (media.headerImage || "");

  const sanitized = cleanUndefined({
    ...media,
    poster,
    posterImage,
    cardImage,
    headerImage,
    updatedAt: Date.now(),
  });

  markLocalWrite(docId);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`src_${docId}`, JSON.stringify(sanitized));
    } catch {}
  }
  try {
    await saveSiteContentToFirestore(docId, sanitized);
  } catch (err) {
    console.warn(`Firestore write for event media [${docId}] failed, enqueuing:`, err);
  }
  enqueueCloudWrite(docId, sanitized, `Event Media (${slugOrId})`);
}

export async function getEventMediaDocument(slugOrId: string): Promise<EventMediaDocument | null> {
  const docId = getEventMediaDocId(slugOrId);
  try {
    const remote = await getSiteContentFromFirestore<EventMediaDocument>(docId);
    if (remote && (remote.poster || remote.posterImage || remote.cardImage || remote.headerImage)) {
      return remote;
    }
  } catch (err) {
    console.warn(`Could not fetch [${docId}] from Firestore:`, err);
  }
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(`src_${docId}`);
      if (cached) return JSON.parse(cached);
    } catch {}
  }
  return null;
}

export function hydrateEventMedia(
  events: EventItem[],
  mediaMap?: Map<string, Partial<EventMediaDocument>>
): EventItem[] {
  if (!Array.isArray(events)) return [];

  return events.map((e) => {
    const slug = e.slug || e.id;
    const media = mediaMap ? (mediaMap.get(slug) || mediaMap.get(e.id)) : undefined;

    let cachedMedia: any = null;
    if (!media && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`src_${getEventMediaDocId(slug)}`);
        if (raw) cachedMedia = JSON.parse(raw);
      } catch {}
    }

    const m = media || cachedMedia;
    const poster = m?.poster || e.poster || m?.posterImage || e.posterImage || "";
    const posterImage = m?.posterImage || (poster !== e.poster ? poster : (e.posterImage || poster));
    const cardImage = m?.cardImage || e.cardImage || poster;
    const headerImage = m?.headerImage || e.headerImage || cardImage || poster;

    return {
      ...e,
      poster,
      posterImage,
      cardImage,
      headerImage,
    };
  });
}

function isTestingOrphan(e?: Partial<EventItem> | null): boolean {
  if (!e) return false;
  const name = (e.name || "").toLowerCase().trim();
  const slug = (e.slug || "").toLowerCase().trim();
  const id = (e.id || "").toLowerCase().trim();
  return (
    name === "testing" ||
    slug === "testing" ||
    id === "testing" ||
    id === "evt-testing"
  );
}

// Clean any orphaned "testing" entries from the write queue immediately on module load
if (typeof window !== "undefined") {
  try {
    const rawQueue = localStorage.getItem("src_cloud_write_queue");
    if (rawQueue && rawQueue.includes("testing")) {
      const queue = JSON.parse(rawQueue);
      const cleaned = queue.filter((q: any) => !q.docId?.includes("testing") && !JSON.stringify(q.payload).includes('"testing"'));
      localStorage.setItem("src_cloud_write_queue", JSON.stringify(cleaned));
    }
  } catch {}
}

/**
 * Sanitize an event item, deduplicating primitive arrays such as whatToExpect and rules
 */
export function sanitizeEventItem(event: EventItem): EventItem {
  if (!event || typeof event !== "object") return event;
  return {
    ...event,
    collaboratingClubs: Array.isArray(event.collaboratingClubs)
      ? event.collaboratingClubs.filter((c) => c && c.name && c.slug)
      : undefined,
    coOrganizers: Array.isArray(event.coOrganizers)
      ? event.coOrganizers.filter(Boolean)
      : undefined,
    rawDate: event.rawDate || undefined,
    rawEndDate: event.rawEndDate || undefined,
    endDate: event.endDate || undefined,
    isMultiDay: Boolean(event.isMultiDay),
    noRegistrationRequired: Boolean(event.noRegistrationRequired),
    coordinatorContact:
      event.coordinatorContact &&
      (Boolean(event.coordinatorContact.name?.trim()) || Boolean(event.coordinatorContact.phone?.trim()))
        ? {
            name: (event.coordinatorContact.name || "").trim(),
            role: (event.coordinatorContact.role || "").trim(),
            phone: (event.coordinatorContact.phone || "").trim(),
          }
        : undefined,
    whatToExpect: Array.isArray(event.whatToExpect)
      ? Array.from(
          new Set(
            event.whatToExpect
              .map((s) => (typeof s === "string" ? s.trim() : s))
              .filter((s) => s !== undefined && s !== null && s !== "")
          )
        )
      : [],
    rules: Array.isArray(event.rules)
      ? Array.from(
          new Set(
            event.rules
              .map((s) => (typeof s === "string" ? s.trim() : s))
              .filter((s) => s !== undefined && s !== null && s !== "")
          )
        )
      : [],
    hasSchedule: event.hasSchedule !== undefined ? Boolean(event.hasSchedule) : Boolean(event.schedule && event.schedule.length > 0),
    hasPrizes: event.hasPrizes !== undefined ? Boolean(event.hasPrizes) : Boolean(event.prizes && event.prizes.length > 0),
    schedule: event.hasSchedule === false
      ? []
      : Array.isArray(event.schedule)
      ? event.schedule
          .filter((item) => item && typeof item === "object" && Boolean(item.title?.trim() || item.time?.trim()))
          .map((item) => ({
            time: (item.time || "").trim(),
            title: (item.title || "").trim(),
            venue: (item.venue || "").trim(),
            description: (item.description || "").trim(),
          }))
      : [],
    prizes: event.hasPrizes === false
      ? []
      : Array.isArray(event.prizes)
      ? event.prizes
          .filter((p) => p && typeof p === "object" && Boolean(p.position?.trim() || p.amount?.trim()))
          .map((p) => ({
            position: (p.position || "").trim(),
            amount: (p.amount || "").trim(),
            perks: Array.isArray(p.perks)
              ? Array.from(new Set(p.perks.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean)))
              : [],
          }))
      : [],
    isFeatured:
      event.status === "Completed" ||
      event.slug === "code-and-craft" ||
      event.id === "evt-code-and-craft" ||
      event.slug === "jamming-session" ||
      event.id === "evt-jamming-session"
        ? false
        : Boolean(event.isFeatured),
  };
}

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,  may_: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

export function parseTimeString(timeStr?: string): number {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const match = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3] ? match[3].toLowerCase() : null;

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  return (hours * 3600 + minutes * 60) * 1000;
}

/**
 * Extract a comparable Unix timestamp (earliest first) from an event's date, time, and fallback fields.
 */
export function getEventDateTimestamp(event: Partial<EventItem> | null | undefined): number {
  if (!event) return Number.MAX_SAFE_INTEGER;
  const dateStr = (event.date || "").trim();
  const timeOffset = parseTimeString(event.time);

  // 0. Try event.rawDate if specified in YYYY-MM-DD format
  if (event.rawDate) {
    const rawMatch = event.rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (rawMatch) {
      const y = parseInt(rawMatch[1], 10);
      const m = parseInt(rawMatch[2], 10) - 1;
      const d = parseInt(rawMatch[3], 10);
      return new Date(y, m, d).getTime() + timeOffset;
    }
  }

  if (!dateStr || /\b(tbd|to be decided|coming soon|announced soon)\b/i.test(dateStr)) {
    if (event.registrationStartDate) {
      const regStart = Date.parse(event.registrationStartDate);
      if (!isNaN(regStart)) return regStart + timeOffset;
    }
    return Number.MAX_SAFE_INTEGER;
  }

  // 1. Try ISO date (YYYY-MM-DD)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    return new Date(y, m, d).getTime() + timeOffset;
  }

  // 2. Try day month year pattern e.g. "8 October 2025", "8th Oct 2025", "8 - 10 October 2025"
  const dmyMatch = dateStr.match(/(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–—to]+\s*\d{1,2}(?:st|nd|rd|th)?)?[\s\-_]+([A-Za-z]+)[\s\-_,]+(\d{4})/i);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const mStr = dmyMatch[2].toLowerCase();
    const year = parseInt(dmyMatch[3], 10);
    if (MONTH_MAP[mStr] !== undefined) {
      return new Date(year, MONTH_MAP[mStr], day).getTime() + timeOffset;
    }
  }

  // 3. Try month day year pattern e.g. "October 8, 2025", "Oct 8 - 10, 2025"
  const mdyMatch = dateStr.match(/([A-Za-z]+)[\s\-_]+(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–—to]+\s*\d{1,2}(?:st|nd|rd|th)?)?[\s\-_,]+(\d{4})/i);
  if (mdyMatch) {
    const mStr = mdyMatch[1].toLowerCase();
    const day = parseInt(mdyMatch[2], 10);
    const year = parseInt(mdyMatch[3], 10);
    if (MONTH_MAP[mStr] !== undefined) {
      return new Date(year, MONTH_MAP[mStr], day).getTime() + timeOffset;
    }
  }

  // 4. Try standard Date.parse
  const direct = Date.parse(dateStr);
  if (!isNaN(direct)) return direct + timeOffset;

  // 5. Fallback to registration dates
  if (event.registrationStartDate) {
    const regStart = Date.parse(event.registrationStartDate);
    if (!isNaN(regStart)) return regStart + timeOffset;
  }
  if (event.registrationDeadline) {
    const regDead = Date.parse(event.registrationDeadline);
    if (!isNaN(regDead)) return regDead + timeOffset;
  }

  return Number.MAX_SAFE_INTEGER;
}

/**
 * Sort events so that the nearest upcoming event is on top, and oldest on bottom:
 * 1. Upcoming events (happening today or in the future, not completed) sorted chronologically (nearest first).
 * 2. Past / Completed events placed after upcoming, sorted so the oldest event is at the very bottom.
 */
export function sortEventsByDate<T extends Partial<EventItem>>(events: T[], referenceDate: Date = new Date()): T[] {
  if (!Array.isArray(events)) return [];
  const startOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  ).getTime();

  const isPast = (e: Partial<EventItem>) => {
    if (e.status === "Completed" || e.status?.toLowerCase() === "completed") return true;
    const ts = getEventDateTimestamp(e);
    if (ts === Number.MAX_SAFE_INTEGER) return false;
    return ts < startOfToday;
  };

  const upcoming: T[] = [];
  const past: T[] = [];

  for (const e of events) {
    if (isPast(e)) {
      past.push(e);
    } else {
      upcoming.push(e);
    }
  }

  // Upcoming: nearest first (ascending)
  upcoming.sort((a, b) => {
    const tA = getEventDateTimestamp(a);
    const tB = getEventDateTimestamp(b);
    if (tA !== tB) return tA - tB;
    return (a.name || "").localeCompare(b.name || "");
  });

  // Past: most recent past first, oldest on bottom (descending)
  past.sort((a, b) => {
    const tA = getEventDateTimestamp(a);
    const tB = getEventDateTimestamp(b);
    if (tA !== tB) return tB - tA;
    return (a.name || "").localeCompare(b.name || "");
  });

  return [...upcoming, ...past];
}

export function sanitizeEventsList(events: EventItem[]): EventItem[] {
  if (!Array.isArray(events)) return [];
  const valid = events.filter((e) => e && typeof e === "object" && Boolean(e.id || e.slug || e.name) && !isTestingOrphan(e));
  const sanitized = valid.map(sanitizeEventItem);
  return sortEventsByDate(sanitized);
}

let inMemoryEvents: EventItem[] | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === EVENTS_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          inMemoryEvents = sanitizeEventsList(parsed).filter((e) => !isTestingOrphan(e));
        }
      } catch {}
    }
  });

  window.addEventListener("src_events_updated", (e: any) => {
    if (e?.detail && Array.isArray(e.detail)) {
      inMemoryEvents = e.detail.filter((evt: any) => !isTestingOrphan(evt));
    }
  });
}

function safeWriteEventsToLocalStorage(events: EventItem[]): void {
  if (typeof window === "undefined") return;
  const clean = events.filter((e) => !isTestingOrphan(e));
  try {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(clean));
  } catch (quotaErr) {
    console.warn("localStorage quota exceeded for events, applying safe compaction:", quotaErr);
    try {
      // In localStorage, keep all metadata, IDs, details, but strip oversized base64 strings (>35KB)
      // to guarantee all event records persist without hitting 5MB browser quota (Directive #2)
      const lightweight = clean.map((e) => ({
        ...e,
        poster: e.poster && e.poster.length > 35000 && e.poster.startsWith("data:") ? "" : e.poster,
        cardImage: e.cardImage && e.cardImage.length > 35000 && e.cardImage.startsWith("data:") ? "" : e.cardImage,
        posterImage: e.posterImage && e.posterImage.length > 35000 && e.posterImage.startsWith("data:") ? "" : e.posterImage,
        headerImage: e.headerImage && e.headerImage.length > 35000 && e.headerImage.startsWith("data:") ? "" : e.headerImage,
      }));
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(lightweight));
    } catch (secondErr) {
      console.warn("Emergency localStorage save for events failed:", secondErr);
    }
  }
}

/**
 * Retrieve current events list from in-memory cache or local storage
 */
export function getStoredEvents(): EventItem[] {
  if (typeof window === "undefined") return [];
  if (inMemoryEvents !== null && inMemoryEvents.length > 0) {
    inMemoryEvents = inMemoryEvents.filter((e) => !isTestingOrphan(e));
    return inMemoryEvents;
  }
  try {
    const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const sanitized = sanitizeEventsList(parsed).filter((e) => !isTestingOrphan(e));
        inMemoryEvents = sanitized;
        return sanitized;
      }
    }
  } catch (e) {
    console.warn("Could not read events from storage", e);
  }
  return inMemoryEvents || [];
}

/**
 * Persist events list with write-ahead queue, media partitioning, and atomic retry
 */
export async function saveStoredEvents(events: EventItem[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const filtered = events.filter((e) => !isTestingOrphan(e));
    const sanitized = cleanUndefined(sanitizeEventsList(filtered));
    inMemoryEvents = sanitized;
    markLocalWrite("events");

    // LocalStorage stores the fully hydrated events with full resolution images for 0ms reads
    safeWriteEventsToLocalStorage(sanitized);

    window.dispatchEvent(new CustomEvent("src_events_updated", { detail: sanitized }));

    // 1. Partition Architecture: Save each event's heavy media to its isolated 1MB Firestore document
    const mediaPartitionPromises = sanitized.map(async (e) => {
      const slug = e.slug || e.id;
      if (!slug) return;
      if (e.poster || e.posterImage || e.cardImage || e.headerImage) {
        await saveEventMediaDocument(slug, {
          eventId: e.id,
          eventSlug: e.slug,
          poster: e.poster,
          posterImage: e.posterImage,
          cardImage: e.cardImage,
          headerImage: e.headerImage,
        });
      }
    });
    await Promise.allSettled(mediaPartitionPromises);

    // 2. Prepare lightweight master catalog for site_content/events document.
    // Preserves complete metadata, cardImage, and compact poster.
    // Heavy base64 posters and banners live safely in their dedicated 1MB event_media_{slug} documents.
    // This drops master events from ~1MB down to ~60-120KB, ensuring write limits are NEVER exceeded!
    const strippedMasterPayload = sanitized.map((e) => {
      const isCloudUrl = (url?: string) => url && !url.startsWith("data:");
      return {
        ...e,
        poster: isCloudUrl(e.poster) ? e.poster : (e.cardImage || e.poster || ""),
        posterImage: isCloudUrl(e.posterImage) ? e.posterImage : "",
        headerImage: isCloudUrl(e.headerImage) ? e.headerImage : "",
        cardImage: e.cardImage || "",
      };
    });

    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore("events", strippedMasterPayload);
    } catch (err) {
      console.warn("Firestore direct write for events failed, enqueuing:", err);
      cloudWriteError = err;
    }
    enqueueCloudWrite("events", strippedMasterPayload, `Events Roster (${strippedMasterPayload.length} Events)`);

    if (cloudWriteError) {
      const errMsg = cloudWriteError?.message || String(cloudWriteError);
      if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
        throw new Error("Admin session expired. Please refresh the page and sign in again.");
      }
      throw cloudWriteError;
    }
  } catch (e) {
    console.error("Could not save events to storage", e);
    throw e;
  }
}

/**
 * Fetch and sync events list from Firestore with conflict-free reconciliation & media hydration
 */
export async function syncEventsFromFirestore(): Promise<EventItem[]> {
  try {
    const requestTime = Date.now();
    if (hasPendingWritesFor("events") || getLastLocalWriteTime("events") >= requestTime) {
      return getStoredEvents();
    }
    const remote = await getSiteContentFromFirestore<EventItem[]>("events");
    // Verify no local writes occurred while waiting for network response
    if (hasPendingWritesFor("events") || getLastLocalWriteTime("events") >= requestTime) {
      return getStoredEvents();
    }
    if (remote !== null && Array.isArray(remote)) {
      // Remote Firestore state is strictly authoritative for items & deletions (Directive #9)
      const current = getStoredEvents();
      const rawMerged = reconcileArrayDatasets(current, remote);
      const cleaned = rawMerged.filter((e) => !isTestingOrphan(e));

      // In parallel, fetch the dedicated 1MB event_media_{slug} documents for all events
      const mediaDocsResults = await Promise.allSettled(
        cleaned.map(async (e) => {
          const slug = e.slug || e.id;
          if (!slug) return null;
          return await getEventMediaDocument(slug);
        })
      );

      const mediaMap = new Map<string, Partial<EventMediaDocument>>();
      cleaned.forEach((e, idx) => {
        const res = mediaDocsResults[idx];
        const mediaDoc = res && res.status === "fulfilled" ? res.value : null;
        const slug = e.slug || e.id;

        if (mediaDoc && (mediaDoc.poster || mediaDoc.posterImage || mediaDoc.cardImage || mediaDoc.headerImage)) {
          mediaMap.set(slug, mediaDoc);
        } else {
          // Auto-migration: If this event does not have an isolated media doc yet, but has images in the master doc, migrate it now!
          if (e.poster || e.posterImage || e.cardImage || e.headerImage) {
            saveEventMediaDocument(slug, {
              eventId: e.id,
              eventSlug: e.slug,
              poster: e.poster,
              posterImage: e.posterImage,
              cardImage: e.cardImage,
              headerImage: e.headerImage,
            }).catch((err) => console.warn(`Auto-migration failed for event media ${slug}:`, err));
          }
        }
      });

      const fullyHydrated = hydrateEventMedia(cleaned, mediaMap);
      const sanitized = sanitizeEventsList(fullyHydrated);
      inMemoryEvents = sanitized;
      if (typeof window !== "undefined") {
        safeWriteEventsToLocalStorage(sanitized);
        window.dispatchEvent(new CustomEvent("src_events_updated", { detail: sanitized }));
      }
      return sanitized;
    }
  } catch (e) {
    console.warn("Could not sync events from Firestore", e);
  }
  return getStoredEvents();
}

/**
 * Subscribe to real-time events changes from Firestore across all devices
 */
export function subscribeToEvents(callback: (events: EventItem[]) => void): () => void {
  return subscribeToSiteContent<EventItem[]>("events", (remote) => {
    if (remote !== null && Array.isArray(remote)) {
      if (hasPendingWritesFor("events") || isLocalWriteRecent("events", 3000)) return;
      // Remote Firestore state is strictly authoritative (Directive #9)
      const current = getStoredEvents();
      const rawMerged = reconcileArrayDatasets(current, remote);
      const cleaned = rawMerged.filter((e) => !isTestingOrphan(e));
      const fullyHydrated = hydrateEventMedia(cleaned);
      const sanitized = sanitizeEventsList(fullyHydrated);
      inMemoryEvents = sanitized;
      if (typeof window !== "undefined") {
        safeWriteEventsToLocalStorage(sanitized);
        window.dispatchEvent(new CustomEvent("src_events_updated", { detail: sanitized }));
      }
      callback(sanitized);
    }
  });
}

/**
 * Delete a specific event by ID or slug
 */
export function deleteStoredEvent(idOrSlug: string): EventItem[] {
  const current = getStoredEvents();
  const updated = current.filter((e) => e.id !== idOrSlug && e.slug !== idOrSlug);
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(`src_${getEventMediaDocId(idOrSlug)}`);
    } catch {}
  }
  saveStoredEvents(updated);
  return updated;
}

/**
 * Reset events storage to empty
 */
export function resetStoredEvents(): EventItem[] {
  const defaults: EventItem[] = [];
  saveStoredEvents(defaults);
  return defaults;
}


