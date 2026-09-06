import { 
  getSiteContentFromFirestore,
  cleanUndefined,
  saveSiteContentToFirestore,
  saveUserProfileToFirestore
} from "./firebase/firestore";
import { enqueueCloudWrite } from "./dataSyncEngine";
import { db } from "./firebase/config";
import { doc, setDoc } from "firebase/firestore";
import { getStoredUsers, USERS_STORAGE_KEY } from "./usersStore";
import { getStoredListingResponses, RESPONSES_STORAGE_KEY } from "./listingsStore";
import { getStoredCouncilMembers, saveStoredCouncilMembers } from "./councilStore";
import { getStoredTenures, saveStoredTenures } from "./tenureStore";
import { DEFAULT_DEPARTMENTS, DEPARTMENT_SHORT_NAMES } from "@/data/departments";

export { DEFAULT_DEPARTMENTS, DEPARTMENT_SHORT_NAMES };

/**
 * Returns short acronym form for departments (e.g. CSE, AI, IT, DS, CY, CE, EE, ME, ETC, MBA, BBA, MCA, DIP, BCA)
 */
export function getDepartmentShortName(deptName?: string | null): string {
  if (!deptName) return "";
  const trimmed = deptName.trim();
  if (DEPARTMENT_SHORT_NAMES[trimmed]) {
    return DEPARTMENT_SHORT_NAMES[trimmed];
  }
  
  const lower = trimmed.toLowerCase();
  if (lower.includes("data science")) return "DS";
  if (lower.includes("cyber security") || lower.includes("cyber")) return "CY";
  if (lower.includes("artificial intelligence") || lower === "ai") return "AI";
  if (lower.includes("computer science") || lower === "cse") return "CSE";
  if (lower.includes("information tech") || lower === "it") return "IT";
  if (lower.includes("civil") || lower === "ce") return "CE";
  if (lower.includes("electrical") || lower === "ee") return "EE";
  if (lower.includes("mechanical") || lower === "me") return "ME";
  if (lower.includes("telecommunication") || lower.includes("etc") || lower.includes("extc")) return "ETC";
  if (lower.includes("master of business") || lower === "mba") return "MBA";
  if (lower.includes("bachelor of business") || lower === "bba") return "BBA";
  if (lower.includes("bachelor of computer") || lower === "bca") return "BCA";
  if (lower.includes("master of computer") || lower === "mca") return "MCA";
  if (lower.includes("diploma") || lower === "dip") return "DIP";
  if (lower.includes("basic science") || lower.includes("humanities") || lower === "bsh") return "BSH";

  return trimmed;
}

export function getStoredDepartments(): string[] {
  if (typeof window === "undefined") return DEFAULT_DEPARTMENTS;
  try {
    const stored = localStorage.getItem("src_departments");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read stored departments", e);
  }
  return DEFAULT_DEPARTMENTS;
}

export function saveStoredDepartments(departments: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(departments);
    try { localStorage.setItem("src_departments", JSON.stringify(sanitized)); } catch {}
    window.dispatchEvent(new CustomEvent("src_departments_updated", { detail: sanitized }));
    saveSiteContentToFirestore("departments", sanitized).catch((err) => { console.warn("Firestore direct write for departments failed, enqueuing:", err); });
    enqueueCloudWrite("departments", sanitized, `Academic Departments (${departments.length} Branches)`);
  } catch (e) {
    console.error("Could not save departments", e);
  }
}

export async function syncDepartmentsFromFirestore(): Promise<string[]> {
  try {
    const remote = await getSiteContentFromFirestore<string[]>("departments");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      if (typeof window !== "undefined") {
        localStorage.setItem("src_departments", JSON.stringify(remote));
        window.dispatchEvent(new CustomEvent("src_departments_updated", { detail: remote }));
      }
      return remote;
    }
  } catch {}
  return getStoredDepartments();
}

export function resetStoredDepartments(): string[] {
  if (typeof window === "undefined") return DEFAULT_DEPARTMENTS;
  try {
    localStorage.removeItem("src_departments");
    window.dispatchEvent(new CustomEvent("src_departments_updated", { detail: DEFAULT_DEPARTMENTS }));
    enqueueCloudWrite("departments", DEFAULT_DEPARTMENTS, "Reset Academic Departments");
  } catch (e) {
    console.error("Could not reset departments", e);
  }
  return DEFAULT_DEPARTMENTS;
}

/**
 * Cascades an edited department name across all registered student and faculty profiles,
 * active sessions, listing responses, and council/tenure rosters.
 *
 * e.g. "Data Science Engineering" -> "DS"
 */
export async function cascadeDepartmentRename(oldDeptName: string, newDeptName: string): Promise<{
  usersCount: number;
  responsesCount: number;
  councilCount: number;
}> {
  const cleanOld = oldDeptName?.trim();
  const cleanNew = newDeptName?.trim();
  if (!cleanOld || !cleanNew || cleanOld.toLowerCase() === cleanNew.toLowerCase()) {
    return { usersCount: 0, responsesCount: 0, councilCount: 0 };
  }

  let usersCount = 0;
  let responsesCount = 0;
  let councilCount = 0;

  // 1. Cascade to Registered Users
  try {
    const currentUsers = getStoredUsers();
    let usersModified = false;
    const updatedUsers = currentUsers.map((u) => {
      let changed = false;
      let newDept = u.department;
      let newFacDept = u.facultyDepartment;

      if (u.department && u.department.trim().toLowerCase() === cleanOld.toLowerCase()) {
        newDept = cleanNew;
        changed = true;
      }
      if (u.facultyDepartment && u.facultyDepartment.trim().toLowerCase() === cleanOld.toLowerCase()) {
        newFacDept = cleanNew;
        changed = true;
      }

      if (changed) {
        usersCount++;
        usersModified = true;
        if (u.uid) {
          saveUserProfileToFirestore(u.uid, {
            department: newDept,
            facultyDepartment: newFacDept,
          }).catch((err) => console.warn("Failed to sync updated department to user Firestore doc:", err));
        }
        return {
          ...u,
          department: newDept,
          facultyDepartment: newFacDept,
        };
      }
      return u;
    });

    if (usersModified && typeof window !== "undefined") {
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
        window.dispatchEvent(new CustomEvent("src_users_updated", { detail: updatedUsers }));
      } catch {}
    }

    // Update active user session in localStorage/sessionStorage
    if (typeof window !== "undefined") {
      try {
        const rawAuth = localStorage.getItem("src_auth_user") || sessionStorage.getItem("src_auth_user");
        if (rawAuth) {
          const authUser = JSON.parse(rawAuth);
          let authChanged = false;
          if (authUser.department && authUser.department.trim().toLowerCase() === cleanOld.toLowerCase()) {
            authUser.department = cleanNew;
            authChanged = true;
          }
          if (authUser.facultyDepartment && authUser.facultyDepartment.trim().toLowerCase() === cleanOld.toLowerCase()) {
            authUser.facultyDepartment = cleanNew;
            authChanged = true;
          }
          if (authChanged) {
            localStorage.setItem("src_auth_user", JSON.stringify(authUser));
            sessionStorage.setItem("src_auth_user", JSON.stringify(authUser));
          }
        }
      } catch {}
    }
  } catch (e) {
    console.warn("Error cascading department rename across users:", e);
  }

  // 2. Cascade to Listing Responses
  try {
    const responses = getStoredListingResponses();
    let responsesModified = false;
    const updatedResponses = responses.map((r) => {
      if (r.userDepartment && r.userDepartment.trim().toLowerCase() === cleanOld.toLowerCase()) {
        responsesCount++;
        responsesModified = true;
        return {
          ...r,
          userDepartment: cleanNew,
          updatedAt: new Date().toISOString(),
        };
      }
      return r;
    });

    if (responsesModified && typeof window !== "undefined") {
      try {
        localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(updatedResponses));
        window.dispatchEvent(new CustomEvent("src_listing_responses_updated", { detail: updatedResponses }));
      } catch {}

      saveSiteContentToFirestore("listing_responses", updatedResponses).catch(() => {});
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const firestoreDb = db;
        updatedResponses.forEach((rec) => {
          if (rec.userDepartment === cleanNew && rec.listingType !== "poll") {
            const expectedDocId = `hub_sub_${rec.ticketCode || rec.id}`;
            const regDocRef = doc(firestoreDb, "registrations", expectedDocId);
            setDoc(
              regDocRef,
              cleanUndefined({
                department: cleanNew,
                "customAnswers.userDepartment": cleanNew,
                updatedAt: new Date().toISOString(),
              }),
              { merge: true }
            ).catch(() => {});
          }
        });
      }
    }
  } catch (e) {
    console.warn("Error cascading department rename across listing responses:", e);
  }

  // 3. Cascade to Council Members
  try {
    const council = getStoredCouncilMembers();
    let councilModified = false;
    const updatedCouncil = council.map((m) => {
      if (m.department && m.department.trim().toLowerCase() === cleanOld.toLowerCase()) {
        councilCount++;
        councilModified = true;
        return {
          ...m,
          department: cleanNew,
        };
      }
      return m;
    });

    if (councilModified) {
      saveStoredCouncilMembers(updatedCouncil);
    }
  } catch (e) {
    console.warn("Error cascading department rename across council members:", e);
  }

  // 4. Cascade to Tenures
  try {
    const tenures = getStoredTenures();
    let tenuresModified = false;
    const mapMemberList = (list?: any[]) => {
      if (!Array.isArray(list)) return list;
      return list.map((m) => {
        if (m && m.department && typeof m.department === "string" && m.department.trim().toLowerCase() === cleanOld.toLowerCase()) {
          tenuresModified = true;
          return { ...m, department: cleanNew };
        }
        return m;
      });
    };

    const updatedTenures = tenures.map((t) => {
      const updatedAdmin = mapMemberList(t.adminCouncil);
      const updatedHosting = mapMemberList(t.hostingCommittee);
      const updatedFounding = mapMemberList(t.foundingMembers);
      return {
        ...t,
        adminCouncil: updatedAdmin || [],
        hostingCommittee: updatedHosting || [],
        foundingMembers: updatedFounding,
      };
    });

    if (tenuresModified) {
      saveStoredTenures(updatedTenures);
    }
  } catch (e) {
    console.warn("Error cascading department rename across tenures:", e);
  }

  return { usersCount, responsesCount, councilCount };
}

