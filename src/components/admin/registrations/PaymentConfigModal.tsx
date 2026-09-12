"use client";

import React, { useState, useEffect } from "react";
import { 
  CreditCard, 
  Check, 
  X, 
  QrCode, 
  Building2, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { 
  PaymentConfig, 
  getStoredPaymentConfig, 
  updatePaymentConfig, 
  subscribeToPaymentConfig 
} from "@/lib/paymentConfigStore";
import { ScannableQRCode } from "@/components/ui/ScannableQRCode";

interface PaymentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentConfigModal({ isOpen, onClose }: PaymentConfigModalProps) {
  const [config, setConfig] = useState<PaymentConfig>(getStoredPaymentConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [activeTab, setActiveTab] = useState<"credentials" | "preview">("credentials");

  useEffect(() => {
    setConfig(getStoredPaymentConfig());
    const unsub = subscribeToPaymentConfig((updated) => {
      setConfig(updated);
    });
    return unsub;
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updatePaymentConfig(config, "Admin / Treasurer");
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
      setTimeout(() => onClose(), 600);
    } catch (err) {
      alert("Failed to save payment configuration to cloud. Please check connection.");
    } finally {
      setIsSaving(false);
    }
  };

  const sampleUpiLink = `upi://pay?pa=${config.upiId || "8237981028@paytm"}&pn=${encodeURIComponent(config.payeeName || "SRC JDCOEM")}&am=100.00&cu=INR&tn=TEST%20VERIFICATION`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Gateway & Treasurer UPI Settings"
      subtitle="Manage Paytm for Business credentials, active Treasurer UPI account, and student payment instructions."
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Header Mode Status */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002970] text-white flex items-center justify-center font-bold text-sm shadow-sm">
              Paytm
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-heading font-extrabold text-sm text-slate-900">
                  Paytm for Business Gateway
                </h4>
                <Badge variant={config.isGatewayActive ? "success" : "slate"} size="sm">
                  {config.isGatewayActive ? "ACTIVE" : "PAUSED"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Direct bank settlement with 0% UPI transaction fees
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("credentials")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "credentials"
                  ? "bg-white text-blue-900 shadow-sm border border-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Credentials
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "preview"
                  ? "bg-white text-blue-900 shadow-sm border border-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Live QR Preview
            </button>
          </div>
        </div>

        {activeTab === "credentials" ? (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Active Treasurer UPI ID */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Active Treasurer UPI ID (VPA) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. 8237981028@paytm or yourname@okaxis"
                  value={config.upiId}
                  onChange={(e) => setConfig({ ...config, upiId: e.target.value.trim() })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002970]/30 focus:border-[#002970]"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                All QR codes and 1-tap mobile checkout links will route payments directly to this UPI address.
              </p>
            </div>

            {/* Payee Display Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Payee Display Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SRC JDCOEM or Nishant Bobade"
                value={config.payeeName}
                onChange={(e) => setConfig({ ...config, payeeName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002970]/30 focus:border-[#002970]"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                The official merchant name displayed to students in Google Pay, PhonePe, and Paytm.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Paytm Merchant ID (MID) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Paytm Merchant ID (MID)
                </label>
                <input
                  type="text"
                  placeholder="From Paytm Business App/Dashboard"
                  value={config.paytmMid}
                  onChange={(e) => setConfig({ ...config, paytmMid: e.target.value.trim() })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002970]/30 focus:border-[#002970]"
                />
              </div>

              {/* Paytm Merchant Key */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Paytm Merchant Key
                </label>
                <input
                  type="password"
                  placeholder="Secret API Key (Optional / Server-Only)"
                  value={config.paytmMerchantKey}
                  onChange={(e) => setConfig({ ...config, paytmMerchantKey: e.target.value.trim() })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002970]/30 focus:border-[#002970]"
                />
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Student Payment Instructions
              </label>
              <textarea
                rows={2}
                value={config.instructions || ""}
                onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002970]/30"
              />
            </div>

            {/* Gateway Toggle */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  Enable Online Registrations &amp; Gateway
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Allow students to register and pay delegate fees for live events
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.isGatewayActive}
                  onChange={(e) => setConfig({ ...config, isGatewayActive: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#002970]"></div>
              </label>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <span className="text-[11px] text-slate-400">
                Last modified: {config.updatedAt ? new Date(config.updatedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}
              </span>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                  <Check className="w-4 h-4 mr-1" />
                  Save Payment Settings
                </Button>
              </div>
            </div>
          </form>
        ) : (
          /* Live QR Preview Tab */
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
            <div className="inline-block p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
              <ScannableQRCode value={sampleUpiLink} size={180} />
            </div>
            <div>
              <h5 className="font-bold text-slate-900 text-sm">
                {config.payeeName || "SRC JDCOEM"}
              </h5>
              <p className="font-mono text-xs text-blue-700 font-bold mt-0.5">
                {config.upiId || "8237981028@paytm"}
              </p>
              <p className="text-[11px] text-slate-500 mt-2 max-w-sm mx-auto">
                Scan this QR with any UPI app to verify that payments resolve to Nishant&apos;s bank account correctly.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
