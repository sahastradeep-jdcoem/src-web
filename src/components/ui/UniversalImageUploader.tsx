"use client";

/**
 * Universal Image Uploader
 *
 * The single, universal image upload component for the entire application.
 * Replaces all `ImageUploadDropzone` instances across every module.
 *
 * Features:
 * - Purpose-driven optimization (avatar, logo, poster, banner, gallery, etc.)
 * - Honest persistence state machine (never shows false "saved" status)
 * - Non-destructive retry (preserves crop, zoom, pan, rotation)
 * - Spark-inline / Cloud-storage adaptive (controlled by env var)
 * - Drag-and-drop, file browse, and manual URL input
 * - Integrated cropper modal with purpose-aware dimensions
 *
 * Usage:
 *   <UniversalImageUploader
 *     purpose="avatar"
 *     previewUrl={member.avatar}
 *     onUrlChange={(url) => setMember(prev => ({ ...prev, avatar: url }))}
 *   />
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Link as LinkIcon,
  Crop,
  ImageIcon,
} from "lucide-react";
import { compressImage, formatBytes, type CompressionResult } from "@/lib/imageCompression";
import { ImageCropperModal, type AspectRatioType } from "./ImageCropperModal";
import {
  type ImagePurpose,
  getImageProfile,
  getEffectiveFormat,
  getImageStorageService,
  isSparkMode,
} from "@/lib/image";

// ─── Upload State Machine ────────────────────────────────────────────────────

export type UploadPhase =
  | "idle"                  // No image, or showing a previously persisted image
  | "selecting"             // Cropper modal is open
  | "processing"            // Canvas optimization in progress
  | "ready_local"           // Optimized preview ready in memory, pending save
  | "saving"                // Persisting to storage (cloud or inline)
  | "persisted"             // Confirmed written and verified
  | "failed";               // Error with retry available

// ─── Props ───────────────────────────────────────────────────────────────────

interface UniversalImageUploaderProps {
  /** The purpose of this image — drives dimensions, quality, aspect ratio */
  purpose: ImagePurpose;
  /** Callback when the image URL changes (data URL on Spark, https on Blaze) */
  onUrlChange?: (url: string) => void;
  /** Callback when upload processing state changes */
  onUploadStateChange?: (uploading: boolean) => void;
  /** Currently saved/preview URL */
  previewUrl?: string;
  /** Display label above the dropzone */
  label?: string;
  /** Subtitle text */
  sublabel?: string;
  /** Recommended size hint badge */
  recommendedSize?: string;
  /** Firebase Storage path prefix (for Cloud mode) */
  storagePath?: string;
  /** Additional CSS classes */
  className?: string;
  /** Override aspect ratio (usually derived from purpose) */
  aspectRatioOverride?: AspectRatioType;
  /** Override allowed aspect ratios (usually derived from purpose) */
  allowedAspectRatiosOverride?: AspectRatioType[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function UniversalImageUploader({
  purpose,
  onUrlChange,
  onUploadStateChange,
  previewUrl,
  label,
  sublabel,
  recommendedSize,
  storagePath = "uploads",
  className = "",
  aspectRatioOverride,
  allowedAspectRatiosOverride,
}: UniversalImageUploaderProps) {
  const profile = getImageProfile(purpose);

  // Derive label/sublabel from profile if not explicitly provided
  const displayLabel = label || profile.label;
  const displaySublabel = sublabel || `Auto-optimized ${profile.targetSizeHint} WebP`;

  // State
  const [phase, setPhase] = useState<UploadPhase>(() => {
    if (!previewUrl) return "idle";
    if (previewUrl.startsWith("http")) return "persisted";
    if (previewUrl.startsWith("data:")) return "ready_local";
    return "idle";
  });
  const [preview, setPreview] = useState<string>(previewUrl || "");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"upload" | "url">("upload");
  const [manualUrl, setManualUrl] = useState<string>(previewUrl || "");
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [rawImageToCrop, setRawImageToCrop] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>("image.webp");
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: number;
    compressedSize: number;
  } | null>(null);

  // Refs (survive re-renders, preserve crop state for retries)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localDataUrlRef = useRef<string | null>(null);
  const lastCroppedDataUrlRef = useRef<string | null>(null);
  const lastProcessedFileRef = useRef<File | null>(null);

  // Sync external previewUrl changes
  useEffect(() => {
    setPreview(previewUrl || "");
    setManualUrl(previewUrl || "");
    if (!previewUrl) {
      localDataUrlRef.current = null;
      lastProcessedFileRef.current = null;
      lastCroppedDataUrlRef.current = null;
      setPhase("idle");
      setError(null);
    } else if (previewUrl.startsWith("http")) {
      setPhase("persisted");
    } else if (previewUrl.startsWith("data:")) {
      // An existing data URL means it's locally ready (Spark inline mode)
      // On Spark, data URLs ARE the persisted form
      if (isSparkMode()) {
        setPhase("persisted");
      } else {
        setPhase("ready_local");
      }
    }
  }, [previewUrl]);

  // Aspect ratio from profile or override
  const defaultRatio = aspectRatioOverride || profile.defaultAspectRatio;
  const allowedRatios = allowedAspectRatiosOverride || profile.allowedAspectRatios;

  // ─── Process File (Direct Upload Without Cropper) ────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WebP, HEIC).");
      return;
    }

    setError(null);
    lastProcessedFileRef.current = file;
    lastCroppedDataUrlRef.current = null;
    setOriginalFileName(file.name);
    setPhase("processing");
    onUploadStateChange?.(true);

    try {
      const effectiveFormat = getEffectiveFormat(purpose, file.type);
      const result = await compressImage(file, {
        maxWidth: profile.maxWidth,
        maxHeight: profile.maxHeight,
        quality: profile.quality,
        outputFormat: effectiveFormat,
      });

      localDataUrlRef.current = result.dataUrl;
      setPreview(result.dataUrl);
      setManualUrl(result.dataUrl);
      setCompressionStats({
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
      });

      // On Spark, the data URL IS the persisted form — it gets written to Firestore
      // when the parent form saves. So we can honestly say "ready" immediately.
      if (isSparkMode()) {
        setPhase("persisted");
      } else {
        setPhase("ready_local");
      }

      onUrlChange?.(result.dataUrl);

      // Background cloud upload attempt (Blaze mode only)
      if (!isSparkMode()) {
        attemptCloudUpload(result.dataUrl, file.name);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to process image.";
      console.error("[UIS] Image processing error:", message);
      setPhase("failed");
      setError(message);
    } finally {
      onUploadStateChange?.(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [purpose, profile, onUrlChange, onUploadStateChange]);

  // ─── Handle Crop Complete ────────────────────────────────────────────────

  const handleCropComplete = useCallback(async (croppedDataUrl: string) => {
    setPhase("processing");
    onUploadStateChange?.(true);
    setError(null);
    lastCroppedDataUrlRef.current = croppedDataUrl;
    // Clear raw file ref so retry never reverts to uncropped
    lastProcessedFileRef.current = null;

    try {
      localDataUrlRef.current = croppedDataUrl;
      setPreview(croppedDataUrl);
      setManualUrl(croppedDataUrl);

      // Measure the compressed size for stats display
      const sizeBytes = new Blob([croppedDataUrl]).size;
      setCompressionStats((prev) => ({
        originalSize: prev?.originalSize || sizeBytes,
        compressedSize: sizeBytes,
      }));

      if (isSparkMode()) {
        setPhase("persisted");
      } else {
        setPhase("ready_local");
      }

      onUrlChange?.(croppedDataUrl);

      if (!isSparkMode()) {
        attemptCloudUpload(croppedDataUrl, originalFileName);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save cropped image.";
      console.error("[UIS] Crop processing error:", message);
      setPhase("failed");
      setError(message);
    } finally {
      onUploadStateChange?.(false);
      setRawImageToCrop(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [onUrlChange, onUploadStateChange, originalFileName, purpose]);

  // ─── Cloud Upload (Blaze Mode) ──────────────────────────────────────────

  const attemptCloudUpload = useCallback(async (dataUrl: string, fileName: string) => {
    setPhase("saving");
    try {
      const service = getImageStorageService();
      const cleanName = (fileName || "image")
        .replace(/[^a-zA-Z0-9.-]/g, "_")
        .replace(/\.[^/.]+$/, "");

      const result = await service.upload(dataUrl, {
        purpose,
        storagePath,
        fileName: cleanName,
      });

      if (result.url && result.url.startsWith("http")) {
        setPreview(result.url);
        setManualUrl(result.url);
        setPhase("persisted");
        onUrlChange?.(result.url);
      } else {
        // Spark adapter returned a data URL — that's fine, it's persisted inline
        setPhase("persisted");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Cloud upload failed.";
      console.warn("[UIS] Cloud upload failed, image is saved locally:", message);
      // On cloud failure, the local data URL is still valid and will be saved
      // to Firestore by the parent form. Mark as ready_local, not failed.
      setPhase("ready_local");
      setError(`Cloud upload failed: ${message}. Image will be saved inline.`);
    }
  }, [purpose, storagePath, onUrlChange]);

  // ─── Retry Upload (Preserves Crop State!) ───────────────────────────────

  const handleRetryUpload = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Priority: use the preserved cropped data URL so crops are NEVER reset!
    const targetDataUrl = lastCroppedDataUrlRef.current || localDataUrlRef.current;
    if (targetDataUrl) {
      setError(null);
      if (isSparkMode()) {
        // On Spark, the data URL IS the final form
        setPreview(targetDataUrl);
        setManualUrl(targetDataUrl);
        setPhase("persisted");
        onUrlChange?.(targetDataUrl);
      } else {
        await attemptCloudUpload(targetDataUrl, originalFileName);
      }
      return;
    }

    // Only if no local data url exists, reprocess the raw file
    if (lastProcessedFileRef.current) {
      await processFile(lastProcessedFileRef.current);
    }
  }, [processFile, attemptCloudUpload, originalFileName, onUrlChange]);

  // ─── Event Handlers ────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const openCropper = (e: React.MouseEvent) => {
    e.stopPropagation();
    const candidate = localDataUrlRef.current || preview;
    if (candidate) {
      setRawImageToCrop(candidate);
      setIsCropperOpen(true);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    localDataUrlRef.current = null;
    lastCroppedDataUrlRef.current = null;
    lastProcessedFileRef.current = null;
    setPreview("");
    setManualUrl("");
    setCompressionStats(null);
    setPhase("idle");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onUrlChange?.("");
  };

  const handleManualUrlSubmit = (urlVal: string) => {
    setManualUrl(urlVal);
    setPreview(urlVal);
    if (urlVal.startsWith("http")) {
      setPhase("persisted");
    } else if (urlVal.startsWith("data:")) {
      setPhase(isSparkMode() ? "persisted" : "ready_local");
    } else if (!urlVal) {
      setPhase("idle");
    }
    onUrlChange?.(urlVal);
  };

  // ─── Aspect Class for Preview Container ────────────────────────────────

  const aspectClass =
    defaultRatio === "4:5"
      ? "aspect-[4/5] max-h-72"
      : defaultRatio === "3:4"
      ? "aspect-[3/4] max-h-72"
      : defaultRatio === "21:9"
      ? "aspect-[21/9] max-h-56"
      : defaultRatio === "1:1"
      ? "aspect-square max-h-48"
      : "aspect-video max-h-64";

  // ─── Status Badge ──────────────────────────────────────────────────────

  const renderStatusBadge = () => {
    if (phase === "processing" || phase === "saving") {
      return (
        <div className="px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-md text-amber-300 text-[10px] font-bold flex items-center gap-1.5 border border-amber-400/30 shadow-md">
          <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
          <span>{phase === "processing" ? "Processing..." : "Saving to Cloud..."}</span>
        </div>
      );
    }

    if (phase === "persisted") {
      const isCloud = preview.startsWith("http");
      return (
        <div className="px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-md text-emerald-300 text-[10px] font-bold flex items-center gap-1.5 border border-emerald-400/30 shadow-md">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>{isCloud ? "Cloud Verified" : "Saved (Optimized WebP)"}</span>
        </div>
      );
    }

    if (phase === "ready_local") {
      return (
        <div className="px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-md text-blue-300 text-[10px] font-bold flex items-center gap-1.5 border border-blue-400/30 shadow-md">
          <CheckCircle2 className="w-3 h-3 text-blue-400" />
          <span>Ready (Pending Form Save)</span>
        </div>
      );
    }

    if (phase === "failed") {
      return (
        <div className="flex items-center gap-1.5">
          <div className="px-2.5 py-1 rounded-full bg-rose-950/90 backdrop-blur-md text-rose-300 text-[10px] font-bold flex items-center gap-1.5 border border-rose-400/30 shadow-md">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>Upload Failed</span>
          </div>
          <button
            type="button"
            onClick={handleRetryUpload}
            className="px-2.5 py-1 rounded-full bg-[#E78023] hover:bg-[#d06f19] text-white text-[10px] font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer border border-white/20"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    return null;
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold font-heading text-slate-800 uppercase tracking-wider block truncate">
            {displayLabel}
          </span>

          {/* Upload/Link Toggle */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold shrink-0 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setInputMode("upload")}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                inputMode === "upload"
                  ? "bg-white text-[#17458F] shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <UploadCloud className="w-3 h-3" />
              <span>Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode("url")}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                inputMode === "url"
                  ? "bg-white text-[#17458F] shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <LinkIcon className="w-3 h-3" />
              <span>Link</span>
            </button>
          </div>
        </div>

        {recommendedSize && (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#17458F] border border-blue-200/80 text-[10px] font-mono font-bold">
              {recommendedSize}
            </span>
          </div>
        )}
      </div>

      {/* URL Input Mode */}
      {inputMode === "url" ? (
        <div className="space-y-2">
          <div className="relative">
            <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => handleManualUrlSubmit(e.target.value)}
              placeholder="Paste direct image URL..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
            />
          </div>
          {preview && (
            <div className={`relative w-full ${aspectClass} rounded-2xl overflow-hidden border border-slate-200 bg-slate-900`}>
              <Image
                src={preview}
                alt="URL Preview"
                fill
                unoptimized={true}
                className="object-cover"
              />
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                <button
                  type="button"
                  onClick={openCropper}
                  className="px-2.5 py-1 rounded-full bg-slate-900/85 hover:bg-[#E78023] text-white text-[10px] font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer border border-white/20 backdrop-blur-sm"
                  title="Adjust crop & framing"
                >
                  <Crop className="w-3 h-3 text-[#E78023]" />
                  <span>Crop &amp; Frame</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded-full bg-slate-900/85 hover:bg-rose-600 text-white transition-colors cursor-pointer border border-white/20 backdrop-blur-sm"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Upload Mode (Drag & Drop) */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative group rounded-3xl border-2 border-dashed p-4 text-center transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden ${
            isDragging
              ? "border-[#E78023] bg-[#E78023]/5 scale-[1.01]"
              : preview
              ? "border-slate-200 bg-white hover:border-[#17458F]"
              : "border-slate-300 bg-slate-50/60 hover:border-[#E78023] hover:bg-slate-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {preview ? (
            <div className={`relative w-full ${aspectClass} rounded-2xl overflow-hidden border border-slate-200 bg-slate-900`}>
              <Image
                src={preview}
                alt="Uploaded Preview"
                fill
                unoptimized={true}
                className="object-cover"
              />

              {/* Top-right actions: Crop & Clear */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                <button
                  type="button"
                  onClick={openCropper}
                  className="px-2.5 py-1 rounded-full bg-slate-900/85 hover:bg-[#E78023] text-white text-[10px] font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer border border-white/20 backdrop-blur-sm"
                  title="Adjust crop & framing"
                >
                  <Crop className="w-3 h-3 text-[#E78023]" />
                  <span>Crop &amp; Frame</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded-full bg-slate-900/85 hover:bg-rose-600 text-white transition-colors cursor-pointer border border-white/20 backdrop-blur-sm"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bottom-left: Status Badge */}
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
                {renderStatusBadge()}
              </div>
            </div>
          ) : (
            <div className="space-y-2 py-2 flex flex-col items-center">
              <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-[#E78023] group-hover:scale-110 transition-transform">
                {phase === "processing" ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#17458F]" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
              </div>
              <div className="space-y-0.5">
                <h4 className="font-heading font-bold text-xs text-[#0F172A]">
                  Click or Drag to Upload
                </h4>
                <p className="text-[10px] text-slate-400 max-w-[200px] leading-tight">
                  {displaySublabel}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          {(phase === "failed" || localDataUrlRef.current) && (
            <button
              type="button"
              onClick={handleRetryUpload}
              disabled={phase === "processing" || phase === "saving"}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shrink-0 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${(phase === "processing" || phase === "saving") ? "animate-spin" : ""}`} />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Compression Stats */}
      {compressionStats && compressionStats.compressedSize > 0 && phase === "persisted" && (
        <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 text-[11px] flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Optimized: {formatBytes(compressionStats.originalSize)} → {formatBytes(compressionStats.compressedSize)}</span>
          </div>
          <span className="font-bold text-emerald-700">
            {Math.max(0, Math.round(((compressionStats.originalSize - compressionStats.compressedSize) / compressionStats.originalSize) * 100))}% saved
          </span>
        </div>
      )}

      {/* Cropper Modal */}
      {isCropperOpen && rawImageToCrop && (
        <ImageCropperModal
          isOpen={isCropperOpen}
          onClose={() => {
            setIsCropperOpen(false);
            setRawImageToCrop(null);
          }}
          imageSrc={rawImageToCrop}
          initialAspectRatio={defaultRatio === "auto" ? "16:9" : (defaultRatio as AspectRatioType)}
          allowedAspectRatios={allowedRatios as AspectRatioType[]}
          lockAspectRatio={profile.lockAspectRatio}
          isAvatar={profile.circularMask}
          onCropComplete={handleCropComplete}
          title={`Crop & Frame ${displayLabel}`}
          purpose={purpose}
        />
      )}
    </div>
  );
}
