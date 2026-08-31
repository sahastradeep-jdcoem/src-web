"use client";

import React from "react";
import { CustomQuestion, CustomQuestionType } from "@/types";
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
  AlertCircle,
  Sparkles,
  Info
} from "lucide-react";

interface CustomQuestionsBuilderProps {
  questions: CustomQuestion[];
  onChange: (questions: CustomQuestion[]) => void;
}

const QUESTION_TYPE_CONFIG: Record<CustomQuestionType, { label: string; icon: any; placeholder: string; desc: string }> = {
  short_text: {
    label: "Short Answer",
    icon: AlignLeft,
    placeholder: "e.g. GitHub Profile URL, Discord ID, College BT-ID",
    desc: "Single line text response",
  },
  long_text: {
    label: "Paragraph",
    icon: AlignJustify,
    placeholder: "e.g. Briefly describe your project idea or hackathon motivation",
    desc: "Multi-line detailed answer",
  },
  multiple_choice: {
    label: "Multiple Choice",
    icon: CircleDot,
    placeholder: "e.g. Select your T-Shirt size or track preference",
    desc: "Single selection from options (Radio)",
  },
  checkboxes: {
    label: "Checkboxes",
    icon: CheckSquare,
    placeholder: "e.g. Select all programming languages or skills you know",
    desc: "Multiple selections allowed",
  },
  dropdown: {
    label: "Dropdown",
    icon: ChevronDownSquare,
    placeholder: "e.g. Select your college branch or year of study",
    desc: "Dropdown selection menu",
  },
  note: {
    label: "Important Note / Guidelines",
    icon: AlertCircle,
    placeholder: "e.g. Bring your own laptops and valid college ID cards",
    desc: "Highlighted instruction banner (No answer required)",
  },
};

export function CustomQuestionsBuilder({ questions = [], onChange }: CustomQuestionsBuilderProps) {
  const addQuestion = (type: CustomQuestionType = "short_text") => {
    const newQ: CustomQuestion = {
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
    onChange([...questions, newQ]);
  };

  const updateQuestion = (id: string, updates: Partial<CustomQuestion>) => {
    const updated = questions.map((q) => {
      if (q.id !== id) return q;
      const merged = { ...q, ...updates };

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

  const deleteQuestion = (id: string) => {
    onChange(questions.filter((q) => q.id !== id));
  };

  const duplicateQuestion = (id: string) => {
    const targetIndex = questions.findIndex((q) => q.id === id);
    if (targetIndex === -1) return;
    const target = questions[targetIndex];
    const clone: CustomQuestion = {
      ...target,
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      question: `${target.question || "Untitled Field"} (Copy)`,
      options: target.options ? [...target.options] : undefined,
    };
    const updated = [...questions];
    updated.splice(targetIndex + 1, 0, clone);
    onChange(updated);
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    onChange(updated);
  };

  const addOption = (questionId: string) => {
    const updated = questions.map((q) => {
      if (q.id !== questionId) return q;
      const currentOpts = q.options || [];
      return {
        ...q,
        options: [...currentOpts, `Option ${currentOpts.length + 1}`],
      };
    });
    onChange(updated);
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const updated = questions.map((q) => {
      if (q.id !== questionId) return q;
      const opts = [...(q.options || [])];
      opts[optionIndex] = value;
      return { ...q, options: opts };
    });
    onChange(updated);
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    const updated = questions.map((q) => {
      if (q.id !== questionId) return q;
      const opts = (q.options || []).filter((_, idx) => idx !== optionIndex);
      return { ...q, options: opts };
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
              <span>Custom Questions &amp; Notes (Q&amp;N Studio)</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[#17458F] text-[10px] font-bold">
              {questions.length} {questions.length === 1 ? "Field" : "Fields"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-sans">
            Add Google Forms-style custom questions and guideline notes to this event registration.
          </p>
        </div>

        {/* Quick Add Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => addQuestion("short_text")}
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3 text-[#E78023]" />
            <span>+ Short Text</span>
          </button>
          <button
            type="button"
            onClick={() => addQuestion("multiple_choice")}
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3 text-[#17458F]" />
            <span>+ Multiple Choice</span>
          </button>
          <button
            type="button"
            onClick={() => addQuestion("checkboxes")}
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3 text-emerald-600" />
            <span>+ Checkboxes</span>
          </button>
          <button
            type="button"
            onClick={() => addQuestion("note")}
            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3 text-amber-500" />
            <span>+ Important Note</span>
          </button>
        </div>
      </div>

      {/* Questions List */}
      {questions.length === 0 ? (
        <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-[#17458F] mx-auto shadow-2xs">
            <AlignLeft className="w-5 h-5 text-[#E78023]" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-800 font-heading">No Custom Questions or Notes Yet</h4>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Add fields like T-Shirt size, GitHub URL, preferred track, dietary needs, or event instructions.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => addQuestion("short_text")}
              className="px-4 py-2 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Question</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => {
            const config = QUESTION_TYPE_CONFIG[q.type] || QUESTION_TYPE_CONFIG.short_text;
            const isOptionBased = ["multiple_choice", "checkboxes", "dropdown"].includes(q.type);
            const isNote = q.type === "note";

            return (
              <div
                key={q.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3.5 ${
                  isNote 
                    ? "bg-amber-50/40 border-amber-200" 
                    : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                }`}
              >
                {/* Question Top Row: Badge, Title Input, and Type Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold text-[11px] flex items-center justify-center border border-slate-200">
                      {isNote ? "NB" : `Q${idx + 1}`}
                    </span>
                  </div>

                  <div className="flex-1">
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                      placeholder={isNote ? "Note Title / Announcement Header..." : "Enter Question Prompt / Field Label..."}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F] focus:bg-white transition-all shadow-2xs"
                    />
                  </div>

                  {/* Question Type Selector Dropdown */}
                  <div className="shrink-0">
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(q.id, { type: e.target.value as CustomQuestionType })}
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
                      value={q.description || ""}
                      onChange={(e) => updateQuestion(q.id, { description: e.target.value })}
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
                      value={q.noteContent || ""}
                      onChange={(e) => updateQuestion(q.id, { noteContent: e.target.value })}
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
                      {(q.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center shrink-0 text-slate-400">
                            {q.type === "multiple_choice" && <CircleDot className="w-3.5 h-3.5" />}
                            {q.type === "checkboxes" && <CheckSquare className="w-3.5 h-3.5" />}
                            {q.type === "dropdown" && <span className="text-[10px] font-mono">{optIdx + 1}.</span>}
                          </div>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                            placeholder={`Option ${optIdx + 1}`}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#17458F]"
                          />
                          {(q.options || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOption(q.id, optIdx)}
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
                      onClick={() => addOption(q.id)}
                      className="mt-1 text-xs font-bold text-[#17458F] hover:text-[#0E2F66] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Option</span>
                    </button>
                  </div>
                )}

                {/* Question Bottom Action Toolbar */}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                  {/* Left Controls: Move & Duplicate */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveQuestion(idx, "up")}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Move Up"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveQuestion(idx, "down")}
                      disabled={idx === questions.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Move Down"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                    <div className="h-3 w-px bg-slate-200 mx-1" />
                    <button
                      type="button"
                      onClick={() => duplicateQuestion(q.id)}
                      className="px-2.5 py-1 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                      title="Duplicate Question"
                    >
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteQuestion(q.id)}
                      className="px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                      title="Delete Question"
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
                        checked={q.required ?? true}
                        onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
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
