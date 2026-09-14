import { EventItem } from "@/types";
import { 
  saveEventToFirestore,
  deleteEventFromFirestore,
  getAllEventsFromFirestore,
  subscribeToEventsFromFirestore,
  getEventDocId,
  saveSiteContentToFirestore, 
  getSiteContentFromFirestore, 
  cleanUndefined
} from "./firebase/firestore";
import { 
  enqueueCloudWrite, 
  reconcileArrayDatasets, 
  hasPendingWritesFor, 
  markLocalWrite,
  getLastLocalWriteTime,
  isLocalWriteRecent
} from "./dataSyncEngine";

const EVENTS_STORAGE_KEY = "src_events";

// Backward compatibility stubs
export function getEventMediaDocId(slugOrId: string): string {
  return getEventDocId(slugOrId);
}
export async function saveEventMediaDocument(): Promise<void> {}
export async function getEventMediaDocument(): Promise<null> { return null; }
export function hydrateEventMedia(events: EventItem[]): EventItem[] { return events; }

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
  const valid = events.filter((e) => e && typeof e === "object" && Boolean(e.id || e.slug || e.name));
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
          inMemoryEvents = sanitizeEventsList(parsed);
        }
      } catch {}
    }
  });

  window.addEventListener("src_events_updated", (e: any) => {
    if (e?.detail && Array.isArray(e.detail)) {
      inMemoryEvents = e.detail;
    }
  });
}

function safeWriteEventsToLocalStorage(events: EventItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch (quotaErr) {
    console.warn("localStorage quota exceeded for events, applying safe compaction:", quotaErr);
    try {
      // In localStorage, keep all metadata, IDs, details, but strip oversized base64 strings (>35KB)
      // to guarantee all event records persist without hitting 5MB browser quota (Directive #2)
      const lightweight = events.map((e) => ({
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
    return inMemoryEvents;
  }
  try {
    const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const sanitized = sanitizeEventsList(parsed);
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
 * Save an individual event directly to its own document (1 Event = 1 Document)
 */
export async function saveStoredEvent(event: EventItem): Promise<void> {
  if (typeof window === "undefined") return;
  const docId = getEventDocId(event);
  const sanitized = sanitizeEventItem(event);
  markLocalWrite(docId);
  markLocalWrite("events");

  const current = getStoredEvents();
  const idx = current.findIndex((e) => e.id === sanitized.id || e.slug === sanitized.slug);
  const updated = idx >= 0 ? current.map((e, i) => (i === idx ? sanitized : e)) : [sanitized, ...current];
  const sorted = sanitizeEventsList(updated);
  inMemoryEvents = sorted;
  safeWriteEventsToLocalStorage(sorted);
  window.dispatchEvent(new CustomEvent("src_events_updated", { detail: sorted }));

  let cloudWriteError: any = null;
  try {
    await saveEventToFirestore(sanitized);
  } catch (err) {
    console.warn(`Firestore direct write failed for event [${docId}], enqueuing:`, err);
    cloudWriteError = err;
  }
  enqueueCloudWrite(`event_${docId}`, sanitized, `Event: ${sanitized.name}`);

  if (cloudWriteError) {
    const errMsg = cloudWriteError?.message || String(cloudWriteError);
    if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
      throw new Error("Admin session expired. Please refresh the page and sign in again.");
    }
    throw cloudWriteError;
  }
}

/**
 * Persist events list where each event is stored in its own Firestore document (1 Event = 1 Document)
 */
export async function saveStoredEvents(events: EventItem[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(sanitizeEventsList(events));
    const previous = getStoredEvents();
    inMemoryEvents = sanitized;
    markLocalWrite("events");

    // LocalStorage stores the fully hydrated events with full resolution images for 0ms reads
    safeWriteEventsToLocalStorage(sanitized);
    window.dispatchEvent(new CustomEvent("src_events_updated", { detail: sanitized }));

    // Detect deleted events: present in previous but missing in current
    const currentDocIds = new Set(sanitized.map((e) => getEventDocId(e)));
    const deletedEvents = previous.filter((p) => !currentDocIds.has(getEventDocId(p)));

    // 1 Event = 1 Document: Parallel writes to isolated Firestore documents
    const writePromises = sanitized.map(async (e) => {
      const docId = getEventDocId(e);
      markLocalWrite(docId);
      try {
        await saveEventToFirestore(e);
      } catch (err) {
        console.warn(`Firestore write for event [${docId}] failed, enqueuing:`, err);
        enqueueCloudWrite(`event_${docId}`, e, `Event: ${e.name}`);
        throw err;
      }
    });

    // Parallel deletes for removed events
    const deletePromises = deletedEvents.map(async (d) => {
      const docId = getEventDocId(d);
      await deleteEventFromFirestore(docId);
    });

    // Also update a lightweight catalog in site_content/events for backward compatibility
    const lightweightCatalog = sanitized.map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      category: e.category,
      status: e.status,
      date: e.date,
      time: e.time,
      venue: e.venue,
      isLive: e.isLive,
      isFeatured: e.isFeatured,
      cardImage: e.cardImage || "",
    }));
    saveSiteContentToFirestore("events", lightweightCatalog).catch(() => {});

    const writeResults = await Promise.allSettled(writePromises);
    await Promise.allSettled(deletePromises);

    const firstRejected = writeResults.find((r) => r.status === "rejected");
    if (firstRejected && firstRejected.status === "rejected") {
      const err = firstRejected.reason;
      const errMsg = err?.message || String(err);
      if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
        throw new Error("Admin session expired. Please refresh the page and sign in again.");
      }
      throw err;
    }
  } catch (e) {
    console.error("Could not save events to storage", e);
    throw e;
  }
}

/**
 * Fetch and sync all individual event documents from Firestore (1 Event = 1 Document)
 */
export async function syncEventsFromFirestore(): Promise<EventItem[]> {
  try {
    const requestTime = Date.now();
    if (hasPendingWritesFor("events") || getLastLocalWriteTime("events") >= requestTime) {
      return getStoredEvents();
    }
    const remote = await getAllEventsFromFirestore();
    // Verify no local writes occurred while waiting for network response
    if (hasPendingWritesFor("events") || getLastLocalWriteTime("events") >= requestTime) {
      return getStoredEvents();
    }
    if (remote !== null && Array.isArray(remote)) {
      // Remote Firestore state is strictly authoritative for items & deletions (Directive #9)
      const current = getStoredEvents();
      const rawMerged = reconcileArrayDatasets(current, remote);
      const sanitized = sanitizeEventsList(rawMerged);
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
  return subscribeToEventsFromFirestore((remote) => {
    if (remote !== null && Array.isArray(remote)) {
      if (hasPendingWritesFor("events") || isLocalWriteRecent("events", 3000)) return;
      // Remote Firestore state is strictly authoritative (Directive #9)
      const current = getStoredEvents();
      const rawMerged = reconcileArrayDatasets(current, remote);
      const sanitized = sanitizeEventsList(rawMerged);
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
 * Delete a specific event by ID or slug (1 Event = 1 Document)
 */
export function deleteStoredEvent(idOrSlug: string): EventItem[] {
  const current = getStoredEvents();
  const updated = current.filter((e) => e.id !== idOrSlug && e.slug !== idOrSlug);
  inMemoryEvents = updated;
  safeWriteEventsToLocalStorage(updated);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("src_events_updated", { detail: updated }));
  }
  deleteEventFromFirestore(idOrSlug).catch((err) => console.warn(`Delete failed for event [${idOrSlug}]:`, err));
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


