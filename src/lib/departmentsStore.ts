import { 
  getSiteContentFromFirestore,
  cleanUndefined,
  saveSiteContentToFirestore
} from "./firebase/firestore";
import { enqueueCloudWrite } from "./dataSyncEngine";

export const DEFAULT_DEPARTMENTS: string[] = [
  "Basic Science & Humanities Dept.",
  "Computer Science and Engineering",
  "Artificial Intelligence Engineering",
  "Information Technology Engineering",
  "Data Science Engineering",
  "Cyber Security Engineering",
  "Civil Engineering",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Electronics and Telecommunication Engineering",
  "Master of Business Administration (MBA)",
  "Bachelor of Business Administration (BBA)",
  "Bachelor of Computer Applications (BCA)",
  "Master of Computer Applications (MCA)",
  "Diploma",
];

export const DEPARTMENT_SHORT_NAMES: Record<string, string> = {
  "Computer Science and Engineering": "CSE",
  "Computer Science & Engineering": "CSE",
  "CSE": "CSE",
  "Artificial Intelligence Engineering": "AI",
  "Artificial Intelligence": "AI",
  "AI": "AI",
  "Information Technology Engineering": "IT",
  "Information Technology": "IT",
  "IT": "IT",
  "Data Science Engineering": "DS",
  "Data Science": "DS",
  "DS": "DS",
  "Cyber Security Engineering": "CY",
  "Cyber Security": "CY",
  "CY": "CY",
  "Civil Engineering": "CE",
  "Civil": "CE",
  "CE": "CE",
  "Electrical Engineering": "EE",
  "Electrical": "EE",
  "EE": "EE",
  "Mechanical Engineering": "ME",
  "Mechanical": "ME",
  "ME": "ME",
  "Electronics and Telecommunication Engineering": "ETC",
  "Electronics & Telecommunication Engineering": "ETC",
  "Electronics & Telecommunication": "ETC",
  "Electronics and Telecommunication": "ETC",
  "ETC": "ETC",
  "EXTC": "ETC",
  "Master of Business Administration (MBA)": "MBA",
  "Master of Business Administration": "MBA",
  "MBA": "MBA",
  "Bachelor of Business Administration (BBA)": "BBA",
  "Bachelor of Business Administration": "BBA",
  "BBA": "BBA",
  "Bachelor of Computer Applications (BCA)": "BCA",
  "Bachelor of Computer Applications": "BCA",
  "BCA": "BCA",
  "Master of Computer Applications (MCA)": "MCA",
  "Master of Computer Applications": "MCA",
  "MCA": "MCA",
  "Diploma": "DIP",
  "DIP": "DIP",
  "Basic Science & Humanities Dept.": "BSH",
  "Basic Science & Humanities": "BSH",
  "BSH": "BSH",
};

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
