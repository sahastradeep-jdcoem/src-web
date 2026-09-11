"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Check, 
  Hash, 
  Trash2, 
  Save, 
  Loader2,
  AlertCircle 
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { UniversalImageUploader } from "@/components/ui/UniversalImageUploader";
import { TeamMember, ClubItem } from "@/types";

interface PositionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMember: TeamMember | null;
  isCreatingNew: boolean;
  activeTab: "council" | "hosting" | "founding" | "clubs" | "pillars";
  clubsList: ClubItem[];
  departmentsList: string[];
  currentMembersCount: number;
  pendingUploads: number;
  onUploadStateChange: (uploading: boolean) => void;
  onSave: (member: TeamMember) => void;
  onDelete?: (id: string, name: string) => void;
}

export function PositionFormModal({
  isOpen,
  onClose,
  initialMember,
  isCreatingNew,
  activeTab,
  clubsList,
  departmentsList,
  currentMembersCount,
  pendingUploads,
  onUploadStateChange,
  onSave,
  onDelete,
}: PositionFormModalProps) {
  const [formMember, setFormMember] = useState<TeamMember | null>(initialMember);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormMember(initialMember);
    setFormError(null);
  }, [initialMember]);

  if (!isOpen || !formMember) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMember && !isSubmitting) {
      try {
        setIsSubmitting(true);
        setFormError(null);
        await onSave(formMember);
      } catch (err: any) {
        setFormError(err?.message || "Failed to save changes to cloud database. Please check your internet connection and try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const title = activeTab === "pillars"
    ? `Edit Postcard: ${formMember.name || "Pillar"}`
    : activeTab === "clubs"
    ? isCreatingNew
      ? "Add Club Head / Co-Head"
      : `Edit Club Leader: ${formMember.name || "Leader"}`
    : isCreatingNew
    ? "Add New Council Position & Officer"
    : `Edit: ${formMember.role || "Position"}`;

  const subtitle = activeTab === "pillars"
    ? "Edit official designation, institutional role, guidance quote, and high-res portrait photo for this pillar."
    : activeTab === "clubs"
    ? "Crop & upload avatar photo (PFP), student credentials, and BT ID for this chartered society."
    : "Configure position title, student officer credentials, hierarchy rank, and photo.";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs text-slate-900">
        
        {formError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium leading-relaxed">{formError}</span>
          </div>
        )}
        
        {/* Pillars Form (When in 4 Pillars of Strength tab) */}
        {activeTab === "pillars" && (
          <div className="space-y-4 p-4 rounded-2xl bg-blue-50/50 border border-blue-200/70">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">
                  Full Name &amp; Academic Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Shrikant Sonekar"
                  value={formMember.name}
                  onChange={(e) => setFormMember({ ...formMember, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">
                  Official Designation <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Principal, JDCOEM / Dean (IQAC) / Faculty Coordinator, SRC"
                  value={(formMember as any).designation || (formMember as any).level || ""}
                  onChange={(e) => setFormMember({ ...formMember, designation: e.target.value, level: e.target.value } as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-800">
                Department / Institutional Wing
              </label>
              <input
                type="text"
                placeholder="e.g. JDCOEM, Nagpur / Internal Quality Assurance Cell"
                value={formMember.department}
                onChange={(e) => setFormMember({ ...formMember, department: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-800">
                Guidance Creed / Vision Message (Displayed on Postcard)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Guiding student potential toward technical eminence, ethical innovation, and collaborative leadership."
                value={formMember.bio || ""}
                onChange={(e) => setFormMember({ ...formMember, bio: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>
          </div>
        )}

        {/* Club Multi-Selection & Custom Designation (When in Club Leadership tab) */}
        {activeTab === "clubs" && (
          <div className="space-y-4 p-4 rounded-2xl bg-[#17458F]/5 border border-[#17458F]/15">
            {/* 1. Multi-Club Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Assign Chartered Societies / Clubs (Select 1, 2, or 3+) <span className="text-rose-500">*</span></span>
                </label>
                <span className="text-[11px] font-bold text-[#17458F]">
                  {((formMember as any).clubIds || [(formMember as any).clubId].filter(Boolean)).length} Selected
                </span>
              </div>

              <p className="text-[11px] text-slate-500 font-medium">
                Select one or multiple clubs if this leader is assigned joint leadership across societies (e.g. Dance + Music).
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 max-h-56 overflow-y-auto pr-1">
                {clubsList.map((club) => {
                  const currentSelectedIds: string[] = (formMember as any).clubIds || [(formMember as any).clubId].filter(Boolean);
                  const isSelected = currentSelectedIds.includes(club.id) || currentSelectedIds.includes(club.slug);

                  return (
                    <button
                      key={club.id || club.slug}
                      type="button"
                      onClick={() => {
                        let nextIds: string[];
                        if (isSelected) {
                          nextIds = currentSelectedIds.filter((id) => id !== club.id && id !== club.slug);
                        } else {
                          nextIds = [...currentSelectedIds, club.id];
                        }
                        const nextClubs = clubsList.filter((c) => nextIds.includes(c.id) || nextIds.includes(c.slug));
                        const nextNames = nextClubs.map((c) => c.name);
                        const nextSlugs = nextClubs.map((c) => c.slug);

                        setFormMember({
                          ...formMember,
                          clubId: nextIds[0] || "",
                          clubSlug: nextSlugs[0] || "",
                          clubName: nextNames[0] || "",
                          clubIds: nextIds,
                          clubSlugs: nextSlugs,
                          clubNames: nextNames,
                        } as any);
                      }}
                      className={`px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition-all border cursor-pointer ${
                        isSelected
                          ? "bg-[#17458F] text-white border-[#17458F] shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate pr-1">{club.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-amber-300" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Tier & Custom Designation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#17458F]/10">
              <div className="space-y-1.5 sm:col-span-1">
                <label className="font-bold text-slate-800 text-xs">
                  Leadership Tier <span className="text-rose-500">*</span>
                </label>
                <select
                  value={(formMember as any).roleType || "lead"}
                  onChange={(e) => {
                    const newRoleType = e.target.value as "lead" | "coLead";
                    setFormMember({
                      ...formMember,
                      roleType: newRoleType,
                    } as any);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
                >
                  <option value="lead">Head / Primary Lead</option>
                  <option value="coLead">Co-Head / Deputy Lead</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs">
                    Appropriate Designation Title <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const currentIds: string[] = (formMember as any).clubIds || [(formMember as any).clubId].filter(Boolean);
                      const matched = clubsList.filter((c) => currentIds.includes(c.id) || currentIds.includes(c.slug));
                      const roleType = (formMember as any).roleType || "lead";
                      const suffix = roleType === "coLead" ? "Co-Head" : "Head";
                      let suggested = "";
                      if (matched.length === 0) {
                        suggested = `Club ${suffix}`;
                      } else if (matched.length === 1) {
                        suggested = `${matched[0].name} ${suffix}`;
                      } else if (matched.length === 2) {
                        suggested = `${suffix} • ${matched[0].name} & ${matched[1].name}`;
                      } else {
                        suggested = `Joint ${suffix} • ${matched.map((c) => c.name).join(", ")}`;
                      }
                      setFormMember({
                        ...formMember,
                        role: suggested,
                      });
                    }}
                    className="text-[10px] font-bold text-[#17458F] hover:text-[#E78023] underline cursor-pointer"
                  >
                    Auto-Suggest
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Head • Dance Club & Music Society or Cultural Societies Head..."
                  value={formMember.role || ""}
                  onChange={(e) => setFormMember({ ...formMember, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Position Title & Member Name (When in Council, Hosting, Founding) */}
        {activeTab !== "clubs" && activeTab !== "pillars" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">
                Position / Role Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. President, Vice President, Head of Tech..."
                value={formMember.role}
                onChange={(e) => setFormMember({ ...formMember, role: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">
                Student Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Aryan Sharma"
                value={formMember.name}
                onChange={(e) => setFormMember({ ...formMember, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
              />
            </div>
          </div>
        )}

        {activeTab === "clubs" && (
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">
              Student Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Aryan Sharma"
              value={formMember.name}
              onChange={(e) => setFormMember({ ...formMember, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
            />
          </div>
        )}

        {/* Hierarchy Rank (Only for Council & Admins) */}
        {activeTab !== "clubs" && activeTab !== "pillars" && (
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 flex items-center justify-between">
              <span>Hierarchy Priority / Rank #</span>
              <span className="text-[10px] text-slate-400">1 = Highest (Top of Roster Page)</span>
            </label>
            <input
              type="number"
              min="1"
              max={currentMembersCount + (isCreatingNew ? 1 : 0)}
              value={formMember.order || 1}
              onChange={(e) => setFormMember({ ...formMember, order: parseInt(e.target.value) || 1 })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-[#17458F] focus:outline-none focus:border-[#17458F]"
            />
          </div>
        )}

        {/* Department & Year (For students / club heads) */}
        {activeTab !== "pillars" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Department / Branch</label>
                <input
                  type="text"
                  list="team-depts-list"
                  placeholder="e.g. Computer Science & Engineering"
                  value={formMember.department}
                  onChange={(e) => setFormMember({ ...formMember, department: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
                <datalist id="team-depts-list">
                  {departmentsList.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Academic Year / Level</label>
                <input
                  type="text"
                  placeholder="e.g. 4th Year / Final Year"
                  value={formMember.year}
                  onChange={(e) => setFormMember({ ...formMember, year: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            {/* College BT ID for Badge Linkage */}
            <div className="space-y-1.5 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>College BT ID (For Account Badge Linkage)</span>
                </label>
                <span className="text-[10px] text-[#E78023] font-bold uppercase">Automated Badge Sync</span>
              </div>
              <input
                type="text"
                placeholder="e.g. BT22CSE045"
                value={formMember.btId || ""}
                onChange={(e) => setFormMember({ ...formMember, btId: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-amber-300 text-xs font-mono font-bold text-[#E78023] uppercase tracking-wider focus:outline-none focus:border-[#17458F]"
              />
              <p className="text-[10px] text-slate-500">
                When the student logs in with Google and enters this BT ID, their student pass and profile will automatically receive official council designation badging.
              </p>
            </div>
          </>
        )}

        {/* Email & LinkedIn */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Official College Email</label>
            <input
              type="email"
              placeholder={activeTab === "pillars" ? "e.g. principal@jdcoem.ac.in" : "e.g. student@jdcoem.ac.in"}
              value={formMember.email || ""}
              onChange={(e) => setFormMember({ ...formMember, email: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">LinkedIn Profile URL</label>
            <input
              type="text"
              placeholder="https://linkedin.com/in/..."
              value={formMember.linkedin || ""}
              onChange={(e) => setFormMember({ ...formMember, linkedin: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
            />
          </div>
        </div>

        {/* Portrait Card Photo Upload / URL */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="font-bold text-slate-700">
            {activeTab === "pillars"
              ? "Pillar Postcard Portrait Photo (4:5 Card Frame)"
              : activeTab === "clubs"
              ? "Club Head / Co-Head Portrait Photo (4:5 Card Frame)"
              : "Officer Portrait Photo (4:5 Card Frame)"}
          </label>
          
          <UniversalImageUploader
            purpose="avatar"
            label={
              activeTab === "pillars"
                ? "Postcard Portrait Photo"
                : activeTab === "clubs"
                ? "Club Head / Co-Head Portrait Photo"
                : "Officer Portrait Photo"
            }
            sublabel="Frame headshot to match actual team card portrait frame (4:5)"
            recommendedSize="800 x 1000 px (4:5 Card Frame)"
            storagePath={activeTab === "pillars" ? "pillars/portraits" : activeTab === "clubs" ? "clubs/leads" : "team/members"}
            previewUrl={formMember.avatar}
            onUploadStateChange={onUploadStateChange}
            onUrlChange={(url) => {
              setFormMember((prev) => prev ? { ...prev, avatar: url } : null);
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div>
            {!isCreatingNew && activeTab !== "pillars" && onDelete && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (formMember) {
                    onDelete(formMember.id, formMember.name);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Position</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={pendingUploads > 0 || isSubmitting}
              className="gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Saving to Cloud...</span>
                </>
              ) : pendingUploads > 0 ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Uploading Image...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isCreatingNew ? "Create Position" : "Save Changes"}</span>
                </>
              )}
            </Button>
          </div>
        </div>

      </form>
    </Modal>
  );
}
