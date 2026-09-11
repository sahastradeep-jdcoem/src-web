"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Layers,
  GraduationCap,
  Award
} from "lucide-react";
import { 
  getStoredCouncilMembers, 
  saveStoredCouncilMembers,
  getStoredHostingCommittee, 
  saveStoredHostingCommittee,
  getStoredFoundingMembers,
  saveStoredFoundingMembers,
  syncFoundingToCouncilAdmins,
  syncCouncilAdminsToFounding,
  reconcileCouncilAndFoundingSync,
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
  subscribeToClubs,
  getStoredInstitutionalPillars,
  saveStoredInstitutionalPillars,
  syncInstitutionalPillarsFromFirestore,
  subscribeToInstitutionalPillars
} from "@/lib/councilStore";
import { 
  getStoredTenures, 
  saveStoredTenures, 
  getCurrentTenure, 
  switchActiveTenure, 
  updateTenureRoster,
  syncTenuresFromFirestore,
  getStoredDraftCouncil,
  saveStoredDraftCouncil,
  getStoredDraftHosting,
  saveStoredDraftHosting,
  getStoredDraftClubs,
  saveStoredDraftClubs,
  syncDraftClubsFromFirestore,
  CouncilTenure 
} from "@/lib/tenureStore";
import { getStoredDepartments, syncDepartmentsFromFirestore, getDepartmentShortName } from "@/lib/departmentsStore";
import { adminCouncilMembers, hostingCommitteeMembers, foundingMembers as defaultFoundingMembers } from "@/data/team";
import { TeamMember, ClubItem, ClubLeader, InstitutionalPillar } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";
import { PositionFormModal } from "@/components/admin/team/PositionFormModal";
import { cn } from "@/lib/utils";

type TeamCategoryTab = "council" | "hosting" | "founding" | "clubs" | "pillars";

export default function AdminTeamPage() {
  const [activeTab, setActiveTab] = useState<TeamCategoryTab>("council");
  const [tenures, setTenures] = useState<CouncilTenure[]>([]);
  const [selectedTenureId, setSelectedTenureId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTenureId = urlParams.get("tenure");
      if (urlTenureId) return urlTenureId;
      const saved = sessionStorage.getItem("src_admin_selected_tenure");
      if (saved) return saved;
    }
    return "";
  });
  const [councilMembers, setCouncilMembers] = useState<TeamMember[]>([]);
  const [hostingMembers, setHostingMembers] = useState<TeamMember[]>([]);
  const [foundingMembersList, setFoundingMembersList] = useState<TeamMember[]>([]);
  const [clubsList, setClubsList] = useState<ClubItem[]>([]);
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [pillarsList, setPillarsList] = useState<InstitutionalPillar[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const isSavingRef = useRef(false);

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
          bio: "",
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

    // Save to dedicated draft stores immediately (bulletproof persistence across refresh)
    saveStoredDraftCouncil(selectedTenure.id, newCouncil);
    if (incHost) {
      saveStoredDraftHosting(selectedTenure.id, newHosting);
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

    if (typeof window !== "undefined") {
      sessionStorage.setItem("src_admin_selected_tenure", selectedTenure.id);
      const url = new URL(window.location.href);
      url.searchParams.set("tenure", selectedTenure.id);
      window.history.replaceState({}, "", url.toString());
    }

    setIsCopyModalOpen(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 4000);
  };

  const loadData = () => {
    const list = getStoredTenures();
    setTenures(list);
    const active = list.find((t) => t.isCurrent) || list[0];
    
    // Check URL query param and sessionStorage for direct tenure navigation (e.g. /admin/team?tenure=xyz)
    const urlParams = new URLSearchParams(window.location.search);
    const urlTenureId = urlParams.get("tenure");
    const savedTenureId = typeof window !== "undefined" ? sessionStorage.getItem("src_admin_selected_tenure") : null;
    
    // Priority: URL param > saved in session > already selected in state > active tenure > default
    let currentId: string;
    if (urlTenureId && list.some((t) => t.id === urlTenureId)) {
      currentId = urlTenureId;
    } else if (savedTenureId && list.some((t) => t.id === savedTenureId)) {
      currentId = savedTenureId;
    } else if (selectedTenureId && list.some((t) => t.id === selectedTenureId)) {
      currentId = selectedTenureId;
    } else {
      currentId = active?.id || "tenure-2025-26";
    }
      
    if (selectedTenureId !== currentId) {
      setSelectedTenureId(currentId);
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("src_admin_selected_tenure", currentId);
    }

    const targetTenure = list.find((t) => t.id === currentId) || active;
    const isFirst = targetTenure?.id === "tenure-2025-26" || targetTenure?.label?.includes("2025") || targetTenure?.tenureNumber?.includes("1st");
    if (targetTenure?.isCurrent) {
      const storedCouncil = getStoredCouncilMembers();
      let storedFounders = isFirst ? getStoredFoundingMembers() : [];
      if (isFirst && storedCouncil.length > 0 && storedCouncil.length !== storedFounders.length) {
        storedFounders = syncCouncilAdminsToFounding(storedCouncil, true);
      }
      setCouncilMembers(storedCouncil);
      setHostingMembers(getStoredHostingCommittee());
      setFoundingMembersList(storedFounders);
    } else if (targetTenure) {
      const draftCouncil = getStoredDraftCouncil(targetTenure.id);
      const draftHosting = getStoredDraftHosting(targetTenure.id);
      const councilList = draftCouncil.length > 0 ? draftCouncil : (targetTenure.adminCouncil || []);
      let founderList = isFirst ? (targetTenure.foundingMembers || getStoredFoundingMembers()) : [];
      if (isFirst && councilList.length > 0 && councilList.length !== founderList.length) {
        founderList = syncCouncilAdminsToFounding(councilList, true);
      }
      setCouncilMembers(councilList);
      setHostingMembers(draftHosting.length > 0 ? draftHosting : (targetTenure.hostingCommittee || []));
      setFoundingMembersList(founderList);
    }

    if (targetTenure?.isCurrent) {
      setClubsList(getStoredClubs());
    } else if (targetTenure) {
      const draftClubs = getStoredDraftClubs(targetTenure.id);
      setClubsList(draftClubs.length > 0 ? draftClubs : (targetTenure.clubs && targetTenure.clubs.length > 0 ? targetTenure.clubs : getStoredClubs()));
    } else {
      setClubsList(getStoredClubs());
    }
    setPillarsList(getStoredInstitutionalPillars());
  };

  useEffect(() => {
    loadData();
    setDepartmentsList(getStoredDepartments());

    syncTenuresFromFirestore().then((res) => {
      if (res && !isSavingRef.current) loadData();
    });
    syncCouncilMembersFromFirestore().then((res) => {
      if (res && !isSavingRef.current) loadData();
    });
    syncHostingCommitteeFromFirestore().then((res) => {
      if (res && !isSavingRef.current) loadData();
    });
    syncFoundingMembersFromFirestore().then((res) => {
      if (res && !isSavingRef.current) loadData();
    });
    syncClubsFromFirestore().then((res) => {
      if (res && !isSavingRef.current) setClubsList(res);
    });

    if (selectedTenureId) {
      const allTenures = getStoredTenures();
      const target = allTenures.find((t) => t.id === selectedTenureId);
      if (target && !target.isCurrent) {
        syncDraftClubsFromFirestore(selectedTenureId).then((res) => {
          if (res && Array.isArray(res) && res.length > 0 && !isSavingRef.current) {
            setClubsList(res);
          }
        });
      }
    }

    syncDepartmentsFromFirestore().then((res) => {
      if (res) setDepartmentsList(res);
    });
    syncInstitutionalPillarsFromFirestore().then((res) => {
      if (res && res.length > 0 && !isSavingRef.current) setPillarsList(res);
    });

    const unsubCouncil = subscribeToCouncilMembers((remote) => {
      if (isSavingRef.current) return;
      const allTenures = getStoredTenures();
      const cur = allTenures.find((t) => t.id === (selectedTenureId || "tenure-2025-26"));
      if (!cur || cur.isCurrent) {
        setCouncilMembers(remote);
      }
    });
    const unsubHosting = subscribeToHostingCommittee((remote) => {
      if (isSavingRef.current) return;
      const allTenures = getStoredTenures();
      const cur = allTenures.find((t) => t.id === (selectedTenureId || "tenure-2025-26"));
      if (!cur || cur.isCurrent) {
        setHostingMembers(remote);
      }
    });
    const unsubFounders = subscribeToFoundingMembers((remote) => {
      if (isSavingRef.current) return;
      const allTenures = getStoredTenures();
      const cur = allTenures.find((t) => t.id === (selectedTenureId || "tenure-2025-26"));
      const isFirst = !cur || cur.id === "tenure-2025-26" || cur.label?.includes("2025");
      if (isFirst) {
        setFoundingMembersList(remote);
      }
    });
    const unsubClubs = subscribeToClubs((updated) => {
      if (isSavingRef.current) return;
      if (!selectedTenure || selectedTenure.isCurrent) {
        setClubsList(updated);
      }
    });
    const unsubPillars = subscribeToInstitutionalPillars((updated) => {
      if (isSavingRef.current) return;
      if (updated && updated.length > 0) setPillarsList(updated);
    });

    let updateTimer: NodeJS.Timeout;
    const handleUpdate = () => {
      if (isSavingRef.current) return;
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        if (!isSavingRef.current) {
          loadData();
        }
      }, 50);
    };

    const handleDraftClubsUpdate = (e: Event) => {
      if (isSavingRef.current) return;
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.tenureId === selectedTenureId) {
        clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
          if (!isSavingRef.current) {
            loadData();
          }
        }, 50);
      }
    };

    window.addEventListener("src_tenures_updated", handleUpdate);
    window.addEventListener("src_tenure_changed", handleUpdate);
    window.addEventListener("src_council_team_updated", handleUpdate);
    window.addEventListener("src_hosting_updated", handleUpdate);
    window.addEventListener("src_founding_members_updated", handleUpdate);
    window.addEventListener("src_clubs_updated", handleUpdate);
    window.addEventListener("src_draft_clubs_updated", handleDraftClubsUpdate);
    window.addEventListener("src_pillars_updated", handleUpdate);

    return () => {
      clearTimeout(updateTimer);
      unsubCouncil();
      unsubHosting();
      unsubFounders();
      unsubClubs();
      unsubPillars();
      window.removeEventListener("src_tenures_updated", handleUpdate);
      window.removeEventListener("src_tenure_changed", handleUpdate);
      window.removeEventListener("src_council_team_updated", handleUpdate);
      window.removeEventListener("src_hosting_updated", handleUpdate);
      window.removeEventListener("src_founding_members_updated", handleUpdate);
      window.removeEventListener("src_clubs_updated", handleUpdate);
      window.removeEventListener("src_draft_clubs_updated", handleDraftClubsUpdate);
      window.removeEventListener("src_pillars_updated", handleUpdate);
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
    if (typeof window !== "undefined") {
      sessionStorage.setItem("src_admin_selected_tenure", tId);
      const url = new URL(window.location.href);
      url.searchParams.set("tenure", tId);
      window.history.replaceState({}, "", url.toString());
    }
    const targetTenure = tenures.find((t) => t.id === tId);
    const isFirst = targetTenure?.id === "tenure-2025-26" || targetTenure?.label?.includes("2025") || targetTenure?.tenureNumber?.includes("1st");
    if (targetTenure?.isCurrent) {
      const storedCouncil = getStoredCouncilMembers();
      let storedFounders = isFirst ? getStoredFoundingMembers() : [];
      if (isFirst && storedCouncil.length > 0 && storedCouncil.length !== storedFounders.length) {
        storedFounders = syncCouncilAdminsToFounding(storedCouncil, true);
      }
      setCouncilMembers(storedCouncil);
      setHostingMembers(getStoredHostingCommittee());
      setFoundingMembersList(storedFounders);
    } else if (targetTenure) {
      const draftCouncil = getStoredDraftCouncil(targetTenure.id);
      const draftHosting = getStoredDraftHosting(targetTenure.id);
      const councilList = draftCouncil.length > 0 ? draftCouncil : (targetTenure.adminCouncil || []);
      let founderList = isFirst ? (targetTenure.foundingMembers || getStoredFoundingMembers()) : [];
      if (isFirst && councilList.length > 0 && councilList.length !== founderList.length) {
        founderList = syncCouncilAdminsToFounding(councilList, true);
      }
      setCouncilMembers(councilList);
      setHostingMembers(draftHosting.length > 0 ? draftHosting : (targetTenure.hostingCommittee || []));
      setFoundingMembersList(founderList);
    }
  };

  // Convert clubs to editable team member items, aggregating multi-club leaders
  const clubLeadMembers = React.useMemo(() => {
    const leaderMap = new Map<string, (TeamMember & {
      clubId: string;
      roleType: "lead" | "coLead";
      clubName: string;
      clubIds: string[];
      clubSlugs: string[];
      clubNames: string[];
      clubs: { id: string; name: string; slug: string }[];
    })>();

    clubsList.forEach((club, clubIndex) => {
      const leaders = getClubLeaders(club);
      leaders.forEach((leader, leaderIndex) => {
        if (!leader || (!leader.name && !leader.role)) return;

        const isCoLead = leader.roleType === "coLead" || (leader.role && leader.role.toLowerCase().includes("co-head"));
        const cleanName = (leader.name || "").trim().toLowerCase();
        const cleanBt = (leader.btId || "").trim().toUpperCase();
        const isPlaceholder = !cleanName || cleanName.includes("placeholder") || cleanName === "tba" || cleanName === "club head" || cleanName === "club co-head";

        const groupKey = cleanBt 
          ? `bt-${cleanBt}` 
          : (isPlaceholder
              ? `club-${club.id}-${isCoLead ? "coLead" : "lead"}-${leaderIndex}`
              : (leader.id && !leader.id.includes("-leader-") && !leader.id.startsWith("lead-") 
                  ? `id-${leader.id}` 
                  : (cleanName ? `name-${cleanName}` : `club-${club.id}-${leaderIndex}`)));

        const existing = leaderMap.get(groupKey);
        const clubInfo = { id: club.id, name: club.name, slug: club.slug };

        if (existing) {
          if (!existing.clubIds.includes(club.id)) {
            existing.clubIds.push(club.id);
            existing.clubSlugs.push(club.slug);
            existing.clubNames.push(club.name);
            existing.clubs.push(clubInfo);
          }
          if (leader.role && !["Club Head", "Club Co-Head"].includes(leader.role.trim())) {
            existing.role = leader.role;
          }
        } else {
          const clubIds = leader.clubIds && Array.isArray(leader.clubIds) && leader.clubIds.length > 0
            ? Array.from(new Set([club.id, ...leader.clubIds]))
            : [club.id];
          const clubSlugs = leader.clubSlugs && Array.isArray(leader.clubSlugs) && leader.clubSlugs.length > 0
            ? Array.from(new Set([club.slug, ...leader.clubSlugs]))
            : [club.slug];
          const clubNames = leader.clubNames && Array.isArray(leader.clubNames) && leader.clubNames.length > 0
            ? Array.from(new Set([club.name, ...leader.clubNames]))
            : [club.name];

          leaderMap.set(groupKey, {
            id: leader.id || `${club.id || club.slug}-${isCoLead ? "colead" : "lead"}-${leaderIndex}`,
            name: leader.name || "",
            role: leader.role || (isCoLead ? `${club.name} Co-Lead` : `${club.name} Head`),
            department: leader.department || "Computer Science & Engineering",
            year: leader.year || (isCoLead ? "3rd Year" : "4th Year"),
            avatar: leader.avatar || "",
            bio: leader.bio || "",
            email: leader.email || "",
            linkedin: leader.linkedin || "",
            btId: leader.btId || "",
            order: clubIndex * 2 + (isCoLead ? 2 : 1),
            clubId: club.id,
            clubSlug: club.slug,
            clubName: club.name,
            clubIds,
            clubSlugs,
            clubNames,
            clubs: [clubInfo],
            roleType: isCoLead ? "coLead" : "lead"
          });
        }
      });
    });

    // Backfill any clubs mentioned in clubIds/clubSlugs
    leaderMap.forEach((entry) => {
      if (entry.clubIds && entry.clubIds.length > 1) {
        entry.clubIds.forEach((cid) => {
          const matchedClub = clubsList.find((c) => c.id === cid || c.slug === cid);
          if (matchedClub && !entry.clubs.some((c) => c.id === matchedClub.id || c.slug === matchedClub.slug)) {
            entry.clubs.push({ id: matchedClub.id, name: matchedClub.name, slug: matchedClub.slug });
            if (!entry.clubNames.includes(matchedClub.name)) entry.clubNames.push(matchedClub.name);
            if (!entry.clubSlugs.includes(matchedClub.slug)) entry.clubSlugs.push(matchedClub.slug);
          }
        });
      }
    });

    return Array.from(leaderMap.values());
  }, [clubsList]);

  // Current active list depending on tab
  const currentMembers = activeTab === "council"
    ? councilMembers
    : activeTab === "hosting"
    ? hostingMembers
    : activeTab === "founding"
    ? foundingMembersList
    : clubLeadMembers;

  const saveCurrentList = async (updated: TeamMember[]) => {
    if (activeTab === "clubs") return;

    isSavingRef.current = true;

    // Re-index all orders to guarantee strict sequential 1..N order
    const indexed = updated.map((m, idx) => ({
      ...m,
      order: idx + 1
    }));

    let syncedFounders: TeamMember[] = [];
    let syncedCouncil: TeamMember[] = [];

    if (activeTab === "council") {
      setCouncilMembers(indexed);
      if (isFirstTenure) {
        syncedFounders = syncCouncilAdminsToFounding(indexed, true);
        setFoundingMembersList(syncedFounders);
      }
    } else if (activeTab === "hosting") {
      setHostingMembers(indexed);
    } else if (activeTab === "founding") {
      setFoundingMembersList(indexed);
      if (isFirstTenure) {
        syncedCouncil = syncFoundingToCouncilAdmins(indexed, true);
        setCouncilMembers(syncedCouncil);
      }
    }

    const rosterUpdates: any = {
      [activeTab === "council" ? "adminCouncil" : activeTab === "hosting" ? "hostingCommittee" : "foundingMembers"]: indexed
    };
    if (isFirstTenure) {
      if (activeTab === "council" && syncedFounders.length > 0) {
        rosterUpdates.foundingMembers = syncedFounders;
      } else if (activeTab === "founding" && syncedCouncil.length > 0) {
        rosterUpdates.adminCouncil = syncedCouncil;
      }
    }

    try {
      if (selectedTenure?.isCurrent) {
        // Live active tenure
        if (activeTab === "council") {
          await saveStoredCouncilMembers(indexed, false);
        } else if (activeTab === "hosting") {
          await saveStoredHostingCommittee(indexed);
        } else if (activeTab === "founding") {
          await saveStoredFoundingMembers(indexed, false);
        }
        updateTenureRoster(selectedTenure.id, rosterUpdates, true);
        setTenures((prev) => prev.map((t) => t.id === selectedTenure.id ? {
          ...t,
          ...rosterUpdates
        } : t));
      } else if (selectedTenure) {
        // Draft / upcoming tenure: save to dedicated draft store first!
        if (activeTab === "council") {
          await saveStoredDraftCouncil(selectedTenure.id, indexed);
        } else if (activeTab === "hosting") {
          await saveStoredDraftHosting(selectedTenure.id, indexed);
        }
        updateTenureRoster(selectedTenure.id, rosterUpdates, true);
        setTenures((prev) => prev.map((t) => t.id === selectedTenure.id ? {
          ...t,
          ...rosterUpdates
        } : t));
        if (typeof window !== "undefined") {
          sessionStorage.setItem("src_admin_selected_tenure", selectedTenure.id);
        }
      }

      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        isSavingRef.current = false;
      }, 2000);
    } catch (saveErr: any) {
      console.error("Cloud save notice in saveCurrentList:", saveErr);
      isSavingRef.current = false;
      const msg = saveErr?.message || String(saveErr);
      if (msg.includes("Admin session expired") || msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
        alert("⚠️ Admin Session Expired: Please refresh the page and sign in again with your admin credentials.");
        throw saveErr;
      }
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
      }, 2000);
    }
  };

  const handleSyncToFounding = () => {
    const listToSync = councilMembers.length > 0 ? councilMembers : getStoredCouncilMembers();
    if (!Array.isArray(listToSync) || listToSync.length === 0) {
      alert("No council members found to sync.");
      return;
    }
    const synced = syncCouncilAdminsToFounding(listToSync, true);
    setFoundingMembersList(synced);
    if (selectedTenure) {
      updateTenureRoster(selectedTenure.id, { foundingMembers: synced }, true);
      setTenures((prev) => prev.map((t) => t.id === selectedTenure.id ? { ...t, foundingMembers: synced } : t));
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleSyncFromAdmins = () => {
    const listToSync = councilMembers.length > 0 ? councilMembers : getStoredCouncilMembers();
    if (!Array.isArray(listToSync) || listToSync.length === 0) {
      alert("No council members found to sync.");
      return;
    }
    const synced = syncCouncilAdminsToFounding(listToSync, true);
    setFoundingMembersList(synced);
    if (selectedTenure) {
      updateTenureRoster(selectedTenure.id, { foundingMembers: synced }, true);
      setTenures((prev) => prev.map((t) => t.id === selectedTenure.id ? { ...t, foundingMembers: synced } : t));
    }
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

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return currentMembers.filter(
      (m) =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.role || "").toLowerCase().includes(q) ||
        (m.department || "").toLowerCase().includes(q)
    );
  }, [currentMembers, searchQuery]);

  const handleOpenAddModal = () => {
    setIsCreatingNew(true);
    const randSuffix = Math.random().toString(36).substring(2, 7);
    if (activeTab === "clubs") {
      const firstClub = clubsList[0];
      setEditingMember({
        id: `leader-${Date.now()}-${randSuffix}`,
        name: "",
        role: firstClub ? `${firstClub.name} Head` : "Club Head",
        clubId: firstClub?.id || "",
        clubSlug: firstClub?.slug || "",
        clubName: firstClub?.name || "",
        clubIds: firstClub ? [firstClub.id] : [],
        clubSlugs: firstClub ? [firstClub.slug] : [],
        clubNames: firstClub ? [firstClub.name] : [],
        clubs: firstClub ? [{ id: firstClub.id, name: firstClub.name, slug: firstClub.slug }] : [],
        roleType: "lead",
        department: "Computer Science & Engineering",
        year: "4th Year",
        bio: "",
        avatar: "",
        order: currentMembers.length + 1,
        email: "",
        linkedin: "",
        btId: ""
      } as any);
    } else {
      setEditingMember({
        id: `member-${Date.now()}-${randSuffix}`,
        name: "",
        role: "",
        department: "Computer Science and Engineering",
        year: "4th Year",
        bio: "",
        avatar: "",
        order: currentMembers.length + 1,
        email: "",
        linkedin: "",
        btId: ""
      });
    }
  };

  const handleSaveMember = async (e?: React.FormEvent, memberOverride?: TeamMember) => {
    if (e?.preventDefault) e.preventDefault();
    const m = memberOverride || editingMember;
    if (!m) return;

    if (!m.name.trim()) {
      alert("Please provide the Student Full Name.");
      return;
    }
    if (activeTab !== "clubs" && activeTab !== "pillars" && !m.role.trim()) {
      alert("Please provide a Position / Role Title.");
      return;
    }

    if (activeTab === "pillars") {
      const updatedPillars = pillarsList.map((p) => {
        if (p.id === m.id) {
          return {
            ...p,
            name: m.name,
            designation: m.designation || (m as any).level || p.designation,
            department: m.department,
            avatar: m.avatar || p.avatar,
            quote: m.bio || p.quote,
            email: m.email,
            linkedin: m.linkedin,
          };
        }
        return p;
      });

      try {
        await saveStoredInstitutionalPillars(updatedPillars);
        setPillarsList(updatedPillars);
        setEditingMember(null);
        setIsCreatingNew(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      } catch (saveErr: any) {
        console.error("Cloud save notice for pillars:", saveErr);
        const msg = saveErr?.message || String(saveErr);
        if (msg.includes("Admin session expired") || msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
          alert("⚠️ Admin Session Expired: Please refresh the page and sign in again with your admin credentials.");
          throw saveErr;
        }
        setPillarsList(updatedPillars);
        setEditingMember(null);
        setIsCreatingNew(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      }
      return;
    }

    if (activeTab === "clubs") {
      const match = clubLeadMembers.find((item) => item.id === m.id);
      let targetClubIds: string[] = (m as any).clubIds || [];
      if (targetClubIds.length === 0 && (m as any).clubId) {
        targetClubIds = [(m as any).clubId];
      }
      if (targetClubIds.length === 0 && match) {
        targetClubIds = match.clubIds || [match.clubId].filter(Boolean);
      }

      if (targetClubIds.length === 0) {
        alert("Please select at least one chartered club.");
        return;
      }

      const targetRoleType: "lead" | "coLead" = (m as any).roleType || match?.roleType || "lead";

      const selectedClubs = clubsList.filter((c) => targetClubIds.includes(c.id) || targetClubIds.includes(c.slug));
      const clubNames = selectedClubs.map((c) => c.name);
      const clubSlugs = selectedClubs.map((c) => c.slug);

      // Final custom designation
      let finalRole = (m.role || "").trim();
      if (!finalRole) {
        const suffix = targetRoleType === "coLead" ? "Co-Head" : "Head";
        if (clubNames.length === 1) {
          finalRole = `${clubNames[0]} ${suffix}`;
        } else if (clubNames.length === 2) {
          finalRole = `${suffix} • ${clubNames[0]} & ${clubNames[1]}`;
        } else {
          finalRole = `Joint ${suffix} • ${clubNames.join(", ")}`;
        }
      }

      const leaderPayload: ClubLeader = {
        id: m.id || `${targetClubIds[0] || "club"}-${targetRoleType}-${Date.now()}`,
        name: m.name.trim(),
        role: finalRole,
        roleType: targetRoleType,
        department: m.department || "Computer Science & Engineering",
        year: m.year || (targetRoleType === "lead" ? "4th Year" : "3rd Year"),
        avatar: m.avatar || "",
        bio: m.bio || "",
        email: m.email || "",
        linkedin: m.linkedin || "",
        btId: (m.btId || "").trim().toUpperCase(),
        clubId: targetClubIds[0] || "",
        clubSlug: clubSlugs[0] || "",
        clubName: clubNames[0] || "",
        clubIds: targetClubIds,
        clubSlugs,
        clubNames,
      };

      const matchBtId = match?.btId ? match.btId.trim().toUpperCase() : "";
      const matchName = match?.name ? match.name.trim().toLowerCase() : "";

      const updatedClubs = clubsList.map((club) => {
        const isSelectedForClub = targetClubIds.includes(club.id) || targetClubIds.includes(club.slug);
        const currentLeaders = getClubLeaders(club);

        if (isSelectedForClub) {
          let existingIdx = -1;

          // 1. Match by exact ID
          if (m.id) {
            existingIdx = currentLeaders.findIndex((l) => l.id === m.id);
          }

          // 2. Match by BT ID (current or previous)
          if (existingIdx === -1 && leaderPayload.btId) {
            existingIdx = currentLeaders.findIndex(
              (l) => l.btId && l.btId.trim().toUpperCase() === leaderPayload.btId
            );
          }
          if (existingIdx === -1 && matchBtId) {
            existingIdx = currentLeaders.findIndex(
              (l) => l.btId && l.btId.trim().toUpperCase() === matchBtId
            );
          }

          // 3. Match by previous name if editing
          if (existingIdx === -1 && matchName) {
            existingIdx = currentLeaders.findIndex(
              (l) => l.name && l.name.trim().toLowerCase() === matchName
            );
          }

          // 4. Match by new name if already exists in this club
          if (existingIdx === -1 && leaderPayload.name) {
            existingIdx = currentLeaders.findIndex(
              (l) => l.name && l.name.trim().toLowerCase() === leaderPayload.name.toLowerCase()
            );
          }

          // 5. Fallback for editing existing card: match by target roleType if not creating new
          if (existingIdx === -1 && !isCreatingNew) {
            existingIdx = currentLeaders.findIndex(
              (l) => (l.roleType || (l.role?.toLowerCase().includes("co-head") ? "coLead" : "lead")) === targetRoleType
            );
          }

          let newLeaders: ClubLeader[];
          if (existingIdx !== -1) {
            newLeaders = [...currentLeaders];
            newLeaders[existingIdx] = {
              ...currentLeaders[existingIdx],
              ...leaderPayload,
              id: currentLeaders[existingIdx].id || leaderPayload.id,
            };
          } else {
            newLeaders = [...currentLeaders, leaderPayload];
          }

          const primaryLead = targetRoleType === "lead" 
            ? (newLeaders.find((l) => l.id === leaderPayload.id) || leaderPayload)
            : (newLeaders.find((l) => l.roleType === "lead") || newLeaders[0] || leaderPayload);
          const coLeadsList = newLeaders.filter((l) => l.roleType === "coLead");

          return {
            ...club,
            leaders: newLeaders,
            lead: primaryLead,
            coLead: coLeadsList[0] || undefined,
            coLeads: coLeadsList
          };
        } else {
          // If club was previously selected for this leader but is now unselected, remove them
          let existingIdx = currentLeaders.findIndex((l) => l.id === m.id);
          if (existingIdx === -1 && leaderPayload.btId) {
            existingIdx = currentLeaders.findIndex(
              (l) => l.btId && l.btId.trim().toUpperCase() === leaderPayload.btId
            );
          }
          if (existingIdx === -1 && matchBtId) {
            existingIdx = currentLeaders.findIndex(
              (l) => l.btId && l.btId.trim().toUpperCase() === matchBtId
            );
          }
          if (existingIdx === -1 && matchName) {
            existingIdx = currentLeaders.findIndex(
              (l) => l.name && l.name.trim().toLowerCase() === matchName
            );
          }

          if (existingIdx !== -1) {
            const newLeaders = currentLeaders.filter((_, idx) => idx !== existingIdx);
            const primaryLead = newLeaders.find((l) => l.roleType === "lead") || newLeaders[0] || {
              name: "",
              role: `${club.name} Head`,
              department: "",
              year: "",
              avatar: ""
            };
            const coLeadsList = newLeaders.filter((l) => l.roleType === "coLead");

            return {
              ...club,
              leaders: newLeaders,
              lead: primaryLead,
              coLead: coLeadsList[0] || undefined,
              coLeads: coLeadsList
            };
          }

          return club;
        }
      });

      setClubsList(updatedClubs);
      isSavingRef.current = true;
      try {
        await saveStoredClubs(updatedClubs);
        if (selectedTenure?.isCurrent) {
          updateTenureRoster(selectedTenure.id, { clubs: updatedClubs }, true);
        } else if (selectedTenure) {
          saveStoredDraftClubs(selectedTenure.id, updatedClubs);
          updateTenureRoster(selectedTenure.id, { clubs: updatedClubs }, true);
        }
        setIsSaved(true);
        setTimeout(() => {
          setIsSaved(false);
          isSavingRef.current = false;
        }, 2000);
        setEditingMember(null);
        setIsCreatingNew(false);
      } catch (saveErr: any) {
        console.error("Cloud save notice for club leader:", saveErr);
        isSavingRef.current = false;
        const msg = saveErr?.message || String(saveErr);
        if (msg.includes("Admin session expired") || msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
          alert("⚠️ Admin Session Expired: Please refresh the page and sign in again with your admin credentials.");
        } else {
          setIsSaved(true);
          setTimeout(() => {
            setIsSaved(false);
          }, 2000);
          setEditingMember(null);
          setIsCreatingNew(false);
        }
      }
      return;
    }

    const maxRank = currentMembers.length + (isCreatingNew ? 1 : 0);
    const targetRank = Math.max(1, Math.min(m.order || maxRank, maxRank));

    let updated: TeamMember[];
    if (isCreatingNew) {
      const listWithoutNew = [...currentMembers];
      listWithoutNew.splice(targetRank - 1, 0, { ...m, order: targetRank });
      updated = listWithoutNew;
    } else {
      const listFiltered = currentMembers.filter((item) => item.id !== m.id);
      listFiltered.splice(targetRank - 1, 0, { ...m, order: targetRank });
      updated = listFiltered;
    }

    try {
      await saveCurrentList(updated);
      setEditingMember(null);
      setIsCreatingNew(false);
    } catch (saveErr: any) {
      console.error("Cloud save notice for member:", saveErr);
      const msg = saveErr?.message || String(saveErr);
      if (msg.includes("Admin session expired") || msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
        alert("⚠️ Admin Session Expired: Please refresh the page and sign in again with your admin credentials.");
        throw saveErr;
      }
      setEditingMember(null);
      setIsCreatingNew(false);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name || "this member"}?`)) return;

    if (activeTab === "clubs") {
      const match = clubLeadMembers.find((m) => m.id === id);
      if (match) {
        const targetIds = (match.clubIds && match.clubIds.length > 0) ? match.clubIds : [match.clubId];
        const delBtId = match.btId ? match.btId.trim().toUpperCase() : "";
        const delName = match.name ? match.name.trim().toLowerCase() : "";

        const updatedClubs = clubsList.map((club) => {
          if (targetIds.includes(club.id) || targetIds.includes(club.slug)) {
            const currentLeaders = getClubLeaders(club).filter((l) => {
              if (l.id === id) return false;
              if (delBtId && l.btId && l.btId.trim().toUpperCase() === delBtId) return false;
              if (delName && l.name && l.name.trim().toLowerCase() === delName) return false;
              return true;
            });
            const primaryLead = currentLeaders.find((l) => l.roleType === "lead") || currentLeaders[0] || {
              name: "",
              role: `${club.name} Head`,
              department: "",
              year: "",
              avatar: ""
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
        isSavingRef.current = true;
        await saveStoredClubs(updatedClubs);
        if (selectedTenure?.isCurrent) {
          updateTenureRoster(selectedTenure.id, { clubs: updatedClubs }, true);
        } else if (selectedTenure) {
          saveStoredDraftClubs(selectedTenure.id, updatedClubs);
          updateTenureRoster(selectedTenure.id, { clubs: updatedClubs }, true);
        }
        setIsSaved(true);
        setTimeout(() => {
          setIsSaved(false);
          isSavingRef.current = false;
        }, 2000);
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
              avatar: "",
              bio: "",
              email: "mentor@jdcoem.ac.in",
              order: 1
            },
            {
              id: `admin-${selectedTenure?.label || "draft"}-president`,
              name: "President (Appointee)",
              role: "President",
              department: "Artificial Intelligence Engineering",
              year: "4th Year",
              avatar: "",
              bio: "",
              email: "president@jdcoem.ac.in",
              order: 2
            },
            {
              id: `admin-${selectedTenure?.label || "draft"}-vp`,
              name: "Vice President (Appointee)",
              role: "Vice President",
              department: "Information Technology",
              year: "4th Year",
              avatar: "",
              bio: "",
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

          {activeTab !== "pillars" && (
            <Button
              onClick={handleOpenAddModal}
              variant="primary"
              size="sm"
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{activeTab === "clubs" ? "Add Club Head / Co-Head" : "Add New Position / Officer"}</span>
            </Button>
          )}

          <Link
            href={activeTab === "pillars" ? "/about" : "/team"}
            target="_blank"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title={`Preview Live ${activeTab === "pillars" ? "/about" : "/team"} Page in New Tab`}
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
          <Link href={activeTab === "pillars" ? "/about" : "/team"} target="_blank" className="text-emerald-700 underline font-bold uppercase tracking-wider">
            View Live Public {activeTab === "pillars" ? "About" : "Team"} Page &rarr;
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
                  You are staging positions for <strong>{selectedTenure.academicYear}</strong>. This session is completely hidden from the public website (including <code>/archive</code> and <code>/team</code>) and is accessible only on this admin console until you activate it.
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

        <button
          onClick={() => setActiveTab("pillars")}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "pillars"
              ? "bg-[#17458F] text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <GraduationCap className="w-4 h-4 text-[#E78023]" />
          <span>4 Pillars of Strength ({pillarsList.length})</span>
        </button>
      </div>

      {/* Search & Actions Bar (for Council, Hosting, Founding, Clubs) */}
      {activeTab !== "pillars" && (
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
              onClick={handleSyncToFounding}
              className="px-4 py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs"
              title="Sync photos, names, and details to Founding Members"
            >
              <Sparkles className="w-4 h-4 text-[#E78023]" />
              <span>Sync to Founding Members ({foundingMembersList.length})</span>
            </button>
          )}

          {isFirstTenure && activeTab === "founding" && (
            <button
              type="button"
              onClick={handleSyncFromAdmins}
              className="px-4 py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs"
              title="Sync all photos, names, and details from 1st Tenure Admins"
            >
              <Sparkles className="w-4 h-4 text-[#E78023]" />
              <span>Sync from 1st Tenure Admins ({councilMembers.length})</span>
            </button>
          )}
        </div>
      )}

      {/* 4 PILLARS OF STRENGTH MANAGEMENT VIEW */}
      {activeTab === "pillars" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {pillarsList.map((pillar) => (
              <div
                key={pillar.id}
                className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-inner flex items-center justify-center">
                    {pillar.avatar ? (
                      <Image
                        src={pillar.avatar}
                        alt={pillar.name}
                        fill
                        unoptimized={true}
                        className="object-cover object-top"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-slate-400">
                        {(pillar.name || "P").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-heading font-extrabold text-sm sm:text-base text-[#0F172A] leading-snug">
                      {pillar.name}
                    </h4>
                    <p className="text-xs font-bold text-[#E78023] leading-tight">
                      {pillar.designation}
                    </p>
                    <p className="text-[10px] font-medium text-slate-500 font-sans">
                      {pillar.department}
                    </p>
                  </div>

                  {pillar.quote && (
                    <div className="pt-2 border-t border-dashed border-slate-200">
                      <p className="text-[11px] text-slate-600 italic line-clamp-3 leading-relaxed font-serif">
                        &ldquo;{pillar.quote}&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setEditingMember({
                      id: pillar.id,
                      name: pillar.name,
                      role: pillar.designation || "Pillar",
                      designation: pillar.designation,
                      level: pillar.designation,
                      department: pillar.department,
                      avatar: pillar.avatar,
                      bio: pillar.quote || "",
                      email: pillar.email || "",
                      linkedin: pillar.linkedin || "",
                      order: pillar.order
                    });
                    setIsCreatingNew(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-[#17458F] hover:text-white text-[#17458F] font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Postcard &amp; Photo</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roster Grid (for Council, Hosting, Founding, Clubs) */}
      {activeTab !== "pillars" && (
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {activeTab === "clubs" ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {(member as any).clubs && (member as any).clubs.length > 1 ? (
                          (member as any).clubs.map((c: any) => (
                            <span
                              key={c.id || c.slug}
                              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#17458F]/10 text-[#17458F] border border-[#17458F]/20 flex items-center gap-1"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-[#E78023]" />
                              <span>{c.name.replace(" Club", "").replace(" Society", "")}</span>
                            </span>
                          ))
                        ) : (
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
                        )}
                      </div>
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
                    {member.avatar ? (
                      <Image
                        src={member.avatar}
                        alt={member.name || "Member"}
                        fill
                        unoptimized={true}
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                        <Users className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-[#0F172A] truncate">
                      {member.name || "Untitled Member"}
                    </h3>
                    <p className="text-xs text-[#E78023] font-bold truncate" title={member.role}>
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleDeleteMember(member.id, member.name)}
                    className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                    title={activeTab === "clubs" ? "Remove Club Head / Co-Head" : "Remove Position / Officer"}
                    aria-label="Delete position"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {activeTab === "clubs" && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {(member as any).clubs && (member as any).clubs.length > 1 ? (
                        (member as any).clubs.map((c: any) => (
                          <Link
                            key={c.slug}
                            href={`/clubs/${c.slug}`}
                            target="_blank"
                            className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-bold uppercase transition-colors"
                            title={`View ${c.name}`}
                          >
                            {c.name.replace(" Club", "").replace(" Society", "")}
                          </Link>
                        ))
                      ) : (member as any).clubSlug ? (
                        <Link
                          href={`/clubs/${(member as any).clubSlug}`}
                          target="_blank"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase transition-colors"
                        >
                          View Club
                        </Link>
                      ) : null}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setIsCreatingNew(false);
                    const clubIds = (member as any).clubIds || [(member as any).clubId].filter(Boolean);
                    const clubNames = (member as any).clubNames || [(member as any).clubName].filter(Boolean);
                    const clubSlugs = (member as any).clubSlugs || [(member as any).clubSlug].filter(Boolean);
                    setEditingMember({
                      ...member,
                      order: actualIndex + 1,
                      clubIds,
                      clubNames,
                      clubSlugs,
                    } as any);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#17458F] hover:bg-[#0E2F66] text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {activeTab !== "pillars" && filteredMembers.length === 0 && (
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
      <PositionFormModal
        isOpen={!!editingMember}
        onClose={() => {
          setEditingMember(null);
          setIsCreatingNew(false);
        }}
        initialMember={editingMember}
        isCreatingNew={isCreatingNew}
        activeTab={activeTab}
        clubsList={clubsList}
        departmentsList={departmentsList}
        currentMembersCount={currentMembers.length}
        pendingUploads={pendingUploads}
        onUploadStateChange={handleUploadStateChange}
        onSave={(updatedMember) => handleSaveMember(undefined, updatedMember)}
        onDelete={handleDeleteMember}
      />

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
