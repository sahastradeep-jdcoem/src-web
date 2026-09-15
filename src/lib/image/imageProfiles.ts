/**
 * Universal Image System — Purpose-Based Optimization Profiles
 *
 * Every image upload in the application declares a purpose. The purpose determines
 * the target dimensions, quality level, format, and aspect ratio constraints.
 *
 * On Firebase Spark (current), images are stored as inline base64 WebP data URLs
 * directly inside Firestore documents. The profiles are tuned to produce compact,
 * high-density images that look razor-sharp on Retina displays while staying well
 * within Firestore's 1MB document limit.
 *
 * On Firebase Blaze (future), the same profiles will produce binary blobs streamed
 * to Cloud Storage, so the sizing is generous enough for CDN delivery.
 */

import type { AspectRatioType } from "@/components/ui/ImageCropperModal";

// ─── Purpose Enum ────────────────────────────────────────────────────────────

export type ImagePurpose =
  | "avatar"
  | "logo"
  | "eventPoster"
  | "cardCover"
  | "banner"
  | "gallery"
  | "thumbnail";

// ─── Profile Shape ───────────────────────────────────────────────────────────

export interface ImageProfile {
  /** Human-readable label for UI display */
  label: string;
  /** Maximum output width in pixels */
  maxWidth: number;
  /** Maximum output height in pixels */
  maxHeight: number;
  /** WebP/JPEG quality factor (0.0 – 1.0) */
  quality: number;
  /** Preferred output MIME type */
  format: "image/webp" | "image/png" | "image/jpeg";
  /** Whether to preserve PNG transparency (logos, insignias) */
  preserveTransparency: boolean;
  /** Default aspect ratio for the cropper */
  defaultAspectRatio: AspectRatioType;
  /** Aspect ratios the user is allowed to pick in the cropper */
  allowedAspectRatios: AspectRatioType[];
  /** Lock the cropper to defaultAspectRatio only */
  lockAspectRatio: boolean;
  /** Show circular mask in cropper (for avatars, logos) */
  circularMask: boolean;
  /** Approximate target file size range for Spark inline storage (informational) */
  targetSizeHint: string;
  /** Maximum safe byte length for inline base64 storage in Firestore */
  maxInlineBytes: number;
}

// ─── Profile Definitions (Blaze Cloud Storage Optimized) ───────────────────

/**
 * At 800×1000 (4:5) or 800×800 (1:1) at quality 0.88, portrait avatars deliver
 * high-fidelity facial details, sharp skin/hair textures, and crisp definition on Retina screens.
 */
const AVATAR_PROFILE: ImageProfile = {
  label: "Portrait Photo",
  maxWidth: 800,
  maxHeight: 1000,
  quality: 0.88,
  format: "image/webp",
  preserveTransparency: false,
  defaultAspectRatio: "4:5",
  allowedAspectRatios: ["4:5", "3:4", "1:1", "free"],
  lockAspectRatio: false,
  circularMask: false,
  targetSizeHint: "Cloud CDN High-Density Retina WebP",
  maxInlineBytes: 150_000,
};

/**
 * Club logos and insignias preserve sharp vector-like edges and alpha channel transparency.
 */
const LOGO_PROFILE: ImageProfile = {
  label: "Club Logo / Insignia",
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.95,
  format: "image/webp",
  preserveTransparency: true,
  defaultAspectRatio: "1:1",
  allowedAspectRatios: ["1:1", "free"],
  lockAspectRatio: false,
  circularMask: true,
  targetSizeHint: "Ultra-Sharp Alpha WebP/PNG",
  maxInlineBytes: 120_000,
};

/**
 * Event posters contain fine typography, dates, sponsor logos, and QR codes.
 * Higher dimensions (1440×1920) and 0.90 quality keep fine graphics and text perfectly legible on all devices.
 */
const EVENT_POSTER_PROFILE: ImageProfile = {
  label: "Event Poster",
  maxWidth: 1440,
  maxHeight: 1920,
  quality: 0.90,
  format: "image/webp",
  preserveTransparency: false,
  defaultAspectRatio: "3:4",
  allowedAspectRatios: ["3:4", "4:5", "16:9", "1:1", "free"],
  lockAspectRatio: false,
  circularMask: false,
  targetSizeHint: "Cloud CDN Ultra-HD Event Poster",
  maxInlineBytes: 250_000,
};

const CARD_COVER_PROFILE: ImageProfile = {
  label: "Card Cover Image",
  maxWidth: 1200,
  maxHeight: 675,
  quality: 0.88,
  format: "image/webp",
  preserveTransparency: false,
  defaultAspectRatio: "16:9",
  allowedAspectRatios: ["16:9", "4:5", "3:4", "1:1", "21:9", "free"],
  lockAspectRatio: false,
  circularMask: false,
  targetSizeHint: "Crisp High-Density Card Cover",
  maxInlineBytes: 180_000,
};

const BANNER_PROFILE: ImageProfile = {
  label: "Hero / Header Banner",
  maxWidth: 1920,
  maxHeight: 820,
  quality: 0.88,
  format: "image/webp",
  preserveTransparency: false,
  defaultAspectRatio: "21:9",
  allowedAspectRatios: ["21:9", "16:9", "free"],
  lockAspectRatio: false,
  circularMask: false,
  targetSizeHint: "Cinematic 1080p Ultra-Wide Banner",
  maxInlineBytes: 250_000,
};

const GALLERY_PROFILE: ImageProfile = {
  label: "Gallery Photo",
  maxWidth: 1920,
  maxHeight: 1280,
  quality: 0.90,
  format: "image/webp",
  preserveTransparency: false,
  defaultAspectRatio: "16:9",
  allowedAspectRatios: ["16:9", "4:5", "3:4", "1:1", "21:9", "free"],
  lockAspectRatio: false,
  circularMask: false,
  targetSizeHint: "Showcase Full-HD Photography",
  maxInlineBytes: 250_000,
};

const THUMBNAIL_PROFILE: ImageProfile = {
  label: "Thumbnail Icon",
  maxWidth: 256,
  maxHeight: 256,
  quality: 0.85,
  format: "image/webp",
  preserveTransparency: false,
  defaultAspectRatio: "1:1",
  allowedAspectRatios: ["1:1"],
  lockAspectRatio: true,
  circularMask: true,
  targetSizeHint: "Sharp Icon Thumbnail",
  maxInlineBytes: 35_000,
};

// ─── Profile Registry ────────────────────────────────────────────────────────

export const IMAGE_PROFILES: Record<ImagePurpose, ImageProfile> = {
  avatar: AVATAR_PROFILE,
  logo: LOGO_PROFILE,
  eventPoster: EVENT_POSTER_PROFILE,
  cardCover: CARD_COVER_PROFILE,
  banner: BANNER_PROFILE,
  gallery: GALLERY_PROFILE,
  thumbnail: THUMBNAIL_PROFILE,
} as const;

/**
 * Retrieve the image profile for a given purpose.
 * Throws on unknown purpose to catch configuration errors early.
 */
export function getImageProfile(purpose: ImagePurpose): ImageProfile {
  const profile = IMAGE_PROFILES[purpose];
  if (!profile) {
    throw new Error(`[UIS] Unknown image purpose: "${purpose}". Valid: ${Object.keys(IMAGE_PROFILES).join(", ")}`);
  }
  return profile;
}

/**
 * Determine the effective output format based on purpose profile and source MIME type.
 * Logos and insignias preserve PNG transparency; everything else exports as WebP.
 */
export function getEffectiveFormat(
  purpose: ImagePurpose,
  sourceMimeType?: string
): "image/webp" | "image/png" {
  const profile = getImageProfile(purpose);
  if (profile.preserveTransparency && sourceMimeType?.includes("png")) {
    return "image/png";
  }
  return "image/webp";
}

/**
 * Calculate the target export dimensions for the cropper canvas,
 * respecting the purpose profile's maximum dimensions and the chosen aspect ratio.
 */
export function getExportDimensions(
  purpose: ImagePurpose,
  aspectRatio: number // width / height
): { width: number; height: number } {
  const profile = getImageProfile(purpose);

  if (aspectRatio >= 1) {
    // Landscape or square: constrain by maxWidth
    const width = Math.min(profile.maxWidth, Math.round(profile.maxHeight * aspectRatio));
    const height = Math.round(width / aspectRatio);
    return { width, height };
  } else {
    // Portrait: constrain by maxHeight
    const height = Math.min(profile.maxHeight, Math.round(profile.maxWidth / aspectRatio));
    const width = Math.round(height * aspectRatio);
    return { width, height };
  }
}
