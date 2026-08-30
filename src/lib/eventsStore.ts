import { EventItem } from "@/types";
import { mockEvents as initialEvents } from "@/data/events";

const EVENTS_STORAGE_KEY = "src_events";

/**
 * Retrieve current events list from local storage or defaults
 */
export function getStoredEvents(): EventItem[] {
  if (typeof window === "undefined") return initialEvents;
  try {
    const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Could not read events from storage", e);
  }
  return initialEvents;
}

/**
 * Persist events list and broadcast real-time event update across tabs and components
 */
export function saveStoredEvents(events: EventItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    window.dispatchEvent(new CustomEvent("src_events_updated", { detail: events }));
  } catch (e) {
    console.error("Could not save events to storage", e);
  }
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
 * Reset to initial events (Prarambh)
 */
export function resetStoredEvents(): EventItem[] {
  saveStoredEvents(initialEvents);
  return initialEvents;
}
