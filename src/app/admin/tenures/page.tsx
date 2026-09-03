"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Trophy, 
  Plus, 
  Calendar, 
  RotateCcw, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  Eye, 
  AlertCircle, 
  ArrowRight,
  Clock,
  Layers,
  Archive,
  Users
} from "lucide-react";
import { 
  getStoredTenures, 
  saveStoredTenures, 
  switchActiveTenure, 
  createAndActivateNewTenure, 
  syncTenuresFromFirestore,
  CouncilTenure 
} from "@/lib/tenureStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TenureSwitcherModal } from "@/components/admin/TenureSwitcherModal";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { CouncilMemberCard } from "@/components/team/CouncilMemberCard";

export default function AdminTenuresPage() {
  const [tenures, setTenures] = useState<CouncilTenure[]>([]);
  const [selectedTenure, setSelectedTenure] = useState<CouncilTenure | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const refresh = () => {
    const list = getStoredTenures();
    setTenures(list);
    if (!selectedTenure) {
      setSelectedTenure(list.find((t) => t.isCurrent) || list[0]);
    } else {
      setSelectedTenure(list.find((t) => t.id === selectedTenure.id) || list[0]);
    }
  };

  useEffect(() => {
    refresh();

    syncTenuresFromFirestore().then((res) => {
      if (res) {
        setTenures(res);
        setSelectedTenure(res.find((t) => t.isCurrent) || res[0]);
      }
    });

    const handleUpdate = () => {
      refresh();
    };

    window.addEventListener("src_tenures_updated", handleUpdate);
    window.addEventListener("src_tenure_changed", handleUpdate);
    window.addEventListener("src_council_team_updated", handleUpdate);
    window.addEventListener("src_hosting_updated", handleUpdate);
    window.addEventListener("src_founding_members_updated", handleUpdate);
    window.addEventListener("src_events_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("src_tenures_updated", handleUpdate);
      window.removeEventListener("src_tenure_changed", handleUpdate);
      window.removeEventListener("src_council_team_updated", handleUpdate);
      window.removeEventListener("src_hosting_updated", handleUpdate);
      window.removeEventListener("src_founding_members_updated", handleUpdate);
      window.removeEventListener("src_events_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const currentTenure = tenures.find((t) => t.isCurrent) || tenures[0];

  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [activatingTenure, setActivatingTenure] = useState<CouncilTenure | null>(null);
  const [tenureBeginDate, setTenureBeginDate] = useState(new Date().toISOString().split("T")[0]);

  const handleOpenActivate = (tenure: CouncilTenure) => {
    setActivatingTenure(tenure);
    setTenureBeginDate(new Date().toISOString().split("T")[0]);
    setIsActivateModalOpen(true);
  };

  const handleConfirmActivate = () => {
    if (!activatingTenure) return;
    switchActiveTenure(activatingTenure.id, tenureBeginDate);
    refresh();
    setIsActivateModalOpen(false);
    setActivatingTenure(null);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      <AdminTopBar />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
              COUNCIL TENURES &amp; ARCHIVE STUDIO
            </h1>
            <Badge variant="orange" size="sm">
              SESSION MANAGEMENT
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Manage annual council tenures (e.g. 2025-26, 2026-27), archive historic teams, and advance to new academic seasons.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            size="sm"
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Change / Advance Tenure</span>
          </Button>

          <Link
            href="/archive"
            target="_blank"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Preview Live /archive Page in New Tab"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Active tenure switched! Public /team and events updated to the selected session.</span>
          </div>
          <Link href="/team" target="_blank" className="text-emerald-700 underline font-bold uppercase tracking-wider">
            View Live Public Team &rarr;
          </Link>
        </div>
      )}

      {/* Active Tenure Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#17458F] to-[#0E2F66] text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md border border-white/10">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#E78023] text-white">
              {currentTenure?.tenureNumber || "ACTIVE TENURE"}
            </span>
            <span className="text-xs text-blue-200 font-mono">Academic Year {currentTenure?.academicYear}</span>
            {currentTenure?.startDate && (
              <span className="text-xs text-blue-200/80 font-sans">
                • Commenced {new Date(currentTenure.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white">
            {currentTenure?.tenureNumber ? `${currentTenure.tenureNumber} (${currentTenure.label})` : `Tenure ${currentTenure?.label}`}
          </h2>
          <p className="text-xs text-blue-100 max-w-2xl leading-relaxed">
            {currentTenure?.archiveNotes || "Currently serving leadership body across all campus operations."}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-3 rounded-2xl bg-white text-[#17458F] hover:bg-slate-50 font-bold text-xs uppercase tracking-wider transition-all shadow-sm shrink-0 cursor-pointer"
        >
          Change Active Tenure &rarr;
        </button>
      </div>

      {/* Main Grid: Tenures List vs Selected Tenure Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Col: All Tenures Selector */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#17458F] uppercase tracking-wide">
              All Council Sessions ({tenures.length})
            </h3>
          </div>

          <div className="space-y-3">
            {tenures.map((t) => {
              const isSelected = selectedTenure?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTenure(t)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? "bg-white border-[#17458F] ring-2 ring-[#17458F]/10 shadow-sm"
                      : "bg-slate-50/70 border-slate-200 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-heading font-bold text-sm text-[#0F172A]">
                        {t.tenureNumber ? `${t.tenureNumber} (${t.label})` : `Tenure ${t.label}`}
                      </h4>
                      {t.id === "tenure-2025-26" && (
                        <span className="px-2 py-0.5 rounded-full bg-[#E78023]/10 text-[#E78023] border border-[#E78023]/20 text-[9px] font-bold uppercase tracking-wider">
                          Founding
                        </span>
                      )}
                      {t.isCurrent ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase tracking-wider">
                          Active
                        </span>
                      ) : t.isDraft ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-[9px] font-bold uppercase tracking-wider">
                          Draft (Admin Only)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[9px] font-bold uppercase tracking-wider">
                          Archived
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 font-medium">
                      {t.academicYear}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                    <span>{t.adminCouncil?.length || 0} Admins</span>
                    <span>{t.events?.length || 0} Events</span>
                    {t.isCurrent ? (
                      <span className="font-bold text-emerald-600">Currently Serving</span>
                    ) : t.isDraft ? (
                      <span className="font-bold text-amber-700">Draft • Hidden from Site</span>
                    ) : (
                      <span className="text-[#17458F] font-bold hover:underline">View Snapshot &rarr;</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Cols: Selected Tenure Details & Team Snapshot */}
        {selectedTenure && (
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-extrabold text-xl text-[#0F172A]">
                      Tenure {selectedTenure.label} Snapshot
                    </h3>
                    {selectedTenure.isCurrent ? (
                      <Badge variant="success" size="sm">
                        CURRENT LIVE TENURE
                      </Badge>
                    ) : selectedTenure.isDraft ? (
                      <Badge variant="orange" size="sm">
                        DRAFT (HIDDEN FROM PUBLIC SITE)
                      </Badge>
                    ) : (
                      <Badge variant="slate" size="sm">
                        ARCHIVED SESSION
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Academic Year {selectedTenure.academicYear}
                    {selectedTenure.startDate && (
                      <span className="ml-2 text-slate-600 font-sans">
                        • Commenced {new Date(selectedTenure.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </p>
                </div>

                {!selectedTenure.isCurrent && (
                  <button
                    onClick={() => handleOpenActivate(selectedTenure)}
                    className="px-4 py-2 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Activate Tenure {selectedTenure.label} Live</span>
                  </button>
                )}
              </div>

              {selectedTenure.isDraft && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                    <span>Draft Status Protected</span>
                  </div>
                  <p>
                    This tenure is visible <strong>only to admins</strong> on this console. It will <strong>NOT</strong> appear on the public site (e.g. <code>/archive</code> or <code>/team</code>) until you click &quot;Activate Tenure {selectedTenure.label} Live&quot;.
                  </p>
                </div>
              )}

              {selectedTenure.archiveNotes && (
                <div className="p-3.5 rounded-2xl bg-slate-50 text-slate-600 text-xs leading-relaxed border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-0.5">Session Overview:</span>
                  {selectedTenure.archiveNotes}
                </div>
              )}

              {/* Admin Team in this Tenure */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-[#17458F] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#E78023]" />
                    <span>Admin Council ({selectedTenure.adminCouncil?.length || 0})</span>
                  </span>
                  <Link 
                    href={`/admin/team?tenure=${selectedTenure.id}`}
                    className="text-xs font-bold text-[#E78023] hover:underline flex items-center gap-1"
                  >
                    <span>{selectedTenure.isCurrent ? "Edit Live Team in Studio" : "Pre-Configure Team in Studio"} &rarr;</span>
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedTenure.adminCouncil?.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3"
                    >
                      <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                        <Image
                          src={m.avatar}
                          alt={m.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-[#0F172A] truncate">{m.name}</h4>
                        <p className="text-[11px] text-[#E78023] font-semibold truncate">{m.role}</p>
                        <p className="text-[10px] text-slate-500 truncate">{m.department}</p>
                      </div>
                    </div>
                  ))}
                  {(!selectedTenure.adminCouncil || selectedTenure.adminCouncil.length === 0) && (
                    <div className="col-span-2 p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl">
                      No admins recorded in this tenure.
                    </div>
                  )}
                </div>
              </div>

              {/* Events in this Tenure */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-[#17458F] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#E78023]" />
                    <span>Associated Events ({selectedTenure.events?.length || 0})</span>
                  </span>
                  {selectedTenure.isCurrent && (
                    <Link href="/admin/events" className="text-xs font-bold text-[#E78023] hover:underline">
                      Edit Events in Studio &rarr;
                    </Link>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedTenure.events?.map((e) => (
                    <div
                      key={e.id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3"
                    >
                      <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-slate-200 shrink-0">
                        <Image
                          src={e.poster}
                          alt={e.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-[#0F172A] truncate">{e.name}</h4>
                        <p className="text-[10px] text-[#17458F] font-semibold truncate">{e.category} • {e.date}</p>
                        <p className="text-[10px] text-slate-500 truncate">{e.venue}</p>
                      </div>
                    </div>
                  ))}
                  {(!selectedTenure.events || selectedTenure.events.length === 0) && (
                    <div className="col-span-2 p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl">
                      No events recorded in this tenure.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Activate Tenure Modal with Begin Date input */}
      <Modal
        isOpen={isActivateModalOpen}
        onClose={() => setIsActivateModalOpen(false)}
        title={`Activate Tenure ${activatingTenure?.label} Live`}
      >
        <div className="space-y-5 text-xs text-[#0F172A]">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#17458F]">
              <Sparkles className="w-4 h-4 text-[#E78023]" />
              <span>Mark as Active Live Tenure</span>
            </div>
            <p className="leading-relaxed">
              Activating <strong>Tenure {activatingTenure?.label}</strong> ({activatingTenure?.academicYear}) will immediately publish its <strong>{activatingTenure?.adminCouncil?.length || 0} appointed leaders</strong> on the public website (including <code>/team</code>, homepage spotlight, and official archives).
            </p>
            <p className="text-[11px] text-amber-800">
              The currently active tenure ({currentTenure?.label}) will be safely transitioned to <strong>Archived Session</strong> status with all historic rosters preserved.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">
              Tenure Begin Date *
            </label>
            <input
              type="date"
              required
              value={tenureBeginDate}
              onChange={(e) => setTenureBeginDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
            />
            <p className="text-[11px] text-slate-500">
              This official commencement date will be recorded and published on the council archive.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsActivateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmActivate}
              className="bg-[#17458F] hover:bg-[#123670] text-white cursor-pointer"
            >
              Confirm &amp; Launch Live Now &rarr;
            </Button>
          </div>
        </div>
      </Modal>

      <TenureSwitcherModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

    </div>
  );
}
