"use client";

import React, { useMemo, useState, useCallback } from "react";
import { SrcFormField, SrcFormFieldType } from "@/types";
import { 
  Plus, 
  Trash2, 
  Copy, 
  MoveUp, 
  MoveDown, 
  AlignLeft, 
  AlignJustify, 
  CircleDot, 
  CheckSquare, 
  ChevronDownSquare, 
  ChevronDown,
  AlertCircle,
  Sparkles,
  Info,
  Layers,
  GitBranch,
  MessageCircle,
  ExternalLink,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  X,
} from "lucide-react";
import { 
  getFormSectionGroups, 
  getNextSectionTarget,
  validateSectionGraph,
  type FormSectionGroup,
  type SectionValidationIssue,
} from "@/lib/srcFormsHelper";
import { formatWhatsAppUrl } from "@/lib/srcFormsHelper";
import { cn } from "@/lib/utils";

export interface SrcFormsBuilderProps {
  fields?: SrcFormField[];
  initialFields?: SrcFormField[];
  questions?: SrcFormField[]; // Backward-compatibility alias
  onChange: (fields: SrcFormField[]) => void;
  // Legacy top-level WA props — kept for backward compat, silently ignored (use whatsapp_link field instead)
  whatsappGroupUrl?: string;
  onWhatsAppGroupUrlChange?: (url: string) => void;
  onWhatsappGroupUrlChange?: (url: string) => void;
  whatsappGroupName?: string;
  onWhatsAppGroupNameChange?: (name: string) => void;
  onWhatsappGroupNameChange?: (name: string) => void;
}

// ─── Preview State Machine ──────────────────────────────────────────────────

interface PreviewState {
  open: boolean;
  currentSectionId: string;
  answers: Record<string, any>;
  history: string[]; // stack of section IDs visited
  submitted: boolean;
}

const PREVIEW_INIT: PreviewState = {
  open: false,
  currentSectionId: "",
  answers: {},
  history: [],
  submitted: false,
};

// ─── Type Config ────────────────────────────────────────────────────────────

const QUESTION_TYPE_CONFIG: Record<SrcFormFieldType, { label: string; icon: any; placeholder: string; desc: string }> = {
  short_text: {
    label: "Short Answer",
    icon: AlignLeft,
    placeholder: "e.g. Full Name, GitHub Username, BT ID",
    desc: "Single-line plain text response",
  },
  long_text: {
    label: "Paragraph",
    icon: AlignJustify,
    placeholder: "e.g. Why would you like to join the SRC Core Team?",
    desc: "Multi-line detailed text area",
  },
  multiple_choice: {
    label: "Multiple Choice",
    icon: CircleDot,
    placeholder: "e.g. Choose your preferred committee",
    desc: "Single option selection with radio buttons",
  },
  checkboxes: {
    label: "Checkboxes",
    icon: CheckSquare,
    placeholder: "e.g. Which operational sessions can you attend?",
    desc: "Multi-option selection with checkboxes",
  },
  dropdown: {
    label: "Dropdown",
    icon: ChevronDown,
    placeholder: "e.g. Academic Department",
    desc: "Compact dropdown list selector",
  },
  note: {
    label: "Council Notice / Banner",
    icon: AlertCircle,
    placeholder: "e.g. Bring your own laptops and valid college ID cards",
    desc: "Highlighted instruction banner (No answer required)",
  },
  section: {
    label: "Section Header / Divider",
    icon: Layers,
    placeholder: "e.g. Technical Assessment / Domain Preferences",
    desc: "Splits form into multi-page sections with response-based branching",
  },
  whatsapp_link: {
    label: "WhatsApp Group Link",
    icon: MessageCircle,
    placeholder: "e.g. Join the Event WhatsApp Group",
    desc: "Displays a WhatsApp group join card at this position in the form",
  },
};

// ─── Main Component ─────────────────────────────────────────────────────────

export function SrcFormsBuilder({ 
  fields, 
  initialFields, 
  questions, 
  onChange,
}: SrcFormsBuilderProps) {
  const activeFields: SrcFormField[] = fields ?? initialFields ?? questions ?? [];

  const [preview, setPreview] = useState<PreviewState>(PREVIEW_INIT);
  const [showValidation, setShowValidation] = useState(false);

  // Compute live section layout
  const sectionGroups = useMemo(() => getFormSectionGroups(activeFields), [activeFields]);
  const validationIssues = useMemo(() => validateSectionGraph(activeFields), [activeFields]);

  // ── CRUD helpers ────────────────────────────────────────────────────────

  const addField = (type: SrcFormFieldType = "short_text") => {
    const isSection = type === "section";
    const isWhatsapp = type === "whatsapp_link";
    const nextSecNum = sectionGroups.length + 1;

    const newField: SrcFormField = {
      id: isSection
        ? `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        : `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      question: isSection
        ? `Section ${nextSecNum}: Domain Assessment`
        : isWhatsapp
        ? "Join Our WhatsApp Group"
        : type === "note"
        ? "Important Instructions & Guidelines"
        : "",
      description: "",
      placeholder: "",
      required: type !== "note" && !isSection && !isWhatsapp,
      options: ["multiple_choice", "checkboxes", "dropdown"].includes(type)
        ? ["Option 1", "Option 2"]
        : undefined,
      noteContent: type === "note" ? "Please review the requirements carefully before attending." : undefined,
      afterSection: isSection ? "next" : undefined,
      waGroupUrl: isWhatsapp ? "" : undefined,
      waGroupName: isWhatsapp ? "" : undefined,
    };
    onChange([...activeFields, newField]);
  };

  const updateField = (id: string, updates: Partial<SrcFormField>) => {
    const updated = activeFields.map((f) => {
      if (f.id !== id) return f;
      const merged = { ...f, ...updates };

      // Initialize default options if switching to option-based type
      if (
        updates.type &&
        ["multiple_choice", "checkboxes", "dropdown"].includes(updates.type) &&
        (!merged.options || merged.options.length === 0)
      ) {
        merged.options = ["Option 1", "Option 2"];
      }

      // Clear goToSection if type changes away from branching-eligible
      if (
        updates.type &&
        !["multiple_choice", "checkboxes", "dropdown"].includes(updates.type)
      ) {
        merged.goToSection = undefined;
      }

      return merged;
    });
    onChange(updated);
  };

  const deleteField = (id: string) => {
    // When deleting a section, clean up any goToSection refs pointing to it
    const updated = activeFields
      .filter((f) => f.id !== id)
      .map((f) => {
        if (!f.goToSection) return f;
        const cleaned = { ...f.goToSection };
        Object.keys(cleaned).forEach((opt) => {
          if (cleaned[opt] === id) cleaned[opt] = "next";
        });
        return { ...f, goToSection: cleaned };
      })
      .map((f) => {
        if (f.afterSection === id) return { ...f, afterSection: "next" as const };
        return f;
      });
    onChange(updated);
  };

  const duplicateField = (id: string) => {
    const targetIndex = activeFields.findIndex((f) => f.id === id);
    if (targetIndex === -1) return;
    const target = activeFields[targetIndex];
    const clone: SrcFormField = {
      ...target,
      id: `${target.type === "section" ? "sec" : "q"}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      question: `${target.question || "Untitled Field"} (Copy)`,
      options: target.options ? [...target.options] : undefined,
      goToSection: target.goToSection ? { ...target.goToSection } : undefined,
    };
    const updatedList = [...activeFields];
    updatedList.splice(targetIndex + 1, 0, clone);
    onChange(updatedList);
  };

  const duplicateSection = (sectionField: SrcFormField) => {
    // Find the section field and all fields that belong to it
    const sectionIdx = activeFields.findIndex((f) => f.id === sectionField.id);
    if (sectionIdx === -1) return;

    // Collect fields until the next section divider
    const sectionFields: SrcFormField[] = [sectionField];
    for (let i = sectionIdx + 1; i < activeFields.length; i++) {
      if (activeFields[i].type === "section") break;
      sectionFields.push(activeFields[i]);
    }

    const idMap: Record<string, string> = {};
    const clonedFields = sectionFields.map((f) => {
      const newId = `${f.type === "section" ? "sec" : "q"}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      idMap[f.id] = newId;
      return {
        ...f,
        id: newId,
        question: f.type === "section" ? `${f.question || "Section"} (Copy)` : f.question,
        options: f.options ? [...f.options] : undefined,
        goToSection: f.goToSection ? { ...f.goToSection } : undefined,
      };
    });

    const updatedList = [...activeFields];
    updatedList.splice(sectionIdx + sectionFields.length, 0, ...clonedFields);
    onChange(updatedList);
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeFields.length) return;
    const updated = [...activeFields];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    onChange(updated);
  };

  const moveSection = (sectionFieldId: string, direction: "up" | "down") => {
    // Break activeFields into contiguous section chunks (header + questions)
    const chunks: SrcFormField[][] = [];
    let currentChunk: SrcFormField[] = [];

    for (const f of activeFields) {
      if (f.type === "section") {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }
        currentChunk = [f];
      } else {
        currentChunk.push(f);
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    const chunkIdx = chunks.findIndex((c) => c[0]?.id === sectionFieldId);
    if (chunkIdx === -1) return;

    const targetIdx = direction === "up" ? chunkIdx - 1 : chunkIdx + 1;
    if (targetIdx < 0 || targetIdx >= chunks.length) return;

    const updatedChunks = [...chunks];
    const temp = updatedChunks[chunkIdx];
    updatedChunks[chunkIdx] = updatedChunks[targetIdx];
    updatedChunks[targetIdx] = temp;

    onChange(updatedChunks.flat());
  };

  const moveFieldToSection = (fieldId: string, targetSectionId: string) => {
    const fieldIndex = activeFields.findIndex((f) => f.id === fieldId);
    if (fieldIndex === -1) return;
    const field = activeFields[fieldIndex];

    const remaining = activeFields.filter((f) => f.id !== fieldId);
    const secIndex = remaining.findIndex((f) => f.id === targetSectionId);
    if (secIndex === -1) {
      onChange([field, ...remaining]);
      return;
    }

    let insertAt = remaining.length;
    for (let i = secIndex + 1; i < remaining.length; i++) {
      if (remaining[i].type === "section") {
        insertAt = i;
        break;
      }
    }

    const updated = [...remaining];
    updated.splice(insertAt, 0, field);
    onChange(updated);
  };

  const getFieldSection = useCallback(
    (fieldId: string) => {
      for (const sec of sectionGroups) {
        if (sec.fields.some((f) => f.id === fieldId)) {
          return sec;
        }
      }
      return null;
    },
    [sectionGroups]
  );

  const addOption = (fieldId: string) => {
    const updated = activeFields.map((f) => {
      if (f.id !== fieldId) return f;
      const currentOpts = f.options || [];
      return { ...f, options: [...currentOpts, `Option ${currentOpts.length + 1}`] };
    });
    onChange(updated);
  };

  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    const updated = activeFields.map((f) => {
      if (f.id !== fieldId) return f;
      const oldVal = (f.options || [])[optionIndex];
      const opts = [...(f.options || [])];
      opts[optionIndex] = value;

      // Migrate goToSection key if the option label changed
      let newGoTo = f.goToSection ? { ...f.goToSection } : undefined;
      if (newGoTo && oldVal && newGoTo[oldVal] !== undefined) {
        newGoTo[value] = newGoTo[oldVal];
        delete newGoTo[oldVal];
      }

      return { ...f, options: opts, goToSection: newGoTo };
    });
    onChange(updated);
  };

  const removeOption = (fieldId: string, optionIndex: number) => {
    const updated = activeFields.map((f) => {
      if (f.id !== fieldId) return f;
      const removedVal = (f.options || [])[optionIndex];
      const opts = (f.options || []).filter((_, idx) => idx !== optionIndex);

      let newGoTo = f.goToSection ? { ...f.goToSection } : undefined;
      if (newGoTo && removedVal) delete newGoTo[removedVal];

      return { ...f, options: opts, goToSection: newGoTo };
    });
    onChange(updated);
  };

  const toggleOptionBranching = (field: SrcFormField) => {
    if (field.goToSection && Object.keys(field.goToSection).length > 0) {
      updateField(field.id, { goToSection: undefined });
    } else {
      const defaultRouting: Record<string, string> = {};
      (field.options || []).forEach((opt) => { defaultRouting[opt] = "next"; });
      updateField(field.id, { goToSection: defaultRouting });
    }
  };

  // ── Preview helpers ─────────────────────────────────────────────────────

  const startPreview = () => {
    if (sectionGroups.length === 0) return;
    setPreview({
      open: true,
      currentSectionId: sectionGroups[0].id,
      answers: {},
      history: [],
      submitted: false,
    });
  };

  const previewNext = () => {
    const section = sectionGroups.find((s) => s.id === preview.currentSectionId);
    if (!section) return;
    const next = getNextSectionTarget(section, sectionGroups, preview.answers);
    if (next === "submit") {
      setPreview((p) => ({ ...p, submitted: true }));
    } else {
      setPreview((p) => ({
        ...p,
        history: [...p.history, p.currentSectionId],
        currentSectionId: next,
      }));
    }
  };

  const previewBack = () => {
    if (preview.history.length === 0) return;
    const prev = preview.history[preview.history.length - 1];
    setPreview((p) => ({
      ...p,
      history: p.history.slice(0, -1),
      currentSectionId: prev,
    }));
  };

  const previewSetAnswer = (fieldId: string, value: any) => {
    setPreview((p) => ({ ...p, answers: { ...p.answers, [fieldId]: value } }));
  };

  const previewReset = () => {
    if (sectionGroups.length === 0) return;
    setPreview({
      open: true,
      currentSectionId: sectionGroups[0].id,
      answers: {},
      history: [],
      submitted: false,
    });
  };

  // ── Render Helpers ──────────────────────────────────────────────────────

  const renderSectionDestLabel = (target: string) => {
    if (target === "next") return "Continue to next section";
    if (target === "submit") return "Submit form";
    const sec = sectionGroups.find((s) => s.id === target);
    return sec ? `Go to: ${sec.title}` : `Go to section (${target.slice(0, 6)}...)`;
  };

  // ── JSX ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200">
      {/* Header & Quick-Add Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold font-heading uppercase tracking-wider text-[#17458F] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
              <span>SRC Forms Builder</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[#17458F] text-[10px] font-bold">
              {activeFields.length} {activeFields.length === 1 ? "Element" : "Elements"}
            </span>
            {sectionGroups.length > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 text-purple-800 text-[10px] font-bold">
                {sectionGroups.length} Sections
              </span>
            )}
            {validationIssues.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {validationIssues.length} {validationIssues.length === 1 ? "Issue" : "Issues"}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-sans">
            Build custom forms with multi-page sections, response branching, and inline WhatsApp group links.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Validation toggle */}
          {sectionGroups.length > 1 && (
            <button
              type="button"
              onClick={() => setShowValidation((v) => !v)}
              className={cn(
                "px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs",
                validationIssues.length > 0
                  ? "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
              )}
            >
              {validationIssues.length > 0 ? (
                <AlertTriangle className="w-3 h-3 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              )}
              <span>Validate</span>
            </button>
          )}

          {/* Preview mode toggle */}
          {sectionGroups.length > 1 && (
            <button
              type="button"
              onClick={startPreview}
              className="px-2.5 py-1.5 rounded-xl bg-[#17458F] hover:bg-[#123670] border border-[#17458F] text-[11px] font-bold text-white transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Eye className="w-3 h-3" />
              <span>Preview</span>
            </button>
          )}
        </div>
      </div>

      {/* Validation Panel */}
      {showValidation && sectionGroups.length > 1 && (
        <div className={cn(
          "p-4 rounded-2xl border space-y-2",
          validationIssues.length === 0
            ? "bg-emerald-50/60 border-emerald-200"
            : "bg-amber-50/60 border-amber-300"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              {validationIssues.length === 0 ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Section Routing — No Issues</>
              ) : (
                <><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Section Routing — {validationIssues.length} {validationIssues.length === 1 ? "Issue" : "Issues"} Found</>
              )}
            </span>
            <button
              type="button"
              onClick={() => setShowValidation(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {validationIssues.length === 0 ? (
            <p className="text-[11px] text-emerald-700">All section routes are valid. Respondents will be guided correctly.</p>
          ) : (
            <ul className="space-y-1.5">
              {validationIssues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-amber-900">
                  <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Quick Add Presets — sticky while scrolling */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => addField("short_text")}
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3 text-[#E78023]" />
            <span>+ Short Text</span>
          </button>
          <button
            type="button"
            onClick={() => addField("multiple_choice")}
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3 text-[#17458F]" />
            <span>+ Multiple Choice</span>
          </button>
          <button
            type="button"
            onClick={() => addField("checkboxes")}
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3 text-emerald-600" />
            <span>+ Checkboxes</span>
          </button>
          <button
            type="button"
            onClick={() => addField("section")}
            className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[11px] font-bold text-purple-800 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Layers className="w-3 h-3 text-purple-600" />
            <span>+ Section Break</span>
          </button>
          <button
            type="button"
            onClick={() => addField("whatsapp_link")}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold text-emerald-800 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <MessageCircle className="w-3 h-3 text-[#25D366]" />
            <span>+ WhatsApp Link</span>
          </button>
          <button
            type="button"
            onClick={() => addField("note")}
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3 text-amber-500" />
            <span>+ Note</span>
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {preview.open && (
        <PreviewPanel
          sectionGroups={sectionGroups}
          preview={preview}
          onNext={previewNext}
          onBack={previewBack}
          onSetAnswer={previewSetAnswer}
          onReset={previewReset}
          onClose={() => setPreview(PREVIEW_INIT)}
        />
      )}

      {/* Empty State */}
      {activeFields.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-dashed border-slate-300 space-y-2">
          <p className="text-xs text-slate-500 font-medium">
            No fields or sections created yet. Add inputs, section breaks, or a WhatsApp group link.
          </p>
          <div className="pt-2 flex justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => addField("short_text")}
              className="px-3 py-1.5 rounded-xl bg-[#17458F] text-white text-xs font-bold hover:bg-[#123670] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Question</span>
            </button>
            <button
              type="button"
              onClick={() => addField("section")}
              className="px-3 py-1.5 rounded-xl bg-purple-700 text-white text-xs font-bold hover:bg-purple-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Add Section</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activeFields.map((f, idx) => {
            const isOptionBased = ["multiple_choice", "checkboxes", "dropdown"].includes(f.type);
            const isNote = f.type === "note";
            const isSection = f.type === "section";
            const isWhatsapp = f.type === "whatsapp_link";
            const hasBranching = Boolean(f.goToSection && Object.keys(f.goToSection).length > 0);

            // Section index for display
            const currentSecIndex = isSection
              ? sectionGroups.findIndex((s) => s.id === f.id) + 1
              : 0;

            // ── SECTION DIVIDER CARD ───────────────────────────────────────
            if (isSection) {
              return (
                <div
                  key={f.id}
                  className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-purple-50 via-white to-slate-50 border-2 border-purple-300 shadow-sm space-y-3.5 relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-900 bg-purple-100/90 px-2.5 py-0.5 rounded-full">
                          Section {currentSecIndex} of {sectionGroups.length}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => moveSection(f.id, "up")}
                        disabled={currentSecIndex <= 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Move Entire Section Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(f.id, "down")}
                        disabled={currentSecIndex >= sectionGroups.length}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Move Entire Section Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <div className="h-3 w-px bg-purple-200 mx-1" />
                      <button
                        type="button"
                        onClick={() => duplicateSection(f)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
                        title="Duplicate Section"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteField(f.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Section Divider"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={f.question}
                      onChange={(e) => updateField(f.id, { question: e.target.value })}
                      placeholder="Section Header Title (e.g. Technical Skills & Project Preferences)..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-purple-200 text-sm font-extrabold text-purple-950 focus:outline-none focus:border-purple-600 shadow-2xs"
                    />
                    <textarea
                      rows={2}
                      value={f.description || ""}
                      onChange={(e) => updateField(f.id, { description: e.target.value })}
                      placeholder="Optional description / instructions for responders arriving at this section..."
                      className="w-full px-3.5 py-1.5 rounded-xl bg-white border border-purple-200 text-xs text-slate-700 focus:outline-none focus:border-purple-600"
                    />
                  </div>

                  {/* After Section Navigation Rule */}
                  <div className="pt-2 border-t border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-purple-900">
                      <ArrowRight className="w-3.5 h-3.5 text-purple-500" />
                      <span>After Section {currentSecIndex} (default):</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={f.afterSection || "next"}
                        onChange={(e) => updateField(f.id, { afterSection: e.target.value })}
                        className="px-3 py-1.5 rounded-xl bg-white border border-purple-300 text-xs font-semibold text-purple-950 focus:outline-none focus:border-purple-600 cursor-pointer shadow-2xs"
                      >
                        <option value="next">Continue to next section</option>
                        {sectionGroups
                          .filter((sec) => sec.id !== f.id)
                          .map((sec) => (
                            <option key={sec.id} value={sec.id}>
                              Go to Section {sec.sectionIndex} ({sec.title})
                            </option>
                          ))}
                        <option value="submit">Submit form</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            }

            // ── WHATSAPP LINK CARD ─────────────────────────────────────────
            if (isWhatsapp) {
              const previewUrl = formatWhatsAppUrl(f.waGroupUrl);
              return (
                <div
                  key={f.id}
                  className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/60 border border-emerald-200 shadow-2xs space-y-3"
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
                        <MessageCircle className="w-4 h-4 fill-white" />
                      </div>
                      <div>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-950">
                          WhatsApp Group Link
                        </span>
                        <p className="text-[10px] text-emerald-600">
                          Inline element — visible at this position in the form
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveField(idx, "up")}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-emerald-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Move Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(idx, "down")}
                        disabled={idx === activeFields.length - 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-emerald-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Move Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <div className="h-3 w-px bg-emerald-300 mx-1" />
                      <button
                        type="button"
                        onClick={() => duplicateField(f.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteField(f.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {sectionGroups.length > 1 && (
                        <div className="flex items-center gap-1.5 pl-1">
                          <span className="text-[10px] text-emerald-800 font-bold uppercase">Section:</span>
                          <select
                            value={getFieldSection(f.id)?.id || ""}
                            onChange={(e) => moveFieldToSection(f.id, e.target.value)}
                            className="px-2 py-0.5 rounded-lg bg-white/90 border border-emerald-300 text-[10px] font-bold text-emerald-950 focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs"
                            title="Move this WhatsApp link to another section"
                          >
                            {sectionGroups.map((sec) => (
                              <option key={sec.id} value={sec.id}>
                                Sec {sec.sectionIndex}: {sec.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Display label */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Card Title (optional)</label>
                    <input
                      type="text"
                      value={f.question || ""}
                      onChange={(e) => updateField(f.id, { question: e.target.value })}
                      placeholder="Join Our WhatsApp Group"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">WhatsApp Group URL *</label>
                      <input
                        type="text"
                        value={f.waGroupUrl || ""}
                        onChange={(e) => updateField(f.id, { waGroupUrl: e.target.value })}
                        placeholder="https://chat.whatsapp.com/..."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Group Display Name (optional)</label>
                      <input
                        type="text"
                        value={f.waGroupName || ""}
                        onChange={(e) => updateField(f.id, { waGroupName: e.target.value })}
                        placeholder="e.g. SRC Technical Team 2026"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-300 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Live preview row */}
                  {previewUrl && (
                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] text-white text-[11px] font-bold hover:bg-emerald-500 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Test Link</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>
                      <span className="text-[10px] text-emerald-700">
                        {f.waGroupName ? `"${f.waGroupName}"` : "Group link configured"}
                      </span>
                    </div>
                  )}
                </div>
              );
            }

            // ── STANDARD QUESTION / NOTE CARD ──────────────────────────────
            return (
              <div
                key={f.id}
                className={cn(
                  "p-4 sm:p-5 rounded-2xl border transition-all space-y-3.5",
                  isNote
                    ? "bg-amber-50/40 border-amber-200"
                    : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                )}
              >
                {/* Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold text-[11px] flex items-center justify-center border border-slate-200">
                      {isNote ? "NB" : `Q${idx + 1}`}
                    </span>
                  </div>

                  <div className="flex-1">
                    <input
                      type="text"
                      value={f.question}
                      onChange={(e) => updateField(f.id, { question: e.target.value })}
                      placeholder={isNote ? "Note Title / Announcement Header..." : "Enter Question Prompt / Field Label..."}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F] focus:bg-white transition-all shadow-2xs"
                    />
                  </div>

                  {/* Type Selector */}
                  <div className="shrink-0">
                    <select
                      value={f.type}
                      onChange={(e) => updateField(f.id, { type: e.target.value as SrcFormFieldType })}
                      className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#17458F] cursor-pointer"
                    >
                      <option value="short_text">📝 Short Answer</option>
                      <option value="long_text">📄 Paragraph</option>
                      <option value="multiple_choice">🔘 Multiple Choice</option>
                      <option value="checkboxes">☑️ Checkboxes</option>
                      <option value="dropdown">🔽 Dropdown</option>
                      <option value="note">⚠️ Important Note</option>
                      <option value="section">🗂️ Section Divider</option>
                      <option value="whatsapp_link">💬 WhatsApp Group Link</option>
                    </select>
                  </div>
                </div>

                {/* Description / Helper */}
                {!isNote && (
                  <div className="pl-0 sm:pl-8">
                    <input
                      type="text"
                      value={f.description || ""}
                      onChange={(e) => updateField(f.id, { description: e.target.value })}
                      placeholder="Add optional helper description or guidance for attendees..."
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-50/70 border border-slate-200/80 text-[11px] text-slate-600 focus:outline-none focus:border-[#17458F] focus:bg-white"
                    />
                  </div>
                )}

                {/* Note Content */}
                {isNote && (
                  <div className="pl-0 sm:pl-8 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      <span>Instruction / Guideline Text</span>
                    </label>
                    <textarea
                      rows={2}
                      value={f.noteContent || ""}
                      onChange={(e) => updateField(f.id, { noteContent: e.target.value })}
                      placeholder="e.g. Participants are requested to report 30 minutes prior to schedule."
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-amber-200 text-xs text-slate-800 focus:outline-none focus:border-[#E78023]"
                    />
                  </div>
                )}

                {/* Option Editor */}
                {isOptionBased && (
                  <div className="pl-0 sm:pl-8 space-y-2 pt-1 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Options / Choices:
                      </span>

                      {/* Go To Section Toggle — enabled for MC, dropdown, AND checkboxes */}
                      {(f.type === "multiple_choice" || f.type === "dropdown" || f.type === "checkboxes") &&
                        sectionGroups.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggleOptionBranching(f)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer",
                              hasBranching
                                ? "bg-purple-100 text-purple-900 border border-purple-300"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                            title="Route responders to specific sections based on their chosen answer"
                          >
                            <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                            <span>{hasBranching ? "Go to section: ON" : "Go to section based on answer"}</span>
                          </button>
                        )}
                    </div>

                    <div className="space-y-2">
                      {(f.options || []).map((opt, optIdx) => {
                        const targetSectionId = f.goToSection?.[opt] || "next";

                        return (
                          <div key={optIdx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-4 h-4 flex items-center justify-center shrink-0 text-slate-400">
                                {f.type === "multiple_choice" && <CircleDot className="w-3.5 h-3.5" />}
                                {f.type === "checkboxes" && <CheckSquare className="w-3.5 h-3.5" />}
                                {f.type === "dropdown" && <span className="text-[10px] font-mono">{optIdx + 1}.</span>}
                              </div>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(f.id, optIdx, e.target.value)}
                                placeholder={`Option ${optIdx + 1}`}
                                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#17458F]"
                              />
                            </div>

                            {/* Section Destination Selector */}
                            {hasBranching && (
                              <div className="flex items-center gap-1.5 shrink-0 pl-6 sm:pl-0">
                                <ArrowRight className="w-3 h-3 text-purple-400" />
                                <select
                                  value={targetSectionId}
                                  onChange={(e) => {
                                    const nextGoTo = { ...(f.goToSection || {}), [opt]: e.target.value };
                                    updateField(f.id, { goToSection: nextGoTo });
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-purple-50/70 border border-purple-200 text-[11px] font-bold text-purple-900 focus:outline-none focus:border-purple-600 cursor-pointer"
                                >
                                  <option value="next">Continue to next section</option>
                                  {sectionGroups.map((sec) => (
                                    <option key={sec.id} value={sec.id}>
                                      Go to: {sec.title}
                                    </option>
                                  ))}
                                  <option value="submit">Submit form</option>
                                </select>
                              </div>
                            )}

                            {(f.options || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeOption(f.id, optIdx)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0 self-end sm:self-auto"
                                title="Remove option"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => addOption(f.id)}
                      className="mt-1 text-xs font-bold text-[#17458F] hover:text-[#0E2F66] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Option</span>
                    </button>
                  </div>
                )}

                {/* Field Bottom Toolbar */}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveField(idx, "up")}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Move Up"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(idx, "down")}
                      disabled={idx === activeFields.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Move Down"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                    <div className="h-3 w-px bg-slate-200 mx-1" />
                    <button
                      type="button"
                      onClick={() => duplicateField(f.id)}
                      className="px-2.5 py-1 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                    >
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteField(f.id)}
                      className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {sectionGroups.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Section:</span>
                        <select
                          value={getFieldSection(f.id)?.id || ""}
                          onChange={(e) => moveFieldToSection(f.id, e.target.value)}
                          className="px-2 py-1 rounded-lg bg-purple-50/80 border border-purple-200 text-[11px] font-bold text-purple-900 focus:outline-none focus:border-purple-600 cursor-pointer shadow-2xs"
                          title="Move this item to a different section"
                        >
                          {sectionGroups.map((sec) => (
                            <option key={sec.id} value={sec.id}>
                              Sec {sec.sectionIndex}: {sec.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {!isNote && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-[11px] font-bold text-slate-700">Required</span>
                        <input
                          type="checkbox"
                          checked={f.required ?? true}
                          onChange={(e) => updateField(f.id, { required: e.target.checked })}
                          className="w-4 h-4 rounded text-[#17458F] focus:ring-[#17458F] border-slate-300 cursor-pointer"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Preview Panel Component ──────────────────────────────────────────────────

interface PreviewPanelProps {
  sectionGroups: FormSectionGroup[];
  preview: PreviewState;
  onNext: () => void;
  onBack: () => void;
  onSetAnswer: (fieldId: string, value: any) => void;
  onReset: () => void;
  onClose: () => void;
}

function PreviewPanel({
  sectionGroups,
  preview,
  onNext,
  onBack,
  onSetAnswer,
  onReset,
  onClose,
}: PreviewPanelProps) {
  const currentSection = sectionGroups.find((s) => s.id === preview.currentSectionId);
  const nextTarget = currentSection
    ? getNextSectionTarget(currentSection, sectionGroups, preview.answers)
    : "submit";
  const nextLabel =
    nextTarget === "submit"
      ? "Submit form"
      : `Next: ${sectionGroups.find((s) => s.id === nextTarget)?.title || "Next Section"}`;

  return (
    <div className="rounded-3xl border-2 border-[#17458F] bg-gradient-to-br from-blue-50/80 via-white to-slate-50 shadow-md overflow-hidden">
      {/* Preview Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#17458F] text-white">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          <span className="text-xs font-extrabold uppercase tracking-wider">
            Preview Mode — Respondent View
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {preview.submitted ? (
          <div className="text-center space-y-3 py-6">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-extrabold text-slate-900">Form Submitted</p>
            <p className="text-xs text-slate-500">
              Path taken: {preview.history.map((id) => {
                const sec = sectionGroups.find((s) => s.id === id);
                return sec?.title || id.slice(0, 8);
              }).join(" → ")} → Submit
            </p>
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2 rounded-xl bg-[#17458F] text-white text-xs font-bold hover:bg-[#123670] cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : currentSection ? (
          <>
            {/* Progress & path */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-[#17458F]/10 text-[#17458F] text-[10px] font-extrabold uppercase">
                Section {sectionGroups.findIndex((s) => s.id === currentSection.id) + 1} of {sectionGroups.length}
              </span>
              {preview.history.length > 0 && (
                <span className="text-[10px] text-slate-400 font-medium">
                  Path: {preview.history.map((id) => {
                    const sec = sectionGroups.find((s) => s.id === id);
                    return sec?.title || "…";
                  }).join(" → ")} →{" "}
                  <span className="text-slate-600 font-bold">{currentSection.title}</span>
                </span>
              )}
            </div>

            {/* Section header */}
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">{currentSection.title}</h3>
              {currentSection.description && (
                <p className="text-xs text-slate-500 mt-0.5">{currentSection.description}</p>
              )}
            </div>

            {/* Section fields */}
            <div className="space-y-3">
              {currentSection.fields.map((field) => (
                <PreviewField
                  key={field.id}
                  field={field}
                  value={preview.answers[field.id]}
                  onChange={(val) => onSetAnswer(field.id, val)}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onBack}
                disabled={preview.history.length === 0}
                className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                ← Back
              </button>
              <div className="text-[10px] text-purple-700 font-bold bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                → {nextLabel}
              </div>
              <button
                type="button"
                onClick={onNext}
                className="px-3.5 py-2 rounded-xl bg-[#17458F] text-white text-xs font-bold hover:bg-[#123670] cursor-pointer"
              >
                {nextTarget === "submit" ? "Submit →" : "Next →"}
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500 text-center py-4">No sections to preview.</p>
        )}
      </div>
    </div>
  );
}

// ─── Preview Field Renderer ───────────────────────────────────────────────────

function PreviewField({
  field,
  value,
  onChange,
}: {
  field: SrcFormField;
  value: any;
  onChange: (val: any) => void;
}) {
  if (field.type === "note") {
    return (
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
        <p className="font-bold">{field.question}</p>
        {field.noteContent && <p className="mt-1 text-amber-800">{field.noteContent}</p>}
      </div>
    );
  }

  if (field.type === "whatsapp_link") {
    const url = formatWhatsAppUrl(field.waGroupUrl);
    if (!url) return null;
    return (
      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-950">{field.question || "Join Our WhatsApp Group"}</p>
          {field.waGroupName && <p className="text-[11px] text-emerald-700">{field.waGroupName}</p>}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] text-white text-[11px] font-bold"
        >
          <MessageCircle className="w-3.5 h-3.5 fill-white" />
          <span>Join</span>
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-800">
        {field.question || "Untitled Question"}
        {field.required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {field.description && <p className="text-[11px] text-slate-500">{field.description}</p>}

      {field.type === "short_text" && (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Your answer..."}
          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-[#17458F]"
        />
      )}

      {field.type === "long_text" && (
        <textarea
          rows={2}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Your answer..."}
          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-[#17458F] resize-none"
        />
      )}

      {field.type === "multiple_choice" && (
        <div className="space-y-1.5">
          {(field.options || []).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer",
                value === opt
                  ? "bg-[#17458F]/10 border-[#17458F] text-[#17458F] font-bold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              )}
            >
              <div
                className={cn(
                  "w-3.5 h-3.5 rounded-full border shrink-0",
                  value === opt ? "border-[#17458F] bg-[#17458F]" : "border-slate-300"
                )}
              />
              {opt}
            </button>
          ))}
        </div>
      )}

      {field.type === "checkboxes" && (
        <div className="space-y-1.5">
          {(field.options || []).map((opt) => {
            const selected: string[] = Array.isArray(value) ? value : [];
            const isChecked = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = isChecked ? selected.filter((x) => x !== opt) : [...selected, opt];
                  onChange(next);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer",
                  isChecked
                    ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                )}
              >
                <div
                  className={cn(
                    "w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center",
                    isChecked ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white"
                  )}
                >
                  {isChecked && <span className="text-white text-[8px] font-black">✓</span>}
                </div>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {field.type === "dropdown" && (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-[#17458F] cursor-pointer"
        >
          <option value="">Select an option...</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// Backward-compatible aliases
export const CustomQuestionsBuilder = SrcFormsBuilder;
export type CustomQuestionsBuilderProps = SrcFormsBuilderProps;
