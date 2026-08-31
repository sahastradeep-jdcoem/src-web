"use client";

import React, { useEffect, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";

interface ScannableQRCodeProps {
  value: string;
  size?: number;
  level?: "L" | "M" | "Q" | "H";
  fgColor?: string;
  bgColor?: string;
  includeMargin?: boolean;
  className?: string;
  renderAs?: "canvas" | "svg";
}

export function ScannableQRCode({
  value,
  size = 128,
  level = "H", // High error correction so passes scan easily even on phone screens / crumpled printouts
  fgColor = "#0F172A",
  bgColor = "#FFFFFF",
  includeMargin = true,
  className = "",
  renderAs = "canvas",
}: ScannableQRCodeProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div 
        style={{ width: size, height: size }} 
        className={`bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-[10px] text-slate-400 font-mono ${className}`}
      >
        QR
      </div>
    );
  }

  // Fallback to minimal payload if empty string
  const cleanValue = value && value.trim().length > 0 ? value : "SRC-JDCOEM-PASS-ACCREDITATION";

  if (renderAs === "svg") {
    return (
      <QRCodeSVG
        value={cleanValue}
        size={size}
        level={level}
        fgColor={fgColor}
        bgColor={bgColor}
        includeMargin={includeMargin}
        className={className}
      />
    );
  }

  return (
    <QRCodeCanvas
      value={cleanValue}
      size={size}
      level={level}
      fgColor={fgColor}
      bgColor={bgColor}
      includeMargin={includeMargin}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
