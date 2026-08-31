"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { UploadCloud, CheckCircle2, Sparkles, AlertCircle, RefreshCw, X, Link as LinkIcon, Image as ImageIcon } from "lucide-react";
import { compressImage, formatBytes, CompressionResult } from "@/lib/imageCompression";
import { uploadImageToStorage } from "@/lib/firebase/storage";

interface ImageUploadDropzoneProps {
  onImageCompressed?: (result: CompressionResult) => void;
  onUrlChange?: (url: string) => void;
  label?: string;
  sublabel?: string;
  recommendedSize?: string;
  aspectRatio?: "16:9" | "3:4" | "21:9" | "1:1" | "auto";
  previewUrl?: string;
  storagePath?: string;
  className?: string;
}

export function ImageUploadDropzone({
  onImageCompressed,
  onUrlChange,
  label = "Upload Photo",
  sublabel = "Auto-compressed to high-speed WebP format",
  recommendedSize,
  aspectRatio = "16:9",
  previewUrl,
  storagePath = "uploads",
  className = "",
}: ImageUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressionStats, setCompressionStats] = useState<CompressionResult | null>(null);
  const [preview, setPreview] = useState<string>(previewUrl || "");
  const [inputMode, setInputMode] = useState<"upload" | "url">("upload");
  const [manualUrl, setManualUrl] = useState<string>(previewUrl || "");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (previewUrl && previewUrl !== preview) {
      setPreview(previewUrl);
      setManualUrl(previewUrl);
    }
  }, [previewUrl]);

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WebP, HEIC).");
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      // 1. Client-side WebP compression
      const result = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
        outputFormat: "image/webp",
      });

      setCompressionStats(result);
      setPreview(result.dataUrl);

      if (onImageCompressed) {
        onImageCompressed(result);
      }

      // 2. Upload to Firebase Storage or use dataUrl
      const finalStoragePath = `${storagePath}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}.webp`;
      const cloudUrl = await uploadImageToStorage(result.dataUrl, finalStoragePath);
      
      if (onUrlChange) {
        onUrlChange(cloudUrl || result.dataUrl);
      }
    } catch (err) {
      console.error("Image processing error", err);
      setError("Failed to process image. Please try another file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    aspectRatio === "3:4"
      ? "aspect-[3/4] max-h-72"
      : aspectRatio === "21:9"
      ? "aspect-[21/9] max-h-56"
      : aspectRatio === "1:1"
      ? "aspect-square max-h-48"
      : "aspect-video max-h-64";

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold font-heading text-slate-800 uppercase tracking-wider">
            {label}
          </span>
          {recommendedSize && (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#17458F] border border-blue-200 text-[10px] font-mono font-bold">
              {recommendedSize}
            </span>
          )}
        </div>

        {/* Upload Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setInputMode("upload")}
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              inputMode === "upload" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <UploadCloud className="w-3 h-3" />
            <span>Upload</span>
          </button>
          <button
            type="button"
            onClick={() => setInputMode("url")}
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              inputMode === "url" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <LinkIcon className="w-3 h-3" />
            <span>Web Link</span>
          </button>
        </div>
      </div>

      {inputMode === "url" ? (
        <div className="space-y-2">
          <div className="relative">
            <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => handleManualUrlSubmit(e.target.value)}
              placeholder="Paste direct HTTPS image link (Unsplash, Cloudinary, Drive)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
            />
          </div>
          {preview && (
            <div className={`relative w-full ${aspectClass} rounded-2xl overflow-hidden border border-slate-200 bg-slate-100`}>
              <Image
                src={preview}
                alt="URL Preview"
                fill
                className="object-cover"
              />
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/70 hover:bg-black text-white transition-colors cursor-pointer"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
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
          className={`relative group rounded-3xl border-2 border-dashed p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden ${
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
            <div className={`relative w-full ${aspectClass} rounded-2xl overflow-hidden border border-slate-200`}>
              <Image
                src={preview}
                alt="Uploaded Preview"
                fill
                className="object-cover"
              />
              
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/70 hover:bg-black text-white transition-colors cursor-pointer"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>WebP Optimized</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 flex flex-col items-center">
              <div className="h-12 w-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-[#E78023] group-hover:scale-110 transition-transform">
                {isProcessing ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-[#17458F]" />
                ) : (
                  <UploadCloud className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-1">
                <h4 className="font-heading font-bold text-xs text-[#0F172A]">
                  Click or Drag to Upload
                </h4>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  {sublabel}
                </p>
              </div>

              {recommendedSize && (
                <span className="text-[10px] text-slate-400 font-mono font-medium">
                  Recommended: {recommendedSize}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {compressionStats && (
        <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 text-[11px] flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Compressed: {formatBytes(compressionStats.originalSize)} &rarr; {formatBytes(compressionStats.compressedSize)}</span>
          </div>
          <span className="font-bold text-emerald-700">
            {compressionStats.savingsPercentage}% smaller
          </span>
        </div>
      )}
    </div>
  );
}
