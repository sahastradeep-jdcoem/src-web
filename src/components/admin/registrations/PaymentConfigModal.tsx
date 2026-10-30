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
  SlidersHorizontal,
  CreditCard,
  QrCode,
  Building2,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { 
  PaymentConfig, 
  PaymentGatewayType,
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

  // Instamojo Testing State
  const [isTestingInstamojo, setIsTestingInstamojo] = useState(false);
  const [instamojoTestResult, setInstamojoTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedInstamojoWebhook, setCopiedInstamojoWebhook] = useState(false);

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

  const instamojoWebhookUrl = typeof window !== "undefined"
    ? `${window.location.origin.replace("://srcjdcoem.in", "://www.srcjdcoem.in")}/api/instamojo/webhook`
    : "https://www.srcjdcoem.in/api/instamojo/webhook";

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const handleCopyInstamojoWebhook = () => {
    navigator.clipboard.writeText(instamojoWebhookUrl);
    setCopiedInstamojoWebhook(true);
    setTimeout(() => setCopiedInstamojoWebhook(false), 2500);
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

  const handleTestInstamojo = async () => {
    setIsTestingInstamojo(true);
    setInstamojoTestResult(null);
    try {
      const res = await fetch("/api/instamojo/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isTestPing: true,
          amount: 10,
          eventName: "Instamojo Connection Ping",
          participantName: "SRC Gateway Verification",
          email: "srcjdcoem@gmail.com",
          phone: "9529441964",
          registrationId: "TEST-PING",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setInstamojoTestResult({
          success: true,
          message: `Instamojo Live Gateway Verified! Successfully connected in ${data.environment || "PROD"} mode. Test Order: ${data.orderId}`,
        });
      } else {
        setInstamojoTestResult({
          success: false,
          message: `Instamojo Error: ${data.error || "Authentication failed. Check your Instamojo API keys."}`,
        });
      }
    } catch (err: any) {
      setInstamojoTestResult({
        success: false,
        message: `Network Error: ${err.message || "Could not reach Instamojo endpoint."}`,
      });
    } finally {
      setIsTestingInstamojo(false);
    }
  };

  const handleSelectGateway = (gateway: PaymentGatewayType) => {
    let updatedInstructions = config.instructions;
    if (gateway === "paytm_business") {
      updatedInstructions = "Direct instant UPI payment via Paytm for Business. Scan the dynamic QR code using any UPI app (GPay, PhonePe, Paytm).";
    } else if (gateway === "instamojo") {
      updatedInstructions = "Instant online checkout powered by Instamojo (Cards, Dynamic QR, Netbanking, UPI).";
    } else if (gateway === "cashfree") {
      updatedInstructions = "Instant online checkout powered by Cashfree (UPI, Cards, Netbanking).";
    }

    setConfig({
      ...config,
      gateway,
      instructions: updatedInstructions,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updatePaymentConfig({
        gateway: config.gateway || "cashfree",
        isGatewayActive: config.isGatewayActive,
        instructions: config.instructions,
        instamojoApiKey: config.instamojoApiKey?.trim() || "23202cf45d3e1a695e8b003c7b4dada3",
        instamojoAuthToken: config.instamojoAuthToken?.trim() || "29fc0a17dad486ae928d63b2245d97fb",
        instamojoSalt: config.instamojoSalt?.trim() || "70488dd63d14427998b1cc7a65f371e0",
        instamojoEnvironment: config.instamojoEnvironment || "PROD",
        paytmMid: config.paytmMid?.trim() || "YICGYk78325672706387",
        paytmMerchantName: config.paytmMerchantName?.trim() || "SRC JDCOEM",
        paytmQrImageUrl: config.paytmQrImageUrl?.trim() || "",
        paytmUpiId: config.paytmUpiId?.trim() || "",
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
  const isCashfree = config.gateway === "cashfree";
  const isInstamojo = config.gateway === "instamojo";
  const isPaytm = config.gateway === "paytm_business";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Gateway & Checkout Provider Settings"
      subtitle="Select active payment provider and configure institutional checkout parameters."
      maxWidth="3xl"
    >
      <div className="space-y-5 p-1 sm:p-2">
        {/* PROVIDER SELECTOR TOGGLE CARDS */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Select Active Checkout Provider
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Cashfree Option */}
            <button
              type="button"
              onClick={() => handleSelectGateway("cashfree")}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                isCashfree
                  ? "bg-gradient-to-br from-blue-50/90 to-indigo-50/60 border-blue-500 ring-2 ring-blue-200/80 shadow-2xs"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
              }`}
            >
              <div>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-xs ${
                      isCashfree ? "bg-[#17458F] text-white" : "bg-slate-100 text-slate-600"
                    }`}>
                      CF
                    </div>
                    <div>
                      <div className="font-heading font-extrabold text-sm text-slate-900 tracking-tight">
                        Cashfree Payments
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">Automated Gateway</div>
                    </div>
                  </div>
                  {isCashfree ? (
                    <span className="w-5 h-5 rounded-full bg-[#17458F] text-white flex items-center justify-center text-[10px] shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full border border-slate-300" />
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed font-medium">
                  Full multi-rail checkout: UPI, Credit/Debit Cards, Netbanking &amp; auto-webhook verification.
                </p>
              </div>

              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  Cards &amp; Netbanking
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  Vercel Managed
                </span>
              </div>
            </button>

            {/* Instamojo Option */}
            <button
              type="button"
              onClick={() => handleSelectGateway("instamojo")}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                isInstamojo
                  ? "bg-gradient-to-br from-purple-50/90 to-indigo-50/60 border-purple-500 ring-2 ring-purple-200/80 shadow-2xs"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
              }`}
            >
              <div>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-xs ${
                      isInstamojo ? "bg-[#523293] text-white" : "bg-slate-100 text-slate-600"
                    }`}>
                      IM
                    </div>
                    <div>
                      <div className="font-heading font-extrabold text-sm text-slate-900 tracking-tight">
                        Instamojo Gateway
                      </div>
                      <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Approved &amp; Live
                      </div>
                    </div>
                  </div>
                  {isInstamojo ? (
                    <span className="w-5 h-5 rounded-full bg-[#523293] text-white flex items-center justify-center text-[10px] shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full border border-slate-300" />
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed font-medium">
                  Direct live checkout with Cards, Dynamic QR, Netbanking, &amp; UPI with zero approval wait.
                </p>
              </div>

              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                  Cards &amp; UPI
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  Instant Active
                </span>
              </div>
            </button>

            {/* Paytm for Business Option */}
            <button
              type="button"
              onClick={() => handleSelectGateway("paytm_business")}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                isPaytm
                  ? "bg-gradient-to-br from-indigo-50/90 to-sky-50/60 border-[#002970] ring-2 ring-indigo-200/80 shadow-2xs"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
              }`}
            >
              <div>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-xs ${
                      isPaytm ? "bg-[#002970] text-white" : "bg-slate-100 text-slate-600"
                    }`}>
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-heading font-extrabold text-sm text-slate-900 tracking-tight">
                        Paytm for Business
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">Direct Dynamic UPI QR</div>
                    </div>
                  </div>
                  {isPaytm ? (
                    <span className="w-5 h-5 rounded-full bg-[#002970] text-white flex items-center justify-center text-[10px] shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full border border-slate-300" />
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed font-medium">
                  Direct Institutional P2M UPI QR with 0% gateway commission, no bank intent block, &amp; zero downtime.
                </p>
              </div>

              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                  0% Commission
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800">
                  Paytm Merchant P2M
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* -------------------- CASHFREE PROVIDER VIEW -------------------- */}
        {isCashfree && (
          <div className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
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
                    Institutional checkout engine for UPI, Credit/Debit Cards, Netbanking &amp; Wallets
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
          </div>
        )}

        {/* ----------------- INSTAMOJO PROVIDER VIEW ----------------- */}
        {isInstamojo && (
          <div className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
            {/* Header Status Bar */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-indigo-50/80 to-slate-50 border border-purple-200/70 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#523293] text-white flex items-center justify-center font-extrabold text-sm shadow-md shrink-0 uppercase tracking-wider">
                  IM
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-heading font-extrabold text-base text-slate-900 tracking-tight">
                      Instamojo Payment Gateway
                    </h4>
                    <Badge variant={config.isGatewayActive ? "success" : "slate"} size="sm">
                      {config.isGatewayActive ? "GATEWAY LIVE" : "PAUSED"}
                    </Badge>
                    <Badge variant="purple" size="sm">
                      ACCOUNT APPROVED
                    </Badge>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/90 text-purple-800 border border-purple-200/90 shadow-2xs">
                      <Sparkles className="w-3 h-3 text-purple-600" />
                      Cards, Dynamic QR, Netbanking, UPI
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    SRC JDCOEM Sahastradeep • Direct settlement to Canara Bank on T+1 schedule
                  </p>
                </div>
              </div>

              {/* Ping Connection Button */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestInstamojo}
                  disabled={isTestingInstamojo}
                  className="bg-white hover:bg-purple-50 border-purple-200 text-purple-900 text-xs font-bold gap-2 shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingInstamojo ? "animate-spin" : ""}`} />
                  <span>{isTestingInstamojo ? "Testing Gateway..." : "Test Instamojo Connection"}</span>
                </Button>
              </div>
            </div>

            {/* Test Ping Result Alert */}
            {instamojoTestResult && (
              <div className={`p-4 rounded-xl text-xs font-bold border flex items-start gap-2.5 animate-in fade-in duration-150 ${
                instamojoTestResult.success
                  ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                  : "bg-rose-50 text-rose-900 border-rose-300"
              }`}>
                {instamojoTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div>{instamojoTestResult.message}</div>
                  {instamojoTestResult.success && (
                    <div className="text-[11px] font-normal text-emerald-700">
                      The live payment API responded with HTTP 200 and generated an active test payment link. Real payments are 100% operational!
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instamojo Credentials Setup */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h5 className="font-heading font-extrabold text-sm text-slate-900 tracking-tight">
                    Instamojo Live API Credentials
                  </h5>
                  <p className="text-[11px] text-slate-500 font-medium">
                    From your Instamojo Dashboard → API &amp; Plugins
                  </p>
                </div>
                <Badge variant={config.instamojoEnvironment === "TEST" ? "orange" : "purple"} size="sm">
                  {config.instamojoEnvironment === "TEST" ? "TEST (Sandbox)" : "PROD (Production)"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Private API Key <span className="text-purple-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.instamojoApiKey || "23202cf45d3e1a695e8b003c7b4dada3"}
                    onChange={(e) => setConfig({ ...config, instamojoApiKey: e.target.value })}
                    placeholder="23202cf45d3e1a695e8b003c7b4dada3"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#523293] focus:border-transparent transition-all shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400 font-medium">
                    Private API Key for header <code className="font-mono text-slate-600">X-Api-Key</code>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Private Auth Token <span className="text-purple-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.instamojoAuthToken || "29fc0a17dad486ae928d63b2245d97fb"}
                    onChange={(e) => setConfig({ ...config, instamojoAuthToken: e.target.value })}
                    placeholder="29fc0a17dad486ae928d63b2245d97fb"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#523293] focus:border-transparent transition-all shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400 font-medium">
                    Private Auth Token for header <code className="font-mono text-slate-600">X-Auth-Token</code>
                  </p>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Private Salt (for Webhook Signature Verification)
                  </label>
                  <input
                    type="text"
                    value={config.instamojoSalt || "70488dd63d14427998b1cc7a65f371e0"}
                    onChange={(e) => setConfig({ ...config, instamojoSalt: e.target.value })}
                    placeholder="70488dd63d14427998b1cc7a65f371e0"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#523293] focus:border-transparent transition-all shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400 font-medium">
                    Used to compute HMAC-SHA1 signatures and block counterfeit webhook attempts.
                  </p>
                </div>
              </div>

              {/* Webhook Configuration Section */}
              <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200/70 space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Server className="w-4 h-4 text-purple-900" />
                    Instamojo Webhook Endpoint
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyInstamojoWebhook}
                    className="text-xs font-bold text-[#523293] hover:text-purple-900 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-purple-200 hover:bg-purple-100/50 transition-colors"
                  >
                    {copiedInstamojoWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedInstamojoWebhook ? "Copied URL!" : "Copy Webhook URL"}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Add this webhook URL into your <strong className="text-slate-800">Instamojo Webhook settings</strong> for real-time instant pass confirmation:
                </p>

                <div className="p-3 rounded-xl bg-white border border-purple-200 font-mono text-xs text-slate-800 select-all break-all shadow-2xs flex items-center justify-between gap-2">
                  <span>{instamojoWebhookUrl}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- PAYTM FOR BUSINESS PROVIDER VIEW ----------------- */}
        {isPaytm && (
          <div className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
            {/* Header Status Bar */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-sky-50/80 to-slate-50 border border-indigo-200/70 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#002970] text-white flex items-center justify-center font-extrabold text-sm shadow-md shrink-0">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-heading font-extrabold text-base text-slate-900 tracking-tight">
                      Paytm for Business — Merchant Direct UPI
                    </h4>
                    <Badge variant={config.isGatewayActive ? "success" : "slate"} size="sm">
                      {config.isGatewayActive ? "UPI LIVE" : "PAUSED"}
                    </Badge>
                    <Badge variant="navy" size="sm">
                      {config.paytmMid ? "CONFIGURED" : "CONFIG REQUIRED"}
                    </Badge>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/90 text-emerald-800 border border-emerald-200/90 shadow-2xs">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      0% Commission Direct Settlement
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Direct P2M payments into the SRC JDCOEM institutional merchant account without third-party holds
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Dynamic UPI QR Info Callout */}
            <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200/80 space-y-2 text-xs text-sky-950">
              <div className="flex items-center gap-2 font-bold text-sky-900">
                <Building2 className="w-4 h-4 text-sky-700" />
                <span>How Paytm for Business Direct Dynamic UPI Works:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium text-[11.5px] leading-relaxed">
                <li>
                  <strong className="text-slate-900">0% Bank &amp; Gateway Fees:</strong> Because Paytm for Business is an institutional merchant account (P2M), payments are directly routed to the college council account with zero deductions.
                </li>
                <li>
                  <strong className="text-slate-900">No Browser Intent Blocking:</strong> Institutional merchant accounts are exempt from personal P2P limits and allow 1-tap app launch in GPay, PhonePe, Paytm, and BHIM.
                </li>
                <li>
                  <strong className="text-slate-900">Dynamic Payment Encapsulation:</strong> When a student checks out, the system automatically builds an NPCI UPI specification QR containing the exact registration fee and tracking ID.
                </li>
              </ul>
            </div>

            {/* Paytm Merchant Configuration Fields */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-2xs">
              <div className="border-b border-slate-100 pb-2">
                <h5 className="font-heading font-extrabold text-sm text-slate-900 tracking-tight">
                  Merchant Account Parameters
                </h5>
                <p className="text-[11px] text-slate-500 font-medium">
                  Verified credentials from your official Paytm for Business dashboard.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Paytm Merchant ID (MID) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Paytm Merchant ID (MID) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required={isPaytm}
                    value={config.paytmMid || "YICGYk78325672706387"}
                    onChange={(e) => setConfig({ ...config, paytmMid: e.target.value })}
                    placeholder="e.g. YICGYk78325672706387"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#002970] focus:border-transparent transition-all shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400 font-medium">
                    Found in dashboard.paytm.com → Developer Settings → API Keys.
                  </p>
                </div>

                {/* Merchant Display Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Merchant / Payee Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required={isPaytm}
                    value={config.paytmMerchantName || "SRC JDCOEM"}
                    onChange={(e) => setConfig({ ...config, paytmMerchantName: e.target.value })}
                    placeholder="e.g. SRC JDCOEM"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#002970] focus:border-transparent transition-all shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-400 font-medium">
                    Name displayed on student screens in GPay, PhonePe, and Paytm.
                  </p>
                </div>
              </div>

              {/* SRC PayHook Native Android App Setup */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2.5 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-[#002970]" />
                    SRC PayHook Native App Listener
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href="/admin/payments"
                      className="text-[10px] font-bold text-[#002970] hover:underline bg-[#002970]/10 px-2 py-0.5 rounded-md"
                    >
                      Payments Studio &rarr;
                    </a>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                      Live Endpoint Ready
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  When payments arrive in Paytm for Business, PhonePe, or Bank SMS, the dedicated <strong>SRC PayHook</strong> Android app forwards notification alerts to this endpoint to auto-issue passes in real time.
                </p>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-700 select-all break-all shadow-2xs">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/upi/webhook?secret=SRC_UPI_2026_GATEWAY` : "https://www.srcjdcoem.in/api/upi/webhook?secret=SRC_UPI_2026_GATEWAY"}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>Secret Key: <code className="bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-800 font-bold">SRC_UPI_2026_GATEWAY</code></span>
                  <span>•</span>
                  <span>Header / Query: <code className="bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-800">x-src-webhook-key</code></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- COMMON OPERATIONAL SETTINGS FORM ---------------- */}
        <form onSubmit={handleSave} className="space-y-4 pt-2 border-t border-slate-200/80">
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
              placeholder={
                isPaytm
                  ? "e.g. Direct instant UPI payment via Paytm for Business. Scan the dynamic QR code using any UPI app."
                  : "e.g. Instant online checkout powered by Cashfree (UPI, Cards, Netbanking)."
              }
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#17458F] focus:border-transparent transition-all shadow-2xs"
            />
            <p className="text-[11px] text-slate-400 font-medium">
              Displayed to students directly in the checkout payment modal.
            </p>
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

