"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  ClipboardList, 
  FileText, 
  ImageIcon, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Loader2, 
  Calendar, 
  Users, 
  Power, 
  Sliders, 
  ShieldCheck, 
  Target, 
  Building2, 
  CheckCircle2, 
  AlertCircle
} from "lucide-react";
import { SrcDispatch, SrcDispatchPriority, SrcDispatchTarget } from "@/types/srcDispatch";
import { SrcFormsBuilder } from "@/components/admin/forms/SrcFormsBuilder";
import { UniversalImageUploader } from "@/components/ui/UniversalImageUploader";
import { SrcFormField } from "@/types";
import { saveStoredSrcDispatches, getStoredSrcDispatches } from "@/lib/srcDispatchesStore";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export interface CreateSrcFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (dispatch: SrcDispatch) => void;
  mode?: "create" | "edit";
  initialData?: SrcDispatch | null;
  savedMembers?: Array<{ btId: string; name: string; designation: string }>;
}

export type SrcFormSection = "details" | "visuals" | "qa";

interface SrcFormSectionDef {
  id: SrcFormSection;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
}

const SECTIONS: SrcFormSectionDef[] = [
  {
    id: "details",
    label: "Form Details",
    shortLabel: "Details",
    icon: FileText,
    description: "Form title, instructions, council priority, target members, and response settings.",
  },
  {
    id: "visuals",
    label: "Visual Asset",
    shortLabel: "Visuals",
    icon: ImageIcon,
    description: "Cover banner, visual backdrop, or header graphic.",
  },
  {
    id: "qa",
    label: "SRC Forms Builder",
    shortLabel: "Questions",
    icon: ClipboardList,
    description: "Custom question builder, multiple-choice options, and intake parameters with SRC Forms.",
  },
];

const PRESET_COVERS = [
  {
    title: "Council Operations",
    url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop",
    category: "Council",
  },
  {
    title: "Campus Life",
    url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
    category: "Campus",
  },
  {
    title: "Technical Operations",
    url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop",
    category: "Technical",
  },
  {
    title: "Campus Voting",
    url: "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?q=80&w=1200&auto=format&fit=crop",
    category: "Governance",
  },
  {
    title: "Creative Arts",
    url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1200&auto=format&fit=crop",
    category: "Creative",
  },
];

export function CreateSrcFormModal({
  isOpen,
  onClose,
  onSuccess,
  mode = "create",
  initialData = null,
  savedMembers = [],
}: CreateSrcFormModalProps) {
  const { user } = useAuth();

  // Navigation State
  const [activeSection, setActiveSection] = useState<SrcFormSection>("details");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Field State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [badgeText, setBadgeText] = useState("SRC Forms");
  const [priority, setPriority] = useState<SrcDispatchPriority>("normal");
  const [targetType, setTargetType] = useState<SrcDispatchTarget>("all_members");
  const [targetBtId, setTargetBtId] = useState("");
  const [targetMemberName, setTargetMemberName] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [coverImage, setCoverImage] = useState("");

  // Response Controls
  const [isAcceptingResponses, setIsAcceptingResponses] = useState(true);
  const [allowResponseEditing, setAllowResponseEditing] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(true);

  // Dynamic Custom Questions
  const [formFields, setFormFields] = useState<SrcFormField[]>([]);

  // Initialize or reset form state
  useEffect(() => {
    if (initialData && mode === "edit") {
      setTitle(initialData.title || "");
      setContent(initialData.content || "");
      setBadgeText(initialData.badgeText || "SRC Forms");
      setPriority(initialData.priority || "normal");
      setTargetType(initialData.targetType || "all_members");
      setTargetBtId(initialData.targetBtId || "");
      setTargetMemberName(initialData.targetMemberName || "");
      setAuthorName(initialData.authorName || user?.displayName || "SRC Admin");
      setAuthorRole(initialData.authorRole || (user as any)?.designationBadge || "Council Administrator");
      setFormDeadline(initialData.formDeadline || "");
      setCoverImage(initialData.coverImage || "");
      setIsAcceptingResponses(initialData.isAcceptingResponses !== false);
      setAllowResponseEditing(initialData.allowResponseEditing !== false);
      setRequiresApproval(initialData.requiresApproval !== false);
      setFormFields(initialData.formFields ? JSON.parse(JSON.stringify(initialData.formFields)) : []);
      setActiveSection("details");
      setFormError(null);
    } else if (isOpen && mode === "create") {
      setTitle("");
      setContent("");
      setBadgeText("SRC Forms");
      setPriority("normal");
      setTargetType("all_members");
      setTargetBtId("");
      setTargetMemberName("");
      setAuthorName(user?.displayName || "SRC Admin");
      setAuthorRole((user as any)?.designationBadge || "Council Administrator");
      setFormDeadline("");
      setCoverImage("");
      setIsAcceptingResponses(true);
      setAllowResponseEditing(true);
      setRequiresApproval(true);
      setFormFields([
        {
          id: `q-${Date.now()}-1`,
          type: "short_text",
          question: "Full Name & Official Designation",
          placeholder: "e.g. Rahul Sharma, Logistics Head",
          required: true,
        },
        {
          id: `q-${Date.now()}-2`,
          type: "short_text",
          question: "College BT ID",
          placeholder: "e.g. BT230012CS",
          required: true,
        },
      ]);
      setActiveSection("details");
      setFormError(null);
    }
  }, [isOpen, initialData, mode, user]);

  if (!isOpen) return null;

  // Handle Council Member selection
  const handleSelectMember = (btId: string) => {
    setTargetBtId(btId);
    const matched = savedMembers.find((m) => m.btId.toLowerCase() === btId.toLowerCase().trim());
    if (matched) {
      setTargetMemberName(matched.name);
    } else {
      setTargetMemberName("");
    }
  };

  // Stepper navigation logic
  const currentSectionIndex = SECTIONS.findIndex((s) => s.id === activeSection);
  const prevSection = currentSectionIndex > 0 ? SECTIONS[currentSectionIndex - 1] : null;
  const nextSection = currentSectionIndex < SECTIONS.length - 1 ? SECTIONS[currentSectionIndex + 1] : null;

  const handleSectionNav = (direction: "prev" | "next") => {
    if (direction === "next") {
      if (activeSection === "details") {
        if (!title.trim()) {
          setFormError("Please enter a form title to proceed.");
          return;
        }
        if (!content.trim()) {
          setFormError("Please enter instructions or a message for this form.");
          return;
        }
        if (targetType === "single_member" && !targetBtId.trim()) {
          setFormError("Please select or enter a valid College BT ID for the targeted member.");
          return;
        }
      }
      setFormError(null);
      if (nextSection) setActiveSection(nextSection.id);
    } else if (direction === "prev") {
      setFormError(null);
      if (prevSection) setActiveSection(prevSection.id);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (pendingUploads > 0) {
      setFormError("Please wait for images to finish uploading before saving.");
      return;
    }

    if (!title.trim()) {
      setFormError("Form title is required.");
      setActiveSection("details");
      return;
    }

    if (!content.trim()) {
      setFormError("Message content / instructions are required.");
      setActiveSection("details");
      return;
    }

    if (targetType === "single_member" && !targetBtId.trim()) {
      setFormError("Please enter or select a target College BT ID.");
      setActiveSection("details");
      return;
    }

    if (formFields.length === 0) {
      setFormError("Please add at least one question in the SRC Forms Builder.");
      setActiveSection("qa");
      return;
    }

    setIsSubmitting(true);

    try {
      const allDispatches = getStoredSrcDispatches();

      if (mode === "edit" && initialData) {
        const updatedDispatch: SrcDispatch = {
          ...initialData,
          title: title.trim(),
          category: "form",
          priority,
          targetType,
          targetBtId: targetType === "single_member" ? targetBtId.trim().toUpperCase() : undefined,
          targetMemberName: targetType === "single_member" ? targetMemberName || undefined : undefined,
          content: content.trim(),
          badgeText: badgeText.trim() || "SRC Forms",
          formFields,
          formDeadline: formDeadline || undefined,
          allowResponseEditing,
          requiresApproval,
          isAcceptingResponses,
          coverImage: coverImage.trim() || undefined,
          authorName: authorName.trim() || "SRC Admin",
          authorRole: authorRole.trim() || "Council Administrator",
        };

        const updated = allDispatches.map((d) => (d.id === initialData.id ? updatedDispatch : d));
        await saveStoredSrcDispatches(updated);
        onSuccess?.(updatedDispatch);
      } else {
        const newDispatch: SrcDispatch = {
          id: `dispatch-form-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: title.trim(),
          category: "form",
          priority,
          targetType,
          targetBtId: targetType === "single_member" ? targetBtId.trim().toUpperCase() : undefined,
          targetMemberName: targetType === "single_member" ? targetMemberName || undefined : undefined,
          content: content.trim(),
          badgeText: badgeText.trim() || "SRC Forms",
          createdAt: new Date().toISOString(),
          formFields,
          formDeadline: formDeadline || undefined,
          allowResponseEditing,
          requiresApproval,
          isAcceptingResponses,
          coverImage: coverImage.trim() || undefined,
          authorName: authorName.trim() || "SRC Admin",
          authorRole: authorRole.trim() || "Council Administrator",
          status: "active",
        };

        const updated = [newDispatch, ...allDispatches];
        await saveStoredSrcDispatches(updated);
        onSuccess?.(newDispatch);
      }

      onClose();
    } catch (err: any) {
      console.error("Failed to save SRC form dispatch:", err);
      setFormError(err?.message || "Failed to save form. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[92vh] sm:h-[88vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 text-left">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-4 sm:px-6 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-extrabold text-base sm:text-lg tracking-tight uppercase">
                  {mode === "edit" ? "EDIT SRC FORM" : "CREATE NEW SRC FORM"}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                  SRC Operations
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans hidden sm:block">
                Design custom council questionnaires, member intakes, and operational surveys.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* STEPPER / FORM CONTENT CONTAINER */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 text-left">
          
          {/* Top Navigation & Segmented Tabs Strip */}
          <div className="p-4 sm:px-6 bg-slate-50/90 border-b border-slate-200 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                {mode === "edit" ? "Editing Mode" : "Creation Studio"} (Council Form)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  SRC Forms Desk
                </span>
                <span className="text-xs font-bold text-[#E78023] uppercase tracking-wider hidden sm:inline">
                  {mode === "edit" ? "Direct Cloud Update" : "Publishing to Council Desk"}
                </span>
              </div>
            </div>

            {/* Segmented Section Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.id;
                
                // Compute dynamic micro badge
                let badge = "";
                if (sec.id === "details") {
                  badge = title.trim() ? "Ready" : "Required";
                } else if (sec.id === "visuals") {
                  badge = coverImage ? "Cover Set" : "Default";
                } else if (sec.id === "qa") {
                  badge = formFields.length > 0 ? `${formFields.length} Qs` : "0 Qs";
                }

                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(sec.id);
                      setFormError(null);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border select-none",
                      isActive
                        ? "bg-[#17458F] text-white border-[#17458F] shadow-sm shadow-blue-900/20"
                        : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200/90 hover:text-slate-900"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", isActive ? "text-[#E78023]" : "text-slate-400")} />
                    <span>{sec.label}</span>
                    {badge && (
                      <span
                        className={cn(
                          "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md leading-none",
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Section Description Bar */}
            <div className="flex items-center justify-between text-slate-500 text-[11px] pt-0.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E78023]" />
                {SECTIONS[currentSectionIndex]?.description}
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                Section {currentSectionIndex + 1} of {SECTIONS.length}
              </span>
            </div>
          </div>

          {/* Validation Alert */}
          {formError && (
            <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* SCROLLABLE FORM BODY */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

            {/* ========================================================= */}
            {/* 1. DETAILS SECTION                                        */}
            {/* ========================================================= */}
            {activeSection === "details" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                
                {/* Form Title & Tag */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#17458F]" />
                      <span>Form Title / Headline *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      placeholder="e.g. Council Operations Logistics & Committee Preference Intake"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>Badge / Tag</span>
                    </label>
                    <input
                      type="text"
                      value={badgeText}
                      onChange={(e) => setBadgeText(e.target.value)}
                      placeholder="e.g. SRC Forms, Urgent Intake"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Priority & Deadline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span>Priority Level</span>
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as SrcDispatchPriority)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-[#17458F] focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="normal">Normal (Routine Council Form)</option>
                      <option value="important">Important (High Priority Intake)</option>
                      <option value="urgent">Urgent (Immediate Submission Required)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#E78023]" />
                      <span>Submission Deadline (Optional)</span>
                    </label>
                    <input
                      type="date"
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] focus:bg-white transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {/* Target Audience & Member Routing */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#17458F]" />
                        <span>Target Audience &amp; Member Routing</span>
                      </label>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Specify whether all council members receive this form or if it targets a single member.
                      </p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all",
                      targetType === "all_members"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    )}>
                      {targetType === "all_members" ? "📢 All SRC Members" : "🎯 Single Member (BT ID)"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTargetType("all_members")}
                      className={cn(
                        "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        targetType === "all_members"
                          ? "bg-white text-[#17458F] shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>All SRC Members (Broadcast)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType("single_member")}
                      className={cn(
                        "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        targetType === "single_member"
                          ? "bg-white text-[#E78023] shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>Single Member (By BT ID)</span>
                    </button>
                  </div>

                  {targetType === "single_member" && (
                    <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-3 pt-3 animate-in fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 uppercase">
                            Choose from Registered SRC Roster:
                          </label>
                          <select
                            value={targetBtId}
                            onChange={(e) => handleSelectMember(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs text-slate-800 bg-white focus:outline-none"
                          >
                            <option value="">-- Choose Council Member --</option>
                            {savedMembers.map((m) => (
                              <option key={m.btId} value={m.btId}>
                                {m.name} ({m.btId}) - {m.designation}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600 uppercase">
                            Or Enter BT ID Manually:
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. BT230036CS"
                            value={targetBtId}
                            onChange={(e) => handleSelectMember(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-mono font-bold uppercase text-slate-900 bg-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {targetBtId && (
                        <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs flex items-center justify-between">
                          <span className="font-semibold text-slate-700">Verified Recipient:</span>
                          <span className="font-bold text-[#17458F]">
                            {targetMemberName || targetBtId.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Instructions / Detailed Message */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>Message Content &amp; Instructions *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Displayed above questions</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Provide detailed instructions, background context, operational guidelines, or deadlines for this form intake..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs leading-relaxed focus:outline-none focus:border-[#17458F] focus:bg-white transition-all font-sans"
                  />
                </div>

                {/* Response Controls (3 Toggles) */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Form Response Controls
                  </h3>

                  {/* 1. Accepting Responses Switch */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-4 shadow-2xs">
                    <div className="space-y-0.5 pr-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <Power className="w-3.5 h-3.5 text-[#17458F]" />
                          <span>Accepting Responses</span>
                        </label>
                        <span className={cn(
                          "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border transition-all",
                          isAcceptingResponses
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        )}>
                          {isAcceptingResponses ? "Accepting Responses" : "Responses Closed"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium leading-normal">
                        Control whether council members can submit responses to this form. Turn off to stop accepting responses.
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isAcceptingResponses}
                      onClick={() => setIsAcceptingResponses(!isAcceptingResponses)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        isAcceptingResponses ? "bg-emerald-600" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                          isAcceptingResponses ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* 2. Allow Response Editing Switch */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-[#17458F]" />
                          <span>Allow Response Editing</span>
                        </label>
                        <span className={cn(
                          "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border transition-all",
                          allowResponseEditing
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                          {allowResponseEditing ? "Editing Permitted" : "Submissions Locked"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium leading-normal">
                        Allow members to revise and update their submitted response directly from their dashboard.
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowResponseEditing}
                      onClick={() => setAllowResponseEditing(!allowResponseEditing)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        allowResponseEditing ? "bg-[#17458F]" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                          allowResponseEditing ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* 3. Requires Review Switch */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Requires Council Review</span>
                        </label>
                        <span className={cn(
                          "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border transition-all",
                          requiresApproval
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                          {requiresApproval ? "Review Workflow Enabled" : "Auto Approved"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium leading-normal">
                        Route submitted responses through an administrative approval workflow with status badges (Approved, Pending, Rejected).
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={requiresApproval}
                      onClick={() => setRequiresApproval(!requiresApproval)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        requiresApproval ? "bg-emerald-600" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                          requiresApproval ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Author Signature */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Author Name</label>
                    <input
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Author Role / Council Designation</label>
                    <input
                      type="text"
                      value={authorRole}
                      onChange={(e) => setAuthorRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
                    />
                  </div>
                </div>

              </div>
            )}

            {/* ========================================================= */}
            {/* 2. VISUAL ASSET SECTION                                   */}
            {/* ========================================================= */}
            {activeSection === "visuals" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <UniversalImageUploader
                    purpose="cardCover"
                    label="Cover Banner (16:9)"
                    sublabel="Displayed on council updates feed, member dashboard, and response portal"
                    recommendedSize="1200 x 675 px (16:9)"
                    storagePath="dispatches/covers"
                    previewUrl={coverImage}
                    onUploadStateChange={(isUploading) => {
                      setPendingUploads((prev) => (isUploading ? prev + 1 : Math.max(0, prev - 1)));
                    }}
                    onUrlChange={(url) => {
                      setCoverImage(url);
                    }}
                  />
                </div>

                {/* Quick Preset Selector */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>Or Pick a Preset Cover</span>
                    <span className="text-[10px] text-slate-400 font-normal">Click to apply instantly</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {PRESET_COVERS.map((preset) => {
                      const isSelected = coverImage === preset.url;
                      return (
                        <button
                          key={preset.title}
                          type="button"
                          onClick={() => setCoverImage(preset.url)}
                          className={cn(
                            "group relative rounded-xl overflow-hidden border text-left transition-all cursor-pointer hover:shadow-md",
                            isSelected ? "ring-2 ring-[#17458F] border-transparent" : "border-slate-200"
                          )}
                        >
                          <div className="aspect-video w-full relative bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={preset.url}
                              alt={preset.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-[#17458F] text-white shadow-xs">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                          <div className="p-2 bg-white">
                            <p className="text-[11px] font-bold text-slate-900 truncate">
                              {preset.title}
                            </p>
                            <p className="text-[9px] text-slate-500 font-medium">
                              {preset.category}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* 3. SRC FORMS BUILDER SECTION                              */}
            {/* ========================================================= */}
            {activeSection === "qa" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <SrcFormsBuilder
                  fields={formFields}
                  onChange={(qs) => setFormFields(qs)}
                />
              </div>
            )}

          </div>

          {/* STICKY STEPPER FOOTER */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold uppercase tracking-wider hover:bg-slate-100 transition-colors cursor-pointer order-3 sm:order-1"
            >
              Cancel
            </button>

            {/* Stepper Navigation */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center order-2">
              {prevSection && (
                <button
                  type="button"
                  onClick={() => handleSectionNav("prev")}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{prevSection.shortLabel}</span>
                </button>
              )}

              {nextSection && (
                <button
                  type="button"
                  onClick={() => handleSectionNav("next")}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 hover:border-[#17458F] bg-white text-slate-700 hover:text-[#17458F] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <span>Next: {nextSection.shortLabel}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={isSubmitting || pendingUploads > 0}
              className={cn(
                "w-full sm:w-auto px-6 py-2.5 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer order-1 sm:order-3",
                isSubmitting || pendingUploads > 0
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-emerald-900/20"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Form...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{mode === "edit" ? "Update Form & Save" : "Save & Publish Form"}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
