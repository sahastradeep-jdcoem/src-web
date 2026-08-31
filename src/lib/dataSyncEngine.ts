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

  const cleanData = cleanUndefined(data);
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

  const map = new Map<string, T>();

  // Add all remote items first
  remoteList.forEach((item) => {
    const key = item.id || item.slug || JSON.stringify(item);
    map.set(key, item);
  });

  // Merge local items: user edits take precedence over cached remote snapshots
  localList.forEach((item) => {
    const key = item.id || item.slug || JSON.stringify(item);
    const existingRemote = map.get(key);
    if (existingRemote) {
      map.set(key, { ...existingRemote, ...item });
    } else {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
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
