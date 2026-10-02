"use client";

import Image, { type ImageProps } from "next/image";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type ResilientImageProps = Omit<ImageProps, "src" | "onError"> & {
  src?: string | null;
  backupUrl?: string | null;
  initials?: string;
  fallback?: React.ReactNode;
  fallbackClassName?: string;
  showMissingAssetIndicator?: boolean;
};

/** An image that keeps its reserved box when a remote asset disappears. */
export function ResilientImage({
  src,
  backupUrl,
  initials,
  fallback,
  fallbackClassName,
  showMissingAssetIndicator = true,
  alt,
  className,
  ...imageProps
}: ResilientImageProps) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const primaryUrl = src?.trim() || "";
  const secondaryUrl = backupUrl?.trim() || "";
  const candidates = useMemo(
    () => [primaryUrl, secondaryUrl].filter((url, index, urls) => url && urls.indexOf(url) === index),
    [primaryUrl, secondaryUrl],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [remoteAssetMissing, setRemoteAssetMissing] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setRemoteAssetMissing(false);
  }, [primaryUrl, secondaryUrl]);

  const activeUrl = candidates[candidateIndex];
  const displayFallback = fallback ?? (
    <span aria-hidden="true" className="font-bold tracking-wide">
      {initials || "SRC"}
    </span>
  );

  const handleError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex((index) => index + 1);
      return;
    }
    setRemoteAssetMissing(Boolean(activeUrl));
  };

  return (
    <>
      {activeUrl && !remoteAssetMissing ? (
        <Image
          {...imageProps}
          src={activeUrl}
          alt={alt}
          unoptimized={imageProps.unoptimized ?? true}
          className={className}
          onError={handleError}
        />
      ) : (
        <div
          className={cn("absolute inset-0 flex items-center justify-center", fallbackClassName)}
          role="img"
          aria-label={alt}
        >
          {displayFallback}
        </div>
      )}
      {isAdmin && showMissingAssetIndicator && remoteAssetMissing && (
        <span className="pointer-events-none absolute bottom-2 left-2 z-20 rounded bg-red-700/90 px-2 py-1 text-[10px] font-semibold leading-none text-white shadow-sm">
          Remote asset missing (404)
        </span>
      )}
    </>
  );
}
