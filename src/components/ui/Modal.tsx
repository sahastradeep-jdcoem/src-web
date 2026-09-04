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
}

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
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (closeOnEscape) {
          onClose();
        }
        return;
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

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
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
          "relative w-full bg-white border border-slate-200 rounded-3xl shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden text-slate-800",
          maxWidthClasses[maxWidth]
        )}
      >
        {/* Header - render dedicated header bar only when title or subtitle is supplied */}
        {(title || subtitle) ? (
          <div className="flex items-start justify-between gap-4 p-5 sm:px-7 sm:py-5 border-b border-slate-100 bg-white shrink-0 z-10">
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
            {showCloseButton && (
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="p-2.5 min-w-[40px] min-h-[40px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          showCloseButton && (
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 p-2 min-w-[36px] min-h-[36px] rounded-full bg-slate-100/90 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer flex items-center justify-center shadow-xs"
            >
              <X className="w-4 h-4" />
            </button>
          )
        )}

        {/* Content */}
        <div className={cn("p-5 sm:p-7 overflow-y-auto flex-1", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
