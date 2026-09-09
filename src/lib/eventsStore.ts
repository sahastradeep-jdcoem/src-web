import { EventItem } from "@/types";
import { mockEvents as initialEvents } from "@/data/events";
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

/**
 * Sanitize an event item, deduplicating primitive arrays such as whatToExpect and rules
 */
export function sanitizeEventItem(event: EventItem): EventItem {
  if (!event || typeof event !== "object") return event;
  return {
    ...event,
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
  };
}

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
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
    return new Date(Date.UTC(y, m, d)).getTime() + timeOffset;
  }

  // 2. Try day month year pattern e.g. "8 October 2025", "8th Oct 2025", "8 - 10 October 2025"
  const dmyMatch = dateStr.match(/(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–—to]+\s*\d{1,2}(?:st|nd|rd|th)?)?[\s\-_]+([A-Za-z]+)[\s\-_,]+(\d{4})/i);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const mStr = dmyMatch[2].toLowerCase();
    const year = parseInt(dmyMatch[3], 10);
    if (MONTH_MAP[mStr] !== undefined) {
      return new Date(Date.UTC(year, MONTH_MAP[mStr], day)).getTime() + timeOffset;
    }
  }

  // 3. Try month day year pattern e.g. "October 8, 2025", "Oct 8 - 10, 2025"
  const mdyMatch = dateStr.match(/([A-Za-z]+)[\s\-_]+(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–—to]+\s*\d{1,2}(?:st|nd|rd|th)?)?[\s\-_,]+(\d{4})/i);
  if (mdyMatch) {
    const mStr = mdyMatch[1].toLowerCase();
    const day = parseInt(mdyMatch[2], 10);
    const year = parseInt(mdyMatch[3], 10);
    if (MONTH_MAP[mStr] !== undefined) {
      return new Date(Date.UTC(year, MONTH_MAP[mStr], day)).getTime() + timeOffset;
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
 * Sort events chronologically by event date (earliest first).
 */
export function sortEventsByDate<T extends Partial<EventItem>>(events: T[]): T[] {
  if (!Array.isArray(events)) return [];
  return [...events].sort((a, b) => {
    const timeA = getEventDateTimestamp(a);
    const timeB = getEventDateTimestamp(b);
    if (timeA !== timeB) return timeA - timeB;
    return (a.name || "").localeCompare(b.name || "");
  });
}

export function sanitizeEventsList(events: EventItem[]): EventItem[] {
  if (!Array.isArray(events)) return [];
  const sanitized = events.map(sanitizeEventItem);
  return sortEventsByDate(sanitized);
}

/**
 * Retrieve current events list from local storage or defaults
 */
export function getStoredEvents(): EventItem[] {
  if (typeof window === "undefined") return initialEvents;
  try {
    const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return sanitizeEventsList(parsed);
    }
  } catch (e) {
    console.warn("Could not read events from storage", e);
  }
  return initialEvents;
}

/**
 * Persist events list with write-ahead queue and automatic retry
 */
export function saveStoredEvents(events: EventItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(sanitizeEventsList(events));
    markLocalWrite("events");
    try { 
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(sanitized)); 
    } catch (lsErr) { 
      console.warn("localStorage quota exceeded for events:", lsErr); 
    }

    // Direct cloud write & queue backup immediately (Directive #3)
    saveSiteContentToFirestore("events", sanitized).catch((err) => {
      console.warn("Firestore direct write for events failed, enqueuing:", err);
    });
    enqueueCloudWrite("events", sanitized, `Events Roster (${events.length} Events)`);

    window.dispatchEvent(new CustomEvent("src_events_updated", { detail: sanitized }));
    
    compactEventDataset(sanitized).then((compacted) => {
      const cleanCompacted = cleanUndefined(compacted);
      try {
        localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(cleanCompacted));
      } catch {}
      saveSiteContentToFirestore("events", cleanCompacted).catch(() => {});
    }).catch(() => {});
  } catch (e) {
    console.error("Could not save events to storage", e);
  }
}

/**
 * Fetch and sync events list from Firestore with conflict-free reconciliation
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
      const current = getStoredEvents();
      const merged = sanitizeEventsList(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_events_updated", { detail: merged }));
      }
      return merged;
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
      const current = getStoredEvents();
      const merged = sanitizeEventsList(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_events_updated", { detail: merged }));
      }
      callback(merged);
    }
  });
}

/**
 * Delete a specific event by ID or slug
 */
export function deleteStoredEvent(idOrSlug: string): EventItem[] {
  const current = getStoredEvents();
  const updated = current.filter((e) => e.id !== idOrSlug && e.slug !== idOrSlug);
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

