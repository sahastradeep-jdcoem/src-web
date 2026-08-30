import { GalleryPhoto } from "@/types";
import { mockGalleryPhotos as initialPhotos } from "@/data/gallery";
import { 
  saveSiteContentToFirestore, 
  getSiteContentFromFirestore, 
  subscribeToSiteContent 
} from "./firebase/firestore";

const GALLERY_STORAGE_KEY = "src_gallery_photos";

export function getStoredGalleryPhotos(): GalleryPhoto[] {
  if (typeof window === "undefined") return initialPhotos;
  try {
    const stored = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read gallery photos from storage", e);
  }
  return initialPhotos;
}

export function saveStoredGalleryPhotos(photos: GalleryPhoto[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(photos));
    window.dispatchEvent(new CustomEvent("src_gallery_updated", { detail: photos }));
    saveSiteContentToFirestore("gallery_photos", photos);
  } catch (e) {
    console.error("Could not save gallery photos to storage", e);
  }
}

export async function syncGalleryFromFirestore(): Promise<GalleryPhoto[]> {
  try {
    const remote = await getSiteContentFromFirestore<GalleryPhoto[]>("gallery_photos");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      if (typeof window !== "undefined") {
        localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(remote));
        window.dispatchEvent(new CustomEvent("src_gallery_updated", { detail: remote }));
      }
      return remote;
    }
  } catch (e) {
    console.warn("Could not sync gallery from Firestore", e);
  }
  return getStoredGalleryPhotos();
}

export function subscribeToGallery(callback: (photos: GalleryPhoto[]) => void): () => void {
  return subscribeToSiteContent<GalleryPhoto[]>("gallery_photos", (remote) => {
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      if (typeof window !== "undefined") {
        localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(remote));
        window.dispatchEvent(new CustomEvent("src_gallery_updated", { detail: remote }));
      }
      callback(remote);
    }
  });
}

export function resetGalleryToDefaults(): GalleryPhoto[] {
  saveStoredGalleryPhotos(initialPhotos);
  return initialPhotos;
}
