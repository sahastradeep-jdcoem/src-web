"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { UploadCloud, CheckCircle2, Sparkles, AlertCircle, RefreshCw, X, Link as LinkIcon, Image as ImageIcon, Crop, Move } from "lucide-react";
import { compressImage, formatBytes, CompressionResult } from "@/lib/imageCompression";
import { uploadImageToStorage } from "@/lib/firebase/storage";
import { ImageCropperModal, AspectRatioType } from "./ImageCropperModal";

interface ImageUploadDropzoneProps {
  onImageCompressed?: (result: CompressionResult) => void;
  onUrlChange?: (url: string) => void;
  onUploadStateChange?: (uploading: boolean) => void;
  label?: string;
  sublabel?: string;
  recommendedSize?: string;
  aspectRatio?: "16:9" | "3:4" | "4:5" | "21:9" | "1:1" | "auto";
  allowedAspectRatios?: AspectRatioType[];
  lockAspectRatio?: boolean;
  previewUrl?: string;
  storagePath?: string;
  className?: string;
  isAvatar?: boolean;
}

export function ImageUploadDropzone({
  onImageCompressed,
  onUrlChange,
  onUploadStateChange,
  label = "Upload Photo",
  sublabel = "Auto-compressed to high-speed WebP format",
  recommendedSize,
  aspectRatio = "16:9",
  allowedAspectRatios,
  lockAspectRatio,
  previewUrl,
  storagePath = "uploads",
  className = "",
  isAvatar,
}: ImageUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "cloud_synced" | "upload_failed">(
    previewUrl && previewUrl.startsWith("http") ? "cloud_synced" : previewUrl && previewUrl.startsWith("data:") ? "upload_failed" : "idle"
  );
  const [compressionStats, setCompressionStats] = useState<CompressionResult | null>(null);
  const [preview, setPreview] = useState<string>(previewUrl || "");
  const [inputMode, setInputMode] = useState<"upload" | "url">("upload");
  const [manualUrl, setManualUrl] = useState<string>(previewUrl || "");
  const [error, setError] = useState<string | null>(null);
  const [rawImageToCrop, setRawImageToCrop] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string>("image.webp");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localDataUrlRef = useRef<string | null>(null);
  const lastProcessedFileRef = useRef<File | null>(null);
  const lastCroppedDataUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setPreview(previewUrl || "");
    setManualUrl(previewUrl || "");
    if (!previewUrl) {
      localDataUrlRef.current = null;
      lastProcessedFileRef.current = null;
      lastCroppedDataUrlRef.current = null;
      setUploadStatus("idle");
    } else if (previewUrl.startsWith("http")) {
      setUploadStatus("cloud_synced");
    } else if (previewUrl.startsWith("data:")) {
      setUploadStatus("upload_failed");
    }
  }, [previewUrl]);

  const getOptimalResolution = (ratio: string, path: string) => {
    const isSquare = ratio === "1:1";
    const isBanner = ratio === "21:9";
    const isPoster = ratio === "4:5" || ratio === "3:4";
    const isGallery = path.toLowerCase().includes("gallery");

    if (isSquare) {
      // 512x512 for logos, circular seals, profile avatars (high-DPI, ~35-50KB)
      return { maxWidth: 512, maxHeight: 512, quality: 0.90 };
    }
    if (isBanner) {
      // 1920x822 for wide cinematic banners across desktop screens (~180-260KB)
      return { maxWidth: 1920, maxHeight: 822, quality: 0.86 };
    }
    if (isPoster) {
      // 1200x1600 for vertical event posters and story formats (~160-240KB)
      return { maxWidth: 1200, maxHeight: 1600, quality: 0.86 };
    }
    if (isGallery) {
      // 1920x1280 for gallery photography and full-screen lightboxes (~200-350KB)
      return { maxWidth: 1920, maxHeight: 1280, quality: 0.88 };
    }
    // 1600x900 for directory cards, event cards, showcases (~150-220KB)
    return { maxWidth: 1600, maxHeight: 900, quality: 0.86 };
  };

  const processFileDirectly = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WebP, SVG, HEIC).");
      return;
    }
    setError(null);
    lastProcessedFileRef.current = file;
    lastCroppedDataUrlRef.current = null;
    setOriginalFileName(file.name);
    setIsProcessing(true);
    setUploadStatus("uploading");
    onUploadStateChange?.(true);

    try {
      // 1. Instant high-fidelity local optimization and state sync so the photo is NEVER lost
      const isPngOrSvg = file.type === "image/png" || file.type === "image/svg+xml";
      const isAvatar = storagePath.includes("avatars") || storagePath.includes("pillars") || storagePath.includes("leads") || aspectRatio === "1:1" || aspectRatio === "4:5";

      const immediateOptimized = await compressImage(file, {
        maxWidth: isAvatar ? (aspectRatio === "1:1" ? 400 : 480) : 1200,
        maxHeight: isAvatar ? (aspectRatio === "1:1" ? 400 : 600) : 800,
        quality: isAvatar ? 0.82 : 0.84,
        outputFormat: isPngOrSvg ? "image/png" : "image/webp",
      });

      localDataUrlRef.current = immediateOptimized.dataUrl;
      setPreview(immediateOptimized.dataUrl);
      setManualUrl(immediateOptimized.dataUrl);

      // 2. Upload file to Firebase Cloud Storage with honest verification
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.[^/.]+$/, "");
      const ext = isPngOrSvg ? ".png" : ".webp";
      const finalStoragePath = `${storagePath}/${Date.now()}_${cleanName}${ext}`;

      try {
        // Upload the high-density optimized WebP (~80KB) rather than a multi-megabyte camera file to prevent network timeouts
        const cloudUrl = await uploadImageToStorage(immediateOptimized.dataUrl, finalStoragePath, { throwOnError: true });
        if (cloudUrl && cloudUrl.startsWith("http")) {
          setPreview(cloudUrl);
          setManualUrl(cloudUrl);
          setUploadStatus("cloud_synced");
          setError(null);
          if (onUrlChange) {
            onUrlChange(cloudUrl);
          }
        } else {
          throw new Error("Storage service did not return an accessible cloud URL.");
        }
      } catch (uploadErr: any) {
        console.warn("Cloud storage upload notice:", uploadErr);
        setUploadStatus("upload_failed");
        setError(`⚠️ Cloud Upload Failed: Unable to store image in cloud storage (${uploadErr?.message || "network error"}). You can retry the upload.`);
        // Pass local optimized WebP so work is not lost, but keep honest failed status in UI
        if (onUrlChange) {
          onUrlChange(immediateOptimized.dataUrl);
        }
      }
    } catch (err: any) {
      console.error("Image direct processing error", err);
      setUploadStatus("upload_failed");
      setError(err?.message || "Failed to process image.");
    } finally {
      setIsProcessing(false);
      onUploadStateChange?.(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFileDirectly(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFileDirectly(file);
    }
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    setIsProcessing(true);
    setUploadStatus("uploading");
    onUploadStateChange?.(true);
    setError(null);
    lastCroppedDataUrlRef.current = croppedDataUrl;
    // CRITICAL: Clear lastProcessedFileRef so retry NEVER reverts to raw uncropped file!
    lastProcessedFileRef.current = null;

    try {
      // 1. Immediately sync cropped image to state
      localDataUrlRef.current = croppedDataUrl;
      setPreview(croppedDataUrl);
      setManualUrl(croppedDataUrl);

      // 2. Upload crop to Firebase Storage with honest verification
      const cleanName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.[^/.]+$/, "");
      const isPng = croppedDataUrl.includes("image/png");
      const ext = isPng ? ".png" : ".webp";
      const finalStoragePath = `${storagePath}/${Date.now()}_${cleanName}${ext}`;

      try {
        const cloudUrl = await uploadImageToStorage(croppedDataUrl, finalStoragePath, { throwOnError: true });
        if (cloudUrl && cloudUrl.startsWith("http")) {
          setPreview(cloudUrl);
          setManualUrl(cloudUrl);
          setUploadStatus("cloud_synced");
          setError(null);
          if (onUrlChange) {
            onUrlChange(cloudUrl);
          }
        } else {
          throw new Error("Storage service did not return an accessible cloud URL.");
        }
      } catch (uploadErr: any) {
        console.warn("Cloud storage upload notice for crop:", uploadErr);
        setUploadStatus("upload_failed");
        setError(`⚠️ Cloud Upload Failed: Unable to store cropped image in cloud storage (${uploadErr?.message || "network error"}). Please retry.`);
        if (onUrlChange) {
          onUrlChange(croppedDataUrl);
        }
      }
    } catch (err: any) {
      console.error("Image crop and storage error", err);
      setUploadStatus("upload_failed");
      setError(err?.message || "Failed to save cropped image.");
    } finally {
      setIsProcessing(false);
      onUploadStateChange?.(false);
      setRawImageToCrop(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRetryUpload = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // 1. Prioritize uploading the cropped image or current local data URL so crops are NEVER reset!
    const targetDataUrl = lastCroppedDataUrlRef.current || localDataUrlRef.current;
    if (targetDataUrl) {
      setIsProcessing(true);
      setUploadStatus("uploading");
      onUploadStateChange?.(true);
      setError(null);
      try {
        const cleanName = (originalFileName || "image").replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.[^/.]+$/, "");
        const isPng = targetDataUrl.includes("image/png");
        const ext = isPng ? ".png" : ".webp";
        const finalStoragePath = `${storagePath}/${Date.now()}_${cleanName}${ext}`;

        const cloudUrl = await uploadImageToStorage(targetDataUrl, finalStoragePath, { throwOnError: true });
        if (cloudUrl && cloudUrl.startsWith("http")) {
          setPreview(cloudUrl);
          setManualUrl(cloudUrl);
          setUploadStatus("cloud_synced");
          setError(null);
          if (onUrlChange) onUrlChange(cloudUrl);
        } else {
          throw new Error("Storage service did not return an accessible cloud URL.");
        }
      } catch (err: any) {
        console.warn("Retry upload error:", err);
        setUploadStatus("upload_failed");
        setError(`⚠️ Cloud Upload Failed: Unable to store image in cloud storage (${err?.message || "network error"}). You can retry the upload.`);
      } finally {
        setIsProcessing(false);
        onUploadStateChange?.(false);
      }
      return;
    }

    // 2. Only if no local data url exists, reprocess the raw file
    if (lastProcessedFileRef.current) {
      await processFileDirectly(lastProcessedFileRef.current);
    }
  };

  const openExistingImageInCropper = (e: React.MouseEvent) => {
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
    setPreview("");
    setManualUrl("");
    setCompressionStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onUrlChange) {
      onUrlChange("");
    }
  };

  const handleManualUrlSubmit = (urlVal: string) => {
    setManualUrl(urlVal);
    setPreview(urlVal);
    if (onUrlChange) {
      onUrlChange(urlVal);
    }
  };

  const aspectClass =
    aspectRatio === "4:5"
      ? "aspect-[4/5] max-h-72"
      : aspectRatio === "3:4"
      ? "aspect-[3/4] max-h-72"
      : aspectRatio === "21:9"
      ? "aspect-[21/9] max-h-56"
      : aspectRatio === "1:1"
      ? "aspect-square max-h-48"
      : "aspect-video max-h-64";

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header with Title, Recommended Size, and Upload/Link Switch */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold font-heading text-slate-800 uppercase tracking-wider block truncate">
            {label}
          </span>

          {/* Upload Mode Toggle */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold shrink-0 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setInputMode("upload")}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                inputMode === "upload" ? "bg-white text-[#17458F] shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <UploadCloud className="w-3 h-3" />
              <span>Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode("url")}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                inputMode === "url" ? "bg-white text-[#17458F] shadow-xs" : "text-slate-500 hover:text-slate-800"
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

              {/* Action Controls */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                <button
                  type="button"
                  onClick={openExistingImageInCropper}
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

              {/* Adjust Frame & Crop Action (Top-Right) */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                <button
                  type="button"
                  onClick={openExistingImageInCropper}
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

              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 z-10">
                {uploadStatus === "uploading" || isProcessing ? (
                  <div className="px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-md text-amber-300 text-[10px] font-bold flex items-center gap-1.5 border border-amber-400/30 shadow-md">
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    <span>Uploading to Cloud...</span>
                  </div>
                ) : uploadStatus === "cloud_synced" || (preview && preview.startsWith("http")) ? (
                  <div className="px-2.5 py-1 rounded-full bg-slate-900/90 backdrop-blur-md text-emerald-300 text-[10px] font-bold flex items-center gap-1.5 border border-emerald-400/30 shadow-md">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Verified Cloud Storage</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="px-2.5 py-1 rounded-full bg-rose-950/90 backdrop-blur-md text-rose-300 text-[10px] font-bold flex items-center gap-1.5 border border-rose-400/30 shadow-md">
                      <AlertCircle className="w-3 h-3 text-rose-400" />
                      <span>Upload Failed (Local Draft)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRetryUpload}
                      className="px-2.5 py-1 rounded-full bg-[#E78023] hover:bg-[#d06f19] text-white text-[10px] font-bold transition-all flex items-center gap-1 shadow-md cursor-pointer border border-white/20"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry Upload</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 py-2 flex flex-col items-center">
              <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-[#E78023] group-hover:scale-110 transition-transform">
                {isProcessing ? (
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
                  {sublabel}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          {(uploadStatus === "upload_failed" || localDataUrlRef.current) && (
            <button
              type="button"
              onClick={handleRetryUpload}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shrink-0 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isProcessing ? "animate-spin" : ""}`} />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {compressionStats && (
        <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 text-[11px] flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>DSLR Optimized: {formatBytes(compressionStats.originalSize)} &rarr; {formatBytes(compressionStats.compressedSize)}</span>
          </div>
          <span className="font-bold text-emerald-700">
            {compressionStats.savingsPercentage}% saved • 2.5K Retina
          </span>
        </div>
      )}

      {/* Interactive Photo Cropper & Framing Modal */}
      {isCropperOpen && rawImageToCrop && (() => {
        const effectiveAllowedRatios: AspectRatioType[] = allowedAspectRatios && allowedAspectRatios.length > 0
          ? allowedAspectRatios
          : lockAspectRatio === true && aspectRatio && aspectRatio !== "auto"
          ? [aspectRatio as AspectRatioType]
          : ["16:9", "4:5", "3:4", "21:9", "1:1", "free"];

        const shouldLock = lockAspectRatio === true;

        return (
          <ImageCropperModal
            isOpen={isCropperOpen}
            onClose={() => {
              setIsCropperOpen(false);
              setRawImageToCrop(null);
            }}
            imageSrc={rawImageToCrop}
            initialAspectRatio={aspectRatio === "auto" ? "16:9" : (aspectRatio as AspectRatioType)}
            allowedAspectRatios={effectiveAllowedRatios}
            lockAspectRatio={shouldLock}
            isAvatar={
              isAvatar !== undefined
                ? isAvatar
                : (aspectRatio === "1:1" && (storagePath.includes("avatars") || storagePath.includes("logo")))
            }
            onCropComplete={handleCropComplete}
            title={`Crop & Frame ${label}`}
          />
        );
      })()}
    </div>
  );
}
