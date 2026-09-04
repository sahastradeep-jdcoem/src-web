import { AuthUser, UserProfile } from "@/types/auth";
import { getAllUsersFromFirestore, saveUserProfileToFirestore } from "./firebase/firestore";
import { 
  getStoredCouncilMembers, 
  getStoredHostingCommittee, 
  getStoredSpokespersons, 
  getStoredClubs,
  getStoredFoundingMembers,
  getClubLeaders
} from "./councilStore";

const USERS_STORAGE_KEY = "src_registered_users";

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
 * Resolve special council badging and designations attached to a BT ID
 */
export function resolveDesignationByBtId(btId: string): { 
  designationBadge: string; 
  isCouncilOfficer: boolean; 
  category?: string;
} | null {
  if (!btId || !btId.trim()) return null;
  const cleanBtId = btId.trim().toUpperCase();

  // 1. Check Admin Council
  const council = getStoredCouncilMembers();
  const matchedCouncil = council.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedCouncil) {
    return {
      designationBadge: matchedCouncil.role,
      isCouncilOfficer: true,
      category: "Admin Council",
    };
  }

  // 2. Check Hosting Committee
  const hosting = getStoredHostingCommittee();
  const matchedHosting = hosting.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedHosting) {
    return {
      designationBadge: matchedHosting.role,
      isCouncilOfficer: true,
      category: "Hosting Committee",
    };
  }

  // 3. Check Spokespersons
  const spokes = getStoredSpokespersons();
  const matchedSpokes = spokes.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedSpokes) {
    return {
      designationBadge: matchedSpokes.role,
      isCouncilOfficer: true,
      category: "Spokesperson",
    };
  }

  // 4. Check Chartered Clubs (Head / Co-Head)
  const clubs = getStoredClubs();
  for (const club of clubs) {
    const leaders = getClubLeaders(club);
    for (const leader of leaders) {
      if (leader.btId && leader.btId.trim().toUpperCase() === cleanBtId) {
        const isCoLead = leader.roleType === "coLead" || (leader.role && leader.role.toLowerCase().includes("co-head"));
        const rolePrefix = isCoLead ? "Club Co-Head" : "Club Head";
        return {
          designationBadge: `${rolePrefix} • ${club.name}`,
          isCouncilOfficer: true,
          category: "Club Leadership",
        };
      }
    }
  }

  // 5. Check Founding Members
  const founders = getStoredFoundingMembers();
  const matchedFounder = founders.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedFounder) {
    return {
      designationBadge: matchedFounder.role,
      isCouncilOfficer: true,
      category: "Founding Council",
    };
  }

  return null;
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
    department: "Data Science Engineering",
    year: "3rd Year",
    phone: "9075828232",
    profileCompleted: true,
    designationBadge: "Club Co-Head • Event Club",
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

  // Dynamically resolve designation badge & council status if not already authoritative
  return list.map((user) => {
    const cleanBtId = user.btId ? user.btId.trim().toUpperCase() : "";
    const designationInfo = cleanBtId ? resolveDesignationByBtId(cleanBtId) : null;
    if (designationInfo) {
      return {
        ...user,
        btId: cleanBtId,
        designationBadge: user.designationBadge || designationInfo.designationBadge,
        isCouncilOfficer: true,
      };
    }
    return user;
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
      const cleanBtId = r.btId ? r.btId.trim().toUpperCase() : "";
      const designationInfo = cleanBtId ? resolveDesignationByBtId(cleanBtId) : null;
      const assignedRole = r.role || "STUDENT";
      // Firestore badge is authoritative; fallback to dynamic resolution if absent
      const assignedBadge = r.designationBadge || (designationInfo ? designationInfo.designationBadge : undefined);

      const localMatch = (r.uid ? localMap.get(r.uid) : null) || (r.email ? localMap.get(r.email.toLowerCase()) : null);

      const record: RegisteredUserRecord = {
        ...(localMatch || {}),
        ...r,
        uid: r.uid || localMatch?.uid || `user-${Date.now()}`,
        email: r.email || localMatch?.email || "",
        displayName: r.displayName || localMatch?.displayName || `${r.firstName || ""} ${r.lastName || ""}`.trim() || "Student",
        photoURL: r.photoURL !== undefined ? r.photoURL : (localMatch?.photoURL || null),
        role: assignedRole,
        userType: r.userType || localMatch?.userType || (assignedRole === "FACULTY" ? "FACULTY" : cleanBtId ? "JDCOEM_STUDENT" : "EXTERNAL_STUDENT"),
        isCollegeStudent: r.isCollegeStudent !== undefined ? r.isCollegeStudent : (assignedRole === "FACULTY" ? true : Boolean(cleanBtId)),
        firstName: r.firstName || localMatch?.firstName || "",
        lastName: r.lastName || localMatch?.lastName || "",
        btId: cleanBtId || localMatch?.btId || "",
        department: r.department || localMatch?.department || "Computer Science and Engineering",
        year: r.year || localMatch?.year || "3rd Year",
        phone: r.phone || localMatch?.phone || "",
        collegeName: r.collegeName || localMatch?.collegeName || "",
        city: r.city || localMatch?.city || "",
        degree: r.degree || r.customBranch || localMatch?.degree || "",
        customBranch: r.customBranch || r.degree || localMatch?.customBranch || "",
        title: r.title || localMatch?.title,
        facultyDesignation: r.facultyDesignation || localMatch?.facultyDesignation,
        facultyDepartment: r.facultyDepartment || localMatch?.facultyDepartment,
        facultyApprovalStatus: r.facultyApprovalStatus || localMatch?.facultyApprovalStatus,
        facultyApprovedAt: r.facultyApprovedAt || localMatch?.facultyApprovedAt,
        facultyApprovedBy: r.facultyApprovedBy || localMatch?.facultyApprovedBy,
        employeeId: r.employeeId || localMatch?.employeeId,
        profileCompleted: r.profileCompleted ?? localMatch?.profileCompleted ?? true,
        designationBadge: assignedBadge || localMatch?.designationBadge,
        isCouncilOfficer: (assignedBadge || designationInfo) ? true : Boolean(r.isCouncilOfficer || localMatch?.isCouncilOfficer),
        lastActive: r.lastActive || localMatch?.lastActive || new Date().toISOString(),
        createdAt: r.createdAt || localMatch?.createdAt || new Date().toISOString(),
      };

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
    const designationInfo = cleanBtId ? resolveDesignationByBtId(cleanBtId) : null;

    const assignedRole = user.role || existing?.role || "STUDENT";
    const assignedBadge = designationInfo ? designationInfo.designationBadge : (user.designationBadge || existing?.designationBadge);
    const isOfficer = designationInfo ? true : Boolean(user.isCouncilOfficer || existing?.isCouncilOfficer);

    const now = new Date().toISOString();
    const record: RegisteredUserRecord = {
      ...(existing || {}),
      ...user,
      uid: user.uid,
      email: user.email || existing?.email || "",
      displayName: user.displayName || existing?.displayName || `${user.firstName || existing?.firstName || ""} ${user.lastName || existing?.lastName || ""}`.trim() || "Student",
      photoURL: user.photoURL !== undefined ? user.photoURL : (existing?.photoURL || null),
      role: assignedRole,
      userType: user.userType || existing?.userType || (assignedRole === "FACULTY" ? "FACULTY" : cleanBtId ? "JDCOEM_STUDENT" : "EXTERNAL_STUDENT"),
      isCollegeStudent: user.isCollegeStudent !== undefined ? user.isCollegeStudent : (existing?.isCollegeStudent !== undefined ? existing.isCollegeStudent : (assignedRole === "FACULTY" ? true : Boolean(cleanBtId))),
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
      collegeName: user.collegeName !== undefined ? user.collegeName : existing?.collegeName,
      city: user.city !== undefined ? user.city : existing?.city,
      degree: user.degree || user.customBranch || existing?.degree || existing?.customBranch || "",
      customBranch: user.customBranch || user.degree || existing?.customBranch || existing?.degree || "",

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
 * Delete a user from active roster
 */
export function deleteRegisteredUser(uid: string): RegisteredUserRecord[] {
  const current = getStoredUsers();
  const updated = current.filter((u) => u.uid !== uid);
  if (typeof window !== "undefined") {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
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
  const updated = current.map((u) => (u.uid === uid ? { ...u, role: newRole } : u));
  if (typeof window !== "undefined") {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("src_users_updated", { detail: updated }));
    saveUserProfileToFirestore(uid, { role: newRole });
  }
  return updated;
}
