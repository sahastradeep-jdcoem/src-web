"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ExternalLink,
  ShieldCheck,
  ArrowRight
} from "lucide-react";

interface SyncCashfreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (registration: any) => void;
}

export function SyncCashfreeModal({ isOpen, onClose, onSuccess }: SyncCashfreeModalProps) {
  const [orderInput, setOrderInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    registration?: any;
    error?: string;
  } | null>(null);

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = orderInput.trim();
    if (!cleanId) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/cashfree/recover-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: cleanId }),
      });

      const data = await res.json();

      if (data.success && data.results && data.results[0]?.success) {
        const item = data.results[0];
        setResult({
          success: true,
          message: `Successfully verified & synced pass for ${item.registration?.participantName || "Student"}!`,
          registration: item.registration,
        });

        if (onSuccess && item.registration) {
          onSuccess(item.registration);
        }

        // Broadcast cross-tab update
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("src_registrations_updated", {
              detail: [item.registration],
            })
          );
        }
      } else {
        const errMsg = data.results?.[0]?.error || data.error || "Order not found or payment incomplete on Cashfree.";
        setResult({
          success: false,
          message: errMsg,
          error: errMsg,
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || "Network error syncing with Cashfree API.",
        error: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setOrderInput("");
    setResult(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Sync Cashfree Payment Order"
      maxWidth="lg"
    >
      <div className="space-y-5 text-slate-800 text-xs">
        <p className="text-slate-500 leading-relaxed">
          If a student completed payment on Cashfree but their pass did not automatically appear (e.g. mobile browser closed or network dip), enter their <strong>Cashfree Order ID</strong> below to instantly verify with Cashfree and issue their confirmed pass.
        </p>

        <form onSubmit={handleSync} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Cashfree Order ID
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. SRC_RCDAN263... or full order ID"
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
                disabled={isLoading}
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#17458F] focus:bg-white transition-all"
                autoFocus
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <p className="text-[10px] text-slate-400">
              Find this in your Cashfree Merchant Dashboard under <em>Transactions → Payments</em> or <em>Orders</em>.
            </p>
          </div>

          {/* Result Alert */}
          {result && (
            <div
              className={`p-3.5 rounded-2xl border flex items-start gap-2.5 ${
                result.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 min-w-0 flex-1">
                <p className="font-bold text-xs">{result.message}</p>
                {result.registration && (
                  <div className="text-[11px] space-y-0.5 pt-1 border-t border-emerald-200/60 font-mono">
                    <p><strong>Pass ID:</strong> {result.registration.id}</p>
                    <p><strong>Event:</strong> {result.registration.eventName}</p>
                    <p><strong>BT ID:</strong> {result.registration.btId || "N/A"}</p>
                    <p><strong>Amount:</strong> ₹{result.registration.amountPaid}</p>
                    <p><strong>Bank Ref / UTR:</strong> {result.registration.paymentId}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isLoading || !orderInput.trim()}
              className="px-4 py-2 rounded-xl bg-[#17458F] hover:bg-[#123670] disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying with Cashfree...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
                  <span>Verify &amp; Issue Pass</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
