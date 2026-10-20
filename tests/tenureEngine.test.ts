import { 
  getActiveTenure, 
  resolveEventTenure, 
  filterEventsForTenure, 
  getTenureById 
} from "../src/lib/tenureEngine";
import { CouncilTenure } from "../src/lib/tenureStore";
import { EventItem } from "../src/types";

const mockTenures: CouncilTenure[] = [
  {
    id: "tenure-2025-26",
    label: "2025-26",
    academicYear: "2025 - 2026",
    tenureNumber: "1st Tenure",
    isCurrent: false,
    status: "archived",
    startDate: "2025-07-01T00:00:00.000Z",
    endDate: "2026-06-30T23:59:59.000Z",
    adminCouncil: [],
    hostingCommittee: [],
    events: [],
    createdAt: "2025-07-01T00:00:00.000Z",
  },
  {
    id: "tenure-2026-27",
    label: "2026-27",
    academicYear: "2026 - 2027",
    tenureNumber: "2nd Tenure",
    isCurrent: true,
    status: "active",
    startDate: "2026-07-01T00:00:00.000Z",
    adminCouncil: [],
    hostingCommittee: [],
    events: [],
    createdAt: "2026-07-01T00:00:00.000Z",
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
    slug: "tech-symposium-2026",
    name: "Tech Symposium 2026",
    date: "12 Nov 2026",
    tenureId: "tenure-2026-27",
    category: "Technical",
    isLive: true,
  } as EventItem,
  {
    id: "ev-3",
    slug: "freshers-2026",
    name: "Freshers Party",
    date: "20 Aug 2026",
    category: "Cultural",
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

// 4. Test resolveEventTenure by date inference
const resolvedByDate = resolveEventTenure(mockEvents[2], mockTenures);
if (resolvedByDate.id !== "tenure-2026-27") {
  throw new Error(`Expected date inference to resolve to tenure-2026-27, got ${resolvedByDate.id}`);
}
console.log("✓ resolveEventTenure infers tenure accurately from date");

// 5. Test filterEventsForTenure
const currentEvents = filterEventsForTenure(mockEvents, "tenure-2026-27", mockTenures);
if (currentEvents.length !== 2) {
  throw new Error(`Expected 2 events for current tenure, got ${currentEvents.length}`);
}
console.log("✓ filterEventsForTenure correctly scopes events for current tenure");

const pastEvents = filterEventsForTenure(mockEvents, "tenure-2025-26", mockTenures);
if (pastEvents.length !== 1 || pastEvents[0].id !== "ev-1") {
  throw new Error(`Expected 1 event for 2025-26 tenure, got ${pastEvents.length}`);
}
console.log("✓ filterEventsForTenure correctly scopes events for past tenure");

const allEvents = filterEventsForTenure(mockEvents, "all", mockTenures);
if (allEvents.length !== 3) {
  throw new Error(`Expected 3 events for 'all', got ${allEvents.length}`);
}
console.log("✓ filterEventsForTenure returns all events for 'all' filter");

console.log("ALL TESTS PASSED SUCCESSFULLY! 🎉");
