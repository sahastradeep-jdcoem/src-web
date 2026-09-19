import { getSiteContentFromFirestore } from "@/lib/firebase/firestore";
import { TeamMember } from "@/types";

/**
 * Server-side utility to fetch the current active tenure label and
 * top council leadership (President, Vice President, Mentor) from Firestore.
 *
 * Returns authoritative data for JSON-LD structured data so that
 * Google AI Overview and search result rich snippets use correct
 * tenure years instead of inferring them from the current date.
 */

interface CouncilTenureDoc {
  id: string;
  label: string;
  academicYear: string;
  tenureNumber: string;
  isCurrent: boolean;
  isDraft?: boolean;
  status?: "active" | "archived" | "draft";
  startDate?: string;
  endDate?: string;
  adminCouncil: TeamMember[];
  hostingCommittee: TeamMember[];
  foundingMembers?: TeamMember[];
  archiveNotes?: string;
  createdAt: string;
}

export interface SEOLeadershipData {
  tenureLabel: string;      // e.g. "2025-26"
  academicYear: string;     // e.g. "2025 - 2026"
  tenureNumber: string;     // e.g. "1st Tenure"
  startDate?: string;       // ISO date when tenure started
  leaders: Array<{
    name: string;
    role: string;
  }>;
}

/** Fallback data when Firestore is unavailable (matches initial defaults) */
const FALLBACK: SEOLeadershipData = {
  tenureLabel: "2025-26",
  academicYear: "2025 - 2026",
  tenureNumber: "1st Tenure",
  startDate: "2025-09-24T00:00:00Z",
  leaders: [
    { name: "Lavanya Mankar", role: "President" },
    { name: "Sujal Guntewar", role: "Vice President" },
  ],
};

/**
 * Fetch current leadership data directly from Firestore for server-side SEO rendering.
 * Falls back to hardcoded defaults if Firestore is unreachable.
 * 
 * This function is safe to call from Server Components — it does not use
 * localStorage, window, or any browser APIs.
 */
export async function getSEOLeadershipData(): Promise<SEOLeadershipData> {
  try {
    const tenures = await getSiteContentFromFirestore<CouncilTenureDoc[]>("council_tenures");

    if (!tenures || !Array.isArray(tenures) || tenures.length === 0) {
      return FALLBACK;
    }

    // Find the current active (non-draft) tenure
    const currentTenure = tenures.find(
      (t) => t.isCurrent && t.status !== "draft" && !t.isDraft
    ) || tenures.find(
      (t) => t.isCurrent
    ) || tenures[0];

    if (!currentTenure) {
      return FALLBACK;
    }

    // Extract top leadership roles from adminCouncil
    const leaderRoles = ["President", "Vice President", "Mentor"];
    const leaders = (currentTenure.adminCouncil || [])
      .filter((m) => leaderRoles.includes(m.role) && m.name && !m.name.includes("(Appointee)"))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      .map((m) => ({ name: m.name, role: m.role }));

    return {
      tenureLabel: currentTenure.label || FALLBACK.tenureLabel,
      academicYear: currentTenure.academicYear || FALLBACK.academicYear,
      tenureNumber: currentTenure.tenureNumber || FALLBACK.tenureNumber,
      startDate: currentTenure.startDate,
      leaders: leaders.length > 0 ? leaders : FALLBACK.leaders,
    };
  } catch (error) {
    console.warn("SEO leadership data fetch failed, using fallback:", error);
    return FALLBACK;
  }
}
