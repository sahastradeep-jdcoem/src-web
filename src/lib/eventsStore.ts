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

export function sanitizeEventsList(events: EventItem[]): EventItem[] {
  if (!Array.isArray(events)) return [];
  return events.map(sanitizeEventItem);
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

