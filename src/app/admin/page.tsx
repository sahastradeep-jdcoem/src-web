"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Calendar, 
  FileText, 
  Sparkles, 
  Users, 
  TrendingUp, 
  ArrowRight, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Building2,
  Sliders,
  Database,
  Download,
  Upload,
  Activity,
  Check,
  RefreshCw,
  HardDrive,
  Trash2,
  Cloud,
  CloudUpload,
  Zap,
  CheckCircle
} from "lucide-react";
import { StorageCleanerModal } from "@/components/admin/StorageCleanerModal";
import { Button } from "@/components/ui/Button";
import { 
  getStoredClubs, 
  saveStoredClubs, 
  getStoredCouncilMembers, 
  saveStoredCouncilMembers,
  getStoredHostingCommittee,
  saveStoredHostingCommittee,
  getStoredFoundingMembers,
  saveStoredFoundingMembers,
  getStoredSpokespersons,
  saveStoredSpokespersons
} from "@/lib/councilStore";
import { getStoredEvents, saveStoredEvents } from "@/lib/eventsStore";
import { getStoredUsers, syncUsersFromFirestore, mergeRemoteUsers } from "@/lib/usersStore";
import { getStoredTenures, saveStoredTenures } from "@/lib/tenureStore";
import { getStoredDepartments, saveStoredDepartments } from "@/lib/departmentsStore";
import { getStoredGalleryPhotos, saveStoredGalleryPhotos } from "@/lib/galleryStore";
import { getStoredHeroSettings, saveStoredHeroSettings } from "@/lib/heroStore";
import { subscribeToUsersFromFirestore } from "@/lib/firebase/firestore";
import { 
  scanFirestoreImageStorage, 
  migrateAllLegacyImages, 
  MigrationScanReport, 
  MigrationProgress 
} from "@/lib/firebase/cloudStorageMigrator";
import { toast } from "@/lib/toastStore";

export default function AdminOverviewPage() {
  const [councilCount, setCouncilCount] = useState(0);
  const [clubsCount, setClubsCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [registrationsCount, setRegistrationsCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);

  // Blaze Cloud Storage Migration State
  const [scanReport, setScanReport] = useState<MigrationScanReport | null>(null);
  const [isScanningImages, setIsScanningImages] = useState(false);
  const [isMigratingImages, setIsMigratingImages] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshCounts = () => {
    setCouncilCount(getStoredCouncilMembers().length);
    setClubsCount(getStoredClubs().length);
    setEventsCount(getStoredEvents().length);
    setUsersCount(getStoredUsers().length);
    try {
      const local = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      const eventRegs = Array.isArray(local) 
        ? local.filter((r: any) => !r.id?.startsWith("hub_") && !r.customAnswers?.isHubBallot && !r.customAnswers?.isHubSubmission && !r.eventTitle?.startsWith("[HUB]")) 
        : [];
      setRegistrationsCount(eventRegs.length);
    } catch {
      setRegistrationsCount(0);
    }
  };

  useEffect(() => {
    refreshCounts();
    syncUsersFromFirestore().then((synced) => {
      if (synced) setUsersCount(synced.length);
    });

    const unsubscribeFirestore = subscribeToUsersFromFirestore((remoteUsers) => {
      if (remoteUsers && remoteUsers.length > 0) {
        const merged = mergeRemoteUsers(remoteUsers as any);
        setUsersCount(merged.length);
      }
    });

    window.addEventListener("src_council_team_updated", refreshCounts);
    window.addEventListener("src_clubs_updated", refreshCounts);
    window.addEventListener("src_events_updated", refreshCounts);
    window.addEventListener("src_users_updated", refreshCounts);
    window.addEventListener("storage", refreshCounts);

    return () => {
      unsubscribeFirestore();
      window.removeEventListener("src_council_team_updated", refreshCounts);
      window.removeEventListener("src_clubs_updated", refreshCounts);
      window.removeEventListener("src_events_updated", refreshCounts);
      window.removeEventListener("src_users_updated", refreshCounts);
      window.removeEventListener("storage", refreshCounts);
    };
  }, []);

  // 1-Click Disaster Recovery Full JSON Export
  const handleExportBackup = () => {
    setIsExporting(true);
    try {
      const backupPayload = {
        version: "1.0.0-prod",
        exportedAt: new Date().toISOString(),
        site: "SRC JDCOEM Sahastradeep",
        data: {
          tenures: getStoredTenures(),
          events: getStoredEvents(),
          clubs: getStoredClubs(),
          councilTeam: getStoredCouncilMembers(),
          hostingCommittee: getStoredHostingCommittee(),
          foundingMembers: getStoredFoundingMembers(),
          spokespersons: getStoredSpokespersons(),
          departments: getStoredDepartments(),
          gallery: getStoredGalleryPhotos(),
          hero: getStoredHeroSettings(),
          localRegistrations: JSON.parse(localStorage.getItem("src_local_registrations") || "[]"),
          registeredUsers: getStoredUsers(),
        },
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `SRC_JDCOEM_Full_Backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Full system backup JSON exported successfully!", "Disaster Recovery");
    } catch (e) {
      toast.error("Failed to export backup JSON.", "Export Error");
    } finally {
      setIsExporting(false);
    }
  };

  // Restore From JSON Backup
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.data) {
          throw new Error("Invalid backup format: missing data root.");
        }

        const { data } = parsed;
        if (Array.isArray(data.tenures)) saveStoredTenures(data.tenures);
        if (Array.isArray(data.events)) saveStoredEvents(data.events);
        if (Array.isArray(data.clubs)) saveStoredClubs(data.clubs);
        if (Array.isArray(data.councilTeam)) saveStoredCouncilMembers(data.councilTeam);
        if (Array.isArray(data.hostingCommittee)) saveStoredHostingCommittee(data.hostingCommittee);
        if (Array.isArray(data.foundingMembers)) saveStoredFoundingMembers(data.foundingMembers);
        if (Array.isArray(data.spokespersons)) saveStoredSpokespersons(data.spokespersons);
        if (Array.isArray(data.departments)) saveStoredDepartments(data.departments);
        if (Array.isArray(data.gallery)) saveStoredGalleryPhotos(data.gallery);
        if (data.hero) saveStoredHeroSettings(data.hero);

        if (Array.isArray(data.localRegistrations)) {
          try {
            localStorage.setItem("src_local_registrations", JSON.stringify(data.localRegistrations));
          } catch (regErr) {
            console.warn("Quota exceeded restoring local registrations:", regErr);
          }
        }

        refreshCounts();
        toast.success("All collections restored & synced with Firestore!", "System Restored");
      } catch (err: any) {
        toast.error(`Restore failed: ${err?.message || "Invalid JSON"}`, "Error");
      } finally {
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleScanImages = async () => {
    setIsScanningImages(true);
    try {
      const report = await scanFirestoreImageStorage();
      setScanReport(report);
      toast.success(
        `Storage audit complete: ${report.cloudImages} on Cloud Storage CDN, ${report.base64Images} legacy Base64.`
      );
    } catch (err: any) {
      toast.error("Failed to scan Firestore image storage: " + (err?.message || err));
    } finally {
      setIsScanningImages(false);
    }
  };

  const handleMigrateImages = async () => {
    setIsMigratingImages(true);
    setMigrationProgress({
      phase: "scanning",
      totalToMigrate: 0,
      migratedCount: 0,
      currentEntity: "Connecting to Firebase Cloud Storage...",
      bytesSaved: 0,
    });

    try {
      const res = await migrateAllLegacyImages((prog) => {
        setMigrationProgress(prog);
      });

      if (res.success) {
        toast.success(
          `Successfully migrated ${res.migratedCount} images to Cloud Storage! Saved ${(res.bytesSaved / 1024).toFixed(0)} KB in Firestore.`
        );
        // Refresh scan report
        handleScanImages();
      } else {
        toast.error("Migration finished with notice: " + (res.error || "Some items could not be migrated."));
      }
    } catch (err: any) {
      toast.error("Migration failed: " + (err?.message || err));
    } finally {
      setIsMigratingImages(false);
    }
  };

  const metrics = [
    {
      title: "Active Users",
      value: String(usersCount),
      change: "Google Auth",
      isPositive: true,
      icon: UserCheck,
      sub: "Student Directory",
    },
    {
      title: "Active Events",
      value: String(eventsCount),
      change: "Directory Studio",
      isPositive: true,
      icon: Calendar,
      sub: "Council Flagship",
    },
    {
      title: "Verified Passes",
      value: String(registrationsCount),
      change: "Live Database",
      isPositive: true,
      icon: FileText,
      sub: "Active Roster",
    },
    {
      title: "Active Clubs",
      value: String(clubsCount),
      change: "100% Chartered",
      isPositive: true,
      icon: Sparkles,
      sub: "Official Roster",
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Top Admin Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight font-heading">
              ADMIN DASHBOARD
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Centralized operations, positions, active users, clubs, hero customization, and registrations console.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/users"
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#17458F]" />
            <span>Active Users</span>
          </Link>
          <Link
            href="/admin/events"
            className="px-4 py-2 rounded-xl bg-[#17458F] hover:bg-[#0E2F66] text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span>Events Manager</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, i) => {
          const Icon = metric.icon;
          return (
            <div
              key={i}
              className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 hover:border-[#17458F]/30 transition-all shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {metric.title}
                </span>
                <div className="h-8 w-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#17458F]">
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-hero font-extrabold text-3xl text-[#0F172A]">
                  {metric.value}
                </h3>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-600">
                    {metric.change}
                  </span>
                  <span className="text-slate-400 font-medium">
                    {metric.sub}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Access Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <Link
          href="/admin/users"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-blue-50 text-[#17458F] flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#17458F] transition-colors">
            Active Users &amp; Student Directory
          </h4>
          <p className="text-xs text-slate-500">
            View all authenticated students, search by BT ID, branch, or email, and manage council admin permissions.
          </p>
        </Link>

        <Link
          href="/admin/hero"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#E78023] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-amber-50 text-[#E78023] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#E78023] transition-colors">
            Hero Studio &amp; Mottos
          </h4>
          <p className="text-xs text-slate-500">
            Change the 100vh background wallpaper, 3 hero motto texts, and live banner ribbons.
          </p>
        </Link>

        <Link
          href="/admin/team"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-[#17458F] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#17458F] transition-colors">
            Council &amp; Positions Roster
          </h4>
          <p className="text-xs text-slate-500">
            Create, edit, or remove admin positions, student officers, departments, and pre-configure upcoming tenures.
          </p>
        </Link>

        <Link
          href="/admin/clubs"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#E78023] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#E78023] transition-colors">
            Clubs Directory Studio
          </h4>
          <p className="text-xs text-slate-500">
            Add new clubs, edit club names, domains, taglines, club heads, and hero banners.
          </p>
        </Link>

        <Link
          href="/admin/departments"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#17458F] transition-colors">
            Academic Departments Roster
          </h4>
          <p className="text-xs text-slate-500">
            Add, rename, or discontinue college branches and degree programs with live sync.
          </p>
        </Link>

        <Link
          href="/admin/registrations"
          className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F] transition-all group shadow-xs space-y-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-base text-slate-900 group-hover:text-[#17458F] transition-colors">
            Delegate Passes &amp; Check-Ins
          </h4>
          <p className="text-xs text-slate-500">
            Real-time participant accreditation roster with live QR check-ins, payment ledger, and Excel export.
          </p>
        </Link>

      </div>

      {/* System Maintenance & Data Integrity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Disaster Recovery & Full Backup Panel */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-slate-100 text-slate-700">
                <Database className="w-6 h-6 text-[#17458F]" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-slate-900">
                  Disaster Recovery &amp; Backup
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Export site snapshot or restore from an existing JSON backup.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Downloads or restores all Tenures, Events, Clubs, Positions, Gallery, and Registrations with direct Firestore synchronization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={handleExportBackup}
              disabled={isExporting}
              variant="primary"
              size="sm"
              className="gap-2 shadow-sm"
            >
              {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Download Backup (JSON)</span>
            </Button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleRestoreFile}
              accept=".json"
              className="hidden"
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRestoring}
              variant="secondary"
              size="sm"
              className="gap-2"
            >
              {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Restore Backup</span>
            </Button>
          </div>
        </div>

        {/* Storage Maintenance & Orphan Cleaner Panel */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100">
                  <HardDrive className="w-6 h-6 text-[#E78023]" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">
                    Storage Maintenance
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Garbage collect unlinked media files in Firebase Cloud Storage.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Audit the cloud storage bucket for superseded posters, deleted member photos, and replaced logos. Safely purge unreferenced files to preserve quota.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={() => setIsStorageModalOpen(true)}
              variant="primary"
              size="sm"
              className="gap-2 bg-[#E78023] hover:bg-[#D0701B] text-white shadow-sm cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Scan &amp; Purge Unused Files</span>
            </Button>
          </div>
        </div>

        {/* Firebase Blaze & Cloud Storage Architecture Panel */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between lg:col-span-2">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <Cloud className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-lg text-slate-900">
                      Firebase Blaze Cloud Media Engine
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Blaze Plan Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Google Cloud Storage CDN (gs://src-jdcoem.firebasestorage.app) with 1-year immutable caching.
                  </p>
                </div>
              </div>

              {scanReport && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold">
                    {scanReport.cloudImages} Cloud Assets
                  </span>
                  <span className={`px-3 py-1 rounded-xl font-bold ${
                    scanReport.base64Images > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {scanReport.base64Images} Legacy Base64 ({((scanReport.base64BytesApprox || 0) / 1024).toFixed(0)} KB)
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              With the Blaze upgrade, images stream directly to Google Cloud CDN instead of embedding heavy Base64 inside Firestore documents. 
              Scan your Firestore database to audit asset distribution, or run the 1-click batch migrator to convert all legacy Base64 images into permanent Cloud Storage assets.
            </p>

            {migrationProgress && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-2">
                    {migrationProgress.phase === "migrating" && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#17458F]" />}
                    {migrationProgress.phase === "completed" && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                    {migrationProgress.currentEntity}
                  </span>
                  <span className="text-slate-500 font-medium">
                    Migrated: {migrationProgress.migratedCount}
                  </span>
                </div>
                {migrationProgress.phase === "migrating" && (
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-[#17458F] animate-pulse w-3/4 rounded-full" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={handleScanImages}
              disabled={isScanningImages || isMigratingImages}
              variant="secondary"
              size="sm"
              className="gap-2 cursor-pointer"
            >
              {isScanningImages ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              <span>Scan Database Media</span>
            </Button>

            <Button
              onClick={handleMigrateImages}
              disabled={isMigratingImages || isScanningImages}
              variant="primary"
              size="sm"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
            >
              {isMigratingImages ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
              <span>Migrate All Images to Cloud Storage</span>
            </Button>
          </div>
        </div>

      </div>

      {/* Storage Cleaner Modal */}
      <StorageCleanerModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
      />

    </div>
  );
}
