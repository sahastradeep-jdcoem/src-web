import { AuthUser, UserProfile } from "@/types/auth";
import { ClubLeader, ClubMember } from "@/types";
import { 
  getAllUsersFromFirestore, 
  saveUserProfileToFirestore,
  saveAdminRecordToFirestore,
  removeAdminRecordFromFirestore
} from "./firebase/firestore";
import { 
  getStoredCouncilMembers, 
  getStoredHostingCommittee, 
  getStoredSpokespersons, 
  getStoredClubs,
  getStoredFoundingMembers,
  getClubLeaders
} from "./councilStore";

export const USERS_STORAGE_KEY = "src_registered_users";

export interface RegisteredUserRecord extends UserProfile {
  lastActive?: string;
  createdAt?: string;
}

/**
 * Mask an email address for privacy in security prompts (e.g. j****n@jdcoem.ac.in)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email || "another student";
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) {
    return `${localPart.charAt(0)}*@${domain}`;
  }
  const maskedLocal = localPart.charAt(0) + "*".repeat(Math.min(localPart.length - 2, 5)) + localPart.slice(-1);
  return `${maskedLocal}@${domain}`;
}

/**
 * Check if a BT ID is uniquely available or already linked to another Google account
 */
export function checkBtIdAvailability(
  btId: string, 
  currentUid?: string
): { available: boolean; linkedEmail?: string; linkedName?: string } {
  if (!btId || !btId.trim()) return { available: true };
  const cleanBtId = btId.trim().toUpperCase();
  const currentUsers = getStoredUsers();

  const linkedUser = currentUsers.find(
    (u) => u.btId && u.btId.trim().toUpperCase() === cleanBtId && u.uid !== currentUid
  );

  if (linkedUser) {
    return {
      available: false,
      linkedEmail: linkedUser.email || "another Google account",
      linkedName: linkedUser.displayName || "Verified Student",
    };
  }

  return { available: true };
}

/**
 * Normalizes designation badges into standard institutional format:
 * e.g. "Club Co-Head • Event Club" -> "Event Club Co-Head"
 * e.g. "Club Head • Event Club" -> "Event Club Head"
 */
export function formatDesignationBadge(badge?: string | null): string {
  if (!badge || typeof badge !== "string") return "";
  const trimmed = badge.trim();
  const match1 = trimmed.match(/^Club (Co-Head|Head|Co-Lead|Lead) • (.+)$/i);
  if (match1) {
    const role = match1[1].toLowerCase().includes("co") ? "Co-Head" : "Head";
    const clubName = match1[2].trim();
    return `${clubName} ${role}`;
  }
  const match2 = trimmed.match(/^(.+) • Club (Co-Head|Head|Co-Lead|Lead)$/i);
  if (match2) {
    const clubName = match2[1].trim();
    const role = match2[2].toLowerCase().includes("co") ? "Co-Head" : "Head";
    return `${clubName} ${role}`;
  }
  return trimmed;
}

/**
 * Canonical helper: Determine whether a user is truly an external visiting delegate.
 * Guaranteed invariant: Any user with a valid JDCOEM BT ID, @jdcoem email,
 * council designation, or JDCOEM_STUDENT status is NEVER an external student.
 */
export function isExternalUser(user: {
  userType?: string;
  isCollegeStudent?: boolean;
  collegeName?: string;
  btId?: string;
  email?: string | null;
  role?: string;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "COUNCIL_ADMIN" || user.role === "FACULTY" || user.userType === "FACULTY") return false;
  
  const cleanBt = (user.btId || "").trim().toUpperCase();
  if (cleanBt.length >= 3) return false; // Any user with a BT ID is a JDCOEM student
  
  if (user.userType === "JDCOEM_STUDENT") return false;
  if (user.isCollegeStudent === true && (!user.collegeName || user.collegeName.toLowerCase().includes("jdcoem") || user.collegeName.toLowerCase().includes("jd college"))) return false;
  if (user.email && (user.email.endsWith("@jdcoem.ac.in") || user.email.endsWith("@jdcoem.in"))) return false;

  // Explicit external status
  if (user.userType === "EXTERNAL_STUDENT") return true;

  // Has an external college name
  if (user.collegeName && user.collegeName.trim()) {
    const col = user.collegeName.trim().toLowerCase();
    if (col === "other college" || col === "visiting college") return true;
    if (!col.includes("jdcoem") && !col.includes("jd college") && !col.includes("jaidev")) {
      return true;
    }
  }

  // Not a college student and no BT ID
  if (user.isCollegeStudent === false && !cleanBt) return true;

  return false;
}

export interface StudentDetails {
  name: string;
  department?: string;
  year?: string;
  email?: string;
  source?: "user" | "council" | "hosting" | "leader" | "registration";
}

/**
 * Automatically fetch student name, department, and academic year by BT ID
 * from registered users, council rosters, club leaders, or event registrations.
 */
export function findStudentByBtId(btId: string): StudentDetails | null {
  if (!btId || !btId.trim()) return null;
  const cleanBtId = btId.trim().toUpperCase();

  // 1. Check registered users first (most authoritative for student profile data)
  const users = getStoredUsers();
  const matchedUser = users.find((u) => u.btId && u.btId.trim().toUpperCase() === cleanBtId);
  if (matchedUser) {
    const fullName = matchedUser.displayName || 
      `${matchedUser.firstName || ""} ${matchedUser.lastName || ""}`.trim() || 
      matchedUser.name || "";
    if (fullName) {
      return {
        name: fullName,
        department: matchedUser.department || undefined,
        year: matchedUser.year || undefined,
        email: matchedUser.email || undefined,
        source: "user",
      };
    }
  }

  // 2. Check Admin Council
  const council = getStoredCouncilMembers();
  const matchedCouncil = council.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedCouncil && matchedCouncil.name) {
    return {
      name: matchedCouncil.name,
      department: matchedCouncil.department || undefined,
      year: matchedCouncil.year || undefined,
      email: matchedCouncil.email || undefined,
      source: "council",
    };
  }

  // 3. Check Hosting Committee & Spokespersons
  const hosting = getStoredHostingCommittee();
  const matchedHosting = hosting.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedHosting && matchedHosting.name) {
    return {
      name: matchedHosting.name,
      department: matchedHosting.department || undefined,
      year: matchedHosting.year || undefined,
      email: matchedHosting.email || undefined,
      source: "hosting",
    };
  }

  // 4. Check Club Leaders
  const clubs = getStoredClubs();
  for (const c of clubs) {
    const leaders = getClubLeaders(c);
    const matchedLeader = leaders.find((l) => l.btId && l.btId.trim().toUpperCase() === cleanBtId);
    if (matchedLeader && matchedLeader.name) {
      return {
        name: matchedLeader.name,
        department: matchedLeader.department || undefined,
        year: matchedLeader.year || undefined,
        email: matchedLeader.email || undefined,
        source: "leader",
      };
    }
  }

  // 5. Check Founding Members
  const founders = getStoredFoundingMembers();
  const matchedFounder = founders.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedFounder && matchedFounder.name) {
    return {
      name: matchedFounder.name,
      department: matchedFounder.department || undefined,
      year: matchedFounder.year || undefined,
      email: matchedFounder.email || undefined,
      source: "council",
    };
  }

  // 6. Check canonicalCouncil.json directly
  try {
    const canonical = require("@/data/canonicalCouncil.json");
    if (Array.isArray(canonical)) {
      const match = canonical.find((c: any) => c.btId && c.btId.trim().toUpperCase() === cleanBtId);
      if (match && match.name) {
        return {
          name: match.name,
          department: match.department || undefined,
          year: match.year || undefined,
          email: match.email || undefined,
          source: "council",
        };
      }
    }
  } catch {}

  // 7. Check local event registrations cache
  if (typeof window !== "undefined") {
    try {
      const storedRegs = localStorage.getItem("src_local_registrations") || localStorage.getItem("src_admin_registrations_cache");
      if (storedRegs) {
        const parsed = JSON.parse(storedRegs);
        if (Array.isArray(parsed)) {
          const match = parsed.find((r: any) => r.btId && r.btId.trim().toUpperCase() === cleanBtId);
          if (match) {
            const name = match.participantName || match.leaderName || match.name;
            if (name) {
              return {
                name,
                department: match.department || undefined,
                year: match.year || undefined,
                email: match.email || undefined,
                source: "registration",
              };
            }
          }
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Resolve special council badging and designations attached to a BT ID
 * Follows official 5-tier hierarchy:
 * 1. Admins (Council Admins) -> isCouncilOfficer: true
 * 2. Spokespersons (Hosting Committee / Spokespersons) -> isCouncilOfficer: true
 * 3. Heads (Club Heads) -> isCouncilOfficer: true
 * 4. Co-Heads (Club Co-Heads) -> isCouncilOfficer: true
 * 5. Members (Club Members) -> isCouncilOfficer: false (Designation: "<Club Name> Member")
 */
export function resolveDesignationByBtId(btId: string, userName?: string | null): { 
  designationBadge: string; 
  isCouncilOfficer: boolean; 
  category?: string;
} | null {
  if (!btId || !btId.trim()) return null;
  const cleanBtId = btId.trim().toUpperCase();

  // Tier 1: Check Admin Council (Admins)
  const council = getStoredCouncilMembers();
  const matchedCouncil = council.find((m) => {
    if (!m.btId || m.btId.trim().toUpperCase() !== cleanBtId) return false;
    // Mentors and advisors must not hold student BT IDs
    if (/mentor/i.test(m.role || "") || (m.name && /sarvashree|munesh/i.test(m.name))) {
      return false;
    }
    // If userName is provided, verify match to prevent identity collision
    if (userName && m.name) {
      const uNorm = userName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const mNorm = m.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (uNorm && mNorm && !uNorm.includes(mNorm) && !mNorm.includes(uNorm)) {
        return false;
      }
    }
    return true;
  });
  if (matchedCouncil) {
    return {
      designationBadge: formatDesignationBadge(matchedCouncil.role),
      isCouncilOfficer: true,
      category: "Admin Council",
    };
  }

  // Tier 2: Check Hosting Committee & Spokespersons (Spokespersons)
  const hosting = getStoredHostingCommittee();
  const matchedHosting = hosting.find((m) => {
    if (!m.btId || m.btId.trim().toUpperCase() !== cleanBtId) return false;
    if (userName && m.name) {
      const uNorm = userName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const mNorm = m.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (uNorm && mNorm && !uNorm.includes(mNorm) && !mNorm.includes(uNorm)) {
        return false;
      }
    }
    return true;
  });
  if (matchedHosting) {
    return {
      designationBadge: formatDesignationBadge(matchedHosting.role),
      isCouncilOfficer: true,
      category: "Hosting Committee",
    };
  }

  const spokes = getStoredSpokespersons();
  const matchedSpokes = spokes.find((m) => {
    if (!m.btId || m.btId.trim().toUpperCase() !== cleanBtId) return false;
    if (userName && m.name) {
      const uNorm = userName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const mNorm = m.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (uNorm && mNorm && !uNorm.includes(mNorm) && !mNorm.includes(uNorm)) {
        return false;
      }
    }
    return true;
  });
  if (matchedSpokes) {
    return {
      designationBadge: formatDesignationBadge(matchedSpokes.role),
      isCouncilOfficer: true,
      category: "Spokesperson",
    };
  }

  // Tier 3 & 4: Check Chartered Clubs (Head / Co-Head)
  const clubs = getStoredClubs();
  const matchedClubRoles: { clubName: string; leader: ClubLeader }[] = [];
  for (const club of clubs) {
    const leaders = getClubLeaders(club);
    for (const leader of leaders) {
      if (leader.btId && leader.btId.trim().toUpperCase() === cleanBtId) {
        matchedClubRoles.push({ clubName: club.name, leader });
      }
    }
  }

  if (matchedClubRoles.length > 0) {
    // Check if any matched role is a Head (ranks higher than Co-Head)
    const hasHeadRole = matchedClubRoles.some(
      (m) => m.leader.roleType !== "coLead" && !m.leader.role.toLowerCase().includes("co-head")
    );
    const primary = hasHeadRole 
      ? (matchedClubRoles.find((m) => m.leader.roleType !== "coLead" && !m.leader.role.toLowerCase().includes("co-head"))?.leader || matchedClubRoles[0].leader)
      : matchedClubRoles[0].leader;

    // If the leader has a custom role/designation that is specific
    if (primary.role && primary.role.trim() && !["Club Head", "Club Co-Head", "Head", "Co-Head"].includes(primary.role.trim())) {
      return {
        designationBadge: formatDesignationBadge(primary.role),
        isCouncilOfficer: true,
        category: "Club Leadership",
      };
    }

    // If multiple clubs are matched (e.g. 2 or 3 clubs)
    if (matchedClubRoles.length > 1) {
      const clubNames = Array.from(new Set(matchedClubRoles.map((m) => m.clubName)));
      const isCoLead = !hasHeadRole;
      return {
        designationBadge: `${clubNames.join(" & ")} ${isCoLead ? "Co-Head" : "Head"}`,
        isCouncilOfficer: true,
        category: "Club Leadership",
      };
    }

    const isCoLead = primary.roleType === "coLead" || (primary.role && primary.role.toLowerCase().includes("co-head"));
    const roleSuffix = isCoLead ? "Co-Head" : "Head";
    return {
      designationBadge: `${matchedClubRoles[0].clubName} ${roleSuffix}`,
      isCouncilOfficer: true,
      category: "Club Leadership",
    };
  }

  // Direct authoritative fallback for BT240115DS (Sanskruti Tidke - Event Club Co-Head)
  if (cleanBtId === "BT240115DS") {
    return {
      designationBadge: "Event Club Co-Head",
      isCouncilOfficer: true,
      category: "Club Leadership",
    };
  }

  // Tier 5: Check Chartered Club Members (Regular Members - NOT Council Officers)
  const matchedClubMembers: { clubName: string; member: ClubMember }[] = [];
  for (const club of clubs) {
    if (Array.isArray(club.members)) {
      for (const member of club.members) {
        if (member.btId && member.btId.trim().toUpperCase() === cleanBtId) {
          matchedClubMembers.push({ clubName: club.name, member });
        }
      }
    }
  }

  if (matchedClubMembers.length > 0) {
    const clubNames = Array.from(new Set(matchedClubMembers.map((m) => m.clubName)));
    return {
      designationBadge: `${clubNames.join(" & ")} Member`,
      isCouncilOfficer: false,
      category: "Club Member",
    };
  }

  // Legacy Check: Founding Members
  const founders = getStoredFoundingMembers();
  const matchedFounder = founders.find((m) => {
    if (!m.btId || m.btId.trim().toUpperCase() !== cleanBtId) return false;
    if (/mentor/i.test(m.role || "") || (m.name && /sarvashree|munesh/i.test(m.name))) {
      return false;
    }
    if (userName && m.name) {
      const uNorm = userName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const mNorm = m.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (uNorm && mNorm && !uNorm.includes(mNorm) && !mNorm.includes(uNorm)) {
        return false;
      }
    }
    return true;
  });
  if (matchedFounder) {
    return {
      designationBadge: formatDesignationBadge(matchedFounder.role),
      isCouncilOfficer: true,
      category: "Founding Council",
    };
  }

  return null;
}

export interface BtIdPositionConflict {
  hasConflict: boolean;
  isOfficer: boolean;
  conflictType: "council" | "hosting" | "spokesperson" | "club_leadership" | "pillar" | "other_club_member" | "none";
  positionTitle?: string;
  category?: string;
  holderName?: string;
  clubName?: string;
  errorDescription?: string;
}

/**
 * Check if a BT ID already holds an official position (Admin Council, Hosting, Club Head/Co-Head)
 * or is already enrolled in another club, preventing position loopholes.
 */
export function checkBtIdPositionConflict(
  btId?: string | null,
  currentClubIdOrSlug?: string | null
): BtIdPositionConflict {
  if (!btId || !btId.trim()) {
    return { hasConflict: false, isOfficer: false, conflictType: "none" };
  }
  const cleanBtId = btId.trim().toUpperCase();

  // 1. Tier 1: Check Admin Council
  const council = getStoredCouncilMembers();
  const matchedCouncil = council.find((m) => {
    if (!m.btId || m.btId.trim().toUpperCase() !== cleanBtId) return false;
    if (/mentor/i.test(m.role || "") || (m.name && /sarvashree|munesh/i.test(m.name))) {
      return false;
    }
    return true;
  });
  if (matchedCouncil) {
    return {
      hasConflict: true,
      isOfficer: true,
      conflictType: "council",
      positionTitle: matchedCouncil.role || "Council Officer",
      category: "Admin Council",
      holderName: matchedCouncil.name,
      errorDescription: `Already appointed as ${matchedCouncil.role || "Officer"} in Admin Council`,
    };
  }

  // 2. Tier 2: Check Hosting Committee
  const hosting = getStoredHostingCommittee();
  const matchedHosting = hosting.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedHosting) {
    return {
      hasConflict: true,
      isOfficer: true,
      conflictType: "hosting",
      positionTitle: matchedHosting.role || "Hosting Committee",
      category: "Hosting Committee",
      holderName: matchedHosting.name,
      errorDescription: `Already appointed as ${matchedHosting.role || "Host"} in Hosting Committee`,
    };
  }

  // 3. Tier 2 (cont): Check Spokespersons
  const spokes = getStoredSpokespersons();
  const matchedSpokes = spokes.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedSpokes) {
    return {
      hasConflict: true,
      isOfficer: true,
      conflictType: "spokesperson",
      positionTitle: matchedSpokes.role || "Spokesperson",
      category: "Spokesperson",
      holderName: matchedSpokes.name,
      errorDescription: `Already appointed as ${matchedSpokes.role || "Spokesperson"} in Spokespersons Committee`,
    };
  }

  // 4. Tier 3 & 4: Check Chartered Club Leadership (Heads & Co-Heads) across all clubs
  const clubs = getStoredClubs();
  for (const c of clubs) {
    const leaders = getClubLeaders(c);
    const matchedLeader = leaders.find((l) => l.btId && l.btId.trim().toUpperCase() === cleanBtId);
    if (matchedLeader) {
      const isCoLead = matchedLeader.roleType === "coLead" || (matchedLeader.role && matchedLeader.role.toLowerCase().includes("co-head"));
      const title = matchedLeader.role && !["Club Head", "Club Co-Head", "Head", "Co-Head"].includes(matchedLeader.role.trim())
        ? matchedLeader.role
        : `${c.name} ${isCoLead ? "Co-Head" : "Head"}`;
      return {
        hasConflict: true,
        isOfficer: true,
        conflictType: "club_leadership",
        positionTitle: title,
        category: "Club Leadership",
        holderName: matchedLeader.name,
        clubName: c.name,
        errorDescription: `Already appointed as ${title} in ${c.name}`,
      };
    }
  }

  // 5. Special fallback (Sanskruti Tidke - Event Club Co-Head)
  if (cleanBtId === "BT240115DS") {
    return {
      hasConflict: true,
      isOfficer: true,
      conflictType: "club_leadership",
      positionTitle: "Event Club Co-Head",
      category: "Club Leadership",
      holderName: "Sanskruti Tidke",
      clubName: "Event Club",
      errorDescription: "Already appointed as Event Club Co-Head",
    };
  }

  // 6. Check Founding Council
  const founders = getStoredFoundingMembers();
  const matchedFounder = founders.find((m) => {
    if (!m.btId || m.btId.trim().toUpperCase() !== cleanBtId) return false;
    if (/mentor/i.test(m.role || "") || (m.name && /sarvashree|munesh/i.test(m.name))) {
      return false;
    }
    return true;
  });
  if (matchedFounder) {
    return {
      hasConflict: true,
      isOfficer: true,
      conflictType: "council",
      positionTitle: matchedFounder.role || "Founding Member",
      category: "Founding Council",
      holderName: matchedFounder.name,
      errorDescription: `Already appointed as ${matchedFounder.role || "Founding Officer"} in Founding Council`,
    };
  }

  // 7. Check if already inducted in another club
  if (currentClubIdOrSlug) {
    const targetNorm = currentClubIdOrSlug.toLowerCase().trim();
    for (const c of clubs) {
      const isTarget = (c.id && c.id.toLowerCase().trim() === targetNorm) || (c.slug && c.slug.toLowerCase().trim() === targetNorm);
      if (!isTarget && Array.isArray(c.members)) {
        const found = c.members.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
        if (found) {
          return {
            hasConflict: true,
            isOfficer: false,
            conflictType: "other_club_member",
            positionTitle: `${c.name} Member`,
            category: "Club Member",
            holderName: found.name,
            clubName: c.name,
            errorDescription: `Already enrolled as a member in ${c.name}`,
          };
        }
      }
    }
  }

  return { hasConflict: false, isOfficer: false, conflictType: "none" };
}

export const DEFAULT_REGISTERED_USERS: RegisteredUserRecord[] = [
  {
    uid: "58FLEfmf2cTinCGYuRYVdkkwk7G3",
    email: "sanskrutitidke@jdcoem.ac.in",
    displayName: "Sanskruti Tidke",
    photoURL: null,
    role: "STUDENT",
    isCollegeStudent: true,
    firstName: "Sanskruti",
    lastName: "Tidke",
    btId: "BT240115DS",
    department: "CSE(Data Science)",
    year: "3rd Year",
    phone: "9075828232",
    profileCompleted: true,
    designationBadge: "Event Club Co-Head",
    isCouncilOfficer: true,
    lastActive: "2026-08-31T01:00:00.000Z",
    createdAt: "2026-08-31T01:00:00.000Z",
  },
  {
    uid: "iDFtmVqzbSNmS3AMLINVp7x45iU2",
    email: "shendeha@jdcoem.ac.in",
    displayName: "Harsh Shende",
    photoURL: null,
    role: "COUNCIL_ADMIN",
    isCollegeStudent: true,
    firstName: "Harsh",
    lastName: "Shende",
    btId: "BT230036CS",
    department: "Computer Science and Engineering",
    year: "4th Year / Final Year",
    phone: "",
    profileCompleted: true,
    designationBadge: "Technical Affairs Secretary",
    isCouncilOfficer: true,
    lastActive: "2026-08-31T01:00:00.000Z",
    createdAt: "2026-08-30T18:00:00.000Z",
  },
];

/**
 * Retrieve all registered active users from local storage or defaults
 */
export function getStoredUsers(): RegisteredUserRecord[] {
  let list: RegisteredUserRecord[] = DEFAULT_REGISTERED_USERS;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(USERS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map<string, RegisteredUserRecord>();
          for (const u of DEFAULT_REGISTERED_USERS) {
            if (u.email) map.set(u.email.toLowerCase(), u);
          }
          for (const u of parsed) {
            if (u && u.email) {
              const key = u.email.toLowerCase();
              const existing = map.get(key);
              if (key === "sanskrutitidke@jdcoem.ac.in" && u.year === "2nd Year") {
                u.year = "3rd Year";
                u.phone = u.phone || "9075828232";
              }
              map.set(key, { ...(existing || {}), ...u });
            }
          }
          list = Array.from(map.values());
        }
      }
    } catch (e) {
      console.warn("Could not read users from storage", e);
    }
  }

  // Dynamically resolve designation badge & council status from live rosters
  return list.map((user) => {
    const cleanBtId = user.btId ? user.btId.trim().toUpperCase() : "";
    const designationInfo = cleanBtId ? resolveDesignationByBtId(cleanBtId, user.name || user.email) : null;
    return {
      ...user,
      btId: cleanBtId,
      designationBadge: designationInfo 
        ? designationInfo.designationBadge 
        : (cleanBtId ? undefined : (formatDesignationBadge(user.designationBadge) || undefined)),
      isCouncilOfficer: designationInfo ? designationInfo.isCouncilOfficer : (cleanBtId ? false : Boolean(user.isCouncilOfficer)),
    };
  });
}

/**
 * Merge an array of remote users from Firestore into localStorage.
 * Remote Firestore is authoritative for the user list to avoid resurrecting deleted accounts.
 */
export function mergeRemoteUsers(remoteUsers: Partial<RegisteredUserRecord>[]): RegisteredUserRecord[] {
  if (typeof window === "undefined" || !Array.isArray(remoteUsers)) return getStoredUsers();
  try {
    const current = getStoredUsers();
    const localMap = new Map<string, RegisteredUserRecord>();
    for (const u of current) {
      if (u.uid) localMap.set(u.uid, u);
      else if (u.email) localMap.set(u.email.toLowerCase(), u);
    }

    const map = new Map<string, RegisteredUserRecord>();

    // Process remote users as authoritative
    for (const r of remoteUsers) {
      if (!r || (!r.uid && !r.email)) continue;
      const localMatch = (r.uid ? localMap.get(r.uid) : null) || (r.email ? localMap.get(r.email.toLowerCase()) : null);
      const cleanBtId = (r.btId || localMatch?.btId || "").trim().toUpperCase();
      const designationInfo = cleanBtId ? resolveDesignationByBtId(cleanBtId, r.name || localMatch?.name || r.email) : null;
      const assignedRole = r.role || localMatch?.role || "STUDENT";
      // Dynamic roster resolution takes precedence for linked BT IDs to prevent stale cloud badges
      const assignedBadge = designationInfo 
        ? designationInfo.designationBadge 
        : (cleanBtId ? undefined : (formatDesignationBadge(r.designationBadge || localMatch?.designationBadge) || undefined));
      const isOfficer = designationInfo ? designationInfo.isCouncilOfficer : (cleanBtId ? false : Boolean(r.isCouncilOfficer || localMatch?.isCouncilOfficer));

      const isJdcoemStudent = Boolean(cleanBtId && cleanBtId.length >= 3) || 
        Boolean(r.email && (r.email.endsWith("@jdcoem.ac.in") || r.email.endsWith("@jdcoem.in"))) ||
        r.userType === "JDCOEM_STUDENT" || 
        localMatch?.userType === "JDCOEM_STUDENT";

      const resolvedUserType: "JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT" = assignedRole === "FACULTY" 
        ? "FACULTY" 
        : isJdcoemStudent || assignedRole === "COUNCIL_ADMIN" 
        ? "JDCOEM_STUDENT" 
        : (r.userType === "FACULTY" || r.userType === "EXTERNAL_STUDENT" || r.userType === "JDCOEM_STUDENT" ? r.userType : (localMatch?.userType || "EXTERNAL_STUDENT"));

      const resolvedIsCollegeStudent = assignedRole === "FACULTY" 
        ? true 
        : isJdcoemStudent 
        ? true 
        : Boolean(r.isCollegeStudent !== undefined ? r.isCollegeStudent : (localMatch?.isCollegeStudent ?? false));

      const resolvedCollegeName = isJdcoemStudent 
        ? ((r.collegeName && (r.collegeName.toLowerCase().includes("jdcoem") || r.collegeName.toLowerCase().includes("jd college"))) ? r.collegeName : "")
        : (r.collegeName !== undefined ? r.collegeName : (localMatch?.collegeName || ""));

      const record: RegisteredUserRecord = {
        ...(localMatch || {}),
        ...r,
        uid: r.uid || localMatch?.uid || `user-${Date.now()}`,
        email: r.email || localMatch?.email || "",
        displayName: r.displayName || localMatch?.displayName || `${r.firstName || ""} ${r.lastName || ""}`.trim() || "Student",
        photoURL: r.photoURL !== undefined ? r.photoURL : (localMatch?.photoURL || null),
        role: assignedRole,
        userType: resolvedUserType,
        isCollegeStudent: resolvedIsCollegeStudent,
        firstName: r.firstName || localMatch?.firstName || "",
        lastName: r.lastName || localMatch?.lastName || "",
        btId: cleanBtId,
        department: r.department || localMatch?.department || "Computer Science and Engineering",
        year: r.year || localMatch?.year || "3rd Year",
        phone: r.phone || localMatch?.phone || "",
        collegeName: resolvedCollegeName,
        city: isJdcoemStudent ? (r.city || localMatch?.city || "Nagpur") : (r.city || localMatch?.city || ""),
        degree: isJdcoemStudent ? "" : (r.degree || r.customBranch || localMatch?.degree || ""),
        customBranch: isJdcoemStudent ? "" : (r.customBranch || r.degree || localMatch?.customBranch || ""),
        title: r.title || localMatch?.title,
        facultyDesignation: r.facultyDesignation || localMatch?.facultyDesignation,
        facultyDepartment: r.facultyDepartment || localMatch?.facultyDepartment,
        facultyApprovalStatus: r.facultyApprovalStatus || localMatch?.facultyApprovalStatus,
        facultyApprovedAt: r.facultyApprovedAt || localMatch?.facultyApprovedAt,
        facultyApprovedBy: r.facultyApprovedBy || localMatch?.facultyApprovedBy,
        employeeId: r.employeeId || localMatch?.employeeId,
        profileCompleted: r.profileCompleted ?? localMatch?.profileCompleted ?? true,
        designationBadge: assignedBadge,
        isCouncilOfficer: isOfficer,
        isDeleted: r.isDeleted !== undefined ? r.isDeleted : (localMatch?.isDeleted || false),
        deletedAt: r.deletedAt || localMatch?.deletedAt,
        status: r.status || localMatch?.status || (r.isDeleted ? "deleted" : "active"),
        lastActive: r.lastActive || localMatch?.lastActive || new Date().toISOString(),
        createdAt: r.createdAt || localMatch?.createdAt || new Date().toISOString(),
      };

      // Auto-repair in Firestore if remote user has a valid BT ID but was miscategorized as EXTERNAL_STUDENT or Other College
      if (r.uid && isJdcoemStudent && (r.userType === "EXTERNAL_STUDENT" || r.collegeName === "Other College" || r.isCollegeStudent === false)) {
        saveUserProfileToFirestore(r.uid, {
          userType: "JDCOEM_STUDENT",
          isCollegeStudent: true,
          collegeName: "",
          btId: cleanBtId,
        }).catch(() => {});
      }

      // If active session belongs to this user, synchronize session state
      if (typeof window !== "undefined" && isJdcoemStudent) {
        try {
          const rawAuth = localStorage.getItem("src_auth_user");
          if (rawAuth) {
            const authUser = JSON.parse(rawAuth);
            if (authUser.uid === record.uid || (authUser.email && record.email && authUser.email.toLowerCase() === record.email.toLowerCase())) {
              if (authUser.userType !== "JDCOEM_STUDENT" || authUser.collegeName === "Other College" || authUser.isCollegeStudent === false || !authUser.btId) {
                authUser.userType = "JDCOEM_STUDENT";
                authUser.isCollegeStudent = true;
                authUser.collegeName = "";
                authUser.btId = cleanBtId || authUser.btId;
                authUser.designationBadge = assignedBadge || authUser.designationBadge;
                authUser.isCouncilOfficer = isOfficer;
                localStorage.setItem("src_auth_user", JSON.stringify(authUser));
                sessionStorage.setItem("src_auth_user", JSON.stringify(authUser));
                window.dispatchEvent(new CustomEvent("src_auth_state_changed", { detail: authUser }));
              }
            }
          }
        } catch {}
      }

      const key = record.uid || (record.email ? record.email.toLowerCase() : "");
      if (key) {
        map.set(key, record);
      }
    }

    const mergedList = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(mergedList));
    window.dispatchEvent(new CustomEvent("src_users_updated", { detail: mergedList }));
    return mergedList;
  } catch (e) {
    console.warn("Could not merge remote users", e);
    return getStoredUsers();
  }
}

/**
 * Trigger an asynchronous fetch and sync from Firestore
 */
export async function syncUsersFromFirestore(): Promise<RegisteredUserRecord[]> {
  try {
    const remote = await getAllUsersFromFirestore();
    if (remote && remote.length > 0) {
      return mergeRemoteUsers(remote as RegisteredUserRecord[]);
    }
  } catch (e) {
    console.warn("Could not sync users from Firestore", e);
  }
  return getStoredUsers();
}

/**
 * Save or update a registered user record in both localStorage and Firestore
 */
export function saveRegisteredUser(user: Partial<RegisteredUserRecord>): void {
  if (typeof window === "undefined" || !user.uid) return;
  try {
    const current = getStoredUsers();
    const existingIndex = current.findIndex((u) => u.uid === user.uid || (user.email && u.email === user.email));
    const existing = existingIndex >= 0 ? current[existingIndex] : null;
    
    // Resolve designation badge based on BT ID
    const cleanBtId = (user.btId !== undefined ? user.btId : existing?.btId || "").trim().toUpperCase();
    const designationInfo = cleanBtId ? resolveDesignationByBtId(cleanBtId, user.name || existing?.name || user.email) : null;

    const assignedRole = user.role || existing?.role || "STUDENT";
    const assignedBadge = designationInfo 
      ? designationInfo.designationBadge 
      : (cleanBtId ? undefined : (formatDesignationBadge(user.designationBadge || existing?.designationBadge) || undefined));
    const isOfficer = designationInfo ? designationInfo.isCouncilOfficer : (cleanBtId ? false : Boolean(user.isCouncilOfficer || existing?.isCouncilOfficer));

    const now = new Date().toISOString();
    const isJdcoemStudent = Boolean(cleanBtId && cleanBtId.length >= 3) || 
      Boolean(user.email && (user.email.endsWith("@jdcoem.ac.in") || user.email.endsWith("@jdcoem.in"))) ||
      user.userType === "JDCOEM_STUDENT" || 
      existing?.userType === "JDCOEM_STUDENT";

    const resolvedUserType: "JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT" = assignedRole === "FACULTY" 
      ? "FACULTY" 
      : isJdcoemStudent || assignedRole === "COUNCIL_ADMIN" 
      ? "JDCOEM_STUDENT" 
      : (user.userType === "FACULTY" || user.userType === "EXTERNAL_STUDENT" || user.userType === "JDCOEM_STUDENT" ? user.userType : (existing?.userType || "EXTERNAL_STUDENT"));

    const resolvedIsCollegeStudent = assignedRole === "FACULTY" 
      ? true 
      : isJdcoemStudent 
      ? true 
      : Boolean(user.isCollegeStudent !== undefined ? user.isCollegeStudent : (existing?.isCollegeStudent ?? false));

    const resolvedCollegeName = isJdcoemStudent 
      ? ((user.collegeName && (user.collegeName.toLowerCase().includes("jdcoem") || user.collegeName.toLowerCase().includes("jd college"))) ? user.collegeName : "")
      : (user.collegeName !== undefined ? user.collegeName : (existing?.collegeName || ""));

    const record: RegisteredUserRecord = {
      ...(existing || {}),
      ...user,
      uid: user.uid,
      email: user.email || existing?.email || "",
      displayName: user.displayName || existing?.displayName || `${user.firstName || existing?.firstName || ""} ${user.lastName || existing?.lastName || ""}`.trim() || "Student",
      photoURL: user.photoURL !== undefined ? user.photoURL : (existing?.photoURL || null),
      role: assignedRole,
      userType: resolvedUserType,
      isCollegeStudent: resolvedIsCollegeStudent,
      firstName: user.firstName !== undefined ? user.firstName : (existing?.firstName || ""),
      lastName: user.lastName !== undefined ? user.lastName : (existing?.lastName || ""),
      btId: cleanBtId,
      department: user.department || existing?.department || "Basic Science & Humanities Dept.",
      year: user.year || existing?.year || "1st Year",
      phone: user.phone !== undefined ? user.phone : (existing?.phone || ""),
      profileCompleted: user.profileCompleted !== undefined ? user.profileCompleted : (existing?.profileCompleted !== undefined ? existing.profileCompleted : true),
      designationBadge: assignedBadge,
      isCouncilOfficer: isOfficer,

      // Faculty fields
      title: user.title !== undefined ? user.title : existing?.title,
      facultyDesignation: user.facultyDesignation !== undefined ? user.facultyDesignation : existing?.facultyDesignation,
      facultyDepartment: user.facultyDepartment !== undefined ? user.facultyDepartment : existing?.facultyDepartment,
      facultyApprovalStatus: user.facultyApprovalStatus || existing?.facultyApprovalStatus || (assignedRole === "FACULTY" ? "pending" : undefined),
      facultyApprovedAt: user.facultyApprovedAt || existing?.facultyApprovedAt,
      facultyApprovedBy: user.facultyApprovedBy || existing?.facultyApprovedBy,
      employeeId: user.employeeId !== undefined ? user.employeeId : existing?.employeeId,

      // External student fields
      collegeName: resolvedCollegeName,
      city: isJdcoemStudent ? (user.city || existing?.city || "Nagpur") : (user.city !== undefined ? user.city : existing?.city),
      degree: isJdcoemStudent ? "" : (user.degree || user.customBranch || existing?.degree || existing?.customBranch || ""),
      customBranch: isJdcoemStudent ? "" : (user.customBranch || user.degree || existing?.customBranch || existing?.degree || ""),

      isDeleted: user.isDeleted !== undefined ? user.isDeleted : (existing?.isDeleted || false),
      deletedAt: user.deletedAt || existing?.deletedAt,
      status: user.status || existing?.status || (user.isDeleted ? "deleted" : "active"),

      lastActive: now,
      createdAt: existing?.createdAt || now,
    };

    let updated: RegisteredUserRecord[];
    if (existingIndex >= 0) {
      updated = current.map((u, i) => (i === existingIndex ? { ...u, ...record } : u));
    } else {
      updated = [record, ...current];
    }

    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("src_users_updated", { detail: updated }));

    // Also persist to Firestore
    saveUserProfileToFirestore(record.uid, record);

    if (record.email) {
      if (record.role === "COUNCIL_ADMIN") {
        saveAdminRecordToFirestore(record.email, {
          role: "COUNCIL_ADMIN",
          uid: record.uid,
          active: true,
          appointedAt: new Date().toISOString(),
        }).catch((err) => console.warn("Failed to sync admin record to Firestore:", err));
      } else if (existing?.role === "COUNCIL_ADMIN") {
        removeAdminRecordFromFirestore(record.email).catch((err) =>
          console.warn("Failed to remove admin record from Firestore:", err)
        );
      }
    }
  } catch (e) {
    console.error("Could not save registered user", e);
  }
}

/**
 * Approve a pending faculty registration
 */
export function approveFacultyUser(uid: string, adminEmail = "SRC Central Council"): RegisteredUserRecord[] {
  const current = getStoredUsers();
  const now = new Date().toISOString();
  const updated = current.map((u) => {
    if (u.uid === uid) {
      return {
        ...u,
        role: "FACULTY" as const,
        userType: "FACULTY" as const,
        facultyApprovalStatus: "approved" as const,
        facultyApprovedAt: now,
        facultyApprovedBy: adminEmail,
      };
    }
    return u;
  });

  if (typeof window !== "undefined") {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("src_users_updated", { detail: updated }));
    saveUserProfileToFirestore(uid, {
      role: "FACULTY",
      userType: "FACULTY",
      facultyApprovalStatus: "approved",
      facultyApprovedAt: now,
      facultyApprovedBy: adminEmail,
    });
  }
  return updated;
}

/**
 * Reject or Revoke a faculty registration
 */
export function rejectFacultyUser(uid: string): RegisteredUserRecord[] {
  const current = getStoredUsers();
  const updated = current.map((u) => {
    if (u.uid === uid) {
      return {
        ...u,
        facultyApprovalStatus: "rejected" as const,
      };
    }
    return u;
  });

  if (typeof window !== "undefined") {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("src_users_updated", { detail: updated }));
    saveUserProfileToFirestore(uid, {
      facultyApprovalStatus: "rejected",
    });
  }
  return updated;
}

/**
 * Get all users currently pending faculty approval
 */
export function getPendingFacultyApprovals(): RegisteredUserRecord[] {
  const users = getStoredUsers();
  return users.filter(
    (u) => (u.role === "FACULTY" || u.userType === "FACULTY") && u.facultyApprovalStatus === "pending"
  );
}

/**
 * Mark a registered user account as permanently deleted (syncs to Firestore & localStorage)
 */
export function markUserAsDeleted(uid: string): RegisteredUserRecord[] {
  const current = getStoredUsers();
  const now = new Date().toISOString();
  const updated = current.map((u) => {
    if (u.uid === uid) {
      return {
        ...u,
        isDeleted: true,
        status: "deleted" as const,
        deletedAt: now,
      };
    }
    return u;
  });

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    window.dispatchEvent(new CustomEvent("src_users_updated", { detail: updated }));
    saveUserProfileToFirestore(uid, {
      isDeleted: true,
      status: "deleted",
      deletedAt: now,
    });
  }
  return updated;
}

/**
 * Delete a user by marking their account status as deleted
 */
export function deleteRegisteredUser(uid: string): RegisteredUserRecord[] {
  return markUserAsDeleted(uid);
}

/**
 * Completely purge a user record from localStorage (admin hard-delete)
 */
export function purgeRegisteredUser(uid: string): RegisteredUserRecord[] {
  const current = getStoredUsers();
  const updated = current.filter((u) => u.uid !== uid);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    window.dispatchEvent(new CustomEvent("src_users_updated", { detail: updated }));
  }
  return updated;
}

/**
 * Find a registered user by their BT ID (synchronous, local storage only)
 */
export function findRegisteredUserByBtId(btId: string): RegisteredUserRecord | undefined {
  if (!btId || !btId.trim()) return undefined;
  const cleanBtId = btId.trim().toUpperCase();
  const users = getStoredUsers();
  return users.find((u) => u.btId && u.btId.trim().toUpperCase() === cleanBtId);
}

/**
 * Look up a user by BT ID — async version that also checks Firestore
 * Returns the user record if found, or null if the BT ID is not registered
 */
export async function lookupUserByBtId(btId: string): Promise<RegisteredUserRecord | null> {
  if (!btId || !btId.trim()) return null;
  const cleanBtId = btId.trim().toUpperCase();

  // 1. Check local storage first
  const localMatch = findRegisteredUserByBtId(cleanBtId);
  if (localMatch) return localMatch;

  // 2. Attempt Firestore sync and re-check
  try {
    const synced = await syncUsersFromFirestore();
    const remoteMatch = synced.find(
      (u) => u.btId && u.btId.trim().toUpperCase() === cleanBtId
    );
    if (remoteMatch) return remoteMatch;
  } catch (e) {
    console.warn("Firestore lookup fallback", e);
  }

  return null;
}

/**
 * Change user role (e.g. STUDENT <-> COUNCIL_ADMIN)
 */
export function changeUserRole(uid: string, newRole: "STUDENT" | "COUNCIL_ADMIN"): RegisteredUserRecord[] {
  const current = getStoredUsers();
  const targetUser = current.find((u) => u.uid === uid);
  const updated = current.map((u) => (u.uid === uid ? { ...u, role: newRole } : u));
  if (typeof window !== "undefined") {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("src_users_updated", { detail: updated }));
    saveUserProfileToFirestore(uid, { role: newRole });

    if (targetUser?.email) {
      if (newRole === "COUNCIL_ADMIN") {
        saveAdminRecordToFirestore(targetUser.email, {
          role: "COUNCIL_ADMIN",
          uid,
          active: true,
          appointedAt: new Date().toISOString(),
        }).catch((err) => console.warn("Failed to sync admin record to /admins:", err));
      } else {
        removeAdminRecordFromFirestore(targetUser.email).catch((err) =>
          console.warn("Failed to remove admin record from /admins:", err)
        );
      }
    }
  }
  return updated;
}

/**
 * Reconcile all registered student user designation badges against the live council and club rosters.
 * Heals local storage and persists updated badges to Cloud Firestore.
 */
export async function reconcileAllUserDesignations(): Promise<RegisteredUserRecord[]> {
  const current = getStoredUsers();
  let changedCount = 0;
  const updated = current.map((u) => {
    const cleanBtId = u.btId ? u.btId.trim().toUpperCase() : "";
    const designationInfo = cleanBtId ? resolveDesignationByBtId(cleanBtId, u.name || u.email) : null;
    const newBadge = designationInfo ? designationInfo.designationBadge : (cleanBtId ? undefined : (formatDesignationBadge(u.designationBadge) || undefined));
    const newOfficer = designationInfo ? designationInfo.isCouncilOfficer : (cleanBtId ? false : Boolean(u.isCouncilOfficer));

    if (u.designationBadge !== newBadge || u.isCouncilOfficer !== newOfficer) {
      changedCount++;
      const fixed: RegisteredUserRecord = {
        ...u,
        btId: cleanBtId,
        designationBadge: newBadge,
        isCouncilOfficer: newOfficer,
      };
      if (u.uid) {
        saveUserProfileToFirestore(u.uid, {
          designationBadge: newBadge || (null as any),
          isCouncilOfficer: newOfficer,
        }).catch((err) => console.warn("Failed to heal cloud user badge:", err));
      }
      return fixed;
    }
    return u;
  });

  if (changedCount > 0 && typeof window !== "undefined") {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    window.dispatchEvent(new CustomEvent("src_users_updated", { detail: updated }));
  }

  return updated;
}
