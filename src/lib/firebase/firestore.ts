import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./config";
import { UserProfile } from "@/types/auth";

export interface StudentRegistrationRecord {
  id: string; // Accreditation Registration ID (e.g. SRC-PRA-8291)
  eventId: string;
  eventTitle: string;
  teamName?: string;
  leaderName: string;
  email: string;
  phone: string;
  college: string;
  department: string;
  year: string;
  btId?: string; // Replaced rollNo with btId
  teamSize: number;
  members?: Array<{
    name: string;
    email: string;
    phone: string;
    role: string;
  }>;
  status: "CONFIRMED" | "WAITLISTED" | "CHECKED_IN" | "CANCELLED";
  checkInTimestamp?: any;
  createdAt: any;
  qrPayload: string;
}

const REGISTRATIONS_COLLECTION = "registrations";
const ADMINS_COLLECTION = "admins";
const USERS_COLLECTION = "users";

/**
 * Check if an email has Council Admin privileges via Firestore
 */
export async function checkIsAdminInFirestore(email: string): Promise<boolean> {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();

  // Default fallback admin list
  const DEFAULT_ADMINS = [
    "admin@jdcoem.ac.in",
    "harshxfr@gmail.com",
    "shendeha@jdcoem.ac.in",
    "src.president@jdcoem.ac.in",
    "src.mentor@jdcoem.ac.in",
    "src.gensec@jdcoem.ac.in",
  ];

  if (
    DEFAULT_ADMINS.includes(normalizedEmail) || 
    normalizedEmail.includes("admin") ||
    normalizedEmail.startsWith("src.")
  ) {
    return true;
  }

  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, ADMINS_COLLECTION, normalizedEmail);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists() && snapshot.data()?.active !== false) {
        return true;
      }
    }
  } catch (error) {
    console.warn("Firestore admin check notice", error);
  }

  return false;
}

/**
 * Fetch a student user profile from Firestore users collection
 */
export async function getUserProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, USERS_COLLECTION, uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as UserProfile;
      }
    }
  } catch (error) {
    console.warn("Firestore user profile fetch error", error);
  }
  return null;
}

/**
 * Save or update a student user profile in Firestore
 */
export async function saveUserProfileToFirestore(
  uid: string, 
  profileData: Partial<UserProfile>
): Promise<void> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, USERS_COLLECTION, uid);
      await setDoc(docRef, {
        ...profileData,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  } catch (error) {
    console.warn("Firestore user profile save error", error);
  }
}

/**
 * Fetch all registered student users from Firestore
 */
export async function getAllUsersFromFirestore(): Promise<UserProfile[]> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const usersRef = collection(db, USERS_COLLECTION);
      const snapshot = await getDocs(usersRef);
      if (!snapshot.empty) {
        return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
      }
    }
  } catch (error) {
    console.warn("Could not fetch users from Firestore", error);
  }

  try {
    const local = localStorage.getItem("src_registered_users");
    if (local) return JSON.parse(local);
  } catch {}
  return [];
}

/**
 * Subscribe to real-time updates of all registered student users in Firestore
 */
export function subscribeToUsersFromFirestore(callback: (users: UserProfile[]) => void): () => void {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return () => {};
  }
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    return onSnapshot(
      usersRef, 
      (snapshot) => {
        const users = snapshot.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
        callback(users);
      },
      (error) => {
        console.warn("Firestore live users snapshot notice", error);
      }
    );
  } catch (e) {
    console.warn("Firestore subscription error", e);
    return () => {};
  }
}

/**
 * Save a new event registration to Firestore with local fallback
 */
export async function saveRegistrationToFirestore(
  data: Omit<StudentRegistrationRecord, "createdAt" | "status">
): Promise<StudentRegistrationRecord> {
  const newRecord: StudentRegistrationRecord = {
    ...data,
    status: "CONFIRMED",
    createdAt: serverTimestamp(),
  };

  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, REGISTRATIONS_COLLECTION, data.id);
      await setDoc(docRef, newRecord);
    }
  } catch (error) {
    console.warn("Firestore write skipped (saved to local cache):", error);
  }

  // Also persist in localStorage for instant offline access and demo reliability
  try {
    const existing = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
    localStorage.setItem("src_local_registrations", JSON.stringify([newRecord, ...existing]));
  } catch (e) {
    console.warn("LocalStorage save warning", e);
  }

  return newRecord;
}

/**
 * Get registration details by ID
 */
export async function getRegistrationById(id: string): Promise<StudentRegistrationRecord | null> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, REGISTRATIONS_COLLECTION, id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as StudentRegistrationRecord;
      }
    }
  } catch (error) {
    console.warn("Firestore read error, checking local store", error);
  }

  // Fallback to local store
  try {
    const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
    return local.find((r: StudentRegistrationRecord) => r.id === id) || null;
  } catch {
    return null;
  }
}

/**
 * Mark a student registration as CHECKED-IN during gate entry QR scanning
 */
export async function checkInStudentPass(id: string): Promise<boolean> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, REGISTRATIONS_COLLECTION, id);
      await updateDoc(docRef, {
        status: "CHECKED_IN",
        checkInTimestamp: serverTimestamp(),
      });
    }

    // Update local storage too
    const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
    const updated = local.map((r: StudentRegistrationRecord) => 
      r.id === id ? { ...r, status: "CHECKED_IN", checkInTimestamp: new Date().toISOString() } : r
    );
    localStorage.setItem("src_local_registrations", JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error("Failed to check in student pass", error);
    return false;
  }
}

const SITE_CONTENT_COLLECTION = "site_content";

/**
 * Save site content document (e.g. events, clubs, team, hero) to Firestore
 */
export async function saveSiteContentToFirestore<T>(docId: string, data: T): Promise<void> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, SITE_CONTENT_COLLECTION, docId);
      await setDoc(docRef, { payload: data, updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch (error) {
    console.warn(`Firestore saveSiteContent error [${docId}]`, error);
  }
}

/**
 * Get site content document from Firestore
 */
export async function getSiteContentFromFirestore<T>(docId: string): Promise<T | null> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, SITE_CONTENT_COLLECTION, docId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists() && snapshot.data()?.payload !== undefined) {
        return snapshot.data()?.payload as T;
      }
    }
  } catch (error) {
    console.warn(`Firestore getSiteContent error [${docId}]`, error);
  }
  return null;
}

/**
 * Subscribe to real-time changes of site content document
 */
export function subscribeToSiteContent<T>(docId: string, callback: (data: T) => void): () => void {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return () => {};
  }
  try {
    const docRef = doc(db, SITE_CONTENT_COLLECTION, docId);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.payload !== undefined) {
          callback(snapshot.data()?.payload as T);
        }
      },
      (error) => {
        console.warn(`Firestore subscribeToSiteContent notice [${docId}]`, error);
      }
    );
  } catch (e) {
    console.warn(`Firestore subscription setup notice [${docId}]`, e);
    return () => {};
  }
}
