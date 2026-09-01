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
const MAX_SAFE_BASE64_LENGTH = 120000; // ~90 KB max per individual base64 image (safe for compressed WebP)

/**
 * Recursively inspects base64 data-URL strings from objects/arrays.
 * Preserves lightweight compressed WebP images (under ~90KB) so logos/photos are never lost if Storage is slow,
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
  const queue = getPendingQueue();
  if (queue.length === 0) return true;

  isProcessingQueue = true;
  let allSuccess = true;
  const remaining: PendingSyncItem[] = [];

  for (const item of queue) {
    try {
      await saveSiteContentToFirestore(item.docId, item.payload);
      // Success: do not re-add to remaining
    } catch (err) {
      console.warn(`[SyncEngine] Firestore write failed for ${item.docId}, queued for auto-retry`, err);
      allSuccess = false;
      remaining.push({
        ...item,
        retryCount: item.retryCount + 1,
      });
    }
  }

  savePendingQueue(remaining);
  isProcessingQueue = false;
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

    // Start with remote as base, then selectively preserve local values
    const result: any = { ...remoteItem };

    for (const k of Object.keys(localItem as any)) {
      const localVal = (localItem as any)[k];
      const remoteVal = (remoteItem as any)[k];

      // If local has a meaningful value and remote doesn't, keep local
      // This covers: HTTPS URLs where Firestore write failed, base64 images not yet synced,
      // and any non-empty field that remote lost
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
