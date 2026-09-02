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
  Hash,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Loader2,
  Copy,
  History,
  Layers
} from "lucide-react";
import { 
  getStoredCouncilMembers, 
  saveStoredCouncilMembers,
  getStoredHostingCommittee, 
  saveStoredHostingCommittee,
  getStoredFoundingMembers,
  saveStoredFoundingMembers,
  syncFoundingToCouncilAdmins,
  getStoredClubs,
  saveStoredClubs,
  getClubLeaders,
  syncCouncilMembersFromFirestore,
  subscribeToCouncilMembers,
  syncHostingCommitteeFromFirestore,
  subscribeToHostingCommittee,
  syncFoundingMembersFromFirestore,
  subscribeToFoundingMembers,
  syncClubsFromFirestore,
  subscribeToClubs
} from "@/lib/councilStore";
import { 
  getStoredTenures, 
  saveStoredTenures, 
  getCurrentTenure, 
  switchActiveTenure, 
  updateTenureRoster,
  syncTenuresFromFirestore,
  CouncilTenure 
} from "@/lib/tenureStore";
import { getStoredDepartments, syncDepartmentsFromFirestore, getDepartmentShortName } from "@/lib/departmentsStore";
import { adminCouncilMembers, hostingCommitteeMembers, foundingMembers as defaultFoundingMembers } from "@/data/team";
import { TeamMember, ClubItem, ClubLeader } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";
import { cn } from "@/lib/utils";

type TeamCategoryTab = "council" | "hosting" | "founding" | "clubs";

export default function AdminTeamPage() {
  const [activeTab, setActiveTab] = useState<TeamCategoryTab>("council");
  const [tenures, setTenures] = useState<CouncilTenure[]>([]);
  const [selectedTenureId, setSelectedTenureId] = useState<string>("");
  const [councilMembers, setCouncilMembers] = useState<TeamMember[]>([]);
  const [hostingMembers, setHostingMembers] = useState<TeamMember[]>([]);
  const [foundingMembersList, setFoundingMembersList] = useState<TeamMember[]>([]);
  const [clubsList, setClubsList] = useState<ClubItem[]>([]);
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);

  // Copy positions from past tenure state
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceTenureId, setCopySourceTenureId] = useState<string>("");
  const [copyMode, setCopyMode] = useState<"appointees" | "full">("appointees");
  const [copyIncludeHosting, setCopyIncludeHosting] = useState<boolean>(true);

  const handleUploadStateChange = (uploading: boolean) => {
    setPendingUploads((prev) => Math.max(0, prev + (uploading ? 1 : -1)));
  };

  const handleExecuteCopyPositions = (sourceId?: string, mode?: "appointees" | "full", includeHosting?: boolean) => {
    const sId = sourceId || copySourceTenureId;
    const m = mode || copyMode;
    const incHost = includeHosting !== undefined ? includeHosting : copyIncludeHosting;

    const sourceTenure = tenures.find((t) => t.id === sId) || tenures.find((t) => t.isCurrent) || tenures[0];
    if (!sourceTenure || !selectedTenure) return;

    // Get source council list
    let rawCouncil: TeamMember[] = [];
    if (sourceTenure.isCurrent) {
      rawCouncil = getStoredCouncilMembers();
    } else if (sourceTenure.adminCouncil && sourceTenure.adminCouncil.length > 0) {
      rawCouncil = sourceTenure.adminCouncil;
    } else {
      rawCouncil = adminCouncilMembers;
    }

    // Get source hosting list
    let rawHosting: TeamMember[] = [];
    if (sourceTenure.isCurrent) {
      rawHosting = getStoredHostingCommittee();
    } else if (sourceTenure.hostingCommittee && sourceTenure.hostingCommittee.length > 0) {
      rawHosting = sourceTenure.hostingCommittee;
    } else {
      rawHosting = hostingCommitteeMembers;
    }

    if (!Array.isArray(rawCouncil) || rawCouncil.length === 0) {
      alert("No positions found in selected tenure to copy.");
      return;
    }

    const newCouncil: TeamMember[] = rawCouncil.map((member, idx) => {
      const cleanRoleSlug = (member.role || "officer").toLowerCase().replace(/[^a-z0-9]/g, "-");
      const newId = `admin-${selectedTenure.label.replace(/[^a-zA-Z0-9]/g, "_")}-${cleanRoleSlug}-${idx + 1}_${Date.now()}`;
      
      if (m === "appointees") {
        return {
          ...member,
          id: newId,
          name: `${member.role} (Appointee)`,
          bio: `Council officer representing ${member.role} for the ${selectedTenure.label} tenure.`,
          email: `${cleanRoleSlug.replace(/-/g, "")}@jdcoem.ac.in`,
          order: idx + 1,
        };
      } else {
        return {
          ...member,
          id: newId,
          order: idx + 1,
        };
      }
    });

    const newHosting: TeamMember[] = incHost && rawHosting.length > 0
      ? rawHosting.map((member, idx) => {
          const cleanRoleSlug = (member.role || "member").toLowerCase().replace(/[^a-z0-9]/g, "-");
          const newId = `hosting-${selectedTenure.label.replace(/[^a-zA-Z0-9]/g, "_")}-${cleanRoleSlug}-${idx + 1}_${Date.now()}`;
          if (m === "appointees") {
            return {
              ...member,
              id: newId,
              name: `${member.role || "Committee Member"} (Appointee)`,
              order: idx + 1,
            };
          } else {
            return {
              ...member,
              id: newId,
              order: idx + 1,
            };
          }
        })
      : (selectedTenure.hostingCommittee || []);

    // Apply to state
    setCouncilMembers(newCouncil);
    if (incHost) {
      setHostingMembers(newHosting);
    }

    // Save to draft tenure store
    const updatePayload: Partial<CouncilTenure> = {
      adminCouncil: newCouncil,
      ...(incHost ? { hostingCommittee: newHosting } : {})
    };

    updateTenureRoster(selectedTenure.id, updatePayload);

    setTenures((prev) => prev.map((t) => t.id === selectedTenure.id ? {
      ...t,
      ...updatePayload
    } : t));

    setIsCopyModalOpen(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 4000);
  };

  const loadData = () => {
    const list = getStoredTenures();
    setTenures(list);
    const active = list.find((t) => t.isCurrent) || list[0];
    
    // Check URL query param for direct tenure navigation (e.g. /admin/team?tenure=xyz)
    const urlParams = new URLSearchParams(window.location.search);
    const urlTenureId = urlParams.get("tenure");
    
    // Priority: URL param > already selected > active tenure > default
    let currentId: string;
    if (urlTenureId && list.some((t) => t.id === urlTenureId)) {
      currentId = urlTenureId;
    } else if (selectedTenureId && list.some((t) => t.id === selectedTenureId)) {
      currentId = selectedTenureId;
    } else {
      currentId = active?.id || "tenure-2025-26";
    }
      
    setSelectedTenureId(currentId);

    const targetTenure = list.find((t) => t.id === currentId) || active;
    const isFirst = targetTenure?.id === "tenure-2025-26" || targetTenure?.label?.includes("2025") || targetTenure?.tenureNumber?.includes("1st");
    if (targetTenure?.isCurrent) {
      setCouncilMembers(getStoredCouncilMembers());
      setHostingMembers(getStoredHostingCommittee());
      setFoundingMembersList(isFirst ? getStoredFoundingMembers() : []);
    } else if (targetTenure) {
      setCouncilMembers(targetTenure.adminCouncil || []);
      setHostingMembers(targetTenure.hostingCommittee || []);
      setFoundingMembersList(isFirst ? (targetTenure.foundingMembers || getStoredFoundingMembers()) : []);
    }

    setClubsList(getStoredClubs());
  };

  useEffect(() => {
    loadData();
    setDepartmentsList(getStoredDepartments());

    syncTenuresFromFirestore().then((res) => {
      if (res) loadData();
    });
    syncCouncilMembersFromFirestore().then((res) => {
      if (res) loadData();
    });
    syncHostingCommitteeFromFirestore().then((res) => {
      if (res) loadData();
    });
    syncFoundingMembersFromFirestore().then((res) => {
      if (res) loadData();
    });
    syncClubsFromFirestore().then((res) => {
      if (res) setClubsList(res);
    });
    syncDepartmentsFromFirestore().then((res) => {
      if (res) setDepartmentsList(res);
    });

    const unsubClubs = subscribeToClubs((updated) => {
      setClubsList(updated);
    });

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener("src_tenures_updated", handleUpdate);
    window.addEventListener("src_tenure_changed", handleUpdate);
    window.addEventListener("src_council_team_updated", handleUpdate);
    window.addEventListener("src_hosting_updated", handleUpdate);
    window.addEventListener("src_founding_members_updated", handleUpdate);
    window.addEventListener("src_clubs_updated", handleUpdate);

    return () => {
      unsubClubs();
      window.removeEventListener("src_tenures_updated", handleUpdate);
      window.removeEventListener("src_tenure_changed", handleUpdate);
      window.removeEventListener("src_council_team_updated", handleUpdate);
      window.removeEventListener("src_hosting_updated", handleUpdate);
      window.removeEventListener("src_founding_members_updated", handleUpdate);
      window.removeEventListener("src_clubs_updated", handleUpdate);
    };
  }, [selectedTenureId]);

  const selectedTenure = tenures.find((t) => t.id === selectedTenureId) || tenures.find((t) => t.isCurrent) || tenures[0];
  const isDraftTenure = selectedTenure && !selectedTenure.isCurrent;
  const isFirstTenure = selectedTenure?.id === "tenure-2025-26" || selectedTenure?.label?.includes("2025") || selectedTenure?.tenureNumber?.includes("1st");

  useEffect(() => {
    if (!isFirstTenure && activeTab === "founding") {
      setActiveTab("council");
    }
  }, [isFirstTenure, activeTab]);

  const handleSelectTenure = (tId: string) => {
    setSelectedTenureId(tId);
    const targetTenure = tenures.find((t) => t.id === tId);
    const isFirst = targetTenure?.id === "tenure-2025-26" || targetTenure?.label?.includes("2025") || targetTenure?.tenureNumber?.includes("1st");
    if (targetTenure?.isCurrent) {
      setCouncilMembers(getStoredCouncilMembers());
      setHostingMembers(getStoredHostingCommittee());
      setFoundingMembersList(isFirst ? getStoredFoundingMembers() : []);
    } else if (targetTenure) {
      setCouncilMembers(targetTenure.adminCouncil || []);
      setHostingMembers(targetTenure.hostingCommittee || []);
      setFoundingMembersList(isFirst ? (targetTenure.foundingMembers || getStoredFoundingMembers()) : []);
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tenure", tId);
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Convert clubs to editable team member items
  const clubLeadMembers = React.useMemo(() => {
    const list: (TeamMember & { clubId: string; roleType: "lead" | "coLead"; clubName: string })[] = [];
    clubsList.forEach((club, clubIndex) => {
      const leaders = getClubLeaders(club);
      leaders.forEach((leader, leaderIndex) => {
        const isCoLead = leader.roleType === "coLead" || (leader.role && leader.role.toLowerCase().includes("co-head"));
        list.push({
          id: leader.id || `${club.id || club.slug}-leader-${leaderIndex}`,
          name: leader.name || "",
          role: leader.role || (isCoLead ? `${club.name} Co-Head` : `${club.name} Head`),
          clubSlug: club.slug,
          clubId: club.id,
          clubName: club.name,
          roleType: isCoLead ? "coLead" : "lead",
          department: leader.department || "Computer Science & Engineering",
          year: leader.year || (isCoLead ? "3rd Year" : "4th Year"),
          avatar: leader.avatar || (isCoLead ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop" : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop"),
          bio: leader.bio || "",
          email: leader.email || "",
          linkedin: leader.linkedin || "",
          btId: leader.btId || "",
          order: clubIndex * 10 + leaderIndex + 1
        });
      });
    });
    return list;
  }, [clubsList]);

  // Determine current active list
  const currentMembers = 
    activeTab === "council" 
      ? councilMembers 
      : activeTab === "hosting"
      ? hostingMembers
      : activeTab === "founding"
      ? foundingMembersList
      : clubLeadMembers;

  const saveCurrentList = (updated: TeamMember[]) => {
    if (activeTab === "clubs") return;

    // Re-index all orders to guarantee strict sequential 1..N order
    const indexed = updated.map((m, idx) => ({
      ...m,
      order: idx + 1
    }));

    if (activeTab === "council") {
      setCouncilMembers(indexed);
    } else if (activeTab === "hosting") {
      setHostingMembers(indexed);
    } else if (activeTab === "founding") {
      setFoundingMembersList(indexed);
    }

    if (selectedTenure?.isCurrent) {
      // Live active tenure
      if (activeTab === "council") {
        saveStoredCouncilMembers(indexed);
      } else if (activeTab === "hosting") {
        saveStoredHostingCommittee(indexed);
      } else if (activeTab === "founding") {
        saveStoredFoundingMembers(indexed);
      }
    } else if (selectedTenure) {
      // Draft / upcoming tenure: save to draft tenure record
      updateTenureRoster(selectedTenure.id, {
        [activeTab === "council" ? "adminCouncil" : activeTab === "hosting" ? "hostingCommittee" : "foundingMembers"]: indexed
      });
      setTenures((prev) => prev.map((t) => t.id === selectedTenure.id ? {
        ...t,
        [activeTab === "council" ? "adminCouncil" : activeTab === "hosting" ? "hostingCommittee" : "foundingMembers"]: indexed
      } : t));
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleSyncFromFounding = () => {
    const listToSync = foundingMembersList.length > 0 ? foundingMembersList : getStoredFoundingMembers();
    if (!Array.isArray(listToSync) || listToSync.length === 0) {
      alert("No founding members found to sync.");
      return;
    }
    const synced = syncFoundingToCouncilAdmins(listToSync);
    setCouncilMembers(synced);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleMoveMember = (memberId: string, direction: "up" | "down") => {
    if (activeTab === "clubs") return;
    const currentIndex = currentMembers.findIndex((m) => m.id === memberId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentMembers.length) return;

    const newMembers = [...currentMembers];
    const [moved] = newMembers.splice(currentIndex, 1);
    newMembers.splice(targetIndex, 0, moved);

    saveCurrentList(newMembers);
  };

  const filteredMembers = currentMembers.filter(
    (m) =>
      (m.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.role || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.department || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenAddModal = () => {
    setIsCreatingNew(true);
    if (activeTab === "clubs") {
      const firstClub = clubsList[0];
      setEditingMember({
        id: `leader-${Date.now()}`,
        name: "",
        role: firstClub ? `${firstClub.name} Co-Head` : "Club Co-Head",
        clubId: firstClub?.id || "",
        clubSlug: firstClub?.slug || "",
        clubName: firstClub?.name || "",
        roleType: "coLead",
        department: "Computer Science & Engineering",
        year: "3rd Year",
        bio: "",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
        order: currentMembers.length + 1,
        email: "",
        linkedin: "",
        btId: ""
      } as any);
    } else {
      setEditingMember({
        id: `member-${Date.now()}`,
        name: "",
        role: "",
        department: "Computer Science and Engineering",
        year: "4th Year",
        bio: "",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
        order: currentMembers.length + 1,
        email: "",
        linkedin: "",
        btId: ""
      });
    }
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    if (!editingMember.name.trim()) {
      alert("Please provide the Student Full Name.");
      return;
    }
    if (activeTab !== "clubs" && !editingMember.role.trim()) {
      alert("Please provide a Position / Role Title.");
      return;
    }

    if (activeTab === "clubs") {
      const match = clubLeadMembers.find((m) => m.id === editingMember.id);
      const targetClubId = (editingMember as any).clubId || match?.clubId;
      const targetRoleType: "lead" | "coLead" = (editingMember as any).roleType || match?.roleType || "lead";

      if (!targetClubId) {
        alert("Please select a chartered club.");
        return;
      }

      const updatedClubs = clubsList.map((club) => {
        if (club.id === targetClubId || club.slug === targetClubId) {
          const currentLeaders = getClubLeaders(club);
          const leaderPayload: ClubLeader = {
            id: editingMember.id,
            name: editingMember.name,
            role: targetRoleType === "coLead" ? `${club.name} Co-Head` : `${club.name} Head`,
            roleType: targetRoleType,
            department: editingMember.department,
            year: editingMember.year || (targetRoleType === "lead" ? "4th Year" : "3rd Year"),
            avatar: editingMember.avatar,
            bio: editingMember.bio || "",
            email: editingMember.email || "",
            linkedin: editingMember.linkedin || "",
            btId: editingMember.btId || ""
          };

          let newLeaders: ClubLeader[];
          if (isCreatingNew) {
            newLeaders = [...currentLeaders, leaderPayload];
          } else {
            const existingIdx = currentLeaders.findIndex((l) => l.id === editingMember.id);
            if (existingIdx !== -1) {
              newLeaders = [...currentLeaders];
              newLeaders[existingIdx] = leaderPayload;
            } else {
              newLeaders = [...currentLeaders, leaderPayload];
            }
          }

          const primaryLead = newLeaders.find((l) => l.roleType === "lead") || newLeaders[0] || leaderPayload;
          const coLeadsList = newLeaders.filter((l) => l.roleType === "coLead");

          return {
            ...club,
            leaders: newLeaders,
            lead: primaryLead,
            coLead: coLeadsList[0] || undefined,
            coLeads: coLeadsList
          };
        } else if (match && (club.id === match.clubId || club.slug === match.clubSlug) && club.id !== targetClubId) {
          // If member was switched to a different club
          const currentLeaders = getClubLeaders(club).filter((l) => l.id !== editingMember.id);
          const primaryLead = currentLeaders.find((l) => l.roleType === "lead") || currentLeaders[0] || club.lead;
          const coLeadsList = currentLeaders.filter((l) => l.roleType === "coLead");

          return {
            ...club,
            leaders: currentLeaders,
            lead: primaryLead,
            coLead: coLeadsList[0] || undefined,
            coLeads: coLeadsList
          };
        }
        return club;
      });

      setClubsList(updatedClubs);
      saveStoredClubs(updatedClubs);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
      setEditingMember(null);
      setIsCreatingNew(false);
      return;
    }

    const maxRank = currentMembers.length + (isCreatingNew ? 1 : 0);
    const targetRank = Math.max(1, Math.min(editingMember.order || maxRank, maxRank));

    let updated: TeamMember[];
    if (isCreatingNew) {
      const listWithoutNew = [...currentMembers];
      listWithoutNew.splice(targetRank - 1, 0, { ...editingMember, order: targetRank });
      updated = listWithoutNew;
    } else {
      const listFiltered = currentMembers.filter((m) => m.id !== editingMember.id);
      listFiltered.splice(targetRank - 1, 0, { ...editingMember, order: targetRank });
      updated = listFiltered;
    }

    saveCurrentList(updated);
    setEditingMember(null);
    setIsCreatingNew(false);
  };

  const handleDeleteMember = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name || "this member"}?`)) return;

    if (activeTab === "clubs") {
      const match = clubLeadMembers.find((m) => m.id === id);
      if (match) {
        const updatedClubs = clubsList.map((club) => {
          if (club.id === match.clubId || club.slug === match.clubSlug) {
            const currentLeaders = getClubLeaders(club).filter((l) => l.id !== id);
            const primaryLead = currentLeaders.find((l) => l.roleType === "lead") || currentLeaders[0] || {
              name: "",
              role: `${club.name} Head`,
              department: "Computer Science & Engineering",
              year: "4th Year",
              avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop"
            };
            const coLeadsList = currentLeaders.filter((l) => l.roleType === "coLead");

            return {
              ...club,
              leaders: currentLeaders,
              lead: primaryLead,
              coLead: coLeadsList[0] || undefined,
              coLeads: coLeadsList
            };
          }
          return club;
        });

        setClubsList(updatedClubs);
        saveStoredClubs(updatedClubs);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
        return;
      }
    }

    const updated = currentMembers.filter((m) => m.id !== id);
    saveCurrentList(updated);
  };

  const handleResetDefaults = () => {
    if (confirm("Reset roster to default templates?")) {
      if (isFirstTenure) {
        if (activeTab === "council") {
          saveCurrentList(adminCouncilMembers);
        } else if (activeTab === "hosting") {
          saveCurrentList(hostingCommitteeMembers);
        } else {
          saveCurrentList(defaultFoundingMembers);
        }
      } else {
        if (activeTab === "council") {
          saveCurrentList([
            {
              id: `admin-${selectedTenure?.label || "draft"}-mentor`,
              name: "Mentor (Appointee)",
              role: "Mentor",
              department: "Computer Science and Engineering",
              year: "4th Year",
              avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
              bio: `Guiding ${selectedTenure?.label} institutional oversight and council governance.`,
              email: "mentor@jdcoem.ac.in",
              order: 1
            },
            {
              id: `admin-${selectedTenure?.label || "draft"}-president`,
              name: "President (Appointee)",
              role: "President",
              department: "Artificial Intelligence Engineering",
              year: "4th Year",
              avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
              bio: `Presiding over the ${selectedTenure?.label} Student Representative Council.`,
              email: "president@jdcoem.ac.in",
              order: 2
            },
            {
              id: `admin-${selectedTenure?.label || "draft"}-vp`,
              name: "Vice President (Appointee)",
              role: "Vice President",
              department: "Information Technology",
              year: "4th Year",
              avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
              bio: `Executive coordination and student council operations for ${selectedTenure?.label}.`,
              email: "vp@jdcoem.ac.in",
              order: 3
            }
          ]);
        } else {
          saveCurrentList([]);
        }
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
          {isDraftTenure && (
            <button
              type="button"
              onClick={() => {
                const past = tenures.find((t) => t.id !== selectedTenure?.id);
                if (past) setCopySourceTenureId(past.id);
                setIsCopyModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Copy positions and structure from past tenure"
            >
              <Copy className="w-3.5 h-3.5 text-[#E78023]" />
              <span>Copy Past Positions</span>
            </button>
          )}

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
            <span>{activeTab === "clubs" ? "Add Club Head / Co-Head" : "Add New Position / Officer"}</span>
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
            <span>Council team changes saved successfully! {isDraftTenure ? `(Saved to draft session ${selectedTenure?.label})` : "(Published live to website)"}</span>
          </div>
          <Link href="/team" target="_blank" className="text-emerald-700 underline font-bold uppercase tracking-wider">
            View Live Public Team Page &rarr;
          </Link>
        </div>
      )}

      {/* Tenure Session Selector Bar */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-heading font-extrabold text-[#0F172A] uppercase tracking-wider">
              SELECT TENURE SESSION:
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              (Switch between live roster and draft sessions)
            </span>
          </div>

          <Link
            href="/admin/tenures"
            className="text-[11px] font-bold text-slate-500 hover:text-[#17458F] flex items-center gap-1 transition-colors"
          >
            <span>Manage Tenures &rarr;</span>
          </Link>
        </div>

        {/* Tenure Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {tenures.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelectTenure(t.id)}
              className={cn(
                "px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border",
                selectedTenureId === t.id
                  ? "bg-[#17458F] text-white border-[#17458F] shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              )}
            >
              <span>{t.tenureNumber ? `${t.tenureNumber} (${t.label})` : `Tenure ${t.label}`}</span>
              {t.isCurrent && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase">
                  Live
                </span>
              )}
              {!t.isCurrent && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase">
                  Draft
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Banner if editing an upcoming draft tenure */}
        {isDraftTenure && selectedTenure && (
          <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-r from-amber-50 to-orange-50/60 border border-amber-200/80 text-amber-950 text-xs shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider">
                    Draft Session
                  </span>
                  <span className="font-heading font-extrabold text-sm text-[#0F172A]">
                    {selectedTenure.tenureNumber || "Upcoming"} ({selectedTenure.label})
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed max-w-2xl">
                  You are staging positions for <strong>{selectedTenure.academicYear}</strong>. All additions, edits, and hierarchy adjustments are safely isolated in this draft until you activate it.
                </p>
              </div>

              {/* Action Buttons inside Draft Banner */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const past = tenures.find((t) => t.id !== selectedTenure.id);
                    if (past) setCopySourceTenureId(past.id);
                    setIsCopyModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-amber-300 text-amber-900 font-extrabold text-xs transition-all shadow-xs hover:shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Copy Positions from Past Tenure</span>
                </button>

                <Link
                  href="/admin/tenures"
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition-colors shadow-xs hover:shadow-sm cursor-pointer flex items-center gap-1"
                >
                  <span>Activate Tenure &rarr;</span>
                </Link>
              </div>
            </div>

            {/* Quick 1-Click Import Helper */}
            <div className="pt-2.5 border-t border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-amber-900">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                <span>Save time: One-click import copies all 13 official council roles (Secretary, Tech Affairs, Cultural, etc.) ready for editing.</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  const pastTenure = tenures.find((t) => t.isCurrent) || tenures.find((t) => t.id !== selectedTenure.id);
                  if (pastTenure && confirm(`Import all 13 positions from ${pastTenure.label} into this draft? You can then edit student names, photos, and credentials.`)) {
                    handleExecuteCopyPositions(pastTenure.id, "appointees", true);
                  }
                }}
                className="font-extrabold text-[#E78023] hover:text-[#D26E17] hover:underline cursor-pointer flex items-center gap-1 self-start sm:self-auto shrink-0"
              >
                <span>1-Click Import from 1st Tenure (2025-26) &rarr;</span>
              </button>
            </div>
          </div>
        )}
      </div>

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
          <span>Admins ({councilMembers.length})</span>
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

        {isFirstTenure && (
          <button
            onClick={() => setActiveTab("founding")}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "founding"
                ? "bg-[#17458F] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#E78023]" />
            <span>Founding Members ({foundingMembersList.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("clubs")}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "clubs"
              ? "bg-[#17458F] text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Users className="w-4 h-4 text-[#E78023]" />
          <span>Club Heads &amp; Co-Heads ({clubLeadMembers.length})</span>
        </button>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab === "clubs" ? "club leadership" : activeTab} members by name, position, department...`}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F] shadow-xs"
          />
        </div>

        {isFirstTenure && activeTab === "council" && (
          <button
            type="button"
            onClick={handleSyncFromFounding}
            className="px-4 py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs"
            title="Sync 2025-26 Council Admins with Founding Members list"
          >
            <Sparkles className="w-4 h-4 text-[#E78023]" />
            <span>Sync from Founding Members ({foundingMembersList.length})</span>
          </button>
        )}
      </div>

      {/* Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredMembers.map((member) => {
          const actualIndex = currentMembers.findIndex((m) => m.id === member.id);
          return (
            <div
              key={member.id}
              className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-[#17458F]/30 transition-all flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {activeTab === "clubs" ? (
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1",
                        (member as any).roleType === "coLead" || member.role.toLowerCase().includes("co-head")
                          ? "bg-[#17458F]/10 text-[#17458F]"
                          : "bg-[#E78023]/10 text-[#E78023]"
                      )}>
                        <Sparkles className="w-3 h-3" />
                        {(member as any).clubName 
                          ? `${(member as any).clubName} • ${(member as any).roleType === "coLead" || member.role.toLowerCase().includes("co-head") ? "CO-HEAD" : "HEAD"}`
                          : (member.role.toLowerCase().includes("co-head") ? "CLUB CO-HEAD" : "CLUB HEAD")}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-[#17458F]/10 text-[#17458F]">
                        Rank #{actualIndex + 1}
                      </span>
                    )}
                  </div>

                  {/* Move Up / Down Buttons (Admins & Council) */}
                  {activeTab !== "clubs" && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveMember(member.id, "up")}
                        disabled={actualIndex === 0 || !!searchQuery}
                        className="p-1 rounded-md bg-slate-100 hover:bg-[#17458F] text-slate-600 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Move Up in Hierarchy"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveMember(member.id, "down")}
                        disabled={actualIndex === currentMembers.length - 1 || !!searchQuery}
                        className="p-1 rounded-md bg-slate-100 hover:bg-[#17458F] text-slate-600 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Move Down in Hierarchy"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Photo & Name */}
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                    <Image
                      src={member.avatar}
                      alt={member.name}
                      fill
                      unoptimized={true}
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
                    <p className="text-[11px] text-slate-500 font-medium truncate" title={member.department}>
                      <span className="lg:hidden">{getDepartmentShortName(member.department)}</span>
                      <span className="hidden lg:inline">{member.department}</span>
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
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDeleteMember(member.id, member.name)}
                    className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                    title={activeTab === "clubs" ? "Remove Club Head / Co-Head" : "Remove Position / Officer"}
                    aria-label="Delete position"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {activeTab === "clubs" && (member as any).clubSlug && (
                    <Link
                      href={`/clubs/${(member as any).clubSlug}`}
                      target="_blank"
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase transition-colors"
                    >
                      View Club
                    </Link>
                  )}
                </div>

                <button
                  onClick={() => {
                    setIsCreatingNew(false);
                    setEditingMember({
                      ...member,
                      order: actualIndex + 1
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#17458F] hover:bg-[#0E2F66] text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredMembers.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
          <Users className="w-8 h-8 text-[#E78023] mx-auto opacity-70" />
          <h4 className="font-bold text-base text-slate-800">No positions found</h4>
          <p className="text-xs text-slate-500">
            Click &ldquo;{activeTab === "clubs" ? "Add Club Head / Co-Head" : "Add New Position / Officer"}&rdquo; to create your first team record.
          </p>
          <Button onClick={handleOpenAddModal} variant="primary" size="sm" className="mt-2">
            + {activeTab === "clubs" ? "Add Club Head / Co-Head" : "Add Position / Officer"}
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
          title={
            activeTab === "clubs"
              ? isCreatingNew
                ? "Add Club Head / Co-Head"
                : `Edit Club Leader: ${editingMember.name || "Leader"}`
              : isCreatingNew
              ? "Add New Council Position & Officer"
              : `Edit: ${editingMember.role || "Position"}`
          }
          subtitle={
            activeTab === "clubs"
              ? "Crop & upload avatar photo (PFP), student credentials, and BT ID for this chartered society."
              : "Configure position title, student officer credentials, hierarchy rank, and photo."
          }
          maxWidth="lg"
        >
          <form onSubmit={handleSaveMember} className="space-y-5 text-xs text-slate-900">
            
            {/* Club Name Dropdown Menu (When in Club Leadership tab) */}
            {activeTab === "clubs" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-2xl bg-[#17458F]/5 border border-[#17458F]/15">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
                    <span>Select Chartered Club <span className="text-rose-500">*</span></span>
                  </label>
                  <select
                    value={(editingMember as any).clubId || (editingMember as any).clubSlug || ""}
                    onChange={(e) => {
                      const selectedClub = clubsList.find((c) => c.id === e.target.value || c.slug === e.target.value);
                      if (selectedClub) {
                        const currentRoleType = (editingMember as any).roleType || "lead";
                        setEditingMember({
                          ...editingMember,
                          clubId: selectedClub.id,
                          clubSlug: selectedClub.slug,
                          clubName: selectedClub.name,
                          role: currentRoleType === "lead" ? `${selectedClub.name} Head` : `${selectedClub.name} Co-Head`
                        } as any);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  >
                    {clubsList.map((c) => (
                      <option key={c.id || c.slug} value={c.id || c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 text-xs">
                    Leadership Tier <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={(editingMember as any).roleType || "lead"}
                    onChange={(e) => {
                      const newRoleType = e.target.value as "lead" | "coLead";
                      const currentClubName = (editingMember as any).clubName || "Club";
                      setEditingMember({
                        ...editingMember,
                        roleType: newRoleType,
                        role: newRoleType === "lead" ? `${currentClubName} Head` : `${currentClubName} Co-Head`
                      } as any);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#17458F]"
                  >
                    <option value="lead">Club Head</option>
                    <option value="coLead">Club Co-Head</option>
                  </select>
                </div>
              </div>
            )}

            {/* Position Title & Member Name */}
            {activeTab !== "clubs" ? (
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
            ) : (
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
            )}

            {/* Hierarchy Rank (Only for Council & Admins) */}
            {activeTab !== "clubs" && (
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Hierarchy Priority / Rank #</span>
                  <span className="text-[10px] text-slate-400">1 = Highest (Top of Roster Page)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={currentMembers.length + (isCreatingNew ? 1 : 0)}
                  value={editingMember.order || 1}
                  onChange={(e) => setEditingMember({ ...editingMember, order: parseInt(e.target.value) || 1 })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-[#17458F] focus:outline-none focus:border-[#17458F]"
                />
              </div>
            )}

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
                {activeTab === "clubs" ? "Club Head / Co-Head Portrait Photo (PFP)" : "Officer Avatar Photo (Auto-Compressed WebP)"}
              </label>
              
              <ImageUploadDropzone
                label={activeTab === "clubs" ? "Club Head / Co-Head Portrait Photo" : "Officer Portrait / Headshot"}
                sublabel="Crop, zoom & frame headshot to square (1:1)"
                aspectRatio="1:1"
                recommendedSize="600 x 600 px (1:1)"
                storagePath={activeTab === "clubs" ? "clubs/leads" : "team/avatars"}
                previewUrl={editingMember.avatar}
                onUploadStateChange={handleUploadStateChange}
                onUrlChange={(url) => {
                  setEditingMember((prev) => prev ? { ...prev, avatar: url } : null);
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div>
                {!isCreatingNew && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      if (editingMember) {
                        const memberToDelete = editingMember;
                        setEditingMember(null);
                        handleDeleteMember(memberToDelete.id, memberToDelete.name);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Position</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
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
                  disabled={pendingUploads > 0}
                  className="gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pendingUploads > 0 ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Uploading ({pendingUploads})...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{isCreatingNew ? "Create Position" : "Save Changes"}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

          </form>
        </Modal>
      )}

      {/* Copy Positions from Past Tenure Modal */}
      {isCopyModalOpen && (
        <Modal
          isOpen={isCopyModalOpen}
          onClose={() => setIsCopyModalOpen(false)}
          title="Import Positions from Past Tenure"
          subtitle={`Copy official council positions, hierarchy rank ordering, and roles into ${selectedTenure?.label || "this draft tenure"}.`}
          maxWidth="lg"
        >
          <div className="space-y-5">
            {/* Step 1: Select Source Tenure */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#17458F]" />
                <span>1. Select Source Past Tenure to Copy From</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                {tenures
                  .filter((t) => t.id !== selectedTenure?.id)
                  .map((t) => {
                    const councilCount = t.isCurrent 
                      ? getStoredCouncilMembers().length 
                      : (t.adminCouncil?.length || 13);
                    const hostingCount = t.isCurrent 
                      ? getStoredHostingCommittee().length 
                      : (t.hostingCommittee?.length || 0);
                    const isSelected = (copySourceTenureId || (t.isCurrent ? t.id : "")) === t.id;

                    return (
                      <div
                        key={t.id}
                        onClick={() => setCopySourceTenureId(t.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-[#17458F]/5 border-[#17458F] ring-2 ring-[#17458F]/20"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-[#17458F] bg-[#17458F]" : "border-slate-300 bg-white"
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-heading font-extrabold text-xs text-[#0F172A]">
                                {t.tenureNumber || "Tenure"} ({t.label})
                              </span>
                              {t.isCurrent && (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase">
                                  Live Roster
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {t.academicYear} • {councilCount} Admin Roles {hostingCount > 0 ? `• ${hostingCount} Hosting Members` : ""}
                            </p>
                          </div>
                        </div>
                        <Badge variant="navy" size="sm">
                          {councilCount} Positions
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Step 2: Choose Import Strategy */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#E78023]" />
                <span>2. Choose Copy &amp; Import Strategy</span>
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Mode A: Clean Appointees */}
                <div
                  onClick={() => setCopyMode("appointees")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    copyMode === "appointees"
                      ? "bg-[#E78023]/5 border-[#E78023] ring-2 ring-[#E78023]/20"
                      : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-extrabold text-xs text-[#0F172A]">
                      Clean Appointees (Recommended)
                    </span>
                    <span className="text-[10px] font-bold text-[#E78023] bg-[#E78023]/10 px-2 py-0.5 rounded-full">
                      New Batch
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Imports the exact official position titles (Secretary, Tech Affairs, Cultural, etc.), department recommendations, and ranks with clean appointee placeholders ready for appointing the new batch.
                  </p>
                </div>

                {/* Mode B: Full Duplicate */}
                <div
                  onClick={() => setCopyMode("full")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    copyMode === "full"
                      ? "bg-[#17458F]/5 border-[#17458F] ring-2 ring-[#17458F]/20"
                      : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-extrabold text-xs text-[#0F172A]">
                      Full Duplicate Template
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                      Keep Details
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Copies all past members with their existing names and credentials as starting templates, allowing you to click &quot;Edit Details&quot; to swap names and photos.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Include Hosting Committee */}
            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={copyIncludeHosting}
                onChange={(e) => setCopyIncludeHosting(e.target.checked)}
                className="w-4 h-4 rounded text-[#17458F] focus:ring-[#17458F] cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-800">
                Also copy Hosting Committee positions (if any exist in source tenure)
              </span>
            </label>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsCopyModalOpen(false)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => handleExecuteCopyPositions()}
                className="gap-2 bg-[#E78023] hover:bg-[#D26E17] text-white font-extrabold shadow-md hover:shadow-lg transition-all"
              >
                <Copy className="w-4 h-4" />
                <span>Import Positions to {selectedTenure?.label || "Draft"}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
