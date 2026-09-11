/**
 * Universal Image System — Public API
 *
 * Import everything from '@/lib/image' instead of reaching into sub-modules.
 */

export type { ImagePurpose, ImageProfile } from "./imageProfiles";
export { IMAGE_PROFILES, getImageProfile, getEffectiveFormat, getExportDimensions } from "./imageProfiles";

export type {
  StorageMode,
  ImageUploadOptions,
  ImageUploadResult,
  IImageStorageAdapter,
} from "./imageStorageService";
export {
  getImageStorageService,
  getCurrentStorageMode,
  isSparkMode,
} from "./imageStorageService";
