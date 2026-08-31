"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { toast, ToastMessage } from "@/lib/toastStore";

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return toast.subscribe((updated) => {
      setToasts(updated);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((t) => {
        const isSuccess = t.type === "success";
        const isError = t.type === "error";
        const isWarning = t.type === "warning";

        const bgStyle = isSuccess
          ? "bg-slate-900 text-white border-emerald-500/40"
          : isError
          ? "bg-slate-900 text-white border-rose-500/40"
          : isWarning
          ? "bg-slate-900 text-white border-amber-500/40"
          : "bg-slate-900 text-white border-blue-500/40";

        const icon = isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        ) : isError ? (
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        ) : isWarning ? (
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        ) : (
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        );

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 ${bgStyle}`}
          >
            <div className="flex items-start gap-3">
              {icon}
              <div className="space-y-0.5">
                {t.title && (
                  <h4 className="text-xs font-bold font-heading text-white">
                    {t.title}
                  </h4>
                )}
                <p className="text-xs text-slate-200 font-medium leading-relaxed">
                  {t.message}
                </p>
              </div>
            </div>

            <button
              onClick={() => toast.dismiss(t.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
