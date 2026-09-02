import { TeamMember, EventItem, ClubItem } from "@/types";
import { adminCouncilMembers, hostingCommitteeMembers, foundingMembers } from "@/data/team";
import { mockEvents } from "@/data/events";
import { mockClubs } from "@/data/clubs";
import { 
  getStoredCouncilMembers, 
  saveStoredCouncilMembers,
  getStoredHostingCommittee,
  saveStoredHostingCommittee,
  getStoredFoundingMembers,
  saveStoredFoundingMembers,
  getStoredClubs,
  saveStoredClubs
} from "./councilStore";
import { getStoredEvents, saveStoredEvents } from "./eventsStore";
import { 
  getSiteContentFromFirestore, 
  subscribeToSiteContent,
  cleanUndefined
} from "./firebase/firestore";
import { enqueueCloudWrite, reconcileArrayDatasets, hasPendingWritesFor } from "./dataSyncEngine";

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
  clubs?: ClubItem[];
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
    clubs: mockClubs,
    events: mockEvents,
    archiveNotes: "The 1st & Founding Tenure of Sahastradeep, uniting all 12 collegiate societies at JDCOEM under one central autonomous student council constitution.",
    createdAt: "2025-09-24T00:00:00Z"
  },
  {
    id: "tenure-2026-27",
    label: "2026-27",
    academicYear: "2026 - 2027",
    tenureNumber: "2nd Tenure",
    theme: "Vibrance & Future Horizons",
    isCurrent: false,
    adminCouncil: [
      {
        id: "admin-2026-mentor",
        name: "Mentor (Appointee)",
        role: "Mentor",
        department: "Computer Science and Engineering",
        year: "4th Year",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
        bio: "Guiding 2026-27 institutional oversight and council governance.",
        email: "mentor@jdcoem.ac.in",
        order: 1
      },
      {
        id: "admin-2026-president",
        name: "President (Appointee)",
        role: "President",
        department: "Artificial Intelligence Engineering",
        year: "4th Year",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
        bio: "Presiding over the 2026-27 Student Representative Council.",
        email: "president@jdcoem.ac.in",
        order: 2
      },
      {
        id: "admin-2026-vp",
        name: "Vice President (Appointee)",
        role: "Vice President",
        department: "Information Technology",
        year: "4th Year",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
        bio: "Executive coordination and student council operations for 2026-27.",
        email: "vp@jdcoem.ac.in",
        order: 3
      }
    ],
    hostingCommittee: [],
    foundingMembers: [],
    clubs: mockClubs,
    events: [],
    archiveNotes: "Pre-configured roster for upcoming session 2026 - 2027.",
    createdAt: "2026-09-01T00:00:00Z"
  }
];

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function getStoredTenures(): CouncilTenure[] {
  let list: CouncilTenure[] = initialDefaultTenures;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(TENURES_STORAGE_KEY);
      if (stored !== null) {
        let parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out any legacy pre-2025 mock tenures
          parsed = parsed.filter((t: CouncilTenure) => t.id !== "tenure-2024-25" && !t.label.includes("2024"));
          
          // Ensure standard default tenures (like 2026-27 draft) are never missing
          for (const def of initialDefaultTenures) {
            if (!parsed.some((p: CouncilTenure) => p.id === def.id || p.label === def.label)) {
              parsed.push(def);
            }
          }

          if (parsed.length > 0) {
            list = parsed;
          }
        }
      }
    } catch (e) {
      console.warn("Could not read tenures from storage", e);
    }
  }

  // Active Council, Hosting, Clubs & Events Sync: dynamically inject live active state into whichever tenure is current!
  const activeAdmins = getStoredCouncilMembers();
  const activeHosting = getStoredHostingCommittee();
  const activeFounders = getStoredFoundingMembers();
  const activeEvents = getStoredEvents();
  const activeClubs = getStoredClubs();

  // If no tenure has isCurrent, make the first one current
  const hasCurrent = list.some((t) => t.isCurrent);

  return list.map((t: CouncilTenure, idx: number) => {
    const isCurrent = hasCurrent ? t.isCurrent : idx === 0;
    const isFirstTenure = t.id === "tenure-2025-26" || t.label.includes("2025") || idx === 0;
    const tenureNum = (t.id === "tenure-2025-26" || t.label.includes("2025"))
      ? "1st Tenure"
      : (t.tenureNumber || `${idx + 1}${getOrdinalSuffix(idx + 1)} Tenure`);

    if (isCurrent) {
      return {
        ...t,
        isCurrent: true,
        tenureNumber: tenureNum,
        adminCouncil: activeAdmins,
        hostingCommittee: activeHosting,
        foundingMembers: isFirstTenure ? activeFounders : [],
        clubs: activeClubs,
        events: activeEvents,
      };
    }

    return {
      ...t,
      tenureNumber: tenureNum,
      foundingMembers: isFirstTenure ? (t.foundingMembers || activeFounders) : [],
      clubs: t.clubs && t.clubs.length > 0 ? t.clubs : activeClubs,
    };
  });
}

export function saveStoredTenures(tenures: CouncilTenure[]): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(tenures);
    localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: sanitized }));
    enqueueCloudWrite("council_tenures", sanitized, `Council Tenures (${tenures.length} Sessions)`);
  } catch (e) {
    console.error("Could not save tenures to storage", e);
  }
}

export function getCurrentTenure(): CouncilTenure {
  const tenures = getStoredTenures();
  return tenures.find((t) => t.isCurrent) || tenures[0] || initialDefaultTenures[0];
}

export function getTenureById(id: string): CouncilTenure | null {
  const tenures = getStoredTenures();
  return tenures.find((t) => t.id === id) || null;
}

/**
 * Pre-configure / Update roster for a specific tenure (Live active or Upcoming draft)
 */
export function updateTenureRoster(
  tenureId: string,
  updates: {
    adminCouncil?: TeamMember[];
    hostingCommittee?: TeamMember[];
    foundingMembers?: TeamMember[];
    clubs?: ClubItem[];
    events?: EventItem[];
    theme?: string;
    archiveNotes?: string;
  }
): void {
  if (typeof window === "undefined") return;
  const tenures = getStoredTenures();
  const target = tenures.find((t) => t.id === tenureId);
  if (!target) return;

  const isCurrentActive = target.isCurrent;

  // If this is the currently active tenure, also update the live active stores
  if (isCurrentActive) {
    if (updates.adminCouncil) saveStoredCouncilMembers(updates.adminCouncil);
    if (updates.hostingCommittee) saveStoredHostingCommittee(updates.hostingCommittee);
    if (updates.foundingMembers) saveStoredFoundingMembers(updates.foundingMembers);
    if (updates.clubs) saveStoredClubs(updates.clubs);
    if (updates.events) saveStoredEvents(updates.events);
  }

  const updatedTenures = tenures.map((t) => {
    if (t.id === tenureId) {
      return {
        ...t,
        adminCouncil: updates.adminCouncil !== undefined ? updates.adminCouncil : t.adminCouncil,
        hostingCommittee: updates.hostingCommittee !== undefined ? updates.hostingCommittee : t.hostingCommittee,
        foundingMembers: updates.foundingMembers !== undefined ? updates.foundingMembers : t.foundingMembers,
        clubs: updates.clubs !== undefined ? updates.clubs : t.clubs,
        events: updates.events !== undefined ? updates.events : t.events,
        theme: updates.theme !== undefined ? updates.theme : t.theme,
        archiveNotes: updates.archiveNotes !== undefined ? updates.archiveNotes : t.archiveNotes,
      };
    }
    return t;
  });

  saveStoredTenures(updatedTenures);
}

/**
 * Switch Active Tenure (e.g. from 2025-26 to 2026-27)
 * 1. Synchronizes current active state into old tenure's archive snapshot
 * 2. Activates the target tenure
 * 3. Restores target tenure's pre-configured team, clubs & events into active stores
 */
export function switchActiveTenure(targetTenureId: string): void {
  if (typeof window === "undefined") return;
  const tenures = getStoredTenures();
  
  // 1. Snapshot current active data into currently active tenure record
  const currentActiveTeam = getStoredCouncilMembers();
  const currentActiveHosting = getStoredHostingCommittee();
  const currentActiveFounders = getStoredFoundingMembers();
  const currentActiveClubs = getStoredClubs();
  const currentActiveEvents = getStoredEvents();

  const updatedTenures = tenures.map((tenure) => {
    if (tenure.isCurrent) {
      return {
        ...tenure,
        isCurrent: false,
        adminCouncil: currentActiveTeam,
        hostingCommittee: currentActiveHosting,
        foundingMembers: currentActiveFounders,
        clubs: currentActiveClubs,
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

  // 3. Load target tenure's pre-configured team, clubs and events into current active memory
  if (targetTenure.adminCouncil && Array.isArray(targetTenure.adminCouncil)) {
    saveStoredCouncilMembers(targetTenure.adminCouncil);
  }
  if (targetTenure.hostingCommittee && Array.isArray(targetTenure.hostingCommittee)) {
    saveStoredHostingCommittee(targetTenure.hostingCommittee);
  }
  if (targetTenure.foundingMembers && Array.isArray(targetTenure.foundingMembers) && targetTenure.foundingMembers.length > 0) {
    saveStoredFoundingMembers(targetTenure.foundingMembers);
  }
  if (targetTenure.clubs && Array.isArray(targetTenure.clubs)) {
    saveStoredClubs(targetTenure.clubs);
  }
  if (targetTenure.events && Array.isArray(targetTenure.events)) {
    saveStoredEvents(targetTenure.events);
  }

  window.dispatchEvent(new CustomEvent("src_tenure_changed", { detail: targetTenure }));
  window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: updatedTenures }));
}

/**
 * Create a new draft tenure (e.g. "2026-27") for pre-configuring teams without immediately activating it
 */
export function createNewDraftTenure(
  label: string, 
  academicYear: string, 
  theme: string, 
  startWithTemplateTeam: boolean = true
): CouncilTenure {
  const tenures = getStoredTenures();

  const tenureCount = tenures.length + 1;
  const tenureNumber = `${tenureCount}${getOrdinalSuffix(tenureCount)} Tenure`;

  // Create fresh pre-configured roster template for new tenure
  const newAdminCouncil: TeamMember[] = startWithTemplateTeam 
    ? [
        {
          id: `admin-${Date.now()}-1`,
          name: "Mentor (Appointee)",
          role: "Mentor",
          department: "Computer Science and Engineering",
          year: "4th Year",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
          bio: `Guiding ${label} institutional oversight and council governance.`,
          email: "mentor@jdcoem.ac.in",
          order: 1
        },
        {
          id: `admin-${Date.now()}-2`,
          name: "President (Appointee)",
          role: "President",
          department: "Artificial Intelligence Engineering",
          year: "4th Year",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
          bio: `Presiding over the ${label} Student Representative Council.`,
          email: "president@jdcoem.ac.in",
          order: 2
        },
        {
          id: `admin-${Date.now()}-3`,
          name: "Vice President (Appointee)",
          role: "Vice President",
          department: "Information Technology",
          year: "4th Year",
          avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
          bio: `Executive coordination and student council operations for ${label}.`,
          email: "vp@jdcoem.ac.in",
          order: 3
        }
      ]
    : [];

  const deterministicId = `tenure-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  const draftTenure: CouncilTenure = {
    id: deterministicId,
    label,
    academicYear,
    tenureNumber,
    theme,
    isCurrent: false, // Remains in draft / upcoming status
    adminCouncil: newAdminCouncil,
    hostingCommittee: [],
    foundingMembers: [],
    clubs: mockClubs,
    events: [],
    archiveNotes: `Pre-configured roster for upcoming session ${academicYear}.`,
    createdAt: new Date().toISOString()
  };

  const existingIdx = tenures.findIndex((t) => t.id === deterministicId || t.label.trim().toLowerCase() === label.trim().toLowerCase());
  let finalTenures: CouncilTenure[];
  if (existingIdx >= 0) {
    finalTenures = [...tenures];
    finalTenures[existingIdx] = {
      ...finalTenures[existingIdx],
      academicYear,
      theme,
      adminCouncil: finalTenures[existingIdx].adminCouncil && finalTenures[existingIdx].adminCouncil.length > 0 
        ? finalTenures[existingIdx].adminCouncil 
        : newAdminCouncil,
    };
  } else {
    finalTenures = [...tenures, draftTenure];
  }

  saveStoredTenures(finalTenures);
  return existingIdx >= 0 ? finalTenures[existingIdx] : draftTenure;
}

/**
 * Create a new tenure and activate it immediately
 */
export function createAndActivateNewTenure(
  label: string, 
  academicYear: string, 
  theme: string, 
  startWithTemplateTeam: boolean = true
): CouncilTenure {
  const draft = createNewDraftTenure(label, academicYear, theme, startWithTemplateTeam);
  switchActiveTenure(draft.id);
  return draft;
}

export async function syncTenuresFromFirestore(): Promise<CouncilTenure[]> {
  try {
    if (hasPendingWritesFor("council_tenures")) return getStoredTenures();
    const remote = await getSiteContentFromFirestore<CouncilTenure[]>("council_tenures");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const filtered = remote.filter((t: CouncilTenure) => t.id !== "tenure-2024-25" && !t.label.includes("2024"));
      const current = getStoredTenures();
      const merged = reconcileArrayDatasets(current, filtered);
      
      // CRITICAL: Ensure all standard default tenures are present
      for (const def of initialDefaultTenures) {
        if (!merged.some((m: CouncilTenure) => m.id === def.id || m.label === def.label)) {
          merged.push(def);
        }
      }
      
      // CRITICAL: Ensure locally-created draft tenures are NEVER dropped during sync
      const localDrafts = current.filter((t) => !t.isCurrent);
      for (const draft of localDrafts) {
        if (!merged.some((m: any) => m.id === draft.id || m.label === draft.label)) {
          merged.push(draft);
        }
      }
      
      if (typeof window !== "undefined") {
        localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: merged }));
      }
      return getStoredTenures();
    }
  } catch (e) {
    console.warn("Could not sync tenures from Firestore", e);
  }
  return getStoredTenures();
}

export function subscribeToTenures(callback: (tenures: CouncilTenure[]) => void): () => void {
  return subscribeToSiteContent<CouncilTenure[]>("council_tenures", (remote) => {
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      if (hasPendingWritesFor("council_tenures")) return;
      const filtered = remote.filter((t: CouncilTenure) => t.id !== "tenure-2024-25" && !t.label.includes("2024"));
      const current = getStoredTenures();
      const merged = reconcileArrayDatasets(current, filtered);
      
      // CRITICAL: Ensure all standard default tenures are present
      for (const def of initialDefaultTenures) {
        if (!merged.some((m: CouncilTenure) => m.id === def.id || m.label === def.label)) {
          merged.push(def);
        }
      }

      // CRITICAL: Preserve locally-created draft tenures during realtime sync
      const localDrafts = current.filter((t) => !t.isCurrent);
      for (const draft of localDrafts) {
        if (!merged.some((m: any) => m.id === draft.id || m.label === draft.label)) {
          merged.push(draft);
        }
      }
      
      if (typeof window !== "undefined") {
        localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: merged }));
      }
      callback(getStoredTenures());
    }
  });
}
