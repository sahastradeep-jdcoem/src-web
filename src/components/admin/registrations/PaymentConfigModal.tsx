"use client";

import React, { useState, useEffect } from "react";
import { 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Copy, 
  Lock, 
  Server, 
  Zap, 
  ShieldCheck, 
  CheckCircle2, 
  SlidersHorizontal 
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
      maxWidth="3xl"
    >
      <div className="space-y-5 p-1 sm:p-2">
        {/* Header Status Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-slate-50 border border-blue-200/70 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#17458F] text-white flex items-center justify-center font-extrabold text-sm shadow-md shrink-0 uppercase tracking-wider">
              CF
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-heading font-extrabold text-base text-slate-900 tracking-tight">
                  Cashfree Payment Gateway
                </h4>
                <Badge variant={config.isGatewayActive ? "success" : "slate"} size="sm">
                  {config.isGatewayActive ? "GATEWAY LIVE" : "PAUSED"}
                </Badge>
                <Badge variant={activeEnv === "PROD" ? "orange" : "navy"} size="sm">
                  {activeEnv === "PROD" ? "PRODUCTION LIVE" : "TEST SANDBOX"}
                </Badge>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/90 text-slate-700 border border-slate-200/90 shadow-2xs">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  Vercel Managed
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Institutional checkout engine for UPI, Credit/Debit Cards, Netbanking & Wallets
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleTestCashfree}
            disabled={isTestingCashfree}
            className="text-xs border-[#17458F] text-[#17458F] hover:bg-blue-50 font-bold shrink-0 self-start md:self-center shadow-2xs"
          >
            {isTestingCashfree ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Testing Gateway...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-500 fill-amber-500" />
                Test Connection
              </>
            )}
          </Button>
        </div>

        {/* Test Result Toast */}
        {cashfreeTestResult && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-start gap-3 transition-all animate-in fade-in-50 duration-200 shadow-2xs ${
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

        {/* Vercel Server Environment Panel */}
        <div className="p-5 rounded-2xl bg-slate-950 text-white space-y-4 shadow-md border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs uppercase tracking-wider text-slate-100 flex items-center gap-2">
                  Credentials Source: Vercel Environment Variables
                </span>
                <span className="block text-[11px] text-slate-400 font-medium">
                  Authoritative server configuration • Never exposed to client bundles or Firestore
                </span>
              </div>
            </div>

            {isLoadingStatus ? (
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" /> Verifying Vercel env...
              </span>
            ) : isConfigured ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/90 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected &amp; Authenticated
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-400 bg-rose-950/80 px-3 py-1 rounded-full border border-rose-800/90 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5" /> Missing in Vercel
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 font-mono text-[10px] block uppercase tracking-wider font-semibold">
                CASHFREE_ENVIRONMENT
              </span>
              <div className="text-sm font-bold text-white font-mono flex items-center gap-2 pt-0.5">
                <span className={`w-2 h-2 rounded-full ${activeEnv === "PROD" ? "bg-amber-400 animate-pulse" : "bg-blue-400"}`} />
                <span>{activeEnv === "PROD" ? "PROD (Production Live)" : "TEST (Sandbox)"}</span>
              </div>
              <span className="text-[10px] text-slate-500 block pt-0.5">Managed in Vercel</span>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 font-mono text-[10px] block uppercase tracking-wider font-semibold">
                CASHFREE_APP_ID
              </span>
              <div className="text-sm font-bold text-slate-200 font-mono pt-0.5 truncate" title={serverStatus?.appIdMasked}>
                {serverStatus?.appIdMasked || "Configured in Vercel"}
              </div>
              <span className="text-[10px] text-slate-500 block pt-0.5">Client ID</span>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 font-mono text-[10px] block uppercase tracking-wider font-semibold">
                CASHFREE_SECRET_KEY
              </span>
              <div className="text-sm font-bold text-emerald-400 font-mono pt-0.5 tracking-wider">
                ••••••••••••••••
              </div>
              <span className="text-[10px] text-slate-500 block pt-0.5">Encrypted Server Secret</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
            To switch environments or update API keys, visit{" "}
            <strong className="text-slate-200">Vercel Project Dashboard → Settings → Environment Variables</strong>.
            Credentials are encrypted at rest and never transmitted to the browser.
          </div>
        </div>

        {/* Operational Form Settings */}
        <form onSubmit={handleSave} className="space-y-4 pt-1">
          {/* Public Checkout Status Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Public Checkout Operational State
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Controls student checkout access</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfig({ ...config, isGatewayActive: true })}
                className={`py-3 px-4 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  config.isGatewayActive
                    ? "bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-200 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 ${config.isGatewayActive ? "text-emerald-600" : "text-slate-400"}`} />
                <span>Active — Accepting Registrations &amp; Payments</span>
              </button>

              <button
                type="button"
                onClick={() => setConfig({ ...config, isGatewayActive: false })}
                className={`py-3 px-4 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  !config.isGatewayActive
                    ? "bg-rose-50 border-rose-400 text-rose-950 ring-2 ring-rose-200 shadow-2xs"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <AlertCircle className={`w-4 h-4 ${!config.isGatewayActive ? "text-rose-600" : "text-slate-400"}`} />
                <span>Paused — Checkout Under Maintenance</span>
              </button>
            </div>
          </div>

          {/* Checkout Instructions Notice */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Student Checkout Banner Subtitle
            </label>
            <input
              type="text"
              value={config.instructions || ""}
              onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
              placeholder="e.g. Instant online checkout powered by Cashfree (UPI, Cards, Netbanking)."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#17458F] focus:border-transparent transition-all shadow-2xs"
            />
            <p className="text-[11px] text-slate-400 font-medium">
              Displayed to students directly in the checkout payment modal.
            </p>
          </div>

          {/* Webhook Configuration Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-900" />
                Cashfree Webhook Endpoint
              </span>
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="text-xs font-bold text-[#17458F] hover:text-[#11336c] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWebhook ? "Copied URL!" : "Copy Webhook URL"}</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Add this endpoint in your <strong className="text-slate-800">Cashfree Dashboard → Developers → Webhooks</strong> to receive sub-second payment status webhooks:
            </p>

            <div className="p-3 rounded-xl bg-white border border-slate-200 font-mono text-xs text-slate-800 select-all break-all shadow-2xs flex items-center justify-between gap-2">
              <span className="truncate">{webhookUrl}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-0.5 text-[11px] text-slate-500 font-medium">
              <span>API Version: <strong className="text-slate-700 font-mono">2023-08-01</strong></span>
              <span>•</span>
              <span>Subscribed Events:</span>
              <span className="px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-mono text-[10px]">PAYMENT_SUCCESS_WEBHOOK</span>
              <span className="px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-mono text-[10px]">ORDER_PAID_WEBHOOK</span>
              <span className="px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-mono text-[10px]">PAYMENT_FAILED_WEBHOOK</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-medium">
              {config.updatedAt ? `Last saved: ${new Date(config.updatedAt).toLocaleTimeString("en-IN")}` : ""}
            </span>
            <div className="flex items-center gap-2.5">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs font-semibold px-4">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving}
                className="bg-[#17458F] hover:bg-[#11336c] text-xs font-bold px-5 shadow-xs"
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        </form>

        {/* Saved Success Toast */}
        {showSavedToast && (
          <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold text-center border border-emerald-200 animate-in fade-in duration-200 shadow-2xs">
            ✓ Settings saved successfully and broadcast across all visitor checkout screens!
          </div>
        )}
      </div>
    </Modal>
  );
}
