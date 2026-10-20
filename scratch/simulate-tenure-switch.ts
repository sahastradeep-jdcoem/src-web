import { 
  getActiveTenure, 
  resolveEventTenure, 
  filterEventsForTenure, 
  getTenureById 
} from "../src/lib/tenureEngine";
import { CouncilTenure } from "../src/lib/tenureStore";
import { EventItem } from "../src/types";

console.log("=== UNIVERSAL TENURE SYSTEM END-TO-END SIMULATION ===");

// Initial State: 2025-26 is Active, 2026-27 is Draft/Upcoming
const tenures: CouncilTenure[] = [
  {
    id: "tenure-2025-26",
    label: "2025-26",
    academicYear: "2025 - 2026",
    tenureNumber: "1st Tenure",
    isCurrent: true,
    status: "active",
    startDate: "2025-07-01T00:00:00.000Z",
    adminCouncil: [{ id: "m1", name: "Leader 2025", role: "President", department: "CSE", year: "4th", avatar: "", bio: "", email: "m1@jdcoem.ac.in", order: 1 }],
    hostingCommittee: [],
    events: [],
    createdAt: "2025-07-01T00:00:00.000Z",
  },
  {
    id: "tenure-2026-27",
    label: "2026-27",
    academicYear: "2026 - 2027",
    tenureNumber: "2nd Tenure",
    isCurrent: false,
    status: "draft",
    isDraft: true,
    adminCouncil: [{ id: "m2", name: "Leader 2026", role: "President", department: "AI", year: "4th", avatar: "", bio: "", email: "m2@jdcoem.ac.in", order: 1 }],
    hostingCommittee: [],
    events: [],
    createdAt: "2026-07-01T00:00:00.000Z",
  },
];

const events: EventItem[] = [
  { id: "e1", slug: "aarohan-2025", name: "Aarohan 2025", date: "15 Oct 2025", tenureId: "tenure-2025-26", isLive: true } as EventItem,
  { id: "e2", slug: "techfest-2026", name: "Techfest 2026", date: "20 Nov 2026", isLive: true } as EventItem,
];

// Step 1: Initial active tenure verification
let active = getActiveTenure(tenures);
console.log(`Initial Active Tenure: ${active.label} (${active.id})`);
if (active.id !== "tenure-2025-26") throw new Error("Initial active tenure mismatch");

// Step 2: Events in current tenure vs 2026-27
let activeEvents = filterEventsForTenure(events, active.id, tenures);
console.log(`Events in ${active.label}:`, activeEvents.map(e => e.name));
if (activeEvents.length !== 1 || activeEvents[0].id !== "e1") {
  throw new Error("Event scoping failed for 2025-26");
}

// Step 3: Simulate Activation of 2026-27 Tenure
console.log("\n-> Simulating activation of Tenure 2026-27...");
const beginIso = "2026-07-01T00:00:00.000Z";
const updatedTenures = tenures.map((t) => {
  if (t.id === "tenure-2025-26") {
    return {
      ...t,
      isCurrent: false,
      status: "archived" as const,
      endDate: beginIso,
      events: [events[0]],
    };
  }
  if (t.id === "tenure-2026-27") {
    return {
      ...t,
      isCurrent: true,
      status: "active" as const,
      isDraft: false,
      startDate: beginIso,
      previousTenureId: "tenure-2025-26",
      activatedFromDraft: true,
      events: [{ ...events[1], tenureId: "tenure-2026-27", tenureLabel: "2026-27" }],
    };
  }
  return t;
});

// Step 4: Verify new active tenure
active = getActiveTenure(updatedTenures);
console.log(`New Active Tenure: ${active.label} (${active.id})`);
if (active.id !== "tenure-2026-27") throw new Error("Failed to recognize 2026-27 as active");

// Step 5: Verify event scoping in new tenure
const updatedEvents: EventItem[] = [
  events[0],
  { ...events[1], tenureId: "tenure-2026-27", tenureLabel: "2026-27" },
];
activeEvents = filterEventsForTenure(updatedEvents, active.id, updatedTenures);
console.log(`Events in ${active.label}:`, activeEvents.map(e => e.name));
if (activeEvents.length !== 1 || activeEvents[0].id !== "e2") {
  throw new Error("Event scoping failed for 2026-27");
}

// Past tenure archive events check
const archivedEvents = filterEventsForTenure(updatedEvents, "tenure-2025-26", updatedTenures);
console.log(`Events in archived 2025-26:`, archivedEvents.map(e => e.name));
if (archivedEvents.length !== 1 || archivedEvents[0].id !== "e1") {
  throw new Error("Archived event retrieval failed");
}

console.log("\n✓ SIMULATION PASSED: All lifecycle transitions and scoping rules verified successfully!");
