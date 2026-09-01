"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Crop, 
  Check, 
  X, 
  Move, 
  Sparkles, 
  RefreshCw,
  Maximize2,
  Minimize2,
  Grid
} from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export type AspectRatioType = "16:9" | "4:5" | "3:4" | "21:9" | "1:1" | "auto" | "free";

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  initialAspectRatio?: AspectRatioType;
  onCropComplete: (croppedDataUrl: string) => void;
  title?: string;
}

export function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  initialAspectRatio = "16:9",
  onCropComplete,
  title = "Crop & Frame Photo",
}: ImageCropperModalProps) {
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioType>(initialAspectRatio);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Sync initial ratio when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedRatio(initialAspectRatio === "auto" ? "16:9" : initialAspectRatio);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setImageLoaded(false);
    }
  }, [isOpen, initialAspectRatio]);

  // Compute aspect ratio numerical value (width / height)
  const getRatioMultiplier = (ratio: AspectRatioType): number => {
    switch (ratio) {
      case "16:9":
        return 16 / 9;
      case "4:5":
        return 4 / 5;
      case "3:4":
        return 3 / 4;
      case "21:9":
        return 21 / 9;
      case "1:1":
        return 1 / 1;
      case "free":
      case "auto":
      default:
        return imgNaturalSize.width && imgNaturalSize.height 
          ? imgNaturalSize.width / imgNaturalSize.height 
          : 16 / 9;
    }
  };

  const currentRatio = getRatioMultiplier(selectedRatio);

  // Mouse & Touch Pan handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Wheel to zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomStep = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.min(Math.max(1, +(prev + zoomStep).toFixed(2)), 4));
  };

  // Image load handler
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    setImgNaturalSize({ width: target.naturalWidth, height: target.naturalHeight });
    setImageLoaded(true);
  };

  // Reset framing
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  // Rotate 90 degrees
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Execute canvas crop
  const handleApplyCrop = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const cropBox = containerRef.current.getBoundingClientRect();
    
    // Output target dimensions based on target ratio
    let targetWidth = 1920;
    let targetHeight = Math.round(1920 / currentRatio);

    if (currentRatio < 1) {
      // Portrait like 4:5 or 3:4
      targetHeight = 1920;
      targetWidth = Math.round(1920 * currentRatio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Background smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Clear canvas background to preserve transparency for PNG and WebP logos
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    // Coordinate transformation
    ctx.save();
    ctx.translate(targetWidth / 2, targetHeight / 2);

    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // Calculate scale ratio between preview bounding box and export canvas
    const scaleFactor = targetWidth / cropBox.width;

    // Apply user pan and zoom
    ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);
    ctx.scale(zoom, zoom);

    // Compute base image rendered dimensions relative to the crop box
    // Center the image draw
    const isSideways = rotation % 180 !== 0;
    const renderedImgWidth = cropBox.width * scaleFactor;
    const renderedImgHeight = (cropBox.width / (img.naturalWidth / img.naturalHeight)) * scaleFactor;

    // Draw the source image centered
    ctx.drawImage(
      img,
      -renderedImgWidth / 2,
      -renderedImgHeight / 2,
      renderedImgWidth,
      renderedImgHeight
    );

    ctx.restore();

    // Export as clean WebP
    try {
      const croppedDataUrl = canvas.toDataURL("image/webp", 0.9);
      onCropComplete(croppedDataUrl);
      onClose();
    } catch (e) {
      console.error("Failed to crop canvas", e);
      // Fallback to original
      onCropComplete(imageSrc);
      onClose();
    }
  }, [currentRatio, rotation, pan, zoom, imageSrc, onCropComplete, onClose]);

  if (!isOpen || !imageSrc) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle="Pan, zoom, and frame your photo for optimal composition across all screens"
      maxWidth="xl"
    >
      <div className="space-y-5">
        
        {/* Aspect Ratio Selector Pills */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Select Framing Aspect Ratio
            </span>
            <button
              type="button"
              onClick={() => setShowGrid(!showGrid)}
              className={`text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                showGrid
                  ? "bg-[#17458F]/10 border-[#17458F]/30 text-[#17458F]"
                  : "bg-slate-100 border-slate-200 text-slate-500"
              }`}
            >
              <Grid className="w-3 h-3" />
              <span>Grid Lines</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: "16:9", label: "16:9 Banner / Card" },
              { id: "4:5", label: "4:5 Event Poster" },
              { id: "3:4", label: "3:4 Vertical" },
              { id: "1:1", label: "1:1 Square Logo" },
              { id: "21:9", label: "21:9 Hero Backdrop" },
              { id: "free", label: "Original" },
            ].map((ratio) => (
              <button
                key={ratio.id}
                type="button"
                onClick={() => {
                  setSelectedRatio(ratio.id as AspectRatioType);
                  setPan({ x: 0, y: 0 });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedRatio === ratio.id
                    ? "bg-[#17458F] text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Cropper Canvas Viewport */}
        <div 
          className="relative w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center select-none"
          style={{ minHeight: "340px", maxHeight: "460px" }}
          onWheel={handleWheel}
        >
          {/* Active Aspect Ratio Crop Window */}
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative overflow-hidden cursor-grab active:cursor-grabbing border-2 border-[#E78023] rounded-xl shadow-2xl transition-[aspect-ratio] duration-200 max-w-[90%] max-h-[380px]"
            style={{
              aspectRatio: `${currentRatio}`,
              width: currentRatio >= 1 ? "100%" : "auto",
              height: currentRatio < 1 ? "360px" : "auto",
            }}
          >
            {/* The Image being transformed */}
            <div
              className="w-full h-full flex items-center justify-center origin-center transition-transform duration-75 pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Framing preview"
                onLoad={handleImageLoad}
                className="max-w-none w-full h-auto pointer-events-none object-cover"
                crossOrigin="anonymous"
              />
            </div>

            {/* Rule of Thirds Grid Overlay */}
            {showGrid && (
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-white/20">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-white/20" />
                <div className="border-r border-white/20" />
                <div />
              </div>
            )}

            {/* Drag Hint Watermark */}
            <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-mono text-white/80 pointer-events-none flex items-center gap-1">
              <Move className="w-2.5 h-2.5 text-[#E78023]" />
              <span>Drag to position • Scroll to zoom</span>
            </div>
          </div>
        </div>

        {/* Framing Controls Bar: Zoom Slider, Rotate, Reset */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          
          {/* Zoom Controls */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1">
                <ZoomIn className="w-3.5 h-3.5 text-[#17458F]" />
                <span>Zoom Scale ({zoom}x)</span>
              </span>
              <span className="font-mono text-[11px] text-slate-500">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(1, +(prev - 0.2).toFixed(2)))}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="1"
                max="3.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-[#E78023] cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(3.5, +(prev + 0.2).toFixed(2)))}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-end justify-between sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRotate}
              className="gap-1 text-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rotate 90°</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleReset}
              className="gap-1 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleApplyCrop}
            className="gap-2 bg-[#E78023] hover:bg-[#D26E17] text-white font-extrabold"
          >
            <Crop className="w-4 h-4" />
            <span>Apply Crop &amp; Frame</span>
          </Button>
        </div>

      </div>
    </Modal>
  );
}
