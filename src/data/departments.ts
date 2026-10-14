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

export interface BtIdValidationResult {
  isFlagged: boolean;
  reason?: string;
  flagType?: "MISSING_ID" | "FORMAT_INVALID" | "DEPT_MISMATCH";
  expectedCode?: string;
  actualCode?: string;
  expectedExample?: string;
}

/**
 * Validates a student's College BT ID against institutional regex and department code.
 * Flagging is strictly for administrative audit (NEVER blocks user registration).
 */
export function validateStudentBtId(
  btId?: string | null,
  deptName?: string | null
): BtIdValidationResult {
  const cleanBt = (btId || "").trim().toUpperCase();
  const example = getDepartmentBtIdExample(deptName);
  const deptLower = (deptName || "").trim().toLowerCase();

  // 1. Missing or too short ID
  if (!cleanBt || cleanBt.length < 5) {
    return {
      isFlagged: true,
      reason: cleanBt ? "BT ID is too short (< 5 chars)" : "Missing College BT ID",
      flagType: "MISSING_ID",
      expectedExample: example,
    };
  }

  // 2. Department-specific validation
  // Diploma
  if (deptLower.includes("diploma") || deptLower.includes("poly") || deptLower === "dip") {
    const isPoly = /^(JPOLY|POLY)\d{2}\d{2,6}$/i.test(cleanBt);
    if (!isPoly) {
      if (/^BT\d{2}/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in Diploma, but ID is B.Tech (BT...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "JPOLY24074",
        };
      }
      return {
        isFlagged: true,
        reason: "Invalid Diploma ID format (expected JPOLY...)",
        flagType: "FORMAT_INVALID",
        expectedExample: "JPOLY24074",
      };
    }
    return { isFlagged: false };
  }

  // MBA
  if (deptLower.includes("master of business") || deptLower === "mba") {
    const isMba = /^MB\d{2}\d{2,6}(BA|MBA)?$/i.test(cleanBt);
    if (!isMba) {
      if (/^BT\d{2}/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in MBA, but ID is B.Tech (BT...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "MB240071BA",
        };
      }
      return {
        isFlagged: true,
        reason: "Invalid MBA ID format (expected MB...BA)",
        flagType: "FORMAT_INVALID",
        expectedExample: "MB240071BA",
      };
    }
    return { isFlagged: false };
  }

  // BBA
  if (deptLower.includes("bachelor of business") || deptLower === "bba") {
    const isBba = /^BB\d{2}\d{2,6}(BA|BBA)?$/i.test(cleanBt);
    if (!isBba) {
      if (/^BT\d{2}/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in BBA, but ID is B.Tech (BT...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BB210028BA",
        };
      }
      return {
        isFlagged: true,
        reason: "Invalid BBA ID format (expected BB...BA)",
        flagType: "FORMAT_INVALID",
        expectedExample: "BB210028BA",
      };
    }
    return { isFlagged: false };
  }

  // BCA
  if (deptLower.includes("bachelor of computer") || deptLower === "bca") {
    const isBca = /^BC\d{2}\d{2,6}(CA|BCA)?$/i.test(cleanBt);
    if (!isBca) {
      if (/^BT\d{2}/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in BCA, but ID is B.Tech (BT...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BC210028CA",
        };
      }
      return {
        isFlagged: true,
        reason: "Invalid BCA ID format (expected BC...CA)",
        flagType: "FORMAT_INVALID",
        expectedExample: "BC210028CA",
      };
    }
    return { isFlagged: false };
  }

  // MCA
  if (deptLower.includes("master of computer") || deptLower === "mca") {
    const isMca = /^(MC|BT)\d{2}\d{2,6}(CA|CS|MCA)?$/i.test(cleanBt);
    if (!isMca) {
      return {
        isFlagged: true,
        reason: "Invalid MCA ID format",
        flagType: "FORMAT_INVALID",
        expectedExample: "BT210036CS",
      };
    }
    return { isFlagged: false };
  }

  // Basic Science & Humanities (1st Year)
  if (deptLower.includes("basic science") || deptLower.includes("humanities") || deptLower === "bsh" || deptLower === "bshd") {
    const isBt = /^BT\d{2}\d{2,6}[A-Z]{0,4}$/i.test(cleanBt);
    if (!isBt) {
      return {
        isFlagged: true,
        reason: "Invalid First Year ID format (expected BT...)",
        flagType: "FORMAT_INVALID",
        expectedExample: "BT210036CS",
      };
    }
    return { isFlagged: false };
  }

  // Standard Engineering Branches (CSE, AI, IT, DS, CY, EE, ME, ETC, CE)
  const btechMatch = cleanBt.match(/^BT\d{2}\d{2,6}([A-Z]{2,4})?$/i);
  if (!btechMatch) {
    if (/^(JPOLY|POLY|BC|MB|BB)/i.test(cleanBt)) {
      return {
        isFlagged: true,
        reason: `Dept mismatch: Enrolled in Engineering, but ID prefix is non-engineering`,
        flagType: "DEPT_MISMATCH",
        expectedExample: example,
      };
    }
    return {
      isFlagged: true,
      reason: `Invalid BT ID structure (expected e.g. ${example})`,
      flagType: "FORMAT_INVALID",
      expectedExample: example,
    };
  }

  const actualSuffix = (btechMatch[1] || "").toUpperCase();

  if (!actualSuffix) {
    return {
      isFlagged: true,
      reason: `Missing branch code suffix (expected e.g. ${example})`,
      flagType: "FORMAT_INVALID",
      expectedExample: example,
    };
  }

  let expectedCode = "CS";
  let deptShortLabel = "CSE";

  if (deptLower.includes("data science") || deptLower === "ds" || deptLower.includes("(ds)")) {
    expectedCode = "DS";
    deptShortLabel = "DS";
  } else if (deptLower.includes("cyber") || deptLower === "cy") {
    expectedCode = "CY";
    deptShortLabel = "CY";
  } else if (deptLower.includes("artificial intelligence") || deptLower === "ai" || deptLower.includes("(ai)")) {
    expectedCode = "AI";
    deptShortLabel = "AI";
  } else if (deptLower.includes("information tech") || deptLower === "it") {
    expectedCode = "IT";
    deptShortLabel = "IT";
  } else if (deptLower.includes("telecommunication") || deptLower.includes("etc") || deptLower.includes("extc")) {
    expectedCode = "ET";
    deptShortLabel = "ETC";
  } else if (deptLower.includes("civil") || deptLower === "ce") {
    expectedCode = "CE";
    deptShortLabel = "CE";
  } else if (deptLower.includes("electrical") || deptLower === "ee") {
    expectedCode = "EE";
    deptShortLabel = "EE";
  } else if (deptLower.includes("mechanical") || deptLower === "me") {
    expectedCode = "ME";
    deptShortLabel = "ME";
  } else if (deptLower.includes("computer science") || deptLower === "cse") {
    expectedCode = "CS";
    deptShortLabel = "CSE";
  }

  const matchesDept = 
    actualSuffix === expectedCode || 
    (expectedCode === "ET" && actualSuffix === "ETC") || 
    (expectedCode === "CE" && actualSuffix === "CIVIL");

  if (!matchesDept) {
    return {
      isFlagged: true,
      reason: `Dept mismatch: Enrolled in ${deptShortLabel}, but ID has ${actualSuffix}`,
      flagType: "DEPT_MISMATCH",
      expectedCode,
      actualCode: actualSuffix,
      expectedExample: example,
    };
  }

  return { isFlagged: false };
}

