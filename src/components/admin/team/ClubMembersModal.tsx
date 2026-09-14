"use client";

import React, { useState, useMemo } from "react";
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Loader2 
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ClubItem, ClubMember } from "@/types";
import { findStudentByBtId } from "@/lib/usersStore";
import { getDepartmentShortName } from "@/lib/departmentsStore";

interface ClubMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  club: ClubItem | null;
  onSaveMembers: (clubIdOrSlug: string, updatedMembers: ClubMember[]) => Promise<void>;
}

export function ClubMembersModal({
  isOpen,
  onClose,
  club,
  onSaveMembers,
}: ClubMembersModalProps) {
  const [bulkInput, setBulkInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Parse comma-separated or newline-separated BT IDs
  const parsedBtIds = useMemo(() => {
    if (!bulkInput.trim()) return [];
    const tokens = bulkInput
      .split(/[\n,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
    return Array.from(new Set(tokens));
  }, [bulkInput]);

  // Existing member BT IDs in this club
  const existingBtIds = useMemo(() => {
    if (!club || !Array.isArray(club.members)) return new Set<string>();
    return new Set(club.members.map((m) => m.btId.trim().toUpperCase()));
  }, [club]);

  // Split parsed tokens into new vs existing
  const { newBtIds, duplicateBtIds } = useMemo(() => {
    const newIds: string[] = [];
    const dupIds: string[] = [];
    for (const bt of parsedBtIds) {
      if (existingBtIds.has(bt)) {
        dupIds.push(bt);
      } else {
        newIds.push(bt);
      }
    }
    return { newBtIds: newIds, duplicateBtIds: dupIds };
  }, [parsedBtIds, existingBtIds]);

  // Pre-fetch student info for preview
  const previewDetails = useMemo(() => {
    const map = new Map<string, ReturnType<typeof findStudentByBtId>>();
    for (const bt of newBtIds) {
      map.set(bt, findStudentByBtId(bt));
    }
    return map;
  }, [newBtIds]);

  const handleAddMembers = async () => {
    if (!club || newBtIds.length === 0 || isSaving) return;

    setIsSaving(true);
    setFeedback(null);
    try {
      const newClubMembers: ClubMember[] = newBtIds.map((btId) => {
        const studentInfo = findStudentByBtId(btId);
        return {
          id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          btId,
          name: studentInfo?.name || undefined,
          department: studentInfo?.department || undefined,
          year: studentInfo?.year || undefined,
          addedAt: new Date().toISOString(),
        };
      });

      const updated = [...(club.members || []), ...newClubMembers];
      await onSaveMembers(club.slug || club.id, updated);

      setBulkInput("");
      setFeedback({
        type: "success",
        message: `Successfully added ${newClubMembers.length} member${newClubMembers.length === 1 ? "" : "s"} to ${club.name}!`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error("Error adding club members:", err);
      setFeedback({
        type: "error",
        message: err?.message || "Failed to save members. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (memberToRemove: ClubMember) => {
    if (!club || isSaving) return;

    const studentInfo = findStudentByBtId(memberToRemove.btId);
    const displayName = memberToRemove.name || studentInfo?.name || memberToRemove.btId;

    if (!window.confirm(`Are you sure you want to remove "${displayName}" (${memberToRemove.btId}) from ${club.name}?`)) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const updated = (club.members || []).filter(
        (m) => m.btId.trim().toUpperCase() !== memberToRemove.btId.trim().toUpperCase()
      );
      await onSaveMembers(club.slug || club.id, updated);
      setFeedback({
        type: "success",
        message: `Removed ${displayName} from ${club.name}.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error("Error removing club member:", err);
      setFeedback({
        type: "error",
        message: err?.message || "Failed to remove member.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!club) return null;

  const currentMembersList = club.members || [];
  const filteredMembers = currentMembersList.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const studentInfo = findStudentByBtId(m.btId);
    const name = (m.name || studentInfo?.name || "").toLowerCase();
    const btId = m.btId.toLowerCase();
    const dept = (m.department || studentInfo?.department || "").toLowerCase();
    return name.includes(q) || btId.includes(q) || dept.includes(q);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${club.name} • Inducted Members`}
      subtitle={`Manage active student members. Admin inputs BT IDs in bulk; name, year, and branch are automatically fetched from the system.`}
      maxWidth="4xl"
    >
      <div className="space-y-6 pt-2">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
              feedback.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="p-1 hover:bg-black/5 rounded-md cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Club Quick Info Ribbon */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#17458F]/10 border border-[#17458F]/20 flex items-center justify-center text-[#17458F]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#0F172A]">{club.name}</h3>
              <p className="text-xs text-slate-500 font-medium">
                Category: <strong className="text-[#E78023]">{club.category}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#17458F] bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{currentMembersList.length} Inducted Members</span>
            </span>
          </div>
        </div>

        {/* SECTION 1: BULK ADD MEMBERS BY BT ID */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="space-y-1">
            <label className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-[#E78023]" />
              <span>Bulk Enter BT IDs</span>
              <span className="text-xs font-normal text-slate-500">(Separated by commas)</span>
            </label>
            <p className="text-xs text-slate-500 font-medium">
              Paste or type student BT IDs separated by commas or newlines. Name, department, and academic year will automatically be resolved from database records.
            </p>
          </div>

          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder="e.g. BT230015EE, BT230049AI, BT240115DS, BT230036CS, BT01TEST..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-[#17458F] focus:border-transparent transition-all resize-y"
          />

          {/* Live Preview of parsed BT IDs */}
          {parsedBtIds.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">
                  Detected {parsedBtIds.length} BT ID{parsedBtIds.length === 1 ? "" : "s"}:
                </span>
                <span className="text-slate-500 font-medium">
                  {newBtIds.length} New • {duplicateBtIds.length} Already in Club
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {parsedBtIds.map((bt) => {
                  const isExisting = existingBtIds.has(bt);
                  const student = previewDetails.get(bt);

                  if (isExisting) {
                    return (
                      <span
                        key={bt}
                        className="text-[10px] font-mono font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 line-through opacity-70"
                        title="Already a member of this club"
                      >
                        {bt} (Already In)
                      </span>
                    );
                  }

                  return (
                    <span
                      key={bt}
                      className={`text-[10px] font-medium px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                        student?.name
                          ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                          : "bg-blue-50 text-[#17458F] border-blue-200"
                      }`}
                    >
                      <span className="font-mono font-bold">{bt}</span>
                      {student?.name ? (
                        <span className="font-semibold text-emerald-700">
                          ➔ {student.name} {student.department ? `(${getDepartmentShortName(student.department)})` : ""}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[9px]">
                          (Details sync on signup)
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400 font-medium">
              🔒 Zero-Photo: Invariant standard — photos are never stored for members.
            </span>

            <div className="flex items-center gap-2">
              {bulkInput && (
                <button
                  type="button"
                  onClick={() => setBulkInput("")}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <Button
                type="button"
                onClick={handleAddMembers}
                disabled={newBtIds.length === 0 || isSaving}
                variant="primary"
                size="sm"
                className="gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Adding Members...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Add {newBtIds.length} Member{newBtIds.length === 1 ? "" : "s"}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* SECTION 2: CURRENT MEMBERS ROSTER TABLE */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-sm text-[#0F172A] uppercase tracking-wide">
                Inducted Club Members ({currentMembersList.length})
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Student members will receive the &ldquo;{club.name} Member&rdquo; badge in their delegate portal.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by BT ID or Name..."
                className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#17458F]"
              />
            </div>
          </div>

          {currentMembersList.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <h5 className="font-bold text-sm text-slate-700">No members inducted yet</h5>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Use the bulk input box above to add student BT IDs. Their names will display immediately if registered.
              </p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">
                No members match your search query &ldquo;{searchQuery}&rdquo;.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">BT ID</th>
                    <th className="py-2.5 px-4">Student Name</th>
                    <th className="py-2.5 px-4">Department &amp; Year</th>
                    <th className="py-2.5 px-4 text-right w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map((member, idx) => {
                    const studentInfo = findStudentByBtId(member.btId);
                    const displayName = member.name || studentInfo?.name;
                    const displayDept = member.department || studentInfo?.department;
                    const displayYear = member.year || studentInfo?.year;

                    return (
                      <tr
                        key={member.id || member.btId || idx}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-2.5 px-4 text-center font-mono text-slate-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-[#E78023]">
                          {member.btId}
                        </td>
                        <td className="py-2.5 px-4">
                          {displayName ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#0F172A]">{displayName}</span>
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                                Verified
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">
                              Pending user account
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {displayDept ? (
                            <span>
                              {getDepartmentShortName(displayDept)} {displayYear ? `• ${displayYear}` : ""}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member)}
                            disabled={isSaving}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer disabled:opacity-30"
                            title="Remove member from club"
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

        {/* Modal Actions Footer */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Role hierarchy status: <strong>Tier 5 (Club Member)</strong>
          </span>
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            size="sm"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
