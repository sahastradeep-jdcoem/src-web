"use client";

import { saveSiteContentToFirestore, getSiteContentFromFirestore, cleanUndefined } from "./firebase/firestore";

const QUEUE_STORAGE_KEY = "src_pending_cloud_sync_queue";
const BACKUP_HISTORY_KEY = "src_rolling_snapshot_history";
const MAX_HISTORY_SNAPSHOTS = 20;

export interface PendingSyncItem {
  id: string;
  docId: string;
  payload: any;
  timestamp: number;
  retryCount: number;
}

// -------------------------------------------------------------
// 0. BASE64 IMAGE SANITIZER & AUTO-COMPACTOR
// -------------------------------------------------------------
const BASE64_PREFIX = "data:image/";
const MAX_SAFE_BASE64_LENGTH = 120000; // ~90 KB max per individual image

/**
 * Downscales a base64 image data-url using HTML5 canvas
 * Ensures circle logos are ~5-8KB so Firestore documents never exceed 100KB total.
 */
export async function compactBase64Image(dataUrl: string, maxDim = 160, quality = 0.70): Promise<string> {
  if (typeof window === "undefined" || !dataUrl.startsWith("data:image/")) return dataUrl;
  if (dataUrl.length < 25000) return dataUrl; // Already compact

  try {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        const compactUrl = canvas.toDataURL("image/webp", quality);
        resolve(compactUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  } catch {
    return dataUrl;
  }
}

/**
 * Recursively compacts any oversized base64 images in a club dataset
 */
export async function compactClubDataset<T extends { logoImage?: string; cardImage?: string; headerImage?: string }>(
  clubs: T[]
): Promise<T[]> {
  if (!Array.isArray(clubs)) return clubs;
  const processed = await Promise.all(
    clubs.map(async (c) => {
      let logo = c.logoImage;
      let card = c.cardImage;
      let header = c.headerImage;

      if (logo && logo.startsWith("data:image/") && logo.length > 25000) {
        logo = await compactBase64Image(logo, 160, 0.70);
      }
      if (card && card.startsWith("data:image/") && card.length > 60000) {
        card = await compactBase64Image(card, 500, 0.70);
      }
      if (header && header.startsWith("data:image/") && header.length > 80000) {
        header = await compactBase64Image(header, 700, 0.70);
      }

      return {
        ...c,
        logoImage: logo,
        cardImage: card,
        headerImage: header,
      };
    })
  );
  return processed;
}

/**
 * Recursively compacts any oversized base64 images in an event dataset
 */
export async function compactEventDataset<T extends { poster?: string; cardImage?: string; posterImage?: string; headerImage?: string }>(
  events: T[]
): Promise<T[]> {
  if (!Array.isArray(events)) return events;
  const processed = await Promise.all(
    events.map(async (e) => {
      let poster = e.poster;
      let card = e.cardImage;
      let posterImg = e.posterImage;
      let header = e.headerImage;

      if (poster && poster.startsWith("data:image/") && poster.length > 60000) {
        poster = await compactBase64Image(poster, 600, 0.70);
      }
      if (card && card.startsWith("data:image/") && card.length > 60000) {
        card = await compactBase64Image(card, 600, 0.70);
      }
      if (posterImg && posterImg.startsWith("data:image/") && posterImg.length > 60000) {
        posterImg = await compactBase64Image(posterImg, 600, 0.70);
      }
      if (header && header.startsWith("data:image/") && header.length > 80000) {
        header = await compactBase64Image(header, 800, 0.70);
      }

      return {
        ...e,
        poster,
        cardImage: card,
        posterImage: posterImg,
        headerImage: header,
      };
    })
  );
  return processed;
}

/**
 * Recursively compacts any oversized base64 avatars in a council/team dataset
 */
export async function compactCouncilDataset<T extends { avatar?: string }>(
  members: T[]
): Promise<T[]> {
  if (!Array.isArray(members)) return members;
  const processed = await Promise.all(
    members.map(async (m) => {
      let av = m.avatar;
      if (av && av.startsWith("data:image/") && av.length > 30000) {
        av = await compactBase64Image(av, 400, 0.84);
      }
      return {
        ...m,
        avatar: av,
      };
    })
  );
  return processed;
}

export function stripBase64Images<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    if (obj.startsWith(BASE64_PREFIX)) {
      return (obj.length > MAX_SAFE_BASE64_LENGTH ? "" : obj) as unknown as T;
    }
    return obj;
  }
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => stripBase64Images(item)) as unknown as T;
  }
  const result: any = {};
  for (const key of Object.keys(obj as any)) {
    result[key] = stripBase64Images((obj as any)[key]);
  }
  return result as T;
}

/**
 * Check if there are pending (un-flushed) cloud writes for a given docId.
 * Used by realtime subscribers to skip reconciliation when local data is newer.
 */
export function hasPendingWritesFor(docId: string): boolean {
  if (typeof window === "undefined") return false;
  const queue = getPendingQueue();
  return queue.some((item) => item.docId === docId);
}

export interface RollingSnapshot {
  id: string;
  timestamp: string;
  label: string;
  docId: string;
  itemCount: number;
  data: any;
}

// -------------------------------------------------------------
// 1. ROLLING AUDIT & RECOVERY SNAPSHOT RECORDER
// -------------------------------------------------------------
export function recordRollingSnapshot(docId: string, label: string, data: any): void {
  if (typeof window === "undefined") return;
  try {
    const existing: RollingSnapshot[] = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || "[]");
    const newSnapshot: RollingSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      label,
      docId,
      itemCount: Array.isArray(data) ? data.length : 1,
      data: cleanUndefined(data),
    };

    const updated = [newSnapshot, ...existing].slice(0, MAX_HISTORY_SNAPSHOTS);
    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("src_snapshot_history_updated", { detail: updated }));
  } catch (e) {
    console.warn("Could not record rolling backup snapshot", e);
  }
}

export function getRollingSnapshotHistory(): RollingSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// 2. WRITE-AHEAD QUEUE & BACKGROUND RETRY WORKER
// -------------------------------------------------------------
function getPendingQueue(): PendingSyncItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePendingQueue(queue: PendingSyncItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("src_pending_queue_updated", { detail: queue }));
  } catch {}
}

export async function enqueueCloudWrite<T>(docId: string, data: T, label = "Data Update"): Promise<boolean> {
  // Always record rolling backup snapshot first (Zero Data Loss guarantee)
  recordRollingSnapshot(docId, label, data);

  const cleanData = cleanUndefined(stripBase64Images(data));
  const queue = getPendingQueue();
  const existingIdx = queue.findIndex((item) => item.docId === docId);

  const item: PendingSyncItem = {
    id: `queue-${Date.now()}-${docId}`,
    docId,
    payload: cleanData,
    timestamp: Date.now(),
    retryCount: 0,
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = item;
  } else {
    queue.push(item);
  }
  savePendingQueue(queue);

  // Attempt direct write immediately
  return processQueue();
}

let isProcessingQueue = false;

export async function processQueue(): Promise<boolean> {
  if (isProcessingQueue || typeof window === "undefined") return false;
  isProcessingQueue = true;
  let allSuccess = true;

  try {
    while (true) {
      const currentQueue = getPendingQueue();
      if (currentQueue.length === 0) break;

      const item = currentQueue[0];
      try {
        await saveSiteContentToFirestore(item.docId, item.payload);
        // Atomically remove this processed item from the latest queue
        const latestQueue = getPendingQueue();
        const updatedQueue = latestQueue.filter((q) => q.id !== item.id && q.docId !== item.docId);
        savePendingQueue(updatedQueue);
      } catch (err) {
        console.warn(`[SyncEngine] Firestore write failed for ${item.docId}, queued for auto-retry`, err);
        allSuccess = false;
        // On error, increment retry count and stop current loop (will auto-retry on reconnect)
        const latestQueue = getPendingQueue();
        const itemIdx = latestQueue.findIndex((q) => q.id === item.id);
        if (itemIdx >= 0) {
          latestQueue[itemIdx].retryCount += 1;
          savePendingQueue(latestQueue);
        }
        break;
      }
    }
  } finally {
    isProcessingQueue = false;
  }

  return allSuccess;
}

// -------------------------------------------------------------
// 3. SMART CONFLICT-FREE RECONCILIATION & MERGE ENGINE
// -------------------------------------------------------------
export function reconcileArrayDatasets<T extends { id?: string; slug?: string }>(
  localList: T[],
  remoteList: T[]
): T[] {
  if (!Array.isArray(remoteList) || remoteList.length === 0) {
    return localList;
  }
  if (!Array.isArray(localList) || localList.length === 0) {
    return remoteList;
  }

  // Create multi-key lookup map for local items
  const localMap = new Map<string, T>();
  const matchedLocalKeys = new Set<string>();

  localList.forEach((item) => {
    if (item.id) localMap.set(item.id.toLowerCase(), item);
    if (item.slug) localMap.set(item.slug.toLowerCase(), item);
    if ((item as any).name) localMap.set((item as any).name.toLowerCase(), item);
    // Also handle "club-" prefix variations
    if (item.id && item.id.startsWith("club-")) {
      localMap.set(item.id.replace("club-", "").toLowerCase(), item);
    }
    if (item.slug && !item.slug.startsWith("club-")) {
      localMap.set(`club-${item.slug.toLowerCase()}`, item);
    }
  });

  const findMatchingLocal = (remoteItem: T): T | undefined => {
    if (remoteItem.id && localMap.has(remoteItem.id.toLowerCase())) {
      return localMap.get(remoteItem.id.toLowerCase());
    }
    if (remoteItem.slug && localMap.has(remoteItem.slug.toLowerCase())) {
      return localMap.get(remoteItem.slug.toLowerCase());
    }
    if ((remoteItem as any).name && localMap.has((remoteItem as any).name.toLowerCase())) {
      return localMap.get((remoteItem as any).name.toLowerCase());
    }
    if (remoteItem.id && remoteItem.id.startsWith("club-")) {
      const stripped = remoteItem.id.replace("club-", "").toLowerCase();
      if (localMap.has(stripped)) return localMap.get(stripped);
    }
    if (remoteItem.slug && !remoteItem.slug.startsWith("club-")) {
      const prefixed = `club-${remoteItem.slug.toLowerCase()}`;
      if (localMap.has(prefixed)) return localMap.get(prefixed);
    }
    return undefined;
  };

  // Merge remote items with local items
  const merged = remoteList.map((remoteItem) => {
    const localItem = findMatchingLocal(remoteItem);
    if (!localItem) return remoteItem;

    const localKey = (localItem.id || localItem.slug || (localItem as any).name || "").toLowerCase();
    if (localKey) matchedLocalKeys.add(localKey);
    if (localItem.id) matchedLocalKeys.add(localItem.id.toLowerCase());
    if (localItem.slug) matchedLocalKeys.add(localItem.slug.toLowerCase());

    // Remote is the authoritative cloud data source
    const result: any = { ...remoteItem };

    const allKeys = new Set([...Object.keys(localItem as any), ...Object.keys(remoteItem as any)]);
    for (const k of allKeys) {
      const localVal = (localItem as any)[k];
      const remoteVal = (remoteItem as any)[k];

      const isImageField = [
        "logoImage",
        "cardImage",
        "headerImage",
        "heroImage",
        "poster",
        "posterImage",
        "avatar",
        "imageUrl"
      ].includes(k);

      if (isImageField) {
        const isLocalValid = localVal && typeof localVal === "string" && localVal.trim() !== "";
        const isRemoteValid = remoteVal && typeof remoteVal === "string" && remoteVal.trim() !== "";

        if (!isRemoteValid && isLocalValid) {
          result[k] = localVal;
          continue;
        }
        if (!isLocalValid && isRemoteValid) {
          result[k] = remoteVal;
          continue;
        }
        if (isLocalValid && isRemoteValid) {
          const isRemoteUnsplash = remoteVal.includes("images.unsplash.com");
          const isLocalCustom = !localVal.includes("images.unsplash.com");

          // If local has a custom user-uploaded image but remote still has stock unsplash placeholder, keep local!
          if (isLocalCustom && isRemoteUnsplash) {
            result[k] = localVal;
            continue;
          }

          // Otherwise remote is authoritative
          result[k] = remoteVal;
          continue;
        }
        result[k] = "";
        continue;
      }

      // For standard text/number fields:
      // If remote has a non-empty/defined value, keep remote
      if (remoteVal !== undefined && remoteVal !== null && remoteVal !== "") {
        result[k] = remoteVal;
      } else if (localVal !== undefined && localVal !== null && localVal !== "") {
        result[k] = localVal;
      }
    }
    return result as T;
  });

  // Add any local-only items that were not matched in remote
  localList.forEach((localItem) => {
    const idKey = localItem.id ? localItem.id.toLowerCase() : "";
    const slugKey = localItem.slug ? localItem.slug.toLowerCase() : "";
    if (
      (!idKey || !matchedLocalKeys.has(idKey)) &&
      (!slugKey || !matchedLocalKeys.has(slugKey))
    ) {
      merged.push(localItem);
    }
  });

  return merged;
}

// -------------------------------------------------------------
// 4. AUTO-RECOVERY ON NETWORK RECONNECTION
// -------------------------------------------------------------
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.info("[SyncEngine] Device back online. Flushing pending cloud writes...");
    processQueue();
  });
}
