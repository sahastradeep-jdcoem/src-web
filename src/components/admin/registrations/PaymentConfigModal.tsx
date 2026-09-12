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
  ExternalLink,
  Copy,
  Clock,
  Send,
  Smartphone,
  Zap
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
  const [activeTab, setActiveTab] = useState<"credentials" | "webhook" | "preview">("credentials");
  
  // Webhook Testing & Copy State
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [recentSignals, setRecentSignals] = useState<any[]>([]);
  const [isLoadingSignals, setIsLoadingSignals] = useState(false);

  useEffect(() => {
    setConfig(getStoredPaymentConfig());
    const unsub = subscribeToPaymentConfig((updated) => {
      setConfig(updated);
    });
    return unsub;
  }, [isOpen]);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/upi/webhook`
    : "https://srcjdcoem.in/api/upi/webhook";

  const webhookSecret = config.webhookSecret || "SRC_UPI_2026_GATEWAY";

  const fetchRecentSignals = async () => {
    setIsLoadingSignals(true);
    try {
      const res = await fetch(`/api/upi/webhook?secret=${encodeURIComponent(webhookSecret)}`);
      const data = await res.json();
      if (data?.recentPayments) {
        setRecentSignals(data.recentPayments);
      }
    } catch (e) {
      console.warn("Failed to fetch recent webhook signals", e);
    } finally {
      setIsLoadingSignals(false);
    }
  };

  useEffect(() => {
    if (activeTab === "webhook" && isOpen) {
      fetchRecentSignals();
    }
  }, [activeTab, isOpen]);

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    setTestResult(null);
    try {
      const dummyUtr = `9999${Math.floor(10000000 + Math.random() * 90000000)}`;
      const res = await fetch("/api/upi/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${webhookSecret}`,
        },
        body: JSON.stringify({
          title: "Paytm for Business (Test)",
          notificationText: `Received ₹150.00 via UPI from Demo Student. UPI Ref: ${dummyUtr}`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult(`Success! Verified UTR ${data.utr} (Amount: ₹${data.amount}) recorded in cloud.`);
        fetchRecentSignals();
      } else {
        setTestResult(`Failed: ${data.error || "Webhook rejected payload"}`);
      }
    } catch (err: any) {
      setTestResult(`Connection Error: ${err.message || "Failed to reach endpoint"}`);
    } finally {
      setIsTestingWebhook(false);
    }
  };

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

  const sampleUpiLink = `upi://pay?pa=${config.upiId || "paytm.s3tuv70@pty"}&pn=${encodeURIComponent(config.payeeName || "SRC JDCOEM")}&am=100.00&cu=INR&tn=TEST%20VERIFICATION`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Gateway & Treasurer UPI Settings"
      subtitle="Manage Paytm for Business credentials, active Treasurer UPI account, and self-hosted automated webhook."
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

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("credentials")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "credentials"
                  ? "bg-white text-blue-900 shadow-sm border border-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Credentials
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("webhook")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === "webhook"
                  ? "bg-white text-amber-900 shadow-sm border border-amber-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Auto Webhook</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "preview"
                  ? "bg-white text-blue-900 shadow-sm border border-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              QR Preview
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
                  placeholder="e.g. paytm.s3tuv70@pty"
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
                Payee / Beneficiary Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SRC JDCOEM"
                value={config.payeeName}
                onChange={(e) => setConfig({ ...config, payeeName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002970]/30 focus:border-[#002970]"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Shown to students inside Google Pay, PhonePe, and Paytm during scan.
              </p>
            </div>

            {/* Merchant MID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Paytm Merchant MID
                </label>
                <input
                  type="text"
                  placeholder="e.g. YICGYk78325672706387"
                  value={config.paytmMid}
                  onChange={(e) => setConfig({ ...config, paytmMid: e.target.value.trim() })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002970]/30 focus:border-[#002970]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Environment
                </label>
                <select
                  value={config.paytmEnvironment}
                  onChange={(e) => setConfig({ ...config, paytmEnvironment: e.target.value as "PROD" | "STAGE" })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002970]/30 focus:border-[#002970]"
                >
                  <option value="PROD">Production (Live)</option>
                  <option value="STAGE">Staging (Testing)</option>
                </select>
              </div>
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
                  Save Settings
                </Button>
              </div>
            </div>
          </form>
        ) : activeTab === "webhook" ? (
          /* ========================================================================= */
          /* SELF-HOSTED AUTOMATED UPI WEBHOOK TAB */
          /* ========================================================================= */
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Status Hero */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                    Self-Hosted Automated UPI Webhook
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                  100% Free • ₹0/mo
                </span>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Connects your Android phone (Paytm for Business) directly to `srcjdcoem.in`. When a student pays, your phone notifies the site in <strong>&lt; 300ms</strong> to auto-approve the pass without you lifting a finger.
              </p>
            </div>

            {/* Webhook Endpoint & Secret Box */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Your Webhook Target URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Webhook Secret Token
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookSecret}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookSecret);
                      setCopiedSecret(true);
                      setTimeout(() => setCopiedSecret(false), 2000);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSecret ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  Pass as header: `Authorization: Bearer {webhookSecret}`
                </p>
              </div>
            </div>

            {/* Test Simulation Button */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Verify Cloud Pipeline
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Simulate an incoming ₹150 UPI notification to confirm that the server receives and parses UTRs.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={isTestingWebhook}
                  className="px-3.5 py-1.5 rounded-xl bg-[#17458F] hover:bg-[#123670] disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  {isTestingWebhook ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Send Test Signal</span>
                </button>
              </div>

              {testResult && (
                <p className={`text-xs font-medium p-2 rounded-lg ${
                  testResult.startsWith("Success") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}>
                  {testResult}
                </p>
              )}
            </div>

            {/* Step-by-Step Setup Instructions */}
            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-2.5 text-xs text-slate-700">
              <h5 className="font-bold text-[#17458F] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#E78023]" />
                <span>Quick 3-Minute Android Setup (MacroDroid)</span>
              </h5>
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
                <li>Install <strong>MacroDroid</strong> (Free from Play Store) on the phone that has your Paytm for Business account.</li>
                <li>Tap <strong>Add Macro</strong>.</li>
                <li><strong>Trigger (+)</strong>: Select <strong>Device Events</strong> → <strong>Notification</strong> → <strong>Notification Received</strong> → Select <strong>Paytm for Business</strong>.</li>
                <li><strong>Action (+)</strong>: Select <strong>Connectivity</strong> → <strong>HTTP Request</strong>:
                  <ul className="list-disc pl-4 pt-1 space-y-0.5 text-slate-600 font-mono text-[10px]">
                    <li>Method: <strong>POST</strong></li>
                    <li>URL: <span className="text-slate-900 bg-white px-1 py-0.5 rounded border">{webhookUrl}</span></li>
                    <li>Header: <span className="text-slate-900 bg-white px-1 py-0.5 rounded border">Authorization: Bearer {webhookSecret}</span></li>
                    <li>Body (JSON): <span className="text-slate-900 bg-white px-1 py-0.5 rounded border">&#123;&quot;notificationText&quot;: &quot;[notif_text]&quot;, &quot;title&quot;: &quot;[notif_title]&quot;&#125;</span></li>
                  </ul>
                </li>
                <li>Save macro. You&apos;re done! The website will now auto-approve passes in real time.</li>
              </ol>
            </div>

            {/* Recent Signals */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Recent Cloud Verified Signals
                </span>
                <button
                  type="button"
                  onClick={fetchRecentSignals}
                  className="text-[11px] text-[#17458F] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingSignals ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {recentSignals.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400">
                  No webhook signals recorded yet. Click &quot;Send Test Signal&quot; above to verify.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {recentSignals.map((sig, i) => (
                    <div key={i} className="p-3 text-xs flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">UTR: {sig.utr}</span>
                          <Badge variant={sig.status === "MATCHED" ? "success" : "slate"} size="sm">
                            {sig.status}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {sig.receivedAt ? new Date(sig.receivedAt).toLocaleTimeString() : ""} • {sig.matchedStudentName ? `Matched: ${sig.matchedStudentName}` : "Unclaimed"}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-700 text-sm">
                        ₹{sig.amount || 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
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
                {config.upiId || "paytm.s3tuv70@pty"}
              </p>
              <p className="text-[11px] text-slate-500 mt-2 max-w-sm mx-auto">
                Scan this QR with any UPI app to verify that payments resolve to the SRC Paytm for Business merchant account correctly.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
