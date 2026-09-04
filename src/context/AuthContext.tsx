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
  saveUserProfileToFirestore 
} from "@/lib/firebase/firestore";
import { UserProfile, AuthUser, AuthContextType } from "@/types/auth";
import { saveRegisteredUser, getStoredUsers, resolveDesignationByBtId } from "@/lib/usersStore";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    // Check initial cached user in localStorage
    try {
      const cached = localStorage.getItem("src_auth_user");
      if (cached) {
        const parsed = JSON.parse(cached);
        const cleanBt = parsed.btId ? parsed.btId.trim().toUpperCase() : "";
        const desig = cleanBt ? resolveDesignationByBtId(cleanBt) : null;
        if (desig) {
          parsed.designationBadge = desig.designationBadge;
          parsed.isCouncilOfficer = true;
        }
        setUser(parsed);
      }
    } catch (e) {
      console.warn("Auth cache read error", e);
    }

    // Subscribe to Auth listener
    const unsubscribe = subscribeToAuth(async (fbUser) => {
      if (fbUser && fbUser.email) {
        const isAdminUser = await checkIsAdminInFirestore(fbUser.email);
        const storedProfile = await getUserProfileFromFirestore(fbUser.uid);

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

        const resolvedBtId = storedProfile?.btId || localProfile?.btId || registeredUser?.btId || "";
        const cleanBt = resolvedBtId ? resolvedBtId.trim().toUpperCase() : "";

        // CRITICAL: Firestore profile is authoritative for designation badge.
        // Only fall back to resolveDesignationByBtId if Firestore has no badge stored.
        // This prevents stale localStorage council data from poisoning the role.
        const firestoreBadge = storedProfile?.designationBadge;
        const designationInfo = (!firestoreBadge && cleanBt) ? resolveDesignationByBtId(cleanBt) : null;

        const isCompleted = Boolean(
          storedProfile?.profileCompleted || 
          localProfile?.profileCompleted || 
          registeredUser?.profileCompleted || 
          (cleanBt && cleanBt.length > 0)
        );

        const assignedRole = isAdminUser 
          ? "COUNCIL_ADMIN" 
          : (storedProfile?.role || localProfile?.role || registeredUser?.role || "STUDENT");

        // Priority: Firestore badge > resolved from council data > local cache
        const assignedBadge = firestoreBadge 
          || (designationInfo ? designationInfo.designationBadge : null)
          || localProfile?.designationBadge 
          || registeredUser?.designationBadge;

        const baseObj = { ...registeredUser, ...localProfile, ...storedProfile };

        const resolvedUserType = storedProfile?.userType || localProfile?.userType || registeredUser?.userType || 
          (storedProfile?.role === "FACULTY" || localProfile?.role === "FACULTY" ? "FACULTY" : 
          (storedProfile?.collegeName || localProfile?.collegeName || !fbUser.isCollegeStudent) ? "EXTERNAL_STUDENT" : "JDCOEM_STUDENT");

        const merged: AuthUser = {
          ...baseObj,
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: storedProfile?.displayName || localProfile?.displayName || registeredUser?.displayName || fbUser.displayName || fbUser.email?.split("@")[0] || "Student",
          photoURL: fbUser.photoURL || storedProfile?.photoURL || localProfile?.photoURL || registeredUser?.photoURL || null,
          role: assignedRole,
          userType: resolvedUserType as any,
          isCollegeStudent: resolvedUserType === "EXTERNAL_STUDENT" ? false : fbUser.isCollegeStudent,
          firstName: storedProfile?.firstName || localProfile?.firstName || registeredUser?.firstName || (fbUser.displayName ? fbUser.displayName.split(" ")[0] : ""),
          lastName: storedProfile?.lastName || localProfile?.lastName || registeredUser?.lastName || (fbUser.displayName ? fbUser.displayName.split(" ").slice(1).join(" ") : ""),
          btId: cleanBt,
          department: storedProfile?.department || localProfile?.department || registeredUser?.department || (resolvedUserType === "EXTERNAL_STUDENT" ? (storedProfile?.degree || localProfile?.degree || "Undergraduate") : "Computer Science and Engineering"),
          year: storedProfile?.year || localProfile?.year || registeredUser?.year || "3rd Year",
          phone: storedProfile?.phone || localProfile?.phone || registeredUser?.phone || "",
          collegeName: storedProfile?.collegeName || localProfile?.collegeName || registeredUser?.collegeName || "",
          city: storedProfile?.city || localProfile?.city || registeredUser?.city || "",
          degree: storedProfile?.degree || localProfile?.degree || registeredUser?.degree || storedProfile?.customBranch || localProfile?.customBranch || registeredUser?.customBranch || "",
          customBranch: storedProfile?.customBranch || localProfile?.customBranch || registeredUser?.customBranch || storedProfile?.degree || localProfile?.degree || registeredUser?.degree || "",
          title: storedProfile?.title || localProfile?.title || registeredUser?.title,
          facultyDesignation: storedProfile?.facultyDesignation || localProfile?.facultyDesignation || registeredUser?.facultyDesignation,
          facultyDepartment: storedProfile?.facultyDepartment || localProfile?.facultyDepartment || registeredUser?.facultyDepartment,
          facultyApprovalStatus: storedProfile?.facultyApprovalStatus || localProfile?.facultyApprovalStatus || registeredUser?.facultyApprovalStatus,
          employeeId: storedProfile?.employeeId || localProfile?.employeeId || registeredUser?.employeeId,
          profileCompleted: isCompleted,
          designationBadge: assignedBadge,
          isCouncilOfficer: (firestoreBadge || designationInfo) ? true : Boolean(storedProfile?.isCouncilOfficer || localProfile?.isCouncilOfficer || registeredUser?.isCouncilOfficer),
        };

        setUser(merged);
        // CRITICAL: Only persist to local cache. Do NOT call saveRegisteredUser(merged) here,
        // because it writes back to Firestore with potentially stale designation data from
        // localStorage, creating a poisoning feedback loop across devices.
        // Firestore writes happen only through explicit user actions (profile update, admin changes).
        try {
          localStorage.setItem("src_auth_user", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_users_updated"));

        const isExternalStudent = merged.userType === "EXTERNAL_STUDENT" || merged.isCollegeStudent === false;
        if (!isCompleted && !resolvedBtId && !isExternalStudent) {
          setIsProfileModalOpen(true);
        } else if (!isCompleted) {
          setIsProfileModalOpen(true);
        } else {
          setIsProfileModalOpen(false);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const fbUser = await firebaseGoogleSignIn();
      if (fbUser) {
        const isAdminUser = await checkIsAdminInFirestore(fbUser.email || "");
        const storedProfile = await getUserProfileFromFirestore(fbUser.uid);

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

        const resolvedBtId = storedProfile?.btId || localProfile?.btId || registeredUser?.btId || "";
        const cleanBt = resolvedBtId ? resolvedBtId.trim().toUpperCase() : "";
        
        // CRITICAL: Firestore profile is authoritative for designation badge.
        const firestoreBadge = storedProfile?.designationBadge;
        const designationInfo = (!firestoreBadge && cleanBt) ? resolveDesignationByBtId(cleanBt) : null;

        const isCompleted = Boolean(
          storedProfile?.profileCompleted || 
          localProfile?.profileCompleted || 
          registeredUser?.profileCompleted || 
          (cleanBt && cleanBt.length > 0)
        );

        const assignedRole = isAdminUser 
          ? "COUNCIL_ADMIN" 
          : (storedProfile?.role || localProfile?.role || registeredUser?.role || "STUDENT");

        // Priority: Firestore badge > resolved from council data > local cache
        const assignedBadge = firestoreBadge
          || (designationInfo ? designationInfo.designationBadge : null)
          || localProfile?.designationBadge
          || registeredUser?.designationBadge;

        const baseObj = { ...storedProfile, ...localProfile, ...registeredUser };

        const merged: AuthUser = {
          ...baseObj,
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: storedProfile?.displayName || localProfile?.displayName || registeredUser?.displayName || fbUser.displayName || "Google Student",
          photoURL: fbUser.photoURL || storedProfile?.photoURL || localProfile?.photoURL || null,
          role: assignedRole,
          userType: (storedProfile?.userType || localProfile?.userType || registeredUser?.userType || (fbUser.isCollegeStudent ? "JDCOEM_STUDENT" : "EXTERNAL_STUDENT")) as any,
          isCollegeStudent: fbUser.isCollegeStudent,
          firstName: storedProfile?.firstName || localProfile?.firstName || registeredUser?.firstName || (fbUser.displayName ? fbUser.displayName.split(" ")[0] : ""),
          lastName: storedProfile?.lastName || localProfile?.lastName || registeredUser?.lastName || (fbUser.displayName ? fbUser.displayName.split(" ").slice(1).join(" ") : ""),
          btId: cleanBt,
          department: storedProfile?.department || localProfile?.department || registeredUser?.department || "Computer Science and Engineering",
          year: storedProfile?.year || localProfile?.year || registeredUser?.year || "3rd Year",
          phone: storedProfile?.phone || localProfile?.phone || registeredUser?.phone || "",
          collegeName: storedProfile?.collegeName || localProfile?.collegeName || registeredUser?.collegeName || "",
          city: storedProfile?.city || localProfile?.city || registeredUser?.city || "",
          degree: storedProfile?.degree || localProfile?.degree || registeredUser?.degree || storedProfile?.customBranch || localProfile?.customBranch || registeredUser?.customBranch || "",
          customBranch: storedProfile?.customBranch || localProfile?.customBranch || registeredUser?.customBranch || storedProfile?.degree || localProfile?.degree || registeredUser?.degree || "",
          title: storedProfile?.title || localProfile?.title || registeredUser?.title,
          facultyDesignation: storedProfile?.facultyDesignation || localProfile?.facultyDesignation || registeredUser?.facultyDesignation,
          facultyDepartment: storedProfile?.facultyDepartment || localProfile?.facultyDepartment || registeredUser?.facultyDepartment,
          facultyApprovalStatus: storedProfile?.facultyApprovalStatus || localProfile?.facultyApprovalStatus || registeredUser?.facultyApprovalStatus,
          employeeId: storedProfile?.employeeId || localProfile?.employeeId || registeredUser?.employeeId,
          profileCompleted: isCompleted,
          designationBadge: assignedBadge,
          isCouncilOfficer: (firestoreBadge || designationInfo) ? true : Boolean(storedProfile?.isCouncilOfficer || localProfile?.isCouncilOfficer || registeredUser?.isCouncilOfficer),
        };

        setUser(merged);
        // Only persist to local cache on login, not back to Firestore
        try {
          localStorage.setItem("src_auth_user", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_users_updated"));
        setIsAuthModalOpen(false);

        const isExternalStudent = merged.userType === "EXTERNAL_STUDENT" || merged.isCollegeStudent === false;
        if (!isCompleted && !cleanBt && !isExternalStudent) {
          setIsProfileModalOpen(true);
        } else if (!isCompleted) {
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

    const mergedBtId = (data.btId !== undefined ? data.btId : user.btId || "").trim().toUpperCase();
    const designationInfo = mergedBtId ? resolveDesignationByBtId(mergedBtId) : null;

    const updatedUser: AuthUser = {
      ...user,
      ...data,
      btId: mergedBtId,
      displayName: data.displayName || `${data.firstName || user.firstName || ""} ${data.lastName || user.lastName || ""}`.trim() || user.displayName,
      role: data.role || user.role || "STUDENT",
      designationBadge: designationInfo ? designationInfo.designationBadge : (data.designationBadge || user.designationBadge),
      isCouncilOfficer: designationInfo ? true : Boolean(data.isCouncilOfficer || user.isCouncilOfficer),
      profileCompleted: true,
    };

    setUser(updatedUser);
    localStorage.setItem("src_auth_user", JSON.stringify(updatedUser));
    saveRegisteredUser(updatedUser);
    setIsProfileModalOpen(false);

    // Save to Firestore asynchronously
    try {
      await saveUserProfileToFirestore(user.uid, updatedUser);
    } catch (e) {
      console.warn("Firestore sync background notice", e);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await firebaseSignOut();
      setUser(null);
      localStorage.removeItem("src_auth_user");
    } catch (error) {
      console.error("Sign out notice", error);
      setUser(null);
      localStorage.removeItem("src_auth_user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin: user?.role === "COUNCIL_ADMIN",
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        isProfileModalOpen,
        openProfileModal: () => setIsProfileModalOpen(true),
        closeProfileModal: () => setIsProfileModalOpen(false),
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        updateUserProfile,
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
