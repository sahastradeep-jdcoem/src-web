"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  contentClassName?: string;
  headerAction?: React.ReactNode;
}

// Module-level state to manage nested / multi-modal scroll locks cleanly
let activeModalCount = 0;
let originalBodyOverflow = "";
let originalHtmlOverflow = "";
let originalBodyPaddingRight = "";

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "lg",
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  contentClassName,
  headerAction,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeOnEscapeRef = useRef(closeOnEscape);
  closeOnEscapeRef.current = closeOnEscape;

  useEffect(() => {
    if (!isOpen) return;

    // 1. Lock background scrolling (both body and html)
    if (activeModalCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      originalHtmlOverflow = document.documentElement.style.overflow;
      originalBodyPaddingRight = document.body.style.paddingRight;

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }
    activeModalCount++;

    // 2. Keyboard handler (Escape + Tab focus trapping)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (closeOnEscapeRef.current) {
          onCloseRef.current();
        }
        return;
      }

      // Prevent Space or Arrow keys from scrolling the background if focus is not in an editable element
      if (
        (e.key === " " || e.key === "PageUp" || e.key === "PageDown") &&
        !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)
      ) {
        if (!modalRef.current?.contains(e.target as Node)) {
          e.preventDefault();
        }
      }

      // Accessible Focus Trapping
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    // 3. Strict Mouse Wheel & Trackpad Interception:
    // Ensures scroll is ONLY active within the modal dialog box and never leaks to the background.
    const handleWheel = (e: WheelEvent) => {
      // If mouse is outside the modal dialog (e.g. over the darkened backdrop or margin areas):
      if (!modalRef.current || !modalRef.current.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // If mouse is inside an element that handles its own wheel events (e.g. Image Cropper zoom, custom canvas):
      let el = e.target as HTMLElement | null;
      if (el?.closest("[data-cropper-viewport]") || el?.closest("[data-interactive-wheel]")) {
        return; // Allow wheel event to reach the local component for zooming
      }

      // If mouse is inside the modal dialog: check if the pointer is over a scrollable element
      let scrollableEl: HTMLElement | null = null;

      while (el && el !== modalRef.current.parentElement) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollableType = overflowY === "auto" || overflowY === "scroll";
        if (isScrollableType && el.scrollHeight > el.clientHeight) {
          scrollableEl = el;
          break;
        }
        if (el === modalRef.current) break;
        el = el.parentElement;
      }

      // If mouse is over a non-scrollable part of the modal (header, footer, buttons, margins):
      if (!scrollableEl) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Check boundaries to prevent scroll chaining to the background
      const { scrollTop, scrollHeight, clientHeight } = scrollableEl;
      const isScrollingUp = e.deltaY < 0;
      const isScrollingDown = e.deltaY > 0;

      const isAtTop = scrollTop <= 0;
      const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight - 1;

      if ((isScrollingUp && isAtTop) || (isScrollingDown && isAtBottom)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 4. Touch move interception for mobile / touchpads
    const handleTouchMove = (e: TouchEvent) => {
      if (!modalRef.current || !modalRef.current.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.body.style.overflow = originalBodyOverflow || "unset";
        document.documentElement.style.overflow = originalHtmlOverflow || "unset";
        document.body.style.paddingRight = originalBodyPaddingRight || "";
      }
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex justify-center items-center overflow-y-auto overflow-x-hidden overscroll-contain select-none modal-overlay-container"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-headline-title" : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        ref={modalRef}
        className={cn(
          "relative w-full max-w-full min-w-0 bg-white border border-slate-200 rounded-3xl shadow-2xl z-10 my-auto flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden text-slate-800 overscroll-contain select-text shrink-0 modal-dialog-card",
          maxWidthClasses[maxWidth]
        )}
      >
        {/* Header - render dedicated header bar only when title or subtitle is supplied */}
        {(title || subtitle) ? (
          <div className="flex items-start justify-between gap-4 p-5 sm:px-7 sm:py-5 border-b border-slate-100 bg-white shrink-0 z-10 select-none">
            <div>
              {title && (
                <h3 
                  id="modal-headline-title"
                  className="font-heading font-extrabold text-lg sm:text-xl text-[#17458F] tracking-wide"
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              {headerAction}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="p-2.5 min-w-[44px] min-h-[44px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          showCloseButton && (
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 p-2 min-w-[44px] min-h-[44px] rounded-full bg-slate-100/90 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center shadow-xs"
            >
              <X className="w-4 h-4" />
            </button>
          )
        )}

        {/* Content - strictly scrollable and overscroll-contained */}
        <div 
          className={cn(
            "p-5 sm:p-7 overflow-y-auto flex-1 min-h-0 overscroll-contain min-w-0 max-w-full", 
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
