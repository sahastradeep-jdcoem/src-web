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
 * Resolves the effective commencement timestamp for a tenure.
 * Authoritative source is tenure.startDate.
 * For unactivated draft tenures, falls back to createdAt or year in label.
 */
export function getTenureCommencementTimestamp(t: CouncilTenure): number | null {
  if (t.startDate) {
    const ts = new Date(t.startDate).getTime();
    if (!isNaN(ts)) return ts;
  }
  if (t.createdAt) {
    const ts = new Date(t.createdAt).getTime();
    if (!isNaN(ts)) return ts;
  }
  const match = (t.label || t.academicYear || "").match(/\d{4}/);
  if (match) {
    const year = parseInt(match[0], 10);
    return new Date(`${year}-07-01T00:00:00.000Z`).getTime();
  }
  return null;
}

/**
 * Resolves which tenure an event belongs to based on dynamic commencement dates.
 * Directive: Zero hardcoded tenure period. Uses tenure commencement date as begin,
 * and old tenure end date is one day before the next tenure commence date.
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

  // 3. Date inference based on dynamic tenure commencement dates
  const dateStr = event.rawDate || event.date;
  if (dateStr) {
    const ts = parseDateStringToTimestamp(dateStr);
    if (ts !== null && !isNaN(ts)) {
      // Sort tenures by effective commencement date chronologically
      const sortedTenures = [...list]
        .map((t) => ({ tenure: t, commenceTs: getTenureCommencementTimestamp(t) }))
        .filter((entry): entry is { tenure: CouncilTenure; commenceTs: number } => entry.commenceTs !== null)
        .sort((a, b) => a.commenceTs - b.commenceTs);

      if (sortedTenures.length > 0) {
        for (let i = 0; i < sortedTenures.length; i++) {
          const currentEntry = sortedTenures[i];
          const startTs = currentEntry.commenceTs;
          let endTs: number;

          if (currentEntry.tenure.endDate) {
            endTs = new Date(currentEntry.tenure.endDate).getTime();
          } else if (i < sortedTenures.length - 1) {
            // Directive: Old tenure end date is one day before the next tenure commence date
            const nextStart = new Date(sortedTenures[i + 1].commenceTs);
            const oneDayBefore = new Date(nextStart);
            oneDayBefore.setDate(oneDayBefore.getDate() - 1);
            oneDayBefore.setHours(23, 59, 59, 999);
            endTs = oneDayBefore.getTime();
          } else {
            // Current / latest active tenure
            endTs = Infinity;
          }

          if (ts >= startTs && ts <= endTs) {
            return currentEntry.tenure;
          }
        }

        // If event date is earlier than earliest commencement, assign to earliest tenure
        if (ts < sortedTenures[0].commenceTs) {
          return sortedTenures[0].tenure;
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


