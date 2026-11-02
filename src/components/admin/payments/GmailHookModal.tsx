"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Mail, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface GmailHookModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhookUrl: string;
}

export function GmailHookModal({ isOpen, onClose, webhookUrl }: GmailHookModalProps) {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [selectedBank, setSelectedBank] = useState<"canara" | "hdfc" | "paytm" | "sbi">("canara");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{ ok: boolean; message: string; latency?: number } | null>(null);

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

  const targetWebhookUrl = webhookUrl || "https://www.srcjdcoem.in/api/upi/webhook?secret=SRC_UPI_2026_GATEWAY";

  const googleAppsScriptCode = `/**
 * SRC Bank Alert Gmail Observer (100% Free Forever)
 * Runs in your Google account on Google Cloud infrastructure.
 * Checks unread bank credit emails every 1 minute and auto-forwards to SRC PayHook.
 */
function processBankCreditEmails() {
  const WEBHOOK_URL = "${targetWebhookUrl}";
  
  // Search for unread credit alerts from Indian banks & Paytm
  const searchQuery = 'label:unread (from:canarabank OR from:hdfcbank OR from:paytm OR from:sbi OR from:icicibank OR from:axisbank) ("credited" OR "received" OR "credit alert" OR "UPI Ref")';
  const threads = GmailApp.search(searchQuery, 0, 15);
  
  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j];
      if (msg.isUnread()) {
        const payload = {
          packageName: "com.google.android.gm",
          sender: msg.getFrom(),
          subject: msg.getSubject(),
          body: msg.getPlainBody(),
          postTime: msg.getDate().getTime(),
          notificationText: msg.getSubject() + " " + msg.getPlainBody()
        };
        
        try {
          const response = UrlFetchApp.fetch(WEBHOOK_URL, {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
          });
          
          if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
            msg.markRead();
            Logger.log("Successfully forwarded bank alert email: " + msg.getSubject());
          }
        } catch (err) {
          Logger.log("Error forwarding email to SRC Webhook: " + err);
        }
      }
    }
  }
}`;

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

  const handleCopyScript = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(targetWebhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSimulateBankEmail = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    const start = performance.now();
    const bank = sampleBankPayloads[selectedBank];

    try {
      const res = await fetch("/api/upi/webhook?secret=SRC_UPI_2026_GATEWAY", {
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

      const latency = Math.round(performance.now() - start);
      const data = await res.json();

      if (res.ok && data.success) {
        setSimulationResult({
          ok: true,
          message: `Success (${latency}ms): Bank email parsed! UTR: ${data.utr || "detected"} · Amount: ₹${data.amount || "0"} · Stream entry logged.`,
          latency
        });
      } else {
        setSimulationResult({
          ok: false,
          message: `Simulation response (${res.status}): ${data.error || "Failed to process bank alert"}`
        });
      }
    } catch (err: any) {
      setSimulationResult({
        ok: false,
        message: `Simulation error: ${err.message}`
      });
    } finally {
      setIsSimulating(false);
    }
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
                <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  100% Free Forever (₹0)
                </span>
              </div>
              <p className="text-xs text-rose-200/90 mt-0.5">
                Zero-phone backup: Catches bank credit alert emails cloud-to-cloud even if treasurer's phone is off
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

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800 text-sm">
          {/* Architecture Callout */}
          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-950 leading-relaxed">
              <span className="font-bold">Why this guarantees 100% uptime:</span> Every major Indian bank (Canara, SBI, HDFC, ICICI, Paytm) instantly sends a free transaction credit alert email to the registered account email. Using this hook, payments are automatically confirmed in the cloud without needing mobile battery, SIM data, or physical phone access.
            </div>
          </div>

          {/* Setup Guide Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600" />
                60-Second Setup via Google Apps Script (Free)
              </h3>
              <a
                href="https://script.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-900"
              >
                Open Google Apps Script <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <ol className="space-y-2 text-xs text-slate-600 list-decimal list-inside bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <li>Open <strong className="text-slate-900 font-semibold">script.google.com</strong> in the treasurer's Google account and click <strong className="text-slate-900 font-semibold">+ New project</strong>.</li>
              <li>Replace all code in the editor with the script below, and click <strong className="text-slate-900 font-semibold">Save</strong>.</li>
              <li>Click the <strong className="text-slate-900 font-semibold">Triggers (Clock icon)</strong> on the left panel $\rightarrow$ click <strong className="text-slate-900 font-semibold">Add Trigger</strong>.</li>
              <li>Select function: <strong className="text-slate-900 font-semibold">processBankCreditEmails</strong> $\rightarrow$ Event source: <strong className="text-slate-900 font-semibold">Time-driven</strong> $\rightarrow$ Timer: <strong className="text-slate-900 font-semibold">Minutes timer (Every 1 minute)</strong> $\rightarrow$ Save.</li>
            </ol>
          </div>

          {/* Copyable Apps Script Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Google Apps Script Code
              </label>
              <button
                type="button"
                onClick={handleCopyScript}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied Code!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Script</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-52 border border-slate-800 leading-relaxed">
              {googleAppsScriptCode}
            </pre>
          </div>

          {/* Interactive Simulation / Test Section */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Live Bank Alert Simulator &amp; Verification
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Test the cloud parsing engine without waiting for a real bank transaction.
                </p>
              </div>
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
              <div className="text-slate-400 text-[10px] uppercase font-bold">Sample Email Payload:</div>
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
            <span>Encrypted Webhook Endpoint · Zero Subscription Costs</span>
          </div>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
