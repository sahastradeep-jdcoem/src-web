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

  // Create lookup maps for both directions
  const localMap = new Map<string, T>();
  localList.forEach((item) => {
    const key = (item.id || item.slug || "").toLowerCase();
    if (key) localMap.set(key, item);
  });

  const remoteKeys = new Set<string>();

  // Smart Deep Merge: Merge remote items with local items
  const merged = remoteList.map((remoteItem) => {
    const key = (remoteItem.id || remoteItem.slug || "").toLowerCase();
    if (key) remoteKeys.add(key);
    const localItem = key ? localMap.get(key) : undefined;
    if (!localItem) return remoteItem;

    // Start with local as base, overlay remote changes, but preserve local non-empty assets
    const result: any = { ...localItem, ...remoteItem };

    for (const k of Object.keys(localItem as any)) {
      const localVal = (localItem as any)[k];
      const remoteVal = (remoteItem as any)[k];

      const isImageField = ["logoImage", "cardImage", "headerImage", "heroImage", "poster", "posterImage", "avatar", "imageUrl"].includes(k);

      // If local has a non-empty image asset and remote is empty or falsy, ALWAYS keep local
      if (isImageField) {
        if (localVal && typeof localVal === "string" && localVal.trim() !== "") {
          if (!remoteVal || typeof remoteVal !== "string" || remoteVal.trim() === "") {
            result[k] = localVal;
            continue;
          }
        }
      }

      // If local has a meaningful value and remote doesn't, keep local
      if (
        localVal !== undefined && localVal !== null && localVal !== "" &&
        (remoteVal === undefined || remoteVal === null || remoteVal === "")
      ) {
        result[k] = localVal;
      }

      // If local has a key that remote doesn't have at all, add it
      if (!(k in (remoteItem as any))) {
        result[k] = localVal;
      }
    }
    return result as T;
  });

  // Add any local-only items not present in remote (newly added locally, not yet synced)
  localList.forEach((item) => {
    const key = (item.id || item.slug || "").toLowerCase();
    if (key && !remoteKeys.has(key)) {
      merged.push(item);
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
