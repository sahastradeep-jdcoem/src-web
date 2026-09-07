import { TeamMember, ClubItem, ClubLeader, InstitutionalPillar } from "@/types";
import { 
  adminCouncilMembers as initialAdminCouncil, 
  hostingCommitteeMembers as initialHosting, 
  spokespersonMembers as initialSpokespersons,
  foundingMembers as initialFoundingMembers,
  institutionalPillars as initialPillars
} from "@/data/team";
import { mockClubs as initialClubs } from "@/data/clubs";
import { 
  getSiteContentFromFirestore, 
  saveSiteContentToFirestore,
  subscribeToSiteContent,
  cleanUndefined
} from "./firebase/firestore";
import { enqueueCloudWrite, reconcileArrayDatasets, hasPendingWritesFor, compactClubDataset, compactCouncilDataset, compactPillarsDataset } from "./dataSyncEngine";

export function getClubLeaders(club: ClubItem): ClubLeader[] {
  if (!club) return [];
  if (Array.isArray(club.leaders) && club.leaders.length > 0) {
    return club.leaders
      .filter((l) => l && l.name && l.name.trim().length > 0)
      .map((l, i) => ({
        ...l,
        id: l.id || `${club.id || club.slug}-leader-${i}`,
        roleType: l.roleType || (l.role && l.role.toLowerCase().includes("co-head") ? "coLead" : "lead")
      }));
  }

  const list: ClubLeader[] = [];
  if (club.lead && club.lead.name && club.lead.name.trim().length > 0) {
    list.push({
      ...club.lead,
      id: club.lead.id || `${club.id || club.slug}-lead`,
      roleType: "lead"
    });
  }

  if (Array.isArray(club.coLeads) && club.coLeads.length > 0) {
    club.coLeads.forEach((cl, i) => {
      if (cl && cl.name && cl.name.trim().length > 0) {
        list.push({
          ...cl,
          id: cl.id || `${club.id || club.slug}-colead-${i}`,
          roleType: "coLead"
        });
      }
    });
  } else if (club.coLead && club.coLead.name && club.coLead.name.trim().length > 0) {
    list.push({
      ...club.coLead,
      id: club.coLead.id || `${club.id || club.slug}-colead`,
      roleType: "coLead"
    });
  }

  return list;
}

export const KNOWN_HARDCODED_BIO_SNIPPETS = [
  "Pioneered the founding architecture",
  "Led the inaugural foundation assembly",
  "Directing campus digital infrastructure",
  "Presiding over the entire Student Representative Council",
  "Assisting executive governance",
  "Heading administrative records",
  "Assisting secretariat documentation",
  "Leading large-scale festival logistics",
  "Managing on-ground event workflows",
  "Leading the official Sahastradeep magazine",
  "Strategizing technical symposia",
  "Structuring campus fests",
  "Directing media relations",
  "Managing council treasury",
  "Assisting financial ledger records",
  "Enforcing institutional conduct standards",
  "Supervising gate accreditation",
  "Curating stage scripts",
  "Hosting major cultural nights",
  "Anchoring hackathons",
  "Co-anchoring stage ceremonies",
  "Delivering central council addresses",
  "Voicing student representations",
  "Representing student needs across computing",
  "Liaisoning for business conclaves",
  "Facilitating smooth campus onboarding",
  "institutional oversight and council governance",
  "Student Representative Council.",
  "Executive coordination and student council operations",
  "Council officer representing",
  "society operations, student chapters, and collegiate events",
  "logistics, rehearsals, member coordination, and event execution",
  "activities, workshops, productions, and student talent mentorship",
];

export function isHardcodedBio(bio?: string | null): boolean {
  if (!bio || typeof bio !== "string") return false;
  const trimmed = bio.trim();
  if (!trimmed) return false;
  return KNOWN_HARDCODED_BIO_SNIPPETS.some((snippet) => trimmed.includes(snippet));
}

export function sanitizeTeamMember(m: TeamMember): TeamMember {
  if (!m) return m;
  const copy = { ...m };
  delete (copy as any).level;
  delete (copy as any).category;
  if (copy.bio && isHardcodedBio(copy.bio)) {
    copy.bio = "";
  }
  return copy;
}

export function stripCategoryAndLevel(members: TeamMember[]): TeamMember[] {
  if (!Array.isArray(members)) return [];
  return members.map(sanitizeTeamMember);
}

// Role and identity synchronization helpers between 1st Tenure Council Admins & Founding Members
export function formatAdminRoleToFounding(role?: string): string {
  if (!role) return "Founding Council Member";
  const trimmed = role.trim();
  if (/^founding\s+/i.test(trimmed)) return trimmed;
  return `Founding ${trimmed}`;
}

export function formatFoundingRoleToAdmin(role?: string): string {
  if (!role) return "Council Admin Officer";
  const trimmed = role.trim();
  const stripped = trimmed.replace(/^founding\s+/i, "").trim();
  return stripped || "Council Admin Officer";
}

export function normalizeMemberName(name?: string): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function matchCouncilAndFounder(m1: TeamMember, m2: TeamMember, idx1?: number, idx2?: number): boolean {
  if (!m1 || !m2) return false;
  // 1. Match by clean normalized name (strictly human identity - never by index or order!)
  if (m1.name && m2.name) {
    const n1 = normalizeMemberName(m1.name);
    const n2 = normalizeMemberName(m2.name);
    if (n1 === n2 && n1.length > 2 && !n1.includes("placeholder")) {
      return true;
    }
  }
  // 2. Match by BT ID ONLY if names do NOT conflict
  if (m1.btId && m2.btId) {
    const b1 = m1.btId.trim().toLowerCase();
    const b2 = m2.btId.trim().toLowerCase();
    if (b1 === b2 && b1.length > 3 && b1 !== "000000" && !b1.includes("placeholder")) {
      if (m1.name && m2.name) {
        const n1 = normalizeMemberName(m1.name);
        const n2 = normalizeMemberName(m2.name);
        if (n1 && n2 && n1 !== n2) {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}

export function repairCouncilSwapIfNeeded(members: TeamMember[], isFounding = false): { repaired: boolean; members: TeamMember[] } {
  const canonicalSource = isFounding ? initialFoundingMembers : initialAdminCouncil;
  if (!Array.isArray(members) || members.length === 0) {
    return { repaired: true, members: stripCategoryAndLevel(canonicalSource) };
  }

  const sarvesh = members.find(m => m.name && /sarvesh\s+surkar/i.test(m.name));
  const hasHarsh = members.some(m => m.name && /harsh\s+shende/i.test(m.name));
  const isSarveshSwapped = !!(sarvesh && (/technical/i.test(sarvesh.role || "") || /technical/i.test(sarvesh.designation || "")));
  const manaswi = members.find(m => m.name && /manaswi\s+burile/i.test(m.name));
  const isManaswiSwapped = !!(manaswi && (/chief\s+event/i.test(manaswi.role || "") || /chief\s+event/i.test(manaswi.designation || "")));

  // If no swapped roles, Harsh is present, and we have at least 13 members, nothing to repair
  if (!isSarveshSwapped && !isManaswiSwapped && hasHarsh && members.length >= 13) {
    return { repaired: false, members };
  }

  console.warn(`⚠️ [Council Store] Detected swapped roles or missing pioneer in ${isFounding ? "founding members" : "1st tenure council"}. Auto-repairing to canonical roster...`);

  // Build repaired roster from canonical list in canonicalSource
  const canonical = stripCategoryAndLevel(canonicalSource);
  const repairedList: TeamMember[] = canonical.map((cMember, idx) => {
    // Match by human identity
    const existing = members.find(m => matchCouncilAndFounder(cMember, m));
    if (existing) {
      return {
        ...existing,
        id: cMember.id,
        name: cMember.name,
        role: cMember.role,
        designation: cMember.designation || cMember.role,
        department: existing.department || cMember.department,
        btId: existing.btId || cMember.btId,
        avatar: (existing.avatar && existing.avatar.length > 10) ? existing.avatar : cMember.avatar,
        year: existing.year || cMember.year,
        order: idx + 1
      };
    }
    return { ...cMember, order: idx + 1 };
  });

  return { repaired: true, members: repairedList };
}

// Council Team Store
export function getStoredCouncilMembers(): TeamMember[] {
  if (typeof window === "undefined") return stripCategoryAndLevel(initialAdminCouncil);
  try {
    const stored = localStorage.getItem("src_council_team");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const { repaired, members } = repairCouncilSwapIfNeeded(stripCategoryAndLevel(parsed));
        if (repaired && typeof window !== "undefined") {
          try {
            localStorage.setItem("src_council_team", JSON.stringify(members));
            window.dispatchEvent(new CustomEvent("src_council_team_updated", { detail: members }));
            saveSiteContentToFirestore("council_team", members).catch(() => {});
          } catch {}
        }
        return members;
      }
    }
  } catch (e) {
    console.warn("Could not read council team from storage", e);
  }
  return stripCategoryAndLevel(initialAdminCouncil);
}

export function saveStoredCouncilMembers(members: TeamMember[], autoSyncToFounding = true): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(stripCategoryAndLevel(members));
    try {
      localStorage.setItem("src_council_team", JSON.stringify(sanitized));
    } catch (lsErr) {
      console.warn("Direct localStorage write notice, auto-compacting...", lsErr);
    }
    window.dispatchEvent(new CustomEvent("src_council_team_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_tenures_updated"));
    window.dispatchEvent(new CustomEvent("src_users_updated"));

    compactCouncilDataset(sanitized).then((compacted) => {
      const finalClean = cleanUndefined(compacted);
      try {
        localStorage.setItem("src_council_team", JSON.stringify(finalClean));
      } catch {}
      saveSiteContentToFirestore("council_team", finalClean).catch((err) => {
        console.warn("Firestore direct write for council team failed, enqueuing:", err);
      });
      enqueueCloudWrite("council_team", finalClean, `Council Leadership (${members.length} Members)`);
    });

    if (autoSyncToFounding && Array.isArray(sanitized) && sanitized.length > 0) {
      syncCouncilAdminsToFounding(sanitized, true);
    }
  } catch (e) {
    console.error("Could not save council team to storage", e);
  }
}

export async function syncCouncilMembersFromFirestore(): Promise<TeamMember[]> {
  try {
    if (hasPendingWritesFor("council_team")) return getStoredCouncilMembers();
    const remote = await getSiteContentFromFirestore<TeamMember[]>("council_team");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const current = getStoredCouncilMembers();
      let merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      const { repaired, members } = repairCouncilSwapIfNeeded(merged);
      if (repaired) {
        merged = members;
        saveStoredCouncilMembers(merged, true);
      } else if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_council_team", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_council_team_updated", { detail: merged }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      return merged;
    }
  } catch {}
  return getStoredCouncilMembers();
}

// Hosting Committee Store
export function getStoredHostingCommittee(): TeamMember[] {
  if (typeof window === "undefined") return stripCategoryAndLevel(initialHosting);
  try {
    const stored = localStorage.getItem("src_hosting_committee");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return stripCategoryAndLevel(parsed);
    }
  } catch (e) {
    console.warn("Could not read hosting committee from storage", e);
  }
  return stripCategoryAndLevel(initialHosting);
}

export function saveStoredHostingCommittee(members: TeamMember[]): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(stripCategoryAndLevel(members));
    try {
      localStorage.setItem("src_hosting_committee", JSON.stringify(sanitized));
    } catch {}
    window.dispatchEvent(new CustomEvent("src_hosting_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_users_updated"));

    compactCouncilDataset(sanitized).then((compacted) => {
      const finalClean = cleanUndefined(compacted);
      try {
        localStorage.setItem("src_hosting_committee", JSON.stringify(finalClean));
      } catch {}
      saveSiteContentToFirestore("hosting_committee", finalClean).catch((err) => {
        console.warn("Firestore direct write for hosting committee failed, enqueuing:", err);
      });
      enqueueCloudWrite("hosting_committee", finalClean, `Hosting Committee (${members.length} Members)`);
    });
  } catch (e) {
    console.error("Could not save hosting committee to storage", e);
  }
}

export async function syncHostingCommitteeFromFirestore(): Promise<TeamMember[]> {
  try {
    if (hasPendingWritesFor("hosting_committee")) return getStoredHostingCommittee();
    const remote = await getSiteContentFromFirestore<TeamMember[]>("hosting_committee");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const current = getStoredHostingCommittee();
      const merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_hosting_committee", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_hosting_updated", { detail: merged }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      return merged;
    }
  } catch {}
  return getStoredHostingCommittee();
}

export function subscribeToHostingCommittee(callback: (members: TeamMember[]) => void): () => void {
  return subscribeToSiteContent<TeamMember[]>("hosting_committee", (remote) => {
    if (remote !== null && Array.isArray(remote)) {
      if (hasPendingWritesFor("hosting_committee")) return;
      const current = getStoredHostingCommittee();
      const merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_hosting_committee", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_hosting_updated", { detail: merged }));
      }
      callback(merged);
    }
  });
}

// Spokespersons Store
export function getStoredSpokespersons(): TeamMember[] {
  if (typeof window === "undefined") return stripCategoryAndLevel(initialSpokespersons);
  try {
    const stored = localStorage.getItem("src_spokespersons");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return stripCategoryAndLevel(parsed);
    }
  } catch (e) {
    console.warn("Could not read spokespersons from storage", e);
  }
  return stripCategoryAndLevel(initialSpokespersons);
}

export function saveStoredSpokespersons(members: TeamMember[]): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(stripCategoryAndLevel(members));
    try { localStorage.setItem("src_spokespersons", JSON.stringify(sanitized)); } catch {}
    window.dispatchEvent(new CustomEvent("src_spokespersons_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_users_updated"));
    saveSiteContentToFirestore("spokespersons", sanitized).catch((err) => {
      console.warn("Firestore direct write for spokespersons failed, enqueuing:", err);
    });
    enqueueCloudWrite("spokespersons", sanitized, `Spokespersons (${members.length} Members)`);
  } catch (e) {
    console.error("Could not save spokespersons to storage", e);
  }
}

export async function syncSpokespersonsFromFirestore(): Promise<TeamMember[]> {
  try {
    if (hasPendingWritesFor("spokespersons")) return getStoredSpokespersons();
    const remote = await getSiteContentFromFirestore<TeamMember[]>("spokespersons");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const cleaned = stripCategoryAndLevel(remote);
      if (typeof window !== "undefined") {
        localStorage.setItem("src_spokespersons", JSON.stringify(cleaned));
        window.dispatchEvent(new CustomEvent("src_spokespersons_updated", { detail: cleaned }));
      }
      return cleaned;
    }
  } catch {}
  return getStoredSpokespersons();
}

export function subscribeToSpokespersons(callback: (members: TeamMember[]) => void): () => void {
  return subscribeToSiteContent<TeamMember[]>("spokespersons", (remote) => {
    if (remote !== null && Array.isArray(remote)) {
      if (hasPendingWritesFor("spokespersons")) return;
      if (typeof window !== "undefined") {
        localStorage.setItem("src_spokespersons", JSON.stringify(remote));
        window.dispatchEvent(new CustomEvent("src_spokespersons_updated", { detail: remote }));
      }
      callback(remote);
    }
  });
}

export function subscribeToCouncilMembers(callback: (members: TeamMember[]) => void): () => void {
  return subscribeToSiteContent<TeamMember[]>("council_team", (remote) => {
    if (remote !== null && Array.isArray(remote)) {
      if (hasPendingWritesFor("council_team")) return;
      const current = getStoredCouncilMembers();
      let merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      const { repaired, members } = repairCouncilSwapIfNeeded(merged);
      if (repaired) {
        merged = members;
        saveStoredCouncilMembers(merged, true);
      } else if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_council_team", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_council_team_updated", { detail: merged }));
      }
      callback(merged);
    }
  });
}

// Clubs Roster Store
export function getStoredClubs(): ClubItem[] {
  if (typeof window === "undefined") return initialClubs;
  try {
    const stored = localStorage.getItem("src_clubs_roster");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read clubs from storage", e);
  }
  return initialClubs;
}

export async function saveStoredClubs(clubs: ClubItem[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const compacted = await compactClubDataset(clubs);
    const sanitized = cleanUndefined(compacted);
    localStorage.setItem("src_clubs_roster", JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_tenures_updated"));
    window.dispatchEvent(new CustomEvent("src_users_updated"));
    // Direct cloud write to Firestore site_content/clubs
    saveSiteContentToFirestore("clubs", sanitized).catch((err) => {
      console.warn("Firestore direct write failed, enqueuing:", err);
      enqueueCloudWrite("clubs", sanitized, `Clubs Directory (${clubs.length} Clubs)`);
    });
  } catch (e) {
    console.error("Could not save clubs to storage", e);
  }
}

export async function syncClubsFromFirestore(): Promise<ClubItem[]> {
  try {
    const remote = await getSiteContentFromFirestore<ClubItem[]>("clubs");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      if (typeof window !== "undefined") {
        localStorage.setItem("src_clubs_roster", JSON.stringify(remote));
        window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: remote }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      return remote;
    }
  } catch {}
  return getStoredClubs();
}

export function subscribeToClubs(callback: (clubs: ClubItem[]) => void): () => void {
  return subscribeToSiteContent<ClubItem[]>("clubs", (remote) => {
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      if (hasPendingWritesFor("clubs")) return;
      if (typeof window !== "undefined") {
        localStorage.setItem("src_clubs_roster", JSON.stringify(remote));
        window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: remote }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      callback(remote);
    }
  });
}

// Helper to convert Founding Member to Council Admin Officer
export function mapFoundingMemberToCouncilAdmin(founder: TeamMember, idx?: number): TeamMember {
  const customIdx = idx !== undefined ? idx : 0;
  const adminRole = formatFoundingRoleToAdmin(founder.role);
  return {
    ...founder,
    id: `admin-${founder.id?.replace(/^(founder|council-admin)-/, "") || customIdx + 1}`,
    designation: adminRole,
    role: adminRole,
    order: founder.order ?? customIdx + 1
  };
}

// Sync Council Admins to Founding Members (1st Tenure)
export function syncCouncilAdminsToFounding(councilList?: TeamMember[], persist = true): TeamMember[] {
  const council = councilList || getStoredCouncilMembers();
  if (!Array.isArray(council) || council.length === 0) return getStoredFoundingMembers();

  let currentFounders = getStoredFoundingMembers();
  if (!Array.isArray(currentFounders) || currentFounders.length === 0) {
    currentFounders = stripCategoryAndLevel(initialFoundingMembers);
  }

  const updatedFounders: TeamMember[] = council.map((admin, idx) => {
    const existing = currentFounders.find((f) => matchCouncilAndFounder(admin, f));
    const founderId = existing?.id || `founder-${admin.id?.replace(/^(admin|council-admin)-/, "") || idx + 1}`;
    const foundingRole = formatAdminRoleToFounding(admin.role);

    return {
      ...admin,
      id: founderId,
      role: foundingRole,
      designation: foundingRole,
      order: admin.order ?? idx + 1,
    };
  });

  if (persist) {
    saveStoredFoundingMembers(updatedFounders, false);
  }
  return updatedFounders;
}

// Sync Founding Members to Council Admins (1st Tenure)
export function syncFoundingToCouncilAdmins(foundingList?: TeamMember[], persist = true): TeamMember[] {
  const founders = foundingList || getStoredFoundingMembers();
  if (!Array.isArray(founders) || founders.length === 0) return getStoredCouncilMembers();

  let currentCouncil = getStoredCouncilMembers();
  if (!Array.isArray(currentCouncil) || currentCouncil.length === 0) {
    currentCouncil = stripCategoryAndLevel(initialAdminCouncil);
  }

  const updatedCouncil: TeamMember[] = founders.map((founder, idx) => {
    const existing = currentCouncil.find((a) => matchCouncilAndFounder(founder, a));
    const adminId = existing?.id || `admin-${founder.id?.replace(/^(founder|council-admin)-/, "") || idx + 1}`;
    const adminRole = formatFoundingRoleToAdmin(founder.role);

    return {
      ...founder,
      id: adminId,
      role: adminRole,
      designation: adminRole,
      order: founder.order ?? idx + 1,
    };
  });

  if (persist) {
    saveStoredCouncilMembers(updatedCouncil, false);
  }
  return updatedCouncil;
}

// Automatic reconciliation between Council Admins and Founding Members
export function reconcileCouncilAndFoundingSync(): TeamMember[] {
  if (typeof window === "undefined") return getStoredFoundingMembers();
  try {
    let council = getStoredCouncilMembers();
    if (!Array.isArray(council) || council.length === 0) return getStoredFoundingMembers();

    const { repaired, members: repairedCouncil } = repairCouncilSwapIfNeeded(council, false);
    if (repaired) {
      council = repairedCouncil;
      saveStoredCouncilMembers(council, true);
      return getStoredFoundingMembers();
    }

    const founders = getStoredFoundingMembers();
    
    let needsSync = false;
    for (let i = 0; i < council.length; i++) {
      const c = council[i];
      const f = founders.find((item) => matchCouncilAndFounder(c, item));
      if (!f) {
        needsSync = true;
        break;
      }
      if (c.avatar && c.avatar !== f.avatar) {
        needsSync = true;
        break;
      }
      if (c.name && c.name !== f.name) {
        needsSync = true;
        break;
      }
      if (c.department && c.department !== f.department) {
        needsSync = true;
        break;
      }
      if (c.btId && c.btId !== f.btId) {
        needsSync = true;
        break;
      }
    }

    if (needsSync) {
      return syncCouncilAdminsToFounding(council, true);
    }
  } catch (e) {
    console.warn("reconcileCouncilAndFoundingSync notice:", e);
  }
  return getStoredFoundingMembers();
}

// Founding Members Store
export function getStoredFoundingMembers(): TeamMember[] {
  if (typeof window === "undefined") return stripCategoryAndLevel(initialFoundingMembers);
  try {
    const stored = localStorage.getItem("src_founding_members");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const { repaired, members } = repairCouncilSwapIfNeeded(stripCategoryAndLevel(parsed), true);
        if (repaired && typeof window !== "undefined") {
          try {
            localStorage.setItem("src_founding_members", JSON.stringify(members));
            window.dispatchEvent(new CustomEvent("src_founding_members_updated", { detail: members }));
            saveSiteContentToFirestore("founding_members", members).catch(() => {});
          } catch {}
        }
        return members;
      }
    }
  } catch (e) {
    console.warn("Could not read founding members from storage", e);
  }
  return stripCategoryAndLevel(initialFoundingMembers);
}

export function saveStoredFoundingMembers(members: TeamMember[], autoSyncToCouncil = true): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(stripCategoryAndLevel(members));
    try {
      localStorage.setItem("src_founding_members", JSON.stringify(sanitized));
    } catch {}
    window.dispatchEvent(new CustomEvent("src_founding_members_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_tenures_updated"));
    window.dispatchEvent(new CustomEvent("src_users_updated"));

    compactCouncilDataset(sanitized).then((compacted) => {
      const finalClean = cleanUndefined(compacted);
      try {
        localStorage.setItem("src_founding_members", JSON.stringify(finalClean));
      } catch {}
      saveSiteContentToFirestore("founding_members", finalClean).catch((err) => {
        console.warn("Firestore direct write for founding members failed, enqueuing:", err);
      });
      enqueueCloudWrite("founding_members", finalClean, `Founding Members (${members.length} Members)`);
    });

    if (autoSyncToCouncil && Array.isArray(sanitized) && sanitized.length > 0) {
      syncFoundingToCouncilAdmins(sanitized, true);
    }
  } catch (e) {
    console.error("Could not save founding members to storage", e);
  }
}

export async function syncFoundingMembersFromFirestore(): Promise<TeamMember[]> {
  try {
    if (hasPendingWritesFor("founding_members")) return getStoredFoundingMembers();
    const remote = await getSiteContentFromFirestore<TeamMember[]>("founding_members");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const current = getStoredFoundingMembers();
      let merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      const { repaired, members } = repairCouncilSwapIfNeeded(merged, true);
      if (repaired) {
        merged = members;
        saveStoredFoundingMembers(merged, true);
      } else if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_founding_members", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_founding_members_updated", { detail: merged }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      return merged;
    }
  } catch {}
  return getStoredFoundingMembers();
}

export function subscribeToFoundingMembers(callback: (members: TeamMember[]) => void): () => void {
  return subscribeToSiteContent<TeamMember[]>("founding_members", (remote) => {
    if (remote !== null && Array.isArray(remote)) {
      if (hasPendingWritesFor("founding_members")) return;
      const current = getStoredFoundingMembers();
      let merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      const { repaired, members } = repairCouncilSwapIfNeeded(merged, true);
      if (repaired) {
        merged = members;
        saveStoredFoundingMembers(merged, true);
      } else if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_founding_members", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_founding_members_updated", { detail: merged }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      callback(merged);
    }
  });
}

function stripPillarRole(pillars: any[]): InstitutionalPillar[] {
  if (!Array.isArray(pillars)) return [];
  return pillars.map((p) => {
    if (!p || typeof p !== "object") return p;
    const copy = { ...p };
    delete copy.role;
    return copy as InstitutionalPillar;
  });
}

// 5. 4 PILLARS OF STRENGTH (INSTITUTIONAL PATRONS & FACULTY MENTORS)
export function getStoredInstitutionalPillars(): InstitutionalPillar[] {
  if (typeof window === "undefined") return stripPillarRole(initialPillars);
  try {
    const stored = localStorage.getItem("src_pillars_of_strength");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return stripPillarRole(parsed);
    }
  } catch (e) {
    console.warn("Could not read pillars from storage", e);
  }
  return stripPillarRole(initialPillars);
}

export async function saveStoredInstitutionalPillars(pillars: InstitutionalPillar[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const cleanedPillars = stripPillarRole(pillars);
    const compacted = await compactPillarsDataset(cleanedPillars);
    const sanitized = cleanUndefined(compacted);
    try {
      localStorage.setItem("src_pillars_of_strength", JSON.stringify(sanitized));
    } catch (lsErr) {
      console.warn("Direct localStorage write notice for pillars, auto-compacting...", lsErr);
    }
    window.dispatchEvent(new CustomEvent("src_pillars_updated", { detail: sanitized }));

    // Direct cloud write to Firestore site_content/pillars_of_strength
    saveSiteContentToFirestore("pillars_of_strength", sanitized).catch((err) => {
      console.warn("Firestore direct write for pillars failed, enqueuing:", err);
      enqueueCloudWrite("pillars_of_strength", sanitized, `4 Pillars of Strength (${pillars.length} Patrons)`);
    });
  } catch (e) {
    console.error("Could not save pillars to storage", e);
  }
}

export async function syncInstitutionalPillarsFromFirestore(): Promise<InstitutionalPillar[]> {
  try {
    if (hasPendingWritesFor("pillars_of_strength")) return getStoredInstitutionalPillars();
    const remote = await getSiteContentFromFirestore<InstitutionalPillar[]>("pillars_of_strength");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const current = getStoredInstitutionalPillars();
      const merged = stripPillarRole(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_pillars_of_strength", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_pillars_updated", { detail: merged }));
      }
      return merged;
    }
  } catch {}
  return getStoredInstitutionalPillars();
}

export function subscribeToInstitutionalPillars(callback: (pillars: InstitutionalPillar[]) => void): () => void {
  return subscribeToSiteContent<InstitutionalPillar[]>("pillars_of_strength", (remote) => {
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      if (hasPendingWritesFor("pillars_of_strength")) return;
      const current = getStoredInstitutionalPillars();
      const merged = stripPillarRole(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_pillars_of_strength", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_pillars_updated", { detail: merged }));
      }
      callback(merged);
    }
  });
}


