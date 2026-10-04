"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// ============================================================================
// DEFENSIVE SAFEGUARD: PROTECT NEXT.JS APP ROUTER HISTORY STATE
// In Next.js 15 App Router, window.history.state contains critical router
// metadata (__NA, tree, etc.). If any script calls replaceState or pushState
// with null or an empty object, client-side navigation permanently dies until
// full page refresh. This interceptor guarantees Next.js state is never wiped.
// ============================================================================
if (typeof window !== "undefined") {
  const originalReplaceState = window.history.replaceState;
  const originalPushState = window.history.pushState;

  window.history.replaceState = function (data: any, unused: string, url?: string | URL | null) {
    const existing = window.history.state;
    let safeData = data;
    if (existing && typeof existing === "object") {
      const isNextJsExisting = "__NA" in existing || "tree" in existing;
      const incomingHasNextState = data && typeof data === "object" && ("__NA" in data || "tree" in data);
      if (isNextJsExisting && !incomingHasNextState) {
        safeData = data && typeof data === "object" ? { ...existing, ...data } : existing;
      }
    }
    return originalReplaceState.call(this, safeData, unused, url);
  };

  window.history.pushState = function (data: any, unused: string, url?: string | URL | null) {
    const existing = window.history.state;
    let safeData = data;
    if (existing && typeof existing === "object") {
      const isNextJsExisting = "__NA" in existing || "tree" in existing;
      const incomingHasNextState = data && typeof data === "object" && ("__NA" in data || "tree" in data);
      if (isNextJsExisting && !incomingHasNextState) {
        safeData = data && typeof data === "object" ? { ...existing, ...data } : existing;
      }
    }
    return originalPushState.call(this, safeData, unused, url);
  };
}

export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

    setIsNavigating(true);
    setProgress(18);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 60) return prev + 12;
        if (prev < 85) return prev + 4;
        return prev;
      });
    }, 120);

    // Safety timeout: if page doesn't change in 8s, stop
    safetyTimeoutRef.current = setTimeout(() => {
      completeProgress();
    }, 8000);
  };

  const completeProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

    setProgress(100);
    const fadeTimer = setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
    }, 250);

    return () => clearTimeout(fadeTimer);
  };

  // Complete progress whenever route path or query changes
  useEffect(() => {
    completeProgress();
  }, [pathname, searchParams]);

  // Intercept click on links for instant tactile feedback
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore external URLs, mailto, tel, hash anchors, new tabs, modifier keys, or already prevented clicks
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.defaultPrevented
      ) {
        return;
      }

      // Check if it's the exact same URL
      const currentUrl = window.location.pathname + window.location.search;
      if (href === currentUrl || href === window.location.pathname) {
        return;
      }

      // Start navigation indicator immediately
      startProgress();
    };

    const handlePopState = () => {
      startProgress();
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleDocumentClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      if (timerRef.current) clearInterval(timerRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  if (!isNavigating && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-label="Navigation loading indicator"
      className="fixed top-0 left-0 right-0 z-[999999] pointer-events-none h-[3px] bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-[#17458F] via-[#E78023] to-[#F59E0B] shadow-[0_0_10px_rgba(231,128,35,0.7)] transition-all duration-150 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transitionProperty: "width, opacity",
          transitionDuration: progress === 100 ? "250ms" : "150ms",
        }}
      />
    </div>
  );
}
