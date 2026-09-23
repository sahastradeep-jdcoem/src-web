import { getSiteContentFromFirestore } from "@/lib/firebase/firestore";
import { HeroSettings, DEFAULT_HERO_SETTINGS } from "./heroSettings";

export const SITE_URL = "https://www.srcjdcoem.in";
export const DEFAULT_OG_IMAGE_URL = "https://www.srcjdcoem.in/og-image.png";
export const DEFAULT_OG_IMAGE_ALT = "SAHASTRADEEP - SRC JDCOEM | Student Representative Council";

export const DEFAULT_OG_IMAGE = {
  url: DEFAULT_OG_IMAGE_URL,
  secureUrl: DEFAULT_OG_IMAGE_URL,
  width: 1200,
  height: 630,
  type: "image/png",
  alt: DEFAULT_OG_IMAGE_ALT,
};

export const DEFAULT_OG_IMAGES = [DEFAULT_OG_IMAGE];
export const DEFAULT_TWITTER_IMAGES = [DEFAULT_OG_IMAGE_URL];

/**
 * Dynamically resolves OpenGraph and Twitter card metadata directly from
 * hero settings in Firestore. If the admin uploaded a custom banner,
 * it serves that banner URL. Otherwise, falls back to the official default card.
 */
export async function getHeroOgMetadata() {
  let heroSettings: HeroSettings | null = null;
  try {
    heroSettings = await getSiteContentFromFirestore<HeroSettings>("hero_settings");
  } catch (err) {
    console.warn("[seoMetadata] Could not load hero_settings:", err);
  }

  const merged = { ...DEFAULT_HERO_SETTINGS, ...(heroSettings || {}) };

  const ogTitle = (merged.ogTitle || "").trim() || "Sahastradeep - SRC JDCOEM";
  const ogDescription =
    (merged.ogDescription || "").trim() ||
    merged.heroTagline ||
    "Official portal of SRC JDCOEM Nagpur. Flagship fests, 12 chartered clubs, and digital delegate passes.";

  let ogImageUrl = DEFAULT_OG_IMAGE_URL;
  const rawOgImageUrl = (merged.ogImageUrl || "").trim();

  if (rawOgImageUrl.startsWith("http")) {
    ogImageUrl = rawOgImageUrl;
  } else if (rawOgImageUrl.startsWith("data:image")) {
    ogImageUrl = "https://www.srcjdcoem.in/opengraph-image";
  }

  const ogImage = {
    url: ogImageUrl,
    secureUrl: ogImageUrl,
    width: 1200,
    height: 630,
    type: ogImageUrl.endsWith(".png") ? "image/png" : "image/jpeg",
    alt: ogTitle,
  };

  return {
    ogTitle,
    ogDescription,
    ogImageUrl,
    ogImage,
    ogImages: [ogImage],
    twitterImages: [ogImageUrl],
  };
}
