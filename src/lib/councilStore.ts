import { TeamMember, ClubItem, ClubLeader } from "@/types";
import { 
  adminCouncilMembers as initialAdminCouncil, 
  hostingCommitteeMembers as initialHosting, 
  spokespersonMembers as initialSpokespersons,
  foundingMembers as initialFoundingMembers
} from "@/data/team";
import { mockClubs as initialClubs } from "@/data/clubs";
import { 
  getSiteContentFromFirestore, 
  saveSiteContentToFirestore,
  subscribeToSiteContent,
  cleanUndefined
} from "./firebase/firestore";
import { enqueueCloudWrite, reconcileArrayDatasets, hasPendingWritesFor, compactClubDataset, compactCouncilDataset } from "./dataSyncEngine";

export function getClubLeaders(club: ClubItem): ClubLeader[] {
  if (!club) return [];
  if (Array.isArray(club.leaders) && club.leaders.length > 0) {
    return club.leaders.map((l, i) => ({
      ...l,
      id: l.id || `${club.id || club.slug}-leader-${i}`,
      roleType: l.roleType || (l.role && l.role.toLowerCase().includes("co-head") ? "coLead" : "lead")
    }));
  }

  const list: ClubLeader[] = [];
  if (club.lead && (club.lead.name || club.lead.role)) {
    list.push({
      ...club.lead,
      id: club.lead.id || `${club.id || club.slug}-lead`,
      roleType: "lead"
    });
  }

  if (Array.isArray(club.coLeads) && club.coLeads.length > 0) {
    club.coLeads.forEach((cl, i) => {
      if (cl && (cl.name || cl.role)) {
        list.push({
          ...cl,
          id: cl.id || `${club.id || club.slug}-colead-${i}`,
          roleType: "coLead"
        });
      }
    });
  } else if (club.coLead && (club.coLead.name || club.coLead.role)) {
    list.push({
      ...club.coLead,
      id: club.coLead.id || `${club.id || club.slug}-colead`,
      roleType: "coLead"
    });
  }

  return list;
}

export function stripCategoryAndLevel(members: TeamMember[]): TeamMember[] {
  if (!Array.isArray(members)) return [];
  return members.map((m) => {
    const copy = { ...m };
    delete (copy as any).level;
    delete (copy as any).category;
    return copy;
  });
}

// Council Team Store
export function getStoredCouncilMembers(): TeamMember[] {
  if (typeof window === "undefined") return stripCategoryAndLevel(initialAdminCouncil);
  try {
    const stored = localStorage.getItem("src_council_team");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return stripCategoryAndLevel(parsed);
    }
  } catch (e) {
    console.warn("Could not read council team from storage", e);
  }
  return stripCategoryAndLevel(initialAdminCouncil);
}

export function saveStoredCouncilMembers(members: TeamMember[]): void {
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
      enqueueCloudWrite("council_team", finalClean, `Council Leadership (${members.length} Members)`);
    });
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
      const merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
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
    localStorage.setItem("src_spokespersons", JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("src_spokespersons_updated", { detail: sanitized }));
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
      const merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
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
      }
      callback(remote);
    }
  });
}

// Helper to convert Founding Member to Council Admin Officer
export function mapFoundingMemberToCouncilAdmin(founder: TeamMember, idx?: number): TeamMember {
  const customIdx = idx !== undefined ? idx : 0;
  return {
    ...founder,
    id: `council-admin-${founder.id || customIdx}`,
    designation: founder.designation || "Council Admin Officer",
    role: "Council Admin Officer",
  };
}

export function syncFoundingToCouncilAdmins(foundingList?: TeamMember[]): TeamMember[] {
  const founders = foundingList || getStoredFoundingMembers();
  if (!Array.isArray(founders) || founders.length === 0) return getStoredCouncilMembers();
  
  const mapped = founders.map((f, idx) => mapFoundingMemberToCouncilAdmin(f, idx));
  saveStoredCouncilMembers(mapped);
  return mapped;
}

// Founding Members Store
export function getStoredFoundingMembers(): TeamMember[] {
  if (typeof window === "undefined") return stripCategoryAndLevel(initialFoundingMembers);
  try {
    const stored = localStorage.getItem("src_founding_members");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return stripCategoryAndLevel(parsed);
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
    window.dispatchEvent(new CustomEvent("src_users_updated"));

    compactCouncilDataset(sanitized).then((compacted) => {
      const finalClean = cleanUndefined(compacted);
      try {
        localStorage.setItem("src_founding_members", JSON.stringify(finalClean));
      } catch {}
      enqueueCloudWrite("founding_members", finalClean, `Founding Members (${members.length} Members)`);
    });

    if (autoSyncToCouncil && Array.isArray(sanitized) && sanitized.length > 0) {
      const mapped = sanitized.map((f, i) => mapFoundingMemberToCouncilAdmin(f, i));
      saveStoredCouncilMembers(mapped);
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
      const merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
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
      const merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
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


