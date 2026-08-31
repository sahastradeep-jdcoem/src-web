import { TeamMember, ClubItem } from "@/types";
import { 
  adminCouncilMembers as initialAdminCouncil, 
  hostingCommitteeMembers as initialHosting, 
  spokespersonMembers as initialSpokespersons,
  foundingMembers as initialFoundingMembers
} from "@/data/team";
import { mockClubs as initialClubs } from "@/data/clubs";
import { 
  saveSiteContentToFirestore, 
  getSiteContentFromFirestore, 
  subscribeToSiteContent,
  cleanUndefined
} from "./firebase/firestore";
import { enqueueCloudWrite, reconcileArrayDatasets } from "./dataSyncEngine";

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
    localStorage.setItem("src_council_team", JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("src_council_team_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_tenures_updated"));
    window.dispatchEvent(new CustomEvent("src_users_updated"));
    enqueueCloudWrite("council_team", sanitized, `Council Leadership (${members.length} Members)`);
  } catch (e) {
    console.error("Could not save council team to storage", e);
  }
}

export async function syncCouncilMembersFromFirestore(): Promise<TeamMember[]> {
  try {
    const remote = await getSiteContentFromFirestore<TeamMember[]>("council_team");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const current = getStoredCouncilMembers();
      const merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
        localStorage.setItem("src_council_team", JSON.stringify(merged));
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
    const sanitized = stripCategoryAndLevel(members);
    localStorage.setItem("src_hosting_committee", JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("src_hosting_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_users_updated"));
    saveSiteContentToFirestore("hosting_committee", sanitized);
  } catch (e) {
    console.error("Could not save hosting committee to storage", e);
  }
}

export async function syncHostingCommitteeFromFirestore(): Promise<TeamMember[]> {
  try {
    const remote = await getSiteContentFromFirestore<TeamMember[]>("hosting_committee");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const cleaned = stripCategoryAndLevel(remote);
      if (typeof window !== "undefined") {
        localStorage.setItem("src_hosting_committee", JSON.stringify(cleaned));
        window.dispatchEvent(new CustomEvent("src_hosting_updated", { detail: cleaned }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      return cleaned;
    }
  } catch {}
  return getStoredHostingCommittee();
}

export function subscribeToHostingCommittee(callback: (members: TeamMember[]) => void): () => void {
  return subscribeToSiteContent<TeamMember[]>("hosting_committee", (remote) => {
    if (remote !== null && Array.isArray(remote)) {
      const cleaned = stripCategoryAndLevel(remote);
      if (typeof window !== "undefined") {
        localStorage.setItem("src_hosting_committee", JSON.stringify(cleaned));
        window.dispatchEvent(new CustomEvent("src_hosting_updated", { detail: cleaned }));
      }
      callback(cleaned);
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
    const sanitized = stripCategoryAndLevel(members);
    localStorage.setItem("src_spokespersons", JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("src_spokespersons_updated", { detail: sanitized }));
    saveSiteContentToFirestore("spokespersons", sanitized);
  } catch (e) {
    console.error("Could not save spokespersons to storage", e);
  }
}

export async function syncSpokespersonsFromFirestore(): Promise<TeamMember[]> {
  try {
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
      if (typeof window !== "undefined") {
        localStorage.setItem("src_council_team", JSON.stringify(remote));
        window.dispatchEvent(new CustomEvent("src_council_team_updated", { detail: remote }));
      }
      callback(remote);
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

export function saveStoredClubs(clubs: ClubItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(clubs);
    localStorage.setItem("src_clubs_roster", JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: sanitized }));
    enqueueCloudWrite("clubs", sanitized, `Clubs Directory (${clubs.length} Clubs)`);
  } catch (e) {
    console.error("Could not save clubs to storage", e);
  }
}

export async function syncClubsFromFirestore(): Promise<ClubItem[]> {
  try {
    const remote = await getSiteContentFromFirestore<ClubItem[]>("clubs");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const current = getStoredClubs();
      const merged = reconcileArrayDatasets(current, remote);
      if (typeof window !== "undefined") {
        localStorage.setItem("src_clubs_roster", JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: merged }));
      }
      return merged;
    }
  } catch {}
  return getStoredClubs();
}

export function subscribeToClubs(callback: (clubs: ClubItem[]) => void): () => void {
  return subscribeToSiteContent<ClubItem[]>("clubs", (remote) => {
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const current = getStoredClubs();
      const merged = reconcileArrayDatasets(current, remote);
      if (typeof window !== "undefined") {
        localStorage.setItem("src_clubs_roster", JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: merged }));
      }
      callback(merged);
    }
  });
}

// Helper to convert Founding Member to Council Admin Officer
export function mapFoundingMemberToCouncilAdmin(founder: TeamMember, idx?: number): TeamMember {
  let role = (founder.role || "Council Officer").trim();
  if (role.toLowerCase().startsWith("founding ")) {
    role = role.replace(/^Founding\s+/i, "");
  }
  return {
    ...founder,
    id: founder.id.startsWith("founder-") ? founder.id.replace("founder-", "admin-") : founder.id,
    role: role || "Council Officer",
    order: founder.order || (idx !== undefined ? idx + 1 : 1)
  };
}

export function syncFoundingToCouncilAdmins(foundingList?: TeamMember[]): TeamMember[] {
  const founders = foundingList || getStoredFoundingMembers();
  if (!Array.isArray(founders) || founders.length === 0) return getStoredCouncilMembers();
  
  const mapped = founders.map((f, i) => mapFoundingMemberToCouncilAdmin(f, i));
  saveStoredCouncilMembers(mapped);
  return mapped;
}

// Founding Members of Sahastradeep Store
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

export function saveStoredFoundingMembers(members: TeamMember[], autoSyncToCouncil: boolean = true): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = stripCategoryAndLevel(members);
    localStorage.setItem("src_founding_members", JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("src_founding_members_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_users_updated"));
    saveSiteContentToFirestore("founding_members", sanitized);

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
    const remote = await getSiteContentFromFirestore<TeamMember[]>("founding_members");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const cleaned = stripCategoryAndLevel(remote);
      if (typeof window !== "undefined") {
        localStorage.setItem("src_founding_members", JSON.stringify(cleaned));
        window.dispatchEvent(new CustomEvent("src_founding_members_updated", { detail: cleaned }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      return cleaned;
    }
  } catch {}
  return getStoredFoundingMembers();
}

export function subscribeToFoundingMembers(callback: (members: TeamMember[]) => void): () => void {
  return subscribeToSiteContent<TeamMember[]>("founding_members", (remote) => {
    if (remote !== null && Array.isArray(remote)) {
      const cleaned = stripCategoryAndLevel(remote);
      if (typeof window !== "undefined") {
        localStorage.setItem("src_founding_members", JSON.stringify(cleaned));
        window.dispatchEvent(new CustomEvent("src_founding_members_updated", { detail: cleaned }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      callback(cleaned);
    }
  });
}


