"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  Undo2,
  Lock,
  User,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown
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
  lockAspectRatio?: boolean;
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
  lockAspectRatio,
  isAvatar = false,
  onCropComplete,
  title = "Crop & Frame Photo",
}: ImageCropperModalProps) {
  const effectiveAllowedRatios: AspectRatioType[] | undefined = 
    lockAspectRatio && initialAspectRatio && initialAspectRatio !== "auto" && initialAspectRatio !== "free"
      ? [initialAspectRatio]
      : allowedAspectRatios;

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
  const [showCardFrame, setShowCardFrame] = useState(initialAspectRatio === "4:5" || initialAspectRatio === "3:4");
  const [showCircleMask, setShowCircleMask] = useState(isAvatar && (initialAspectRatio === "1:1" || initialAspectRatio === "auto"));
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  const [activeTab, setActiveTab] = useState<"crop" | "transform">("crop");
  const [safeSrc, setSafeSrc] = useState<string>(imageSrc);
  const [isResolvingImage, setIsResolvingImage] = useState<boolean>(false);
  const createdObjectUrlRef = useRef<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);

  // Safely resolve remote image URLs through local proxy to completely avoid tainted canvas CORS SecurityError
  useEffect(() => {
    let isCancelled = false;

    if (createdObjectUrlRef.current) {
      URL.revokeObjectURL(createdObjectUrlRef.current);
      createdObjectUrlRef.current = null;
    }

    if (!imageSrc) {
      setSafeSrc("");
      return;
    }

    if (imageSrc.startsWith("data:") || imageSrc.startsWith("blob:")) {
      setSafeSrc(imageSrc);
      return;
    }

    if (imageSrc.startsWith("http://") || imageSrc.startsWith("https://")) {
      setIsResolvingImage(true);
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageSrc)}`;

      fetch(proxyUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`Proxy error status: ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          if (isCancelled) return;
          const blobUrl = URL.createObjectURL(blob);
          createdObjectUrlRef.current = blobUrl;
          setSafeSrc(blobUrl);
          setIsResolvingImage(false);
        })
        .catch((err) => {
          console.warn("Proxy notice, falling back to direct URL:", err);
          if (!isCancelled) {
            setSafeSrc(imageSrc);
            setIsResolvingImage(false);
          }
        });

      return () => {
        isCancelled = true;
      };
    }

    setSafeSrc(imageSrc);
  }, [imageSrc, isOpen]);

  useEffect(() => {
    return () => {
      if (createdObjectUrlRef.current) {
        URL.revokeObjectURL(createdObjectUrlRef.current);
        createdObjectUrlRef.current = null;
      }
    };
  }, []);

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

  // Calibrated Viewport Box Boundaries (fits comfortably within laptop displays)
  const cropBoxDims = useMemo(() => {
    const maxBoxW = 440;
    const maxBoxH = 290;
    const ratio = currentRatio > 0 ? currentRatio : (16 / 9);

    if (ratio >= (maxBoxW / maxBoxH)) {
      const width = maxBoxW;
      const height = Math.max(80, Math.round(width / ratio));
      return { width, height };
    } else {
      const height = maxBoxH;
      const width = Math.max(80, Math.round(height * ratio));
      return { width, height };
    }
  }, [currentRatio]);

  // Base rendered image dimensions covering the crop box at 100% zoom
  const baseImgDims = useMemo(() => {
    if (!imgNaturalSize.width || !imgNaturalSize.height || !cropBoxDims.width || !cropBoxDims.height) {
      return { width: "100%", height: "auto" };
    }
    const imgRatio = imgNaturalSize.width / imgNaturalSize.height;
    const boxRatio = cropBoxDims.width / cropBoxDims.height;

    if (imgRatio >= boxRatio) {
      const h = cropBoxDims.height;
      const w = Math.round(h * imgRatio);
      return { width: `${w}px`, height: `${h}px` };
    } else {
      const w = cropBoxDims.width;
      const h = Math.round(w / imgRatio);
      return { width: `${w}px`, height: `${h}px` };
    }
  }, [imgNaturalSize, cropBoxDims]);

  // Exact zoom factor required to fit the full image inside the crop frame
  const fitZoom = useMemo(() => {
    if (!imgNaturalSize.width || !imgNaturalSize.height || !cropBoxDims.width || !cropBoxDims.height) {
      return 1;
    }
    const imgRatio = imgNaturalSize.width / imgNaturalSize.height;
    const boxRatio = cropBoxDims.width / cropBoxDims.height;
    const fit = Math.min(boxRatio / imgRatio, imgRatio / boxRatio);
    return Math.max(0.1, Math.min(1, +fit.toFixed(3)));
  }, [imgNaturalSize, cropBoxDims]);

  const minZoom = useMemo(() => {
    return Math.min(0.2, +(fitZoom * 0.85).toFixed(2));
  }, [fitZoom]);

  // Native non-passive wheel & trackpad pinch listener directly on darkroom viewport
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !isOpen) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 24; // Line mode
      else if (e.deltaMode === 2) delta *= 400; // Page mode

      let zoomStep = 0;
      if (e.ctrlKey) {
        // Pinch-to-zoom on macOS trackpad
        zoomStep = -delta * 0.008;
      } else {
        // Proportional mouse wheel / trackpad scroll with max clamp per event
        const rawStep = -delta * 0.0018;
        zoomStep = Math.max(-0.12, Math.min(0.12, rawStep));
      }

      setZoom((prev) => {
        const next = +(prev + zoomStep).toFixed(3);
        return Math.min(Math.max(minZoom, next), 4.0);
      });
    };

    el.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleNativeWheel);
    };
  }, [isOpen, minZoom]);

  // Preload natural image dimensions immediately upon receipt of safeSrc
  useEffect(() => {
    if (safeSrc && typeof window !== "undefined") {
      let isMounted = true;
      const img = new window.Image();
      if (!safeSrc.startsWith("blob:") && !safeSrc.startsWith("data:")) {
        img.crossOrigin = "anonymous";
      }
      img.src = safeSrc;
      img.onload = () => {
        if (!isMounted) return;
        setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        setImageLoaded(true);
      };
      img.onerror = () => {
        if (!isMounted) return;
        const retry = new window.Image();
        retry.src = safeSrc;
        retry.onload = () => {
          if (!isMounted) return;
          setImgNaturalSize({ width: retry.naturalWidth, height: retry.naturalHeight });
          setImageLoaded(true);
        };
      };
      return () => {
        isMounted = false;
      };
    }
  }, [safeSrc]);

  // Sync initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      let initial: AspectRatioType = initialAspectRatio === "auto" ? "16:9" : initialAspectRatio;
      if (effectiveAllowedRatios && effectiveAllowedRatios.length > 0 && !effectiveAllowedRatios.includes(initial)) {
        const first = effectiveAllowedRatios[0];
        initial = first === "auto" ? "16:9" : first;
      }
      setSelectedRatio(initial);
      setZoom(1);
      setRotationSteps(0);
      setFineAngle(0);
      setFlipH(false);
      setFlipV(false);
      setPan({ x: 0, y: 0 });
      setShowCardFrame(initial === "4:5" || initial === "3:4");
      setShowCircleMask(isAvatar && initial === "1:1");
    }
  }, [isOpen, initialAspectRatio, effectiveAllowedRatios, isAvatar]);

  // Mouse & Touch Pointer Pan and Touchscreen Pinch Zoom handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) {
      return;
    }
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (activePointersRef.current.size === 2) {
      setIsDragging(false);
      const points = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      pinchStartDistRef.current = dist;
      pinchStartZoomRef.current = zoom;
    }

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointersRef.current.size === 2 && pinchStartDistRef.current !== null) {
      const points = Array.from(activePointersRef.current.values());
      const currentDist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (pinchStartDistRef.current > 0) {
        const factor = currentDist / pinchStartDistRef.current;
        const newZoom = Math.min(Math.max(minZoom, +(pinchStartZoomRef.current * factor).toFixed(2)), 4.0);
        setZoom(newZoom);
      }
      return;
    }

    if (isDragging && activePointersRef.current.size === 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size === 0) {
      setIsDragging(false);
      pinchStartDistRef.current = null;
    } else if (activePointersRef.current.size === 1) {
      const remaining = Array.from(activePointersRef.current.values())[0];
      setDragStart({ x: remaining.x - pan.x, y: remaining.y - pan.y });
      setIsDragging(true);
      pinchStartDistRef.current = null;
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
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
    setZoom(fitZoom);
    setPan({ x: 0, y: 0 });
  };

  const handleFill = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Nudge pan helper function for on-screen arrow buttons and keyboard navigation
  const nudge = useCallback((dx: number, dy: number) => {
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  // Execute canvas crop with crystal-clear high resolution export
  const handleApplyCrop = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    
    // Output target dimensions based on target ratio:
    let baseDimension = 1600;
    if (selectedRatio === "1:1") {
      baseDimension = 800; // 800x800 pristine crisp avatar / logo (~30KB)
    } else if (selectedRatio === "4:5" || selectedRatio === "3:4") {
      baseDimension = 1000; // 800x1000 high-density portrait postcard avatar (~40KB)
    } else if (selectedRatio === "21:9") {
      baseDimension = 2100; // 2.1K Retina cinematic banner
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
    // 1. Center origin on canvas
    ctx.translate(targetWidth / 2, targetHeight / 2);

    // Calculate scale ratio between preview bounding box and export canvas
    const scaleFactor = targetWidth / cropBoxDims.width;

    // 2. Apply user pan in screen/canvas space (matches CSS translate before rotate/scale)
    ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);

    // 3. Apply rotation & leveling
    ctx.rotate((totalAngle * Math.PI) / 180);

    // 4. Apply mirroring & zoom
    ctx.scale((flipH ? -1 : 1) * zoom, (flipV ? -1 : 1) * zoom);

    // Base rendered image dimensions covering the canvas exactly as in preview
    const imgNaturalW = img.naturalWidth || imgNaturalSize.width || targetWidth;
    const imgNaturalH = img.naturalHeight || imgNaturalSize.height || targetHeight;
    const imgRatio = imgNaturalW / imgNaturalH;
    const boxRatio = targetWidth / targetHeight;

    let baseRenderedW = 0;
    let baseRenderedH = 0;

    if (imgRatio >= boxRatio) {
      baseRenderedH = targetHeight;
      baseRenderedW = Math.round(baseRenderedH * imgRatio);
    } else {
      baseRenderedW = targetWidth;
      baseRenderedH = Math.round(baseRenderedW / imgRatio);
    }

    // Draw the source image centered
    ctx.drawImage(
      img,
      -baseRenderedW / 2,
      -baseRenderedH / 2,
      baseRenderedW,
      baseRenderedH
    );

    ctx.restore();

    // Export as clean, pristine crystal-clear WebP / PNG
    try {
      const isPng = (imageSrc.includes("image/png") || imageSrc.includes(".png") || selectedRatio === "1:1");
      const exportType = isPng ? "image/png" : "image/webp";
      const croppedDataUrl = canvas.toDataURL(exportType, isPng ? 0.95 : 0.90);
      onCropComplete(croppedDataUrl);
      onClose();
    } catch (e) {
      console.error("Failed to crop canvas", e);
      onCropComplete(imageSrc);
      onClose();
    }
  }, [
    currentRatio,
    totalAngle,
    flipH,
    flipV,
    pan,
    zoom,
    imageSrc,
    onCropComplete,
    onClose,
    selectedRatio,
    cropBoxDims,
    imgNaturalSize
  ]);

  // Keyboard navigation for precision fine-tuning
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Do not capture arrow keys if user is typing inside text fields
      const isTextEditable =
        target?.tagName === "TEXTAREA" ||
        (target?.tagName === "INPUT" && (target as HTMLInputElement).type !== "range");

      if (isTextEditable) return;

      const step = e.shiftKey ? 48 : 16;

      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          if (target?.tagName === "INPUT") (target as HTMLElement).blur();
          e.preventDefault();
          e.stopPropagation();
          setPan((p) => ({ ...p, x: p.x - step }));
          break;
        case "ArrowRight":
        case "d":
        case "D":
          if (target?.tagName === "INPUT") (target as HTMLElement).blur();
          e.preventDefault();
          e.stopPropagation();
          setPan((p) => ({ ...p, x: p.x + step }));
          break;
        case "ArrowUp":
        case "w":
        case "W":
          if (target?.tagName === "INPUT") (target as HTMLElement).blur();
          e.preventDefault();
          e.stopPropagation();
          setPan((p) => ({ ...p, y: p.y - step }));
          break;
        case "ArrowDown":
        case "s":
        case "S":
          if (target?.tagName === "INPUT") (target as HTMLElement).blur();
          e.preventDefault();
          e.stopPropagation();
          setPan((p) => ({ ...p, y: p.y + step }));
          break;
        case "+":
        case "=":
          e.preventDefault();
          setZoom((z) => Math.min(4.0, +(z + 0.15).toFixed(2)));
          break;
        case "-":
        case "_":
          e.preventDefault();
          setZoom((z) => Math.max(minZoom, +(z - 0.15).toFixed(2)));
          break;
        case "r":
        case "R":
          if (!target?.closest("input")) {
            e.preventDefault();
            setRotationSteps((r) => (r + 1) % 4);
          }
          break;
        case "g":
        case "G":
          if (!target?.closest("input")) {
            e.preventDefault();
            setShowGrid((g) => !g);
          }
          break;
        case "c":
        case "C":
          if (!target?.closest("input") && selectedRatio === "1:1") {
            e.preventDefault();
            setShowCircleMask((m) => !m);
          }
          break;
        case "Enter":
          if (!target?.closest("button")) {
            e.preventDefault();
            handleApplyCrop();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedRatio, minZoom, handleApplyCrop]);

  if (!isOpen || !imageSrc) return null;

  const allRatioOptions: RatioPreset[] = [
    { id: "4:5", label: "4:5 Team Card", sublabel: "Council Card / Portrait", ratio: 4 / 5, width: 12, height: 15 },
    { id: "3:4", label: "3:4 Portrait", sublabel: "Portrait Postcard", ratio: 3 / 4, width: 12, height: 16 },
    { id: "1:1", label: "1:1 Square", sublabel: "Avatar / Logo / Badge", ratio: 1, width: 14, height: 14 },
    { id: "16:9", label: "16:9 Banner", sublabel: "Landscape Hero / Card", ratio: 16 / 9, width: 18, height: 10 },
    { id: "21:9", label: "21:9 Panoramic", sublabel: "Ultrawide Banner", ratio: 21 / 9, width: 22, height: 9 },
    { id: "free", label: "Original Ratio", sublabel: "Natural Dimensions", ratio: 0, width: 14, height: 12 },
  ];

  const ratioOptions = effectiveAllowedRatios && effectiveAllowedRatios.length > 0
    ? allRatioOptions.filter((r) => effectiveAllowedRatios.includes(r.id))
    : allRatioOptions;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle="Pan, zoom, level, and frame your photography with pixel-perfect studio precision."
      maxWidth="2xl"
      contentClassName="p-4 sm:p-5"
    >
      <div className="space-y-3">
        
        {/* Aspect Ratio Selector Chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
              <Crop className="w-3 h-3 text-[#E78023]" />
              <span>Framing Aspect Ratio</span>
            </span>

            {/* Quick Overlays Toolbar */}
            <div className="flex items-center gap-1.5">
              {(selectedRatio === "4:5" || selectedRatio === "3:4") && (
                <button
                  type="button"
                  onClick={() => setShowCardFrame(!showCardFrame)}
                  className={`text-[11px] font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                    showCardFrame
                      ? "bg-[#17458F]/15 border-[#17458F] text-[#17458F] shadow-xs"
                      : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                  }`}
                  title="Toggle Team Card Frame Guide"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Card Frame Guide</span>
                </button>
              )}

              {selectedRatio === "1:1" && isAvatar && (
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

          {/* Ratio Pills Grid or Locked Standard Banner */}
          {ratioOptions.length === 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/50 border border-blue-200/80 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#17458F] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Lock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#17458F]">
                      Locked Standard: {ratioOptions[0].label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#17458F] text-white tracking-wide shadow-2xs">
                      {ratioOptions[0].id}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                    {ratioOptions[0].sublabel} • Crop frame calibrated strictly for this layout slot
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-blue-700/80 font-semibold bg-white/80 px-2.5 py-1 rounded-lg border border-blue-200">
                  Fixed {ratioOptions[0].id}
                </span>
                <div 
                  className="border-2 border-[#17458F] bg-[#17458F]/20 rounded-xs shrink-0 shadow-2xs"
                  style={{ width: `${ratioOptions[0].width}px`, height: `${ratioOptions[0].height}px` }}
                  title={`Calibrated ${ratioOptions[0].id} scale`}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {ratioOptions.map((opt) => {
                const isSelected = selectedRatio === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedRatio(opt.id);
                      if (opt.id === "1:1" && isAvatar) {
                        setShowCircleMask(true);
                      } else {
                        setShowCircleMask(false);
                      }
                      if (opt.id === "4:5" || opt.id === "3:4") {
                        setShowCardFrame(true);
                      } else {
                        setShowCardFrame(false);
                      }
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
          )}
        </div>

        {/* Studio Darkroom Viewport */}
        <div 
          ref={viewportRef}
          data-cropper-viewport="true"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-full bg-[#0B0F17] rounded-3xl overflow-hidden border border-slate-800 flex items-center justify-center select-none shadow-2xl p-3 sm:p-4 touch-none cursor-grab active:cursor-grabbing"
          style={{ minHeight: "280px", maxHeight: "330px" }}
        >
          {isResolvingImage && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-30">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/80 border border-white/10 text-white text-xs font-semibold shadow-lg">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E78023]" />
                <span>Loading Studio Asset...</span>
              </div>
            </div>
          )}

          {/* Active Aspect Ratio Crop Window */}
          <div
            ref={containerRef}
            className={`relative overflow-hidden border-2 border-[#E78023] rounded-2xl shadow-2xl transition-[width,height] duration-150 ring-4 ring-black/40 ${
              showCircleMask && selectedRatio === "1:1" ? "rounded-full" : ""
            }`}
            style={{
              width: `${cropBoxDims.width}px`,
              height: `${cropBoxDims.height}px`,
            }}
          >
            {/* The Image being transformed */}
            <div
              className="w-full h-full flex items-center justify-center origin-center pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) rotate(${totalAngle}deg) scale(${flipH ? -zoom : zoom}, ${flipV ? -zoom : zoom})`,
                transition: "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={safeSrc}
                alt="Framing preview"
                onLoad={handleImageLoad}
                style={{
                  width: baseImgDims.width,
                  height: baseImgDims.height,
                  maxWidth: "none",
                  maxHeight: "none",
                }}
                className="pointer-events-none object-cover will-change-transform"
                crossOrigin={!safeSrc.startsWith("blob:") && !safeSrc.startsWith("data:") ? "anonymous" : undefined}
              />
            </div>

            {/* Circular Mask Cutout Preview (For Avatars / Profile Photos) */}
            {showCircleMask && selectedRatio === "1:1" && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-full h-full rounded-full border-2 border-dashed border-[#E78023] shadow-[0_0_0_9999px_rgba(11,15,23,0.65)]" />
              </div>
            )}

            {/* Team Card Frame Simulated Guide (Card Header Badge & Bottom Text Overlay) */}
            {showCardFrame && (selectedRatio === "4:5" || selectedRatio === "3:4") && (
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between">
                {/* Simulated Top Tag */}
                <div className="p-3 flex items-center justify-between">
                  <div className="px-2.5 py-1 rounded-full bg-white/95 text-[#E78023] font-bold text-[9px] uppercase tracking-wider shadow-sm border border-slate-200">
                    Card Photo Frame
                  </div>
                  <div className="px-2 py-0.5 rounded-full bg-black/60 text-white font-mono text-[9px] backdrop-blur-xs">
                    {selectedRatio} Card
                  </div>
                </div>

                {/* Simulated Bottom Gradient and Council Member Label Preview */}
                <div className="bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-12 pb-3.5 px-3.5">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#E78023] block">
                      Council Role
                    </span>
                    <div className="text-xs font-bold text-white leading-tight">
                      Member Full Name
                    </div>
                    <div className="text-[10px] text-slate-300 font-medium">
                      Department • Academic Year
                    </div>
                  </div>
                </div>
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

          </div>

          {/* Floating Studio Directional Arrow Controls Pad */}
          <div 
            data-interactive-wheel="true"
            className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 p-1 rounded-xl bg-black/85 backdrop-blur-md border border-white/15 shadow-xl select-none"
            title="Directional Arrow Controls (Click to pan/nudge framing)"
          >
            <span className="text-[9px] font-mono font-bold text-slate-300 px-1.5 uppercase tracking-wider hidden sm:inline">
              Pan
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nudge(-16, 0);
              }}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-[#E78023] text-white flex items-center justify-center transition-all cursor-pointer"
              title="Nudge Left (← / A)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nudge(0, -16);
              }}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-[#E78023] text-white flex items-center justify-center transition-all cursor-pointer"
              title="Nudge Up (↑ / W)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nudge(0, 16);
              }}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-[#E78023] text-white flex items-center justify-center transition-all cursor-pointer"
              title="Nudge Down (↓ / S)"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nudge(16, 0);
              }}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-[#E78023] text-white flex items-center justify-center transition-all cursor-pointer"
              title="Nudge Right (→ / D)"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {(pan.x !== 0 || pan.y !== 0) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPan({ x: 0, y: 0 });
                }}
                className="px-1.5 py-1 rounded-lg bg-[#E78023]/20 hover:bg-[#E78023]/40 text-[#E78023] text-[9px] font-mono font-bold transition-all cursor-pointer"
                title="Reset Pan to Center"
              >
                0,0
              </button>
            )}
          </div>

          {/* Floating Live Dimensions & Gesture Guide Tag */}
          <div className="absolute bottom-2.5 left-2.5 z-20 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-[10px] font-mono text-white/90 pointer-events-none flex items-center gap-1.5 border border-white/10 shadow-lg">
            <Move className="w-3 h-3 text-[#E78023]" />
            <span className="hidden sm:inline">Drag to Pan • Wheel/Pinch to Zoom</span>
            <span className="sm:hidden">Pan • Pinch Zoom</span>
          </div>

          {imgNaturalSize.width > 0 && (
            <div className="absolute top-2.5 right-2.5 z-20 px-2 py-1 rounded-lg bg-black/80 backdrop-blur-md text-[10px] font-mono text-slate-300 pointer-events-none border border-white/10 shadow-lg">
              Source: {imgNaturalSize.width} × {imgNaturalSize.height}
            </div>
          )}

          {/* Floating Studio Quick Zoom Bar */}
          <div 
            data-interactive-wheel="true"
            className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 p-1 rounded-xl bg-black/85 backdrop-blur-md border border-white/15 shadow-xl select-none"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoom((prev) => Math.max(minZoom, +(prev - 0.15).toFixed(2)));
              }}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <div className="w-16 sm:w-24 px-1 flex items-center">
              <input
                type="range"
                min={minZoom}
                max={4}
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-[#E78023] cursor-pointer h-1.5 bg-white/20 rounded-lg"
                title="Adjust Zoom"
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoom((prev) => Math.min(4.0, +(prev + 0.15).toFixed(2)));
              }}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 text-[10px] font-mono font-bold text-amber-300 transition-all cursor-pointer"
              title="Click to reset zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
          </div>
        </div>

        {/* Professional Control Console (Tabbed: Scale & Crop, Straighten & Flip) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          
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
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                title="Fit entire image into frame"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={handleFill}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                title="Fill frame"
              >
                Fill
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
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
                  onClick={() => setZoom((prev) => Math.max(minZoom, +(prev - 0.15).toFixed(2)))}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer shadow-xs transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min={minZoom}
                  max={4}
                  step="0.01"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-[#E78023] cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(4.0, +(prev + 0.15).toFixed(2)))}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer shadow-xs transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Arrow Controls: Pan & Precision Nudge */}
              <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Move className="w-3.5 h-3.5 text-[#E78023]" />
                    <span>Arrow Controls (Pan &amp; Framing)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Offset: X: {pan.x > 0 ? `+${pan.x}` : pan.x}px • Y: {pan.y > 0 ? `+${pan.y}` : pan.y}px
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => nudge(-16, 0)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 active:bg-[#E78023]/15 active:text-[#E78023] text-slate-700 cursor-pointer transition-colors"
                      title="Nudge Left (← / A)"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => nudge(0, -16)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 active:bg-[#E78023]/15 active:text-[#E78023] text-slate-700 cursor-pointer transition-colors"
                      title="Nudge Up (↑ / W)"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => nudge(0, 16)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 active:bg-[#E78023]/15 active:text-[#E78023] text-slate-700 cursor-pointer transition-colors"
                      title="Nudge Down (↓ / S)"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => nudge(16, 0)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 active:bg-[#E78023]/15 active:text-[#E78023] text-slate-700 cursor-pointer transition-colors"
                      title="Nudge Right (→ / D)"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {(pan.x !== 0 || pan.y !== 0) && (
                    <button
                      type="button"
                      onClick={() => setPan({ x: 0, y: 0 })}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                      title="Reset Framing Position to Center (0, 0)"
                    >
                      Center
                    </button>
                  )}
                </div>
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
