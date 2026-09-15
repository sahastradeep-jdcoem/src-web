import { 
  getSiteContentFromFirestore, 
  saveSiteContentToFirestore, 
  getAllEventsFromFirestore, 
  saveEventToFirestore 
} from "./firestore";
import { uploadBase64ToCloudStorage } from "@/lib/image/imageStorageService";
import { saveStoredCouncilMembers, saveStoredClubs } from "@/lib/councilStore";
import { saveStoredEvents } from "@/lib/eventsStore";
import { saveStoredGalleryPhotos } from "@/lib/galleryStore";
import { saveStoredHeroSettings } from "@/lib/heroStore";

export interface MigrationScanReport {
  scannedAt: string;
  totalImages: number;
  cloudImages: number;
  base64Images: number;
  base64BytesApprox: number;
  breakdown: {
    council: { cloud: number; base64: number };
    clubs: { cloud: number; base64: number };
    events: { cloud: number; base64: number };
    gallery: { cloud: number; base64: number };
    hero: { cloud: number; base64: number };
    departments: { cloud: number; base64: number };
  };
}

export interface MigrationProgress {
  phase: "scanning" | "migrating" | "completed" | "error";
  totalToMigrate: number;
  migratedCount: number;
  currentEntity: string;
  bytesSaved: number;
  errorMessage?: string;
}

const isBase64 = (val?: unknown): val is string => 
  typeof val === "string" && val.startsWith("data:image/");

const isCloudUrl = (val?: unknown): boolean => 
  typeof val === "string" && (val.startsWith("http://") || val.startsWith("https://"));

/**
 * Scan all Firestore datasets for legacy Base64 vs. Cloud Storage CDN images.
 */
export async function scanFirestoreImageStorage(): Promise<MigrationScanReport> {
  const report: MigrationScanReport = {
    scannedAt: new Date().toISOString(),
    totalImages: 0,
    cloudImages: 0,
    base64Images: 0,
    base64BytesApprox: 0,
    breakdown: {
      council: { cloud: 0, base64: 0 },
      clubs: { cloud: 0, base64: 0 },
      events: { cloud: 0, base64: 0 },
      gallery: { cloud: 0, base64: 0 },
      hero: { cloud: 0, base64: 0 },
      departments: { cloud: 0, base64: 0 },
    },
  };

  const inspect = (category: keyof typeof report.breakdown, url?: string) => {
    if (!url) return;
    report.totalImages++;
    if (isCloudUrl(url)) {
      report.cloudImages++;
      report.breakdown[category].cloud++;
    } else if (isBase64(url)) {
      report.base64Images++;
      report.breakdown[category].base64++;
      report.base64BytesApprox += url.length;
    }
  };

  try {
    // 1. Council
    const council = await getSiteContentFromFirestore<any[]>("council");
    if (Array.isArray(council)) {
      council.forEach((m) => inspect("council", m.avatar));
    }

    // 2. Clubs
    const clubs = await getSiteContentFromFirestore<any[]>("clubs");
    if (Array.isArray(clubs)) {
      clubs.forEach((c) => {
        inspect("clubs", c.logoImage);
        inspect("clubs", c.cardImage);
        inspect("clubs", c.headerImage);
        inspect("clubs", c.heroImage);
        if (Array.isArray(c.galleryImages)) {
          c.galleryImages.forEach((g: string) => inspect("clubs", g));
        }
        if (Array.isArray(c.leaders)) {
          c.leaders.forEach((l: any) => inspect("clubs", l.avatar));
        }
      });
    }

    // 3. Events
    const events = await getAllEventsFromFirestore();
    if (Array.isArray(events)) {
      events.forEach((e) => {
        inspect("events", e.poster);
        inspect("events", e.cardImage);
        inspect("events", e.posterImage);
        inspect("events", e.headerImage);
      });
    }

    // 4. Gallery
    const gallery = await getSiteContentFromFirestore<any[]>("gallery");
    if (Array.isArray(gallery)) {
      gallery.forEach((g) => inspect("gallery", g.url || g.imageUrl));
    }

    // 5. Hero Settings
    const hero = await getSiteContentFromFirestore<any>("hero");
    if (hero?.backgroundImage) inspect("hero", hero.backgroundImage);
    if (Array.isArray(hero?.presets)) {
      hero.presets.forEach((p: any) => inspect("hero", p.backgroundImage));
    }

    // 6. Departments
    const depts = await getSiteContentFromFirestore<any[]>("departments");
    if (Array.isArray(depts)) {
      depts.forEach((d) => {
        inspect("departments", d.coverImage);
        inspect("departments", d.headerImage);
      });
    }
  } catch (err) {
    console.warn("Storage scan error notice:", err);
  }

  return report;
}

/**
 * Execute full automatic migration of all Base64 images to Firebase Cloud Storage.
 */
export async function migrateAllLegacyImages(
  onProgress?: (progress: MigrationProgress) => void
): Promise<{ success: boolean; migratedCount: number; bytesSaved: number; error?: string }> {
  let migratedCount = 0;
  let bytesSaved = 0;

  try {
    // Phase 1: Council Avatars
    onProgress?.({
      phase: "migrating",
      totalToMigrate: 100,
      migratedCount,
      currentEntity: "Council Member Portraits",
      bytesSaved,
    });

    const council = await getSiteContentFromFirestore<any[]>("council");
    if (Array.isArray(council)) {
      let councilModified = false;
      for (const m of council) {
        if (isBase64(m.avatar)) {
          const path = `council/avatars/${m.id || Date.now()}.webp`;
          const cdnUrl = await uploadBase64ToCloudStorage(m.avatar, path);
          bytesSaved += m.avatar.length;
          m.avatar = cdnUrl;
          migratedCount++;
          councilModified = true;
          onProgress?.({
            phase: "migrating",
            totalToMigrate: 100,
            migratedCount,
            currentEntity: `Council Member: ${m.name || m.id}`,
            bytesSaved,
          });
        }
      }
      if (councilModified) {
        await saveSiteContentToFirestore("council", council);
        saveStoredCouncilMembers(council);
      }
    }

    // Phase 2: Clubs
    onProgress?.({
      phase: "migrating",
      totalToMigrate: 100,
      migratedCount,
      currentEntity: "Clubs & Departments Media",
      bytesSaved,
    });

    const clubs = await getSiteContentFromFirestore<any[]>("clubs");
    if (Array.isArray(clubs)) {
      let clubsModified = false;
      for (const c of clubs) {
        const slug = c.slug || c.id || "club";
        if (isBase64(c.logoImage)) {
          c.logoImage = await uploadBase64ToCloudStorage(c.logoImage, `clubs/${slug}/logo_${Date.now()}.webp`);
          migratedCount++;
          clubsModified = true;
        }
        if (isBase64(c.cardImage)) {
          c.cardImage = await uploadBase64ToCloudStorage(c.cardImage, `clubs/${slug}/card_${Date.now()}.webp`);
          migratedCount++;
          clubsModified = true;
        }
        if (isBase64(c.headerImage)) {
          c.headerImage = await uploadBase64ToCloudStorage(c.headerImage, `clubs/${slug}/header_${Date.now()}.webp`);
          migratedCount++;
          clubsModified = true;
        }
        if (isBase64(c.heroImage)) {
          c.heroImage = await uploadBase64ToCloudStorage(c.heroImage, `clubs/${slug}/hero_${Date.now()}.webp`);
          migratedCount++;
          clubsModified = true;
        }
        if (Array.isArray(c.leaders)) {
          for (const l of c.leaders) {
            if (isBase64(l.avatar)) {
              l.avatar = await uploadBase64ToCloudStorage(l.avatar, `clubs/${slug}/leaders/${l.btId || Date.now()}.webp`);
              migratedCount++;
              clubsModified = true;
            }
          }
        }
        onProgress?.({
          phase: "migrating",
          totalToMigrate: 100,
          migratedCount,
          currentEntity: `Club: ${c.name || slug}`,
          bytesSaved,
        });
      }
      if (clubsModified) {
        await saveSiteContentToFirestore("clubs", clubs);
        saveStoredClubs(clubs);
      }
    }

    // Phase 3: Events
    onProgress?.({
      phase: "migrating",
      totalToMigrate: 100,
      migratedCount,
      currentEntity: "Events & Competitions Posters",
      bytesSaved,
    });

    const events = await getAllEventsFromFirestore();
    if (Array.isArray(events)) {
      const updatedEvents: any[] = [];
      for (const rawE of events) {
        const e = rawE as any;
        let eventModified = false;
        const eventId = e.id || e.slug || "event";
        if (isBase64(e.poster)) {
          e.poster = await uploadBase64ToCloudStorage(e.poster, `events/${eventId}/poster_${Date.now()}.webp`);
          migratedCount++;
          eventModified = true;
        }
        if (isBase64(e.cardImage)) {
          e.cardImage = await uploadBase64ToCloudStorage(e.cardImage, `events/${eventId}/card_${Date.now()}.webp`);
          migratedCount++;
          eventModified = true;
        }
        if (isBase64(e.posterImage)) {
          e.posterImage = await uploadBase64ToCloudStorage(e.posterImage, `events/${eventId}/poster_large_${Date.now()}.webp`);
          migratedCount++;
          eventModified = true;
        }
        if (isBase64(e.headerImage)) {
          e.headerImage = await uploadBase64ToCloudStorage(e.headerImage, `events/${eventId}/header_${Date.now()}.webp`);
          migratedCount++;
          eventModified = true;
        }
        if (eventModified) {
          await saveEventToFirestore(e);
        }
        updatedEvents.push(e);
        onProgress?.({
          phase: "migrating",
          totalToMigrate: 100,
          migratedCount,
          currentEntity: `Event: ${e.title || e.name || eventId}`,
          bytesSaved,
        });
      }
      saveStoredEvents(updatedEvents);
    }

    // Phase 4: Gallery
    onProgress?.({
      phase: "migrating",
      totalToMigrate: 100,
      migratedCount,
      currentEntity: "Campus Showcase Gallery",
      bytesSaved,
    });

    const gallery = await getSiteContentFromFirestore<any[]>("gallery");
    if (Array.isArray(gallery)) {
      let galleryModified = false;
      for (const g of gallery) {
        const photoUrl = g.url || g.imageUrl;
        if (isBase64(photoUrl)) {
          const cdn = await uploadBase64ToCloudStorage(photoUrl, `gallery/photos/${g.id || Date.now()}.webp`);
          g.url = cdn;
          if (g.imageUrl) g.imageUrl = cdn;
          migratedCount++;
          galleryModified = true;
        }
      }
      if (galleryModified) {
        await saveSiteContentToFirestore("gallery", gallery);
        saveStoredGalleryPhotos(gallery);
      }
    }

    // Phase 5: Hero Settings
    const hero = await getSiteContentFromFirestore<any>("hero");
    if (hero) {
      let heroModified = false;
      if (isBase64(hero.backgroundImage)) {
        hero.backgroundImage = await uploadBase64ToCloudStorage(hero.backgroundImage, `hero/active_hero_${Date.now()}.webp`);
        migratedCount++;
        heroModified = true;
      }
      if (Array.isArray(hero.presets)) {
        for (const p of hero.presets) {
          if (isBase64(p.backgroundImage)) {
            p.backgroundImage = await uploadBase64ToCloudStorage(p.backgroundImage, `hero/presets/${p.id || Date.now()}.webp`);
            migratedCount++;
            heroModified = true;
          }
        }
      }
      if (heroModified) {
        await saveSiteContentToFirestore("hero", hero);
        saveStoredHeroSettings(hero);
      }
    }

    onProgress?.({
      phase: "completed",
      totalToMigrate: migratedCount,
      migratedCount,
      currentEntity: "Migration Complete!",
      bytesSaved,
    });

    return {
      success: true,
      migratedCount,
      bytesSaved,
    };
  } catch (error: any) {
    console.error("Migration error:", error);
    onProgress?.({
      phase: "error",
      totalToMigrate: 0,
      migratedCount,
      currentEntity: "Migration Stopped",
      bytesSaved,
      errorMessage: error?.message || "Failed to complete migration",
    });
    return {
      success: false,
      migratedCount,
      bytesSaved,
      error: error?.message || "Migration failed",
    };
  }
}
