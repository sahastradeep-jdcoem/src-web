"use client";

import React, { useState, useEffect } from "react";
import { 
  CreditCard, 
  Check, 
  X, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  ExternalLink,
  Copy,
  Lock,
  Server,
  Zap,
  CheckCircle2,
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

interface PaymentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ServerGatewayStatus {
  configured: boolean;
  hasAppId: boolean;
  hasSecretKey: boolean;
  appIdMasked: string;
  environment: "TEST" | "PROD";
  source: string;
}

export function PaymentConfigModal({ isOpen, onClose }: PaymentConfigModalProps) {
  const [config, setConfig] = useState<PaymentConfig>(getStoredPaymentConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Server-side Vercel gateway status
  const [serverStatus, setServerStatus] = useState<ServerGatewayStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  
  // Cashfree Testing State
  const [isTestingCashfree, setIsTestingCashfree] = useState(false);
  const [cashfreeTestResult, setCashfreeTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setConfig(getStoredPaymentConfig());
    const unsub = subscribeToPaymentConfig((updated) => {
      setConfig(updated);
    });
    return unsub;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingStatus(true);
      fetch("/api/cashfree/status")
        .then((res) => res.json())
        .then((data) => setServerStatus(data))
        .catch((err) => console.warn("Failed to fetch gateway status:", err))
        .finally(() => setIsLoadingStatus(false));
    }
  }, [isOpen]);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin.replace("://srcjdcoem.in", "://www.srcjdcoem.in")}/api/cashfree/webhook`
    : "https://www.srcjdcoem.in/api/cashfree/webhook";

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const handleTestCashfree = async () => {
    setIsTestingCashfree(true);
    setCashfreeTestResult(null);
    try {
      const res = await fetch("/api/cashfree/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 1,
          eventName: "Cashfree Connection Ping",
          participantName: "SRC Gateway Verification",
          email: "srcjdcoem@gmail.com",
          phone: "9529441964",
          registrationId: "TEST-PING",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCashfreeTestResult({
          success: true,
          message: `Connection Verified! Successfully connected to Cashfree ${data.environment || "API"} mode using Vercel credentials. Generated Session: ${data.orderId}`,
        });
      } else {
        setCashfreeTestResult({
          success: false,
          message: `Cashfree Error: ${data.error || "Authentication failed. Check your Vercel CASHFREE_APP_ID and CASHFREE_SECRET_KEY."}`,
        });
      }
    } catch (err: any) {
      setCashfreeTestResult({
        success: false,
        message: `Network Error: ${err.message || "Could not reach Cashfree endpoint."}`,
      });
    } finally {
      setIsTestingCashfree(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updatePaymentConfig({
        isGatewayActive: config.isGatewayActive,
        instructions: config.instructions,
      }, "Admin / Treasurer");
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
      setTimeout(() => onClose(), 600);
    } catch (err) {
      alert("Failed to save payment configuration. Please check your connection.");
    } finally {
      setIsSaving(false);
    }
  };

  const activeEnv = serverStatus?.environment || "PROD";
  const isConfigured = serverStatus?.configured;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cashfree Payment Gateway Settings"
      subtitle="Gateway credentials and environment modes are securely handled exclusively via Vercel."
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* Header Status Bar */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#17458F] text-white flex items-center justify-center font-bold text-xs shadow-sm uppercase">
              CF
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-heading font-extrabold text-sm text-slate-900">
                  Cashfree Payment Gateway
                </h4>
                <Badge variant={config.isGatewayActive ? "success" : "slate"} size="sm">
                  {config.isGatewayActive ? "GATEWAY LIVE" : "PAUSED"}
                </Badge>
                <Badge variant={activeEnv === "PROD" ? "orange" : "navy"} size="sm">
                  {activeEnv === "PROD" ? "PRODUCTION LIVE" : "TEST SANDBOX"}
                </Badge>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  Vercel Managed
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Official checkout engine for UPI, Credit/Debit Cards & Netbanking
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleTestCashfree}
            disabled={isTestingCashfree}
            className="text-xs border-[#17458F] text-[#17458F] hover:bg-blue-50 font-bold shrink-0"
          >
            {isTestingCashfree ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                Test Connection
              </>
            )}
          </Button>
        </div>

        {/* Test Result Toast */}
        {cashfreeTestResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all animate-in fade-in-50 duration-200 ${
              cashfreeTestResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            {cashfreeTestResult.success ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 leading-relaxed">
              <span className="font-bold">{cashfreeTestResult.success ? "Success: " : "Error: "}</span>
              {cashfreeTestResult.message}
            </div>
          </div>
        )}

        {/* Vercel Environment Authoritative Credentials Box */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-sm border border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                  Credentials Source: Vercel Environment Variables
                </span>
                <span className="block text-[11px] text-slate-400">
                  Stored securely on server • Never exposed to client browsers or Firestore
                </span>
              </div>
            </div>
            {isLoadingStatus ? (
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <RefreshCw className="w-3 h-3 animate-spin" /> Verifying...
              </span>
            ) : isConfigured ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/80">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/80 px-2.5 py-1 rounded-full border border-rose-800/80">
                <AlertCircle className="w-3.5 h-3.5" /> Missing in Vercel
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80">
              <span className="text-slate-400 font-mono text-[10px] block uppercase">CASHFREE_ENVIRONMENT</span>
              <span className="text-sm font-bold text-white font-mono flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${activeEnv === "PROD" ? "bg-amber-400 animate-pulse" : "bg-blue-400"}`} />
                {activeEnv === "PROD" ? "PROD (Production)" : "TEST (Sandbox)"}
              </span>
            </div>

            <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80">
              <span className="text-slate-400 font-mono text-[10px] block uppercase">CASHFREE_APP_ID</span>
              <span className="text-sm font-bold text-slate-200 font-mono mt-0.5 block truncate">
                {serverStatus?.appIdMasked || "Configured via Vercel"}
              </span>
            </div>

            <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700/80">
              <span className="text-slate-400 font-mono text-[10px] block uppercase">CASHFREE_SECRET_KEY</span>
              <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
                ••••••••••••••••
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            To switch environments or update keys, update variables in your{" "}
            <strong className="text-slate-200">Vercel Project Dashboard → Settings → Environment Variables</strong>.
            Changes take effect on your next deployment with zero risk of client-side credential exposure.
          </p>
        </div>

        {/* Operational Form Settings */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Checkout Operational Status */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Public Checkout Toggle
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfig({ ...config, isGatewayActive: true })}
                className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  config.isGatewayActive
                    ? "bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-200"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                ✓ Active (Accepting Registrations & Payments)
              </button>
              <button
                type="button"
                onClick={() => setConfig({ ...config, isGatewayActive: false })}
                className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  !config.isGatewayActive
                    ? "bg-rose-50 border-rose-400 text-rose-900 ring-2 ring-rose-200"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                ✕ Paused (Maintenance Mode)
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Toggle this if you need to pause online checkout without taking the website or event pages offline.
            </p>
          </div>

          {/* Checkout Instructions Notice */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Student Checkout Notice / Subtitle
            </label>
            <input
              type="text"
              value={config.instructions || ""}
              onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
              placeholder="e.g. Instant online checkout powered by Cashfree (UPI, Cards, Netbanking)."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#17458F] focus:border-transparent"
            />
          </div>

          {/* Webhook Configuration Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-blue-900" />
                Cashfree Webhook Endpoint
              </span>
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="text-xs font-bold text-[#17458F] hover:underline flex items-center gap-1"
              >
                {copiedWebhook ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedWebhook ? "Copied!" : "Copy URL"}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Paste this in your <strong>Cashfree Dashboard → Developers → Webhooks</strong> to receive automatic instant payment notifications:
            </p>
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-xs text-slate-700 select-all break-all">
              {webhookUrl}
            </div>
            <div className="text-[11px] text-slate-500">
              API Version: <span className="font-semibold text-slate-700">2023-08-01</span> • Events: <span className="font-semibold text-slate-700">PAYMENT_SUCCESS_WEBHOOK</span>, <span className="font-semibold text-slate-700">ORDER_PAID_WEBHOOK</span>, <span className="font-semibold text-slate-700">PAYMENT_FAILED_WEBHOOK</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <span className="text-[11px] text-slate-400">
              {config.updatedAt ? `Last saved: ${new Date(config.updatedAt).toLocaleTimeString()}` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving}
                className="bg-[#17458F] hover:bg-[#11336c]"
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        </form>

        {/* Saved Success Toast */}
        {showSavedToast && (
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold text-center border border-emerald-200">
            ✓ Settings saved successfully to cloud and distributed to all visitors!
          </div>
        )}
      </div>
    </Modal>
  );
}
