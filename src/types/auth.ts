export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: "STUDENT" | "COUNCIL_ADMIN" | "GUEST";
  isCollegeStudent: boolean;
  firstName?: string;
  lastName?: string;
  btId?: string; // Official BT ID (e.g. BT22CSE045) - Replaces Roll No
  department?: string;
  year?: string; // Year of study (e.g. 1st Year, 2nd Year, 3rd Year, 4th Year)
  phone?: string;
  profileCompleted?: boolean;
  designationBadge?: string; // e.g. "President • Central Council", "Head • Coding Club"
  isCouncilOfficer?: boolean;
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
