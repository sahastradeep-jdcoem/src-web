import { 
  getActiveTenure, 
  resolveEventTenure, 
  filterEventsForTenure, 
  getTenureById 
} from "../src/lib/tenureEngine";
import { CouncilTenure } from "../src/lib/tenureStore";
import { EventItem } from "../src/types";

// Arbitrary commencement dates (e.g. Sep 24, 2025 and Oct 15, 2026)
const mockTenures: CouncilTenure[] = [
  {
    id: "tenure-2025-26",
    label: "2025-26",
    academicYear: "2025 - 2026",
    tenureNumber: "1st Tenure",
    isCurrent: false,
    status: "archived",
    startDate: "2025-09-24T00:00:00.000Z",
    endDate: "2026-10-14T23:59:59.999Z", // Exactly 1 day before 2026-10-15
    adminCouncil: [],
    hostingCommittee: [],
    events: [],
    createdAt: "2025-09-24T00:00:00.000Z",
  },
  {
    id: "tenure-2026-27",
    label: "2026-27",
    academicYear: "2026 - 2027",
    tenureNumber: "2nd Tenure",
    isCurrent: true,
    status: "active",
    startDate: "2026-10-15T00:00:00.000Z", // Commenced mid-October
    adminCouncil: [],
    hostingCommittee: [],
    events: [],
    createdAt: "2026-10-15T00:00:00.000Z",
  },
];

const mockEvents: EventItem[] = [
  {
    id: "ev-1",
    slug: "music-fest-2025",
    name: "Music Fest 2025",
    date: "15 Oct 2025",
    tenureId: "tenure-2025-26",
    category: "Technical",
    isLive: true,
  } as EventItem,
  {
    id: "ev-2",
    slug: "pre-switch-event",
    name: "Late Session Event",
    date: "10 Oct 2026", // 5 days before Tenure 2 commenced -> must resolve to 2025-26!
    category: "Cultural",
    isLive: true,
  } as EventItem,
  {
    id: "ev-3",
    slug: "post-switch-event",
    name: "New Session Inaugural",
    date: "20 Oct 2026", // 5 days after Tenure 2 commenced -> must resolve to 2026-27!
    category: "Technical",
    isLive: true,
  } as EventItem,
];

console.log("Running TenureEngine Test Suite...");

// 1. Test getActiveTenure
const active = getActiveTenure(mockTenures);
if (active.id !== "tenure-2026-27") {
  throw new Error(`Expected active tenure to be tenure-2026-27, got ${active.id}`);
}
console.log("✓ getActiveTenure returns active tenure");

// 2. Test getTenureById
const found = getTenureById("tenure-2025-26", mockTenures);
if (!found || found.label !== "2025-26") {
  throw new Error("Failed to find tenure by id");
}
console.log("✓ getTenureById resolves tenure accurately");

// 3. Test resolveEventTenure by explicit ID
const resolvedExplicit = resolveEventTenure(mockEvents[0], mockTenures);
if (resolvedExplicit.id !== "tenure-2025-26") {
  throw new Error(`Expected tenure-2025-26, got ${resolvedExplicit.id}`);
}
console.log("✓ resolveEventTenure respects explicit event.tenureId");

// 4. Test resolveEventTenure by arbitrary commencement date: event before Oct 15 -> 2025-26
const resolvedBeforeCommence = resolveEventTenure(mockEvents[1], mockTenures);
if (resolvedBeforeCommence.id !== "tenure-2025-26") {
  throw new Error(`Expected event on 10 Oct 2026 to resolve to tenure-2025-26, got ${resolvedBeforeCommence.id}`);
}
console.log("✓ resolveEventTenure correctly resolves pre-commencement event to outgoing tenure");

// 5. Test resolveEventTenure by arbitrary commencement date: event after Oct 15 -> 2026-27
const resolvedAfterCommence = resolveEventTenure(mockEvents[2], mockTenures);
if (resolvedAfterCommence.id !== "tenure-2026-27") {
  throw new Error(`Expected event on 20 Oct 2026 to resolve to tenure-2026-27, got ${resolvedAfterCommence.id}`);
}
console.log("✓ resolveEventTenure correctly resolves post-commencement event to incoming tenure");

// 6. Test filterEventsForTenure
const currentEvents = filterEventsForTenure(mockEvents, "tenure-2026-27", mockTenures);
if (currentEvents.length !== 1 || currentEvents[0].id !== "ev-3") {
  throw new Error(`Expected only ev-3 for 2026-27 tenure, got ${currentEvents.map(e => e.id).join(", ")}`);
}
console.log("✓ filterEventsForTenure correctly scopes events based on commencement date boundary");

const pastEvents = filterEventsForTenure(mockEvents, "tenure-2025-26", mockTenures);
if (pastEvents.length !== 2) {
  throw new Error(`Expected 2 events for 2025-26 tenure, got ${pastEvents.length}`);
}
console.log("✓ filterEventsForTenure correctly scopes events for past tenure ending 1 day before commencement");

console.log("ALL COMMENCEMENT-BASED TENURE TESTS PASSED! 🎉");
