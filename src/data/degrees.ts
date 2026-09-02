/**
 * Comprehensive database of all higher education and professional degrees
 * recognized in India (UGC, AICTE, NMC, BCI, PCI, COA, NIME, etc.)
 */

export interface DegreeCategory {
  category: string;
  degrees: string[];
}

export const INDIAN_DEGREES_BY_CATEGORY: DegreeCategory[] = [
  {
    category: "Engineering & Technology (UG / PG / Diploma)",
    degrees: [
      "B.Tech - Bachelor of Technology",
      "B.E. - Bachelor of Engineering",
      "B.Arch - Bachelor of Architecture",
      "B.Plan - Bachelor of Planning",
      "B.Des - Bachelor of Design",
      "Diploma in Engineering / Polytechnic",
      "M.Tech - Master of Technology",
      "M.E. - Master of Engineering",
      "M.Arch - Master of Architecture",
      "M.Plan - Master of Planning",
      "M.Des - Master of Design",
      "Integrated B.Tech + M.Tech (Dual Degree)",
    ],
  },
  {
    category: "Computer Applications & Information Technology",
    degrees: [
      "BCA - Bachelor of Computer Applications",
      "B.Sc - Computer Science",
      "B.Sc - Information Technology (IT)",
      "B.Sc - Data Science & Artificial Intelligence",
      "MCA - Master of Computer Applications",
      "M.Sc - Computer Science",
      "M.Sc - Information Technology (IT)",
      "M.Sc - Data Science & AI",
      "M.Sc - Cyber Security",
      "PGDCA - Post Graduate Diploma in Computer Applications",
    ],
  },
  {
    category: "Management, Business & Commerce",
    degrees: [
      "BBA - Bachelor of Business Administration",
      "BMS - Bachelor of Management Studies",
      "B.Com - Bachelor of Commerce",
      "B.Com (Honours)",
      "BAF - B.Com in Accounting & Finance",
      "BBI - B.Com in Banking & Insurance",
      "BFM - B.Com in Financial Markets",
      "BBM - Bachelor of Business Management",
      "MBA - Master of Business Administration",
      "PGDM - Post Graduate Diploma in Management",
      "M.Com - Master of Commerce",
      "MMS - Master of Management Studies",
      "Executive MBA",
    ],
  },
  {
    category: "Sciences (Pure, Applied, Agriculture & Healthcare)",
    degrees: [
      "B.Sc - Bachelor of Science (General / Physical Sciences)",
      "B.Sc (Honours)",
      "B.Sc - Mathematics / Statistics",
      "B.Sc - Physics / Chemistry",
      "B.Sc - Biotechnology / Microbiology",
      "B.Sc - Agriculture (Honours)",
      "B.Sc - Forestry / Horticulture",
      "B.Sc - Nursing",
      "M.Sc - Master of Science (General)",
      "M.Sc - Biotechnology / Microbiology / Biochemistry",
      "M.Sc - Physics / Chemistry / Mathematics",
      "M.Sc - Agriculture",
      "M.Sc - Nursing",
    ],
  },
  {
    category: "Arts, Humanities, Social Work & Education",
    degrees: [
      "B.A. - Bachelor of Arts (General)",
      "B.A. (Honours)",
      "BA - Economics",
      "BA - English / Literature",
      "BA - Psychology",
      "BA - Political Science / Sociology / History",
      "BJMC / BAJMC - Journalism & Mass Communication",
      "BSW - Bachelor of Social Work",
      "BFA - Bachelor of Fine Arts",
      "B.P.Ed - Bachelor of Physical Education",
      "B.Ed - Bachelor of Education",
      "M.A. - Master of Arts (General)",
      "MA - Economics / Psychology / English",
      "MJMC / MAJMC - Journalism & Mass Communication",
      "MSW - Master of Social Work",
      "MFA - Master of Fine Arts",
      "M.Ed - Master of Education",
    ],
  },
  {
    category: "Medical, Dental, Pharmacy & Allied Healthcare",
    degrees: [
      "MBBS - Bachelor of Medicine & Bachelor of Surgery",
      "BDS - Bachelor of Dental Surgery",
      "B.Pharm - Bachelor of Pharmacy",
      "Pharm.D - Doctor of Pharmacy",
      "BAMS - Bachelor of Ayurvedic Medicine & Surgery",
      "BHMS - Bachelor of Homeopathic Medicine & Surgery",
      "BUMS - Bachelor of Unani Medicine & Surgery",
      "BPT - Bachelor of Physiotherapy",
      "BOT - Bachelor of Occupational Therapy",
      "BMLT - Bachelor of Medical Laboratory Technology",
      "M.Pharm - Master of Pharmacy",
      "MD / MS - Doctor of Medicine / Master of Surgery",
      "MDS - Master of Dental Surgery",
      "MPT - Master of Physiotherapy",
    ],
  },
  {
    category: "Law & Legal Studies",
    degrees: [
      "BA LL.B (5-Year Integrated)",
      "BBA LL.B (5-Year Integrated)",
      "B.Com LL.B (5-Year Integrated)",
      "B.Sc LL.B (5-Year Integrated)",
      "LL.B - Bachelor of Laws (3-Year)",
      "LL.M - Master of Laws",
    ],
  },
  {
    category: "Design, Hotel Management, Media & Aviation",
    degrees: [
      "B.Des - Industrial / Fashion / UI-UX / Graphic Design",
      "B.Sc - Animation & Multimedia / VFX",
      "BHM / BHMCT - Bachelor of Hotel Management",
      "B.Sc - Hospitality & Hotel Administration",
      "BBA - Aviation & Airport Management",
      "BBA - Travel & Tourism Management",
      "MHM - Master of Hotel Management",
    ],
  },
  {
    category: "Doctoral, Research & Vocational Studies",
    degrees: [
      "Ph.D. - Doctor of Philosophy (Engineering / Science / Mgmt / Arts)",
      "M.Phil - Master of Philosophy",
      "Post-Doctoral Fellowship",
      "B.Voc - Bachelor of Vocation",
      "M.Voc - Master of Vocation",
      "Polytechnic / Diploma Graduate",
      "Other Professional Degree / Certification",
    ],
  },
];

export const ALL_INDIAN_DEGREES: string[] = INDIAN_DEGREES_BY_CATEGORY.flatMap(
  (c) => c.degrees
);
