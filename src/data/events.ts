import { EventItem } from "@/types";

/**
 * Standard events array export for SSR / type compatibility.
 * All event items are 100% dynamically managed via Firestore and eventsStore.
 * Never hardcode event entities in codebase logic (Directive #8).
 */
export const mockEvents: EventItem[] = [];

