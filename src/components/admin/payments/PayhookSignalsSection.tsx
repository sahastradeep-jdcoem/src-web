"use client";

import React, { useState, useEffect } from "react";
import { 
  Radio, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Smartphone, 
  ExternalLink, 
  Clock, 
  Download,
  Terminal,
  Activity,
  Zap,
  CheckCheck
} from "lucide-react";
import { db } from "@/lib/firebase/config";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from "firebase/firestore";

export interface WebhookLogItem {
  id: string;
  receivedAt: string;
  combinedText: string;
  extractedUtr?: string;
  extractedAmount?: number;
  matchedOrderId?: string | null;
  matchedRegistrationId?: string | null;
  matchedStudentName?: string | null;
  source?: string;
  status: "TEST_PING" | "MATCHED" | "UNCLAIMED" | string;
}

interface PayhookSignalsSectionProps {
  onClose?: () => void;
  userEmail?: string | null;
}

export function PayhookSignalsSection({ onClose, userEmail }: PayhookSignalsSectionProps) {
  const [logs, setLogs] = useState<WebhookLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSendingPing, setIsSendingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; message: string; latency?: number } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLogItem | null>(null);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/upi/webhook?secret=SRC_UPI_2026_GATEWAY`
    : "https://www.srcjdcoem.in/api/upi/webhook?secret=SRC_UPI_2026_GATEWAY";

  // 1. Subscribe to real-time upi_webhook_logs in Firestore
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, "upi_webhook_logs"),
        orderBy("receivedAt", "desc"),
        limit(40)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items: WebhookLogItem[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...(doc.data() as any) });
        });
        setLogs(items);
        setLoading(false);
      }, (err) => {
        console.warn("Notice: upi_webhook_logs subscription error:", err);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch {
      setLoading(false);
    }
  }, []);

  // 2. Push a live test ping directly from admin console
  const handlePushTestPing = async () => {
    setIsSendingPing(true);
    setPingResult(null);
    const start = performance.now();

    try {
      const res = await fetch("/api/upi/webhook?secret=SRC_UPI_2026_GATEWAY", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-src-webhook-key": "SRC_UPI_2026_GATEWAY",
        },
        body: JSON.stringify({
          text: `Admin Console Test Ping dispatched at ${new Date().toLocaleTimeString()} by ${userEmail || "Admin"}`,
          notificationText: `Admin Console Test Ping at ${new Date().toLocaleTimeString()}`,
          packageName: "srcjdcoem.in/admin/console",
          timestamp: Date.now(),
        }),
      });

      const latency = Math.round(performance.now() - start);
      const data = await res.json();

      if (res.ok && data.success) {
        setPingResult({
          ok: true,
          message: `Ping OK (${latency}ms) — Logged to Firestore & Acknowledged!`,
          latency,
        });
      } else {
        setPingResult({
          ok: false,
          message: `Ping failed (${res.status}): ${data.error || "Unexpected response"}`,
        });
      }
    } catch (err: any) {
      setPingResult({
        ok: false,
        message: `Network error: ${err.message}`,
      });
    } finally {
      setIsSendingPing(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ── Header Card & Diagnostic Controls ── */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#17458F] shadow-2xs">
              <Radio className="w-5 h-5 animate-pulse text-[#17458F]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  SRC PayHook &amp; UPI Webhook Signals
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live Stream
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time receiver for phone notifications, test pings, and automated UPI payment intercepts.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handlePushTestPing}
              disabled={isSendingPing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-300 ${isSendingPing ? "animate-spin" : ""}`} />
              <span>{isSendingPing ? "Pushing Ping..." : "Push Test Ping to Server"}</span>
            </button>

            <a
              href="/guide/payhook"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span>App Guide</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href="/download/src-payhook-release.apk"
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#E78023] border border-orange-200/80 text-xs font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#E78023]" />
              <span>APK v1.2</span>
            </a>
          </div>
        </div>

        {/* Ping status feedback */}
        {pingResult && (
          <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between border shadow-2xs animate-in fade-in duration-150 ${
            pingResult.ok 
              ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}>
            <div className="flex items-center gap-2">
              {pingResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{pingResult.message}</span>
            </div>
            {pingResult.latency && (
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                {pingResult.latency} ms
              </span>
            )}
          </div>
        )}

        {/* Webhook Endpoint Readout */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
              Webhook Endpoint:
            </span>
            <span className="text-xs font-mono text-slate-800 truncate select-all">
              {webhookUrl}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-2xs"
          >
            {copiedUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy URL</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Real-Time Signal Stream Table ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#17458F]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Received Signals &amp; Heartbeats ({logs.length})
            </h4>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            Auto-refreshes in real time via Firestore
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Radio className="w-4 h-4 animate-spin text-[#17458F]" />
            <span>Connecting to webhook signal feed...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Radio className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">No Webhook Signals Yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tap <b>&quot;Push Test Ping to Server&quot;</b> above or tap <b>&quot;Send Test Ping&quot;</b> inside the SRC PayHook app on your phone.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Time Received</th>
                  <th className="py-3 px-4">Signal Type</th>
                  <th className="py-3 px-4">Source / Package</th>
                  <th className="py-3 px-4">Amount &amp; UTR</th>
                  <th className="py-3 px-4">Notification Content</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const isTestPing = log.status === "TEST_PING" || log.extractedUtr === "TEST_PING";
                  const isMatched = log.status === "MATCHED";

                  return (
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      {/* Time */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {log.receivedAt 
                              ? new Date(log.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              : "—"}
                          </span>
                        </div>
                      </td>

                      {/* Status / Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isTestPing ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                            TEST PING
                          </span>
                        ) : isMatched ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCheck className="w-3 h-3 text-emerald-600" />
                            MATCHED &amp; PAID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            UNCLAIMED PAYMENT
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {log.source || "in.srcjdcoem.payhook"}
                        </span>
                      </td>

                      {/* Extracted Amount & UTR */}
                      <td className="py-3 px-4 whitespace-nowrap font-medium">
                        {isTestPing ? (
                          <span className="text-slate-400 text-[11px]">—</span>
                        ) : (
                          <div>
                            <span className="font-bold text-slate-900">
                              ₹{(log.extractedAmount || 0).toLocaleString("en-IN")}
                            </span>
                            {log.extractedUtr && log.extractedUtr !== "TEST_PING" && (
                              <div className="text-[10px] font-mono text-slate-500">
                                UTR: {log.extractedUtr}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Notification Content Preview */}
                      <td className="py-3 px-4 max-w-md">
                        <p className="text-xs text-slate-600 truncate font-mono">
                          {log.combinedText || "(empty text)"}
                        </p>
                        {log.matchedStudentName && (
                          <span className="text-[10px] text-[#17458F] font-semibold">
                            Matched Student: {log.matchedStudentName}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal to Inspect Specific Log Entry ── */}
      {selectedLog && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div 
            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#17458F]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Signal Payload Details
                </h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timestamp:</span>
                <p className="font-mono text-slate-800">{selectedLog.receivedAt || "—"}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status:</span>
                <p className="font-semibold text-slate-800">{selectedLog.status}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Source:</span>
                <p className="font-mono text-slate-800">{selectedLog.source || "in.srcjdcoem.payhook"}</p>
              </div>

              {selectedLog.extractedUtr && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Extracted UTR:</span>
                  <p className="font-mono font-bold text-slate-900">{selectedLog.extractedUtr}</p>
                </div>
              )}

              {selectedLog.extractedAmount !== undefined && selectedLog.extractedAmount > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Extracted Amount:</span>
                  <p className="font-bold text-slate-900">₹{selectedLog.extractedAmount}</p>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Raw Notification Body:</span>
                <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] whitespace-pre-wrap break-all mt-1 max-h-48 overflow-y-auto">
                  {selectedLog.combinedText || "(empty body)"}
                </pre>
              </div>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
