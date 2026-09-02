export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: "STUDENT" | "COUNCIL_ADMIN" | "FACULTY" | "GUEST";
  userType?: "JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT";
  isCollegeStudent: boolean; // true for JDCOEM students, false for external delegates
  
  // Common fields
  firstName?: string;
  lastName?: string;
  phone?: string;
  profileCompleted?: boolean;

  // JDCOEM Student fields
  btId?: string; // Official BT ID (e.g. BT22CSE045)
  department?: string;
  year?: string; // Year of study (e.g. 1st Year, 2nd Year, 3rd Year, 4th Year)
  designationBadge?: string; // e.g. "President", "Mentor", "Head • Coding Club"
  isCouncilOfficer?: boolean;

  // Faculty / Academic Staff fields
  title?: string; // Prof., Dr., Mr., Ms., Mrs.
  facultyDesignation?: string; // Assistant Professor, Associate Professor, Professor, HOD, Dean, etc.
  facultyDepartment?: string;
  facultyApprovalStatus?: "pending" | "approved" | "rejected";
  facultyApprovedAt?: string;
  facultyApprovedBy?: string;
  employeeId?: string;

  // External / Non-JDCOEM Student fields
  collegeName?: string; // e.g. "VNIT Nagpur", "RCOEM", "GHRCE"
  city?: string; // e.g. "Nagpur", "Pune", "Mumbai"
  customBranch?: string; // e.g. "Computer Science & Design", "B.Sc Physics"
}

export type AuthUser = UserProfile;

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  isProfileModalOpen: boolean;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
}
