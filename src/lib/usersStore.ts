import { AuthUser, UserProfile } from "@/types/auth";
import { getAllUsersFromFirestore, saveUserProfileToFirestore } from "./firebase/firestore";
import { 
  getStoredCouncilMembers, 
  getStoredHostingCommittee, 
  getStoredSpokespersons, 
  getStoredClubs 
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
 * Resolve special council badging, designations, and privileges attached to a BT ID
 */
export function resolveDesignationByBtId(btId: string): { 
  designationBadge: string; 
  isCouncilOfficer: boolean; 
  role: "COUNCIL_ADMIN" | "STUDENT";
  category?: string;
} | null {
  if (!btId || !btId.trim()) return null;
  const cleanBtId = btId.trim().toUpperCase();

  // 1. Check Executive Admin Council
  const council = getStoredCouncilMembers();
  const matchedCouncil = council.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedCouncil) {
    return {
      designationBadge: `${matchedCouncil.role} • Central Council`,
      isCouncilOfficer: true,
      role: "COUNCIL_ADMIN",
      category: "Admin Council",
    };
  }

  // 2. Check Hosting Committee
  const hosting = getStoredHostingCommittee();
  const matchedHosting = hosting.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedHosting) {
    return {
      designationBadge: `${matchedHosting.role} • Hosting Secretariat`,
      isCouncilOfficer: true,
      role: "COUNCIL_ADMIN",
      category: "Hosting Committee",
    };
  }

  // 3. Check Spokespersons
  const spokes = getStoredSpokespersons();
  const matchedSpokes = spokes.find((m) => m.btId && m.btId.trim().toUpperCase() === cleanBtId);
  if (matchedSpokes) {
    return {
      designationBadge: `${matchedSpokes.role} • SRC Spokesperson`,
      isCouncilOfficer: true,
      role: "COUNCIL_ADMIN",
      category: "Spokesperson",
    };
  }

  // 4. Check Chartered Clubs (Head / Co-Head)
  const clubs = getStoredClubs();
  for (const club of clubs) {
    if (club.lead?.btId && club.lead.btId.trim().toUpperCase() === cleanBtId) {
      return {
        designationBadge: `Head • ${club.name}`,
        isCouncilOfficer: true,
        role: "COUNCIL_ADMIN",
        category: "Club Leadership",
      };
    }
    if (club.coLead?.btId && club.coLead.btId.trim().toUpperCase() === cleanBtId) {
      return {
        designationBadge: `Co-Head • ${club.name}`,
        isCouncilOfficer: true,
        role: "COUNCIL_ADMIN",
        category: "Club Leadership",
      };
    }
  }

  return null;
}

/**
 * Retrieve all registered active users from local storage
 */
export function getStoredUsers(): RegisteredUserRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Could not read users from storage", e);
  }
  return [];
}

/**
 * Save or update a registered user record in both localStorage and Firestore
 */
export function saveRegisteredUser(user: Partial<RegisteredUserRecord>): void {
  if (typeof window === "undefined" || !user.uid) return;
  try {
    const current = getStoredUsers();
    const existingIndex = current.findIndex((u) => u.uid === user.uid || (user.email && u.email === user.email));
    
    // Resolve designation badge based on BT ID
    const cleanBtId = user.btId ? user.btId.trim().toUpperCase() : "";
    const designationInfo = cleanBtId ? resolveDesignationByBtId(cleanBtId) : null;

    const assignedRole = designationInfo ? designationInfo.role : (user.role || "STUDENT");
    const assignedBadge = designationInfo ? designationInfo.designationBadge : user.designationBadge;
    const isOfficer = designationInfo ? true : Boolean(user.isCouncilOfficer);

    const now = new Date().toISOString();
    const record: RegisteredUserRecord = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Student",
      photoURL: user.photoURL || null,
      role: assignedRole,
      isCollegeStudent: user.isCollegeStudent ?? true,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      btId: cleanBtId,
      department: user.department || "Basic Science & Humanities Dept.",
      year: user.year || "1st Year",
      phone: user.phone || "",
      profileCompleted: user.profileCompleted ?? true,
      designationBadge: assignedBadge,
      isCouncilOfficer: isOfficer,
      lastActive: now,
      createdAt: existingIndex >= 0 ? current[existingIndex].createdAt || now : now,
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
