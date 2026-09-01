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
// 0. BASE64 IMAGE SANITIZER — prevents Firestore 1MB limit blowout
// -------------------------------------------------------------
const BASE64_PREFIX = "data:image/";
const MAX_SAFE_BASE64_LENGTH = 350000; // ~260 KB max per individual base64 image (safe for compressed WebP)

/**
 * Recursively inspects base64 data-URL strings from objects/arrays.
 * Preserves lightweight compressed WebP images (under ~260KB) so logos/photos are never lost even if Storage is offline,
 * while stripping massive raw DSLR base64 strings that could exceed Firestore's 1MB document limit.
 */
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
        // 1. If remote has a valid non-empty image, remote ALWAYS wins
        if (remoteVal && typeof remoteVal === "string" && remoteVal.trim() !== "") {
          result[k] = remoteVal;
          continue;
        }
        // 2. If remote is empty but local has an image (e.g. freshly uploaded), keep local
        if (localVal && typeof localVal === "string" && localVal.trim() !== "") {
          result[k] = localVal;
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
