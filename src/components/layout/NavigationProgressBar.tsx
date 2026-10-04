"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const failSafeRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTargetRef = useRef<string | null>(null);

  const startProgress = (targetUrl?: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (failSafeRef.current) clearTimeout(failSafeRef.current);

    if (targetUrl) {
      pendingTargetRef.current = targetUrl;
    }

    setIsNavigating(true);
    setProgress(20);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 65) return prev + 15;
        if (prev < 85) return prev + 3;
        return prev;
      });
    }, 100);

    // Fail-Safe Auto-Recovery:
    // If a soft Next.js App Router transition hangs or freezes for > 2.8 seconds,
    // seamlessly execute native browser navigation so the user NEVER stays stuck.
    if (targetUrl) {
      failSafeRef.current = setTimeout(() => {
        if (typeof window !== "undefined") {
          const currentFullUrl = window.location.pathname + window.location.search;
          const targetClean = targetUrl.split("#")[0];
          if (currentFullUrl !== targetClean && window.location.pathname !== targetClean.split("?")[0]) {
            console.warn("Soft transition stalled; performing direct navigation fallback to:", targetUrl);
            window.location.assign(targetUrl);
          } else {
            completeProgress();
          }
        }
      }, 2800);
    }
  };

  const completeProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (failSafeRef.current) clearTimeout(failSafeRef.current);
    pendingTargetRef.current = null;

    setProgress(100);
    setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
    }, 250);
  };

  // Complete progress whenever route path or query changes
  useEffect(() => {
    completeProgress();
  }, [pathname, searchParams]);

  // Intercept click on links for instant tactile feedback & fail-safe fallback
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

      // Start navigation indicator & fail-safe timer
      startProgress(href);
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
      if (failSafeRef.current) clearTimeout(failSafeRef.current);
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
