"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  signInWithGoogle as firebaseGoogleSignIn,
  signOut as firebaseSignOut,
  subscribeToAuth,
  AuthUserProfile
} from "@/lib/firebase/auth";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { 
  checkIsAdminInFirestore, 
  getUserProfileFromFirestore, 
  saveUserProfileToFirestore,
  getAdminAccessFromFirestore,
  subscribeToAdminAccessForUser,
  findBtIdByEmailInRosters
} from "@/lib/firebase/firestore";
import { UserProfile, AuthUser, AuthContextType } from "@/types/auth";
import { AdminAccessAssignment, isOwnerEmail } from "@/types/rbac";
import { 
  saveRegisteredUser, 
  getStoredUsers, 
  resolveDesignationByBtId, 
  markUserAsDeleted,
  formatDesignationBadge,
  isExternalUser 
} from "@/lib/usersStore";
import { resolveCanonicalDepartmentName } from "@/lib/departmentsStore";

/**
 * Validates that all required fields for a given role are completed
 */
export function determineProfileCompletion(
  profile: Partial<UserProfile> | null, 
  userType?: string, 
  btId?: string
): boolean {
  if (!profile) return false;
  if (!profile.profileCompleted) return false;
  if (!profile.firstName?.trim() || !profile.lastName?.trim() || !profile.phone?.trim()) return false;

  const resolvedType = userType || profile.userType;
  if (resolvedType === "FACULTY") {
    return Boolean(profile.facultyDesignation && profile.facultyDepartment);
  }
  if (resolvedType === "EXTERNAL_STUDENT") {
    return Boolean(
      profile.collegeName?.trim() && 
      profile.city?.trim() && 
      (profile.degree?.trim() || profile.customBranch?.trim())
    );
  }
  // Default JDCOEM_STUDENT
  const cleanBt = (btId || profile.btId || "").trim();
  return Boolean(cleanBt.length >= 3 && profile.department && profile.year);
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [pendingUserType, setPendingUserType] = useState<"JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT" | null>(null);

  useEffect(() => {
    // Check initial cached user in localStorage & pending user type in sessionStorage
    try {
      const pending = sessionStorage.getItem("src_pending_user_type") as any;
      if (pending) setPendingUserType(pending);

      const cached = localStorage.getItem("src_auth_user");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.isDeleted) {
          localStorage.removeItem("src_auth_user");
          setUser(null);
        } else {
          const cleanBt = parsed.btId ? parsed.btId.trim().toUpperCase() : "";
          const desig = cleanBt ? resolveDesignationByBtId(cleanBt, parsed.displayName || parsed.name || parsed.email) : null;
          if (desig) {
            parsed.designationBadge = formatDesignationBadge(desig.designationBadge);
            parsed.isCouncilOfficer = desig.isCouncilOfficer;
          } else if (cleanBt) {
            parsed.designationBadge = undefined;
            parsed.isCouncilOfficer = false;
          } else if (parsed.designationBadge) {
            parsed.designationBadge = formatDesignationBadge(parsed.designationBadge);
          }
          if (parsed.department && parsed.userType !== "EXTERNAL_STUDENT") {
            parsed.department = resolveCanonicalDepartmentName(parsed.department);
          }
          // Cached identity is for UX only; never grant an admin scope before Firebase revalidation.
          if (!isOwnerEmail(parsed.email)) {
            parsed.role = "STUDENT";
            parsed.adminAccess = undefined;
            parsed.adminAccessManaged = false;
          }
          const isComplete = determineProfileCompletion(parsed, parsed.userType, cleanBt);
          parsed.profileCompleted = isComplete;
          setUser(parsed);
          if (!isComplete) {
            setIsProfileModalOpen(true);
          }
        }
      }
    } catch (e) {
      console.warn("Auth cache read error", e);
    }

    // Subscribe to Auth listener
    const unsubscribe = subscribeToAuth(async (fbUser) => {
      if (fbUser && fbUser.email) {
        let storedProfile = await getUserProfileFromFirestore(fbUser.uid);

        let localProfile: Partial<UserProfile> = {};
        try {
          const cached = localStorage.getItem("src_auth_user");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.uid === fbUser.uid || (parsed.email && parsed.email.toLowerCase() === fbUser.email.toLowerCase())) {
              localProfile = parsed;
            }
          }
        } catch {}

        let registeredUser: Partial<UserProfile> | undefined;
        try {
          const allStored = getStoredUsers();
          registeredUser = allStored.find(
            (u) => (u.uid && u.uid === fbUser.uid) || (u.email && u.email.toLowerCase() === fbUser.email?.toLowerCase())
          );
        } catch {}

        const isExplicitExternal = storedProfile?.userType === "EXTERNAL_STUDENT" || (!storedProfile?.userType && (localProfile?.userType === "EXTERNAL_STUDENT" || registeredUser?.userType === "EXTERNAL_STUDENT"));
        const isExplicitFaculty = storedProfile?.role === "FACULTY" || storedProfile?.userType === "FACULTY" || (!storedProfile?.userType && (localProfile?.userType === "FACULTY" || registeredUser?.userType === "FACULTY"));

        const rosterBt = findBtIdByEmailInRosters(fbUser.email);
        const resolvedBtId = isExplicitExternal || isExplicitFaculty
          ? ""
          : (storedProfile?.btId !== undefined ? storedProfile.btId : (localProfile?.btId || registeredUser?.btId || rosterBt || ""));
        const cleanBt = resolvedBtId ? resolvedBtId.trim().toUpperCase() : "";

        const isOwner = isOwnerEmail(fbUser.email) ||
          storedProfile?.role === "OWNER" ||
          storedProfile?.adminAccess?.role === "OWNER" ||
          localProfile?.role === "OWNER" ||
          localProfile?.adminAccess?.role === "OWNER" ||
          registeredUser?.role === "OWNER" ||
          registeredUser?.adminAccess?.role === "OWNER";

        const isAdminUser = await checkIsAdminInFirestore(fbUser.email || "", fbUser.uid);
        const firestoreAdminAccess = await getAdminAccessFromFirestore(fbUser.uid, cleanBt, fbUser.email);
        const adminAccess: AdminAccessAssignment | null = firestoreAdminAccess || (isOwner || isAdminUser
          ? {
              uid: fbUser.uid,
              btId: cleanBt,
              email: fbUser.email || undefined,
              role: "OWNER",
              active: true,
              grantedBy: "system",
              grantedAt: new Date(0).toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : null);

        // Dynamic council/club roster resolution is authoritative for users with a BT ID.
        const targetName = storedProfile?.displayName || storedProfile?.name || localProfile?.displayName || localProfile?.name || registeredUser?.name || fbUser.displayName || fbUser.email;
        const designationInfo = cleanBt ? resolveDesignationByBtId(cleanBt, targetName || undefined) : null;

        const isAppointedOrHardcodedAdmin = 
          isOwner ||
          isAdminUser || 
          Boolean(adminAccess?.active) ||
          storedProfile?.role === "COUNCIL_ADMIN" || 
          storedProfile?.role === "OWNER" ||
          localProfile?.role === "COUNCIL_ADMIN" || 
          localProfile?.role === "OWNER" ||
          registeredUser?.role === "COUNCIL_ADMIN" ||
          registeredUser?.role === "OWNER";

        const assignedRole: "STUDENT" | "COUNCIL_ADMIN" | "FACULTY" | "GUEST" | "OWNER" = 
          (isOwner || adminAccess?.role === "OWNER" || storedProfile?.role === "OWNER" || registeredUser?.role === "OWNER")
            ? "OWNER"
            : isAppointedOrHardcodedAdmin 
            ? "COUNCIL_ADMIN" 
            : (isExplicitFaculty ? "FACULTY" : (storedProfile?.role || localProfile?.role || registeredUser?.role || "STUDENT"));

        // Priority: Live roster resolution > non-student stored badge > fallback
        const rawBadge = storedProfile?.designationBadge || localProfile?.designationBadge || registeredUser?.designationBadge;
        const assignedBadge = designationInfo 
          ? designationInfo.designationBadge 
          : (cleanBt ? undefined : (formatDesignationBadge(rawBadge) || undefined));

        const isOfficer = designationInfo 
          ? designationInfo.isCouncilOfficer 
          : (cleanBt ? false : Boolean(storedProfile?.isCouncilOfficer || localProfile?.isCouncilOfficer || registeredUser?.isCouncilOfficer));

        const baseObj = { ...registeredUser, ...localProfile, ...storedProfile };

        const isJdcoem = !isExplicitExternal && !isExplicitFaculty && (
          Boolean(cleanBt && cleanBt.length >= 3) || 
          storedProfile?.userType === "JDCOEM_STUDENT"
        );

        const activePending = pendingUserType || (typeof window !== "undefined" ? (sessionStorage.getItem("src_pending_user_type") as any) : null);
        const resolvedUserType: "JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT" = activePending || 
          (isExplicitFaculty ? "FACULTY" : 
          assignedRole === "FACULTY" ? "FACULTY" :
          isExplicitExternal ? "EXTERNAL_STUDENT" :
          isJdcoem ? "JDCOEM_STUDENT" :
          (storedProfile?.userType as any) || (localProfile?.userType as any) || (registeredUser?.userType as any) || "JDCOEM_STUDENT");

        const isCompleted = determineProfileCompletion(
          baseObj,
          resolvedUserType,
          cleanBt
        );

        const resolvedIsCollegeStudent = isExplicitFaculty
          ? true 
          : isExplicitExternal 
          ? false 
          : isJdcoem 
          ? true 
          : (fbUser.isCollegeStudent ?? false);

        const resolvedCollegeName = isExplicitExternal
          ? (storedProfile?.collegeName || localProfile?.collegeName || registeredUser?.collegeName || "Other College")
          : isJdcoem
          ? ((storedProfile?.collegeName && (storedProfile.collegeName.toLowerCase().includes("jdcoem") || storedProfile.collegeName.toLowerCase().includes("jd college"))) ? storedProfile.collegeName : "")
          : (storedProfile?.collegeName || localProfile?.collegeName || registeredUser?.collegeName || "");

        const merged: AuthUser = {
          ...baseObj,
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: storedProfile?.displayName || localProfile?.displayName || registeredUser?.displayName || fbUser.displayName || fbUser.email?.split("@")[0] || "Student",
          photoURL: fbUser.photoURL || storedProfile?.photoURL || localProfile?.photoURL || registeredUser?.photoURL || null,
          role: assignedRole,
          userType: resolvedUserType as any,
          isCollegeStudent: resolvedIsCollegeStudent,
          firstName: storedProfile?.firstName || localProfile?.firstName || registeredUser?.firstName || (fbUser.displayName ? fbUser.displayName.split(" ")[0] : ""),
          lastName: storedProfile?.lastName || localProfile?.lastName || registeredUser?.lastName || (fbUser.displayName ? fbUser.displayName.split(" ").slice(1).join(" ") : ""),
          btId: cleanBt,
          department: isExplicitExternal
            ? (storedProfile?.department || localProfile?.department || storedProfile?.degree || "")
            : (isJdcoem || resolvedUserType === "JDCOEM_STUDENT" || assignedRole === "COUNCIL_ADMIN"
              ? ((storedProfile?.department || localProfile?.department || registeredUser?.department) ? resolveCanonicalDepartmentName(storedProfile?.department || localProfile?.department || registeredUser?.department) : "")
              : (storedProfile?.degree || localProfile?.degree || storedProfile?.department || "")),
          year: storedProfile?.year || localProfile?.year || registeredUser?.year || "",
          phone: storedProfile?.phone || localProfile?.phone || registeredUser?.phone || "",
          collegeName: resolvedCollegeName,
          city: isExplicitExternal 
            ? (storedProfile?.city || localProfile?.city || registeredUser?.city || "") 
            : (isJdcoem ? (storedProfile?.city || localProfile?.city || "Nagpur") : (storedProfile?.city || localProfile?.city || registeredUser?.city || "")),
          degree: isExplicitExternal ? (storedProfile?.degree || localProfile?.degree || registeredUser?.degree || "") : "",
          customBranch: isExplicitExternal ? (storedProfile?.customBranch || localProfile?.customBranch || registeredUser?.customBranch || "") : "",
          title: storedProfile?.title || localProfile?.title || registeredUser?.title,
          facultyDesignation: storedProfile?.facultyDesignation || localProfile?.facultyDesignation || registeredUser?.facultyDesignation,
          facultyDepartment: storedProfile?.facultyDepartment || localProfile?.facultyDepartment || registeredUser?.facultyDepartment,
          facultyApprovalStatus: storedProfile?.facultyApprovalStatus || localProfile?.facultyApprovalStatus || registeredUser?.facultyApprovalStatus,
          employeeId: storedProfile?.employeeId || localProfile?.employeeId || registeredUser?.employeeId,
          profileCompleted: isCompleted,
          designationBadge: assignedBadge,
          isCouncilOfficer: isOfficer,
          adminAccess: adminAccess || undefined,
          adminAccessManaged: Boolean(adminAccess),
        };

        setUser(merged);
        try {
          localStorage.setItem("src_auth_user", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_users_updated"));

        // Persistent mandatory profile gate: if profile is not completed, immediately prompt
        if (!isCompleted) {
          setIsProfileModalOpen(true);
        } else {
          setIsProfileModalOpen(false);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid && !user?.btId && !user?.email) return;
    const unsubscribe = subscribeToAdminAccessForUser(user?.uid || "", user?.btId, (assignment) => {
      setUser((current) => {
        if (!current) return current;
        const isCurrentOwner = isOwnerEmail(current.email) || current.adminAccess?.role === "OWNER";
        // Preserve synthetic owner admin access if Firestore has no overriding document
        const effectiveAccess = assignment || (isCurrentOwner ? (current.adminAccess || {
          uid: current.uid,
          btId: current.btId || "",
          role: "OWNER",
          active: true,
          grantedBy: "system",
          grantedAt: new Date(0).toISOString(),
          updatedAt: new Date().toISOString(),
        }) : undefined);

        const revokedManagedAccess = !assignment && current.adminAccessManaged && !isOwnerEmail(current.email);
        return {
          ...current,
          adminAccess: effectiveAccess,
          role: revokedManagedAccess ? "STUDENT" : current.role,
          adminAccessManaged: Boolean(assignment),
        };
      });
    }, user?.email);
    return () => unsubscribe();
  }, [user?.uid, user?.btId, user?.email]);

  useEffect(() => {
    const handleUsersChange = () => {
      try {
        const rawAuth = localStorage.getItem("src_auth_user");
        if (rawAuth) {
          const parsed = JSON.parse(rawAuth);
          const cleanBt = parsed.btId ? parsed.btId.trim().toUpperCase() : "";
          const desig = cleanBt ? resolveDesignationByBtId(cleanBt, parsed.displayName || parsed.name || parsed.email) : null;
          if (desig) {
            parsed.designationBadge = formatDesignationBadge(desig.designationBadge);
            parsed.isCouncilOfficer = desig.isCouncilOfficer;
          } else if (cleanBt) {
            parsed.designationBadge = undefined;
            parsed.isCouncilOfficer = false;
          }

          setUser((prev) => {
            if (!prev) return prev;
            if (
              prev.department !== parsed.department ||
              prev.facultyDepartment !== parsed.facultyDepartment ||
              prev.displayName !== parsed.displayName ||
              prev.designationBadge !== parsed.designationBadge ||
              prev.isCouncilOfficer !== parsed.isCouncilOfficer
            ) {
              // Profile cache may refresh display fields, but never overwrite Firestore-authoritative RBAC.
              return {
                ...prev,
                ...parsed,
                role: prev.role,
                adminAccess: prev.adminAccess,
                adminAccessManaged: prev.adminAccessManaged,
              };
            }
            return prev;
          });
        }
      } catch {}
    };

    window.addEventListener("src_users_updated", handleUsersChange);
    window.addEventListener("src_clubs_updated", handleUsersChange);
    window.addEventListener("storage", handleUsersChange);
    return () => {
      window.removeEventListener("src_users_updated", handleUsersChange);
      window.removeEventListener("src_clubs_updated", handleUsersChange);
      window.removeEventListener("storage", handleUsersChange);
    };
  }, []);

  const loginWithGoogle = async (selectedUserType?: "JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT") => {
    setIsLoading(true);
    try {
      if (selectedUserType) {
        setPendingUserType(selectedUserType);
        try {
          sessionStorage.setItem("src_pending_user_type", selectedUserType);
        } catch {}
      }
      const fbUser = await firebaseGoogleSignIn();
      if (fbUser) {
        let storedProfile = await getUserProfileFromFirestore(fbUser.uid);
        let localProfile: Partial<UserProfile> = {};
        try {
          const cached = localStorage.getItem("src_auth_user");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.uid === fbUser.uid || (parsed.email && parsed.email.toLowerCase() === (fbUser.email || "").toLowerCase())) {
              localProfile = parsed;
            }
          }
        } catch {}

        let registeredUser: Partial<UserProfile> | undefined;
        try {
          const allStored = getStoredUsers();
          registeredUser = allStored.find(
            (u) => (u.uid && u.uid === fbUser.uid) || (u.email && u.email.toLowerCase() === (fbUser.email || "").toLowerCase())
          );
        } catch {}

        const isExplicitExternal = selectedUserType === "EXTERNAL_STUDENT" || 
          storedProfile?.userType === "EXTERNAL_STUDENT" || 
          (!storedProfile?.userType && (localProfile?.userType === "EXTERNAL_STUDENT" || registeredUser?.userType === "EXTERNAL_STUDENT"));
        const isExplicitFaculty = selectedUserType === "FACULTY" || 
          storedProfile?.role === "FACULTY" || 
          storedProfile?.userType === "FACULTY" || 
          (!storedProfile?.userType && (localProfile?.userType === "FACULTY" || registeredUser?.userType === "FACULTY"));

        const rosterBt = findBtIdByEmailInRosters(fbUser.email);
        const resolvedBtId = isExplicitExternal || isExplicitFaculty
          ? ""
          : (storedProfile?.btId !== undefined ? storedProfile.btId : (localProfile?.btId || registeredUser?.btId || rosterBt || ""));
        const cleanBt = resolvedBtId ? resolvedBtId.trim().toUpperCase() : "";

        const isOwner = isOwnerEmail(fbUser.email) ||
          storedProfile?.role === "OWNER" ||
          storedProfile?.adminAccess?.role === "OWNER" ||
          localProfile?.role === "OWNER" ||
          localProfile?.adminAccess?.role === "OWNER" ||
          registeredUser?.role === "OWNER" ||
          registeredUser?.adminAccess?.role === "OWNER";

        const isAdminUser = await checkIsAdminInFirestore(fbUser.email || "", fbUser.uid);
        const firestoreAdminAccess = await getAdminAccessFromFirestore(fbUser.uid, cleanBt, fbUser.email || undefined);
        const adminAccess: AdminAccessAssignment | null = firestoreAdminAccess || (isOwner || isAdminUser
          ? {
              uid: fbUser.uid,
              btId: cleanBt,
              email: fbUser.email || undefined,
              role: "OWNER",
              active: true,
              grantedBy: "system",
              grantedAt: new Date(0).toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : null);
        
        // Dynamic council/club roster resolution is authoritative for users with a BT ID.
        const targetName = storedProfile?.displayName || storedProfile?.name || localProfile?.displayName || localProfile?.name || registeredUser?.name || fbUser.displayName || fbUser.email;
        const designationInfo = cleanBt ? resolveDesignationByBtId(cleanBt, targetName || undefined) : null;

        const isAppointedOrHardcodedAdmin = 
          isOwner ||
          isAdminUser || 
          Boolean(adminAccess?.active) ||
          storedProfile?.role === "COUNCIL_ADMIN" || 
          storedProfile?.role === "OWNER" ||
          localProfile?.role === "COUNCIL_ADMIN" || 
          localProfile?.role === "OWNER" ||
          registeredUser?.role === "COUNCIL_ADMIN" ||
          registeredUser?.role === "OWNER";

        const assignedRole: "STUDENT" | "COUNCIL_ADMIN" | "FACULTY" | "GUEST" | "OWNER" = 
          (isOwner || adminAccess?.role === "OWNER" || storedProfile?.role === "OWNER" || registeredUser?.role === "OWNER")
            ? "OWNER"
            : isAppointedOrHardcodedAdmin 
            ? "COUNCIL_ADMIN" 
            : (isExplicitFaculty ? "FACULTY" : (storedProfile?.role || localProfile?.role || registeredUser?.role || "STUDENT"));

        // Priority: Live roster resolution > non-student stored badge > fallback
        const rawBadge = storedProfile?.designationBadge || localProfile?.designationBadge || registeredUser?.designationBadge;
        const assignedBadge = designationInfo 
          ? designationInfo.designationBadge 
          : (cleanBt ? undefined : (formatDesignationBadge(rawBadge) || undefined));

        const isOfficer = designationInfo 
          ? designationInfo.isCouncilOfficer 
          : (cleanBt ? false : Boolean(storedProfile?.isCouncilOfficer || localProfile?.isCouncilOfficer || registeredUser?.isCouncilOfficer));

        const baseObj = { ...registeredUser, ...localProfile, ...storedProfile };

        const isJdcoem = !isExplicitExternal && !isExplicitFaculty && (
          Boolean(cleanBt && cleanBt.length >= 3) || 
          storedProfile?.userType === "JDCOEM_STUDENT"
        );

        const activePending = selectedUserType || pendingUserType || (typeof window !== "undefined" ? (sessionStorage.getItem("src_pending_user_type") as any) : null);
        const resolvedUserType: "JDCOEM_STUDENT" | "FACULTY" | "EXTERNAL_STUDENT" = activePending || 
          (isExplicitFaculty ? "FACULTY" : 
          assignedRole === "FACULTY" ? "FACULTY" :
          isExplicitExternal ? "EXTERNAL_STUDENT" :
          isJdcoem ? "JDCOEM_STUDENT" :
          (storedProfile?.userType as any) || (localProfile?.userType as any) || (registeredUser?.userType as any) || "JDCOEM_STUDENT");

        const isCompleted = determineProfileCompletion(baseObj, resolvedUserType, cleanBt);

        const resolvedIsCollegeStudent = isExplicitFaculty
          ? true 
          : isExplicitExternal 
          ? false 
          : isJdcoem 
          ? true 
          : (fbUser.isCollegeStudent ?? false);

        const resolvedCollegeName = isExplicitExternal
          ? (storedProfile?.collegeName || localProfile?.collegeName || registeredUser?.collegeName || "Other College")
          : isJdcoem
          ? ((storedProfile?.collegeName && (storedProfile.collegeName.toLowerCase().includes("jdcoem") || storedProfile.collegeName.toLowerCase().includes("jd college"))) ? storedProfile.collegeName : "")
          : (storedProfile?.collegeName || localProfile?.collegeName || registeredUser?.collegeName || "");

        const merged: AuthUser = {
          ...baseObj,
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: storedProfile?.displayName || localProfile?.displayName || registeredUser?.displayName || fbUser.displayName || "Google Student",
          photoURL: fbUser.photoURL || storedProfile?.photoURL || localProfile?.photoURL || null,
          role: assignedRole,
          userType: resolvedUserType as any,
          isCollegeStudent: resolvedIsCollegeStudent,
          firstName: storedProfile?.firstName || localProfile?.firstName || registeredUser?.firstName || (fbUser.displayName ? fbUser.displayName.split(" ")[0] : ""),
          lastName: storedProfile?.lastName || localProfile?.lastName || registeredUser?.lastName || (fbUser.displayName ? fbUser.displayName.split(" ").slice(1).join(" ") : ""),
          btId: cleanBt,
          department: isExplicitExternal
            ? (storedProfile?.department || localProfile?.department || storedProfile?.degree || "")
            : (isJdcoem || resolvedUserType === "JDCOEM_STUDENT" || assignedRole === "COUNCIL_ADMIN"
              ? ((storedProfile?.department || localProfile?.department || registeredUser?.department) ? resolveCanonicalDepartmentName(storedProfile?.department || localProfile?.department || registeredUser?.department) : "")
              : (storedProfile?.degree || localProfile?.degree || storedProfile?.department || "")),
          year: storedProfile?.year || localProfile?.year || registeredUser?.year || "",
          phone: storedProfile?.phone || localProfile?.phone || registeredUser?.phone || "",
          collegeName: resolvedCollegeName,
          city: isExplicitExternal 
            ? (storedProfile?.city || localProfile?.city || registeredUser?.city || "") 
            : (isJdcoem ? (storedProfile?.city || localProfile?.city || "Nagpur") : (storedProfile?.city || localProfile?.city || registeredUser?.city || "")),
          degree: isExplicitExternal ? (storedProfile?.degree || localProfile?.degree || registeredUser?.degree || "") : "",
          customBranch: isExplicitExternal ? (storedProfile?.customBranch || localProfile?.customBranch || registeredUser?.customBranch || "") : "",
          title: storedProfile?.title || localProfile?.title || registeredUser?.title,
          facultyDesignation: storedProfile?.facultyDesignation || localProfile?.facultyDesignation || registeredUser?.facultyDesignation,
          facultyDepartment: storedProfile?.facultyDepartment || localProfile?.facultyDepartment || registeredUser?.facultyDepartment,
          facultyApprovalStatus: storedProfile?.facultyApprovalStatus || localProfile?.facultyApprovalStatus || registeredUser?.facultyApprovalStatus,
          employeeId: storedProfile?.employeeId || localProfile?.employeeId || registeredUser?.employeeId,
          profileCompleted: isCompleted,
          designationBadge: assignedBadge,
          isCouncilOfficer: isOfficer,
          adminAccess: adminAccess || undefined,
          adminAccessManaged: Boolean(adminAccess),
        };

        setUser(merged);
        // Only persist to local cache on login, not back to Firestore
        try {
          localStorage.setItem("src_auth_user", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_users_updated"));
        setIsAuthModalOpen(false);

        // Persistent mandatory profile gate: if profile is not completed, immediately prompt
        if (!isCompleted) {
          setIsProfileModalOpen(true);
        } else {
          setIsProfileModalOpen(false);
        }
      }
    } catch (error) {
      console.error("Google login failed", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const hasRealKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
        !process.env.NEXT_PUBLIC_FIREBASE_API_KEY.includes("MockKey");

      if (auth && hasRealKey) {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        throw new Error("Institutional authentication services are currently undergoing maintenance. Please use Continue with Google.");
      }
      setIsAuthModalOpen(false);
    } catch (error: any) {
      console.error("Authentication error:", error);
      const message = error?.code === "auth/invalid-credential" || error?.code === "auth/wrong-password" || error?.code === "auth/user-not-found"
        ? "Invalid email or password. Please verify your credentials or sign in with Google."
        : (error?.message || "Failed to sign in. Please try again.");
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    setIsLoading(true);
    try {
      const hasRealKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
        !process.env.NEXT_PUBLIC_FIREBASE_API_KEY.includes("MockKey");

      if (auth && hasRealKey) {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: name });
        setIsAuthModalOpen(false);
        setIsProfileModalOpen(true);
      } else {
        throw new Error("Institutional account creation is currently undergoing maintenance. Please use Continue with Google.");
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      const message = error?.code === "auth/email-already-in-use"
        ? "An account with this email already exists. Please sign in instead."
        : error?.code === "auth/weak-password"
        ? "Password should be at least 6 characters."
        : (error?.message || "Failed to create account.");
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;

    const isExternal = data.userType === "EXTERNAL_STUDENT";
    const isFaculty = data.userType === "FACULTY" || data.role === "FACULTY";

    const resolvedBtId = isExternal || isFaculty
      ? ""
      : (data.btId !== undefined ? data.btId : user.btId || "").trim().toUpperCase();

    const candidateName = data.displayName || `${data.firstName || user.firstName || ""} ${data.lastName || user.lastName || ""}`.trim() || user.displayName || user.email;
    const designationInfo = resolvedBtId ? resolveDesignationByBtId(resolvedBtId, candidateName || undefined) : null;

    const updatedUser: AuthUser = {
      ...user,
      ...data,
      userType: data.userType || user.userType || "JDCOEM_STUDENT",
      btId: resolvedBtId,
      collegeName: isExternal ? (data.collegeName || user.collegeName || "Other College") : "",
      city: isExternal ? (data.city || user.city || "") : (user.city || "Nagpur"),
      degree: isExternal ? (data.degree || data.customBranch || user.degree || "") : "",
      customBranch: isExternal ? (data.customBranch || data.degree || user.customBranch || "") : "",
      displayName: data.displayName || `${data.firstName || user.firstName || ""} ${data.lastName || user.lastName || ""}`.trim() || user.displayName,
      role: data.role || user.role || "STUDENT",
      designationBadge: designationInfo ? designationInfo.designationBadge : (isExternal || isFaculty ? undefined : (formatDesignationBadge(data.designationBadge || user.designationBadge) || undefined)),
      isCouncilOfficer: designationInfo ? designationInfo.isCouncilOfficer : (isExternal || isFaculty ? false : Boolean(data.isCouncilOfficer || user.isCouncilOfficer)),
      profileCompleted: true,
    };

    setUser(updatedUser);
    setPendingUserType(null);
    try {
      localStorage.setItem("src_auth_user", JSON.stringify(updatedUser));
      sessionStorage.removeItem("src_pending_user_type");
    } catch {}
    saveRegisteredUser(updatedUser);
    setIsProfileModalOpen(false);

    // Save to Firestore asynchronously
    try {
      await saveUserProfileToFirestore(user.uid, updatedUser);
    } catch (e) {
      console.warn("Firestore sync background notice", e);
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const uid = user.uid;
      markUserAsDeleted(uid);
      try {
        localStorage.removeItem("src_auth_user");
        sessionStorage.removeItem("src_pending_user_type");
      } catch {}
      await firebaseSignOut();
      setUser(null);
      setIsProfileModalOpen(false);
      setIsAuthModalOpen(false);
      window.dispatchEvent(new CustomEvent("src_users_updated"));
    } catch (err) {
      console.error("Failed to delete account:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await firebaseSignOut();
      setUser(null);
      setPendingUserType(null);
      try {
        localStorage.removeItem("src_auth_user");
        sessionStorage.removeItem("src_pending_user_type");
      } catch {}
    } catch (error) {
      console.error("Sign out notice", error);
      setUser(null);
      setPendingUserType(null);
      try {
        localStorage.removeItem("src_auth_user");
        sessionStorage.removeItem("src_pending_user_type");
      } catch {}
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin: isOwnerEmail(user?.email) || user?.role === "COUNCIL_ADMIN" || user?.role === "OWNER" || user?.adminAccess?.role === "OWNER" || (user?.adminAccess?.active !== false && Boolean(user?.adminAccess?.role)),
        isOwner: isOwnerEmail(user?.email) || user?.adminAccess?.role === "OWNER" || user?.role === "OWNER",
        adminAccess: user?.adminAccess || null,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        isProfileModalOpen,
        openProfileModal: () => setIsProfileModalOpen(true),
        closeProfileModal: () => setIsProfileModalOpen(false),
        pendingUserType,
        setPendingUserType,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        updateUserProfile,
        deleteAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
