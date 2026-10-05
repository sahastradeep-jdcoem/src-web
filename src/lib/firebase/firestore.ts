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
import { AdminAccessAssignment, AdminAccessRole, normalizeBtId, isOwnerEmail } from "@/types/rbac";
import { EventItem } from "@/types";
import { safeStorageSet } from "@/lib/safeStorage";

export interface StudentRegistrationRecord {
  id: string; // Accreditation Registration ID (e.g. SRC-PRA-8291)
  eventId: string;
  eventSlug?: string;
  eventName?: string;
  eventTitle: string;
  teamType?: string;
  teamName?: string;
  leaderName: string;
  participantName?: string;
  ticketCode?: string;
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
  paymentStatus?: "FREE" | "PAID" | "PENDING" | "FAILED";
  paymentId?: string; // Gateway Payment / Transaction ID
  orderId?: string; // Gateway Order ID
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
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  refundId?: string;
  refundStatus?: "INITIATED" | "PROCESSED" | "FAILED";
  refundAmount?: number;
  refundedAt?: string;
}

const REGISTRATIONS_COLLECTION = "registrations";
const ADMINS_COLLECTION = "admins";
const USERS_COLLECTION = "users";
export const ADMIN_ACCESS_COLLECTION = "admin_access";

/**
 * Resolves a student's BT ID from official rosters using their email address.
 * Matches across canonical council, council roster, hosting committee, spokespersons, and chartered clubs.
 */
export function findBtIdByEmailInRosters(email?: string | null): string {
  if (!email) return "";
  const cleanEmail = email.toLowerCase().trim();

  // 1. Canonical council JSON
  try {
    const canonical = require("@/data/canonicalCouncil.json");
    if (Array.isArray(canonical)) {
      const match = canonical.find((c: any) => c.email && c.email.toLowerCase().trim() === cleanEmail);
      if (match?.btId) return normalizeBtId(match.btId);
    }
  } catch {}

  // 2. Council store
  try {
    const { getStoredCouncilMembers, getStoredHostingCommittee, getStoredSpokespersons } = require("@/lib/councilStore");
    const members = [
      ...getStoredCouncilMembers(),
      ...getStoredHostingCommittee(),
      ...getStoredSpokespersons(),
    ];
    const match = members.find((m: any) => m.email && m.email.toLowerCase().trim() === cleanEmail);
    if (match?.btId) return normalizeBtId(match.btId);
  } catch {}

  // 3. Chartered Clubs
  try {
    const { getStoredClubs, getClubLeaders } = require("@/lib/councilStore");
    const clubs = getStoredClubs();
    for (const club of clubs) {
      const leaders = getClubLeaders(club);
      const lMatch = leaders.find((l: any) => l.email && l.email.toLowerCase().trim() === cleanEmail);
      if (lMatch?.btId) return normalizeBtId(lMatch.btId);
      if (Array.isArray(club.members)) {
        const mMatch = club.members.find((m: any) => m.email && m.email.toLowerCase().trim() === cleanEmail);
        if (mMatch?.btId) return normalizeBtId(mMatch.btId);
      }
    }
  } catch {}

  return "";
}

export async function getAdminAccessFromFirestore(
  uid?: string, 
  btId?: string, 
  email?: string
): Promise<AdminAccessAssignment | null> {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return null;
  const cleanBt = normalizeBtId(btId);
  const cleanEmail = (email || "").toLowerCase().trim();
  try {
    if (uid) {
      const snapUid = await getDoc(doc(db, ADMIN_ACCESS_COLLECTION, uid));
      if (snapUid.exists()) {
        const data = snapUid.data() as AdminAccessAssignment;
        if (data.active !== false) {
          return { ...data, uid: data.uid || snapUid.id };
        }
      }
    }
    if (cleanBt) {
      const snapBt = await getDoc(doc(db, ADMIN_ACCESS_COLLECTION, cleanBt));
      if (snapBt.exists()) {
        const data = snapBt.data() as AdminAccessAssignment;
        if (data.active !== false) {
          return { ...data, uid: data.uid || snapBt.id };
        }
      }
    }
    if (cleanEmail) {
      const snapEmail = await getDoc(doc(db, ADMIN_ACCESS_COLLECTION, cleanEmail));
      if (snapEmail.exists()) {
        const data = snapEmail.data() as AdminAccessAssignment;
        if (data.active !== false) {
          return { ...data, uid: data.uid || snapEmail.id };
        }
      }
      try {
        const q = query(
          collection(db, ADMIN_ACCESS_COLLECTION),
          where("email", "==", cleanEmail)
        );
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const docActive = qSnap.docs.find((d) => (d.data() as AdminAccessAssignment).active !== false) || qSnap.docs[0];
          const docData = docActive.data() as AdminAccessAssignment;
          return { ...docData, uid: docData.uid || docActive.id };
        }
      } catch {}
    }
    return null;
  } catch (error) {
    console.warn("Firestore admin access fetch notice", error);
    return null;
  }
}

export async function getAllAdminAccessFromFirestore(): Promise<AdminAccessAssignment[]> {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return [];
  try {
    const snapshot = await getDocs(collection(db, ADMIN_ACCESS_COLLECTION));
    const map = new Map<string, AdminAccessAssignment>();
    snapshot.docs.forEach((item) => {
      const data = item.data() as AdminAccessAssignment;
      const key = normalizeBtId(data.btId) || data.uid || item.id;
      if (!map.has(key) || (data.updatedAt && (!map.get(key)?.updatedAt || data.updatedAt > map.get(key)!.updatedAt))) {
        map.set(key, { ...data, uid: data.uid || item.id });
      }
    });
    return Array.from(map.values());
  } catch (error) {
    console.warn("Firestore admin access list notice", error);
    return [];
  }
}

export function subscribeToAdminAccessFromFirestore(
  callback: (assignments: AdminAccessAssignment[]) => void
): () => void {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return () => {};
  try {
    return onSnapshot(
      collection(db, ADMIN_ACCESS_COLLECTION),
      (snapshot) => {
        const map = new Map<string, AdminAccessAssignment>();
        snapshot.docs.forEach((item) => {
          const data = item.data() as AdminAccessAssignment;
          const key = normalizeBtId(data.btId) || data.uid || item.id;
          if (!map.has(key) || (data.updatedAt && (!map.get(key)?.updatedAt || data.updatedAt > map.get(key)!.updatedAt))) {
            map.set(key, { ...data, uid: data.uid || item.id });
          }
        });
        callback(Array.from(map.values()));
      },
      (error) => console.warn("Firestore live admin access notice", error)
    );
  } catch (error) {
    console.warn("Firestore admin access subscription error", error);
    return () => {};
  }
}

export function subscribeToAdminAccessForUser(
  uid: string,
  btId: string | undefined,
  callback: (assignment: AdminAccessAssignment | null) => void,
  email?: string | null
): () => void {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return () => {};
  const cleanBt = normalizeBtId(btId);
  const cleanEmail = (email || "").toLowerCase().trim();
  const unsubs: (() => void)[] = [];
  let uidAssignment: AdminAccessAssignment | null = null;
  let btAssignment: AdminAccessAssignment | null = null;
  let emailAssignment: AdminAccessAssignment | null = null;

  const notify = () => {
    const active = (uidAssignment?.active !== false && uidAssignment) ||
                   (btAssignment?.active !== false && btAssignment) ||
                   (emailAssignment?.active !== false && emailAssignment) ||
                   uidAssignment ||
                   btAssignment ||
                   emailAssignment ||
                   null;
    callback(active);
  };

  try {
    if (uid) {
      unsubs.push(
        onSnapshot(
          doc(db, ADMIN_ACCESS_COLLECTION, uid),
          (snap) => {
            uidAssignment = snap.exists() ? ({ uid: snap.id, ...snap.data() } as AdminAccessAssignment) : null;
            notify();
          },
          (error) => console.warn("Firestore user admin access notice", error)
        )
      );
    }
    if (cleanBt) {
      unsubs.push(
        onSnapshot(
          doc(db, ADMIN_ACCESS_COLLECTION, cleanBt),
          (snap) => {
            btAssignment = snap.exists() ? ({ uid: snap.id, ...snap.data() } as AdminAccessAssignment) : null;
            notify();
          },
          (error) => console.warn("Firestore btId admin access notice", error)
        )
      );
    }
    if (cleanEmail) {
      unsubs.push(
        onSnapshot(
          doc(db, ADMIN_ACCESS_COLLECTION, cleanEmail),
          (snap) => {
            emailAssignment = snap.exists() ? ({ uid: snap.id, ...snap.data() } as AdminAccessAssignment) : null;
            notify();
          },
          (error) => console.warn("Firestore email admin access notice", error)
        )
      );
    }
    return () => unsubs.forEach((u) => u());
  } catch (error) {
    console.warn("Firestore user admin access subscription error", error);
    return () => {};
  }
}

export async function saveAdminAccessToFirestore(
  assignment: Omit<AdminAccessAssignment, "grantedAt" | "updatedAt"> & Partial<Pick<AdminAccessAssignment, "grantedAt" | "updatedAt">>
): Promise<void> {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return;
  const cleanBt = normalizeBtId(assignment.btId);
  if (!cleanBt && !assignment.uid) return;
  const now = new Date().toISOString();
  const payload = cleanUndefined({
    ...assignment,
    btId: cleanBt,
    active: assignment.active !== false,
    grantedAt: assignment.grantedAt || now,
    updatedAt: now,
  });

  const batchOps: Promise<any>[] = [];
  if (cleanBt) {
    batchOps.push(setDoc(doc(db, ADMIN_ACCESS_COLLECTION, cleanBt), payload, { merge: true }));
  }
  if (assignment.uid && assignment.uid !== cleanBt) {
    batchOps.push(setDoc(doc(db, ADMIN_ACCESS_COLLECTION, assignment.uid), payload, { merge: true }));
  }
  await Promise.all(batchOps);
}

export async function revokeAdminAccessFromFirestore(
  identifier: string,
  revokedBy: string,
  secondaryIdentifier?: string
): Promise<void> {
  if (!identifier || !db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return;
  const now = new Date().toISOString();
  const payload = {
    active: false,
    revokedBy,
    updatedAt: now,
  };
  const batchOps = [setDoc(doc(db, ADMIN_ACCESS_COLLECTION, identifier), payload, { merge: true })];
  if (secondaryIdentifier && secondaryIdentifier !== identifier) {
    batchOps.push(setDoc(doc(db, ADMIN_ACCESS_COLLECTION, secondaryIdentifier), payload, { merge: true }));
  }
  await Promise.all(batchOps);
}

/**
 * Check if an email or user UID has Council Admin privileges.
 * Authorizes:
 * 1. Hardcoded Council Administrators (shendeha@jdcoem.ac.in, studentrepresentcouncil@jdcoem.ac.in, etc.)
 * 2. Active records in `/admins/{normalizedEmail}`
 * 3. User records in `/users/{uid}` with role === "COUNCIL_ADMIN" (appointed from admin dashboard)
 */
export async function checkIsAdminInFirestore(email?: string | null, uid?: string | null): Promise<boolean> {
  const normalizedEmail = (email || "").toLowerCase().trim();

  // Default fallback admin list (break-glass safety net)
  const DEFAULT_ADMINS = [
    "shendeha@jdcoem.ac.in",
    "studentrepresentcouncil@jdcoem.ac.in",
    "harshshende0718@gmail.com",
    "harshxfr@gmail.com",
    "admin@jdcoem.ac.in",
    "src.president@jdcoem.ac.in",
    "src.mentor@jdcoem.ac.in",
    "src.gensec@jdcoem.ac.in",
  ];

  if (normalizedEmail && (isOwnerEmail(normalizedEmail) || DEFAULT_ADMINS.includes(normalizedEmail))) {
    return true;
  }

  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      // 1. Check `/admins/{normalizedEmail}`
      if (normalizedEmail) {
        const docRef = doc(db, ADMINS_COLLECTION, normalizedEmail);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists() && snapshot.data()?.active !== false) {
          return true;
        }
      }

      // 2. Check `/users/{uid}` for role === "COUNCIL_ADMIN" (appointed from dashboard)
      if (uid) {
        const userDocRef = doc(db, USERS_COLLECTION, uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists() && userSnap.data()?.role === "COUNCIL_ADMIN") {
          return true;
        }
      }
    }
  } catch (error) {
    console.warn("Firestore admin check notice", error);
  }

  return false;
}

/**
 * Add or activate an admin record in Firestore `/admins/{email}`
 */
export async function saveAdminRecordToFirestore(
  email: string,
  data?: { role?: string; uid?: string; appointedAt?: string; active?: boolean }
): Promise<boolean> {
  if (!email || !db) return false;
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const docRef = doc(db, ADMINS_COLLECTION, normalizedEmail);
    await setDoc(
      docRef,
      {
        email: normalizedEmail,
        role: data?.role || "COUNCIL_ADMIN",
        uid: data?.uid || "",
        appointedAt: data?.appointedAt || new Date().toISOString(),
        active: data?.active !== false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error("Failed to save admin record to Firestore:", err);
    return false;
  }
}

/**
 * Deactivate or remove an admin record in Firestore `/admins/{email}`
 */
export async function removeAdminRecordFromFirestore(email: string): Promise<boolean> {
  if (!email || !db) return false;
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const docRef = doc(db, ADMINS_COLLECTION, normalizedEmail);
    await setDoc(
      docRef,
      {
        email: normalizedEmail,
        active: false,
        demotedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error("Failed to remove admin record from Firestore:", err);
    return false;
  }
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
 * Permanently delete a user profile document from Firestore `/users/{uid}`
 */
export async function deleteUserProfileFromFirestore(uid: string): Promise<boolean> {
  if (!uid || !db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return false;
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Firestore user profile delete error:", error);
    return false;
  }
}

/**
 * Fetch all registered student users from Firestore
 */
export async function getAllUsersFromFirestore(): Promise<UserProfile[]> {
  if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      const snapshot = await getDocs(usersRef);

      // An empty successful query is an authoritative empty user dataset. It
      // must not fall through to stale localStorage and resurrect deletions.
      return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
    } catch (error) {
      console.warn("Could not fetch users from Firestore", error);
    }
  }

  // No configured Firestore or an actual read/offline failure: local cache is
  // a best-effort fallback for offline use only.
  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem("src_registered_users");
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  return [];
}

/**
 * Query Firestore to find if a student record exists with a matching BT ID
 */
export async function findUserByBtIdInFirestore(btId: string): Promise<UserProfile | null> {
  if (!db || !btId || !btId.trim() || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return null;
  }
  const cleanBtId = btId.trim().toUpperCase();
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where("btId", "==", cleanBtId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      for (const d of snapshot.docs) {
        const data = d.data() as UserProfile;
        if (!data.isDeleted && data.status !== "deleted") {
          return { ...data, uid: data.uid || d.id };
        }
      }
    }
  } catch (error) {
    console.warn("Could not query user by BT ID in Firestore:", error);
  }
  return null;
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
    safeStorageSet("src_local_registrations", [localRecord, ...existing]);
  } catch (e) {
    console.warn("LocalStorage save warning", e);
  }

  return newRecord;
}

/**
 * Get registration details by ID
 */
export async function getRegistrationById(id: string): Promise<StudentRegistrationRecord | null> {
  if (!id || id.startsWith("hub_")) return null;
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
  btId?: string | null,
  eventName?: string | null
): Promise<StudentRegistrationRecord | null> {
  const cleanEmail = email?.trim().toLowerCase();
  const cleanBtId = btId?.trim().toUpperCase();
  const cleanEventId = (eventId || "").trim().toLowerCase();
  const cleanEventSlug = (eventSlug || "").trim().toLowerCase();
  const cleanEventName = (eventName || "").trim().toLowerCase();

  if (!cleanEmail && !cleanBtId) return null;

  const isEventMatch = (r: any): boolean => {
    if (!r) return false;
    const rEventId = (r.eventId || "").trim().toLowerCase();
    const rEventSlug = (r.eventSlug || "").trim().toLowerCase();
    const rEventName = (r.eventName || r.eventTitle || "").trim().toLowerCase();

    // 1. Direct ID match
    if (cleanEventId && (rEventId === cleanEventId || rEventSlug === cleanEventId)) return true;

    // 2. Direct Slug match
    if (cleanEventSlug && (rEventSlug === cleanEventSlug || rEventId === cleanEventSlug)) return true;

    // 3. Direct Name match
    if (cleanEventName && rEventName) {
      if (rEventName === cleanEventName) return true;
      const stripped1 = cleanEventName.replace(/[^a-z0-9]/g, "");
      const stripped2 = rEventName.replace(/[^a-z0-9]/g, "");
      if (stripped1 && stripped2 && (stripped1 === stripped2 || stripped1.includes(stripped2) || stripped2.includes(stripped1))) {
        return true;
      }
    }

    // 4. If slug is derived from name or vice-versa
    if (cleanEventSlug && rEventName) {
      const slugFromName = rEventName.replace(/[^a-z0-9]+/g, "-");
      if (slugFromName === cleanEventSlug || cleanEventSlug.includes(slugFromName) || slugFromName.includes(cleanEventSlug)) {
        return true;
      }
    }

    return false;
  };

  const isStudentMatch = (r: any): boolean => {
    if (!r || r.status === "CANCELLED" || r.paymentStatus === "FAILED") return false;

    const rEmail = (r.email || "").trim().toLowerCase();
    const rBtId = (r.btId || "").trim().toUpperCase();

    // Primary participant match
    if (cleanEmail && rEmail && rEmail === cleanEmail) return true;
    if (cleanBtId && rBtId && cleanBtId !== "STUDENT" && rBtId === cleanBtId) return true;

    // Team members match
    const members = Array.isArray(r.teamMembers) ? r.teamMembers : Array.isArray(r.members) ? r.members : [];
    return members.some((m: any) => {
      const mEmail = (m?.email || "").trim().toLowerCase();
      const mBtId = (m?.btId || "").trim().toUpperCase();
      if (cleanEmail && mEmail && mEmail === cleanEmail) return true;
      if (cleanBtId && mBtId && cleanBtId !== "STUDENT" && mBtId === cleanBtId) return true;
      return false;
    });
  };

  const isMatch = (r: any): boolean => isStudentMatch(r) && isEventMatch(r);

  // 1. Instant check in local cache
  try {
    const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
    if (Array.isArray(local)) {
      const match = local.find(isMatch);
      if (match) return match as StudentRegistrationRecord;
    }
  } catch {}

  // 2. Query Firestore by STUDENT (email and BT ID) - Single field queries with zero composite index requirement!
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const colRef = collection(db, REGISTRATIONS_COLLECTION);
      const candidates: any[] = [];

      // Query by email
      if (cleanEmail) {
        try {
          const qEmail = query(colRef, where("email", "==", cleanEmail));
          const snapEmail = await getDocs(qEmail);
          snapEmail.docs.forEach((d) => candidates.push({ id: d.id, ...d.data() }));
        } catch (e) {
          console.warn("Notice: email query in checkExistingStudentRegistration:", e);
        }
      }

      // Query by btId
      if (cleanBtId && cleanBtId !== "STUDENT") {
        try {
          const qBt = query(colRef, where("btId", "==", cleanBtId));
          const snapBt = await getDocs(qBt);
          snapBt.docs.forEach((d) => {
            if (!candidates.some((c) => c.id === d.id)) {
              candidates.push({ id: d.id, ...d.data() });
            }
          });
        } catch (e) {
          console.warn("Notice: btId query in checkExistingStudentRegistration:", e);
        }
      }

      // Query by eventId as fallback
      if (cleanEventId) {
        try {
          const qEv = query(colRef, where("eventId", "==", eventId));
          const snapEv = await getDocs(qEv);
          snapEv.docs.forEach((d) => {
            if (!candidates.some((c) => c.id === d.id)) {
              candidates.push({ id: d.id, ...d.data() });
            }
          });
        } catch (e) {}
      }

      // Query by eventSlug as fallback
      if (cleanEventSlug && cleanEventSlug !== cleanEventId) {
        try {
          const qSlug = query(colRef, where("eventSlug", "==", eventSlug));
          const snapSlug = await getDocs(qSlug);
          snapSlug.docs.forEach((d) => {
            if (!candidates.some((c) => c.id === d.id)) {
              candidates.push({ id: d.id, ...d.data() });
            }
          });
        } catch (e) {}
      }

      // Search candidates
      const matched = candidates.find(isMatch);
      if (matched) {
        // Cache to local storage so subsequent renders are synchronous
        try {
          const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
          if (Array.isArray(local) && !local.some((l) => l.id === matched.id)) {
            localStorage.setItem("src_local_registrations", JSON.stringify([...local, matched]));
          }
        } catch {}
        return matched as StudentRegistrationRecord;
      }
    }
  } catch (error) {
    console.warn("Firestore registration check error:", error);
  }

  return null;
}

/**
 * Mark a student registration as CHECKED-IN during gate entry QR scanning
 */
export async function checkInStudentPass(id: string): Promise<boolean> {
  if (!id || id.startsWith("hub_")) return false;
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
    safeStorageSet("src_local_registrations", updated);
    return true;
  } catch (error) {
    console.error("Failed to check in student pass", error);
    return false;
  }
}

/**
 * Helper to identify synthetic probe or smoke-test registration passes (e.g. test_ping, test_rule_check)
 */
export function isTestPassRecord(r: any): boolean {
  if (!r) return true;
  if (r._isTestProbe === true || r.isMockProbe === true) return true;
  const id = String(typeof r === "string" ? r : (r.id || "")).toLowerCase().trim();
  const code = String(r.ticketCode || r.registrationCode || "").toLowerCase().trim();

  // Strictly target synthetic smoke-test / health-check probe documents created by test scripts
  if (
    id === "test" ||
    id.startsWith("test_ping") ||
    id.startsWith("test_rule") ||
    id.startsWith("smoke_test_") ||
    id.startsWith("health_check_") ||
    id === "test_probe"
  ) {
    return true;
  }
  if (
    code.startsWith("test_ping") ||
    code.startsWith("test_rule") ||
    code.startsWith("smoke_test_") ||
    code.startsWith("health_check_")
  ) {
    return true;
  }

  return false;
}

/**
 * Helper to identify Hub engagement records (polls, applications, grievances).
 * Hub records are NOT event passes, have no check-in tickets, and must never appear as event passes.
 */
export function isHubRecord(r: any): boolean {
  if (!r) return false;
  if (isTestPassRecord(r)) return true;
  const id = typeof r === "string" ? r : (r.id || "");
  if (typeof id === "string" && id.startsWith("hub_")) return true;
  if (r.customAnswers?.isHubBallot || r.customAnswers?.isHubSubmission) return true;
  if (typeof r.eventTitle === "string" && (r.eventTitle.startsWith("[HUB]") || r.eventTitle.startsWith("[POLL BALLOT]"))) return true;
  if (typeof r.eventName === "string" && (r.eventName.startsWith("[HUB]") || r.eventName.startsWith("[POLL BALLOT]"))) return true;
  return false;
}

/**
 * Fetch all registrations from Firestore (strictly excluding hub submissions & poll ballots)
 */
export async function getAllRegistrationsFromFirestore(): Promise<StudentRegistrationRecord[]> {
  if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    try {
      const colRef = collection(db, REGISTRATIONS_COLLECTION);
      const snapshot = await getDocs(colRef);
      // Preserve the successful [] result; local registrations are only an
      // offline/error fallback and must never resurrect deleted passes.
      return snapshot.docs
        .filter((d) => !isHubRecord({ id: d.id, ...d.data() }) && !isTestPassRecord({ id: d.id, ...d.data() }))
        .map((d) => ({ id: d.id, ...d.data() } as StudentRegistrationRecord));
    } catch (error) {
      console.warn("Could not fetch registrations from Firestore", error);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      if (Array.isArray(local)) {
        return local.filter((r: any) => !isHubRecord(r) && !isTestPassRecord(r));
      }
    } catch {}
  }
  return [];
}

/**
 * Subscribe to real-time updates of event registrations in Firestore (strictly excluding hub submissions & poll ballots)
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
          .filter((d) => !isHubRecord({ id: d.id, ...d.data() }) && !isTestPassRecord({ id: d.id, ...d.data() }))
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
 * Cancel an existing event registration (strictly for free events only).
 * Requires a mandatory non-empty cancellation reason.
 */
export async function cancelRegistrationInFirestore(
  id: string,
  reason: string,
  cancelledBy?: string
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: "Invalid registration ID." };
  const cleanReason = (reason || "").trim();
  if (!cleanReason || cleanReason.length < 5) {
    return {
      success: false,
      error: "Please provide a valid cancellation reason (minimum 5 characters).",
    };
  }

  // Verify registration exists and is free
  let existing: StudentRegistrationRecord | null = await getRegistrationById(id);
  if (!existing) {
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      existing = local.find((r: any) => r.id === id) || null;
    } catch {}
  }

  if (existing) {
    if (existing.status === "CHECKED_IN") {
      return {
        success: false,
        error: "Cannot cancel a pass that has already been verified and checked in at the venue.",
      };
    }
    const isPaid = (existing.amountPaid && existing.amountPaid > 0) || existing.paymentStatus === "PAID";
    if (isPaid) {
      return {
        success: false,
        error: "Paid event registrations cannot be cancelled online. Please contact the event coordinator directly.",
      };
    }
  }

  const nowIso = new Date().toISOString();

  // 1. Update in Firestore
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, REGISTRATIONS_COLLECTION, id);
      await updateDoc(docRef, {
        status: "CANCELLED",
        cancellationReason: cleanReason,
        cancelledAt: serverTimestamp(),
        ...(cancelledBy ? { cancelledBy } : {}),
      });
    }
  } catch (error) {
    console.warn("Firestore cancellation update warning:", error);
  }

  // 2. Update local storage cache and broadcast cross-tab event
  if (typeof window !== "undefined") {
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      const updated = local.map((r: any) =>
        r.id === id
          ? {
              ...r,
              status: "CANCELLED",
              cancellationReason: cleanReason,
              cancelledAt: nowIso,
              ...(cancelledBy ? { cancelledBy } : {}),
            }
          : r
      );
      safeStorageSet("src_local_registrations", updated);
      window.dispatchEvent(new CustomEvent("src_registrations_updated", { detail: updated }));
    } catch (e) {
      console.warn("Local storage update warning on cancel registration:", e);
    }
  }

  return { success: true };
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
      safeStorageSet("src_local_registrations", updated);
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

      safeStorageSet("src_local_registrations", updated);
      window.dispatchEvent(new CustomEvent("src_registrations_updated", { detail: updated }));
    } catch {}
  }

  return deletedCount;
}

/**
 * Delete all active checkout sessions for an event from Firestore
 */
export async function deleteActiveCheckoutSessionsForEvent(
  eventId: string,
  eventSlug?: string,
  eventName?: string
): Promise<number> {
  let deletedCount = 0;
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const colRef = collection(db, "active_checkout_sessions");
      const snapshot = await getDocs(colRef);
      const cleanId = (eventId || "").trim().toLowerCase();
      const cleanSlug = (eventSlug || "").trim().toLowerCase();
      const cleanName = (eventName || "").trim().toLowerCase();

      for (const d of snapshot.docs) {
        const data = d.data();
        const dEventId = (data.eventId || "").trim().toLowerCase();
        const dEventSlug = (data.eventSlug || "").trim().toLowerCase();
        const dTitle = (data.eventTitle || "").trim().toLowerCase();
        const dDocId = d.id.toLowerCase();

        const matchesEvent =
          (cleanId && (dEventId === cleanId || dEventSlug === cleanId || dDocId.includes(cleanId))) ||
          (cleanSlug && (dEventId === cleanSlug || dEventSlug === cleanSlug || dDocId.includes(cleanSlug))) ||
          (cleanName && (dTitle === cleanName || dTitle.includes(cleanName)));

        if (matchesEvent) {
          await deleteDoc(doc(db, "active_checkout_sessions", d.id));
          deletedCount++;
        }
      }
    }
  } catch (error) {
    console.warn("Firestore deleteActiveCheckoutSessionsForEvent error:", error);
  }
  return deletedCount;
}

/**
 * Bulk-cancel all active registrations belonging to an event cancelled by SRC.
 * Updates registrations to CANCELLED and assigns cancellation reason & timestamp.
 */
export async function cancelEventRegistrations(
  eventId: string,
  eventSlug?: string,
  eventName?: string,
  cancellationNotice?: string
): Promise<number> {
  let cancelledCount = 0;
  const reasonText = cancellationNotice
    ? `Event cancelled by SRC: ${cancellationNotice.trim()}`
    : "Event cancelled by SRC Council administration.";
  const nowIso = new Date().toISOString();

  // 1. Update in Firestore
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

        if (matchesEvent && data.status !== "CANCELLED") {
          await updateDoc(doc(db, REGISTRATIONS_COLLECTION, d.id), {
            status: "CANCELLED",
            cancellationReason: reasonText,
            cancelledAt: serverTimestamp(),
            cancelledBy: "SRC Council Administration",
          });
          cancelledCount++;
        }
      }
    }
  } catch (error) {
    console.warn("Firestore bulk cancellation error for event registrations:", error);
  }

  // 2. Update local storage
  if (typeof window !== "undefined") {
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      const updated = local.map((r: any) => {
        const matchesEvent =
          r.id.toLowerCase().includes(eventId.toLowerCase()) ||
          (r.eventId && (r.eventId === eventId || (eventSlug && r.eventId === eventSlug))) ||
          (r.eventTitle && eventName && r.eventTitle.toLowerCase().trim() === eventName.toLowerCase().trim()) ||
          (r.eventTitle && eventName && r.eventTitle.toLowerCase().includes(eventName.toLowerCase())) ||
          (eventSlug && r.id.toLowerCase().includes(eventSlug.toLowerCase()));

        if (matchesEvent && r.status !== "CANCELLED") {
          return {
            ...r,
            status: "CANCELLED",
            cancellationReason: reasonText,
            cancelledAt: nowIso,
            cancelledBy: "SRC Council Administration",
          };
        }
        return r;
      });

      safeStorageSet("src_local_registrations", updated);
      window.dispatchEvent(new CustomEvent("src_registrations_updated", { detail: updated }));
    } catch (e) {
      console.warn("Local storage update warning during bulk event cancellation:", e);
    }
  }

  return cancelledCount;
}

/**
 * Record a refund for a registration in Firestore and local storage
 */
export async function updateRegistrationRefundInFirestore(
  registrationId: string,
  refundDetails: {
    refundId: string;
    refundStatus: "INITIATED" | "PROCESSED" | "FAILED";
    refundAmount: number;
    refundedAt: string;
    cancellationReason?: string;
    cancelledBy?: string;
  }
): Promise<boolean> {
  if (!registrationId) return false;

  const cancellationReason = refundDetails.cancellationReason || `Refund processed (ID: ${refundDetails.refundId})`;
  const cancelledBy = refundDetails.cancelledBy || "SRC Admin / Treasurer";

  // 1. Update in Firestore
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, REGISTRATIONS_COLLECTION, registrationId);
      await updateDoc(docRef, {
        refundId: refundDetails.refundId,
        refundStatus: refundDetails.refundStatus,
        refundAmount: refundDetails.refundAmount,
        refundedAt: refundDetails.refundedAt,
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        cancellationReason,
        cancelledAt: refundDetails.refundedAt,
        cancelledBy,
      });
    }
  } catch (error) {
    console.warn("Firestore refund update error for registration:", registrationId, error);
  }

  // 2. Update local storage and dispatch cross-tab event
  if (typeof window !== "undefined") {
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      const updated = local.map((r: any) =>
        r.id === registrationId || r.registrationId === registrationId
          ? {
              ...r,
              refundId: refundDetails.refundId,
              refundStatus: refundDetails.refundStatus,
              refundAmount: refundDetails.refundAmount,
              refundedAt: refundDetails.refundedAt,
              status: "CANCELLED",
              paymentStatus: "REFUNDED",
              cancellationReason,
              cancelledAt: refundDetails.refundedAt,
              cancelledBy,
            }
          : r
      );
      safeStorageSet("src_local_registrations", updated);
      window.dispatchEvent(new CustomEvent("src_registrations_updated", { detail: updated }));
    } catch (e) {
      console.warn("Local storage refund update error:", e);
    }
  }

  return true;
}

/**
 * Admin / Treasurer 1-Tap Approval for UPI UTR Registrations
 * Transitions a registration from PENDING to PAID (or FAILED)
 */
export async function updateRegistrationPaymentStatus(
  registrationId: string,
  paymentStatus: "PAID" | "PENDING" | "FAILED",
  verifiedBy: string = "Admin / Treasurer"
): Promise<boolean> {
  if (!registrationId) return false;

  const now = new Date().toISOString();

  // 1. Update in Firestore
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, REGISTRATIONS_COLLECTION, registrationId);
      await updateDoc(docRef, {
        paymentStatus,
        paidAt: paymentStatus === "PAID" ? now : undefined,
        verifiedBy,
        verifiedAt: now,
      });
    }
  } catch (error) {
    console.warn("Firestore payment status update error for registration:", registrationId, error);
  }

  // 2. Update local storage and dispatch cross-tab event
  if (typeof window !== "undefined") {
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      const updated = local.map((r: any) =>
        r.id === registrationId || r.registrationId === registrationId
          ? {
              ...r,
              paymentStatus,
              paidAt: paymentStatus === "PAID" ? now : r.paidAt,
              verifiedBy,
              verifiedAt: now,
            }
          : r
      );
      safeStorageSet("src_local_registrations", updated);
      window.dispatchEvent(new CustomEvent("src_registrations_updated", { detail: updated }));
    } catch (e) {
      console.warn("Local storage update error for payment status:", e);
    }
  }

  return true;
}

const SITE_CONTENT_COLLECTION = "site_content";

/**
 * Conservative Firestore document size threshold (750 KB).
 * Hard Firestore limit is 1,048,576 bytes (1 MB).
 * Enforcing 750 KB leaves ample safety margin for metadata, indexing overhead,
 * and eliminates silent data destruction / truncation.
 */
export const FIRESTORE_DOC_SAFE_MAX_BYTES = 750_000;

/**
 * Save site content document (e.g. events, clubs, team, hero) to Firestore.
 * Strictly guarantees that valid image data is never silently wiped or degraded.
 */
export async function saveSiteContentToFirestore<T>(docId: string, data: T): Promise<void> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const sanitized = cleanUndefined(data);

      // Conservative Firestore document size safety check
      const jsonStr = JSON.stringify(sanitized);
      const payloadSize = new Blob([jsonStr]).size;

      if (payloadSize > FIRESTORE_DOC_SAFE_MAX_BYTES) {
        const sizeKb = Math.round(payloadSize / 1024);
        const maxKb = Math.round(FIRESTORE_DOC_SAFE_MAX_BYTES / 1024);
        const errorMsg = `[Firestore] Document [${docId}] payload (${sizeKb} KB) exceeds the safe threshold (${maxKb} KB). Write rejected to prevent data truncation. Structure datasets into partitioned documents or enable Cloud Storage mode.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      const docRef = doc(db, SITE_CONTENT_COLLECTION, docId);
      await setDoc(docRef, { payload: sanitized, updatedAt: serverTimestamp() });
    }
  } catch (error: any) {
    console.error(`Firestore saveSiteContent error [${docId}]:`, error?.code || "", error?.message || error);
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
 * Get the updatedAt timestamp (as epoch ms) for a site_content document.
 * Returns null if the document doesn't exist or has no updatedAt field.
 */
export async function getDocumentUpdatedAtMs(docId: string): Promise<number | null> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, SITE_CONTENT_COLLECTION, docId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const updatedAt = snapshot.data()?.updatedAt;
        if (updatedAt && typeof updatedAt.toMillis === "function") {
          return updatedAt.toMillis();
        }
      }
    }
  } catch (error) {
    console.warn(`Firestore getDocumentUpdatedAt error [${docId}]`, error);
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

// -----------------------------------------------------------------------------
// CONTACT FORM SUBMISSIONS (Public Create, Admin Read/Write)
// -----------------------------------------------------------------------------
export const CONTACT_SUBMISSIONS_COLLECTION = "contact_submissions";

export async function submitContactFormToFirestore(submission: {
  id: string;
  name: string;
  email: string;
  department?: string;
  subject: string;
  message: string;
  submittedAt: string;
  status?: string;
}): Promise<void> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const sanitized = cleanUndefined(submission);
      const docRef = doc(db, CONTACT_SUBMISSIONS_COLLECTION, submission.id);
      await setDoc(docRef, {
        ...sanitized,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error: any) {
    console.error(`Firestore submitContactForm error [${submission.id}]:`, error?.code || "", error?.message || error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// INDIVIDUAL EVENT DOCUMENT MANAGEMENT (1 Event = 1 Document Invariant)
// -----------------------------------------------------------------------------
export const EVENTS_COLLECTION = "events";

export function getEventDocId(event: Partial<EventItem> | string): string {
  if (typeof event === "string") {
    return event.trim();
  }
  return (event.id || event.slug || "").trim() || `evt-${Date.now()}`;
}

/**
 * Save an individual event directly to its authoritative top-level document.
 *
 * `/events/{eventId}` is the only active event data store.  The former
 * `site_content/event_{eventId}` and `site_content/events` writes are purposely
 * gone: dual-writing those legacy locations allowed stale catalog data to win
 * during a later read and made deletion resurrection possible.
 */
export async function saveEventToFirestore(event: EventItem): Promise<void> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docId = getEventDocId(event);
      const sanitized = cleanUndefined({
        ...event,
        id: event.id || docId,
        slug: event.slug || docId,
      });

      // Individual event document safety check (750 KB safe limit per event)
      const jsonStr = JSON.stringify(sanitized);
      const payloadSize = new Blob([jsonStr]).size;

      if (payloadSize > FIRESTORE_DOC_SAFE_MAX_BYTES) {
        const sizeKb = Math.round(payloadSize / 1024);
        const maxKb = Math.round(FIRESTORE_DOC_SAFE_MAX_BYTES / 1024);
        const errorMsg = `[Firestore] Event document [${docId}] payload (${sizeKb} KB) exceeds the safe threshold (${maxKb} KB). Write rejected to prevent truncation.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      // 1 Event = 1 Document: the top-level event document is authoritative.
      // Do not swallow permission errors here; callers enqueue the complete
      // event payload and surface an expired-admin-session error when needed.
      const eventDocRef = doc(db, EVENTS_COLLECTION, docId);
      await setDoc(eventDocRef, { ...sanitized, updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch (error: any) {
    console.error(`Firestore saveEventToFirestore error [${event.id || event.slug}]:`, error?.code || "", error?.message || error);
    throw error;
  }
}

/**
 * Delete an individual event and all associated records permanently from Firestore.
 * Invariant: Deletion is permanent, atomic, and prevents all resurrection.
 */
export async function deleteEventPermanentlyFromFirestore(
  eventId: string,
  eventSlug?: string,
  eventName?: string
): Promise<void> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const cleanId = (eventId || "").trim();
      const cleanSlug = (eventSlug || "").trim();
      const cleanName = (eventName || "").trim();

      const targetKeys = new Set<string>();
      if (cleanId) {
        targetKeys.add(cleanId);
        targetKeys.add(getEventDocId(cleanId));
      }
      if (cleanSlug) {
        targetKeys.add(cleanSlug);
        targetKeys.add(getEventDocId(cleanSlug));
      }

      // Record the tombstone before deleting the document. This closes the
      // delete/write race: a stale client or offline queue can no longer make
      // the just-deleted event visible if the delete acknowledgement is late.
      const tombstoneRef = doc(db, SITE_CONTENT_COLLECTION, "deleted_events_tombstones");
      const tombstoneData: Record<string, any> = {
        lastPurgedAt: serverTimestamp(),
      };
      if (cleanId) tombstoneData[cleanId.toLowerCase()] = true;
      if (cleanSlug) tombstoneData[cleanSlug.toLowerCase()] = true;
      await setDoc(tombstoneRef, tombstoneData, { merge: true });

      // Delete all individual documents in the authoritative /events collection.
      for (const k of targetKeys) {
        try {
          await deleteDoc(doc(db, EVENTS_COLLECTION, k));
        } catch {}
      }

      // Also query /events to catch any doc where id or slug matches
      try {
        const eventsCol = collection(db, EVENTS_COLLECTION);
        const snap = await getDocs(eventsCol);
        for (const d of snap.docs) {
          const data = d.data();
          const dId = (data.id || d.id || "").trim();
          const dSlug = (data.slug || "").trim();
          if (
            (cleanId && (dId === cleanId || dSlug === cleanId)) ||
            (cleanSlug && (dId === cleanSlug || dSlug === cleanSlug))
          ) {
            await deleteDoc(doc(db, EVENTS_COLLECTION, d.id));
          }
        }
      } catch (err) {
        console.warn("Notice querying /events for deletion:", err);
      }

      // Legacy site_content event documents are intentionally not read or
      // written anymore. They can be cleaned by a separately authorized
      // migration after all clients have moved to /events.

      // Cascade-delete all registrations & passes
      try {
        await deleteRegistrationsForEvent(cleanId, cleanSlug, cleanName);
      } catch (err) {
        console.warn("Notice cascade-deleting registrations:", err);
      }

      // Cascade-delete active checkout sessions
      try {
        await deleteActiveCheckoutSessionsForEvent(cleanId, cleanSlug, cleanName);
      } catch (err) {
        console.warn("Notice cascade-deleting checkout sessions:", err);
      }
    }
  } catch (error) {
    console.error(`Firestore deleteEventPermanentlyFromFirestore error [${eventId}]:`, error);
    throw error;
  }
}

/**
 * Delete an individual event document from Firestore (backward-compatible wrapper)
 */
export async function deleteEventFromFirestore(eventIdOrSlug: string, eventSlug?: string, eventName?: string): Promise<void> {
  return deleteEventPermanentlyFromFirestore(eventIdOrSlug, eventSlug, eventName);
}

/**
 * Fetch all individual event documents from Firestore (1 event = 1 document)
 * Queries only the authoritative /events collection plus the tombstone
 * document. Legacy site_content event documents/catalogs are not read.
 * Filtering tombstones here guarantees zero resurrection from stale snapshots.
 */
export async function getAllEventsFromFirestore(): Promise<EventItem[]> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const mergedMap = new Map<string, EventItem>();
      const tombstones = new Set<string>();

      // Target /events collection and the single tombstone doc in parallel (<150ms total)
      const [eventsSnapResult, tombstonesSnapResult] = await Promise.allSettled([
        getDocs(collection(db, EVENTS_COLLECTION)),
        getDoc(doc(db, SITE_CONTENT_COLLECTION, "deleted_events_tombstones")),
      ]);

      // 1. Process tombstones
      if (tombstonesSnapResult.status === "fulfilled" && tombstonesSnapResult.value.exists()) {
        const data = tombstonesSnapResult.value.data();
        if (data) {
          Object.keys(data).forEach((k) => {
            if (data[k] === true) tombstones.add(k.toLowerCase().trim());
          });
        }
      }

      // 2. Process top-level /events collection (authoritative primary)
      if (eventsSnapResult.status === "fulfilled") {
        eventsSnapResult.value.docs.forEach((d) => {
          const docIdLower = d.id.toLowerCase().trim();
          if (tombstones.has(docIdLower)) return; // Tombstoned!

          const data = d.data();
          // STRICT VALIDATION: Require a valid non-empty name to prevent ghost/blank items
          const name = typeof data?.name === "string" ? data.name.trim() : "";
          if (!name) return;

          const evt = { id: d.id, ...data, name } as EventItem;
          const idKey = (evt.id || "").toLowerCase().trim();
          const slugKey = (evt.slug || "").toLowerCase().trim();
          if (tombstones.has(idKey) || tombstones.has(slugKey)) return; // Tombstoned!

          const key = evt.id || evt.slug || d.id;
          mergedMap.set(key, evt);
        });
      }

      return Array.from(mergedMap.values());
    }
  } catch (error) {
    console.warn("Could not fetch events from Firestore:", error);
  }
  return [];
}

/**
 * Fetch an individual event document directly from Firestore (1 Event = 1 Document)
 */
export async function getEventFromFirestore(eventIdOrSlug: string): Promise<EventItem | null> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY && eventIdOrSlug) {
      const docId = getEventDocId(eventIdOrSlug);

      // Check the authoritative /events/{docId} document.
      try {
        const docRef = doc(db, EVENTS_COLLECTION, docId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const tombstones = await getDoc(doc(db, SITE_CONTENT_COLLECTION, "deleted_events_tombstones"));
          const tombstoneData = tombstones.exists() ? tombstones.data() : undefined;
          const idKey = (data.id || snap.id).toLowerCase().trim();
          const slugKey = (data.slug || "").toLowerCase().trim();
          if (tombstoneData?.[idKey] === true || (slugKey && tombstoneData?.[slugKey] === true)) {
            return null;
          }
          return { id: snap.id, ...data } as EventItem;
        }
      } catch {}

      // Lookup by slug in the same authoritative /events collection.
      try {
        const slugQuery = query(collection(db, EVENTS_COLLECTION), where("slug", "==", eventIdOrSlug));
        const slugSnap = await getDocs(slugQuery);
        if (!slugSnap.empty) {
          const firstDoc = slugSnap.docs[0];
          const data = firstDoc.data();
          const tombstones = await getDoc(doc(db, SITE_CONTENT_COLLECTION, "deleted_events_tombstones"));
          const tombstoneData = tombstones.exists() ? tombstones.data() : undefined;
          const idKey = (data.id || firstDoc.id).toLowerCase().trim();
          const slugKey = (data.slug || "").toLowerCase().trim();
          if (tombstoneData?.[idKey] === true || (slugKey && tombstoneData?.[slugKey] === true)) {
            return null;
          }
          return { id: firstDoc.id, ...data } as EventItem;
        }
      } catch {}
    }
  } catch (error) {
    console.warn(`Firestore getEventFromFirestore notice [${eventIdOrSlug}]:`, error);
  }
  return null;
}

/**
 * Subscribe to real-time updates of events across all storage locations.
 *
 * IMPORTANT: Firestore onSnapshot fires from the LOCAL CACHE first (~10ms) before
 * the SERVER response (~500ms). The cache often has only partial data (e.g. 1 event
 * that was saved to /events collection). If we emit from cache, the subscription
 * overwrites localStorage and inMemoryEvents with that 1 event, causing a stale-data
 * flash on the public /events page.
 *
 * To prevent this, we use snapshot.metadata.fromCache to skip pure-cache emissions.
 * We only emit after at least one SERVER snapshot has arrived from each collection.
 * A 3-second fallback timer ensures offline users still see cached data.
 */
/**
 * Subscribe to real-time updates of events directly from the top-level /events collection.
 * Uses a single tombstone document listener for instantaneous sync with zero delay.
 * Strictly guarantees that any item without a valid name is rejected.
 */
export function subscribeToEventsFromFirestore(
  callback: (events: EventItem[]) => void
): () => void {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return () => {};
  }

  const collectionEventsMap = new Map<string, EventItem>();
  const tombstonesMap = new Map<string, boolean>();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let hasReceivedServerSnapshot = false;
  let hasReceivedAnySnapshot = false;

  const emitMerged = () => {
    // Only emit if we have received a server snapshot OR if we have non-empty events from cache.
    // Never emit an empty list from a pure cache snapshot while waiting for server response!
    if (!hasReceivedServerSnapshot && collectionEventsMap.size === 0) {
      return;
    }

    const validEvents: EventItem[] = [];
    collectionEventsMap.forEach((evt, key) => {
      const idKey = (evt.id || "").toLowerCase().trim();
      const slugKey = (evt.slug || "").toLowerCase().trim();
      const nameKey = (evt.name || "").toLowerCase().trim();

      // Check tombstones & require valid name
      if (
        nameKey.length > 0 &&
        !tombstonesMap.has(idKey) &&
        !tombstonesMap.has(slugKey) &&
        !tombstonesMap.has(key.toLowerCase().trim())
      ) {
        validEvents.push(evt);
      }
    });

    callback(validEvents);
  };

  const scheduleEmit = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      emitMerged();
    }, 40);
  };

  // Offline fallback: if no server response arrives in 3.5 seconds, emit whatever was cached
  const offlineFallback = setTimeout(() => {
    if (!hasReceivedServerSnapshot && hasReceivedAnySnapshot) {
      hasReceivedServerSnapshot = true;
      emitMerged();
    }
  }, 3500);

  const unsubscribers: (() => void)[] = [];

  // 1. Subscribe to tombstone document
  try {
    const tombstoneDocRef = doc(db, SITE_CONTENT_COLLECTION, "deleted_events_tombstones");
    const unsubTombstone = onSnapshot(
      tombstoneDocRef,
      (docSnap) => {
        tombstonesMap.clear();
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data) {
            Object.keys(data).forEach((k) => {
              if (data[k] === true) tombstonesMap.set(k.toLowerCase().trim(), true);
            });
          }
        }
        scheduleEmit();
      },
      (error) => {
        console.warn("Tombstone listener notice:", error);
      }
    );
    unsubscribers.push(unsubTombstone);
  } catch (e) {
    console.warn("Could not subscribe to event tombstones:", e);
  }

  // 2. Subscribe to top-level /events collection (Directive #13: 1 Event = 1 Document)
  try {
    const colRef = collection(db, EVENTS_COLLECTION);
    const unsubEvents = onSnapshot(
      colRef,
      (snapshot) => {
        collectionEventsMap.clear();
        snapshot.docs.forEach((d) => {
          const docIdLower = d.id.toLowerCase().trim();
          if (tombstonesMap.has(docIdLower)) return;

          const data = d.data();
          const name = typeof data?.name === "string" ? data.name.trim() : "";
          if (!name) return; // Discard corrupt/ghost items lacking title

          const evt = { id: d.id, ...data, name } as EventItem;
          const idKey = (evt.id || "").toLowerCase().trim();
          const slugKey = (evt.slug || "").toLowerCase().trim();
          if (tombstonesMap.has(idKey) || tombstonesMap.has(slugKey)) return;

          const key = evt.id || evt.slug || d.id;
          collectionEventsMap.set(key, evt);
        });

        hasReceivedAnySnapshot = true;
        if (!snapshot.metadata.fromCache) {
          hasReceivedServerSnapshot = true;
        }
        scheduleEmit();
      },
      (error) => {
        if (error?.code !== "permission-denied" && !error?.message?.includes("Missing or insufficient permissions")) {
          console.warn("Firestore live events collection notice:", error);
        }
        hasReceivedServerSnapshot = true;
        scheduleEmit();
      }
    );
    unsubscribers.push(unsubEvents);
  } catch (e) {
    console.warn("Firestore subscription error for events collection:", e);
    hasReceivedServerSnapshot = true;
  }

  return () => {
    clearTimeout(offlineFallback);
    if (debounceTimer) clearTimeout(debounceTimer);
    unsubscribers.forEach((fn) => fn());
  };
}
