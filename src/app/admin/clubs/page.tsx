"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Hash,
  Loader2
} from "lucide-react";
import { getStoredClubs, saveStoredClubs, syncClubsFromFirestore, getClubLeaders } from "@/lib/councilStore";
import { compactClubDataset } from "@/lib/dataSyncEngine";
import { getStoredTenures, updateTenureRoster, syncTenuresFromFirestore, CouncilTenure } from "@/lib/tenureStore";
import { getStoredDepartments, syncDepartmentsFromFirestore, getDepartmentShortName } from "@/lib/departmentsStore";
import { mockClubs } from "@/data/clubs";
import { ClubItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";
import { cn } from "@/lib/utils";

export default function AdminClubsPage() {
  const [clubs, setClubs] = useState<ClubItem[]>([]);
  const [tenures, setTenures] = useState<CouncilTenure[]>([]);
  const [selectedTenureId, setSelectedTenureId] = useState<string>("");
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("All");
  const [editingClub, setEditingClub] = useState<ClubItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [modalTab, setModalTab] = useState<"identity" | "about" | "media">("identity");
  const [pendingUploads, setPendingUploads] = useState(0);

  const handleUploadStateChange = (uploading: boolean) => {
    setPendingUploads((prev) => Math.max(0, prev + (uploading ? 1 : -1)));
  };

  const loadData = () => {
    const tenureList = getStoredTenures();
    setTenures(tenureList);
    const active = tenureList.find((t) => t.isCurrent) || tenureList[0];
    const currentId = selectedTenureId && tenureList.some((t) => t.id === selectedTenureId)
      ? selectedTenureId
      : active?.id || "tenure-2025-26";
    setSelectedTenureId(currentId);

    // Always use stored active clubs roster as authoritative source of truth
    setClubs(getStoredClubs());
  };

  useEffect(() => {
    loadData();
    setDepartmentsList(getStoredDepartments());

    syncTenuresFromFirestore().then((res) => {
      if (res) loadData();
    });

    syncClubsFromFirestore().then((res) => {
      if (res && Array.isArray(res) && res.length > 0) {
        loadData();
        // Check and auto-compact any legacy oversized base64 images to free up Firestore space
        compactClubDataset(res).then((compacted) => {
          const oldLen = JSON.stringify(res).length;
          const newLen = JSON.stringify(compacted).length;
          if (oldLen > 250000 && newLen < oldLen) {
            saveStoredClubs(compacted);
          }
        });
      }
    });
    syncDepartmentsFromFirestore().then((res) => {
      if (res) setDepartmentsList(res);
    });

    const handleUpdate = () => loadData();
    window.addEventListener("src_tenures_updated", handleUpdate);
    window.addEventListener("src_clubs_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("src_tenures_updated", handleUpdate);
      window.removeEventListener("src_clubs_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [selectedTenureId]);

  const selectedTenure = tenures.find((t) => t.id === selectedTenureId) || tenures.find((t) => t.isCurrent) || tenures[0];
  const isDraftTenure = selectedTenure && !selectedTenure.isCurrent;

  const handleSelectTenure = (tId: string) => {
    setSelectedTenureId(tId);
    setClubs(getStoredClubs());
  };

  const saveList = async (updated: ClubItem[]) => {
    setClubs(updated);
    await saveStoredClubs(updated);
    if (selectedTenure?.id && !selectedTenure.isCurrent) {
      updateTenureRoster(selectedTenure.id, { clubs: updated });
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const domains = useMemo(() => ["All", ...Array.from(new Set(clubs.map((c) => c.category).filter(Boolean)))], [clubs]);

  const filteredClubs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return clubs.filter((club) => {
      const leaders = getClubLeaders(club);
      const matchesLeader = leaders.some((l) => l.name?.toLowerCase().includes(q) || l.department?.toLowerCase().includes(q));
      const matchesSearch =
        !q ||
        club.name?.toLowerCase().includes(q) ||
        club.description?.toLowerCase().includes(q) ||
        matchesLeader;
      const matchesDomain = selectedDomain === "All" || club.category === selectedDomain;
      return matchesSearch && matchesDomain;
    });
  }, [clubs, searchQuery, selectedDomain]);

  const handleOpenAddModal = () => {
    setIsCreatingNew(true);
    setModalTab("identity");
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
      cardImage: "",
      headerImage: "",
      logoImage: "",
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

    const defaultHero = editingClub.headerImage || editingClub.cardImage || editingClub.heroImage || "https://images.unsplash.com/photo-1547153760-18fc86324498?q=80&w=1600&auto=format&fit=crop";

    const clubToSave: ClubItem = {
      ...editingClub,
      slug: cleanSlug,
      heroImage: defaultHero,
      cardImage: editingClub.cardImage || defaultHero,
      headerImage: editingClub.headerImage || defaultHero,
      logoImage: editingClub.logoImage || "",
    };

    let updated: ClubItem[];
    if (isCreatingNew) {
      updated = [...clubs, clubToSave];
    } else {
      updated = clubs.map((c) => (c.id === clubToSave.id || c.slug === clubToSave.slug ? clubToSave : c));
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
            <span>Clubs directory updated successfully! {isDraftTenure ? `(Saved to draft session ${selectedTenure?.label})` : "(Published live across platform)"}</span>
          </div>
          <Link href="/clubs" target="_blank" className="text-emerald-700 underline font-bold uppercase tracking-wider">
            View Public Clubs Directory &rarr;
          </Link>
        </div>
      )}

      {/* Tenure Session Selector Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-heading font-extrabold text-[#0F172A] uppercase tracking-wider">
              TENURE SESSION:
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              (Assign Club Heads &amp; Co-Heads for upcoming or live tenure)
            </span>
          </div>
        </div>

        {/* Tenure Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {tenures.map((t) => {
            const isSelected = t.id === selectedTenureId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTenure(t.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                  isSelected
                    ? t.isCurrent
                      ? "bg-[#17458F] text-white border-[#17458F] shadow-sm"
                      : "bg-[#E78023] text-white border-[#E78023] shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>Tenure {t.label}</span>
                {t.isCurrent ? (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                    isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    ● LIVE
                  </span>
                ) : (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                    isSelected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"
                  }`}>
                    DRAFT
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isDraftTenure && selectedTenure && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] leading-relaxed">
            <span className="font-bold block text-amber-900 mb-0.5">
              Draft Mode: Pre-configuring Club Heads &amp; Co-Heads for Upcoming Tenure {selectedTenure.label}
            </span>
            Any leadership updates saved here are linked to Tenure {selectedTenure.label} and will go live automatically when this tenure is activated!
          </div>
        )}
      </div>

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

              <div className="flex items-center gap-3">
                {club.logoImage ? (
                  <div className="relative h-12 w-12 rounded-full overflow-hidden shrink-0 border border-slate-200 shadow-xs bg-slate-50">
                    <Image
                      src={club.logoImage}
                      alt={club.name}
                      fill
                      unoptimized={true}
                      className="object-cover w-full h-full rounded-full"
                    />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-[#17458F]/5 border border-[#17458F]/10 flex items-center justify-center shrink-0 text-[#E78023]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-bold text-lg text-[#0F172A] truncate">
                    {club.name}
                  </h3>
                  <p className="text-xs text-[#E78023] font-semibold truncate">
                    {club.tagline}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 font-medium line-clamp-2">
                {club.description}
              </p>
            </div>

            {/* Club Leadership Box */}
            {(() => {
              const leaders = getClubLeaders(club);
              const heads = leaders.filter(l => l.roleType === "lead" || !l.role.toLowerCase().includes("co-head"));
              const coHeads = leaders.filter(l => l.roleType === "coLead" || l.role.toLowerCase().includes("co-head"));

              return (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Club Head{heads.length > 1 ? "s" : ""}:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[150px]">
                      {heads.map(h => h.name).filter(Boolean).join(", ") || club.lead.name || "TBA"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Department:</span>
                    <span className="text-[#E78023] font-semibold truncate max-w-[140px]" title={club.lead.department}>
                      <span className="xl:hidden">{getDepartmentShortName(club.lead.department)}</span>
                      <span className="hidden xl:inline">{club.lead.department}</span>
                    </span>
                  </div>
                  {coHeads.length > 0 && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                      <span className="text-slate-500 font-medium">Co-Head{coHeads.length > 1 ? "s" : ""}:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                        {coHeads.map(c => c.name).filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end">
                    <Link
                      href="/admin/team"
                      className="text-[10px] text-[#17458F] font-bold hover:underline flex items-center gap-1"
                    >
                      <Users className="w-3 h-3 text-[#E78023]" />
                      <span>Edit in Team Members &rarr;</span>
                    </Link>
                  </div>
                </div>
              );
            })()}

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
                  setEditingClub({
                    ...club,
                    logoImage: club.logoImage || "",
                    cardImage: club.cardImage || "",
                    headerImage: club.headerImage || "",
                  });
                  setModalTab("identity");
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
          subtitle="Configure club identity, domain category, description, and visual assets."
          maxWidth="3xl"
        >
          <form onSubmit={handleSaveClub} className="flex flex-col h-full text-xs text-slate-900">
            
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
                <span>1. Identity & Domain</span>
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
                <span>2. About & Mission</span>
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
                <span>3. Banner & Media</span>
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
                      value={editingClub.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingClub((prev) => (prev ? { ...prev, name: val } : null));
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
                          onClick={() => setEditingClub((prev) => (prev ? { ...prev, category: cat } : null))}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                            editingClub.category === cat
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
                      value={editingClub.category}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingClub((prev) => (prev ? { ...prev, category: val } : null));
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
                      value={editingClub.tagline}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingClub((prev) => (prev ? { ...prev, tagline: val } : null));
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
                        value={editingClub.memberCount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditingClub((prev) => (prev ? { ...prev, memberCount: val } : null));
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#17458F]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-slate-800 text-xs">Chartered / Est. Year</label>
                      <input
                        type="text"
                        placeholder="e.g. 2024"
                        value={editingClub.established || "2024"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingClub((prev) => (prev ? { ...prev, established: val } : null));
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
                    value={editingClub.description}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingClub((prev) => (prev ? { ...prev, description: val } : null));
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
                    value={editingClub.mission}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingClub((prev) => (prev ? { ...prev, mission: val } : null));
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
                      recommendedSize="1200 x 675 px (16:9)"
                      storagePath="clubs/cards"
                      previewUrl={editingClub.cardImage}
                      onUploadStateChange={handleUploadStateChange}
                      onUrlChange={(url) => {
                        setEditingClub((prev) => (prev ? { ...prev, cardImage: url } : null));
                      }}
                    />
                  </div>

                  {/* 2. Hero Header Banner (21:9) */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                    <ImageUploadDropzone
                      label="2. Header Banner"
                      sublabel="Cinematic backdrop on /clubs/[slug]"
                      aspectRatio="21:9"
                      recommendedSize="1920 x 820 px (21:9)"
                      storagePath="clubs/headers"
                      previewUrl={editingClub.headerImage}
                      onUploadStateChange={handleUploadStateChange}
                      onUrlChange={(url) => {
                        setEditingClub((prev) => (prev ? { ...prev, headerImage: url } : null));
                      }}
                    />
                  </div>

                  {/* 3. Official Logo / Insignia (1:1) */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                    <ImageUploadDropzone
                      label="3. Official Club Logo"
                      sublabel="Circular insignia emblem (1:1)"
                      aspectRatio="1:1"
                      recommendedSize="500 x 500 px (Circle PNG)"
                      storagePath="clubs/logos"
                      previewUrl={editingClub.logoImage}
                      onUploadStateChange={handleUploadStateChange}
                      onUrlChange={(url) => {
                        setEditingClub((prev) => (prev ? { ...prev, logoImage: url } : null));
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
                  size="sm"
                  disabled={pendingUploads > 0}
                  className="gap-2 cursor-pointer shadow-md shadow-[#E78023]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pendingUploads > 0 ? (
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
      )}

    </div>
  );
}
