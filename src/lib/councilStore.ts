import { TeamMember, ClubItem } from "@/types";
import { 
  adminCouncilMembers as initialAdminCouncil, 
  hostingCommitteeMembers as initialHosting, 
  spokespersonMembers as initialSpokespersons 
} from "@/data/team";
import { mockClubs as initialClubs } from "@/data/clubs";

// Council Team Store
export function getStoredCouncilMembers(): TeamMember[] {
  if (typeof window === "undefined") return initialAdminCouncil;
  try {
    const stored = localStorage.getItem("src_council_team");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read council team from storage", e);
  }
  return initialAdminCouncil;
}

export function saveStoredCouncilMembers(members: TeamMember[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("src_council_team", JSON.stringify(members));
    window.dispatchEvent(new CustomEvent("src_council_team_updated", { detail: members }));
  } catch (e) {
    console.error("Could not save council team to storage", e);
  }
}

// Hosting Committee Store
export function getStoredHostingCommittee(): TeamMember[] {
  if (typeof window === "undefined") return initialHosting;
  try {
    const stored = localStorage.getItem("src_hosting_committee");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read hosting committee from storage", e);
  }
  return initialHosting;
}

export function saveStoredHostingCommittee(members: TeamMember[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("src_hosting_committee", JSON.stringify(members));
    window.dispatchEvent(new CustomEvent("src_hosting_updated", { detail: members }));
  } catch (e) {
    console.error("Could not save hosting committee to storage", e);
  }
}

// Spokespersons Store
export function getStoredSpokespersons(): TeamMember[] {
  if (typeof window === "undefined") return initialSpokespersons;
  try {
    const stored = localStorage.getItem("src_spokespersons");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read spokespersons from storage", e);
  }
  return initialSpokespersons;
}

export function saveStoredSpokespersons(members: TeamMember[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("src_spokespersons", JSON.stringify(members));
    window.dispatchEvent(new CustomEvent("src_spokespersons_updated", { detail: members }));
  } catch (e) {
    console.error("Could not save spokespersons to storage", e);
  }
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
    localStorage.setItem("src_clubs_roster", JSON.stringify(clubs));
    window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: clubs }));
  } catch (e) {
    console.error("Could not save clubs to storage", e);
  }
}
