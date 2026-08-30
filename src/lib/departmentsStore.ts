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
    localStorage.setItem("src_departments", JSON.stringify(departments));
    window.dispatchEvent(new CustomEvent("src_departments_updated", { detail: departments }));
  } catch (e) {
    console.error("Could not save departments", e);
  }
}

export function resetStoredDepartments(): string[] {
  if (typeof window === "undefined") return DEFAULT_DEPARTMENTS;
  try {
    localStorage.removeItem("src_departments");
    window.dispatchEvent(new CustomEvent("src_departments_updated", { detail: DEFAULT_DEPARTMENTS }));
  } catch (e) {
    console.error("Could not reset departments", e);
  }
  return DEFAULT_DEPARTMENTS;
}
