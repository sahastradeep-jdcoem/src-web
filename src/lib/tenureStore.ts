import { TeamMember, EventItem } from "@/types";
import { adminCouncilMembers, hostingCommitteeMembers, foundingMembers } from "@/data/team";
import { mockEvents } from "@/data/events";
import { 
  getStoredCouncilMembers, 
  saveStoredCouncilMembers,
  getStoredHostingCommittee,
  saveStoredHostingCommittee,
  getStoredFoundingMembers,
  saveStoredFoundingMembers
} from "./councilStore";
import { getStoredEvents, saveStoredEvents } from "./eventsStore";
import { 
  saveSiteContentToFirestore, 
  getSiteContentFromFirestore, 
  subscribeToSiteContent 
} from "./firebase/firestore";

export interface CouncilTenure {
  id: string;
  label: string; // e.g. "2025-26", "2026-27"
  academicYear: string; // e.g. "2025 - 2026"
  tenureNumber: string; // e.g. "1st Tenure", "2nd Tenure"
  theme?: string;
  isCurrent: boolean;
  adminCouncil: TeamMember[];
  hostingCommittee: TeamMember[];
  foundingMembers?: TeamMember[];
  events: EventItem[];
  archiveNotes?: string;
  createdAt: string;
}

const TENURES_STORAGE_KEY = "src_council_tenures";

export const initialDefaultTenures: CouncilTenure[] = [
  {
    id: "tenure-2025-26",
    label: "2025-26",
    academicYear: "2025 - 2026",
    tenureNumber: "1st Tenure",
    theme: "Prarambh: The Genesis of Sahastradeep",
    isCurrent: true,
    adminCouncil: adminCouncilMembers,
    hostingCommittee: hostingCommitteeMembers,
    foundingMembers: foundingMembers,
    events: mockEvents,
    archiveNotes: "The 1st & Founding Tenure of Sahastradeep, uniting all 12 collegiate societies at JDCOEM under one central autonomous student council constitution.",
    createdAt: "2025-09-24T00:00:00Z"
  }
];

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function getStoredTenures(): CouncilTenure[] {
  if (typeof window === "undefined") return initialDefaultTenures;
  try {
    const stored = localStorage.getItem(TENURES_STORAGE_KEY);
    if (stored !== null) {
      let parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out any legacy pre-2025 mock tenures
        parsed = parsed.filter((t: CouncilTenure) => t.id !== "tenure-2024-25" && !t.label.includes("2024"));
        if (parsed.length > 0) {
          // Ensure tenureNumber is populated on all records
          return parsed.map((t: CouncilTenure, idx: number) => {
            if (t.id === "tenure-2025-26" || t.label.includes("2025")) {
              return { ...t, tenureNumber: "1st Tenure" };
            }
            return {
              ...t,
              tenureNumber: t.tenureNumber || `${idx + 1}${getOrdinalSuffix(idx + 1)} Tenure`
            };
          });
        }
      }
    }
  } catch (e) {
    console.warn("Could not read tenures from storage", e);
  }
  return initialDefaultTenures;
}

export function saveStoredTenures(tenures: CouncilTenure[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(tenures));
    window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: tenures }));
    saveSiteContentToFirestore("council_tenures", tenures);
  } catch (e) {
    console.error("Could not save tenures to storage", e);
  }
}

export function getCurrentTenure(): CouncilTenure {
  const tenures = getStoredTenures();
  return tenures.find((t) => t.isCurrent) || tenures[0] || initialDefaultTenures[0];
}

/**
 * Switch Active Tenure (e.g. from 2025-26 to 2026-27)
 * 1. Synchronizes current active state into old tenure's archive snapshot
 * 2. Activates the target tenure
 * 3. Restores target tenure's team & events into active stores
 */
export function switchActiveTenure(targetTenureId: string): void {
  if (typeof window === "undefined") return;
  const tenures = getStoredTenures();
  
  // 1. Snapshot current active data into currently active tenure record
  const currentActiveTeam = getStoredCouncilMembers();
  const currentActiveHosting = getStoredHostingCommittee();
  const currentActiveFounders = getStoredFoundingMembers();
  const currentActiveEvents = getStoredEvents();

  const updatedTenures = tenures.map((tenure) => {
    if (tenure.isCurrent) {
      return {
        ...tenure,
        isCurrent: false,
        adminCouncil: currentActiveTeam,
        hostingCommittee: currentActiveHosting,
        foundingMembers: currentActiveFounders,
        events: currentActiveEvents,
      };
    }
    return tenure;
  });

  // 2. Set target tenure as current
  const targetTenure = updatedTenures.find((t) => t.id === targetTenureId);
  if (!targetTenure) return;

  targetTenure.isCurrent = true;
  saveStoredTenures(updatedTenures);

  // 3. Load target tenure's team and events into current active memory
  if (targetTenure.adminCouncil && Array.isArray(targetTenure.adminCouncil)) {
    saveStoredCouncilMembers(targetTenure.adminCouncil);
  }
  if (targetTenure.hostingCommittee && Array.isArray(targetTenure.hostingCommittee)) {
    saveStoredHostingCommittee(targetTenure.hostingCommittee);
  }
  if (targetTenure.foundingMembers && Array.isArray(targetTenure.foundingMembers)) {
    saveStoredFoundingMembers(targetTenure.foundingMembers);
  }
  if (targetTenure.events && Array.isArray(targetTenure.events)) {
    saveStoredEvents(targetTenure.events);
  }

  window.dispatchEvent(new CustomEvent("src_tenure_changed", { detail: targetTenure }));
}

/**
 * Create a new tenure (e.g. "2026-27") and optionally activate it immediately
 */
export function createAndActivateNewTenure(
  label: string, 
  academicYear: string, 
  theme: string, 
  startWithTemplateTeam: boolean = true
): CouncilTenure {
  const tenures = getStoredTenures();
  
  // Snapshot current active state
  const currentActiveTeam = getStoredCouncilMembers();
  const currentActiveHosting = getStoredHostingCommittee();
  const currentActiveFounders = getStoredFoundingMembers();
  const currentActiveEvents = getStoredEvents();

  const updatedTenures = tenures.map((tenure) => ({
    ...tenure,
    isCurrent: false,
    adminCouncil: tenure.isCurrent ? currentActiveTeam : tenure.adminCouncil,
    hostingCommittee: tenure.isCurrent ? currentActiveHosting : tenure.hostingCommittee,
    foundingMembers: tenure.isCurrent ? currentActiveFounders : tenure.foundingMembers,
    events: tenure.isCurrent ? currentActiveEvents : tenure.events,
  }));

  // Create fresh team for new tenure
  const newAdminCouncil: TeamMember[] = startWithTemplateTeam 
    ? [
        {
          id: `admin-${Date.now()}-1`,
          name: "Name Placeholder",
          role: "Mentor",
          level: "Advisory & Mentorship",
          category: "Admin Council",
          department: "Computer Science and Engineering",
          year: "4th Year",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
          bio: `Guiding ${label} institutional oversight and council governance.`,
          email: "mentor@jdcoem.ac.in",
          order: 1
        },
        {
          id: `admin-${Date.now()}-2`,
          name: "Name Placeholder",
          role: "President",
          level: "Presidency",
          category: "Admin Council",
          department: "Artificial Intelligence Engineering",
          year: "4th Year",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
          bio: `Presiding over the ${label} Student Representative Council.`,
          email: "president@jdcoem.ac.in",
          order: 2
        }
      ]
    : [];

  const tenureCount = tenures.length + 1;
  const tenureNumber = `${tenureCount}${getOrdinalSuffix(tenureCount)} Tenure`;

  const newTenure: CouncilTenure = {
    id: `tenure-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
    label,
    academicYear,
    tenureNumber,
    theme,
    isCurrent: true,
    adminCouncil: newAdminCouncil,
    hostingCommittee: [],
    foundingMembers: currentActiveFounders, // Founding members always carry through
    events: [],
    archiveNotes: `Official council session for academic year ${academicYear}.`,
    createdAt: new Date().toISOString()
  };

  const finalTenures = [newTenure, ...updatedTenures];
  saveStoredTenures(finalTenures);

  // Activate new team in live stores
  saveStoredCouncilMembers(newAdminCouncil);
  saveStoredHostingCommittee([]);
  saveStoredEvents([]);

  window.dispatchEvent(new CustomEvent("src_tenure_changed", { detail: newTenure }));
  return newTenure;
}

export async function syncTenuresFromFirestore(): Promise<CouncilTenure[]> {
  try {
    const remote = await getSiteContentFromFirestore<CouncilTenure[]>("council_tenures");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const filtered = remote.filter((t: CouncilTenure) => t.id !== "tenure-2024-25" && !t.label.includes("2024"));
      if (typeof window !== "undefined") {
        localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(filtered));
        window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: filtered }));
      }
      return filtered;
    }
  } catch (e) {
    console.warn("Could not sync tenures from Firestore", e);
  }
  return getStoredTenures();
}

export function subscribeToTenures(callback: (tenures: CouncilTenure[]) => void): () => void {
  return subscribeToSiteContent<CouncilTenure[]>("council_tenures", (remote) => {
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const filtered = remote.filter((t: CouncilTenure) => t.id !== "tenure-2024-25" && !t.label.includes("2024"));
      if (typeof window !== "undefined") {
        localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(filtered));
        window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: filtered }));
      }
      callback(filtered);
    }
  });
}
