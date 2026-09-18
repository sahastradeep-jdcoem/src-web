"use client";

import React from "react";
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
  Info
} from "lucide-react";

export interface SrcFormsBuilderProps {
  fields?: SrcFormField[];
  initialFields?: SrcFormField[];
  questions?: SrcFormField[]; // Backward-compatibility alias
  onChange: (fields: SrcFormField[]) => void;
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
};

export function SrcFormsBuilder({ fields, initialFields, questions, onChange }: SrcFormsBuilderProps) {
  // Gracefully support both `fields`, `initialFields`, or `questions` props
  const activeFields: SrcFormField[] = fields ?? initialFields ?? questions ?? [];

  const addField = (type: SrcFormFieldType = "short_text") => {
    const newField: SrcFormField = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      question: type === "note" ? "Important Event Instructions & Guidelines" : "",
      description: "",
      placeholder: "",
      required: type !== "note",
      options: ["multiple_choice", "checkboxes", "dropdown"].includes(type)
        ? ["Option 1", "Option 2"]
        : undefined,
      noteContent: type === "note" ? "Please review the requirements carefully before attending." : undefined,
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
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      question: `${target.question || "Untitled Field"} (Copy)`,
      options: target.options ? [...target.options] : undefined,
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
      const opts = [...(f.options || [])];
      opts[optionIndex] = value;
      return { ...f, options: opts };
    });
    onChange(updated);
  };

  const removeOption = (fieldId: string, optionIndex: number) => {
    const updated = activeFields.map((f) => {
      if (f.id !== fieldId) return f;
      const opts = (f.options || []).filter((_, idx) => idx !== optionIndex);
      return { ...f, options: opts };
    });
    onChange(updated);
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
              {activeFields.length} {activeFields.length === 1 ? "Field" : "Fields"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-sans">
            Build custom questions, delegate questionnaires, and guideline notes with SRC Forms.
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
            onClick={() => addField("note")}
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3 text-amber-500" />
            <span>+ Important Note</span>
          </button>
        </div>
      </div>

      {/* Fields List */}
      {activeFields.length === 0 ? (
        <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-[#17458F] mx-auto shadow-2xs">
            <AlignLeft className="w-5 h-5 text-[#E78023]" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-800 font-heading">No SRC Form Fields Added Yet</h4>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Add fields like T-Shirt size, GitHub URL, preferred track, dietary needs, or event instructions with SRC Forms.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => addField("short_text")}
              className="px-4 py-2 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Field</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {activeFields.map((f, idx) => {
            const isOptionBased = ["multiple_choice", "checkboxes", "dropdown"].includes(f.type);
            const isNote = f.type === "note";

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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Options / Choices:
                    </span>
                    <div className="space-y-1.5">
                      {(f.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
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
                          {(f.options || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOption(f.id, optIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Remove option"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
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

                  {/* Right Control: Required Switch (not applicable for notes) */}
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
