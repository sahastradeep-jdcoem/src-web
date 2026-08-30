"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { UploadCloud, CheckCircle2, Sparkles, AlertCircle, RefreshCw, X } from "lucide-react";
import { compressImage, formatBytes, CompressionResult } from "@/lib/imageCompression";

interface ImageUploadDropzoneProps {
  onImageCompressed?: (result: CompressionResult) => void;
  label?: string;
  sublabel?: string;
  previewUrl?: string;
  className?: string;
}

export function ImageUploadDropzone({
  onImageCompressed,
  label = "Upload High-Resolution Photo",
  sublabel = "Raw DSLR photos are automatically compressed to crystal-clear WebP (saves 95% space)",
  previewUrl,
  className = "",
}: ImageUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressionStats, setCompressionStats] = useState<CompressionResult | null>(null);
  const [preview, setPreview] = useState<string>(previewUrl || "");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WebP, HEIC).");
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const result = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.82,
        outputFormat: "image/webp",
      });

      setCompressionStats(result);
      setPreview(result.dataUrl);
      if (onImageCompressed) {
        onImageCompressed(result);
      }
    } catch (err) {
      console.error("Compression error", err);
      setError("Failed to compress image. Please try another file.");
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
    setCompressionStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group rounded-3xl border-2 border-dashed p-6 sm:p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden ${
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
          <div className="relative w-full aspect-video max-h-64 rounded-2xl overflow-hidden border border-slate-200">
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
              <span>Optimized WebP Format</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3 flex flex-col items-center">
            <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-[#E78023] group-hover:scale-110 transition-transform">
              {isProcessing ? (
                <RefreshCw className="w-6 h-6 animate-spin text-[#17458F]" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>

            <div className="space-y-1">
              <h4 className="font-heading font-bold text-sm text-[#0F172A]">
                {label}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                {sublabel}
              </p>
            </div>

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-600 font-sans">
              <Sparkles className="w-3 h-3 text-[#E78023]" />
              <span>Auto-converts to WebP on upload</span>
            </span>
          </div>
        )}
      </div>

      {/* Live Compression Metrics Banner */}
      {compressionStats && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              Compressed from{" "}
              <strong className="font-bold text-slate-700 line-through">
                {formatBytes(compressionStats.originalSize)}
              </strong>{" "}
              to{" "}
              <strong className="font-bold text-emerald-700">
                {formatBytes(compressionStats.compressedSize)}
              </strong>{" "}
              ({compressionStats.dimensions.width}×{compressionStats.dimensions.height}px)
            </span>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold tracking-wider self-start sm:self-auto">
            <span>{compressionStats.savingsPercentage}% SPACE SAVED</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
