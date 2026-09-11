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
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from "lucide-react";
import { getStoredClubs, saveStoredClubs, syncClubsFromFirestore, getClubLeaders } from "@/lib/councilStore";
import { reconcileAllUserDesignations } from "@/lib/usersStore";
import { compactClubDataset } from "@/lib/dataSyncEngine";
import { 
  getStoredTenures, 
  updateTenureRoster, 
  syncTenuresFromFirestore, 
  getStoredDraftClubs,
  saveStoredDraftClubs,
  syncDraftClubsFromFirestore,
  CouncilTenure 
} from "@/lib/tenureStore";
import { getStoredDepartments, syncDepartmentsFromFirestore, getDepartmentShortName } from "@/lib/departmentsStore";
import { mockClubs } from "@/data/clubs";
import { ClubItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";
import { ClubFormModal } from "@/components/admin/clubs/ClubFormModal";
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
  const [isSavingList, setIsSavingList] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);

  const handleUploadStateChange = (uploading: boolean) => {
    setPendingUploads((prev) => Math.max(0, prev + (uploading ? 1 : -1)));
  };

  const getClubsForTenure = (t?: CouncilTenure, tenureList?: CouncilTenure[]): ClubItem[] => {
    const list = tenureList || tenures;
    const target = t || list.find((item) => item.id === selectedTenureId) || list.find((item) => item.isCurrent) || list[0];
    if (!target || target.isCurrent) {
      return getStoredClubs();
    }
    // Draft session: check dedicated draft clubs store first
    const draftClubs = getStoredDraftClubs(target.id);
    if (draftClubs && Array.isArray(draftClubs) && draftClubs.length > 0) {
      return draftClubs;
    }
    // Check if tenure snapshot has clubs assigned
    if (target.clubs && Array.isArray(target.clubs) && target.clubs.length > 0) {
      return target.clubs;
    }
    // First-time opening draft session: initialize isolated draft copy from live clubs
    const liveClubs = getStoredClubs();
    if (liveClubs && liveClubs.length > 0) {
      saveStoredDraftClubs(target.id, liveClubs);
      return liveClubs;
    }
    return mockClubs;
  };

  const loadData = () => {
    const tenureList = getStoredTenures();
    setTenures(tenureList);
    const active = tenureList.find((t) => t.isCurrent) || tenureList[0];
    const currentId = selectedTenureId && tenureList.some((t) => t.id === selectedTenureId)
      ? selectedTenureId
      : active?.id || "tenure-2025-26";
    setSelectedTenureId(currentId);

    const targetTenure = tenureList.find((t) => t.id === currentId) || active;
    setClubs(getClubsForTenure(targetTenure, tenureList));
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
      }
    });

    if (selectedTenureId) {
      const allTenures = getStoredTenures();
      const target = allTenures.find((t) => t.id === selectedTenureId);
      if (target && !target.isCurrent) {
        syncDraftClubsFromFirestore(selectedTenureId).then((res) => {
          if (res && Array.isArray(res) && res.length > 0) {
            setClubs(res);
          }
        });
      }
    }

    syncDepartmentsFromFirestore().then((res) => {
      if (res) setDepartmentsList(res);
    });

    const handleUpdate = () => loadData();
    const handleDraftClubsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.tenureId === selectedTenureId) {
        loadData();
      }
    };

    window.addEventListener("src_tenures_updated", handleUpdate);
    window.addEventListener("src_clubs_updated", handleUpdate);
    window.addEventListener("src_draft_clubs_updated", handleDraftClubsUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("src_tenures_updated", handleUpdate);
      window.removeEventListener("src_clubs_updated", handleUpdate);
      window.removeEventListener("src_draft_clubs_updated", handleDraftClubsUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [selectedTenureId]);

  const selectedTenure = tenures.find((t) => t.id === selectedTenureId) || tenures.find((t) => t.isCurrent) || tenures[0];
  const isDraftTenure = selectedTenure && !selectedTenure.isCurrent;

  const handleSelectTenure = (tId: string) => {
    setSelectedTenureId(tId);
    const targetTenure = tenures.find((t) => t.id === tId);
    setClubs(getClubsForTenure(targetTenure));
    if (targetTenure && !targetTenure.isCurrent) {
      syncDraftClubsFromFirestore(tId).then((res) => {
        if (res && Array.isArray(res) && res.length > 0) {
          setClubs(res);
        }
      });
    }
  };

  const saveList = async (updated: ClubItem[]) => {
    setIsSavingList(true);
    try {
      setClubs(updated);
      if (selectedTenure?.isCurrent) {
        // LIVE TENURE: Persist to live clubs store (localStorage & Firestore site_content/clubs)
        await saveStoredClubs(updated);
        updateTenureRoster(selectedTenure.id, { clubs: updated });
      } else if (selectedTenure) {
        // DRAFT SESSION: Strictly isolated to draft tenure! NEVER touch live stores!
        await saveStoredDraftClubs(selectedTenure.id, updated);
        updateTenureRoster(selectedTenure.id, { clubs: updated });
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save clubs:", error);
      alert("⚠️ Cloud Save Error: Could not save changes to cloud database. Please check your internet connection and try again.");
      throw error;
    } finally {
      setIsSavingList(false);
    }
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

  const isFiltering = !!searchQuery.trim() || selectedDomain !== "All";

  const handleOpenAddModal = () => {
    setIsCreatingNew(true);
    const rand = Math.random().toString(36).substring(2, 7);
    setEditingClub({
      id: `club-${Date.now()}-${rand}`,
      slug: `club-${Date.now()}-${rand}`,
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
        avatar: ""
      },
      coLead: {
        name: "",
        role: "Club Co-Head",
        department: "Artificial Intelligence & Data Science",
        year: "3rd Year",
        avatar: ""
      },
      upcomingEvents: [],
      pastHighlights: [],
      galleryImages: []
    });
  };

  const handleSaveClub = async (clubOverride?: ClubItem, e?: React.FormEvent) => {
    if (e?.preventDefault) e.preventDefault();
    const club = clubOverride || editingClub;
    if (!club) return;

    if (!club.name.trim()) {
      alert("Please provide a Club Name.");
      return;
    }

    // Auto generate clean slug from name if new
    const cleanSlug = isCreatingNew
      ? club.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : club.slug;

    const defaultHero = club.headerImage || club.cardImage || club.heroImage || "https://images.unsplash.com/photo-1547153760-18fc86324498?q=80&w=1600&auto=format&fit=crop";

    const clubToSave: ClubItem = {
      ...club,
      slug: cleanSlug,
      heroImage: defaultHero,
      cardImage: club.cardImage || defaultHero,
      headerImage: club.headerImage || defaultHero,
      logoImage: club.logoImage || "",
    };

    let updated: ClubItem[];
    if (isCreatingNew) {
      updated = [...clubs, clubToSave];
    } else {
      updated = clubs.map((c) => (c.id === clubToSave.id ? clubToSave : c));
    }

    try {
      await saveList(updated);
      setEditingClub(null);
      setIsCreatingNew(false);
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteClub = (id: string, name: string) => {
    const isDraft = selectedTenure && !selectedTenure.isCurrent;
    const confirmMsg = isDraft
      ? `Are you sure you want to remove "${name || "this club"}" from DRAFT session "${selectedTenure.label}"?\n\nAll associated Club Heads and Co-Heads will also be removed.\n(Note: The live platform and current tenure will NOT be affected.)`
      : `Are you sure you want to delete "${name || "this club"}" from the LIVE clubs directory?\n\nAll associated Club Heads and Co-Heads will also be removed.`;

    if (confirm(confirmMsg)) {
      const deletedClub = clubs.find((c) => c.id === id);
      let updated = clubs.filter((c) => c.id !== id);

      // Cascade-clean: remove stale clubIds/clubSlugs/clubNames references to the deleted club
      // from leaders embedded in remaining clubs (handles multi-club head scenarios)
      if (deletedClub) {
        updated = updated.map((club) => {
          if (!Array.isArray(club.leaders) || club.leaders.length === 0) return club;
          const cleanedLeaders = club.leaders.map((leader) => {
            if (!leader.clubIds && !leader.clubSlugs && !leader.clubNames) return leader;
            return {
              ...leader,
              clubIds: (leader.clubIds || []).filter((cid: string) => cid !== id && cid !== deletedClub.slug),
              clubSlugs: (leader.clubSlugs || []).filter((cs: string) => cs !== deletedClub.slug),
              clubNames: (leader.clubNames || []).filter((cn: string) => cn !== deletedClub.name),
            };
          });
          return { ...club, leaders: cleanedLeaders };
        });
      }

      saveList(updated);

      // Reconcile user designation badges: clears stale "X Club Head" / "X Club Co-Head" badges
      // for users who were heads of the deleted club (only for live tenure mutations)
      if (!isDraft) {
        reconcileAllUserDesignations().catch(() => {});
      }
    }
  };

  const handleMoveClub = (clubId: string, direction: "up" | "down") => {
    const currentIndex = clubs.findIndex((c) => c.id === clubId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= clubs.length) return;

    const updated = [...clubs];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);

    // Keep explicit order property in sync
    const resequenced = updated.map((c, idx) => ({
      ...c,
      order: idx + 1,
    }));

    saveList(resequenced);
  };

  const handleResetDefaults = () => {
    const isDraft = selectedTenure && !selectedTenure.isCurrent;
    const confirmMsg = isDraft
      ? `Reset DRAFT session "${selectedTenure.label}" clubs directory to default templates? (Live tenure will remain untouched)`
      : `Reset LIVE clubs directory to default templates?`;

    if (confirm(confirmMsg)) {
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
      {isFiltering && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <span className="flex items-center gap-1.5 font-medium">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-600" />
            <span>Filtering is active. Clear search or select &ldquo;All&rdquo; domains to adjust club sequence.</span>
          </span>
          <button
            onClick={() => { setSearchQuery(""); setSelectedDomain("All"); }}
            className="text-xs font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClubs.map((club) => {
          const actualIndex = clubs.findIndex((c) => c.id === club.id);

          return (
            <div
              key={club.id}
              className="p-6 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F]/30 transition-all flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200/80 text-slate-700 font-mono font-bold text-xs" 
                      title={`Sequence Position #${actualIndex + 1}`}
                    >
                      #{actualIndex + 1}
                    </span>
                    <Badge variant="navy" size="sm">
                      {club.category}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Sequence Reorder Controls (Top) */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleMoveClub(club.id, "up")}
                        disabled={actualIndex === 0 || isFiltering}
                        className="p-1 rounded-md text-slate-600 hover:text-white hover:bg-[#17458F] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                        title={isFiltering ? "Clear filter to adjust sequence" : `Move Earlier in Sequence (#${actualIndex})`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveClub(club.id, "down")}
                        disabled={actualIndex === clubs.length - 1 || isFiltering}
                        className="p-1 rounded-md text-slate-600 hover:text-white hover:bg-[#17458F] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                        title={isFiltering ? "Clear filter to adjust sequence" : `Move Later in Sequence (#${actualIndex + 2})`}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                      <Users className="w-3.5 h-3.5 text-[#E78023]" />
                      <span>{club.memberCount} Members</span>
                    </span>
                  </div>
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
                      <span className="font-bold text-slate-900 truncate max-w-[170px]" title={heads.map(h => h.role ? `${h.name} (${h.role})` : h.name).join(", ")}>
                        {heads.map(h => h.name).filter(Boolean).join(", ") || club.lead.name || "TBA"}
                      </span>
                    </div>
                    {heads.some(h => (h.clubNames && h.clubNames.length > 1) || (h.clubIds && h.clubIds.length > 1)) && (
                      <div className="flex items-center justify-between text-[10px] text-[#17458F] bg-blue-50/70 px-2 py-0.5 rounded-md border border-blue-200/60">
                        <span className="font-semibold">Joint Head:</span>
                        <span className="truncate max-w-[140px] font-bold">
                          {heads.find(h => (h.clubNames && h.clubNames.length > 1) || (h.clubIds && h.clubIds.length > 1))?.role || "Multi-Club Head"}
                        </span>
                      </div>
                    )}
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
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase transition-colors"
                  >
                    View Page
                  </Link>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Sequence Reorder Controls (Toolbar) */}
                  <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleMoveClub(club.id, "up")}
                      disabled={actualIndex === 0 || isFiltering}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-[#17458F] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                      title={isFiltering ? "Clear filter to adjust sequence" : "Move Up in Sequence"}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveClub(club.id, "down")}
                      disabled={actualIndex === clubs.length - 1 || isFiltering}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-[#17458F] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                      title={isFiltering ? "Clear filter to adjust sequence" : "Move Down in Sequence"}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
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
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#17458F] hover:bg-[#0E2F66] text-white text-[11px] font-bold uppercase transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Club</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
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
      <ClubFormModal
        isOpen={!!editingClub}
        onClose={() => {
          setEditingClub(null);
          setIsCreatingNew(false);
        }}
        initialClub={editingClub}
        isCreatingNew={isCreatingNew}
        pendingUploads={pendingUploads}
        onUploadStateChange={handleUploadStateChange}
        onSave={(updatedClub) => handleSaveClub(updatedClub)}
      />

    </div>
  );
}
