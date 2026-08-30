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
  label: string; // e.g. "2025-26", "2026-27", "2024-25"
  academicYear: string; // e.g. "2025 - 2026"
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
    theme: "Prarambh: The Genesis of Sahastradeep",
    isCurrent: true,
    adminCouncil: adminCouncilMembers,
    hostingCommittee: hostingCommitteeMembers,
    foundingMembers: foundingMembers,
    events: mockEvents,
    archiveNotes: "The inaugural chartered council of Sahastradeep, uniting 12 collegiate societies at JDCOEM under one central autonomous constitution.",
    createdAt: "2025-09-24T00:00:00Z"
  },
  {
    id: "tenure-2024-25",
    label: "2024-25",
    academicYear: "2024 - 2025",
    theme: "Foundational Assembly & Pre-Charter Committee",
    isCurrent: false,
    adminCouncil: [
      {
        id: "legacy-admin-1",
        name: "Devendra Verma",
        role: "Past President",
        level: "Presidency",
        category: "Admin Council",
        department: "Computer Science and Engineering",
        year: "Alumni / 2025 Batch",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop",
        bio: "Presided over the ad-hoc student representation committee prior to the formal chartering of Sahastradeep.",
        email: "alumni.devendra@jdcoem.ac.in",
        order: 1
      },
      {
        id: "legacy-admin-2",
        name: "Ritika Deshmukh",
        role: "Past General Secretary",
        level: "Secretariat",
        category: "Admin Council",
        department: "Information Technology",
        year: "Alumni / 2025 Batch",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop",
        bio: "Managed inter-departmental sports meet and collegiate technical symposia for 2024-25.",
        email: "alumni.ritika@jdcoem.ac.in",
        order: 2
      }
    ],
    hostingCommittee: [
      {
        id: "legacy-host-1",
        name: "Aditya Raut",
        role: "Head Anchor",
        level: "Hosting Committee",
        category: "Hosting Committee",
        department: "Mechanical Engineering",
        year: "Alumni / 2025 Batch",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=600&auto=format&fit=crop",
        bio: "Principal stage host for the 2024 annual cultural fest.",
        email: "alumni.aditya@jdcoem.ac.in",
        order: 1
      }
    ],
    foundingMembers: foundingMembers,
    events: [
      {
        id: "evt-legacy-2024-1",
        slug: "vibrance-2024",
        name: "Vibrance 2024 Annual Fest",
        category: "Fest",
        date: "22 February 2024",
        time: "10:00 AM - 09:00 PM",
        venue: "JDCOEM Main Campus Grounds",
        organizer: "SRC Pre-Charter Committee",
        status: "Completed",
        poster: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
        description: "The annual inter-college cultural extravaganza of JDCOEM featuring over 30 competitive showcases.",
        about: "The annual inter-college cultural extravaganza of JDCOEM featuring over 30 competitive showcases.",
        whatToExpect: ["Battle of the Bands", "Fashion Showcase", "Star Celebrity Night"],
        rules: ["Standard campus bylaws apply."],
        schedule: [
          { time: "10:00 AM", title: "Inauguration", description: "Campus kickoff", venue: "Main Grounds" }
        ],
        prizes: [
          { position: "Overall Champion Trophy", amount: "₹50,000", perks: ["Rolling Institutional Trophy"] }
        ],
        teamType: "Both",
        registrationDeadline: "Completed",
        entryFee: "Free"
      }
    ],
    archiveNotes: "Pre-charter institutional council session managing annual fests and department coordination.",
    createdAt: "2024-08-01T00:00:00Z"
  }
];

export function getStoredTenures(): CouncilTenure[] {
  if (typeof window === "undefined") return initialDefaultTenures;
  try {
    const stored = localStorage.getItem(TENURES_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
 * Switch Active Tenure (e.g. from 2025-26 to 2026-27 or back to 2024-25)
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

  const newTenure: CouncilTenure = {
    id: `tenure-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
    label,
    academicYear,
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
      if (typeof window !== "undefined") {
        localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(remote));
        window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: remote }));
      }
      return remote;
    }
  } catch (e) {
    console.warn("Could not sync tenures from Firestore", e);
  }
  return getStoredTenures();
}

export function subscribeToTenures(callback: (tenures: CouncilTenure[]) => void): () => void {
  return subscribeToSiteContent<CouncilTenure[]>("council_tenures", (remote) => {
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      if (typeof window !== "undefined") {
        localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(remote));
        window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: remote }));
      }
      callback(remote);
    }
  });
}
