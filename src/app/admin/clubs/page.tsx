"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Sparkles, 
  Users, 
  Plus,
  Search,
  Edit3, 
  Trash2,
  Calendar, 
  ArrowRight, 
  ShieldCheck, 
  ExternalLink,
  RotateCcw,
  Eye,
  CheckCircle2,
  Save,
  Layers,
  Hash
} from "lucide-react";
import { getStoredClubs, saveStoredClubs, syncClubsFromFirestore } from "@/lib/councilStore";
import { getStoredDepartments, syncDepartmentsFromFirestore } from "@/lib/departmentsStore";
import { mockClubs } from "@/data/clubs";
import { ClubItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";

export default function AdminClubsPage() {
  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("All");
  const [editingClub, setEditingClub] = useState<ClubItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setClubs(getStoredClubs());
    setDepartmentsList(getStoredDepartments());

    syncClubsFromFirestore().then((res) => {
      if (res) setClubs(res);
    });
    syncDepartmentsFromFirestore().then((res) => {
      if (res) setDepartmentsList(res);
    });
  }, []);

  const saveList = (updated: ClubItem[]) => {
    setClubs(updated);
    saveStoredClubs(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const domains = ["All", ...Array.from(new Set(clubs.map((c) => c.category).filter(Boolean)))];

  const filteredClubs = clubs.filter((club) => {
    const matchesSearch =
      club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.lead.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain = selectedDomain === "All" || club.category === selectedDomain;
    return matchesSearch && matchesDomain;
  });

  const handleOpenAddModal = () => {
    setIsCreatingNew(true);
    setEditingClub({
      id: `club-${Date.now()}`,
      slug: `club-${Date.now()}`,
      name: "",
      tagline: "",
      category: "Cultural",
      description: "",
      mission: "",
      iconName: "Sparkles",
      memberCount: 25,
      established: "2024",
      heroImage: "https://images.unsplash.com/photo-1547153760-18fc86324498?q=80&w=1600&auto=format&fit=crop",
      lead: {
        name: "",
        role: "Club Head",
        department: "Computer Science & Engineering",
        year: "4th Year",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop"
      },
      coLead: {
        name: "",
        role: "Club Co-Head",
        department: "Artificial Intelligence & Data Science",
        year: "3rd Year",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop"
      },
      upcomingEvents: [],
      pastHighlights: [],
      galleryImages: []
    });
  };

  const handleSaveClub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClub) return;

    if (!editingClub.name.trim()) {
      alert("Please provide a Club Name.");
      return;
    }

    // Auto generate clean slug from name if new
    const cleanSlug = isCreatingNew
      ? editingClub.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : editingClub.slug;

    const clubToSave: ClubItem = {
      ...editingClub,
      slug: cleanSlug,
    };

    let updated: ClubItem[];
    if (isCreatingNew) {
      updated = [...clubs, clubToSave];
    } else {
      updated = clubs.map((c) => (c.id === clubToSave.id ? clubToSave : c));
    }

    saveList(updated);
    setEditingClub(null);
    setIsCreatingNew(false);
  };

  const handleDeleteClub = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name || "this club"}" from the directory?`)) {
      const updated = clubs.filter((c) => c.id !== id);
      saveList(updated);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("Reset clubs directory to default templates?")) {
      saveList(mockClubs);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight font-heading">
              CLUBS DIRECTORY STUDIO
            </h1>
            <Badge variant="orange" size="sm">
              {clubs.length} CHARTERED CLUBS
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Create, edit, and manage all chartered student clubs, domain categories, taglines, and leadership rosters.
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
            <span>Add New Club</span>
          </Button>

          <Link
            href="/clubs"
            target="_blank"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Preview Live /clubs Page in New Tab"
          >
            <Eye className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Clubs directory updated and published live across the platform!</span>
          </div>
          <Link href="/clubs" target="_blank" className="text-emerald-700 underline font-bold uppercase tracking-wider">
            View Public Clubs Directory &rarr;
          </Link>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clubs by name, description, or club head..."
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
            Category:
          </span>
          {domains.map((domain) => (
            <button
              key={domain}
              onClick={() => setSelectedDomain(domain)}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                selectedDomain === domain
                  ? "bg-[#E78023] text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {domain}
            </button>
          ))}
        </div>
      </div>

      {/* Clubs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClubs.map((club) => (
          <div
            key={club.id}
            className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F]/30 transition-all flex flex-col justify-between space-y-4 shadow-xs"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="navy" size="sm">
                  {club.category}
                </Badge>
                <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                  <Users className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>{club.memberCount} Members</span>
                </span>
              </div>

              <div>
                <h3 className="font-bold text-lg text-[#0F172A]">
                  {club.name}
                </h3>
                <p className="text-xs text-[#E78023] font-semibold">
                  {club.tagline}
                </p>
              </div>

              <p className="text-xs text-slate-600 font-medium line-clamp-2">
                {club.description}
              </p>
            </div>

            {/* Club Leadership Box */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Club Head:</span>
                <span className="font-bold text-slate-900">{club.lead.name || "TBA"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Department:</span>
                <span className="text-[#E78023] font-semibold">{club.lead.department}</span>
              </div>
              {club.coLead?.name && (
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-medium">Co-Head:</span>
                  <span className="font-semibold text-slate-800">{club.coLead.name}</span>
                </div>
              )}
            </div>

            {/* Actions Toolbar */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDeleteClub(club.id, club.name)}
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Delete Club"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Link
                  href={`/clubs/${club.slug}`}
                  target="_blank"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase transition-colors"
                >
                  View Page
                </Link>
              </div>

              <button
                onClick={() => {
                  setIsCreatingNew(false);
                  setEditingClub(club);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#17458F] hover:bg-[#0E2F66] text-white text-[11px] font-bold uppercase transition-colors cursor-pointer shadow-xs flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Club</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredClubs.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
          <Layers className="w-8 h-8 text-[#E78023] mx-auto opacity-70" />
          <h4 className="font-bold text-base text-slate-800">No clubs found</h4>
          <p className="text-xs text-slate-500">
            Click &ldquo;Add New Club&rdquo; to create a new chartered society.
          </p>
          <Button onClick={handleOpenAddModal} variant="primary" size="sm" className="mt-2">
            + Add New Club
          </Button>
        </div>
      )}

      {/* EDIT / CREATE CLUB MODAL */}
      {editingClub && (
        <Modal
          isOpen={!!editingClub}
          onClose={() => {
            setEditingClub(null);
            setIsCreatingNew(false);
          }}
          title={isCreatingNew ? "Charter New Student Club" : `Edit: ${editingClub.name || "Club"}`}
          subtitle="Configure club identity, category, leadership officers, and mission statement."
          maxWidth="3xl"
        >
          <form onSubmit={handleSaveClub} className="space-y-6 text-xs text-slate-900 pt-1">
            
            {/* 1. Basic Club Information Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-[#E78023]" />
                <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-800">
                  General Club Identity
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">
                    Club Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AI & Robotics Club, Dance Club..."
                    value={editingClub.name}
                    onChange={(e) => setEditingClub({ ...editingClub, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">
                    Domain / Category <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cultural, Technical, Creative & Media, Sports..."
                    value={editingClub.category}
                    onChange={(e) => setEditingClub({ ...editingClub, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="font-bold text-slate-700">Club Tagline / Motto</label>
                  <input
                    type="text"
                    placeholder="e.g. Rhythm in Motion, Passion on Stage"
                    value={editingClub.tagline}
                    onChange={(e) => setEditingClub({ ...editingClub, tagline: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Active Member Count</label>
                  <input
                    type="number"
                    placeholder="e.g. 50"
                    value={editingClub.memberCount}
                    onChange={(e) => setEditingClub({ ...editingClub, memberCount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>
              </div>
            </div>

            {/* 2. Description & Mission Statements Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">About Description</label>
                  <textarea
                    rows={3}
                    placeholder="Brief summary of club purpose, auditions, and campus activities..."
                    value={editingClub.description}
                    onChange={(e) => setEditingClub({ ...editingClub, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Club Mission Statement</label>
                  <textarea
                    rows={3}
                    placeholder="Official student mission statement and long-term goals..."
                    value={editingClub.mission}
                    onChange={(e) => setEditingClub({ ...editingClub, mission: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 3. Primary Club Head Leadership Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#17458F]" />
                  <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-800">
                    Primary Club Head
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Lead Official
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Student Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Priya Deshmukh"
                    value={editingClub.lead.name}
                    onChange={(e) => setEditingClub({
                      ...editingClub,
                      lead: { ...editingClub.lead, name: e.target.value }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Designation Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Club Head"
                    value={editingClub.lead.role}
                    onChange={(e) => setEditingClub({
                      ...editingClub,
                      lead: { ...editingClub.lead, role: e.target.value }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Department / Branch</label>
                  <input
                    type="text"
                    list="club-lead-depts-list"
                    placeholder="e.g. Computer Science & Engineering"
                    value={editingClub.lead.department}
                    onChange={(e) => setEditingClub({
                      ...editingClub,
                      lead: { ...editingClub.lead, department: e.target.value }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                  <datalist id="club-lead-depts-list">
                    {departmentsList.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#E78023] flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      <span>College BT ID (Badge Sync)</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. BT22CSE012"
                    value={editingClub.lead.btId || ""}
                    onChange={(e) => setEditingClub({
                      ...editingClub,
                      lead: { ...editingClub.lead, btId: e.target.value.toUpperCase() }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-amber-50/50 border border-amber-300 text-xs font-mono font-bold text-[#E78023] uppercase tracking-wider focus:outline-none focus:border-[#17458F]"
                  />
                </div>
              </div>
            </div>

            {/* 4. Club Co-Head Leadership Card (Optional) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#E78023]" />
                  <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-800">
                    Club Co-Head (Optional)
                  </h4>
                </div>
                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Secondary Officer
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Student Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rohan Joshi"
                    value={editingClub.coLead?.name || ""}
                    onChange={(e) => setEditingClub({
                      ...editingClub,
                      coLead: {
                        name: e.target.value,
                        role: editingClub.coLead?.role || "Club Co-Head",
                        department: editingClub.coLead?.department || "Information Technology",
                        year: editingClub.coLead?.year || "3rd Year",
                        avatar: editingClub.coLead?.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop",
                        btId: editingClub.coLead?.btId || ""
                      }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Designation Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Club Co-Head"
                    value={editingClub.coLead?.role || ""}
                    onChange={(e) => setEditingClub({
                      ...editingClub,
                      coLead: {
                        ...(editingClub.coLead || {
                          name: "",
                          department: "",
                          year: "3rd Year",
                          avatar: ""
                        }),
                        role: e.target.value
                      }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Department / Branch</label>
                  <input
                    type="text"
                    list="club-colead-depts-list"
                    placeholder="e.g. Artificial Intelligence & Data Science"
                    value={editingClub.coLead?.department || ""}
                    onChange={(e) => setEditingClub({
                      ...editingClub,
                      coLead: {
                        ...(editingClub.coLead || {
                          name: "",
                          role: "Club Co-Head",
                          year: "3rd Year",
                          avatar: ""
                        }),
                        department: e.target.value
                      }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
                  />
                  <datalist id="club-colead-depts-list">
                    {departmentsList.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#E78023] flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      <span>College BT ID (Badge Sync)</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. BT23IT009"
                    value={editingClub.coLead?.btId || ""}
                    onChange={(e) => setEditingClub({
                      ...editingClub,
                      coLead: {
                        ...(editingClub.coLead || {
                          name: "",
                          role: "Club Co-Head",
                          department: "",
                          year: "3rd Year",
                          avatar: ""
                        }),
                        btId: e.target.value.toUpperCase()
                      }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-amber-50/50 border border-amber-300 text-xs font-mono font-bold text-[#E78023] uppercase tracking-wider focus:outline-none focus:border-[#17458F]"
                  />
                </div>
              </div>
            </div>

            {/* 5. Club Hero Backdrop Image Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
              <label className="font-bold text-slate-700 block">Club Hero Backdrop Image</label>
              <ImageUploadDropzone
                label="Drop Club Banner Photo Here"
                sublabel="Optimizes club hero images to high-res WebP"
                previewUrl={editingClub.heroImage}
                onImageCompressed={(res) => {
                  setEditingClub({ ...editingClub, heroImage: res.dataUrl });
                }}
              />
              <input
                type="text"
                placeholder="Or paste Direct Image URL..."
                value={editingClub.heroImage}
                onChange={(e) => setEditingClub({ ...editingClub, heroImage: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 focus:outline-none focus:border-[#17458F]"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setEditingClub(null);
                  setIsCreatingNew(false);
                }}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="gap-2 cursor-pointer shadow-md shadow-[#E78023]/20"
              >
                <Save className="w-4 h-4" />
                <span>{isCreatingNew ? "Charter Club" : "Save Changes"}</span>
              </Button>
            </div>

          </form>
        </Modal>
      )}

    </div>
  );
}
