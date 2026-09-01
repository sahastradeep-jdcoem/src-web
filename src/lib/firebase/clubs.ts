import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./config";
import { ClubItem } from "@/types";
import { mockClubs } from "@/data/clubs";
import { cleanUndefined } from "./firestore";
import { compressImage } from "@/lib/imageCompression";

const SITE_CONTENT_COLLECTION = "site_content";
const CLUBS_DOC_ID = "clubs";
const LOCAL_STORAGE_KEY = "src_clubs_roster";

/**
 * Get all clubs from Firestore (single source of truth) with graceful fallback
 */
export async function getClubs(): Promise<ClubItem[]> {
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const docRef = doc(db, SITE_CONTENT_COLLECTION, CLUBS_DOC_ID);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists() && Array.isArray(snapshot.data()?.payload) && snapshot.data().payload.length > 0) {
        const data = snapshot.data().payload as ClubItem[];
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        }
        return data;
      }
    }
  } catch (error) {
    console.warn("Firestore getClubs notice:", error);
  }

  // Fallback to local storage if offline
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }

  return mockClubs;
}

/**
 * Get a single club by ID or Slug
 */
export async function getClubById(idOrSlug: string): Promise<ClubItem | null> {
  const allClubs = await getClubs();
  const normalized = idOrSlug.toLowerCase().replace(/^club-/, "");
  return allClubs.find((c) => {
    const cId = (c.id || "").toLowerCase().replace(/^club-/, "");
    const cSlug = (c.slug || "").toLowerCase().replace(/^club-/, "");
    return cId === normalized || cSlug === normalized || c.id === idOrSlug || c.slug === idOrSlug;
  }) || null;
}

/**
 * Save all clubs to Firestore atomically
 */
export async function saveClubsToFirestore(clubs: ClubItem[]): Promise<void> {
  const sanitized = cleanUndefined(clubs);
  
  // 1. Update local cache & dispatch UI update event immediately
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: sanitized }));
  }

  // 2. Persist to Cloud Firestore as authoritative source of truth
  if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    const docRef = doc(db, SITE_CONTENT_COLLECTION, CLUBS_DOC_ID);
    await setDoc(docRef, { payload: sanitized, updatedAt: serverTimestamp() }, { merge: true });
  }
}

/**
 * Update a specific club by ID or Slug and persist to Firestore
 */
export async function updateClub(clubIdOrSlug: string, updates: Partial<ClubItem>): Promise<ClubItem[]> {
  const currentClubs = await getClubs();
  const normalized = clubIdOrSlug.toLowerCase().replace(/^club-/, "");

  const updatedClubs = currentClubs.map((club) => {
    const cId = (club.id || "").toLowerCase().replace(/^club-/, "");
    const cSlug = (club.slug || "").toLowerCase().replace(/^club-/, "");
    if (cId === normalized || cSlug === normalized || club.id === clubIdOrSlug || club.slug === clubIdOrSlug) {
      return {
        ...club,
        ...updates,
      };
    }
    return club;
  });

  await saveClubsToFirestore(updatedClubs);
  return updatedClubs;
}

/**
 * Upload a Club Logo to Firebase Storage and update Firestore document
 */
export async function uploadClubLogo(
  clubIdOrSlug: string,
  fileOrDataUrl: File | string
): Promise<{ logoUrl: string; storagePath: string }> {
  // 1. Client-Side Image Compression to optimal 1:1 WebP (preserving transparency)
  const compressed = await compressImage(fileOrDataUrl, {
    maxWidth: 500,
    maxHeight: 500,
    quality: 0.85,
    outputFormat: "image/webp",
  });

  const cleanId = clubIdOrSlug.toLowerCase().replace(/^club-/, "");
  const timestamp = Date.now();
  const storagePath = `clubs/${cleanId}/logo/${timestamp}_logo.webp`;

  let logoUrl = compressed.dataUrl;

  // 2. Upload to Firebase Storage
  if (storage && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    try {
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, compressed.file, {
        contentType: "image/webp",
        customMetadata: {
          clubId: cleanId,
          uploadedAt: new Date().toISOString(),
        },
      });

      const downloadUrl = await getDownloadURL(storageRef);
      if (downloadUrl && downloadUrl.startsWith("http")) {
        logoUrl = downloadUrl;
      }
    } catch (storageError) {
      console.warn("Firebase Storage upload fallback to optimized WebP payload:", storageError);
    }
  }

  // 3. Atomically update Firestore
  await updateClub(clubIdOrSlug, {
    logoImage: logoUrl,
  });

  return { logoUrl, storagePath };
}

/**
 * Delete a Club Logo from Firebase Storage and update Firestore
 */
export async function deleteClubLogo(clubIdOrSlug: string, storagePath?: string): Promise<ClubItem[]> {
  if (storage && storagePath) {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (e) {
      console.warn("Could not delete file from Firebase Storage", e);
    }
  }

  return updateClub(clubIdOrSlug, {
    logoImage: "",
  });
}

/**
 * Real-time synchronization subscription for clubs
 */
export function subscribeToClubs(callback: (clubs: ClubItem[]) => void): () => void {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return () => {};
  }

  try {
    const docRef = doc(db, SITE_CONTENT_COLLECTION, CLUBS_DOC_ID);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists() && Array.isArray(snapshot.data()?.payload)) {
          const remoteClubs = snapshot.data().payload as ClubItem[];
          if (typeof window !== "undefined") {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remoteClubs));
            window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: remoteClubs }));
          }
          callback(remoteClubs);
        }
      },
      (error) => {
        console.warn("Firestore clubs subscription notice:", error);
      }
    );
  } catch (e) {
    console.warn("Firestore clubs subscription setup error:", e);
    return () => {};
  }
}
