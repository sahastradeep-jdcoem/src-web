"use client";

import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Sparkles, 
  RotateCcw, 
  Plus, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight,
  Clock,
  Layers,
  AlertCircle
} from "lucide-react";
import { 
  getStoredTenures, 
  getCurrentTenure, 
  switchActiveTenure, 
  createAndActivateNewTenure, 
  CouncilTenure 
} from "@/lib/tenureStore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface TenureSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TenureSwitcherModal({ isOpen, onClose }: TenureSwitcherModalProps) {
  const [tenures, setTenures] = useState<CouncilTenure[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newLabel, setNewLabel] = useState("2026-27");
  const [newAcademicYear, setNewAcademicYear] = useState("2026 - 2027");
  const [newTheme, setNewTheme] = useState("Vibrance & Future Horizons");
  const [startWithTemplate, setStartWithTemplate] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = () => {
    setTenures(getStoredTenures());
  };

  useEffect(() => {
    if (isOpen) {
      refresh();
      setIsCreatingNew(false);
      setFeedback(null);
    }
  }, [isOpen]);

  const currentTenure = tenures.find((t) => t.isCurrent) || tenures[0];

  const handleSwitchTenure = (tenureId: string, label: string) => {
    switchActiveTenure(tenureId);
    refresh();
    setFeedback(`Active tenure switched to ${label}! Live team & events updated.`);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleCreateNewTenure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newAcademicYear.trim()) {
      alert("Please provide both a Tenure Label (e.g. 2026-27) and Academic Year.");
      return;
    }

    createAndActivateNewTenure(newLabel.trim(), newAcademicYear.trim(), newTheme.trim(), startWithTemplate);
    refresh();
    setFeedback(`New tenure ${newLabel} created & activated! Old tenure safely archived.`);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Academic Tenure & Council Session Manager">
      <div className="space-y-6 text-xs text-[#0F172A]">
        
        {/* Info Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#E78023] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Changing tenure switches the live active student council roster and active events. The previous tenure&apos;s team and events are preserved in historical archives.
          </p>
        </div>

        {feedback && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {!isCreatingNew ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Available Tenures ({tenures.length})
              </span>
              <Button
                onClick={() => setIsCreatingNew(true)}
                variant="primary"
                size="sm"
                className="gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Tenure (e.g. 2026-27)</span>
              </Button>
            </div>

            {/* List of Tenures */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {tenures.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                    t.isCurrent
                      ? "bg-blue-50/50 border-[#17458F] shadow-xs"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-extrabold text-sm text-[#0F172A]">
                        Tenure {t.label}
                      </span>
                      {t.isCurrent ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                          Active Now
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {t.theme || t.academicYear}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-sans">
                      <span>{t.adminCouncil?.length || 0} Admins</span>
                      <span>•</span>
                      <span>{t.events?.length || 0} Events Listed</span>
                    </div>
                  </div>

                  <div>
                    {t.isCurrent ? (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Current</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSwitchTenure(t.id, t.label)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        Activate Tenure
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Create New Tenure Form */
          <form onSubmit={handleCreateNewTenure} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-sm text-[#17458F]">Advance to New Academic Tenure</h4>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                &larr; Back to List
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Tenure Code / Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026-27"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Academic Year String *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026 - 2027"
                  value={newAcademicYear}
                  onChange={(e) => setNewAcademicYear(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Tenure Theme / Motto</label>
              <input
                type="text"
                placeholder="e.g. Vibrance & Future Horizons"
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
              <input
                type="checkbox"
                id="templateTeam"
                checked={startWithTemplate}
                onChange={(e) => setStartWithTemplate(e.target.checked)}
                className="rounded text-[#17458F] focus:ring-[#17458F]"
              />
              <label htmlFor="templateTeam" className="text-slate-700 font-medium cursor-pointer">
                Pre-populate standard leadership positions (Mentor, President) ready to edit
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingNew(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Create &amp; Activate {newLabel}
              </Button>
            </div>
          </form>
        )}

      </div>
    </Modal>
  );
}
