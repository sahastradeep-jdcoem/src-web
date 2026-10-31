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
  CheckCheck,
  Trash2,
  Loader2
} from "lucide-react";
import { db } from "@/lib/firebase/config";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  doc,
  deleteDoc,
  writeBatch,
  getDocs
} from "firebase/firestore";
import { PayhookGuideModal } from "./PayhookGuideModal";

export interface WebhookLogItem {
  id: string;
  receivedAt: string;
  combinedText: string;
  extractedUtr?: string;
  extractedAmount?: number;
  matchedOrderId?: string | null;
  matchedRegistrationId?: string | null;
  matchedStudentName?: string | null;
  payerName?: string | null;
  isFriendPayment?: boolean;
  source?: string;
  status: "TEST_PING" | "MATCHED" | "UNCLAIMED" | string;
  isDuplicate?: boolean;
  burstCount?: number;
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
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [groupDuplicates, setGroupDuplicates] = useState(true);

  // Group duplicate bursts under the primary approved signal
  const displayedLogs = React.useMemo(() => {
    if (!groupDuplicates) return logs;

    const result: (WebhookLogItem & { burstCount?: number })[] = [];

    for (const log of logs) {
      if (log.status === "TEST_PING" || log.extractedUtr === "TEST_PING" || !log.extractedAmount) {
        result.push(log);
        continue;
      }

      const logTime = new Date(log.receivedAt).getTime();

      // Check if there is an existing group matching:
      // 1. Same explicit UTR
      // 2. OR same micro-paisa amount (fractional paise provides 1:1 mathematical identity!)
      // 3. OR same round amount within a 90-second burst window
      const existing = result.find((r) => {
        if (!r.extractedAmount || r.status === "TEST_PING") return false;
        if (r.extractedUtr && log.extractedUtr && r.extractedUtr === log.extractedUtr) return true;

        const sameAmount = Math.abs((r.extractedAmount || 0) - (log.extractedAmount || 0)) < 0.005;
        if (!sameAmount) return false;

        const hasFractionalPaise = Math.round((log.extractedAmount || 0) * 100) % 100 !== 0;
        if (hasFractionalPaise) {
          // Mathematical 1:1 Identity: Same micro-paisa amount belongs to the exact same student payment!
          return true;
        }

        const rTime = new Date(r.receivedAt).getTime();
        const withinBurstWindow = Math.abs(rTime - logTime) <= 90 * 1000;
        return withinBurstWindow;
      });

      if (existing) {
        existing.burstCount = (existing.burstCount || 1) + (log.burstCount || 1);

        // If log has a real 12-digit Bank UTR and existing had a synthetic UTR, upgrade the UTR!
        const logHasRealUtr = log.extractedUtr && !log.extractedUtr.startsWith("AUTO-PTM-") && /^\d{12}$/.test(log.extractedUtr);
        if (logHasRealUtr) {
          existing.extractedUtr = log.extractedUtr;
          existing.combinedText = log.combinedText; // Prefer official bank SMS notification text
          existing.source = log.source || existing.source;
        }

        // If either is MATCHED, the whole merged item is MATCHED & PAID!
        if (log.status === "MATCHED" || existing.status === "MATCHED") {
          existing.status = "MATCHED";
          existing.matchedOrderId = existing.matchedOrderId || log.matchedOrderId;
          existing.matchedRegistrationId = existing.matchedRegistrationId || log.matchedRegistrationId;
          existing.matchedStudentName = existing.matchedStudentName || log.matchedStudentName;
          existing.payerName = existing.payerName || log.payerName;
        }

        // Keep the latest timestamp
        if (logTime > new Date(existing.receivedAt).getTime()) {
          existing.receivedAt = log.receivedAt;
        }
      } else {
        result.push({ ...log, burstCount: log.burstCount || 1 });
      }
    }

    return result;
  }, [logs, groupDuplicates]);

  const renderSourceBadge = (source?: string, combinedText?: string) => {
    let s = (source || "").toLowerCase().trim();
    const t = (combinedText || "").toLowerCase();

    // If source is missing, undefined, or generic PayHook wrapper, infer from the actual notification text
    if (!s || s === "src payhook" || s === "in.srcjdcoem.payhook") {
      if (t.includes("canbnk") || t.includes("canara") || t.includes("hdfc") || t.includes("sbi") || t.includes("icici") || t.includes("axis") || t.includes("acct xxx") || t.includes("dear customer")) {
        s = "messaging";
      } else if (t.includes("received on") || t.includes("received from") || t.includes("paytm") || t.includes("soundbox") || t.includes("auto-ptm")) {
        s = "paytm";
      } else if (t.includes("phonepe") || t.includes("@ybl") || t.includes("@ibl")) {
        s = "phonepe";
      } else if (t.includes("gpay") || t.includes("google pay") || t.includes("@ok")) {
        s = "gpay";
      } else if (t.includes("truecaller")) {
        s = "truecaller";
      }
    }

    if (s.includes("paytm")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          Paytm for Business
        </span>
      );
    }
    if (s.includes("messaging") || s.includes("sms")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Google Messages (SMS)
        </span>
      );
    }
    if (s.includes("phonepe")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          PhonePe
        </span>
      );
    }
    if (s.includes("gpay") || s.includes("google") || s.includes("paisa")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Google Pay
        </span>
      );
    }
    if (s.includes("truecaller")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          Truecaller
        </span>
      );
    }
    if (s.includes("diagnostics")) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
          PayHook Diagnostics
        </span>
      );
    }
    return (
      <span className="text-[11px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
        {source || "SRC PayHook"}
      </span>
    );
  };

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

  const handleClearAllLogs = async () => {
    if (!db) {
      alert("Database unavailable.");
      return;
    }

    setIsClearing(true);
    try {
      // 1. Fetch all documents in upi_webhook_logs using the authenticated client session
      const snap = await getDocs(collection(db, "upi_webhook_logs"));
      if (!snap.empty) {
        const docs = snap.docs;
        // Batch delete (max 400 operations per Firestore batch)
        for (let i = 0; i < docs.length; i += 400) {
          const chunk = docs.slice(i, i + 400);
          const batch = writeBatch(db);
          for (const d of chunk) {
            batch.delete(d.ref);
          }
          await batch.commit();
        }
      }

      setShowClearConfirm(false);
      setSelectedLog(null);
    } catch (err: any) {
      console.error("Error clearing webhook logs:", err);
      alert("Could not clear logs: " + (err.message || "Unknown error"));
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteSingleLog = async (logId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!db || !logId) return;

    try {
      await deleteDoc(doc(db, "upi_webhook_logs", logId));
      if (selectedLog?.id === logId) {
        setSelectedLog(null);
      }
    } catch (err: any) {
      console.error("Failed to delete log:", err);
      alert("Could not delete log: " + (err.message || "Unknown error"));
    }
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

            <button
              type="button"
              onClick={() => setIsGuideModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span>App Guide</span>
            </button>

            <a
              href="/download/src-payhook-v1.4.apk"
              download="src-payhook-v1.4.apk"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#E78023] border border-orange-200/80 text-xs font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#E78023]" />
              <span>APK v1.4</span>
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
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#17458F]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Received Signals &amp; Heartbeats ({displayedLogs.length}{logs.length !== displayedLogs.length ? ` / ${logs.length} raw` : ""})
            </h4>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={groupDuplicates}
                onChange={(e) => setGroupDuplicates(e.target.checked)}
                className="rounded border-slate-300 text-[#17458F] focus:ring-[#17458F]"
              />
              <span className="font-semibold text-slate-700">Merge Duplicates</span>
            </label>

            <span className="hidden sm:inline text-[11px] font-medium text-slate-400">
              Auto-refreshes in real time via Firestore
            </span>

            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={isClearing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear Logs</span>
              </button>
            )}
          </div>
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
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedLogs.map((log) => {
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
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCheck className="w-3 h-3 text-emerald-600" />
                              <span>MATCHED &amp; PAID</span>
                              {log.isDuplicate && (
                                <span className="text-[9px] font-mono text-emerald-600 ml-0.5 opacity-80">(DUP)</span>
                              )}
                            </span>
                            {log.burstCount && log.burstCount > 1 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-mono font-bold">
                                {log.burstCount} bursts
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              UNCLAIMED PAYMENT
                            </span>
                            {log.burstCount && log.burstCount > 1 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-mono font-bold">
                                {log.burstCount} bursts
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {renderSourceBadge(log.source, log.combinedText)}
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
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-[#17458F] font-semibold">
                              Student: {log.matchedStudentName}
                            </span>
                            {log.isFriendPayment && log.payerName && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                                Paid via: {log.payerName} (Friend)
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          title="Delete this signal"
                          onClick={(e) => handleDeleteSingleLog(log.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
                <div className="mt-0.5">{renderSourceBadge(selectedLog.source, selectedLog.combinedText)}</div>
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

              {selectedLog.matchedStudentName && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Matched Student:</span>
                  <p className="font-semibold text-slate-900">{selectedLog.matchedStudentName}</p>
                </div>
              )}

              {selectedLog.payerName && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bank Payer (Account Holder):</span>
                  <p className="font-semibold text-slate-800">
                    {selectedLog.payerName}
                    {selectedLog.isFriendPayment && (
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">
                        Friend / 3rd Party Account
                      </span>
                    )}
                  </p>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Raw Notification Body:</span>
                <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] whitespace-pre-wrap break-all mt-1 max-h-48 overflow-y-auto">
                  {selectedLog.combinedText || "(empty body)"}
                </pre>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleDeleteSingleLog(selectedLog.id)}
                className="flex-1 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Delete Signal</span>
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear All Confirmation Modal ── */}
      {showClearConfirm && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isClearing && setShowClearConfirm(false)}
        >
          <div 
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                Clear All Webhook Signals?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will permanently remove all {logs.length} logged webhook heartbeats, pings, and test signals from Firestore.
                <br />
                <span className="font-semibold text-slate-700">Verified student payments and registrations will NOT be affected.</span>
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isClearing}
                onClick={handleClearAllLogs}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-900/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Clear All ({logs.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Admin Operator Guide Modal */}
      <PayhookGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </div>
  );
}
