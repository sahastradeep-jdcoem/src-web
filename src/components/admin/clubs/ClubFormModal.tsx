"use client";

import React, { useState, useEffect } from "react";
import { 
  Layers, 
  Sparkles, 
  Eye, 
  Save, 
  Loader2,
  AlertCircle 
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";
import { ClubItem } from "@/types";
import { cn } from "@/lib/utils";

interface ClubFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClub: ClubItem | null;
  isCreatingNew: boolean;
  pendingUploads: number;
  onUploadStateChange: (uploading: boolean) => void;
  onSave: (club: ClubItem) => void | Promise<void>;
}

export function ClubFormModal({
  isOpen,
  onClose,
  initialClub,
  isCreatingNew,
  pendingUploads,
  onUploadStateChange,
  onSave,
}: ClubFormModalProps) {
  const [formClub, setFormClub] = useState<ClubItem | null>(initialClub);
  const [modalTab, setModalTab] = useState<"identity" | "about" | "media">("identity");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormClub(initialClub);
    setModalTab("identity");
    setFormError(null);
  }, [initialClub]);

  if (!isOpen || !formClub) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formClub && !isSubmitting) {
      try {
        setIsSubmitting(true);
        setFormError(null);
        await onSave(formClub);
      } catch (err: any) {
        setFormError(err?.message || "Failed to save club to cloud database. Please verify connection and try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreatingNew ? "Charter New Student Club" : `Edit: ${formClub.name || "Club"}`}
      subtitle="Configure club identity, domain category, description, and visual assets."
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full text-xs text-slate-900">
        
        {formError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 mb-4 shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium leading-relaxed">{formError}</span>
          </div>
        )}

        {/* Modal Tabs Header */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200 mb-5 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setModalTab("identity")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              modalTab === "identity" 
                ? "bg-white text-[#17458F] shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Identity &amp; Domain</span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab("about")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              modalTab === "about" 
                ? "bg-white text-[#17458F] shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>2. About &amp; Mission</span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab("media")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
              modalTab === "media" 
                ? "bg-white text-[#17458F] shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>3. Banner &amp; Media</span>
          </button>
        </div>

        {/* Tab 1: Identity & Domain */}
        {modalTab === "identity" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 text-xs">
                  Club Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI & Robotics Society, Dance Club, Music Society..."
                  value={formClub.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormClub((prev) => (prev ? { ...prev, name: val } : null));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F] shadow-xs"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs">
                    Domain Category <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Pick a preset or enter custom</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Cultural",
                    "Technical",
                    "Creative & Media",
                    "Sports",
                    "Literary",
                    "Social & Environment",
                    "Innovation & Startups"
                  ].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormClub((prev) => (prev ? { ...prev, category: cat } : null))}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                        formClub.category === cat
                          ? "bg-[#17458F] text-white shadow-xs font-bold"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  required
                  placeholder="Or type custom domain..."
                  value={formClub.category}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormClub((prev) => (prev ? { ...prev, category: val } : null));
                  }}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 text-xs">Club Tagline / Official Motto</label>
                <input
                  type="text"
                  placeholder="e.g. Rhythm in Motion, Passion on Stage"
                  value={formClub.tagline}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormClub((prev) => (prev ? { ...prev, tagline: val } : null));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 text-xs">Active Registered Members</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 50"
                    value={formClub.memberCount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormClub((prev) => (prev ? { ...prev, memberCount: val } : null));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 text-xs">Chartered / Est. Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2024"
                    value={formClub.established || "2024"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormClub((prev) => (prev ? { ...prev, established: val } : null));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: About & Mission */}
        {modalTab === "about" && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-2">
              <label className="font-bold text-slate-800 text-xs flex items-center justify-between">
                <span>About Description</span>
                <span className="text-[10px] text-slate-400 font-normal">Displayed on public club directory</span>
              </label>
              <textarea
                rows={4}
                placeholder="Describe the club's origin, activities, audition process, and regular collegiate engagements..."
                value={formClub.description}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormClub((prev) => (prev ? { ...prev, description: val } : null));
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F] resize-none leading-relaxed"
              />
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-2">
              <label className="font-bold text-slate-800 text-xs flex items-center justify-between">
                <span>Official Mission Statement</span>
                <span className="text-[10px] text-slate-400 font-normal">Displayed on club charter page</span>
              </label>
              <textarea
                rows={4}
                placeholder="Enter the official mission, values, and student growth aspirations for this charter..."
                value={formClub.mission}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormClub((prev) => (prev ? { ...prev, mission: val } : null));
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F] resize-none leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* Tab 3: Multi-Size Visual Assets & Media */}
        {modalTab === "media" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider text-[#17458F]">
                Club Visual Asset Suite (Multi-Size Imagery)
              </h4>
              <p className="text-[11px] text-slate-500 font-sans">
                Upload dedicated photos tailored for club directory cards, detail page banners, and circular insignia badges.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Directory Card (16:9) */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                <ImageUploadDropzone
                  label="1. Directory Card"
                  sublabel="For /clubs directory grid (16:9)"
                  aspectRatio="16:9"
                  allowedAspectRatios={["16:9", "4:5", "3:4", "1:1", "21:9", "free"]}
                  lockAspectRatio={false}
                  recommendedSize="1200 x 675 px (16:9)"
                  storagePath="clubs/cards"
                  previewUrl={formClub.cardImage}
                  onUploadStateChange={onUploadStateChange}
                  onUrlChange={(url) => {
                    setFormClub((prev) => (prev ? { ...prev, cardImage: url } : null));
                  }}
                />
              </div>

              {/* 2. Hero Header Banner (21:9) */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                <ImageUploadDropzone
                  label="2. Header Banner"
                  sublabel="Cinematic backdrop on /clubs/[slug]"
                  aspectRatio="21:9"
                  allowedAspectRatios={["21:9", "16:9", "free"]}
                  lockAspectRatio={false}
                  recommendedSize="1920 x 820 px (21:9)"
                  storagePath="clubs/headers"
                  previewUrl={formClub.headerImage}
                  onUploadStateChange={onUploadStateChange}
                  onUrlChange={(url) => {
                    setFormClub((prev) => (prev ? { ...prev, headerImage: url } : null));
                  }}
                />
              </div>

              {/* 3. Official Logo / Insignia (1:1) */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                <ImageUploadDropzone
                  label="3. Official Club Logo"
                  sublabel="Circular insignia emblem (1:1)"
                  aspectRatio="1:1"
                  allowedAspectRatios={["1:1", "free"]}
                  lockAspectRatio={false}
                  isAvatar={true}
                  recommendedSize="500 x 500 px (Circle PNG)"
                  storagePath="clubs/logos"
                  previewUrl={formClub.logoImage}
                  onUploadStateChange={onUploadStateChange}
                  onUrlChange={(url) => {
                    setFormClub((prev) => (prev ? { ...prev, logoImage: url } : null));
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between pt-5 mt-6 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            {modalTab !== "identity" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (modalTab === "media") setModalTab("about");
                  else if (modalTab === "about") setModalTab("identity");
                }}
              >
                &larr; Back
              </Button>
            )}
            {modalTab !== "media" && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (modalTab === "identity") setModalTab("about");
                  else if (modalTab === "about") setModalTab("media");
                }}
              >
                Next &rarr;
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
              className="gap-2 cursor-pointer shadow-md shadow-[#E78023]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving to Cloud...</span>
                </>
              ) : pendingUploads > 0 ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Uploading ({pendingUploads})...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isCreatingNew ? "Charter Club" : "Save Changes"}</span>
                </>
              )}
            </Button>
          </div>
        </div>

      </form>
    </Modal>
  );
}
