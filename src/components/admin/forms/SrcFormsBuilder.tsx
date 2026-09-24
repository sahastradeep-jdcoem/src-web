"use client";

import React, { useMemo } from "react";
import { SrcFormField, SrcFormFieldType, CustomQuestion, CustomQuestionType } from "@/types";
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
  ExternalLink
} from "lucide-react";
import { getFormSectionGroups } from "@/lib/srcFormsHelper";

export interface SrcFormsBuilderProps {
  fields?: SrcFormField[];
  initialFields?: SrcFormField[];
  questions?: SrcFormField[]; // Backward-compatibility alias
  onChange: (fields: SrcFormField[]) => void;
  whatsappGroupUrl?: string;
  onWhatsAppGroupUrlChange?: (url: string) => void;
  onWhatsappGroupUrlChange?: (url: string) => void;
  whatsappGroupName?: string;
  onWhatsAppGroupNameChange?: (name: string) => void;
  onWhatsappGroupNameChange?: (name: string) => void;
}

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
};

export function SrcFormsBuilder({ 
  fields, 
  initialFields, 
  questions, 
  onChange,
  whatsappGroupUrl,
  onWhatsAppGroupUrlChange,
  onWhatsappGroupUrlChange,
  whatsappGroupName,
  onWhatsAppGroupNameChange,
  onWhatsappGroupNameChange,
}: SrcFormsBuilderProps) {
  const handleUrlChange = onWhatsAppGroupUrlChange || onWhatsappGroupUrlChange;
  const handleNameChange = onWhatsAppGroupNameChange || onWhatsappGroupNameChange;
  // Gracefully support both `fields`, `initialFields`, or `questions` props
  const activeFields: SrcFormField[] = fields ?? initialFields ?? questions ?? [];

  // Compute live section layout
  const sectionGroups = useMemo(() => getFormSectionGroups(activeFields), [activeFields]);

  const addField = (type: SrcFormFieldType = "short_text") => {
    const isSection = type === "section";
    const nextSecNum = sectionGroups.length + 1;

    const newField: SrcFormField = {
      id: isSection ? `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      question: isSection 
        ? `Section ${nextSecNum}: Domain Assessment` 
        : type === "note" 
        ? "Important Instructions & Guidelines" 
        : "",
      description: "",
      placeholder: "",
      required: type !== "note" && !isSection,
      options: ["multiple_choice", "checkboxes", "dropdown"].includes(type)
        ? ["Option 1", "Option 2"]
        : undefined,
      noteContent: type === "note" ? "Please review the requirements carefully before attending." : undefined,
      afterSection: isSection ? "next" : undefined,
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

      return merged;
    });
    onChange(updated);
  };

  const deleteField = (id: string) => {
    onChange(activeFields.filter((f) => f.id !== id));
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
    const updated = [...activeFields];
    updated.splice(targetIndex + 1, 0, clone);
    onChange(updated);
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

  const addOption = (fieldId: string) => {
    const updated = activeFields.map((f) => {
      if (f.id !== fieldId) return f;
      const currentOpts = f.options || [];
      return {
        ...f,
        options: [...currentOpts, `Option ${currentOpts.length + 1}`],
      };
    });
    onChange(updated);
  };

  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    const updated = activeFields.map((f) => {
      if (f.id !== fieldId) return f;
      const oldVal = (f.options || [])[optionIndex];
      const opts = [...(f.options || [])];
      opts[optionIndex] = value;

      // Also migrate goToSection key if it was configured
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
      if (newGoTo && removedVal) {
        delete newGoTo[removedVal];
      }

      return { ...f, options: opts, goToSection: newGoTo };
    });
    onChange(updated);
  };

  const toggleOptionBranching = (field: SrcFormField) => {
    if (field.goToSection && Object.keys(field.goToSection).length > 0) {
      // Disable
      updateField(field.id, { goToSection: undefined });
    } else {
      // Enable default routing
      const defaultRouting: Record<string, string> = {};
      (field.options || []).forEach((opt) => {
        defaultRouting[opt] = "next";
      });
      updateField(field.id, { goToSection: defaultRouting });
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200">
      {/* Header & Quick-Add Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
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
          </div>
          <p className="text-[11px] text-slate-500 font-sans">
            Build custom forms with multi-page sections, response branching, and post-submit WhatsApp follow-up.
          </p>
        </div>

        {/* Quick Add Presets */}
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
            onClick={() => addField("note")}
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3 text-amber-500" />
            <span>+ Note</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Group Follow-up Configuration (Feature 2) */}
      {(onWhatsAppGroupUrlChange || whatsappGroupUrl !== undefined) && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50/80 to-teal-50/60 border border-emerald-200/90 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
                <MessageCircle className="w-4 h-4 fill-white" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Post-Submission WhatsApp Group Join Link
                </h4>
                <p className="text-[11px] text-emerald-700">
                  Responders will immediately see this WhatsApp invite card upon successfully submitting this form.
                </p>
              </div>
            </div>
            {whatsappGroupUrl && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Link
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                <span>WhatsApp Group URL</span>
              </label>
              <input
                type="text"
                value={whatsappGroupUrl || ""}
                onChange={(e) => handleUrlChange?.(e.target.value)}
                placeholder="https://chat.whatsapp.com/inviteCode..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                <span>Group Display Name (Optional)</span>
              </label>
              <input
                type="text"
                value={whatsappGroupName || ""}
                onChange={(e) => handleNameChange?.(e.target.value)}
                placeholder="e.g. SRC Technical Team 2026 or Hackathon Delegates"
                className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-300 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeFields.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-dashed border-slate-300 space-y-2">
          <p className="text-xs text-slate-500 font-medium">
            No fields or sections created yet. Add standard inputs or section breaks using the toolbar above.
          </p>
          <div className="pt-2 flex justify-center gap-2">
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
            const hasBranching = Boolean(f.goToSection && Object.keys(f.goToSection).length > 0);

            // Compute section index if this is a section
            const currentSecIndex = isSection
              ? sectionGroups.findIndex((s) => s.id === f.id) + 1
              : 0;

            // SECTION DIVIDER CARD (Feature 1)
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
                        onClick={() => moveField(idx, "up")}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Move Section Up"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(idx, "down")}
                        disabled={idx === activeFields.length - 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Move Section Down"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <div className="h-3 w-px bg-purple-200 mx-1" />
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

                  {/* After Section Navigation Rule (Google Forms style) */}
                  <div className="pt-2 border-t border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-purple-900">
                      <span>After Section {currentSecIndex}:</span>
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

            // STANDARD QUESTION / NOTE CARD
            return (
              <div
                key={f.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3.5 ${
                  isNote 
                    ? "bg-amber-50/40 border-amber-200" 
                    : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                }`}
              >
                {/* Field Top Row: Badge, Title Input, and Type Selector */}
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

                  {/* Question Type Selector Dropdown */}
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
                    </select>
                  </div>
                </div>

                {/* Subtitle / Helper Description */}
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

                {/* Note Content (if type === 'note') */}
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
                      placeholder="e.g. Participants are requested to report 30 minutes prior to schedule. Laptops and chargers are mandatory."
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-amber-200 text-xs text-slate-800 focus:outline-none focus:border-[#E78023]"
                    />
                  </div>
                )}

                {/* Option Editor for Multiple Choice, Checkboxes, Dropdown */}
                {isOptionBased && (
                  <div className="pl-0 sm:pl-8 space-y-2 pt-1 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Options / Choices:
                      </span>

                      {/* Go To Section Toggle (Google Forms feature) for Multiple Choice / Dropdown */}
                      {(f.type === "multiple_choice" || f.type === "dropdown") && (
                        <button
                          type="button"
                          onClick={() => toggleOptionBranching(f)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            hasBranching
                              ? "bg-purple-100 text-purple-900 border border-purple-300"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                          title="Route responders to specific sections based on their chosen answer"
                        >
                          <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                          <span>{hasBranching ? "Go to section active" : "Go to section based on answer"}</span>
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

                            {/* Section Destination Selector if branching enabled */}
                            {hasBranching && (
                              <div className="flex items-center gap-1.5 shrink-0 pl-6 sm:pl-0">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">→</span>
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
                                      Go to Section {sec.sectionIndex} ({sec.title})
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

                {/* Field Bottom Action Toolbar */}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                  {/* Left Controls: Move & Duplicate */}
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
                      title="Duplicate Field"
                    >
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteField(f.id)}
                      className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                      title="Delete Field"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>

                  {/* Right Control: Required Switch (not applicable for notes or sections) */}
                  {!isNote && !isSection && (
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
            );
          })}
        </div>
      )}
    </div>
  );
}

// Backward-compatible alias for existing imports
export const CustomQuestionsBuilder = SrcFormsBuilder;
export type CustomQuestionsBuilderProps = SrcFormsBuilderProps;
