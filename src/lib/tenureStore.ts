import { TeamMember, EventItem, ClubItem, ClubLeader } from "@/types";
import { adminCouncilMembers, hostingCommitteeMembers, foundingMembers } from "@/data/team";
import { mockClubs } from "@/data/clubs";
import { 
  getStoredCouncilMembers, 
  saveStoredCouncilMembers,
  getStoredHostingCommittee,
  saveStoredHostingCommittee,
  getStoredFoundingMembers,
  saveStoredFoundingMembers,
  getStoredClubs,
  saveStoredClubs,
  stripCategoryAndLevel,
  hydrateClubAvatars
} from "./councilStore";
import { getStoredEvents, saveStoredEvents } from "./eventsStore";
import { 
  getSiteContentFromFirestore, 
  saveSiteContentToFirestore,
  subscribeToSiteContent,
  cleanUndefined
} from "./firebase/firestore";
import { 
  enqueueCloudWrite, 
  reconcileArrayDatasets, 
  hasPendingWritesFor, 
  markLocalWrite, 
  isLocalWriteRecent,
  getLastLocalWriteTime,
  MAX_SAFE_BASE64_LENGTH
} from "./dataSyncEngine";

export interface CouncilTenure {
  id: string;
  label: string; // e.g. "2025-26", "2026-27"
  academicYear: string; // e.g. "2025 - 2026"
  tenureNumber: string; // e.g. "1st Tenure", "2nd Tenure"
  theme?: string;
  isCurrent: boolean;
  isDraft?: boolean;
  status?: "active" | "archived" | "draft";
  startDate?: string; // Date when tenure begins / began (ISO string or YYYY-MM-DD)
  endDate?: string;   // Date when tenure ended / was archived (ISO string or YYYY-MM-DD)
  previousTenureId?: string; // ID of tenure active prior to activation (enables Undo)
  activatedFromDraft?: boolean; // True if this tenure was activated from draft mode
  adminCouncil: TeamMember[];
  hostingCommittee: TeamMember[];
  foundingMembers?: TeamMember[];
  clubs?: ClubItem[];
  events: EventItem[];
  archiveNotes?: string;
  createdAt: string;
}

const TENURES_STORAGE_KEY = "src_council_tenures";
export const DRAFT_COUNCIL_PREFIX = "src_draft_council_";
export const DRAFT_HOSTING_PREFIX = "src_draft_hosting_";

export function getStoredDraftCouncil(tenureId: string): TeamMember[] {
  if (typeof window === "undefined" || !tenureId) return [];
  try {
    const raw = localStorage.getItem(`${DRAFT_COUNCIL_PREFIX}${tenureId}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Could not read draft council from storage", e);
  }
  return [];
}

export async function saveStoredDraftCouncil(tenureId: string, members: TeamMember[]): Promise<void> {
  if (typeof window === "undefined" || !tenureId) return;
  try {
    const sanitized = cleanUndefined(members);
    try {
      localStorage.setItem(`${DRAFT_COUNCIL_PREFIX}${tenureId}`, JSON.stringify(sanitized));
    } catch (lsErr) {
      console.warn("Direct localStorage write notice for draft council:", lsErr);
    }
    window.dispatchEvent(new CustomEvent("src_draft_roster_updated", { detail: { tenureId, members: sanitized } }));
    window.dispatchEvent(new CustomEvent("src_tenures_updated"));
    
    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore(`draft_council_${tenureId}`, sanitized);
    } catch (err) {
      console.warn(`Firestore direct write for draft council (${tenureId}) failed, enqueuing:`, err);
      cloudWriteError = err;
    }
    enqueueCloudWrite(`draft_council_${tenureId}`, sanitized, `Draft Council Roster (${tenureId})`);

    if (cloudWriteError) {
      throw cloudWriteError;
    }
  } catch (e) {
    console.error("Could not save draft council to storage", e);
    throw e;
  }
}

export async function syncDraftCouncilFromFirestore(tenureId: string): Promise<TeamMember[] | null> {
  if (!tenureId) return null;
  try {
    if (hasPendingWritesFor(`draft_council_${tenureId}`)) return getStoredDraftCouncil(tenureId);
    const remote = await getSiteContentFromFirestore<TeamMember[]>(`draft_council_${tenureId}`);
    if (remote !== null && Array.isArray(remote)) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`${DRAFT_COUNCIL_PREFIX}${tenureId}`, JSON.stringify(remote));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_draft_roster_updated", { detail: { tenureId, members: remote } }));
        window.dispatchEvent(new CustomEvent("src_tenures_updated"));
      }
      return remote;
    }
  } catch (e) {
    console.warn(`Could not sync draft council for ${tenureId}:`, e);
  }
  return null;
}

export function getStoredDraftHosting(tenureId: string): TeamMember[] {
  if (typeof window === "undefined" || !tenureId) return [];
  try {
    const raw = localStorage.getItem(`${DRAFT_HOSTING_PREFIX}${tenureId}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Could not read draft hosting from storage", e);
  }
  return [];
}

export async function saveStoredDraftHosting(tenureId: string, members: TeamMember[]): Promise<void> {
  if (typeof window === "undefined" || !tenureId) return;
  try {
    const sanitized = cleanUndefined(members);
    try {
      localStorage.setItem(`${DRAFT_HOSTING_PREFIX}${tenureId}`, JSON.stringify(sanitized));
    } catch (lsErr) {
      console.warn("Direct localStorage write notice for draft hosting:", lsErr);
    }
    window.dispatchEvent(new CustomEvent("src_draft_roster_updated", { detail: { tenureId, members: sanitized } }));
    window.dispatchEvent(new CustomEvent("src_tenures_updated"));
    
    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore(`draft_hosting_${tenureId}`, sanitized);
    } catch (err) {
      console.warn(`Firestore direct write for draft hosting (${tenureId}) failed, enqueuing:`, err);
      cloudWriteError = err;
    }
    enqueueCloudWrite(`draft_hosting_${tenureId}`, sanitized, `Draft Hosting Roster (${tenureId})`);

    if (cloudWriteError) {
      throw cloudWriteError;
    }
  } catch (e) {
    console.error("Could not save draft hosting to storage", e);
    throw e;
  }
}

export async function syncDraftHostingFromFirestore(tenureId: string): Promise<TeamMember[] | null> {
  if (!tenureId) return null;
  try {
    if (hasPendingWritesFor(`draft_hosting_${tenureId}`)) return getStoredDraftHosting(tenureId);
    const remote = await getSiteContentFromFirestore<TeamMember[]>(`draft_hosting_${tenureId}`);
    if (remote !== null && Array.isArray(remote)) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`${DRAFT_HOSTING_PREFIX}${tenureId}`, JSON.stringify(remote));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_draft_roster_updated", { detail: { tenureId, members: remote } }));
        window.dispatchEvent(new CustomEvent("src_tenures_updated"));
      }
      return remote;
    }
  } catch (e) {
    console.warn(`Could not sync draft hosting for ${tenureId}:`, e);
  }
  return null;
}

export const DRAFT_CLUBS_PREFIX = "src_draft_clubs_";

export function getStoredDraftClubs(tenureId: string): ClubItem[] {
  if (typeof window === "undefined" || !tenureId) return [];
  try {
    const raw = localStorage.getItem(`${DRAFT_CLUBS_PREFIX}${tenureId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Could not read draft clubs from storage", e);
  }
  return [];
}

export async function saveStoredDraftClubs(tenureId: string, clubs: ClubItem[]): Promise<void> {
  if (typeof window === "undefined" || !tenureId) return;
  try {
    const sanitized = cleanUndefined(clubs);
    try {
      localStorage.setItem(`${DRAFT_CLUBS_PREFIX}${tenureId}`, JSON.stringify(sanitized));
    } catch (lsErr) {
      console.warn("Direct localStorage write notice for draft clubs:", lsErr);
    }
    window.dispatchEvent(new CustomEvent("src_draft_clubs_updated", { detail: { tenureId, clubs: sanitized } }));
    window.dispatchEvent(new CustomEvent("src_tenures_updated"));
    
    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore(`draft_clubs_${tenureId}`, sanitized);
    } catch (err) {
      console.warn(`Firestore direct write for draft clubs (${tenureId}) failed, enqueuing:`, err);
      cloudWriteError = err;
    }
    enqueueCloudWrite(`draft_clubs_${tenureId}`, sanitized, `Draft Clubs Roster (${tenureId})`);

    if (cloudWriteError) {
      throw cloudWriteError;
    }
  } catch (e) {
    console.error("Could not save draft clubs to storage", e);
    throw e;
  }
}

export async function syncDraftClubsFromFirestore(tenureId: string): Promise<ClubItem[] | null> {
  if (!tenureId) return null;
  try {
    if (hasPendingWritesFor(`draft_clubs_${tenureId}`)) return getStoredDraftClubs(tenureId);
    const remote = await getSiteContentFromFirestore<ClubItem[]>(`draft_clubs_${tenureId}`);
    if (remote !== null && Array.isArray(remote)) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`${DRAFT_CLUBS_PREFIX}${tenureId}`, JSON.stringify(remote));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_draft_clubs_updated", { detail: { tenureId, clubs: remote } }));
        window.dispatchEvent(new CustomEvent("src_tenures_updated"));
      }
      return remote;
    }
  } catch (e) {
    console.warn(`Could not sync draft clubs for ${tenureId}:`, e);
  }
  return null;
}

export const initialDefaultTenures: CouncilTenure[] = [
  {
    id: "tenure-2025-26",
    label: "2025-26",
    academicYear: "2025 - 2026",
    tenureNumber: "1st Tenure",
    isCurrent: true,
    isDraft: false,
    status: "active",
    startDate: "2025-09-24T00:00:00Z",
    adminCouncil: adminCouncilMembers,
    hostingCommittee: hostingCommitteeMembers,
    foundingMembers: foundingMembers,
    clubs: mockClubs,
    events: [],
    archiveNotes: "The 1st & Founding Tenure of Sahastradeep, uniting all 12 collegiate societies at JDCOEM under one central autonomous student council constitution.",
    createdAt: "2025-09-24T00:00:00Z"
  },
  {
    id: "tenure-2026-27",
    label: "2026-27",
    academicYear: "2026 - 2027",
    tenureNumber: "2nd Tenure",
    isCurrent: false,
    isDraft: true,
    status: "draft",
    adminCouncil: [],
    hostingCommittee: [],
    foundingMembers: [],
    clubs: [],
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
        isDraft: false,
        status: "active" as const,
        startDate: t.startDate || "2025-09-24T00:00:00Z",
        tenureNumber: tenureNum,
        adminCouncil: stripCategoryAndLevel(activeAdmins),
        hostingCommittee: stripCategoryAndLevel(activeHosting),
        foundingMembers: stripCategoryAndLevel(isFirstTenure ? activeFounders : []),
        clubs: activeClubs,
        events: activeEvents,
      };
    }

    // For draft / upcoming / past tenures: check dedicated draft store or remote tenure roster
    const rawStoredCouncil = typeof window !== "undefined" ? localStorage.getItem(`${DRAFT_COUNCIL_PREFIX}${t.id}`) : null;
    const rawStoredHosting = typeof window !== "undefined" ? localStorage.getItem(`${DRAFT_HOSTING_PREFIX}${t.id}`) : null;
    const rawStoredClubs = typeof window !== "undefined" ? localStorage.getItem(`${DRAFT_CLUBS_PREFIX}${t.id}`) : null;

    let resolvedCouncil: TeamMember[] = [];
    if (rawStoredCouncil !== null) {
      try {
        const parsed = JSON.parse(rawStoredCouncil);
        if (Array.isArray(parsed)) resolvedCouncil = stripCategoryAndLevel(parsed);
      } catch {}
    } else if (Array.isArray(t.adminCouncil)) {
      resolvedCouncil = stripCategoryAndLevel(t.adminCouncil);
    } else if (isFirstTenure) {
      resolvedCouncil = stripCategoryAndLevel(adminCouncilMembers);
    }

    let resolvedHosting: TeamMember[] = [];
    if (rawStoredHosting !== null) {
      try {
        const parsed = JSON.parse(rawStoredHosting);
        if (Array.isArray(parsed)) resolvedHosting = stripCategoryAndLevel(parsed);
      } catch {}
    } else if (Array.isArray(t.hostingCommittee)) {
      resolvedHosting = stripCategoryAndLevel(t.hostingCommittee);
    }

    let resolvedClubs: ClubItem[] = [];
    if (rawStoredClubs !== null) {
      try {
        const parsed = JSON.parse(rawStoredClubs);
        if (Array.isArray(parsed)) resolvedClubs = parsed;
      } catch {}
    } else if (Array.isArray(t.clubs)) {
      resolvedClubs = t.clubs;
    } else {
      resolvedClubs = activeClubs;
    }

    // Determine if it's a draft or an archived past session:
    // If it has never been marked as live, has no startDate, or explicitly has isDraft / status === "draft"
    const isDraft = t.isDraft !== undefined
      ? t.isDraft
      : (t.status === "draft" || (!t.startDate && t.id !== "tenure-2025-26" && !t.label.includes("2025")));

    let resolvedFounders = stripCategoryAndLevel(isFirstTenure ? (t.foundingMembers || activeFounders) : []);

    const cleanEvents = Array.isArray(t.events) ? t.events : [];

    return {
      ...t,
      isDraft,
      status: isDraft ? ("draft" as const) : ("archived" as const),
      tenureNumber: tenureNum,
      adminCouncil: resolvedCouncil,
      hostingCommittee: resolvedHosting,
      foundingMembers: resolvedFounders,
      clubs: hydrateClubAvatars(resolvedClubs),
      events: cleanEvents,
    };
  });
}

/**
 * Public tenures: strictly excludes draft/pre-configured sessions.
 * Returns only currently active tenure and past archived tenures.
 */
export function getPublicTenures(): CouncilTenure[] {
  const all = getStoredTenures();
  return all.filter((t) => !t.isDraft && (t.isCurrent || t.status === "active" || t.status === "archived"));
}

export function compactTenureForStorage(tenure: CouncilTenure): CouncilTenure {
  if (tenure.isCurrent) {
    // For the current live tenure, strip redundant base64 data URLs from nested arrays.
    // The canonical high-res media lives authoritatively in council_team, hosting_committee,
    // clubs (with club_leaders_{slug}), and events!
    // This keeps the council_tenures document ~40-60 KB instead of 2.5 MB!
    const stripMemberDataUrls = (members?: TeamMember[]): TeamMember[] => {
      if (!Array.isArray(members)) return [];
      return members.map((m) => ({
        ...m,
        avatar: m.avatar && m.avatar.startsWith("data:") ? "" : m.avatar,
      }));
    };

    const stripClubDataUrls = (clubs?: ClubItem[]): ClubItem[] => {
      if (!Array.isArray(clubs)) return [];
      return clubs.map((c) => ({
        ...c,
        logoImage: c.logoImage && c.logoImage.startsWith("data:") ? "" : c.logoImage,
        cardImage: c.cardImage && c.cardImage.startsWith("data:") ? "" : c.cardImage,
        headerImage: c.headerImage && c.headerImage.startsWith("data:") ? "" : c.headerImage,
        lead: c.lead ? { ...c.lead, avatar: c.lead.avatar && c.lead.avatar.startsWith("data:") ? "" : c.lead.avatar } : undefined,
        coLead: c.coLead ? { ...c.coLead, avatar: c.coLead.avatar && c.coLead.avatar.startsWith("data:") ? "" : c.coLead.avatar } : undefined,
        coLeads: Array.isArray(c.coLeads) ? c.coLeads.map((cl) => ({ ...cl, avatar: cl.avatar && cl.avatar.startsWith("data:") ? "" : cl.avatar })) : undefined,
        leaders: Array.isArray(c.leaders) ? c.leaders.map((l) => ({ ...l, avatar: l.avatar && l.avatar.startsWith("data:") ? "" : l.avatar })) : undefined,
      }));
    };

    const stripEventDataUrls = (events?: EventItem[]): EventItem[] => {
      if (!Array.isArray(events)) return [];
      return events.map((e) => ({
        ...e,
        poster: e.poster && e.poster.startsWith("data:") ? "" : e.poster,
        posterImage: e.posterImage && e.posterImage.startsWith("data:") ? "" : e.posterImage,
        cardImage: e.cardImage && e.cardImage.startsWith("data:") ? "" : e.cardImage,
        headerImage: e.headerImage && e.headerImage.startsWith("data:") ? "" : e.headerImage,
      }));
    };

    return {
      ...tenure,
      adminCouncil: stripMemberDataUrls(tenure.adminCouncil),
      hostingCommittee: stripMemberDataUrls(tenure.hostingCommittee),
      foundingMembers: stripMemberDataUrls(tenure.foundingMembers),
      clubs: stripClubDataUrls(tenure.clubs),
      events: stripEventDataUrls(tenure.events),
    };
  }

  // For archived past tenures or pre-configured draft sessions, preserve the actual images
  // without destructive arbitrary length truncations!
  return tenure;
}

export async function saveStoredTenures(tenures: CouncilTenure[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const compactedTenures = tenures.map(compactTenureForStorage);
    const sanitized = cleanUndefined(compactedTenures);
    markLocalWrite("council_tenures");
    try {
      localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(sanitized));
    } catch (lsErr) {
      console.warn("Direct localStorage write notice for tenures, auto-compacting...", lsErr);
      // Strip heavy presentation media from clubs and events, but NEVER wipe adminCouncil, hosting, or founders!
      const minimalist = sanitized.map((t: any) => ({
        ...t,
        clubs: [],
        events: [],
        adminCouncil: t.adminCouncil || [],
        hostingCommittee: t.hostingCommittee || [],
        foundingMembers: t.foundingMembers || []
      }));
      try {
        localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(minimalist));
      } catch {}
    }
    window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: sanitized }));

    // Direct cloud write & queue backup immediately (Directive #3)
    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore("council_tenures", sanitized);
    } catch (err) {
      console.warn("Firestore direct write for tenures failed, enqueuing:", err);
      cloudWriteError = err;
    }
    enqueueCloudWrite("council_tenures", sanitized, `Council Tenures (${tenures.length} Tenures)`);

    if (cloudWriteError) {
      const errMsg = cloudWriteError?.message || String(cloudWriteError);
      if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
        throw new Error("Admin session expired. Please refresh the page and sign in again.");
      }
    }
  } catch (e) {
    console.error("Could not save tenures to storage", e);
    throw e;
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
  },
  skipActiveStoreSync = false
): void {
  if (typeof window === "undefined") return;
  const tenures = getStoredTenures();
  const target = tenures.find((t) => t.id === tenureId);
  if (!target) return;

  const isCurrentActive = target.isCurrent;

  // If this is the currently active tenure, also update the live active stores unless skipped
  if (isCurrentActive && !skipActiveStoreSync) {
    if (updates.adminCouncil) saveStoredCouncilMembers(updates.adminCouncil);
    if (updates.hostingCommittee) saveStoredHostingCommittee(updates.hostingCommittee);
    if (updates.foundingMembers) saveStoredFoundingMembers(updates.foundingMembers);
    if (updates.clubs) saveStoredClubs(updates.clubs);
    if (updates.events) saveStoredEvents(updates.events);
  } else if (!isCurrentActive) {
    // Draft tenure: save to dedicated draft stores immediately!
    if (updates.adminCouncil) saveStoredDraftCouncil(tenureId, updates.adminCouncil);
    if (updates.hostingCommittee) saveStoredDraftHosting(tenureId, updates.hostingCommittee);
    if (updates.clubs) saveStoredDraftClubs(tenureId, updates.clubs);
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
 * 2. Activates target tenure, recording begin date and removing draft status
 * 3. Restores target tenure's pre-configured team, clubs & events into active stores
 */
export async function switchActiveTenure(targetTenureId: string, tenureBeginDate?: string): Promise<void> {
  if (typeof window === "undefined") return;
  const tenures = getStoredTenures();
  
  const beginIso = tenureBeginDate 
    ? new Date(tenureBeginDate).toISOString() 
    : new Date().toISOString();
  const endIso = new Date().toISOString();

  // Find currently active tenure to know its ID and preserve for Undo capability
  const currentlyActive = tenures.find((t) => t.isCurrent);
  const targetOriginal = tenures.find((t) => t.id === targetTenureId);
  const wasDraft = targetOriginal ? (targetOriginal.isDraft || targetOriginal.status === "draft") : false;

  // 1. Snapshot current active data into currently active tenure record and mark as archived
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
        isDraft: false,
        status: "archived" as const,
        endDate: tenure.endDate || endIso,
        adminCouncil: currentActiveTeam,
        hostingCommittee: currentActiveHosting,
        foundingMembers: currentActiveFounders,
        clubs: currentActiveClubs,
        events: currentActiveEvents,
      };
    }
    return tenure;
  });

  // 2. Set target tenure as current and mark as live (no longer draft)
  const targetTenure = updatedTenures.find((t) => t.id === targetTenureId);
  if (!targetTenure) return;

  targetTenure.isCurrent = true;
  targetTenure.isDraft = false;
  targetTenure.status = "active";
  targetTenure.startDate = beginIso;
  if (wasDraft && currentlyActive) {
    targetTenure.previousTenureId = currentlyActive.id;
    targetTenure.activatedFromDraft = true;
  }

  await saveStoredTenures(updatedTenures);

  // 3. Load target tenure's pre-configured team, clubs and events into current active memory
  const draftCouncil = getStoredDraftCouncil(targetTenureId);
  const targetCouncil = (Array.isArray(targetTenure.adminCouncil) && targetTenure.adminCouncil.length > 0)
    ? targetTenure.adminCouncil
    : draftCouncil;
  if (Array.isArray(targetCouncil) && targetCouncil.length > 0) {
    await saveStoredCouncilMembers(targetCouncil);
  }
  const draftHosting = getStoredDraftHosting(targetTenureId);
  const targetHosting = (Array.isArray(targetTenure.hostingCommittee) && targetTenure.hostingCommittee.length > 0)
    ? targetTenure.hostingCommittee
    : draftHosting;
  if (Array.isArray(targetHosting) && targetHosting.length > 0) {
    await saveStoredHostingCommittee(targetHosting);
  }
  if (targetTenure.foundingMembers && Array.isArray(targetTenure.foundingMembers) && targetTenure.foundingMembers.length > 0) {
    await saveStoredFoundingMembers(targetTenure.foundingMembers);
  }
  const draftClubs = getStoredDraftClubs(targetTenureId);
  const targetClubs = (Array.isArray(targetTenure.clubs) && targetTenure.clubs.length > 0)
    ? targetTenure.clubs
    : draftClubs;
  if (Array.isArray(targetClubs) && targetClubs.length > 0) {
    await saveStoredClubs(targetClubs);
  }

  window.dispatchEvent(new CustomEvent("src_tenure_changed", { detail: targetTenure }));
  window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: updatedTenures }));
}

/**
 * Determines whether a tenure can be undone / reverted back into draft mode.
 * A tenure can be undone if:
 * 1. It is currently active.
 * 2. It was activated from draft (or has a previous tenure to revert to).
 * 3. It is not the root founding tenure without prior tenure.
 */
export function canUndoTenure(tenure?: CouncilTenure | null, allTenures?: CouncilTenure[]): boolean {
  if (!tenure || !tenure.isCurrent) return false;
  const list = allTenures && allTenures.length > 0 ? allTenures : getStoredTenures();
  // If explicitly flagged as activated from draft or has previousTenureId
  if (tenure.activatedFromDraft || tenure.previousTenureId) return true;
  // Any active tenure other than the founding 2025-26 session can be undone back to draft
  if (tenure.id !== "tenure-2025-26" && !tenure.label.includes("2025")) {
    return list.some((t) => t.id !== tenure.id);
  }
  return false;
}

/**
 * Undo Tenure Activation:
 * Reverts the currently activated tenure back to DRAFT mode and restores the previous tenure to ACTIVE status.
 * 1. Stashes any updates made during active time back into draft stores so no work is lost.
 * 2. Sets target tenure to isCurrent: false, isDraft: true, status: "draft".
 * 3. Restores previous tenure to isCurrent: true, isDraft: false, status: "active", endDate: undefined.
 * 4. Loads previous tenure's snapshot into active council, hosting, founders, clubs, and events stores.
 * 5. Dual writes to localStorage and direct Firestore with atomic queue backup, dispatching sync events.
 */
export async function undoActiveTenure(targetTenureId?: string): Promise<{ 
  success: boolean; 
  revertedToTenure?: CouncilTenure; 
  error?: string 
}> {
  if (typeof window === "undefined") return { success: false, error: "Window is undefined" };
  const tenures = getStoredTenures();

  // Find the active tenure to undo
  const activeTenure = targetTenureId 
    ? tenures.find((t) => t.id === targetTenureId)
    : tenures.find((t) => t.isCurrent);

  if (!activeTenure || !activeTenure.isCurrent) {
    return { success: false, error: "No currently active tenure found to undo." };
  }

  // Find the previous tenure to restore
  let previousTenure: CouncilTenure | undefined;
  if (activeTenure.previousTenureId) {
    previousTenure = tenures.find((t) => t.id === activeTenure.previousTenureId);
  }
  if (!previousTenure) {
    // Fallback: find the most recent archived tenure, or tenure-2025-26
    previousTenure = tenures.find((t) => t.id !== activeTenure.id && t.status === "archived")
      || tenures.find((t) => t.id === "tenure-2025-26")
      || tenures.find((t) => t.id !== activeTenure.id && !t.isDraft);
  }

  if (!previousTenure) {
    return { success: false, error: "No previous tenure record found to restore." };
  }

  // 1. Snapshot current active data into draft stores for the tenure being undone
  const currentActiveTeam = getStoredCouncilMembers();
  const currentActiveHosting = getStoredHostingCommittee();
  const currentActiveClubs = getStoredClubs();
  const currentActiveEvents = getStoredEvents();

  // Save to dedicated draft store for the undone tenure so all edits remain safely preserved
  try {
    await saveStoredDraftCouncil(activeTenure.id, currentActiveTeam);
  } catch (e) {
    console.warn("Could not stash draft council during undo", e);
  }
  try {
    await saveStoredDraftHosting(activeTenure.id, currentActiveHosting);
  } catch (e) {
    console.warn("Could not stash draft hosting during undo", e);
  }
  try {
    await saveStoredDraftClubs(activeTenure.id, currentActiveClubs);
  } catch (e) {
    console.warn("Could not stash draft clubs during undo", e);
  }

  // 2. Update tenures array
  const updatedTenures = tenures.map((tenure) => {
    if (tenure.id === activeTenure.id) {
      return {
        ...tenure,
        isCurrent: false,
        isDraft: true,
        status: "draft" as const,
        startDate: undefined,
        activatedFromDraft: false,
        previousTenureId: undefined,
        adminCouncil: currentActiveTeam,
        hostingCommittee: currentActiveHosting,
        clubs: currentActiveClubs,
        events: currentActiveEvents,
      };
    }
    if (tenure.id === previousTenure!.id) {
      return {
        ...tenure,
        isCurrent: true,
        isDraft: false,
        status: "active" as const,
        endDate: undefined,
      };
    }
    return tenure;
  });

  // 3. Restore previous tenure's snapshot into live active stores
  const isFirstTenure = previousTenure.id === "tenure-2025-26" || previousTenure.label.includes("2025");
  let councilToRestore = (Array.isArray(previousTenure.adminCouncil) && previousTenure.adminCouncil.length > 0)
    ? previousTenure.adminCouncil
    : (isFirstTenure ? adminCouncilMembers : []);

  if (councilToRestore.length > 0) {
    await saveStoredCouncilMembers(councilToRestore);
  }

  if (Array.isArray(previousTenure.hostingCommittee) && previousTenure.hostingCommittee.length > 0) {
    await saveStoredHostingCommittee(previousTenure.hostingCommittee);
  }

  let foundersToRestore = (Array.isArray(previousTenure.foundingMembers) && previousTenure.foundingMembers.length > 0)
    ? previousTenure.foundingMembers
    : (isFirstTenure ? foundingMembers : []);
  if (foundersToRestore.length > 0) {
    await saveStoredFoundingMembers(foundersToRestore);
  }

  if (Array.isArray(previousTenure.clubs) && previousTenure.clubs.length > 0) {
    await saveStoredClubs(previousTenure.clubs);
  }
  // NOTE: Never overwrite live events store with an old snapshot during undo. Events are independent.

  // 4. Save updated tenures to storage and Firestore
  await saveStoredTenures(updatedTenures);

  // 5. Broadcast updates
  window.dispatchEvent(new CustomEvent("src_tenure_changed", { detail: previousTenure }));
  window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: updatedTenures }));
  window.dispatchEvent(new CustomEvent("src_council_team_updated"));
  window.dispatchEvent(new CustomEvent("src_hosting_updated"));
  window.dispatchEvent(new CustomEvent("src_founding_members_updated"));
  window.dispatchEvent(new CustomEvent("src_clubs_updated"));
  window.dispatchEvent(new CustomEvent("src_events_updated"));

  return { success: true, revertedToTenure: previousTenure };
}

/**
 * Create a new draft tenure (e.g. "2026-27") for pre-configuring teams without immediately activating it
 */
export function createNewDraftTenure(
  label: string, 
  academicYear: string, 
  theme?: string, 
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
          avatar: "",
          bio: "",
          email: "mentor@jdcoem.ac.in",
          order: 1
        },
        {
          id: `admin-${Date.now()}-2`,
          name: "President (Appointee)",
          role: "President",
          department: "Artificial Intelligence Engineering",
          year: "4th Year",
          avatar: "",
          bio: "",
          email: "president@jdcoem.ac.in",
          order: 2
        },
        {
          id: `admin-${Date.now()}-3`,
          name: "Vice President (Appointee)",
          role: "Vice President",
          department: "Information Technology",
          year: "4th Year",
          avatar: "",
          bio: "",
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
    theme: theme || undefined,
    isCurrent: false, // Remains in draft / upcoming status
    isDraft: true,
    status: "draft",
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
      theme: theme || finalTenures[existingIdx].theme,
      isDraft: finalTenures[existingIdx].isCurrent ? false : true,
      status: finalTenures[existingIdx].isCurrent ? "active" : "draft",
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
  theme?: string, 
  startWithTemplateTeam: boolean = true
): CouncilTenure {
  const draft = createNewDraftTenure(label, academicYear, theme, startWithTemplateTeam);
  switchActiveTenure(draft.id);
  return draft;
}

export async function syncTenuresFromFirestore(): Promise<CouncilTenure[]> {
  try {
    const requestTime = Date.now();
    if (hasPendingWritesFor("council_tenures") || getLastLocalWriteTime("council_tenures") >= requestTime) {
      return getStoredTenures();
    }
    const remote = await getSiteContentFromFirestore<CouncilTenure[]>("council_tenures");
    if (hasPendingWritesFor("council_tenures") || getLastLocalWriteTime("council_tenures") >= requestTime) {
      return getStoredTenures();
    }
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
      
      // Directive #9: Remote Firestore is strictly authoritative for tenure contents & deletions.
      // Synchronize dedicated draft caches with remote tenure state when no local write is in-flight.
      const hasRecentTenureWrite = isLocalWriteRecent("council_tenures", 15000) || hasPendingWritesFor("council_tenures");
      if (!hasRecentTenureWrite && typeof window !== "undefined") {
        merged.forEach((tenure) => {
          if (!tenure.isCurrent) {
            try {
              localStorage.setItem(`${DRAFT_COUNCIL_PREFIX}${tenure.id}`, JSON.stringify(tenure.adminCouncil || []));
              localStorage.setItem(`${DRAFT_HOSTING_PREFIX}${tenure.id}`, JSON.stringify(tenure.hostingCommittee || []));
              if (tenure.clubs !== undefined && Array.isArray(tenure.clubs)) {
                localStorage.setItem(`${DRAFT_CLUBS_PREFIX}${tenure.id}`, JSON.stringify(tenure.clubs));
              }
            } catch {}
          }
        });
      }

      // Local drafts are kept for reconciliation, but never auto-written back to cloud on mount/sync.
      
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(merged));
        } catch {}
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

      // Directive #9: Remote Firestore is strictly authoritative for tenure contents & deletions.
      // Synchronize dedicated draft caches with remote tenure state when no local write is in-flight.
      const hasRecentTenureWrite = isLocalWriteRecent("council_tenures", 15000) || hasPendingWritesFor("council_tenures");
      if (!hasRecentTenureWrite && typeof window !== "undefined") {
        merged.forEach((tenure) => {
          if (!tenure.isCurrent) {
            try {
              localStorage.setItem(`${DRAFT_COUNCIL_PREFIX}${tenure.id}`, JSON.stringify(tenure.adminCouncil || []));
              localStorage.setItem(`${DRAFT_HOSTING_PREFIX}${tenure.id}`, JSON.stringify(tenure.hostingCommittee || []));
              if (tenure.clubs !== undefined && Array.isArray(tenure.clubs)) {
                localStorage.setItem(`${DRAFT_CLUBS_PREFIX}${tenure.id}`, JSON.stringify(tenure.clubs));
              }
            } catch {}
          }
        });
      }
      
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(TENURES_STORAGE_KEY, JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_tenures_updated", { detail: merged }));
      }
      callback(getStoredTenures());
    }
  });
}
