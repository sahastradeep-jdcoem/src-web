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
 * Returns short acronym form for departments (e.g. CSE, AI, IT, DS, CY, CE, EE, ME, ETC, MBA, BBA, MCA, DIP, BCA)
 */
export function getDepartmentShortName(deptName?: string | null): string {
  if (!deptName) return "";
  const trimmed = deptName.trim();
  if (DEPARTMENT_SHORT_NAMES[trimmed]) {
    return DEPARTMENT_SHORT_NAMES[trimmed];
  }
  
  const lower = trimmed.toLowerCase();
  if (lower.includes("data science") || lower === "ds") return "DS";
  if (lower.includes("cyber security") || lower.includes("cyber") || lower === "cy") return "CY";
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

/**
 * Intelligently resolves legacy, variant, or external degree strings into an accredited canonical department name.
 * e.g. "Data Science Engineering" -> "CSE(Data Science)"
 * e.g. "B.Tech - Bachelor of Technology • JD College of Engineering and Management" -> "Computer Science and Engineering"
 */
export function resolveCanonicalDepartmentName(
  deptName?: string | null,
  activeDepts?: string[]
): string {
  const list = activeDepts && activeDepts.length > 0 ? activeDepts : DEFAULT_DEPARTMENTS;
  if (!deptName) {
    return list[0] || DEFAULT_DEPARTMENTS[0] || "Computer Science and Engineering";
  }

  const trimmed = deptName.trim();
  if (!trimmed) {
    return list[0] || DEFAULT_DEPARTMENTS[0] || "Computer Science and Engineering";
  }

  // 1. Exact case-insensitive match
  const exactMatch = list.find((d) => d.toLowerCase() === trimmed.toLowerCase());
  if (exactMatch) return exactMatch;

  // 1.5. If deptName contains bullet separator (e.g. "B.Tech - Bachelor of Technology • JDCOEM"), inspect segments
  if (trimmed.includes("•")) {
    const parts = trimmed.split("•").map((p) => p.trim());
    for (const part of parts) {
      const match = list.find((d) => d.toLowerCase() === part.toLowerCase());
      if (match) return match;
      const partLower = part.toLowerCase();
      if (partLower.includes("computer science") || partLower === "cse") {
        const cseMatch = list.find(
          (d) =>
            d.toLowerCase().includes("computer science") &&
            !d.toLowerCase().includes("data") &&
            !d.toLowerCase().includes("artificial") &&
            !d.toLowerCase().includes("cyber")
        );
        if (cseMatch) return cseMatch;
      }
      if (partLower.includes("data science") || partLower === "ds") {
        const dsMatch = list.find((d) => d.toLowerCase().includes("data science") || d.toLowerCase() === "ds");
        if (dsMatch) return dsMatch;
      }
      if (partLower.includes("artificial intelligence") || partLower === "ai") {
        const aiMatch = list.find((d) => d.toLowerCase().includes("artificial intelligence"));
        if (aiMatch) return aiMatch;
      }
      if (partLower.includes("information tech") || partLower === "it") {
        const itMatch = list.find((d) => d.toLowerCase().includes("information tech"));
        if (itMatch) return itMatch;
      }
      if (partLower.includes("civil") || partLower === "ce") {
        const ceMatch = list.find((d) => d.toLowerCase().includes("civil"));
        if (ceMatch) return ceMatch;
      }
      if (partLower.includes("mechanical") || partLower === "me") {
        const meMatch = list.find((d) => d.toLowerCase().includes("mechanical"));
        if (meMatch) return meMatch;
      }
      if (partLower.includes("electrical") || partLower === "ee") {
        const eeMatch = list.find((d) => d.toLowerCase().includes("electrical"));
        if (eeMatch) return eeMatch;
      }
      if (partLower.includes("telecommunication") || partLower.includes("etc") || partLower.includes("extc")) {
        const etcMatch = list.find((d) => d.toLowerCase().includes("telecommunication") || d.toLowerCase().includes("etc"));
        if (etcMatch) return etcMatch;
      }
      if (partLower.includes("bachelor of business") || partLower === "bba") {
        const bbaMatch = list.find((d) => d.toLowerCase().includes("bba") || d.toLowerCase().includes("bachelor of business"));
        if (bbaMatch) return bbaMatch;
      }
      if (partLower.includes("master of business") || partLower === "mba") {
        const mbaMatch = list.find((d) => d.toLowerCase().includes("mba") || d.toLowerCase().includes("master of business"));
        if (mbaMatch) return mbaMatch;
      }
      if (partLower.includes("bachelor of computer") || partLower === "bca") {
        const bcaMatch = list.find((d) => d.toLowerCase().includes("bca") || d.toLowerCase().includes("bachelor of computer"));
        if (bcaMatch) return bcaMatch;
      }
      if (partLower.includes("master of computer") || partLower === "mca") {
        const mcaMatch = list.find((d) => d.toLowerCase().includes("mca") || d.toLowerCase().includes("master of computer"));
        if (mcaMatch) return mcaMatch;
      }
      if (partLower.includes("diploma") || partLower.includes("poly") || partLower === "dip") {
        const dipMatch = list.find((d) => d.toLowerCase().includes("diploma") || d.toLowerCase().includes("poly"));
        if (dipMatch) return dipMatch;
      }
    }
  }

  // 2. Specific alias normalization
  const lower = trimmed.toLowerCase();
  if (lower.includes("data science") || lower === "ds" || lower.includes("cse(ds)") || lower.includes("cse (ds)")) {
    const dsMatch = list.find((d) => d.toLowerCase().includes("data science") || d.toLowerCase().includes("(ds)"));
    if (dsMatch) return dsMatch;
  }

  if (lower.includes("cyber security") || lower.includes("cyber") || lower === "cy") {
    const cyMatch = list.find((d) => d.toLowerCase().includes("cyber"));
    if (cyMatch) return cyMatch;
  }

  if (lower.includes("artificial intelligence") || lower === "ai" || lower.includes("cse(ai)") || lower.includes("cse (ai)")) {
    const aiMatch = list.find((d) => d.toLowerCase().includes("artificial intelligence") || d.toLowerCase().includes("(ai)"));
    if (aiMatch) return aiMatch;
  }

  if (lower.includes("information technology") || lower === "it" || lower.includes("cse(it)")) {
    const itMatch = list.find((d) => d.toLowerCase().includes("information technology") || d.toLowerCase().includes("information tech"));
    if (itMatch) return itMatch;
  }

  if (lower.includes("computer science") || lower === "cse") {
    const cseMatch = list.find(
      (d) =>
        d.toLowerCase().includes("computer science") &&
        !d.toLowerCase().includes("data") &&
        !d.toLowerCase().includes("artificial") &&
        !d.toLowerCase().includes("cyber")
    );
    if (cseMatch) return cseMatch;
  }

  if (lower.includes("civil") || lower === "ce") {
    const ceMatch = list.find((d) => d.toLowerCase().includes("civil") || d.toLowerCase() === "ce");
    if (ceMatch) return ceMatch;
  }

  if (lower.includes("mechanical") || lower === "me") {
    const meMatch = list.find((d) => d.toLowerCase().includes("mechanical") || d.toLowerCase() === "me");
    if (meMatch) return meMatch;
  }

  if (lower.includes("electrical") || lower === "ee") {
    const eeMatch = list.find((d) => d.toLowerCase().includes("electrical") || d.toLowerCase() === "ee");
    if (eeMatch) return eeMatch;
  }

  if (lower.includes("telecommunication") || lower.includes("etc") || lower.includes("extc")) {
    const etcMatch = list.find((d) => d.toLowerCase().includes("telecommunication") || d.toLowerCase().includes("etc"));
    if (etcMatch) return etcMatch;
  }

  if (lower.includes("bachelor of business") || lower === "bba") {
    const bbaMatch = list.find((d) => d.toLowerCase().includes("bba") || d.toLowerCase().includes("bachelor of business"));
    if (bbaMatch) return bbaMatch;
  }

  if (lower.includes("master of business") || lower === "mba") {
    const mbaMatch = list.find((d) => d.toLowerCase().includes("mba") || d.toLowerCase().includes("master of business"));
    if (mbaMatch) return mbaMatch;
  }

  if (lower.includes("bachelor of computer") || lower === "bca") {
    const bcaMatch = list.find((d) => d.toLowerCase().includes("bca") || d.toLowerCase().includes("bachelor of computer"));
    if (bcaMatch) return bcaMatch;
  }

  if (lower.includes("master of computer") || lower === "mca") {
    const mcaMatch = list.find((d) => d.toLowerCase().includes("mca") || d.toLowerCase().includes("master of computer"));
    if (mcaMatch) return mcaMatch;
  }

  if (lower.includes("diploma") || lower.includes("poly") || lower === "dip") {
    const dipMatch = list.find((d) => d.toLowerCase().includes("diploma") || d.toLowerCase().includes("poly"));
    if (dipMatch) return dipMatch;
  }

  if (lower.includes("basic science") || lower.includes("humanities") || lower === "bsh" || lower === "bshd") {
    const bshMatch = list.find((d) => d.toLowerCase().includes("basic science") || d.toLowerCase().includes("humanities") || d.toLowerCase().includes("bsh"));
    if (bshMatch) return bshMatch;
  }

  // 3. Acronym code match
  const code = getDepartmentShortName(trimmed);
  if (code) {
    const codeMatch = list.find((d) => getDepartmentShortName(d) === code);
    if (codeMatch) return codeMatch;
  }

  // 4. If string is a known external degree format without matching branch (e.g. "B.Tech - Bachelor of Technology • JDCOEM")
  if (
    trimmed.includes("•") || 
    lower.startsWith("b.tech") || 
    lower.startsWith("b.e.") || 
    lower.startsWith("bachelor of technology") ||
    lower.startsWith("bachelor of engineering")
  ) {
    return list.find((d) => d.includes("Computer Science")) || list[0] || "Computer Science and Engineering";
  }

  return trimmed;
}

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
    const isPoly = /^(JPOLY|POLY)\d{4,7}$/i.test(cleanBt);
    if (!isPoly) {
      if (/^BT/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in Diploma, but ID is B.Tech (BT...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "JPOLY24074",
        };
      }
      if (/^BB/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in Diploma, but ID is BBA (BB...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "JPOLY24074",
        };
      }
      if (/^MB/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in Diploma, but ID is MBA (MB...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "JPOLY24074",
        };
      }
      if (/^BC/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in Diploma, but ID is BCA (BC...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "JPOLY24074",
        };
      }
      return {
        isFlagged: true,
        reason: "Invalid Diploma ID format (expected e.g. JPOLY24074)",
        flagType: "FORMAT_INVALID",
        expectedExample: "JPOLY24074",
      };
    }
    return { isFlagged: false };
  }

  // MBA
  if (deptLower.includes("master of business") || deptLower === "mba") {
    const isMba = /^MB\d{5,7}(BA|MBA)$/i.test(cleanBt);
    if (!isMba) {
      if (/^BT/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in MBA, but ID is B.Tech (BT...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "MB240071BA",
        };
      }
      if (/^BB/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in MBA, but ID is BBA (BB...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "MB240071BA",
        };
      }
      if (/^BC/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in MBA, but ID is BCA (BC...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "MB240071BA",
        };
      }
      if (/^(JPOLY|POLY)/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in MBA, but ID is Diploma (JPOLY...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "MB240071BA",
        };
      }
      if (/^MB\d{2,6}$/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Invalid MBA ID: missing 'BA' suffix (expected e.g. MB240071BA)",
          flagType: "FORMAT_INVALID",
          expectedExample: "MB240071BA",
        };
      }
      return {
        isFlagged: true,
        reason: "Invalid MBA ID format (expected e.g. MB240071BA)",
        flagType: "FORMAT_INVALID",
        expectedExample: "MB240071BA",
      };
    }
    return { isFlagged: false };
  }

  // BBA
  if (deptLower.includes("bachelor of business") || deptLower === "bba") {
    const isBba = /^BB\d{5,7}(BA|BBA)$/i.test(cleanBt);
    if (!isBba) {
      if (/^BT/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in BBA, but ID is B.Tech (BT...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BB210028BA",
        };
      }
      if (/^MB/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in BBA, but ID is MBA (MB...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BB210028BA",
        };
      }
      if (/^BC/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in BBA, but ID is BCA (BC...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BB210028BA",
        };
      }
      if (/^(JPOLY|POLY)/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in BBA, but ID is Diploma (JPOLY...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BB210028BA",
        };
      }
      if (/^BB\d{2,6}$/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Invalid BBA ID: missing 'BA' suffix (expected e.g. BB210028BA)",
          flagType: "FORMAT_INVALID",
          expectedExample: "BB210028BA",
        };
      }
      return {
        isFlagged: true,
        reason: "Invalid BBA ID format (expected e.g. BB210028BA)",
        flagType: "FORMAT_INVALID",
        expectedExample: "BB210028BA",
      };
    }
    return { isFlagged: false };
  }

  // BCA
  if (deptLower.includes("bachelor of computer") || deptLower === "bca") {
    const isBca = /^BC\d{5,7}(CA|BCA)$/i.test(cleanBt);
    if (!isBca) {
      if (/^BT/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in BCA, but ID is B.Tech (BT...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BC210028CA",
        };
      }
      if (/^MB/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in BCA, but ID is MBA (MB...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BC210028CA",
        };
      }
      if (/^BB/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in BCA, but ID is BBA (BB...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BC210028CA",
        };
      }
      if (/^(JPOLY|POLY)/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in BCA, but ID is Diploma (JPOLY...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BC210028CA",
        };
      }
      if (/^BC\d{2,6}$/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Invalid BCA ID: missing 'CA' suffix (expected e.g. BC210028CA)",
          flagType: "FORMAT_INVALID",
          expectedExample: "BC210028CA",
        };
      }
      return {
        isFlagged: true,
        reason: "Invalid BCA ID format (expected e.g. BC210028CA)",
        flagType: "FORMAT_INVALID",
        expectedExample: "BC210028CA",
      };
    }
    return { isFlagged: false };
  }

  // MCA
  if (deptLower.includes("master of computer") || deptLower === "mca") {
    const isMca = /^(MC|BT)\d{5,7}(CA|CS|MCA)$/i.test(cleanBt);
    if (!isMca) {
      if (/^BB/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in MCA, but ID is BBA (BB...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BT210036CS",
        };
      }
      if (/^MB/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in MCA, but ID is MBA (MB...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BT210036CS",
        };
      }
      if (/^(JPOLY|POLY)/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in MCA, but ID is Diploma (JPOLY...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BT210036CS",
        };
      }
      return {
        isFlagged: true,
        reason: "Invalid MCA ID format (expected e.g. BT210036CS)",
        flagType: "FORMAT_INVALID",
        expectedExample: "BT210036CS",
      };
    }
    return { isFlagged: false };
  }

  // Basic Science & Humanities (1st Year)
  if (deptLower.includes("basic science") || deptLower.includes("humanities") || deptLower === "bsh" || deptLower === "bshd") {
    const isBt = /^BT\d{5,7}[A-Z]{0,4}$/i.test(cleanBt);
    if (!isBt) {
      if (/^(JPOLY|POLY)/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in First Year (B.Tech), but ID is Diploma (JPOLY...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BT210036CS",
        };
      }
      if (/^BB/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in First Year (B.Tech), but ID is BBA (BB...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BT210036CS",
        };
      }
      if (/^MB/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in First Year (B.Tech), but ID is MBA (MB...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BT210036CS",
        };
      }
      if (/^BC/i.test(cleanBt)) {
        return {
          isFlagged: true,
          reason: "Dept mismatch: Enrolled in First Year (B.Tech), but ID is BCA (BC...)",
          flagType: "DEPT_MISMATCH",
          expectedExample: "BT210036CS",
        };
      }
      return {
        isFlagged: true,
        reason: "Invalid First Year ID format (expected e.g. BT210036CS)",
        flagType: "FORMAT_INVALID",
        expectedExample: "BT210036CS",
      };
    }
    return { isFlagged: false };
  }

  // Standard Engineering Branches (CSE, AI, IT, DS, CY, EE, ME, ETC, CE)
  if (/^(JPOLY|POLY)/i.test(cleanBt)) {
    return {
      isFlagged: true,
      reason: "Dept mismatch: Enrolled in Engineering, but ID is Diploma (JPOLY...)",
      flagType: "DEPT_MISMATCH",
      expectedExample: example,
    };
  }
  if (/^BB/i.test(cleanBt)) {
    return {
      isFlagged: true,
      reason: "Dept mismatch: Enrolled in Engineering, but ID is BBA (BB...)",
      flagType: "DEPT_MISMATCH",
      expectedExample: example,
    };
  }
  if (/^MB/i.test(cleanBt)) {
    return {
      isFlagged: true,
      reason: "Dept mismatch: Enrolled in Engineering, but ID is MBA (MB...)",
      flagType: "DEPT_MISMATCH",
      expectedExample: example,
    };
  }
  if (/^BC/i.test(cleanBt)) {
    return {
      isFlagged: true,
      reason: "Dept mismatch: Enrolled in Engineering, but ID is BCA (BC...)",
      flagType: "DEPT_MISMATCH",
      expectedExample: example,
    };
  }

  const btechMatch = cleanBt.match(/^BT(\d{2,7})([A-Z]{2,4})?$/i);
  if (!btechMatch) {
    return {
      isFlagged: true,
      reason: `Invalid BT ID structure (expected e.g. ${example})`,
      flagType: "FORMAT_INVALID",
      expectedExample: example,
    };
  }

  const digitsPart = btechMatch[1] || "";
  const actualSuffix = (btechMatch[2] || "").toUpperCase();

  if (digitsPart.length < 5) {
    return {
      isFlagged: true,
      reason: `BT ID number is incomplete (${digitsPart.length} digits, expected 6 digits, e.g. ${example})`,
      flagType: "FORMAT_INVALID",
      expectedExample: example,
    };
  }

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

