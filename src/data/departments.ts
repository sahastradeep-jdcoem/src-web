/**
 * Academic Departments and Short Codes for JDCOEM
 */

export const DEFAULT_DEPARTMENTS: string[] = [
  "Basic Science & Humanities Dept.",
  "Computer Science and Engineering",
  "Artificial Intelligence Engineering",
  "Information Technology Engineering",
  "CSE(Data Science)",
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
  "CSE(Data Science)": "DS",
  "CSE (Data Science)": "DS",
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
  "Basic Science & Humanities Dept.": "BSH",
  "Basic Science & Humanities": "BSH",
  "First Year (BSH)": "BSH",
  "BSH": "BSH",
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
};

/**
 * Department-specific College ID format examples for JDCOEM
 */
export const DEPARTMENT_BT_ID_EXAMPLES: Record<string, string> = {
  CSE: "BT210036CS",
  AI: "BT210036AI",
  IT: "BT210036IT",
  DS: "BT210036DS",
  CY: "BT210036CY",
  EE: "BT210036EE",
  ME: "BT210036ME",
  ETC: "BT210036ET",
  CE: "BT210036CE",
  CIVIL: "BT210036CE",
  DIP: "JPOLY24074",
  DIPLOMA: "JPOLY24074",
  MBA: "MB240071BA",
  BBA: "BB210028BA",
  BCA: "BC210028CA",
  BSH: "BT210036CS",
  BSHD: "BT210036CS",
  MCA: "BT210036CS",
};

/**
 * Resolves the institutional format / example ID according to the selected department
 */
export function getDepartmentBtIdExample(deptName?: string | null): string {
  if (!deptName) return "BT210036CS";
  const trimmed = deptName.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes("diploma") || lower.includes("poly") || lower === "dip") return "JPOLY24074";
  if (lower.includes("master of business") || lower === "mba") return "MB240071BA";
  if (lower.includes("bachelor of business") || lower === "bba") return "BB210028BA";
  if (lower.includes("bachelor of computer") || lower === "bca") return "BC210028CA";
  if (lower.includes("master of computer") || lower === "mca") return "BT210036CS";
  if (lower.includes("basic science") || lower.includes("humanities") || lower === "bsh" || lower === "bshd") return "BT210036CS";
  if (lower.includes("data science") || lower === "ds" || lower.includes("(ds)")) return "BT210036DS";
  if (lower.includes("cyber") || lower === "cy") return "BT210036CY";
  if (lower.includes("artificial intelligence") || lower === "ai" || lower.includes("(ai)")) return "BT210036AI";
  if (lower.includes("information tech") || lower === "it") return "BT210036IT";
  if (lower.includes("telecommunication") || lower.includes("etc") || lower.includes("extc")) return "BT210036ET";
  if (lower.includes("civil") || lower === "ce") return "BT210036CE";
  if (lower.includes("electrical") || lower === "ee") return "BT210036EE";
  if (lower.includes("mechanical") || lower === "me") return "BT210036ME";
  if (lower.includes("computer science") || lower === "cse") return "BT210036CS";

  return "BT210036CS";
}
