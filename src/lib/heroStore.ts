import { DEFAULT_HERO_SETTINGS, HeroSettings, PRESET_HERO_BG_IMAGES, HeroPreset } from "@/data/heroSettings";
import { 
  getSiteContentFromFirestore, 
  subscribeToSiteContent,
  cleanUndefined,
  saveSiteContentToFirestore
} from "./firebase/firestore";
import { enqueueCloudWrite, hasPendingWritesFor } from "./dataSyncEngine";

const HERO_STORAGE_KEY = "src_hero_settings";
const PRESETS_STORAGE_KEY = "src_hero_presets";

export function getStoredHeroSettings(): HeroSettings {
  if (typeof window === "undefined") return DEFAULT_HERO_SETTINGS;
  try {
    const stored = localStorage.getItem(HERO_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_HERO_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn("Could not read hero settings from storage", e);
  }
  return DEFAULT_HERO_SETTINGS;
}

export async function saveStoredHeroSettings(settings: HeroSettings): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(settings);
    try { localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(sanitized)); } catch {}
    window.dispatchEvent(new CustomEvent("src_hero_updated", { detail: sanitized }));
    
    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore("hero_settings", sanitized);
    } catch (err) {
      console.warn("Firestore direct write for hero settings failed, enqueuing:", err);
      cloudWriteError = err;
    }
    enqueueCloudWrite("hero_settings", sanitized, "Hero Banner Settings");

    if (cloudWriteError) {
      throw cloudWriteError;
    }
  } catch (e) {
    console.error("Could not save hero settings to storage", e);
    throw e;
  }
}

export async function syncHeroSettingsFromFirestore(): Promise<HeroSettings> {
  try {
    const remote = await getSiteContentFromFirestore<HeroSettings>("hero_settings");
    if (remote) {
      const merged = { ...DEFAULT_HERO_SETTINGS, ...remote };
      if (typeof window !== "undefined") {
        localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("src_hero_updated", { detail: merged }));
      }
      return merged;
    }
  } catch {}
  return getStoredHeroSettings();
}

export function subscribeToHeroSettings(callback: (settings: HeroSettings) => void): () => void {
  return subscribeToSiteContent<HeroSettings>("hero_settings", (remote) => {
    if (remote) {
      if (hasPendingWritesFor("hero_settings")) return;
      const merged = { ...DEFAULT_HERO_SETTINGS, ...remote };
      if (typeof window !== "undefined") {
        localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("src_hero_updated", { detail: merged }));
      }
      callback(merged);
    }
  });
}

export function getStoredHeroPresets(): HeroPreset[] {
  if (typeof window === "undefined") return PRESET_HERO_BG_IMAGES;
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read hero presets from storage", e);
  }
  return PRESET_HERO_BG_IMAGES;
}

export async function saveStoredHeroPresets(presets: HeroPreset[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(presets);
    try { localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(sanitized)); } catch {}
    window.dispatchEvent(new CustomEvent("src_hero_presets_updated", { detail: sanitized }));
    
    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore("hero_presets", sanitized);
    } catch (err) {
      console.warn("Firestore direct write for hero presets failed, enqueuing:", err);
      cloudWriteError = err;
    }
    enqueueCloudWrite("hero_presets", sanitized, `Hero Presets (${presets.length} Presets)`);

    if (cloudWriteError) {
      throw cloudWriteError;
    }
  } catch (e) {
    console.error("Could not save hero presets to storage", e);
    throw e;
  }
}

export async function syncHeroPresetsFromFirestore(): Promise<HeroPreset[]> {
  try {
    const remote = await getSiteContentFromFirestore<HeroPreset[]>("hero_presets");
    if (remote && Array.isArray(remote) && remote.length > 0) {
      if (typeof window !== "undefined") {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(remote));
        window.dispatchEvent(new CustomEvent("src_hero_presets_updated", { detail: remote }));
      }
      return remote;
    }
  } catch {}
  return getStoredHeroPresets();
}
