const MAX_SAFE_INLINE_IMAGE_LENGTH = 350_000;
const NON_ESSENTIAL_CACHE_KEYS = [
  "src_rolling_snapshot_history",
  "src_pending_cloud_sync_queue",
  "src_local_registrations",
  "src_gallery_photos",
];

export interface SafeStorageOptions {
  /** Keys that may be evicted before retrying after a quota failure. */
  evictKeys?: string[];
  /** Optional dataset compactor. It must be synchronous. */
  compact?: (value: unknown) => unknown;
}

function compactInlineMedia(value: unknown): unknown {
  if (typeof value === "string") {
    return value.startsWith("data:image/") && value.length > MAX_SAFE_INLINE_IMAGE_LENGTH
      ? ""
      : value;
  }
  if (Array.isArray(value)) return value.map(compactInlineMedia);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, compactInlineMedia(child)])
    );
  }
  return value;
}

function serialize(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(compactInlineMedia(JSON.parse(value)));
    } catch {
      return value;
    }
  }
  return JSON.stringify(compactInlineMedia(value));
}

/**
 * Quota-safe browser persistence. Returns false only when the value could not
 * be written after compaction and non-essential cache eviction.
 */
export function safeStorageSet(
  key: string,
  value: unknown,
  options: SafeStorageOptions = {},
): boolean {
  if (typeof window === "undefined") return false;

  const storage = window.localStorage;
  const prepared = options.compact ? options.compact(value) : value;
  const serialized = serialize(prepared);

  try {
    storage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.warn(`[safeStorage] Could not write ${key}; evicting non-essential caches.`, error);
  }

  const evictKeys = options.evictKeys || NON_ESSENTIAL_CACHE_KEYS;
  for (const evictKey of evictKeys) {
    if (evictKey !== key) {
      try {
        storage.removeItem(evictKey);
      } catch {
        // Ignore individual eviction failures and continue retrying.
      }
    }
  }

  try {
    storage.setItem(key, serialize(compactInlineMedia(prepared)));
    return true;
  } catch (retryError) {
    console.error(`[safeStorage] Storage quota prevented writing ${key}.`, retryError);
    return false;
  }
}
