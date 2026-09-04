"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw,
  Crop, 
  Check, 
  X, 
  Move, 
  Sparkles, 
  RefreshCw,
  Maximize2,
  Minimize2,
  Grid,
  Circle,
  Square,
  FlipHorizontal,
  FlipVertical,
  Sliders,
  Maximize,
  Undo2
} from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export type AspectRatioType = "16:9" | "4:5" | "3:4" | "21:9" | "1:1" | "auto" | "free";

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  initialAspectRatio?: AspectRatioType;
  allowedAspectRatios?: AspectRatioType[];
  isAvatar?: boolean;
  onCropComplete: (croppedDataUrl: string) => void;
  title?: string;
}

interface RatioPreset {
  id: AspectRatioType;
  label: string;
  sublabel: string;
  ratio: number;
  width: number;
  height: number;
}

export function ImageCropperModal({
  isOpen,
  onClose,
  imageSrc,
  initialAspectRatio = "16:9",
  allowedAspectRatios,
  isAvatar = false,
  onCropComplete,
  title = "Crop & Frame Photo",
}: ImageCropperModalProps) {
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioType>(initialAspectRatio);
  const [zoom, setZoom] = useState<number>(1);
  const [rotationSteps, setRotationSteps] = useState<number>(0); // 90-degree increments
  const [fineAngle, setFineAngle] = useState<number>(0); // -45 to +45 fine leveling
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [showCircleMask, setShowCircleMask] = useState(isAvatar || initialAspectRatio === "1:1");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  const [activeTab, setActiveTab] = useState<"crop" | "transform">("crop");

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Sync initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      let initial: AspectRatioType = initialAspectRatio === "auto" ? "16:9" : initialAspectRatio;
      if (allowedAspectRatios && allowedAspectRatios.length > 0 && !allowedAspectRatios.includes(initial)) {
        const first = allowedAspectRatios[0];
        initial = first === "auto" ? "16:9" : first;
      }
      setSelectedRatio(initial);
      setZoom(1);
      setRotationSteps(0);
      setFineAngle(0);
      setFlipH(false);
      setFlipV(false);
      setPan({ x: 0, y: 0 });
      setImageLoaded(false);
      setShowCircleMask(isAvatar || initial === "1:1");
    }
  }, [isOpen, initialAspectRatio, allowedAspectRatios, isAvatar]);

  // Compute aspect ratio numerical value
  const getRatioMultiplier = useCallback((ratio: AspectRatioType): number => {
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
        return 1;
      case "free":
      case "auto":
      default:
        return imgNaturalSize.width && imgNaturalSize.height 
          ? imgNaturalSize.width / imgNaturalSize.height 
          : 16 / 9;
    }
  }, [imgNaturalSize]);

  const currentRatio = getRatioMultiplier(selectedRatio);
  const totalAngle = (rotationSteps * 90) + fineAngle;

  // Mouse & Touch Pointer Pan handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
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

  // Wheel to zoom smoothly
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomStep = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.min(Math.max(0.7, +(prev + zoomStep).toFixed(2)), 4));
  };

  // Image load handler
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    setImgNaturalSize({ width: target.naturalWidth, height: target.naturalHeight });
    setImageLoaded(true);
  };

  // Reset all framing adjustments
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotationSteps(0);
    setFineAngle(0);
    setFlipH(false);
    setFlipV(false);
  };

  // Quick fit / fill
  const handleFit = () => {
    setZoom(0.9);
    setPan({ x: 0, y: 0 });
  };

  const handleFill = () => {
    setZoom(1.25);
    setPan({ x: 0, y: 0 });
  };

  // Keyboard navigation for precision fine-tuning
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      const step = e.shiftKey ? 20 : 4;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          setPan((p) => ({ ...p, x: p.x - step }));
          break;
        case "ArrowRight":
          e.preventDefault();
          setPan((p) => ({ ...p, x: p.x + step }));
          break;
        case "ArrowUp":
          e.preventDefault();
          setPan((p) => ({ ...p, y: p.y - step }));
          break;
        case "ArrowDown":
          e.preventDefault();
          setPan((p) => ({ ...p, y: p.y + step }));
          break;
        case "+":
        case "=":
          e.preventDefault();
          setZoom((z) => Math.min(4, +(z + 0.1).toFixed(2)));
          break;
        case "-":
        case "_":
          e.preventDefault();
          setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2)));
          break;
        case "r":
        case "R":
          e.preventDefault();
          setRotationSteps((r) => (r + 1) % 4);
          break;
        case "g":
        case "G":
          e.preventDefault();
          setShowGrid((g) => !g);
          break;
        case "c":
        case "C":
          if (selectedRatio === "1:1") {
            e.preventDefault();
            setShowCircleMask((m) => !m);
          }
          break;
        case "Enter":
          e.preventDefault();
          handleApplyCrop();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedRatio]);

  // Execute canvas crop with crystal-clear high resolution export
  const handleApplyCrop = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const cropBox = containerRef.current.getBoundingClientRect();
    
    // Output target dimensions based on target ratio (maximum crisp clarity without quota bloat):
    let baseDimension = 1920;
    if (selectedRatio === "1:1") {
      baseDimension = 800; // 800x800 pristine crisp avatar / logo (~30KB)
    } else if (isAvatar && (selectedRatio === "4:5" || selectedRatio === "3:4")) {
      baseDimension = 1000; // 800x1000 high-density portrait postcard avatar (~40KB)
    } else if (selectedRatio === "4:5" || selectedRatio === "3:4") {
      baseDimension = 1200; // 960x1200 high-res event poster (~70KB)
    } else if (selectedRatio === "21:9") {
      baseDimension = 2560; // 2.5K Retina cinematic banner
    } else {
      baseDimension = 1600; // 1080p crisp card/banner
    }

    let targetWidth = baseDimension;
    let targetHeight = Math.round(baseDimension / currentRatio);

    if (currentRatio < 1) {
      // Portrait like 4:5 or 3:4
      targetHeight = baseDimension;
      targetWidth = Math.round(baseDimension * currentRatio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Highest quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Clear canvas background to preserve transparency for PNG and WebP logos
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    // Coordinate transformation
    ctx.save();
    ctx.translate(targetWidth / 2, targetHeight / 2);

    // Apply rotation & leveling
    ctx.rotate((totalAngle * Math.PI) / 180);

    // Apply mirroring
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // Calculate scale ratio between preview bounding box and export canvas
    const scaleFactor = targetWidth / cropBox.width;

    // Apply user pan and zoom
    ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);
    ctx.scale(zoom, zoom);

    // Compute base image rendered dimensions relative to the crop box
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

    // Export as clean, pristine crystal-clear WebP / PNG
    try {
      const isPng = imageSrc.includes("image/png") || imageSrc.includes(".png");
      const exportType = isPng ? "image/png" : "image/webp";
      const croppedDataUrl = canvas.toDataURL(exportType, isPng ? 0.95 : 0.90);
      onCropComplete(croppedDataUrl);
      onClose();
    } catch (e) {
      console.error("Failed to crop canvas", e);
      onCropComplete(imageSrc);
      onClose();
    }
  }, [currentRatio, totalAngle, flipH, flipV, pan, zoom, imageSrc, onCropComplete, onClose, selectedRatio]);

  if (!isOpen || !imageSrc) return null;

  const allRatioOptions: RatioPreset[] = [
    { id: "1:1", label: "1:1 Square", sublabel: "Avatar / Logo / Badge", ratio: 1, width: 14, height: 14 },
    { id: "16:9", label: "16:9 Banner", sublabel: "Landscape Hero / Card", ratio: 16 / 9, width: 18, height: 10 },
    { id: "4:5", label: "4:5 Poster", sublabel: "Event Story / Feed", ratio: 4 / 5, width: 12, height: 15 },
    { id: "3:4", label: "3:4 Vertical", sublabel: "Portrait Card", ratio: 3 / 4, width: 12, height: 16 },
    { id: "21:9", label: "21:9 Panoramic", sublabel: "Ultrawide Banner", ratio: 21 / 9, width: 22, height: 9 },
    { id: "free", label: "Original Ratio", sublabel: "Natural Dimensions", ratio: 0, width: 14, height: 12 },
  ];

  const ratioOptions = allowedAspectRatios && allowedAspectRatios.length > 0
    ? allRatioOptions.filter((r) => allowedAspectRatios.includes(r.id))
    : allRatioOptions;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle="Pan, zoom, level, and frame your photography with pixel-perfect studio precision."
      maxWidth="2xl"
    >
      <div className="space-y-4">
        
        {/* Aspect Ratio Selector Chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
              <Crop className="w-3 h-3 text-[#E78023]" />
              <span>Framing Aspect Ratio</span>
            </span>

            {/* Quick Overlays Toolbar */}
            <div className="flex items-center gap-1.5">
              {selectedRatio === "1:1" && (
                <button
                  type="button"
                  onClick={() => setShowCircleMask(!showCircleMask)}
                  className={`text-[11px] font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                    showCircleMask
                      ? "bg-[#E78023]/15 border-[#E78023] text-[#E78023] shadow-xs"
                      : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                  }`}
                  title="Toggle Circular Avatar Mask (Key: C)"
                >
                  <Circle className="w-3.5 h-3.5" />
                  <span>Circle Mask</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`text-[11px] font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                  showGrid
                    ? "bg-[#17458F]/15 border-[#17458F] text-[#17458F] shadow-xs"
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                }`}
                title="Toggle Rule-of-Thirds Grid (Key: G)"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Grid 3×3</span>
              </button>
            </div>
          </div>

          {/* Ratio Pills Grid */}
          <div className={
            ratioOptions.length === 1
              ? "grid grid-cols-1 sm:grid-cols-2 max-w-sm gap-2"
              : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2"
          }>
            {ratioOptions.map((opt) => {
              const isSelected = selectedRatio === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSelectedRatio(opt.id);
                    if (opt.id === "1:1" && isAvatar) setShowCircleMask(true);
                    setPan({ x: 0, y: 0 });
                  }}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 group ${
                    isSelected
                      ? "bg-[#17458F] border-[#17458F] text-white shadow-sm ring-2 ring-[#17458F]/30"
                      : "bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold leading-tight line-clamp-1">{opt.label}</span>
                    <div 
                      className={`border rounded-xs shrink-0 transition-colors ${
                        isSelected ? "border-white bg-white/30" : "border-slate-400 bg-slate-200"
                      }`}
                      style={{ width: `${opt.width}px`, height: `${opt.height}px` }}
                    />
                  </div>
                  <span className={`text-[9px] line-clamp-1 ${isSelected ? "text-blue-200" : "text-slate-400"}`}>
                    {opt.sublabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Studio Darkroom Viewport */}
        <div 
          className="relative w-full bg-[#0B0F17] rounded-3xl overflow-hidden border border-slate-800 flex items-center justify-center select-none shadow-2xl p-4 sm:p-6"
          style={{ minHeight: "360px", maxHeight: "480px" }}
          onWheel={handleWheel}
        >
          {/* Active Aspect Ratio Crop Window */}
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`relative overflow-hidden cursor-grab active:cursor-grabbing border-2 border-[#E78023] rounded-2xl shadow-2xl transition-[aspect-ratio] duration-150 max-w-[94%] max-h-[380px] ring-4 ring-black/40 ${
              showCircleMask && selectedRatio === "1:1" ? "rounded-full" : ""
            }`}
            style={{
              aspectRatio: `${currentRatio}`,
              width: currentRatio >= 1 ? "100%" : "auto",
              height: currentRatio < 1 ? "360px" : "auto",
            }}
          >
            {/* The Image being transformed */}
            <div
              className="w-full h-full flex items-center justify-center origin-center pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) rotate(${totalAngle}deg) scale(${flipH ? -zoom : zoom}, ${flipV ? -zoom : zoom})`,
                transition: isDragging ? "none" : "transform 0.1s ease-out",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Framing preview"
                onLoad={handleImageLoad}
                className="max-w-none w-full h-auto pointer-events-none object-cover will-change-transform"
                crossOrigin="anonymous"
              />
            </div>

            {/* Circular Mask Cutout Preview (For Avatars / Profile Photos) */}
            {showCircleMask && selectedRatio === "1:1" && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-full h-full rounded-full border-2 border-dashed border-[#E78023] shadow-[0_0_0_9999px_rgba(11,15,23,0.65)]" />
              </div>
            )}

            {/* Rule of Thirds Grid Overlay */}
            {showGrid && (
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-white/20">
                <div className="border-r border-b border-white/15" />
                <div className="border-r border-b border-white/15" />
                <div className="border-b border-white/15" />
                <div className="border-r border-b border-white/15" />
                <div className="border-r border-b border-white/15" />
                <div className="border-b border-white/15" />
                <div className="border-r border-white/15" />
                <div className="border-r border-white/15" />
                <div />
              </div>
            )}

            {/* Viewfinder L-shaped Corner Crop Marks */}
            <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-white pointer-events-none drop-shadow-md" />
            <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-white pointer-events-none drop-shadow-md" />
            <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-white pointer-events-none drop-shadow-md" />
            <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-white pointer-events-none drop-shadow-md" />

            {/* Floating Live Dimensions & Gesture Guide Tag */}
            <div className="absolute bottom-2.5 left-2.5 px-2 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[10px] font-mono text-white/90 pointer-events-none flex items-center gap-1.5 border border-white/10 shadow-lg">
              <Move className="w-3 h-3 text-[#E78023]" />
              <span>Drag to Pan • Wheel to Zoom</span>
            </div>

            {imgNaturalSize.width > 0 && (
              <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[10px] font-mono text-slate-300 pointer-events-none border border-white/10 shadow-lg">
                Source: {imgNaturalSize.width} × {imgNaturalSize.height}
              </div>
            )}
          </div>
        </div>

        {/* Professional Control Console (Tabbed: Scale & Crop, Straighten & Flip) */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3.5">
          
          {/* Controls Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("crop")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "crop"
                    ? "bg-[#17458F] text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Scale &amp; Zoom</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("transform")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "transform"
                    ? "bg-[#17458F] text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Level &amp; Rotate</span>
              </button>
            </div>

            {/* Quick Reset & Fit */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleFit}
                className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-bold cursor-pointer transition-colors"
                title="Fit entire image into frame"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={handleFill}
                className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-bold cursor-pointer transition-colors"
                title="Fill frame"
              >
                Fill
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                title="Reset all transforms"
              >
                <RefreshCw className="w-3 h-3 text-[#E78023]" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Scale & Zoom Controls */}
          {activeTab === "crop" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-[#17458F]" />
                  <span>Zoom Magnification</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {Math.round(zoom * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(0.7, +(prev - 0.15).toFixed(2)))}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer shadow-xs transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="0.7"
                  max="3.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-[#E78023] cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(3.5, +(prev + 0.15).toFixed(2)))}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer shadow-xs transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Rotate, Level & Mirror Controls */}
          {activeTab === "transform" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Fine Angle Straighten Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Fine Angle Straighten</span>
                  <span className="font-mono text-[11px] text-[#17458F] bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {fineAngle > 0 ? `+${fineAngle}°` : `${fineAngle}°`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="1"
                    value={fineAngle}
                    onChange={(e) => setFineAngle(parseInt(e.target.value))}
                    className="w-full accent-[#17458F] cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  {fineAngle !== 0 && (
                    <button
                      type="button"
                      onClick={() => setFineAngle(0)}
                      className="text-[10px] font-bold text-[#E78023] hover:underline shrink-0"
                    >
                      0° Snap
                    </button>
                  )}
                </div>
              </div>

              {/* 90-degree Rotations & Mirroring Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0">
                <button
                  type="button"
                  onClick={() => setRotationSteps((r) => (r - 1 + 4) % 4)}
                  className="px-2.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-xs"
                  title="Rotate -90°"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>-90°</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRotationSteps((r) => (r + 1) % 4)}
                  className="px-2.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-xs"
                  title="Rotate +90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>+90°</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFlipH(!flipH)}
                  className={`px-2.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shadow-xs ${
                    flipH 
                      ? "bg-[#17458F] border-[#17458F] text-white" 
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                  title="Mirror / Flip Horizontal"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>Mirror</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-2">
            <span>Shortcuts:</span>
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded-sm font-mono text-[10px]">Arrow keys</kbd>
            <span>pan</span>
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded-sm font-mono text-[10px]">+/-</kbd>
            <span>zoom</span>
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded-sm font-mono text-[10px]">R</kbd>
            <span>rotate</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
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
              className="gap-2 bg-[#E78023] hover:bg-[#D26E17] text-white font-extrabold shadow-md hover:shadow-lg transition-all"
            >
              <Crop className="w-4 h-4" />
              <span>Apply Crop &amp; Frame</span>
            </Button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
