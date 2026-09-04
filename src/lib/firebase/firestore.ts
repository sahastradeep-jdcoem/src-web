import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
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
  registeredAt?: string;
  members?: Array<{
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    btId?: string;
    department?: string;
    year?: string;
  }>;
  teamMembers?: Array<{
    name: string;
    btId: string;
    department?: string;
    year?: string;
    email?: string;
    isLeader?: boolean;
  }>;
  status: "CONFIRMED" | "WAITLISTED" | "CHECKED_IN" | "CANCELLED";
  paymentStatus?: "FREE" | "PAID" | "PENDING";
  paymentId?: string; // Razorpay Payment ID e.g. pay_xxxxxxxx
  orderId?: string; // Razorpay Order ID e.g. order_xxxxxxxx
  amountPaid?: number; // In INR (e.g. 150)
  currency?: string; // e.g. "INR"
  paidAt?: string;
  tenureId?: string; // e.g. "tenure-2025-26"
  checkInTimestamp?: any;
  createdAt: any;
  qrPayload: string;
  collegeName?: string;
  city?: string;
  customBranch?: string;
  userType?: string;
  isCollegeStudent?: boolean;
  parentEventName?: string;
  parentEventId?: string;
  subEventBadge?: string;
  customAnswers?: Record<string, any>;
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

  if (DEFAULT_ADMINS.includes(normalizedEmail)) {
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
 * Deeply strips undefined values from objects and arrays so Firestore setDoc / updateDoc never throws
 */
export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as unknown as T;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefined(item)) as unknown as T;
  }
  const result: any = {};
  for (const key of Object.keys(obj as any)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      result[key] = typeof val === "object" && val !== null ? cleanUndefined(val) : val;
    }
  }
  return result;
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
      const cleanProfile = cleanUndefined(profileData);
      const docRef = doc(db, USERS_COLLECTION, uid);
      await setDoc(docRef, {
        ...cleanProfile,
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
  const nowIso = new Date().toISOString();
  const cleanData = cleanUndefined(data);
  const newRecord: StudentRegistrationRecord = {
    ...cleanData,
    registeredAt: cleanData.registeredAt || nowIso,
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
    const localRecord = {
      ...newRecord,
      createdAt: nowIso,
      registeredAt: cleanData.registeredAt || nowIso,
      paidAt: cleanData.paidAt || (cleanData.amountPaid && cleanData.amountPaid > 0 ? nowIso : undefined),
    };
    localStorage.setItem("src_local_registrations", JSON.stringify([localRecord, ...existing]));
  } catch (e) {
    console.warn("LocalStorage save warning", e);
  }

  return newRecord;
}

/**
 * Get registration details by ID
 */
export async function getRegistrationById(id: string): Promise<StudentRegistrationRecord | null> {
  if (!id || id.startsWith("hub_poll_")) return null;
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
 * Check if a student (by email or BT ID) has already registered for a specific event
 */
export async function checkExistingStudentRegistration(
  eventId: string,
  eventSlug: string,
  email?: string | null,
  btId?: string | null
): Promise<StudentRegistrationRecord | null> {
  const cleanEmail = email?.trim().toLowerCase();
  const cleanBtId = btId?.trim().toUpperCase();
  const cleanEventId = eventId.trim().toLowerCase();
  const cleanEventSlug = eventSlug.trim().toLowerCase();

  const matchesRecord = (r: StudentRegistrationRecord): boolean => {
    const recEventId = (r.eventId || "").trim().toLowerCase();
    const isSameEvent = recEventId === cleanEventId || recEventId === cleanEventSlug;
    if (!isSameEvent) return false;

    // Check primary delegate
    if (cleanEmail && r.email && r.email.trim().toLowerCase() === cleanEmail) return true;
    if (cleanBtId && r.btId && r.btId.trim().toUpperCase() === cleanBtId) return true;

    // Check team members
    if (r.teamMembers && Array.isArray(r.teamMembers)) {
      return r.teamMembers.some((m: any) => {
        if (cleanEmail && m.email && m.email.trim().toLowerCase() === cleanEmail) return true;
        if (cleanBtId && m.btId && m.btId.trim().toUpperCase() === cleanBtId) return true;
        return false;
      });
    }

    return false;
  };

  // Check local cache first
  try {
    const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
    if (Array.isArray(local)) {
      const match = local.find(matchesRecord);
      if (match) return match;
    }
  } catch {}

  // Check Firestore
  try {
    const all = await getAllRegistrationsFromFirestore();
    const match = all.find(matchesRecord);
    if (match) return match;
  } catch {}

  return null;
}

/**
 * Mark a student registration as CHECKED-IN during gate entry QR scanning
 */
export async function checkInStudentPass(id: string): Promise<boolean> {
  if (!id || id.startsWith("hub_poll_")) return false;
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

/**
 * Fetch all registrations from Firestore (excluding poll ballots)
 */
export async function getAllRegistrationsFromFirestore(): Promise<StudentRegistrationRecord[]> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const colRef = collection(db, REGISTRATIONS_COLLECTION);
      const snapshot = await getDocs(colRef);
      if (!snapshot.empty) {
        return snapshot.docs
          .filter((d) => !d.id.startsWith("hub_poll_") && !(d.data() as any).customAnswers?.isHubBallot)
          .map((d) => ({ id: d.id, ...d.data() } as StudentRegistrationRecord));
      }
    }
  } catch (error) {
    console.warn("Could not fetch registrations from Firestore", error);
  }

  try {
    const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
    if (Array.isArray(local)) {
      return local.filter((r: any) => !r.id?.startsWith("hub_poll_") && !r.customAnswers?.isHubBallot);
    }
  } catch {}
  return [];
}

/**
 * Subscribe to real-time updates of event registrations in Firestore (excluding poll ballots)
 */
export function subscribeToRegistrationsFromFirestore(
  callback: (regs: StudentRegistrationRecord[]) => void
): () => void {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return () => {};
  }
  try {
    const colRef = collection(db, REGISTRATIONS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list = snapshot.docs
          .filter((d) => !d.id.startsWith("hub_poll_") && !(d.data() as any).customAnswers?.isHubBallot)
          .map((d) => ({ id: d.id, ...d.data() } as StudentRegistrationRecord));
        callback(list);
      },
      (error) => {
        console.warn("Firestore live registrations notice", error);
      }
    );
  } catch (e) {
    console.warn("Firestore subscription error for registrations", e);
    return () => {};
  }
}

/**
 * Permanently delete a single registration from Firestore and local storage
 */
export async function deleteRegistrationFromFirestore(id: string): Promise<boolean> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, REGISTRATIONS_COLLECTION, id);
      await deleteDoc(docRef);
    }
  } catch (error) {
    console.warn("Firestore delete error for registration:", id, error);
  }

  if (typeof window !== "undefined") {
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      const updated = local.filter((r: any) => r.id !== id);
      localStorage.setItem("src_local_registrations", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("src_registrations_updated", { detail: updated }));
    } catch {}
  }
  return true;
}

/**
 * Cascade-delete all registrations belonging to a deleted event
 */
export async function deleteRegistrationsForEvent(
  eventId: string, 
  eventSlug?: string, 
  eventName?: string
): Promise<number> {
  let deletedCount = 0;

  // 1. Query and delete from Firestore
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const colRef = collection(db, REGISTRATIONS_COLLECTION);
      const snapshot = await getDocs(colRef);
      
      for (const d of snapshot.docs) {
        const data = d.data();
        const matchesEvent =
          d.id.toLowerCase().includes(eventId.toLowerCase()) ||
          (data.eventId && (data.eventId === eventId || (eventSlug && data.eventId === eventSlug))) ||
          (data.eventTitle && eventName && data.eventTitle.toLowerCase().trim() === eventName.toLowerCase().trim()) ||
          (data.eventTitle && eventName && data.eventTitle.toLowerCase().includes(eventName.toLowerCase())) ||
          (eventSlug && d.id.toLowerCase().includes(eventSlug.toLowerCase()));

        if (matchesEvent) {
          await deleteDoc(doc(db, REGISTRATIONS_COLLECTION, d.id));
          deletedCount++;
        }
      }
    }
  } catch (error) {
    console.warn("Firestore cascade delete error for event registrations:", error);
  }

  // 2. Clean up local storage
  if (typeof window !== "undefined") {
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      const updated = local.filter((r: any) => {
        const matchesEvent =
          r.id.toLowerCase().includes(eventId.toLowerCase()) ||
          (r.eventId && (r.eventId === eventId || (eventSlug && r.eventId === eventSlug))) ||
          (r.eventTitle && eventName && r.eventTitle.toLowerCase().trim() === eventName.toLowerCase().trim()) ||
          (r.eventTitle && eventName && r.eventTitle.toLowerCase().includes(eventName.toLowerCase())) ||
          (eventSlug && r.id.toLowerCase().includes(eventSlug.toLowerCase()));
        return !matchesEvent;
      });

      localStorage.setItem("src_local_registrations", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("src_registrations_updated", { detail: updated }));
    } catch {}
  }

  return deletedCount;
}

const SITE_CONTENT_COLLECTION = "site_content";

/**
 * Save site content document (e.g. events, clubs, team, hero) to Firestore
 */
export async function saveSiteContentToFirestore<T>(docId: string, data: T): Promise<void> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const sanitized = cleanUndefined(data);
      const docRef = doc(db, SITE_CONTENT_COLLECTION, docId);
      await setDoc(docRef, { payload: sanitized, updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch (error) {
    console.error(`Firestore saveSiteContent error [${docId}]`, error);
    throw error; // Re-throw so enqueueCloudWrite can catch and queue for retry
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
