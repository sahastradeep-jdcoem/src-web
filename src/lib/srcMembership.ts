import { 
  getStoredCouncilMembers, 
  getStoredHostingCommittee, 
  getStoredSpokespersons, 
  getStoredClubs, 
  getStoredFoundingMembers,
  getClubLeaders
} from "./councilStore";
import { adminCouncilMembers, hostingCommitteeMembers, spokespersonMembers, foundingMembers } from "@/data/team";
import { mockClubs } from "@/data/clubs";
import { getStoredTenures } from "./tenureStore";
import { resolveDesignationByBtId, formatDesignationBadge } from "./usersStore";
import { ClubLeader, ClubMember, TeamMember } from "@/types";

export interface SrcMemberVerificationResult {
  isSrcMember: boolean;
  designationBadge: string;
  level: string;
  name?: string;
  department?: string;
  year?: string;
  avatar?: string;
  clubName?: string;
  email?: string;
}

export interface SavedSrcMemberRecord {
  btId: string;
  name: string;
  designation: string;
  level: string;
  department?: string;
  year?: string;
  avatar?: string;
}

/**
 * Normalizes strings for robust matching
 */
function clean(val?: string | null): string {
  return (val || "").trim().toUpperCase();
}

/**
 * Verify whether a given College BT ID belongs to ANY level of SRC member
 * (Admin Council, Hosting Committee, Spokesperson, Club Head, Club Co-Head, Club Member, Founding Council, or Active Tenures).
 */
export function verifySrcMemberByBtId(
  btId?: string | null,
  userName?: string | null
): SrcMemberVerificationResult {
  if (!btId || !btId.trim()) {
    return {
      isSrcMember: false,
      designationBadge: "",
      level: "",
    };
  }

  const cleanBtId = clean(btId);

  // 1. Direct authoritative check via resolveDesignationByBtId
  const designationInfo = resolveDesignationByBtId(cleanBtId, userName);
  if (designationInfo && designationInfo.designationBadge) {
    return {
      isSrcMember: true,
      designationBadge: designationInfo.designationBadge,
      level: designationInfo.category || (designationInfo.isCouncilOfficer ? "Council Officer" : "Club Member"),
    };
  }

  // 2. Admin Council (Stored or Canonical)
  const council = getStoredCouncilMembers().length > 0 ? getStoredCouncilMembers() : adminCouncilMembers;
  const matchedCouncil = council.find((m) => m.btId && clean(m.btId) === cleanBtId);
  if (matchedCouncil) {
    return {
      isSrcMember: true,
      designationBadge: formatDesignationBadge(matchedCouncil.role),
      level: "Admin Council",
      name: matchedCouncil.name,
      department: matchedCouncil.department,
      year: matchedCouncil.year,
      avatar: matchedCouncil.avatar,
      email: matchedCouncil.email,
    };
  }

  // 3. Hosting Committee & Spokespersons
  const hosting = getStoredHostingCommittee().length > 0 ? getStoredHostingCommittee() : hostingCommitteeMembers;
  const matchedHosting = hosting.find((m) => m.btId && clean(m.btId) === cleanBtId);
  if (matchedHosting) {
    return {
      isSrcMember: true,
      designationBadge: formatDesignationBadge(matchedHosting.role),
      level: "Hosting Committee",
      name: matchedHosting.name,
      department: matchedHosting.department,
      year: matchedHosting.year,
      avatar: matchedHosting.avatar,
    };
  }

  const spokespersons = getStoredSpokespersons().length > 0 ? getStoredSpokespersons() : spokespersonMembers;
  const matchedSpokes = spokespersons.find((m) => m.btId && clean(m.btId) === cleanBtId);
  if (matchedSpokes) {
    return {
      isSrcMember: true,
      designationBadge: formatDesignationBadge(matchedSpokes.role),
      level: "Spokesperson",
      name: matchedSpokes.name,
      department: matchedSpokes.department,
      year: matchedSpokes.year,
      avatar: matchedSpokes.avatar,
    };
  }

  // 4. Chartered Clubs - Leaders (Heads & Co-Heads)
  const clubs = getStoredClubs().length > 0 ? getStoredClubs() : mockClubs;
  for (const club of clubs) {
    const leaders = getClubLeaders(club);
    for (const leader of leaders) {
      if (leader.btId && clean(leader.btId) === cleanBtId) {
        const isCoHead = leader.roleType === "coLead" || (leader.role && leader.role.toLowerCase().includes("co-head"));
        return {
          isSrcMember: true,
          designationBadge: `${club.name} ${isCoHead ? "Co-Head" : "Head"}`,
          level: "Club Leadership",
          name: leader.name,
          department: leader.department,
          year: leader.year,
          avatar: leader.avatar,
          clubName: club.name,
        };
      }
    }

    // 5. Chartered Clubs - Regular Members
    if (Array.isArray(club.members)) {
      const matchedMember = club.members.find((m: ClubMember) => m.btId && clean(m.btId) === cleanBtId);
      if (matchedMember) {
        return {
          isSrcMember: true,
          designationBadge: `${club.name} Member`,
          level: "Club Member",
          name: matchedMember.name,
          department: matchedMember.department,
          year: matchedMember.year,
          clubName: club.name,
        };
      }
    }
  }

  // 6. Founding Council
  const founders = getStoredFoundingMembers().length > 0 ? getStoredFoundingMembers() : foundingMembers;
  const matchedFounder = founders.find((m) => m.btId && clean(m.btId) === cleanBtId);
  if (matchedFounder) {
    return {
      isSrcMember: true,
      designationBadge: formatDesignationBadge(matchedFounder.role),
      level: "Founding Council",
      name: matchedFounder.name,
      department: matchedFounder.department,
      year: matchedFounder.year,
      avatar: matchedFounder.avatar,
    };
  }

  // 7. Active Council Tenures
  const tenures = getStoredTenures();
  for (const tenure of tenures) {
    const allTenureMembers: TeamMember[] = [
      ...(tenure.adminCouncil || []),
      ...(tenure.hostingCommittee || []),
      ...(tenure.foundingMembers || []),
    ];
    const foundInTenure = allTenureMembers.find((m) => m.btId && clean(m.btId) === cleanBtId);
    if (foundInTenure) {
      return {
        isSrcMember: true,
        designationBadge: formatDesignationBadge(foundInTenure.role),
        level: `${tenure.label} Council`,
        name: foundInTenure.name,
        department: foundInTenure.department,
        year: foundInTenure.year,
        avatar: foundInTenure.avatar,
      };
    }

    if (Array.isArray(tenure.clubs)) {
      for (const club of tenure.clubs) {
        const leaders = getClubLeaders(club);
        const matchedLeader = leaders.find((l) => l.btId && clean(l.btId) === cleanBtId);
        if (matchedLeader) {
          return {
            isSrcMember: true,
            designationBadge: `${club.name} Leader`,
            level: "Club Leadership",
            name: matchedLeader.name,
            department: matchedLeader.department,
            year: matchedLeader.year,
            avatar: matchedLeader.avatar,
            clubName: club.name,
          };
        }
      }
    }
  }

  return {
    isSrcMember: false,
    designationBadge: "",
    level: "",
  };
}

/**
 * Collect all saved SRC members across all levels for administrative search and dispatch targeting
 */
export function getAllSavedSrcMembers(): SavedSrcMemberRecord[] {
  const memberMap = new Map<string, SavedSrcMemberRecord>();

  const register = (
    btId?: string,
    name?: string,
    designation?: string,
    level?: string,
    dept?: string,
    year?: string,
    avatar?: string
  ) => {
    if (!btId || !btId.trim()) return;
    const cleanBt = clean(btId);
    // Exclude mentors or test keys without real student ID
    if (/mentor/i.test(designation || "") || (name && /sarvashree|munesh/i.test(name))) {
      return;
    }
    if (!memberMap.has(cleanBt)) {
      memberMap.set(cleanBt, {
        btId: cleanBt,
        name: name?.trim() || "Council Member",
        designation: designation?.trim() || "Council Officer",
        level: level || "Central Council",
        department: dept,
        year: year,
        avatar: avatar,
      });
    }
  };

  // 1. Admin Council
  const council = getStoredCouncilMembers().length > 0 ? getStoredCouncilMembers() : adminCouncilMembers;
  council.forEach((m) => register(m.btId, m.name, m.role, "Admin Council", m.department, m.year, m.avatar));

  // 2. Hosting & Spokespersons
  const hosting = getStoredHostingCommittee().length > 0 ? getStoredHostingCommittee() : hostingCommitteeMembers;
  hosting.forEach((m) => register(m.btId, m.name, m.role, "Hosting Committee", m.department, m.year, m.avatar));

  const spokespersons = getStoredSpokespersons().length > 0 ? getStoredSpokespersons() : spokespersonMembers;
  spokespersons.forEach((m) => register(m.btId, m.name, m.role, "Spokesperson", m.department, m.year, m.avatar));

  // 3. Clubs
  const clubs = getStoredClubs().length > 0 ? getStoredClubs() : mockClubs;
  clubs.forEach((club) => {
    const leaders = getClubLeaders(club);
    leaders.forEach((l) => {
      const isCoHead = l.roleType === "coLead" || (l.role && l.role.toLowerCase().includes("co-head"));
      register(l.btId, l.name, `${club.name} ${isCoHead ? "Co-Head" : "Head"}`, "Club Leadership", l.department, l.year, l.avatar);
    });

    if (Array.isArray(club.members)) {
      club.members.forEach((m: ClubMember) => {
        register(m.btId, m.name, `${club.name} Member`, "Club Member", m.department, m.year);
      });
    }
  });

  // 4. Founding Members
  const founders = getStoredFoundingMembers().length > 0 ? getStoredFoundingMembers() : foundingMembers;
  founders.forEach((m) => register(m.btId, m.name, m.role, "Founding Council", m.department, m.year, m.avatar));

  return Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
