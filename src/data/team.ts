import { TeamMember, InstitutionalPillar } from "@/types";
import canonicalCouncilJson from "./canonicalCouncil.json";

// 1. SRC ADMIN COUNCIL (Canonical 1st Tenure — 13 Positions)
export const adminCouncilMembers: TeamMember[] = canonicalCouncilJson as TeamMember[];

// 2. HOSTING COMMITTEE (Includes Stage Emcees & Council Spokespersons)
export const hostingCommitteeMembers: TeamMember[] = [];

export const spokespersonMembers: TeamMember[] = [];

// 4. FOUNDING MEMBERS OF SAHASTRADEEP (Canonical 1st Tenure Pioneers — 13 Positions)
export const foundingMembers: TeamMember[] = (canonicalCouncilJson as TeamMember[]).map((m, idx) => ({
  ...m,
  id: `founder-${m.id.replace(/^(admin|member)-/, "")}`,
  role: `Founding ${m.role.replace(/^Founding\s+/i, "")}`,
  designation: `Founding ${m.role.replace(/^Founding\s+/i, "")}`,
  order: idx + 1
}));


// 6. 4 PILLARS OF STRENGTH OF SRC (INSTITUTIONAL PATRONS & FACULTY MENTORS)
export const institutionalPillars: InstitutionalPillar[] = [
  {
    id: "pillar-1",
    name: "Dr. Shrikant Sonekar",
    designation: "Principal, JDCOEM",
    department: "JD College of Engineering & Management, Nagpur",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
    quote: "Fostering leadership autonomy, technical eminence, and collaborative collegiate governance.",
    order: 1
  },

  {
    id: "pillar-2",
    name: "Dr. Ujwala S. Dange",
    designation: "Dean (IQAC), JDCOEM",
    department: "Internal Quality Assurance Cell",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=600&auto=format&fit=crop",
    quote: "Upholding institutional quality benchmarks, student development, and academic excellence.",
    order: 2
  },

  {
    id: "pillar-3",
    name: "Faculty Coordinator",
    designation: "Faculty Coordinator, SRC",
    department: "Student Representative Council",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
    quote: "Guiding council officers across annual fest milestones, club affairs, and campus-wide student engagement.",
    order: 3
  },

  {
    id: "pillar-4",
    name: "Faculty Coordinator",
    designation: "Faculty Coordinator, SRC",
    department: "Student Representative Council",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop",
    quote: "Facilitating inter-departmental harmony, club logistics, student welfare, and event execution.",
    order: 4
  }
];
