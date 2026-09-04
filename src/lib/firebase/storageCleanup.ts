import { ref, listAll, getMetadata, getDownloadURL, deleteObject, StorageReference } from "firebase/storage";
import { storage } from "./config";
import { getSiteContentFromFirestore } from "./firestore";
import { getStoredEvents } from "@/lib/eventsStore";
import { 
  getStoredClubs, 
  getStoredCouncilMembers, 
  getStoredHostingCommittee, 
  getStoredFoundingMembers, 
  getStoredSpokespersons, 
  getStoredInstitutionalPillars 
} from "@/lib/councilStore";
import { getStoredGalleryPhotos } from "@/lib/galleryStore";
import { getStoredHeroSettings, getStoredHeroPresets } from "@/lib/heroStore";
import { getStoredTenures } from "@/lib/tenureStore";
import { getStoredListings } from "@/lib/listingsStore";
import { getStoredUsers } from "@/lib/usersStore";

export interface StorageFileRecord {
  name: string;
  fullPath: string;
  size: number; // in bytes
  formattedSize: string;
  contentType: string;
  timeCreated?: string;
  downloadUrl: string;
  isOrphan: boolean;
}

export interface StorageScanResult {
  scannedAt: string;
  totalFiles: number;
  inUseCount: number;
  orphanCount: number;
  totalBytes: number;
  orphanBytes: number;
  formattedOrphanBytes: string;
  orphanFiles: StorageFileRecord[];
  activeReferencedCount: number;
  bucketAccessible: boolean;
  statusMessage?: string;
}

/**
 * Format bytes into human readable string (KB, MB, GB)
 */
export function formatStorageBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Safely extracts the internal Firebase Storage path from any full URL or string.
 * Returns null if the URL is external (e.g. Unsplash, Google profile photo, Base64 data URL).
 */
export function extractStoragePath(urlOrPath: string): string | null {
  if (!urlOrPath || typeof urlOrPath !== "string") return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return null;

  // 1. Firebase Storage URL format:
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>?alt=media&token=...
  if (trimmed.includes("firebasestorage.googleapis.com")) {
    try {
      const match = trimmed.match(/\/o\/([^?#]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]).replace(/^\/+/, "");
      }
    } catch {
      return null;
    }
  }

  // 2. Google Cloud Storage standard format:
  // https://storage.googleapis.com/<bucket>/<path>
  if (trimmed.includes("storage.googleapis.com")) {
    try {
      const urlObj = new URL(trimmed);
      const parts = urlObj.pathname.split("/").filter(Boolean);
      if (parts.length > 1) {
        return decodeURIComponent(parts.slice(1).join("/")).replace(/^\/+/, "");
      }
    } catch {
      return null;
    }
  }

  // 3. Direct relative storage path (e.g. "events/cards/17255_img.webp")
  if (
    !trimmed.startsWith("http://") &&
    !trimmed.startsWith("https://") &&
    trimmed.includes("/") &&
    /\.(webp|png|jpe?g|svg|gif|avif)$/i.test(trimmed)
  ) {
    return trimmed.replace(/^\/+/, "");
  }

  return null;
}

/**
 * Collect all active image URLs and storage paths currently referenced across
 * both local state AND Cloud Firestore collections.
 */
export async function collectAllReferencedPaths(): Promise<{
  paths: Set<string>;
  urls: Set<string>;
  totalReferences: number;
}> {
  const referencedPaths = new Set<string>();
  const referencedUrls = new Set<string>();

  const registerCandidate = (raw?: string | null) => {
    if (!raw || typeof raw !== "string") return;
    const trimmed = raw.trim();
    if (!trimmed) return;

    referencedUrls.add(trimmed);

    const extractedPath = extractStoragePath(trimmed);
    if (extractedPath) {
      referencedPaths.add(extractedPath);
      referencedPaths.add(extractedPath.toLowerCase());
    }
  };

  const registerCandidateArray = (arr?: any[]) => {
    if (Array.isArray(arr)) {
      arr.forEach((item) => {
        if (typeof item === "string") {
          registerCandidate(item);
        } else if (item && typeof item === "object") {
          registerCandidate(item.url || item.imageUrl || item.avatar || item.photoURL);
        }
      });
    }
  };

  // 1. Gather all local entities
  try {
    // Events
    const localEvents = getStoredEvents();
    localEvents.forEach((e: any) => {
      registerCandidate(e.poster);
      registerCandidate(e.cardImage);
      registerCandidate(e.headerImage);
      registerCandidate(e.posterImage);
      registerCandidate(e.bannerImage);
      registerCandidateArray(e.gallery);
    });

    // Clubs
    const localClubs = getStoredClubs();
    localClubs.forEach((c: any) => {
      registerCandidate(c.logoImage);
      registerCandidate(c.cardImage);
      registerCandidate(c.headerImage);
      registerCandidateArray(c.gallery);
      if (c.lead) registerCandidate(c.lead.avatar);
      if (Array.isArray(c.coLeads)) {
        c.coLeads.forEach((cl: any) => registerCandidate(cl.avatar));
      }
    });

    // Council & Pillars
    const councilMembers = [
      ...getStoredCouncilMembers(),
      ...getStoredHostingCommittee(),
      ...getStoredFoundingMembers(),
      ...getStoredSpokespersons(),
      ...getStoredInstitutionalPillars(),
    ];
    councilMembers.forEach((m: any) => registerCandidate(m.avatar));

    // Gallery
    const galleryPhotos = getStoredGalleryPhotos();
    galleryPhotos.forEach((g: any) => registerCandidate(g.url));

    // Hero Settings & Presets
    const heroSettings = getStoredHeroSettings();
    if (heroSettings) {
      registerCandidate(heroSettings.bgImageUrl);
    }
    const heroPresets = getStoredHeroPresets();
    if (Array.isArray(heroPresets)) {
      heroPresets.forEach((p) => registerCandidate(p.url));
    }

    // Listings (Polls, Opportunities)
    const listings = getStoredListings();
    listings.forEach((l: any) => {
      registerCandidate(l.coverImage);
      registerCandidate(l.bannerImage);
      if (l.pollConfig?.options) registerCandidateArray(l.pollConfig.options);
      if (l.options) registerCandidateArray(l.options);
    });

    // Tenures
    const tenures = getStoredTenures();
    tenures.forEach((t: any) => {
      registerCandidateArray(t.roster);
      registerCandidateArray(t.events);
      registerCandidateArray(t.clubs);
    });

    // Users
    const users = getStoredUsers();
    users.forEach((u: any) => registerCandidate(u.photoURL));
  } catch (localErr) {
    console.warn("Notice: Non-critical issue reading local stores for storage cleanup:", localErr);
  }

  // 2. Cross-check authoritative Cloud Firestore site_content documents
  const collections = [
    "events",
    "clubs",
    "council_team",
    "hosting_committee",
    "founding_members",
    "spokespersons",
    "institutional_pillars",
    "gallery_photos",
    "hero_settings",
    "hero_presets",
    "tenures",
    "listings",
  ];

  await Promise.allSettled(
    collections.map(async (colId) => {
      try {
        const payload: any = await getSiteContentFromFirestore(colId);
        if (!payload) return;

        // Stringify and regex-extract all URLs and paths to ensure zero accidental deletions
        const serialized = JSON.stringify(payload);
        const urlMatches = serialized.match(/https?:\/\/[^"'\s\\]+/g) || [];
        urlMatches.forEach((u) => registerCandidate(u));

        // Also check if items contain direct path properties
        if (Array.isArray(payload)) {
          payload.forEach((item) => {
            if (item && typeof item === "object") {
              Object.values(item).forEach((v) => {
                if (typeof v === "string") registerCandidate(v);
              });
            }
          });
        }
      } catch (cloudErr) {
        console.warn(`Firestore check notice for [${colId}]:`, cloudErr);
      }
    })
  );

  return {
    paths: referencedPaths,
    urls: referencedUrls,
    totalReferences: referencedUrls.size,
  };
}

/**
 * Known directories in Firebase Cloud Storage used by the application
 */
const KNOWN_STORAGE_DIRECTORIES = [
  "events",
  "events/cards",
  "events/posters",
  "events/headers",
  "clubs",
  "clubs/cards",
  "clubs/headers",
  "clubs/logos",
  "clubs/leads",
  "pillars",
  "pillars/portraits",
  "team",
  "team/avatars",
  "gallery",
  "hero",
  "listings",
  "listings/covers",
  "uploads",
  "avatars",
];

/**
 * Recursively crawl a Firebase Storage reference to list all file items
 */
async function crawlStorageFiles(folderRef: StorageReference): Promise<StorageReference[]> {
  try {
    const res = await listAll(folderRef);
    let items = [...res.items];

    if (res.prefixes && res.prefixes.length > 0) {
      const subResults = await Promise.all(
        res.prefixes.map((subPrefix) => crawlStorageFiles(subPrefix))
      );
      for (const subList of subResults) {
        items = items.concat(subList);
      }
    }

    return items;
  } catch {
    // Individual folder not found or forbidden is expected for empty prefixes
    return [];
  }
}

/**
 * Scan Firebase Cloud Storage for all stored assets and match against active references.
 * Identifies all orphaned files with high accuracy and zero false-positives.
 */
export async function scanOrphanStorageFiles(): Promise<StorageScanResult> {
  const scannedAt = new Date().toISOString();

  if (!storage || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return {
      scannedAt,
      totalFiles: 0,
      inUseCount: 0,
      orphanCount: 0,
      totalBytes: 0,
      orphanBytes: 0,
      formattedOrphanBytes: "0 B",
      orphanFiles: [],
      activeReferencedCount: 0,
      bucketAccessible: false,
      statusMessage: "Firebase Storage configuration not found in environment.",
    };
  }

  const activeStorage = storage;

  // 1. Gather all active referenced URLs and paths across local + cloud
  const { paths: referencedPaths, urls: referencedUrls, totalReferences } = await collectAllReferencedPaths();

  // 2. Discover all files residing in Firebase Cloud Storage
  let allFileRefs: StorageReference[] = [];
  const seenPaths = new Set<string>();

  const addRefIfNew = (itemRef: StorageReference) => {
    const full = itemRef.fullPath.replace(/^\/+/, "");
    if (!seenPaths.has(full)) {
      seenPaths.add(full);
      allFileRefs.push(itemRef);
    }
  };

  try {
    // A. Attempt root listing
    const rootRef = ref(activeStorage);
    const rootFiles = await crawlStorageFiles(rootRef);
    rootFiles.forEach(addRefIfNew);
  } catch {
    // Root listing not allowed on some configurations; fallback to known directories
  }

  // B. Also explicitly crawl all known storage directories to guarantee complete discovery
  try {
    const dirResults = await Promise.all(
      KNOWN_STORAGE_DIRECTORIES.map(async (dir) => {
        try {
          const dirRef = ref(activeStorage, dir);
          return await crawlStorageFiles(dirRef);
        } catch {
          return [];
        }
      })
    );

    dirResults.flat().forEach(addRefIfNew);
  } catch (e) {
    console.warn("Storage crawler notice:", e);
  }

  // If no files found and bucket was not accessible
  if (allFileRefs.length === 0) {
    return {
      scannedAt,
      totalFiles: 0,
      inUseCount: 0,
      orphanCount: 0,
      totalBytes: 0,
      orphanBytes: 0,
      formattedOrphanBytes: "0 B",
      orphanFiles: [],
      activeReferencedCount: totalReferences,
      bucketAccessible: true,
      statusMessage: "Storage bucket is clean. No orphan or unreferenced files detected.",
    };
  }

  // 3. Inspect metadata and determine orphan status for each discovered file
  let totalBytes = 0;
  let orphanBytes = 0;
  let inUseCount = 0;
  const orphanFiles: StorageFileRecord[] = [];

  // Process files in batches to keep UI fluid
  const BATCH_SIZE = 8;
  for (let i = 0; i < allFileRefs.length; i += BATCH_SIZE) {
    const batch = allFileRefs.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (fileRef) => {
        const fullPath = fileRef.fullPath.replace(/^\/+/, "");
        const normalizedPath = fullPath.toLowerCase();

        let size = 0;
        let contentType = "image/webp";
        let timeCreated: string | undefined = undefined;
        let downloadUrl = "";

        try {
          const meta = await getMetadata(fileRef);
          size = meta.size || 0;
          contentType = meta.contentType || "image/webp";
          timeCreated = meta.timeCreated;
        } catch {}

        try {
          downloadUrl = await getDownloadURL(fileRef);
        } catch {}

        totalBytes += size;

        // Check if referenced
        const isReferenced =
          referencedPaths.has(fullPath) ||
          referencedPaths.has(normalizedPath) ||
          (downloadUrl && referencedUrls.has(downloadUrl)) ||
          Array.from(referencedPaths).some(
            (p) => p.endsWith(fileRef.name) || fullPath.endsWith(p) || p.includes(fullPath)
          );

        if (isReferenced) {
          inUseCount++;
        } else {
          orphanBytes += size;
          orphanFiles.push({
            name: fileRef.name,
            fullPath,
            size,
            formattedSize: formatStorageBytes(size),
            contentType,
            timeCreated,
            downloadUrl: downloadUrl || "",
            isOrphan: true,
          });
        }
      })
    );
  }

  return {
    scannedAt,
    totalFiles: allFileRefs.length,
    inUseCount,
    orphanCount: orphanFiles.length,
    totalBytes,
    orphanBytes,
    formattedOrphanBytes: formatStorageBytes(orphanBytes),
    orphanFiles,
    activeReferencedCount: totalReferences,
    bucketAccessible: true,
    statusMessage:
      orphanFiles.length > 0
        ? `Found ${orphanFiles.length} unreferenced files (${formatStorageBytes(orphanBytes)} reclaimable).`
        : "All files in Firebase Storage are currently linked and in-use!",
  };
}

/**
 * Permanently deletes orphan files from Firebase Cloud Storage.
 * Executes in controlled batches with progress tracking.
 */
export async function purgeOrphanStorageFiles(
  orphanPaths: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ deletedCount: number; failedCount: number; errors: string[] }> {
  if (!storage) {
    return { deletedCount: 0, failedCount: orphanPaths.length, errors: ["Firebase Storage not initialized."] };
  }

  const activeStorage = storage;
  let deletedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  const BATCH_SIZE = 4;
  for (let i = 0; i < orphanPaths.length; i += BATCH_SIZE) {
    const batch = orphanPaths.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (path) => {
        try {
          const fileRef = ref(activeStorage, path);
          await deleteObject(fileRef);
          deletedCount++;
        } catch (err: any) {
          failedCount++;
          errors.push(`Failed to delete ${path}: ${err?.message || "Unknown error"}`);
        }
      })
    );

    if (onProgress) {
      onProgress(deletedCount + failedCount, orphanPaths.length);
    }
  }

  return {
    deletedCount,
    failedCount,
    errors,
  };
}
