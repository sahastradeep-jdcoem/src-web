import { EventItem, RegistrationRecord, TeamMember, ClubItem } from "@/types";
import { 
  CouncilTenure, 
  getStoredTenures, 
  getLatestAvailableTenure 
} from "@/lib/tenureStore";
import { parseDateStringToTimestamp, canUserManageEvent } from "@/lib/eventsStore";

/**
 * Universal Single Source of Truth for resolving the active tenure.
 * Never returns undefined: falls back to the latest sorted academic tenure.
 */
export function getActiveTenure(tenuresList?: CouncilTenure[]): CouncilTenure {
  const list = Array.isArray(tenuresList) && tenuresList.length > 0 
    ? tenuresList 
    : (typeof window !== "undefined" ? getStoredTenures() : []);

  if (!list || list.length === 0) {
    return {
      id: "tenure-active",
      label: "Current Tenure",
      academicYear: "2026 - 2027",
      tenureNumber: "Active Tenure",
      isCurrent: true,
      status: "active",
      adminCouncil: [],
      hostingCommittee: [],
      events: [],
      createdAt: new Date().toISOString()
    };
  }

  // 1. Look for explicit isCurrent flag or active status
  const current = list.find((t) => t.isCurrent === true || t.status === "active");
  if (current) return current;

  // 2. Fall back to latest available academic year (Directive: zero static hardcoding)
  return getLatestAvailableTenure(list);
}

/**
 * Find a tenure by its unique ID or label.
 */
export function getTenureById(id: string, tenuresList?: CouncilTenure[]): CouncilTenure | null {
  if (!id) return null;
  const list = Array.isArray(tenuresList) && tenuresList.length > 0 
    ? tenuresList 
    : (typeof window !== "undefined" ? getStoredTenures() : []);
  const cleanId = id.toLowerCase().trim();
  return list.find((t) => t.id.toLowerCase() === cleanId || t.label.toLowerCase() === cleanId) || null;
}

/**
 * Resolves which tenure an event belongs to.
 * 1. Checks explicit event.tenureId against known tenures
 * 2. Checks explicit event.tenureLabel against known tenures
 * 3. Compares event date timestamp against tenure start/end bounds or academic year
 * 4. Fallback: defaults to current active tenure
 */
export function resolveEventTenure(
  event: Partial<EventItem>, 
  tenuresList?: CouncilTenure[]
): CouncilTenure {
  const list = Array.isArray(tenuresList) && tenuresList.length > 0 
    ? tenuresList 
    : (typeof window !== "undefined" ? getStoredTenures() : []);
  const activeTenure = getActiveTenure(list);

  if (!event) return activeTenure;

  // 1. Explicit ID match
  if (event.tenureId) {
    const matched = list.find((t) => t.id === event.tenureId);
    if (matched) return matched;
  }

  // 2. Explicit label match
  if (event.tenureLabel) {
    const cleanLabel = event.tenureLabel.replace(/\s+/g, "").toLowerCase();
    const matched = list.find((t) => t.label.replace(/\s+/g, "").toLowerCase() === cleanLabel);
    if (matched) return matched;
  }

  // 3. Date inference
  const dateStr = event.rawDate || event.date;
  if (dateStr) {
    const ts = parseDateStringToTimestamp(dateStr);
    if (ts !== null && !isNaN(ts)) {
      // Academic year in India runs June/July (month 5/6) to May (month 4 next year)
      const d = new Date(ts);
      const eventYear = d.getFullYear();
      const eventMonth = d.getMonth(); // 0-11
      const academicStartYear = eventMonth >= 5 ? eventYear : eventYear - 1;

      // 3a. Check calendar academic year against tenure label (e.g. 2026 for "2026-27")
      const matchedByYear = list.find((t) => {
        const match = (t.label || t.academicYear || "").match(/\d{4}/);
        return match && parseInt(match[0], 10) === academicStartYear;
      });
      if (matchedByYear) return matchedByYear;

      // 3b. Check bounded date ranges if explicitly configured
      for (const t of list) {
        if (t.startDate && t.endDate) {
          const startTs = new Date(t.startDate).getTime();
          const endTs = new Date(t.endDate).getTime();
          if (ts >= startTs && ts <= endTs) {
            return t;
          }
        }
      }
    }
  }

  return activeTenure;
}

/**
 * Filter events strictly for a given tenure selector ("all", specific tenure ID, or active).
 * Handles sub-events, snapshots, and optional RBAC management scoping.
 */
export function filterEventsForTenure(
  events: EventItem[],
  tenureId: string,
  tenuresList: CouncilTenure[],
  isScopedManager?: boolean,
  adminAccess?: any,
  userId?: string,
  allEvents?: EventItem[]
): EventItem[] {
  const safeEvents = Array.isArray(events) ? events : [];
  let result: EventItem[] = [];

  const matchedTenure = tenuresList.find((t) => t.id === tenureId);

  if (tenureId === "all" || !matchedTenure) {
    if (tenureId === "all") {
      result = safeEvents;
    } else {
      result = safeEvents.filter((e) => {
        const resolved = resolveEventTenure(e, tenuresList);
        return resolved ? resolved.id === tenureId : e.tenureId === tenureId;
      });
    }
  } else if (matchedTenure.isCurrent || matchedTenure.status === "active") {
    // Current active tenure
    result = safeEvents.filter((e) => {
      const resolved = resolveEventTenure(e, tenuresList);
      return resolved ? resolved.id === matchedTenure.id : (e.tenureId === matchedTenure.id || !e.tenureId);
    });
  } else {
    // Past / Archived tenure: load snapshot + store past tagged events
    const snapshotEvents = Array.isArray(matchedTenure.events) ? matchedTenure.events : [];
    const pastFromStore = safeEvents.filter((e) => {
      const resolved = resolveEventTenure(e, tenuresList);
      return resolved ? resolved.id === matchedTenure.id : e.tenureId === matchedTenure.id;
    });

    const map = new Map<string, EventItem>();
    [...snapshotEvents, ...pastFromStore].forEach((ev) => {
      if (ev && (ev.id || ev.slug)) map.set(ev.id || ev.slug, ev);
    });
    result = Array.from(map.values());
  }

  // RBAC scoping
  if (isScopedManager && typeof canUserManageEvent === "function") {
    return result.filter((event) => canUserManageEvent(event, adminAccess, userId, allEvents || events));
  }

  return result;
}


