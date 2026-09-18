"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { 
  scanOrphanStorageFiles, 
  purgeOrphanStorageFiles, 
  StorageScanResult, 
  StorageFileRecord,
  formatStorageBytes 
} from "@/lib/firebase/storageCleanup";
import { toast } from "@/lib/toastStore";
import { 
  HardDrive, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Sparkles,
  ExternalLink,
  Search,
  CheckSquare,
  Square,
  Copy,
  Check,
  ShieldAlert
} from "lucide-react";

const RECOMMENDED_STORAGE_RULES = `rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
    function isAuthenticated() {
      return request.auth != null;
    }

    match /{allPaths=**} {
      allow read: if true;
      allow create, update: if isAuthenticated()
                   && request.resource.size < 15 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
      // Allow authenticated administrators/staff to delete unlinked assets
      allow delete: if isAuthenticated();
    }
  }
}`;

interface StorageCleanerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StorageCleanerModal({ isOpen, onClose }: StorageCleanerModalProps) {
  const [stage, setStage] = useState<"idle" | "scanning" | "scanned" | "purging" | "completed">("idle");
  const [scanResult, setScanResult] = useState<StorageScanResult | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [purgeProgress, setPurgeProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [purgeSummary, setPurgeSummary] = useState<{
    deletedCount: number;
    failedCount: number;
    errors: string[];
    reclaimedBytes: number;
  } | null>(null);
  const [copiedRules, setCopiedRules] = useState(false);
  const isCancelledRef = useRef(false);

  const handleStartScan = async () => {
    isCancelledRef.current = false;
    setStage("scanning");
    try {
      const result = await scanOrphanStorageFiles();
      if (isCancelledRef.current) return;
      setScanResult(result);
      // Pre-select all orphan files for easy 1-click purge
      setSelectedPaths(new Set(result.orphanFiles.map((f) => f.fullPath)));
      setStage("scanned");
    } catch (err: any) {
      if (isCancelledRef.current) return;
      console.error("Storage scan error", err);
      toast.error(err?.message || "Failed to complete storage scan.", "Scan Error");
      setStage("idle");
    }
  };

  const handleCancelScan = () => {
    isCancelledRef.current = true;
    setStage("idle");
  };

  const handleToggleSelect = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedPaths(next);
  };

  const handleToggleSelectAll = () => {
    if (!scanResult) return;
    if (selectedPaths.size === scanResult.orphanFiles.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(scanResult.orphanFiles.map((f) => f.fullPath)));
    }
  };

  const handlePurgeSelected = async () => {
    if (!scanResult || selectedPaths.size === 0) return;

    const pathsToPurge = Array.from(selectedPaths);
    const orphanList = scanResult.orphanFiles.filter((f) => selectedPaths.has(f.fullPath));
    const bytesToReclaim = orphanList.reduce((acc, f) => acc + (f.size || 0), 0);

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${pathsToPurge.length} unused files from Firebase Cloud Storage?\n\nReclaimable: ${formatStorageBytes(bytesToReclaim)}\n\nThis operation is irreversible.`
    );
    if (!confirmed) return;

    setStage("purging");
    setPurgeProgress({ completed: 0, total: pathsToPurge.length });

    try {
      const { deletedCount, failedCount, errors } = await purgeOrphanStorageFiles(
        pathsToPurge,
        (completed, total) => setPurgeProgress({ completed, total })
      );

      if (deletedCount > 0 && failedCount === 0) {
        toast.success(
          `Successfully purged ${deletedCount} unused files (${formatStorageBytes(bytesToReclaim)} reclaimed).`,
          "Storage Cleaned"
        );
      } else if (deletedCount > 0 && failedCount > 0) {
        toast.warning(
          `Purged ${deletedCount} files, but ${failedCount} files failed. Check storage permissions.`,
          "Partial Purge"
        );
      } else {
        toast.error(
          `Could not delete files from Firebase Storage. Check Storage Security Rules.`,
          "Purge Blocked"
        );
      }

      setPurgeSummary({ deletedCount, failedCount, errors, reclaimedBytes: bytesToReclaim });
      setStage("completed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to purge storage files.", "Purge Error");
      setStage("scanned");
    }
  };

  const handleReset = () => {
    setStage("idle");
    setScanResult(null);
    setSelectedPaths(new Set());
    setPurgeProgress({ completed: 0, total: 0 });
    setPurgeSummary(null);
    setCopiedRules(false);
  };

  const handleCopyRules = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(RECOMMENDED_STORAGE_RULES);
      setCopiedRules(true);
      toast.success("Storage security rules copied to clipboard!", "Rules Copied");
      setTimeout(() => setCopiedRules(false), 3500);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={stage === "purging" ? () => {} : onClose}
      maxWidth="3xl"
      title="Firebase Cloud Storage Garbage Collector"
      subtitle="Scan for unlinked media files and permanently reclaim Firebase storage quota."
    >
      <div className="space-y-6">

        {/* STAGE 1: IDLE */}
        {stage === "idle" && (
          <div className="space-y-6 text-slate-700">
            <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0 mt-0.5 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-blue-950">Safe Deep Scanning Invariant</h4>
                <p className="text-xs text-blue-800/90 leading-relaxed">
                  The scanner queries both authoritative Cloud Firestore collections and local stores across Events,
                  Clubs, Council Members, Pillars, Gallery, and Hero assets. Any file referenced anywhere on the live
                  website is protected and strictly skipped.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-[#17458F]">
                  <Search className="w-4 h-4" />
                  <span className="font-bold text-xs uppercase tracking-wider">Step 1: Audit</span>
                </div>
                <p className="text-xs text-slate-500">
                  Recursively discovers all uploads across storage buckets and extracts all download URLs.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-bold text-xs uppercase tracking-wider">Step 2: Detect</span>
                </div>
                <p className="text-xs text-slate-500">
                  Flags superseded posters, replaced club logos, and deleted member photos as orphan files.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-rose-600">
                  <Trash2 className="w-4 h-4" />
                  <span className="font-bold text-xs uppercase tracking-wider">Step 3: Purge</span>
                </div>
                <p className="text-xs text-slate-500">
                  Preview unlinked files with thumbnail verification before permanently freeing storage.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleStartScan} className="gap-2 shadow-sm">
                <Search className="w-4 h-4" />
                <span>Scan Cloud Storage</span>
              </Button>
            </div>
          </div>
        )}

        {/* STAGE 2: SCANNING */}
        {stage === "scanning" && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-3xl bg-[#17458F]/10 border border-[#17458F]/20 flex items-center justify-center text-[#17458F] animate-pulse">
                <HardDrive className="w-8 h-8 animate-bounce" />
              </div>
              <RefreshCw className="w-6 h-6 text-[#E78023] animate-spin absolute -top-2 -right-2" />
            </div>
            <div className="space-y-1">
              <h4 className="font-heading font-bold text-lg text-slate-900">Scanning Firebase Cloud Storage</h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Crawling storage buckets, checking directory prefixes, and cross-referencing with active Firestore entities...
              </p>
            </div>
            <div className="pt-3">
              <Button variant="secondary" size="sm" onClick={handleCancelScan}>
                Cancel Scan
              </Button>
            </div>
          </div>
        )}

        {/* STAGE 3: SCANNED RESULTS */}
        {stage === "scanned" && scanResult && (
          <div className="space-y-6">
            {/* Top Stat Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Stored</span>
                <div className="text-xl font-extrabold text-slate-900">{scanResult.totalFiles}</div>
                <div className="text-[11px] text-slate-500">{formatStorageBytes(scanResult.totalBytes)}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-1">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">In-Use Assets</span>
                <div className="text-xl font-extrabold text-emerald-900">{scanResult.inUseCount}</div>
                <div className="text-[11px] text-emerald-700">Protected &amp; Live</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/70 space-y-1">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Unused / Orphans</span>
                <div className="text-xl font-extrabold text-amber-900">{scanResult.orphanCount}</div>
                <div className="text-[11px] text-amber-700">Safe to Purge</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/70 space-y-1">
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Reclaimable</span>
                <div className="text-xl font-extrabold text-rose-900">{scanResult.formattedOrphanBytes}</div>
                <div className="text-[11px] text-rose-700">Storage Savings</div>
              </div>
            </div>

            {/* Bucket Inactive / Not Provisioned */}
            {!scanResult.bucketAccessible ? (
              <div className="p-6 sm:p-8 rounded-3xl bg-blue-50/70 border border-blue-200/80 text-center space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-[#17458F] text-white flex items-center justify-center mx-auto shadow-sm">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div className="space-y-1.5 max-w-lg mx-auto">
                  <h4 className="font-heading font-bold text-base text-slate-900">
                    Cloud Storage Bucket Inactive (Spark Tier)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {scanResult.statusMessage}
                  </p>
                  <p className="text-[11px] text-slate-500 pt-1">
                    All website images, posters, and council photos are currently loaded and preserved directly via high-density WebP payloads in Firestore and CDN links. There are 0 unlinked files consuming storage.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href="https://console.firebase.google.com/project/src-jdcoem/storage"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17458F] hover:bg-[#0E2F66] text-white text-xs font-semibold uppercase tracking-wider transition-all shadow-sm"
                  >
                    <span>Enable in Firebase Console</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <Button variant="secondary" size="sm" onClick={handleStartScan} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-check</span>
                  </Button>
                  <Button variant="secondary" size="sm" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            ) : scanResult.orphanCount === 0 ? (
              <div className="p-8 rounded-3xl bg-emerald-50 border border-emerald-200/80 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-heading font-bold text-base text-emerald-950">Storage 100% Clean</h4>
                  <p className="text-xs text-emerald-800/90 max-w-md mx-auto">
                    {scanResult.statusMessage || "Every file in Firebase Cloud Storage is actively referenced by live events, clubs, or council members."}
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-3">
                  <Button variant="secondary" size="sm" onClick={handleStartScan} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-scan Now</span>
                  </Button>
                  <Button variant="primary" size="sm" onClick={onClose}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              /* If orphans found */
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleSelectAll}
                      className="text-slate-600 hover:text-slate-900 flex items-center gap-2 text-xs font-semibold cursor-pointer"
                    >
                      {selectedPaths.size === scanResult.orphanFiles.length ? (
                        <CheckSquare className="w-4 h-4 text-[#17458F]" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>
                        {selectedPaths.size === scanResult.orphanFiles.length
                          ? "Deselect All"
                          : `Select All (${scanResult.orphanFiles.length})`}
                      </span>
                    </button>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">
                      {selectedPaths.size} of {scanResult.orphanFiles.length} selected
                    </span>
                  </div>

                  <Badge variant="orange" size="sm">
                    {scanResult.formattedOrphanBytes} Reclaimable
                  </Badge>
                </div>

                {/* Orphan Files List */}
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                  {scanResult.orphanFiles.map((file) => {
                    const isSelected = selectedPaths.has(file.fullPath);
                    return (
                      <div
                        key={file.fullPath}
                        onClick={() => handleToggleSelect(file.fullPath)}
                        className={`pt-2 pb-2 px-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected ? "bg-amber-50/60 border border-amber-200/50" : "hover:bg-slate-50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            aria-label="Toggle file selection"
                            className="text-slate-400 hover:text-slate-700 shrink-0"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#17458F]" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>

                          {/* Thumbnail */}
                          <div className="relative h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                            {file.downloadUrl ? (
                              <Image
                                src={file.downloadUrl}
                                alt={file.name}
                                fill
                                unoptimized={true}
                                className="object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-slate-400">
                                <FileText className="w-4 h-4" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono truncate">
                              {file.fullPath}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-semibold text-slate-600">
                            {file.formattedSize}
                          </span>
                          {file.downloadUrl && (
                            <a
                              href={file.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded-lg text-slate-400 hover:text-[#17458F] hover:bg-slate-100 transition-colors"
                              title="View file in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Purge Call To Action */}
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-xs text-rose-950">Permanent Bucket Cleanup</h5>
                    <p className="text-[11px] text-rose-800/90">
                      Files will be deleted via Firebase Storage API. Live site content is completely unaffected.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button variant="secondary" size="sm" onClick={handleReset}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={selectedPaths.size === 0}
                      onClick={handlePurgeSelected}
                      className="gap-1.5 shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Purge {selectedPaths.size} Unused Files</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STAGE 4: PURGING */}
        {stage === "purging" && (
          <div className="py-10 space-y-5 text-center">
            <div className="relative mx-auto w-14 h-14">
              <div className="h-14 w-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center animate-pulse">
                <Trash2 className="w-6 h-6 animate-bounce" />
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="font-heading font-bold text-lg text-slate-900">Purging Unused Files</h4>
              <p className="text-xs text-slate-500">
                Deleting {purgeProgress.completed} of {purgeProgress.total} unreferenced files from Firebase Storage...
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden max-w-md mx-auto">
              <div
                className="bg-rose-600 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    purgeProgress.total > 0
                      ? Math.round((purgeProgress.completed / purgeProgress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* STAGE 5: COMPLETED OR BLOCKED */}
        {stage === "completed" && purgeSummary && (
          <div className="space-y-4">
            {/* Case A: Complete Success (0 failures) */}
            {purgeSummary.failedCount === 0 && purgeSummary.deletedCount > 0 && (
              <div className="p-8 rounded-3xl bg-emerald-50 border border-emerald-200/80 text-center space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <h4 className="font-heading font-bold text-lg text-emerald-950">Storage Cleanup Complete!</h4>
                  <p className="text-xs text-emerald-800/90 max-w-md mx-auto">
                    Successfully purged <strong>{purgeSummary.deletedCount}</strong> orphaned media files and reclaimed{" "}
                    <strong>{formatStorageBytes(purgeSummary.reclaimedBytes)}</strong> of Firebase Cloud Storage quota.
                  </p>
                </div>

                <div className="pt-2 flex justify-center gap-3">
                  <Button variant="secondary" size="sm" onClick={handleReset} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run New Scan</span>
                  </Button>
                  <Button variant="primary" size="sm" onClick={onClose}>
                    Close Modal
                  </Button>
                </div>
              </div>
            )}

            {/* Case B: Total Failure / Permission Blocked (0 deleted, failures > 0) */}
            {purgeSummary.deletedCount === 0 && purgeSummary.failedCount > 0 && (
              <div className="p-6 sm:p-7 rounded-3xl bg-rose-50/70 border border-rose-200 text-slate-800 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 text-left">
                    <h4 className="font-heading font-bold text-base text-rose-950">
                      Firebase Cloud Storage Deletion Blocked
                    </h4>
                    <p className="text-xs text-rose-800/90 leading-relaxed">
                      Firebase Storage rejected the deletion of <strong>{purgeSummary.failedCount}</strong> files. This occurs when Firebase Cloud Storage Security Rules do not permit client-side asset deletion.
                    </p>
                  </div>
                </div>

                {/* Error diagnostics */}
                {purgeSummary.errors && purgeSummary.errors.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-white/80 border border-rose-200 text-left space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                      Firebase Rejection Reason:
                    </span>
                    <div className="text-xs font-mono text-slate-700 max-h-24 overflow-y-auto space-y-1">
                      {purgeSummary.errors.slice(0, 3).map((err, i) => (
                        <div key={i} className="p-1.5 rounded-lg bg-rose-50/50 border border-rose-100">
                          {err}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1-Minute Fix: Storage Rules Guide */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-left space-y-3 shadow-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <h5 className="font-bold text-xs text-slate-900">
                        1-Minute Fix: Update Firebase Storage Security Rules
                      </h5>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyRules}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedRules ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy Rules</span>
                          </>
                        )}
                      </button>
                      <a
                        href="https://console.firebase.google.com/project/src-jdcoem/storage/rules"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-xl bg-[#17458F] hover:bg-[#0E2F66] text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <span>Open Rules Tab</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Paste these rules into your Firebase Console Storage tab to authorize deletions for verified console administrators:
                  </p>

                  <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed max-h-36">
                    {RECOMMENDED_STORAGE_RULES}
                  </pre>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                  <Button variant="secondary" size="sm" onClick={onClose}>
                    Close Modal
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleReset} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run New Scan</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Case C: Partial Purge (some succeeded, some failed) */}
            {purgeSummary.deletedCount > 0 && purgeSummary.failedCount > 0 && (
              <div className="p-6 sm:p-7 rounded-3xl bg-amber-50/70 border border-amber-200 text-slate-800 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 text-left">
                    <h4 className="font-heading font-bold text-base text-amber-950">
                      Partial Storage Cleanup
                    </h4>
                    <p className="text-xs text-amber-800/90 leading-relaxed">
                      Successfully purged <strong>{purgeSummary.deletedCount}</strong> files, but <strong>{purgeSummary.failedCount}</strong> files could not be deleted due to permissions.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-center gap-3">
                  <Button variant="secondary" size="sm" onClick={handleReset} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run New Scan</span>
                  </Button>
                  <Button variant="primary" size="sm" onClick={onClose}>
                    Close Modal
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Modal>
  );
}
