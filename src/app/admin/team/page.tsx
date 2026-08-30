"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Trash2,
  Check, 
  Save, 
  RotateCcw, 
  Eye, 
  Sparkles, 
  UserCheck, 
  Linkedin, 
  Mail,
  Camera,
  CheckCircle2,
  ShieldCheck,
  Mic2,
  Megaphone,
  Hash
} from "lucide-react";
import { 
  getStoredCouncilMembers, 
  saveStoredCouncilMembers,
  getStoredHostingCommittee,
  saveStoredHostingCommittee,
  getStoredSpokespersons,
  saveStoredSpokespersons
} from "@/lib/councilStore";
import { getStoredDepartments } from "@/lib/departmentsStore";
import { adminCouncilMembers } from "@/data/team";
import { TeamMember } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";

type TeamCategoryTab = "council" | "hosting" | "spokespersons";

export default function AdminTeamPage() {
  const [activeTab, setActiveTab] = useState<TeamCategoryTab>("council");
  const [councilMembers, setCouncilMembers] = useState<TeamMember[]>([]);
  const [hostingMembers, setHostingMembers] = useState<TeamMember[]>([]);
  const [spokespersons, setSpokespersons] = useState<TeamMember[]>([]);
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setCouncilMembers(getStoredCouncilMembers());
    setHostingMembers(getStoredHostingCommittee());
    setSpokespersons(getStoredSpokespersons());
    setDepartmentsList(getStoredDepartments());
  }, []);

  // Determine current active list
  const currentMembers = 
    activeTab === "council" 
      ? councilMembers 
      : activeTab === "hosting" 
      ? hostingMembers 
      : spokespersons;

  const saveCurrentList = (updated: TeamMember[]) => {
    if (activeTab === "council") {
      setCouncilMembers(updated);
      saveStoredCouncilMembers(updated);
    } else if (activeTab === "hosting") {
      setHostingMembers(updated);
      saveStoredHostingCommittee(updated);
    } else {
      setSpokespersons(updated);
      saveStoredSpokespersons(updated);
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const filteredMembers = currentMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenAddModal = () => {
    setIsCreatingNew(true);
    setEditingMember({
      id: `member-${Date.now()}`,
      name: "",
      role: "",
      department: "Computer Science & Engineering",
      year: "4th Year",
      level: activeTab === "council" ? "Executive Secretariat" : activeTab === "hosting" ? "Host" : "Spokesperson",
      bio: "",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
      badgeNumber: `${currentMembers.length + 1}`,
      email: "",
      linkedin: "",
      btId: ""
    });
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    if (!editingMember.name.trim() || !editingMember.role.trim()) {
      alert("Please provide both a Member Name and a Position / Role Title.");
      return;
    }

    let updated: TeamMember[];
    if (isCreatingNew) {
      updated = [...currentMembers, editingMember];
    } else {
      updated = currentMembers.map((m) =>
        m.id === editingMember.id ? editingMember : m
      );
    }

    saveCurrentList(updated);
    setEditingMember(null);
    setIsCreatingNew(false);
  };

  const handleDeleteMember = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name || "this position"} from the roster?`)) {
      const updated = currentMembers.filter((m) => m.id !== id);
      saveCurrentList(updated);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("Reset roster to default templates?")) {
      if (activeTab === "council") {
        saveCurrentList(adminCouncilMembers);
      }
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
              COUNCIL LEADERSHIP STUDIO
            </h1>
            <Badge variant="orange" size="sm">
              DYNAMIC ROSTER
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Create, edit, and organize all council positions, roles, officers, and committee members dynamically.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <Button
            onClick={handleOpenAddModal}
            variant="primary"
            size="sm"
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Position / Officer</span>
          </Button>

          <Link
            href="/team"
            target="_blank"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Preview Live /team Page in New Tab"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Council team changes saved & published live!</span>
          </div>
          <Link href="/team" target="_blank" className="text-emerald-700 underline font-bold uppercase tracking-wider">
            View Live Public Team Page &rarr;
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab("council")}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "council"
              ? "bg-[#17458F] text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Executive Council ({councilMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("hosting")}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "hosting"
              ? "bg-[#17458F] text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Mic2 className="w-4 h-4" />
          <span>Hosting Committee ({hostingMembers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("spokespersons")}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "spokespersons"
              ? "bg-[#17458F] text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Spokespersons ({spokespersons.length})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${activeTab} members by name, position, department...`}
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F] shadow-xs"
        />
      </div>

      {/* Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredMembers.map((member) => (
          <div
            key={member.id}
            className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F]/30 transition-all flex flex-col justify-between space-y-4 shadow-xs"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {member.level || "Council Member"}
                </span>
                <span className="text-[10px] font-mono font-bold text-[#E78023]">
                  #{member.badgeNumber || member.id.slice(-2)}
                </span>
              </div>

              {/* Photo & Name */}
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  <Image
                    src={member.avatar}
                    alt={member.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-[#0F172A] truncate">
                    {member.name || "Untitled Member"}
                  </h3>
                  <p className="text-xs text-[#E78023] font-bold truncate">
                    {member.role || "Untitled Position"}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {member.department}
                  </p>
                  {member.btId && (
                    <div className="pt-1">
                      <span className="text-[10px] font-mono font-bold text-[#E78023] px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 inline-block">
                        BT ID: {member.btId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => handleDeleteMember(member.id, member.name)}
                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"
                title="Remove Position / Officer"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setIsCreatingNew(false);
                  setEditingMember(member);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#17458F] hover:bg-[#0E2F66] text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredMembers.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
          <Users className="w-8 h-8 text-[#E78023] mx-auto opacity-70" />
          <h4 className="font-bold text-base text-slate-800">No positions found</h4>
          <p className="text-xs text-slate-500">
            Click &ldquo;Add New Position / Officer&rdquo; to create your first team record.
          </p>
          <Button onClick={handleOpenAddModal} variant="primary" size="sm" className="mt-2">
            + Add Position / Officer
          </Button>
        </div>
      )}

      {/* EDIT / CREATE MODAL */}
      {editingMember && (
        <Modal
          isOpen={!!editingMember}
          onClose={() => {
            setEditingMember(null);
            setIsCreatingNew(false);
          }}
          title={isCreatingNew ? "Add New Council Position & Officer" : `Edit: ${editingMember.role || "Position"}`}
          subtitle="Configure position title, student officer credentials, department, and photo."
          maxWidth="lg"
        >
          <form onSubmit={handleSaveMember} className="space-y-5 text-xs text-slate-900">
            
            {/* Position Title & Member Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">
                  Position / Role Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. President, Vice President, Head of Tech..."
                  value={editingMember.role}
                  onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
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
                  value={editingMember.name}
                  onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            {/* Department & Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Department / Branch</label>
                <input
                  type="text"
                  list="team-depts-list"
                  placeholder="e.g. Computer Science & Engineering"
                  value={editingMember.department}
                  onChange={(e) => setEditingMember({ ...editingMember, department: e.target.value })}
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
                  value={editingMember.year}
                  onChange={(e) => setEditingMember({ ...editingMember, year: e.target.value })}
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
                value={editingMember.btId || ""}
                onChange={(e) => setEditingMember({ ...editingMember, btId: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-amber-300 text-xs font-mono font-bold text-[#E78023] uppercase tracking-wider focus:outline-none focus:border-[#17458F]"
              />
              <p className="text-[10px] text-slate-500">
                When the student logs in with Google and enters this BT ID, their student pass and profile will automatically receive official council designation badging.
              </p>
            </div>

            {/* Category / Tier & Badge Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Category / Tier</label>
                <input
                  type="text"
                  placeholder="e.g. Presidency, Technical & Systems, Cultural..."
                  value={editingMember.level}
                  onChange={(e) => setEditingMember({ ...editingMember, level: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Official Badge / Sash ID</label>
                <input
                  type="text"
                  placeholder="e.g. 01, EXEC-01"
                  value={editingMember.badgeNumber || ""}
                  onChange={(e) => setEditingMember({ ...editingMember, badgeNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            {/* Email & LinkedIn */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Official College Email</label>
                <input
                  type="email"
                  placeholder="e.g. student@jdcoem.ac.in"
                  value={editingMember.email || ""}
                  onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">LinkedIn Profile URL</label>
                <input
                  type="text"
                  placeholder="https://linkedin.com/in/..."
                  value={editingMember.linkedin || ""}
                  onChange={(e) => setEditingMember({ ...editingMember, linkedin: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            {/* Avatar Photo Upload / URL */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="font-bold text-slate-700">
                Officer Avatar Photo (Auto-Compressed WebP)
              </label>
              
              <ImageUploadDropzone
                label="Drop Officer Portrait Here"
                sublabel="Converts phone/DSLR photo to high-res WebP"
                previewUrl={editingMember.avatar}
                onImageCompressed={(res) => {
                  setEditingMember({ ...editingMember, avatar: res.dataUrl });
                }}
              />

              <input
                type="text"
                placeholder="Or paste Direct Image URL..."
                value={editingMember.avatar}
                onChange={(e) => setEditingMember({ ...editingMember, avatar: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingMember(null);
                  setIsCreatingNew(false);
                }}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isCreatingNew ? "Create Position" : "Save Changes"}</span>
              </Button>
            </div>

          </form>
        </Modal>
      )}

    </div>
  );
}
