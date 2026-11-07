"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Mail, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  RefreshCw,
  LogOut,
  Sliders,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { saveSiteContentToFirestore } from "@/lib/firebase/firestore";

interface GmailHookModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhookUrl: string;
}

export function GmailHookModal({ isOpen, onClose, webhookUrl }: GmailHookModalProps) {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [connection, setConnection] = useState<{
    connected: boolean;
    email?: string | null;
    name?: string | null;
    connectedAt?: string | null;
    lastSyncedAt?: string | null;
  }>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("src_gmail_connection");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return { connected: false };
  });

  // Credentials config inputs
  const [clientIdInput, setClientIdInput] = useState("");
  const [clientSecretInput, setClientSecretInput] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [showConfigAccordion, setShowConfigAccordion] = useState(false);

  // Syncing / Disconnecting state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Simulator state
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [selectedBank, setSelectedBank] = useState<"canara" | "hdfc" | "paytm" | "sbi">("canara");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{ ok: boolean; message: string } | null>(null);

  const redirectUri = typeof window !== "undefined" 
    ? `${window.location.origin}/api/gmail/oauth/callback`
    : "https://www.srcjdcoem.in/api/gmail/oauth/callback";

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);

      // Check query params if just redirected back from Google OAuth
      let queryConnected = false;
      let queryEmail: string | null = null;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("gmail_connected") === "success") {
          queryConnected = true;
          queryEmail = params.get("email");
        }
      }

      const res = await fetch("/api/gmail/oauth/status");
      const data = await res.json();
      if (data.success) {
        setHasCredentials(Boolean(data.hasCredentials));
        const isConn = Boolean(data.connection?.connected) || queryConnected;
        const activeEmail = data.connection?.email || queryEmail;

        const updatedConn = {
          connected: isConn,
          email: activeEmail,
          name: data.connection?.name || null,
          connectedAt: data.connection?.connectedAt || new Date().toISOString(),
          lastSyncedAt: data.connection?.lastSyncedAt || null,
        };
        setConnection(updatedConn);

        if (isConn && typeof window !== "undefined") {
          try {
            localStorage.setItem("src_gmail_connection", JSON.stringify(updatedConn));
          } catch {}
        }

        if (typeof document !== "undefined") {
          const cookieMatch = document.cookie.match(/src_gmail_token_bundle=([^;]+)/);
          if (cookieMatch) {
            try {
              const parsed = JSON.parse(decodeURIComponent(cookieMatch[1]));
              if (parsed?.accessToken || parsed?.email) {
                saveSiteContentToFirestore("gmail_oauth_connection", {
                  ...parsed,
                  connected: true,
                  updatedAt: new Date().toISOString()
                }).catch((err) => console.warn("Notice saving token bundle from client:", err));
              }
            } catch {}
          } else if (queryConnected && queryEmail) {
            saveSiteContentToFirestore("gmail_oauth_connection", {
              connected: true,
              email: queryEmail,
              connectedAt: new Date().toISOString()
            }).catch((err) => console.warn("Notice saving connection from client:", err));
          }
        }

        if (!data.hasCredentials) {
          setShowConfigAccordion(true);
        }
      } else if (queryConnected && queryEmail) {
        setConnection({
          connected: true,
          email: queryEmail,
          connectedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn("Could not fetch Gmail OAuth status:", e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConnectWithGoogle = () => {
    window.location.href = "/api/gmail/oauth/connect?redirect=true";
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const cId = clientIdInput.trim();
    const cSec = clientSecretInput.trim();

    if (!cId || !cSec) {
      alert("Please provide both Google OAuth Client ID and Client Secret.");
      return;
    }
    setIsSavingConfig(true);
    let directClientSuccess = false;

    try {
      // 1. Direct client-side write to Firestore using active Admin session
      try {
        await saveSiteContentToFirestore("gmail_oauth_config", {
          clientId: cId,
          clientSecret: cSec,
          updatedAt: new Date().toISOString()
        });
        directClientSuccess = true;
      } catch (clientErr) {
        console.warn("Direct client save notice:", clientErr);
      }

      // 2. Server-side API endpoint persistence
      const res = await fetch("/api/gmail/oauth/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: cId,
          clientSecret: cSec
        })
      });
      const data = await res.json().catch(() => ({ success: false, error: "Server returned non-JSON response" }));

      if (data.success || directClientSuccess) {
        setHasCredentials(true);
        setShowConfigAccordion(false);
        alert("Google OAuth credentials saved! You can now click 'Connect with Google'.");
      } else {
        alert(`Failed to save credentials: ${data.error || "Please verify your admin permissions or check network connection."}`);
      }
    } catch (err: any) {
      if (directClientSuccess) {
        setHasCredentials(true);
        setShowConfigAccordion(false);
        alert("Google OAuth credentials saved! You can now click 'Connect with Google'.");
      } else {
        alert(`Error saving credentials: ${err?.message || "Unknown network error"}`);
      }
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncFeedback(data.message || `Sync complete. ${data.processedCount || 0} alerts processed.`);
        fetchStatus();
      } else {
        setSyncFeedback(`Sync failed: ${data.error}`);
      }
    } catch (err: any) {
      setSyncFeedback(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this Gmail account? Payments will no longer be observed from this inbox.")) {
      return;
    }
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/gmail/oauth/disconnect", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setConnection({ connected: false });
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("src_gmail_connection");
          } catch {}
        }
        alert("Account disconnected successfully.");
      }
    } catch (err: any) {
      alert(`Disconnect error: ${err.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const sampleBankPayloads = {
    canara: {
      name: "Canara Bank",
      subject: "Credit Alert: INR 2.01 credited to A/c ...885",
      body: "Dear Customer, Your Acct XXX885 is credited with INR 2.01 on 01-11-2026 by UPI Ref No 630519292455 from ATHANG DUSAWAR. Avl Bal: INR 40,081.26 - Canara Bank",
      sender: "alerts@canarabank.in"
    },
    hdfc: {
      name: "HDFC Bank",
      subject: "Update: INR 50.00 credited to HDFC Bank A/c xx4120",
      body: "INR 50.00 credited to your A/c XX4120 on 01-11-2026 14:32:10 via UPI: HARSH SHENDE (UPI Ref 630588219011). Available balance INR 12,450.00.",
      sender: "alerts@hdfcbank.net"
    },
    paytm: {
      name: "Paytm for Business",
      subject: "Payment Received: Rs 2.01 on Paytm QR",
      body: "You have received Rs 2.01 from HARSH AVINASH SHENDE on 01 Nov 2026, 04:05 PM on your Paytm QR. Ref: AUTO-PTM-0235F90034.",
      sender: "no-reply@paytm.com"
    },
    sbi: {
      name: "State Bank of India",
      subject: "SBI Credit Alert: Rs 100.00",
      body: "Dear SBI User, your A/c ending 9012 has been credited by Rs 100.00 on 01Nov26 transfer from ABHAY KAMBLE Ref 630599112233 - State Bank of India.",
      sender: "cbs.alerts@sbi.co.in"
    }
  };

  const handleSimulateBankEmail = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    const bank = sampleBankPayloads[selectedBank];

    try {
      const res = await fetch("/api/upi/webhook?secret=SRC_UPI_2026_GATEWAY&source=Gmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-src-webhook-key": "SRC_UPI_2026_GATEWAY"
        },
        body: JSON.stringify({
          packageName: "com.google.android.gm",
          sender: bank.sender,
          subject: bank.subject,
          body: bank.body,
          notificationText: `${bank.subject} ${bank.body}`,
          postTime: Date.now()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSimulationResult({
          ok: true,
          message: `Parsed email signal! UTR: ${data.utr || "detected"} · Amount: ₹${data.amount || "0"} · Stream entry logged.`
        });
      } else {
        setSimulationResult({
          ok: false,
          message: `Simulation response (${res.status}): ${data.error || "Failed"}`
        });
      }
    } catch (err: any) {
      setSimulationResult({ ok: false, message: `Simulation error: ${err.message}` });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-rose-950 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Mail className="w-5 h-5 text-rose-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Gmail Bank Alert Hook</h2>
                <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  OAuth 2.0 Integration
                </span>
              </div>
              <p className="text-xs text-rose-200/90 mt-0.5">
                Zero-phone backup: Reads official bank credit alert emails directly via Google OAuth
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800 text-sm">
          {/* Main Connection Status Card */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Treasurer Account Connection
                </div>
                {loadingStatus ? (
                  <div className="text-sm font-semibold text-slate-400 mt-1 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Checking connection status...
                  </div>
                ) : connection.connected ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">{connection.email}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Active &amp; Authorised
                      </span>
                    </div>
                    {connection.lastSyncedAt && (
                      <p className="text-xs text-slate-400">
                        Last checked: {new Date(connection.lastSyncedAt).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-1">
                    <span className="text-sm font-semibold text-slate-700">No Gmail account linked</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Connect the official treasurer inbox to catch bank emails cloud-to-cloud.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {connection.connected ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSyncNow}
                      disabled={isSyncing}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-rose-600 ${isSyncing ? "animate-spin" : ""}`} />
                      <span>{isSyncing ? "Checking..." : "Sync Inbox Now"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors cursor-pointer"
                      title="Disconnect account for tenure handoff"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectWithGoogle}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Connect with Google OAuth</span>
                  </button>
                )}
              </div>
            </div>

            {syncFeedback && (
              <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{syncFeedback}</span>
              </div>
            )}
          </div>

          {/* Tenure Handoff Callout */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#17458F] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-900">Future Tenure Handover:</span> When a new treasurer is elected, simply click <strong>"Disconnect"</strong> and have the incoming treasurer click <strong>"Connect with Google"</strong>. The integration updates immediately without touching code, scripts, or database tables.
            </div>
          </div>

          {/* OAuth Setup & Credentials Accordion */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowConfigAccordion(!showConfigAccordion)}
              className="w-full p-4 bg-white hover:bg-slate-50 flex items-center justify-between text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="text-xs font-bold text-slate-900">Google Cloud OAuth Credentials</div>
                  <div className="text-[11px] text-slate-400">
                    {hasCredentials ? "Configured and active" : "Required for first-time setup"}
                  </div>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showConfigAccordion ? "rotate-180" : ""}`} />
            </button>

            {showConfigAccordion && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4 text-xs">
                {/* Step Instructions */}
                <div className="space-y-2 text-slate-600">
                  <div className="font-bold text-slate-900">How to get your OAuth Credentials:</div>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-rose-700 font-bold hover:underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-2.5 h-2.5" /></a>.</li>
                    <li>Create an <strong>OAuth 2.0 Client ID</strong> (Web Application).</li>
                    <li>Add this exact <strong>Authorized Redirect URI</strong>:</li>
                  </ol>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 font-mono text-[11px] text-slate-800">
                    <span className="truncate flex-1">{redirectUri}</span>
                    <button
                      type="button"
                      onClick={handleCopyRedirectUri}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans font-bold text-[10px] shrink-0 cursor-pointer"
                    >
                      {copiedUrl ? "Copied!" : "Copy URI"}
                    </button>
                  </div>
                </div>

                {/* Input Form */}
                <form onSubmit={handleSaveCredentials} className="space-y-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Client ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 123456789-xyz.apps.googleusercontent.com"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      placeholder="GOCSPX-..."
                      value={clientSecretInput}
                      onChange={(e) => setClientSecretInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#17458F]/20"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      variant="primary"
                      isLoading={isSavingConfig}
                      className="bg-[#17458F] text-xs"
                    >
                      Save Credentials
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Live Bank Alert Simulator */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Live Bank Alert Simulator &amp; Verification
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Test the email parsing engine without waiting for a real bank credit email.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["canara", "hdfc", "paytm", "sbi"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setSelectedBank(b)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left cursor-pointer ${
                    selectedBank === b
                      ? "bg-white border-rose-500 text-rose-800 shadow-xs ring-2 ring-rose-500/20"
                      : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white"
                  }`}
                >
                  <div className="truncate">{sampleBankPayloads[b].name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {b === "canara" ? "₹2.01" : b === "hdfc" ? "₹50.00" : b === "paytm" ? "₹2.01" : "₹100.00"}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-700 space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Simulated Email Alert:</div>
              <div className="font-semibold text-slate-900">{sampleBankPayloads[selectedBank].subject}</div>
              <div className="text-[11px] text-slate-600 line-clamp-2">{sampleBankPayloads[selectedBank].body}</div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-slate-500 font-medium">
                Pushes simulated bank email payload to <code className="text-rose-700 bg-rose-50 px-1 py-0.5 rounded font-mono">/api/upi/webhook</code>
              </div>
              <Button
                variant="primary"
                onClick={handleSimulateBankEmail}
                isLoading={isSimulating}
                className="bg-rose-700 hover:bg-rose-800 text-white shrink-0 text-xs"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Dispatch Test Email
              </Button>
            </div>

            {simulationResult && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-2xs animate-in fade-in duration-150 ${
                simulationResult.ok 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}>
                <div className="flex items-center gap-2">
                  {simulationResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{simulationResult.message}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted Token Storage · Official Google APIs</span>
          </div>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
