import { useState, useEffect, useMemo, useCallback } from "react";
import { EventItem, RegistrationRecord, TeamMember, ClubItem } from "@/types";
import { 
  CouncilTenure, 
  getStoredTenures, 
  subscribeToTenures, 
  syncTenuresFromFirestore,
  getLatestAvailableTenure,
  switchActiveTenure as storeSwitchActiveTenure,
  undoActiveTenure as storeUndoActiveTenure
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
      // Check bounded date ranges
      for (const t of list) {
        if (t.startDate) {
          const startTs = new Date(t.startDate).getTime();
          const endTs = t.endDate ? new Date(t.endDate).getTime() : Infinity;
          if (ts >= startTs && ts <= endTs) {
            return t;
          }
        }
      }

      // Check calendar year against tenure label (e.g., 2025 against "2025-26")
      const eventYear = new Date(ts).getFullYear();
      const eventMonth = new Date(ts).getMonth(); // 0-11
      // Academic year in India generally runs July (month 6) to June (month 5 next year)
      const academicStartYear = eventMonth >= 5 ? eventYear : eventYear - 1;
      const matchedByYear = list.find((t) => {
        const match = (t.label || t.academicYear || "").match(/\d{4}/);
        return match && parseInt(match[0], 10) === academicStartYear;
      });
      if (matchedByYear) return matchedByYear;
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

/**
 * React Hook for consuming and orchestrating the active tenure universally.
 */
export function useActiveTenure() {
  const [tenures, setTenures] = useState<CouncilTenure[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return getStoredTenures();
      } catch {}
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(true);

  const activeTenure = useMemo(() => {
    return getActiveTenure(tenures);
  }, [tenures]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initial = getStoredTenures();
    if (initial && initial.length > 0) {
      setTenures(initial);
      setIsLoading(false);
    }

    // Sync from Firestore
    syncTenuresFromFirestore()
      .then((remote) => {
        if (remote && Array.isArray(remote) && remote.length > 0) {
          setTenures(remote);
        }
      })
      .finally(() => setIsLoading(false));

    // Real-time listener
    const unsubscribe = subscribeToTenures((updated) => {
      if (Array.isArray(updated) && updated.length > 0) {
        setTenures(updated);
        setIsLoading(false);
      }
    });

    const handleCustomChange = (e: any) => {
      const list = getStoredTenures();
      setTenures(list);
    };

    window.addEventListener("src_tenure_changed", handleCustomChange);
    window.addEventListener("src_tenures_updated", handleCustomChange);

    return () => {
      unsubscribe();
      window.removeEventListener("src_tenure_changed", handleCustomChange);
      window.removeEventListener("src_tenures_updated", handleCustomChange);
    };
  }, []);

  const switchTenure = useCallback(async (targetTenureId: string, beginDate?: string) => {
    await storeSwitchActiveTenure(targetTenureId, beginDate);
    const updated = getStoredTenures();
    setTenures(updated);
  }, []);

  const undoTenure = useCallback(async (tenureId: string) => {
    const result = await storeUndoActiveTenure(tenureId);
    const updated = getStoredTenures();
    setTenures(updated);
    return result;
  }, []);

  return {
    activeTenure,
    tenures,
    isLoading,
    switchTenure,
    undoTenure,
  };
}
