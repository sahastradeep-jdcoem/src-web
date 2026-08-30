import { 
  signInWithPopup, 
  signInWithRedirect,
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { auth } from "./config";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export interface AuthUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isCollegeStudent: boolean;
}

/**
 * 1-Click Google Sign-In with real Google Account Selector
 */
export async function signInWithGoogle(): Promise<AuthUserProfile | null> {
  if (!auth) {
    throw new Error("Firebase Authentication is not initialized.");
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const email = user.email || "";
    const isCollegeStudent = email.endsWith("@jdcoem.ac.in") || email.endsWith("@jdcoem.in");

    const profile: AuthUserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      isCollegeStudent,
    };

    localStorage.setItem("src_auth_user", JSON.stringify(profile));
    return profile;
  } catch (error: any) {
    console.error("Google Sign-In Error:", error);

    if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
      // User closed the popup intentionally
      return null;
    }

    if (error.code === "auth/unauthorized-domain") {
      const hostname = typeof window !== "undefined" ? window.location.hostname : "this domain";
      throw new Error(
        `Domain '${hostname}' is not authorized in Firebase Console. Please add '${hostname}' in Firebase Console -> Authentication -> Settings -> Authorized Domains.`
      );
    }

    if (error.code === "auth/popup-blocked") {
      // If popup was blocked by browser, try redirect method
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectErr: any) {
        throw new Error("Google Sign-In popup was blocked by your browser. Please allow popups for this site.");
      }
    }

    throw new Error(error.message || "Failed to sign in with Google. Please try again.");
  }
}

/**
 * Sign out user
 */
export async function signOut(): Promise<void> {
  try {
    if (auth) {
      await firebaseSignOut(auth);
    }
  } catch (error) {
    console.warn("Firebase sign-out notice", error);
  }
  localStorage.removeItem("src_auth_user");
}

/**
 * Subscribe to auth state changes directly from Firebase
 */
export function subscribeToAuth(callback: (user: AuthUserProfile | null) => void) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      const email = user.email || "";
      const profile: AuthUserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        isCollegeStudent: email.endsWith("@jdcoem.ac.in") || email.endsWith("@jdcoem.in"),
      };
      localStorage.setItem("src_auth_user", JSON.stringify(profile));
      callback(profile);
    } else {
      localStorage.removeItem("src_auth_user");
      callback(null);
    }
  });
}
