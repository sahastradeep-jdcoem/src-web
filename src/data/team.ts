import { TeamMember, InstitutionalPillar } from "@/types";
import canonicalCouncilJson from "./canonicalCouncil.json";

// 1. SRC ADMIN COUNCIL (Canonical 1st Tenure — 13 Positions)
export const adminCouncilMembers: TeamMember[] = canonicalCouncilJson as TeamMember[];

// 2. HOSTING COMMITTEE (Includes Stage Emcees & Council Spokespersons)
export const hostingCommitteeMembers: TeamMember[] = [
  {
    id: "host-1",
    name: "Name Placeholder",
    role: "Head of Hosting Committee",
    department: "Computer Science & Engineering",
    year: "4th Year",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
    bio: "",
    linkedin: "https://www.linkedin.com/company/src-jdcoem/",
    email: "src.hosting@jdcoem.ac.in",
    order: 1
  },
  {
    id: "host-2",
    name: "Name Placeholder",
    role: "Lead Emcee — Cultural Stage",
    department: "Artificial Intelligence & Data Science",
    year: "3rd Year",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop",
    bio: "",
    linkedin: "https://www.linkedin.com/company/src-jdcoem/",
    email: "src.hosting.cultural@jdcoem.ac.in",
    order: 2
  },
  {
    id: "host-3",
    name: "Name Placeholder",
    role: "Lead Emcee — Technical Stage",
    department: "Information Technology",
    year: "3rd Year",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop",
    bio: "",
    linkedin: "https://www.linkedin.com/company/src-jdcoem/",
    email: "src.hosting.tech@jdcoem.ac.in",
    order: 3
  },
  {
    id: "host-4",
    name: "Name Placeholder",
    role: "Associate Emcee",
    department: "Electronics & Telecommunication",
    year: "2nd Year",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop",
    bio: "",
    linkedin: "https://www.linkedin.com/company/src-jdcoem/",
    email: "src.hosting.associate@jdcoem.ac.in",
    order: 4
  },
  {
    id: "spoke-1",
    name: "Name Placeholder",
    role: "Chief Spokesperson",
    department: "Computer Science & Engineering",
    year: "4th Year",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
    bio: "",
    linkedin: "https://www.linkedin.com/company/src-jdcoem/",
    email: "src.spokesperson1@jdcoem.ac.in",
    order: 5
  },
  {
    id: "spoke-2",
    name: "Name Placeholder",
    role: "Spokesperson — Engineering Affairs",
    department: "Mechanical & Civil Engineering",
    year: "4th Year",
    avatar: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?q=80&w=600&auto=format&fit=crop",
    bio: "",
    linkedin: "https://www.linkedin.com/company/src-jdcoem/",
    email: "src.spokesperson2@jdcoem.ac.in",
    order: 6
  },
  {
    id: "spoke-3",
    name: "Name Placeholder",
    role: "Spokesperson — Computing & AI",
    department: "AI/DS & Information Technology",
    year: "3rd Year",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop",
    bio: "",
    linkedin: "https://www.linkedin.com/company/src-jdcoem/",
    email: "src.spokesperson3@jdcoem.ac.in",
    order: 7
  },
  {
    id: "spoke-4",
    name: "Name Placeholder",
    role: "Spokesperson — Management & Commerce",
    department: "Department of Management Studies (MBA)",
    year: "2nd Year",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
    bio: "",
    linkedin: "https://www.linkedin.com/company/src-jdcoem/",
    email: "src.spokesperson4@jdcoem.ac.in",
    order: 8
  },
  {
    id: "spoke-5",
    name: "Name Placeholder",
    role: "Spokesperson — Student Welfare & First Years",
    department: "First Year Engineering (FYE)",
    year: "2nd Year",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=600&auto=format&fit=crop",
    bio: "",
    linkedin: "https://www.linkedin.com/company/src-jdcoem/",
    email: "src.spokesperson5@jdcoem.ac.in",
    order: 9
  }
];

export const spokespersonMembers: TeamMember[] = [];

// 4. FOUNDING MEMBERS OF SAHASTRADEEP (Canonical 1st Tenure Pioneers — 13 Positions)
export const foundingMembers: TeamMember[] = (canonicalCouncilJson as TeamMember[]).map((m, idx) => ({
  ...m,
  id: `founder-${m.id.replace(/^(admin|member)-/, "")}`,
  role: `Founding ${m.role.replace(/^Founding\s+/i, "")}`,
  designation: `Founding ${m.role.replace(/^Founding\s+/i, "")}`,
  order: idx + 1
}));

// 5. 12 CHARTERED CLUBS LEADERSHIP
export const clubLeadsData = [
  { club: "Dance Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "CSE / AI&DS", count: "64 Members" },
  { club: "Music Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "IT / ETC", count: "58 Members" },
  { club: "Drama Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "Mech / Civil", count: "42 Members" },
  { club: "Gaming Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "CSE / IT", count: "95 Members" },
  { club: "Coding Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "CSE / DS", count: "120 Members" },
  { club: "Robotics Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "Mech / Electrical", count: "72 Members" },
  { club: "Visual Arts Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "AIML / CSE", count: "48 Members" },
  { club: "Creative Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "CSE / Management", count: "52 Members" },
  { club: "Nexus Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "MBA / IT", count: "44 Members" },
  { club: "Fitness Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "Civil / Mech", count: "88 Members" },
  { club: "Event Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "Electrical / ETC", count: "75 Members" },
  { club: "Publicity Club", lead: "Club Head Placeholder", coLead: "Co-Head Placeholder", dept: "Management / CSE", count: "50 Members" }
];

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
