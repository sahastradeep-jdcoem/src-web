"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Building2, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Check, 
  RotateCcw, 
  Save, 
  CheckCircle2, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  GraduationCap,
  Sparkles
} from "lucide-react";
import { 
  getStoredDepartments, 
  saveStoredDepartments, 
  resetStoredDepartments, 
  syncDepartmentsFromFirestore,
  DEFAULT_DEPARTMENTS 
} from "@/lib/departmentsStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setDepartments(getStoredDepartments());
    syncDepartmentsFromFirestore().then((res) => {
      if (res) setDepartments(res);
    });
  }, []);

  const saveList = (updated: string[]) => {
    setDepartments(updated);
    saveStoredDepartments(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newDeptName.trim();
    if (!clean) return;

    if (departments.some((d) => d.toLowerCase() === clean.toLowerCase())) {
      alert("A department with this name already exists.");
      return;
    }

    const updated = [...departments, clean];
    saveList(updated);
    setNewDeptName("");
  };

  const handleStartEdit = (index: number, currentName: string) => {
    setEditingIndex(index);
    setEditingValue(currentName);
  };

  const handleSaveEdit = (index: number) => {
    const clean = editingValue.trim();
    if (!clean) return;

    const updated = [...departments];
    updated[index] = clean;
    saveList(updated);
    setEditingIndex(null);
    setEditingValue("");
  };

  const handleDeleteDepartment = (index: number, name: string) => {
    if (confirm(`Are you sure you want to discontinue / delete "${name}"?`)) {
      const updated = departments.filter((_, i) => i !== index);
      saveList(updated);
    }
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= departments.length) return;

    const updated = [...departments];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    saveList(updated);
  };

  const handleReset = () => {
    if (confirm("Reset departments to official JDCOEM roster (15 departments)?")) {
      const res = resetStoredDepartments();
      setDepartments(res);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const filteredDepts = departments.filter((dept) =>
    dept.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-[#0F172A]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
              ACCREDITED DEPARTMENTS ROSTER
            </h1>
            <Badge variant="orange" size="sm">
              {departments.length} ACTIVE
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Manage academic departments, degree programs, and engineering branches across student registration and profile selectors.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset 15 Depts</span>
          </button>

          <Link
            href="/dashboard"
            target="_blank"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Preview Student Profile Selectors"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Department roster updated and published live across all student dropdowns!</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
            Real-Time Sync Active
          </span>
        </div>
      )}

      {/* Add New Department Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#17458F] flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-[#E78023]" />
            <span>Add New Accredited Department / Degree</span>
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Instant Availability</span>
        </div>

        <form onSubmit={handleAddDepartment} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              placeholder="e.g. Aeronautical Engineering, Robotics & Automation..."
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Department</span>
          </Button>
        </form>
      </div>

      {/* Filter / Search & Departments List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search departments..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
            />
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredDepts.length} of {departments.length} departments
          </span>
        </div>

        {/* Departments Table / Cards */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
          {filteredDepts.map((dept, idx) => {
            const originalIndex = departments.indexOf(dept);
            const isEditing = editingIndex === originalIndex;

            return (
              <div
                key={originalIndex}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl bg-white border-2 border-[#17458F] text-xs font-bold text-slate-900 focus:outline-none"
                    />
                    <button
                      onClick={() => handleSaveEdit(originalIndex)}
                      className="p-2 rounded-xl bg-[#17458F] text-white hover:bg-[#0E2F66] transition-colors cursor-pointer"
                      title="Save Changes"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="h-7 w-7 rounded-lg bg-slate-100 text-slate-500 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {originalIndex + 1}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {dept}
                    </span>
                  </div>
                )}

                {!isEditing && (
                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    {/* Move Up / Down */}
                    <button
                      disabled={originalIndex === 0}
                      onClick={() => handleMove(originalIndex, "up")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      disabled={originalIndex === departments.length - 1}
                      onClick={() => handleMove(originalIndex, "down")}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => handleStartEdit(originalIndex, dept)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Edit Department Name"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#17458F]" />
                      <span>Edit</span>
                    </button>

                    {/* Delete / Discontinue Button */}
                    <button
                      onClick={() => handleDeleteDepartment(originalIndex, dept)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Discontinue / Delete Department"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
