import { EventItem } from "@/types";
import type { CouncilTenure } from "./tenureStore";
import { 
  saveEventToFirestore,
  deleteEventFromFirestore,
  deleteEventPermanentlyFromFirestore,
  getAllEventsFromFirestore,
  subscribeToEventsFromFirestore,
  getEventDocId,
  saveSiteContentToFirestore,
  cleanUndefined
} from "./firebase/firestore";
import { 
  enqueueCloudWrite, 
  reconcileArrayDatasets, 
  hasPendingWritesFor, 
  markLocalWrite,
  getLastLocalWriteTime,
  compactEventDataset,
  purgePendingQueueFor
} from "./dataSyncEngine";

const EVENTS_STORAGE_KEY = "src_events";

// Backward compatibility stubs
export function getEventMediaDocId(slugOrId: string): string {
  return getEventDocId(slugOrId);
}
export async function saveEventMediaDocument(): Promise<void> {}
export async function getEventMediaDocument(): Promise<null> { return null; }
export function hydrateEventMedia(events: EventItem[]): EventItem[] { return events; }


/**
 * Sanitize an event item, deduplicating primitive arrays such as whatToExpect and rules
 */
export function sanitizeEventItem(event: EventItem): EventItem {
  if (!event || typeof event !== "object") return event;
  const isNoReg = Boolean(event.noRegistrationRequired);
  const isPaidVal = isNoReg
    ? false
    : event.isPaid !== undefined
    ? Boolean(event.isPaid)
    : Boolean((event.feeAmount && event.feeAmount > 0) || (event.entryFee && event.entryFee.includes("₹")));

  const organizerVal = (event.organizer || "").trim();

  // Shift status to "Completed" if event date has passed (next day of event date),
  // OR auto-revert from "Completed" back to active if event was rescheduled to a future date.
  const isAutoCompleted = isEventCompletedByDate(event);
  let effectiveStatus: EventItem["status"] = event.status || "Upcoming";
  if (isAutoCompleted) {
    effectiveStatus = "Completed";
  } else if (event.status === "Completed" || event.status?.toLowerCase() === "completed") {
    effectiveStatus = isNoReg ? "Upcoming" : "Registration Open";
  }

  // Auto-heal registrationDeadline if event was rescheduled to a future date
  // and deadline is in the past (outdated past deadline from before rescheduling)
  let effectiveRegDeadline = event.registrationDeadline;
  if (!isNoReg && effectiveRegDeadline && effectiveRegDeadline !== "Not Required") {
    const deadlineTs = parseDateStringToTimestamp(effectiveRegDeadline, true);
    const targetDateStr = event.rawDate || event.date;
    const eventDateTs = targetDateStr ? parseDateStringToTimestamp(targetDateStr, true) : null;
    if (eventDateTs && eventDateTs >= Date.now() && deadlineTs && deadlineTs < Date.now()) {
      // Outdated deadline that passed before the future event date: heal to the event date
      effectiveRegDeadline = event.date || (event.rawDate ? event.rawDate : effectiveRegDeadline);
    }
  }

  return {
    ...event,
    tenureId: event.tenureId || undefined,
    tenureLabel: event.tenureLabel || undefined,
    status: effectiveStatus,
    registrationDeadline: isNoReg ? "Not Required" : effectiveRegDeadline,
    organizer: organizerVal,
    organizerClubSlug: event.organizerClubSlug || (organizerVal === "SRC JDCOEM" || organizerVal.toLowerCase().includes("council") ? "src-council" : undefined),
    isPaid: isPaidVal,
    feeAmount: isNoReg
      ? 0
      : typeof event.feeAmount === "number" && event.feeAmount > 0
      ? event.feeAmount
      : event.entryFee && event.entryFee.match(/₹\s*(\d+)/)
      ? parseInt(event.entryFee.match(/₹\s*(\d+)/)![1], 10)
      : isPaidVal
      ? 100
      : 0,
    teamFeeAmount: !isNoReg && isPaidVal && typeof event.teamFeeAmount === "number" ? event.teamFeeAmount : undefined,
    feePricingModel: event.feePricingModel || "per_person",
    entryFee: isNoReg
      ? "Free Walk-in Entry"
      : isPaidVal
      ? (event.entryFee && !event.entryFee.toLowerCase().includes("free")
          ? event.entryFee
          : (event.feePricingModel === "per_team" && event.teamFeeAmount
              ? `₹${event.teamFeeAmount} / team`
              : `₹${event.feeAmount || 100} / person`))
      : "Free Entry",
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
    noRegistrationRequired: isNoReg,
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
    hasSchedule: event.isParentFest
      ? false
      : (Array.isArray(event.schedule) && event.schedule.some((item) => item && Boolean(item.title?.trim() || item.time?.trim())))
      ? true
      : event.hasSchedule !== undefined
      ? Boolean(event.hasSchedule)
      : false,
    hasPrizes: event.isParentFest
      ? false
      : (Array.isArray(event.prizes) && event.prizes.some((p) => p && Boolean(p.position?.trim() || p.amount?.trim())))
      ? true
      : event.hasPrizes !== undefined
      ? Boolean(event.hasPrizes)
      : false,
    schedule: event.isParentFest
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
    prizes: event.isParentFest
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
 * Universal date parser that extracts a Unix timestamp.
 * If defaultToEndOfDay is true, sets time to 23:59:59.999 (unless time is explicitly specified).
 */
export function parseDateStringToTimestamp(dateStr?: string, defaultToEndOfDay: boolean = false): number | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // 1. ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const hasTime = isoMatch[4] !== undefined;
    const hours = hasTime ? parseInt(isoMatch[4], 10) : (defaultToEndOfDay ? 23 : 0);
    const minutes = hasTime && isoMatch[5] !== undefined ? parseInt(isoMatch[5], 10) : (defaultToEndOfDay ? 59 : 0);
    const seconds = hasTime && isoMatch[6] !== undefined ? parseInt(isoMatch[6], 10) : (defaultToEndOfDay ? 59 : 0);
    const ms = defaultToEndOfDay && !hasTime ? 999 : 0;
    return new Date(y, m, d, hours, minutes, seconds, ms).getTime();
  }

  // 2. Day Month Year (e.g. "24 September 2026", "22 to 24 September 2026", "24th Sep 2026")
  // Captures the LAST day in ranges so multi-day events calculate the completion on the final day
  const dmyMatch = trimmed.match(/(?:(?:\d{1,2}(?:st|nd|rd|th)?\s*(?:[-–—to]+|to)\s*)?(\d{1,2}))(?:st|nd|rd|th)?[\s\-_]+([A-Za-z]+)[\s\-_,]+(\d{4})/i);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const mStr = dmyMatch[2].toLowerCase();
    const year = parseInt(dmyMatch[3], 10);
    if (MONTH_MAP[mStr] !== undefined) {
      const hours = defaultToEndOfDay ? 23 : 0;
      const minutes = defaultToEndOfDay ? 59 : 0;
      const seconds = defaultToEndOfDay ? 59 : 0;
      const ms = defaultToEndOfDay ? 999 : 0;
      return new Date(year, MONTH_MAP[mStr], day, hours, minutes, seconds, ms).getTime();
    }
  }

  // 3. Month Day Year (e.g. "September 24, 2026", "September 22 - 24, 2026")
  const mdyMatch = trimmed.match(/([A-Za-z]+)[\s\-_]+(?:(?:\d{1,2}(?:st|nd|rd|th)?\s*(?:[-–—to]+|to)\s*)?(\d{1,2}))(?:st|nd|rd|th)?[\s\-_,]+(\d{4})/i);
  if (mdyMatch) {
    const mStr = mdyMatch[1].toLowerCase();
    const day = parseInt(mdyMatch[2], 10);
    const year = parseInt(mdyMatch[3], 10);
    if (MONTH_MAP[mStr] !== undefined) {
      const hours = defaultToEndOfDay ? 23 : 0;
      const minutes = defaultToEndOfDay ? 59 : 0;
      const seconds = defaultToEndOfDay ? 59 : 0;
      const ms = defaultToEndOfDay ? 999 : 0;
      return new Date(year, MONTH_MAP[mStr], day, hours, minutes, seconds, ms).getTime();
    }
  }

  // 4. Standard Date.parse
  const direct = Date.parse(trimmed);
  if (!isNaN(direct)) {
    const d = new Date(direct);
    if (defaultToEndOfDay && !trimmed.includes(":") && !trimmed.includes("T")) {
      d.setHours(23, 59, 59, 999);
    }
    return d.getTime();
  }

  return null;
}

/**
 * Helper to convert any valid date string or timestamp into HTML input YYYY-MM-DD format
 */
export function formatDateToInput(dateStr?: string): string {
  if (!dateStr || typeof dateStr !== "string") return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const ts = parseDateStringToTimestamp(trimmed, false);
  if (!ts) return "";
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Automatically determine if registrations have closed based on registrationDeadline.
 * Registration closes at the end of the registrationDeadline day (23:59:59.999) or specified deadline time.
 */
export function isRegistrationDeadlinePassed(event: Partial<EventItem> | null | undefined): boolean {
  if (!event) return false;
  if (event.noRegistrationRequired) return false;
  if (!event.registrationDeadline || event.registrationDeadline === "Not Required") return false;
  const deadlineTs = parseDateStringToTimestamp(event.registrationDeadline, true);
  if (!deadlineTs) return false;

  // If the event date is today or in the future, an outdated past deadline (leftover from before rescheduling)
  // should not lock out registrations if the event status is open.
  const targetDateStr = event.rawDate || event.date;
  const eventDateTs = targetDateStr ? parseDateStringToTimestamp(targetDateStr, true) : null;
  if (eventDateTs && eventDateTs >= Date.now() && deadlineTs < Date.now()) {
    return false;
  }

  return Date.now() > deadlineTs;
}

/**
 * Automatically shift event status to "Completed" on the next day of the event date (or end date).
 * Once the event day finishes (after 23:59:59.999), on the next day, it resolves to completed.
 * CRITICAL INVARIANT: If the event date is today or in the future, it is NEVER completed by date!
 */
export function isEventCompletedByDate(event: Partial<EventItem> | null | undefined): boolean {
  if (!event) return false;
  if (event.status === "Cancelled" || event.isCancelled) return false;
  if (event.status === "draft") return false;
  if (event.status === "Coming Soon") return false;

  const targetDateStr = event.rawEndDate || event.rawDate || event.endDate || event.date;
  if (targetDateStr) {
    if (/\b(coming soon|tba|to be announced|tbd)\b/i.test(targetDateStr)) return false;

    const endOfDayTs = parseDateStringToTimestamp(targetDateStr, true);
    if (endOfDayTs) {
      // If the event date is today or in the future, it is strictly NOT completed
      if (Date.now() <= endOfDayTs) {
        return false;
      }
      // If the event date has passed (it is strictly after the end of the event day), it is completed
      return true;
    }
  }

  // Only if no date could be parsed, check if explicitly marked Completed
  if (event.status === "Completed" || event.status?.toLowerCase() === "completed") return true;

  return false;
}

/**
 * Resolves the effective status of an event taking into account automatic completion and future rescheduling.
 */
export function getEventEffectiveStatus(event: Partial<EventItem> | null | undefined): EventItem["status"] {
  if (!event) return "Upcoming";
  if (event.isCancelled || event.status === "Cancelled") return "Cancelled";
  if (event.status === "draft") return "draft";
  if (event.status === "Coming Soon") return "Coming Soon";

  const targetDateStr = event.rawEndDate || event.rawDate || event.endDate || event.date;
  const isCompleted = isEventCompletedByDate(event);
  if (isCompleted) return "Completed";

  // If status is marked "Completed" in raw data, but the event date is today or in the future:
  // Admin rescheduled the event to a future date! Auto-shift status back to active.
  if (event.status === "Completed" || event.status?.toLowerCase() === "completed") {
    if (targetDateStr) {
      const endOfDayTs = parseDateStringToTimestamp(targetDateStr, true);
      if (endOfDayTs && Date.now() <= endOfDayTs) {
        return event.noRegistrationRequired ? "Upcoming" : "Registration Open";
      }
    }
  }

  return event.status || "Upcoming";
}

/**
 * Extract a comparable Unix timestamp (earliest first) from an event's date, time, and fallback fields.
 */
export function getEventDateTimestamp(event: Partial<EventItem> | null | undefined): number {
  if (!event) return Number.MAX_SAFE_INTEGER;
  if (event.status === "Coming Soon") return Number.MAX_SAFE_INTEGER;
  const dateStr = (event.date || "").trim();
  const timeOffset = parseTimeString(event.time);

  // If date contains placeholder or TBA
  if (!dateStr || /\b(tbd|to be decided|coming soon|announced soon|tba|to be announced)\b/i.test(dateStr)) {
    if (event.registrationStartDate) {
      const regStart = Date.parse(event.registrationStartDate);
      if (!isNaN(regStart)) return regStart + timeOffset;
    }
    return Number.MAX_SAFE_INTEGER;
  }

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
    if (getEventEffectiveStatus(e) === "Completed") return true;
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
  // Strict Event Invariant: Must be a valid object with a non-empty name and at least an id or slug.
  // Never admit ghost, blank, or placeholder items lacking a title into the events catalog.
  const valid = events.filter((e) => (
    e && 
    typeof e === "object" && 
    typeof e.name === "string" && 
    e.name.trim().length > 0 && 
    Boolean(e.id || e.slug)
  ));
  const sanitized = valid.map(sanitizeEventItem);
  return sortEventsByDate(sanitized);
}

/**
 * Resolves which tenure an event belongs to based primarily on TENURE ACTIVE DATE.
 * 
 * Invariant: Tenure Active Date is the authoritative factor for event segregation.
 * 1. Event Date Timestamp: extracted from event.rawDate or event.date.
 * 2. Compares against each tenure's [startDate, endDate] active window.
 * 3. Fallback to event.tenureId / event.tenureLabel only if event date is TBA/absent.
 */
export function resolveTenureForEvent(
  event?: Partial<EventItem> | { date?: string; rawDate?: string; tenureId?: string; tenureLabel?: string; [key: string]: any } | null,
  tenuresList?: CouncilTenure[]
): CouncilTenure | null {
  if (!event || !Array.isArray(tenuresList) || tenuresList.length === 0) return null;

  const currentTenure = tenuresList.find((t) => t.isCurrent) || tenuresList[0];

  // Helper to extract timestamp from tenure date or label
  const getTenureStartTs = (t: CouncilTenure): number => {
    if (t.startDate) {
      const ts = parseDateStringToTimestamp(t.startDate);
      if (ts) return ts;
    }
    const match = (t.label || t.academicYear || "").match(/(\d{4})/);
    if (match) {
      const year = parseInt(match[1], 10);
      return new Date(year, 5, 1).getTime(); // June 1 of year
    }
    return 0;
  };

  const getTenureEndTs = (t: CouncilTenure): number => {
    if (t.isCurrent) {
      return Number.MAX_SAFE_INTEGER;
    }
    // Calculate based on next tenure start date if available
    const tStart = getTenureStartTs(t);
    const subsequentTenures = tenuresList
      .filter((other) => other.id !== t.id && getTenureStartTs(other) > tStart)
      .sort((a, b) => getTenureStartTs(a) - getTenureStartTs(b));
    if (subsequentTenures.length > 0) {
      const nextStart = getTenureStartTs(subsequentTenures[0]);
      if (nextStart > tStart) {
        return nextStart - 1; // Ends strictly before next tenure begins
      }
    }
    if (t.endDate) {
      const ts = parseDateStringToTimestamp(t.endDate, true);
      if (ts) return ts;
    }
    const match = (t.label || t.academicYear || "").match(/\d{4}\s*[-–/]\s*(\d{2,4})/);
    if (match) {
      let year = parseInt(match[1], 10);
      if (year < 100) year += 2000;
      return new Date(year, 5, 30, 23, 59, 59, 999).getTime(); // June 30 of ending year
    }
    return Number.MAX_SAFE_INTEGER;
  };

  // 1. Primary: Resolve by Event Date vs Tenure Active Window
  const targetDateStr = event.rawDate || event.date;
  if (targetDateStr && !/\b(coming soon|tba|to be announced|tbd)\b/i.test(targetDateStr)) {
    const eventTs = parseDateStringToTimestamp(targetDateStr);
    if (eventTs) {
      const currentStart = getTenureStartTs(currentTenure);

      // Rule A: If event date is on or after current active tenure's start date,
      // it DEFINITIVELY belongs to the current active tenure!
      if (eventTs >= currentStart) {
        return currentTenure;
      }

      // Rule B: If event happened before current tenure start, resolve to appropriate past/archived tenure
      const nonDraftTenures = tenuresList.filter((t) => !t.isDraft && !t.isCurrent);
      const candidates = nonDraftTenures.length > 0 ? nonDraftTenures : tenuresList.filter((t) => !t.isCurrent);

      for (const t of candidates) {
        const s = getTenureStartTs(t);
        const e = getTenureEndTs(t);
        if (eventTs >= s && eventTs <= e) {
          return t;
        }
      }

      // If event happened before current tenure start, map to closest past tenure
      if (candidates.length > 0) {
        const pastSorted = [...candidates].sort((a, b) => getTenureStartTs(b) - getTenureStartTs(a));
        return pastSorted[0];
      }

      return currentTenure;
    }
  }

  // 2. Secondary Fallback: Use explicit tags only if event has no parseable date
  if (event.tenureId) {
    const byId = tenuresList.find((t) => t.id === event.tenureId);
    if (byId) return byId;
  }
  if (event.tenureLabel) {
    const byLabel = tenuresList.find((t) => t.label === event.tenureLabel);
    if (byLabel) return byLabel;
  }

  return currentTenure;
}

/**
 * Resolves events to show on the main public calendar (/events).
 * Uses Tenure Active Date as the authoritative factor to segregate current vs older tenure events.
 * Past tenure events are strictly isolated to /events/past as per user directives.
 */
export function getMainCalendarEvents(
  eventsList: EventItem[],
  tenuresList?: CouncilTenure[]
): {
  events: EventItem[];
  isShowingOlderEvents: boolean;
  currentTenureCompletedCount: number;
} {
  const validEvents = sanitizeEventsList(eventsList || []);
  const validTenures = Array.isArray(tenuresList) ? tenuresList.filter((t) => !t.isDraft) : [];

  if (validTenures.length === 0) {
    const currentCompleted = validEvents.filter(
      (e) =>
        e.isLive !== false &&
        e.status !== "draft" &&
        !e.isCancelled &&
        e.status !== "Cancelled" &&
        !e.parentEventId &&
        !e.parentEventSlug &&
        getEventEffectiveStatus(e) === "Completed"
    );
    return {
      events: validEvents,
      isShowingOlderEvents: false,
      currentTenureCompletedCount: currentCompleted.length,
    };
  }

  const currentTenure = validTenures.find((t) => t.isCurrent) || validTenures[0];

  // Determine which events belong to the current tenure based on TENURE ACTIVE DATE
  const currentTenureEvents: EventItem[] = [];

  for (const evt of validEvents) {
    const resolvedTenure = resolveTenureForEvent(evt, validTenures);
    const isForCurrent = resolvedTenure ? resolvedTenure.id === currentTenure.id : true;

    if (isForCurrent) {
      currentTenureEvents.push({
        ...evt,
        tenureId: currentTenure.id,
        tenureLabel: currentTenure.label,
      });
    }
  }

  // Count completed events in current tenure (top-level, live, non-cancelled)
  const currentTenureCompleted = currentTenureEvents.filter(
    (e) =>
      e.isLive !== false &&
      e.status !== "draft" &&
      !e.isCancelled &&
      e.status !== "Cancelled" &&
      !e.parentEventId &&
      !e.parentEventSlug &&
      getEventEffectiveStatus(e) === "Completed"
  );

  // Past tenure events are strictly isolated to /events/past as requested by user.
  // The main calendar (/events) displays strictly current tenure events.
  return {
    events: sortEventsByDate(currentTenureEvents),
    isShowingOlderEvents: false,
    currentTenureCompletedCount: currentTenureCompleted.length,
  };
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
    console.warn("localStorage quota exceeded for events, reclaiming cache space:", quotaErr);
    try {
      // Reclaim space by pruning stale/obsolete temporary and backup items from localStorage
      const pruneKeys = ["src_events_backup", "src_events_draft", "src_temp_uploads", "src_debug_logs"];
      pruneKeys.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });
      // Attempt write again with full event fidelity
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch (secondErr) {
      // Directive #4 (No Silent Data Stripping): NEVER overwrite images with empty strings ("").
      // In-memory events and individual Firestore documents (/events/{id}) remain the authoritative source of truth.
      console.warn("Could not save full events to localStorage; in-memory store remains fully hydrated with all images:", secondErr);
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
        // If stale or ghost entries were stripped, write back the cleaned list
        if (sanitized.length !== parsed.length) {
          safeWriteEventsToLocalStorage(sanitized);
        }
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
    enqueueCloudWrite(`event_${docId}`, sanitized, `Event: ${sanitized.name}`);
  }

  // Background update events catalog in site_content/events without blocking
  compactEventDataset(sorted)
    .then((compacted) => {
      saveSiteContentToFirestore("events", cleanUndefined(compacted)).catch(() => {});
    })
    .catch(() => {});

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

    // Detect changed vs unchanged events for ultra-fast delta writes (<300ms save time)
    const previousMap = new Map(previous.map((p) => [getEventDocId(p), p]));
    const changedEvents = sanitized.filter((curr) => {
      const prev = previousMap.get(getEventDocId(curr));
      if (!prev) return true; // new event
      return JSON.stringify(curr) !== JSON.stringify(prev);
    });

    // 1 Event = 1 Document: Parallel writes ONLY to documents that actually changed or are new
    const writePromises = changedEvents.map(async (e) => {
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

    // Update the lightweight events catalog in site_content/events in parallel
    // so all browser tabs and client devices discover the new/updated events immediately.
    // Thumbnails are compacted so the catalog stays under 500KB even with 20+ events,
    // while each event's dedicated document stores the full-resolution assets.
    compactEventDataset(sanitized)
      .then((compacted) => {
        saveSiteContentToFirestore("events", cleanUndefined(compacted)).catch((err) => {
          console.warn("Could not sync events catalog to site_content:", err);
          enqueueCloudWrite("site_content_events", cleanUndefined(compacted), "Events Catalog");
        });
      })
      .catch(() => {});

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
      const current = getStoredEvents();
      // If remote is empty but local has items (e.g. temporary network blip or initial load),
      // avoid destructive wipe of local storage.
      if (remote.length === 0 && current.length > 0) {
        return current;
      }
      // Remote Firestore state is strictly authoritative for items & deletions (Directive #9)
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
 * Subscribe to real-time events changes from Firestore across all devices.
 * The subscription is tombstone-aware: if an event is deleted (tombstoned in Firestore),
 * the remote list is authoritative and the deletion is immediately reflected on all tabs.
 */
export function subscribeToEvents(callback: (events: EventItem[]) => void): () => void {
  return subscribeToEventsFromFirestore((remote) => {
    if (remote !== null && Array.isArray(remote)) {
      // Only skip if an admin save is actively in-flight (pending queue not yet flushed to Firestore).
      // Do NOT use isLocalWriteRecent here — that 15s window blocks the public /events page from
      // updating after any admin change, causing stale-data on first load (visible → refresh required).
      if (hasPendingWritesFor("events")) return;

      const current = getStoredEvents();

      // Guard: If remote is empty [] but local has items, do not destructively wipe local items
      // on initial snapshot transitions. Matches syncEventsFromFirestore guard.
      if (remote.length === 0 && current.length > 0) {
        return;
      }

      // Remote Firestore state is strictly authoritative (Directive #9)
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
 * Delete a specific event permanently — from localStorage, in-memory cache, pending queue,
 * and all Firestore locations — and record a tombstone so it can NEVER be resurrected.
 */
export function deleteStoredEvent(idOrSlug: string, slug?: string, name?: string): EventItem[] {
  const current = getStoredEvents();

  // Find the full event record so we have all three identifiers (id, slug, name)
  const target = current.find((e) => e.id === idOrSlug || e.slug === idOrSlug);
  const resolvedId = target?.id || idOrSlug;
  const resolvedSlug = slug || target?.slug || idOrSlug;
  const resolvedName = name || target?.name || "";

  // 1. Remove from in-memory cache and localStorage immediately
  const updated = current.filter(
    (e) => e.id !== resolvedId && e.id !== resolvedSlug && e.slug !== resolvedSlug && e.slug !== resolvedId
  );
  inMemoryEvents = updated;
  safeWriteEventsToLocalStorage(updated);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("src_events_updated", { detail: updated }));
  }

  // 2. Purge any pending queue writes for this event so they can never re-create it
  const purgeKeys = [
    resolvedId,
    resolvedSlug,
    `event_${resolvedId}`,
    `event_${resolvedSlug}`,
  ].filter(Boolean);
  purgePendingQueueFor(purgeKeys);

  // 3. Permanently delete from Firestore (all locations) and record tombstone
  deleteEventPermanentlyFromFirestore(resolvedId, resolvedSlug, resolvedName).catch((err) =>
    console.warn(`Permanent delete failed for event [${resolvedId}]:`, err)
  );

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


