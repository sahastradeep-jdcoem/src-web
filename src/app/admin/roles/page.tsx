"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Check, 
  KeyRound, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck, 
  UserRound, 
  X, 
  Sparkles, 
  CreditCard, 
  BellRing, 
  Search,
  Building2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getAllAdminAccessFromFirestore,
  saveAdminAccessToFirestore,
  subscribeToAdminAccessFromFirestore,
  revokeAdminAccessFromFirestore,
} from "@/lib/firebase/firestore";
import { 
  getStoredClubs, 
  getClubLeaders, 
  getStoredCouncilMembers, 
  getStoredHostingCommittee, 
  getStoredSpokespersons, 
  syncClubsFromFirestore, 
  syncCouncilMembersFromFirestore, 
  syncHostingCommitteeFromFirestore, 
  syncSpokespersonsFromFirestore 
} from "@/lib/councilStore";
import { findRegisteredUserByBtId, lookupUserByBtId } from "@/lib/usersStore";
import { AdminAccessAssignment, AdminAccessRole, ADMIN_ROLE_LABELS, normalizeBtId } from "@/types/rbac";
import { ClubItem, TeamMember } from "@/types";

interface LeaderCandidate {
  name: string;
  role: string;
  detectedBtId: string;
  currentBtId: string;
}

interface ClubCandidateGroup {
  club: ClubItem;
  head: LeaderCandidate | null;
  coHead: LeaderCandidate | null;
}

interface OfficerCandidate {
  key: string;
  title: string;
  name: string;
  detectedBtId: string;
  currentBtId: string;
  role: "TREASURER" | "PROTOCOL_OFFICER";
  surface: string;
  source: string;
}

export default function AdminRolesPage() {
  const { isOwner, user } = useAuth();
  const [assignments, setAssignments] = useState<AdminAccessAssignment[]>([]);
  const [clubs, setClubs] = useState<ClubItem[]>(() => getStoredClubs());
  const [officers, setOfficers] = useState<TeamMember[]>([]);
  
  // Editable BT ID overrides mapped by slot key
  const [btIdOverrides, setBtIdOverrides] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Manual Custom Role Grant form
  const [manualBtId, setManualBtId] = useState("");
  const [manualRole, setManualRole] = useState<AdminAccessRole>("CLUB_OWNER");
  const [manualClubId, setManualClubId] = useState("");

  // Load latest data from Firestore and stores
  const loadData = useCallback(async () => {
    try {
      const [remoteClubs, remoteCouncil, remoteHosting, remoteSpokespersons, remoteAssignments] = await Promise.all([
        syncClubsFromFirestore(),
        syncCouncilMembersFromFirestore(),
        syncHostingCommitteeFromFirestore(),
        syncSpokespersonsFromFirestore(),
        getAllAdminAccessFromFirestore(),
      ]);

      if (remoteClubs && remoteClubs.length > 0) setClubs(remoteClubs);
      else setClubs(getStoredClubs());

      const combinedOfficers = [
        ...(remoteCouncil && remoteCouncil.length > 0 ? remoteCouncil : getStoredCouncilMembers()),
        ...(remoteHosting && remoteHosting.length > 0 ? remoteHosting : getStoredHostingCommittee()),
        ...(remoteSpokespersons && remoteSpokespersons.length > 0 ? remoteSpokespersons : getStoredSpokespersons()),
      ];
      setOfficers(combinedOfficers);
      setAssignments(remoteAssignments);
    } catch {
      setNotice({ message: "Notice: Synchronizing latest administrative datasets from Firestore.", type: "info" });
    }
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    loadData();
    const unsubscribe = subscribeToAdminAccessFromFirestore(setAssignments);
    return () => unsubscribe();
  }, [isOwner, loadData]);

  // Map of active assignments keyed by normalized BT ID
  const activeAssignmentsByBtId = useMemo(() => {
    const map = new Map<string, AdminAccessAssignment>();
    assignments.forEach((assignment) => {
      const cleanBt = normalizeBtId(assignment.btId);
      if (cleanBt && assignment.active !== false) {
        map.set(cleanBt, assignment);
      }
    });
    return map;
  }, [assignments]);

  // Compute club candidate groups (Club-wise Head & Co-Head)
  const clubCandidateGroups = useMemo<ClubCandidateGroup[]>(() => {
    return clubs.map((club) => {
      const leaders = getClubLeaders(club);
      
      // Club Head: roleType lead or role includes head (and not co-head)
      const headLeader = leaders.find((l) => 
        (l.roleType === "lead" || /head/i.test(l.role || "")) && !/co-?head|vice|joint/i.test(l.role || "")
      ) || leaders[0] || null;

      // Club Co-Head: role includes co-head, vice, or second leader
      const coHeadLeader = leaders.find((l) => 
        /co-?head|vice|joint/i.test(l.role || "")
      ) || (leaders.length > 1 && leaders[1] !== headLeader ? leaders[1] : null);

      const headSlotKey = `club:${club.id}:head`;
      const coHeadSlotKey = `club:${club.id}:cohead`;

      const headDetectedBt = normalizeBtId(headLeader?.btId);
      const coHeadDetectedBt = normalizeBtId(coHeadLeader?.btId);

      return {
        club,
        head: headLeader ? {
          name: headLeader.name,
          role: headLeader.role || "Club Head",
          detectedBtId: headDetectedBt,
          currentBtId: btIdOverrides[headSlotKey] !== undefined ? btIdOverrides[headSlotKey] : headDetectedBt,
        } : null,
        coHead: coHeadLeader ? {
          name: coHeadLeader.name,
          role: coHeadLeader.role || "Club Co-Head",
          detectedBtId: coHeadDetectedBt,
          currentBtId: btIdOverrides[coHeadSlotKey] !== undefined ? btIdOverrides[coHeadSlotKey] : coHeadDetectedBt,
        } : null,
      };
    });
  }, [clubs, btIdOverrides]);

  // Compute Treasurer and Protocol Officers
  const officerCandidates = useMemo<OfficerCandidate[]>(() => {
    const list: OfficerCandidate[] = [];

    // 1. Treasurer
    const treasurers = officers.filter((m) => /treasurer/i.test(m.role || ""));
    if (treasurers.length > 0) {
      treasurers.forEach((t, idx) => {
        const slotKey = `officer:treasurer:${idx}`;
        const detectedBt = normalizeBtId(t.btId);
        list.push({
          key: slotKey,
          title: "Treasurer",
          name: t.name,
          detectedBtId: detectedBt,
          currentBtId: btIdOverrides[slotKey] !== undefined ? btIdOverrides[slotKey] : detectedBt,
          role: "TREASURER",
          surface: "Payments Surface Only",
          source: t.role || "Treasurer",
        });
      });
    } else {
      // Fallback placeholder slot so owner can assign manually
      const slotKey = "officer:treasurer:fallback";
      list.push({
        key: slotKey,
        title: "Treasurer",
        name: "Appointed Treasurer",
        detectedBtId: "",
        currentBtId: btIdOverrides[slotKey] || "",
        role: "TREASURER",
        surface: "Payments Surface Only",
        source: "Council Office",
      });
    }

    // 2. Protocol & Operations Officer
    const protocolOfficers = officers.filter((m) => /protocol|operations|hospitality/i.test(m.role || ""));
    if (protocolOfficers.length > 0) {
      protocolOfficers.forEach((p, idx) => {
        const slotKey = `officer:protocol:${idx}`;
        const detectedBt = normalizeBtId(p.btId);
        list.push({
          key: slotKey,
          title: "Protocol Officer",
          name: p.name,
          detectedBtId: detectedBt,
          currentBtId: btIdOverrides[slotKey] !== undefined ? btIdOverrides[slotKey] : detectedBt,
          role: "PROTOCOL_OFFICER",
          surface: "SRC Operations Surface Only",
          source: p.role || "Protocol Officer",
        });
      });
    } else {
      // Fallback placeholder slot so owner can assign manually
      const slotKey = "officer:protocol:fallback";
      list.push({
        key: slotKey,
        title: "Protocol Officer",
        name: "Appointed Protocol / Operations Officer",
        detectedBtId: "",
        currentBtId: btIdOverrides[slotKey] || "",
        role: "PROTOCOL_OFFICER",
        surface: "SRC Operations Surface Only",
        source: "Council Office",
      });
    }

    return list;
  }, [officers, btIdOverrides]);

  if (!isOwner) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center text-rose-900 shadow-xs">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-600" />
        <h1 className="font-heading text-2xl font-extrabold">Owner Access Required</h1>
        <p className="mt-2 text-sm text-rose-700">
          Role assignments and access control configuration can only be managed by the primary council owner.
        </p>
      </div>
    );
  }

  // Grant role access to a BT ID
  const grantAccess = async (
    rawBtId: string,
    role: AdminAccessRole,
    club?: Pick<ClubItem, "id" | "slug" | "name">,
    slotKey?: string
  ) => {
    const cleanBt = normalizeBtId(rawBtId);
    if (!cleanBt) {
      setNotice({ message: "Please provide a valid BT ID.", type: "error" });
      return;
    }

    const currentBusyKey = slotKey || cleanBt;
    setBusyKey(currentBusyKey);

    try {
      // Check if user is already registered in local cache or Firestore
      const localUser = findRegisteredUserByBtId(cleanBt);
      const remoteUser = localUser || (await lookupUserByBtId(cleanBt));
      const uid = remoteUser?.uid || "";

      const now = new Date().toISOString();
      await saveAdminAccessToFirestore({
        btId: cleanBt,
        uid: uid || cleanBt,
        role,
        clubId: club?.id,
        clubSlug: club?.slug,
        clubName: club?.name,
        active: true,
        grantedBy: user?.email || user?.uid || "owner",
        grantedAt: now,
        updatedAt: now,
      });

      setNotice({
        message: `${ADMIN_ROLE_LABELS[role]} clearance granted to ${cleanBt}${club?.name ? ` (${club.name})` : ""}${uid ? " (Linked to account)" : " (Awaiting student sign-in)"}.`,
        type: "success",
      });
      await loadData();
    } catch (err: any) {
      setNotice({ message: err?.message || "Failed to grant role clearance.", type: "error" });
    } finally {
      setBusyKey(null);
    }
  };

  // Revoke role access
  const revokeAccess = async (cleanBt: string, uid?: string, slotKey?: string) => {
    const currentBusyKey = slotKey || cleanBt;
    setBusyKey(currentBusyKey);
    try {
      await revokeAdminAccessFromFirestore(cleanBt, user?.email || user?.uid || "owner", uid);
      setNotice({ message: `Access revoked for ${cleanBt}.`, type: "success" });
      await loadData();
    } catch {
      setNotice({ message: "Failed to revoke role access.", type: "error" });
    } finally {
      setBusyKey(null);
    }
  };

  // 1-Click Global Tenure Grant
  const handleGrantAllTenure = async () => {
    setBusyKey("bulk_tenure");
    let count = 0;
    const now = new Date().toISOString();

    try {
      // 1. Grant club heads & co-heads
      for (const group of clubCandidateGroups) {
        if (group.head?.currentBtId) {
          const cleanBt = normalizeBtId(group.head.currentBtId);
          if (cleanBt) {
            const matched = findRegisteredUserByBtId(cleanBt);
            await saveAdminAccessToFirestore({
              btId: cleanBt,
              uid: matched?.uid || cleanBt,
              role: "CLUB_OWNER",
              clubId: group.club.id,
              clubSlug: group.club.slug,
              clubName: group.club.name,
              active: true,
              grantedBy: user?.email || "owner",
              grantedAt: now,
              updatedAt: now,
            });
            count++;
          }
        }

        if (group.coHead?.currentBtId) {
          const cleanBt = normalizeBtId(group.coHead.currentBtId);
          if (cleanBt) {
            const matched = findRegisteredUserByBtId(cleanBt);
            await saveAdminAccessToFirestore({
              btId: cleanBt,
              uid: matched?.uid || cleanBt,
              role: "CLUB_OWNER",
              clubId: group.club.id,
              clubSlug: group.club.slug,
              clubName: group.club.name,
              active: true,
              grantedBy: user?.email || "owner",
              grantedAt: now,
              updatedAt: now,
            });
            count++;
          }
        }
      }

      // 2. Grant Treasurer & Protocol Officers
      for (const officer of officerCandidates) {
        if (officer.currentBtId) {
          const cleanBt = normalizeBtId(officer.currentBtId);
          if (cleanBt) {
            const matched = findRegisteredUserByBtId(cleanBt);
            await saveAdminAccessToFirestore({
              btId: cleanBt,
              uid: matched?.uid || cleanBt,
              role: officer.role,
              active: true,
              grantedBy: user?.email || "owner",
              grantedAt: now,
              updatedAt: now,
            });
            count++;
          }
        }
      }

      setNotice({
        message: `Tenure synchronization complete: ${count} role assignment(s) provisioned and synced to Firestore.`,
        type: "success",
      });
      await loadData();
    } catch (err: any) {
      setNotice({ message: err?.message || "Failed to execute bulk tenure grant.", type: "error" });
    } finally {
      setBusyKey(null);
    }
  };

  // Filtered clubs for search
  const filteredClubGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clubCandidateGroups;
    return clubCandidateGroups.filter((g) => 
      g.club.name.toLowerCase().includes(q) ||
      g.club.category.toLowerCase().includes(q) ||
      g.head?.name.toLowerCase().includes(q) ||
      g.head?.currentBtId.toLowerCase().includes(q) ||
      g.coHead?.name.toLowerCase().includes(q) ||
      g.coHead?.currentBtId.toLowerCase().includes(q)
    );
  }, [clubCandidateGroups, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E78023]">
              Owner Control Plane
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
              Live Firestore Sync
            </span>
          </div>
          <h1 className="font-heading text-3xl font-extrabold text-[#17458F]">
            Roles &amp; Access Control
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-slate-500 font-medium">
            Manage institutional access across JDCOEM student leadership. All roles are strictly controlled by the owner via official student BT IDs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            className="gap-1.5"
            title="Refresh from cloud"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>

          <Button
            onClick={handleGrantAllTenure}
            disabled={busyKey === "bulk_tenure"}
            variant="primary"
            size="sm"
            className="gap-2 shadow-xs cursor-pointer font-bold"
          >
            <KeyRound className="h-4 w-4" />
            <span>{busyKey === "bulk_tenure" ? "Syncing Tenure…" : "Grant Detected Tenure Access (1-Click)"}</span>
          </Button>
        </div>
      </div>

      {/* Global Notification Banner */}
      {notice && (
        <div
          className={`flex items-center justify-between rounded-2xl px-4 py-3 text-xs font-semibold shadow-2xs border ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : notice.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-blue-200 bg-blue-50 text-blue-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: TREASURER & PROTOCOL OFFICERS ACCESS */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#17458F]" />
              <h2 className="font-heading text-lg font-extrabold text-slate-900">
                Treasurer &amp; Protocol Officers Access
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Auto-detected from active Council, Hosting, and Spokespersons rosters. BT IDs can be edited manually before granting.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {officerCandidates.map((officer) => {
            const cleanBt = normalizeBtId(officer.currentBtId);
            const activeGrant = cleanBt ? activeAssignmentsByBtId.get(cleanBt) : null;
            const isGrantActive = activeGrant && activeGrant.role === officer.role;
            const isBusy = busyKey === officer.key || busyKey === cleanBt;

            return (
              <div
                key={officer.key}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        {officer.role === "TREASURER" ? (
                          <CreditCard className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <BellRing className="h-5 w-5 text-indigo-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900">{officer.title}</h3>
                          <Badge variant={officer.role === "TREASURER" ? "success" : "navy"} size="sm">
                            {officer.surface}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{officer.name}</p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        isGrantActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-200 text-slate-600 border-slate-300"
                      }`}
                    >
                      {isGrantActive ? "Active Access" : "Not Granted"}
                    </span>
                  </div>

                  {/* BT ID Input & Controls */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Student BT ID
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={officer.currentBtId}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setBtIdOverrides((prev) => ({ ...prev, [officer.key]: val }));
                        }}
                        placeholder="e.g. BT22CSE045"
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-bold text-slate-800 uppercase focus:border-[#17458F] focus:outline-hidden"
                      />
                      {officer.detectedBtId && officer.currentBtId !== officer.detectedBtId && (
                        <button
                          type="button"
                          onClick={() => {
                            setBtIdOverrides((prev) => ({ ...prev, [officer.key]: officer.detectedBtId }));
                          }}
                          className="text-[10px] font-bold text-[#17458F] hover:underline whitespace-nowrap"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    {officer.detectedBtId ? (
                      <p className="text-[10px] text-slate-400">
                        Roster detected BT ID: <span className="font-mono font-bold text-[#E78023]">{officer.detectedBtId}</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-amber-600 font-medium">
                        * BT ID missing in roster; please type manually.
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400">
                    Source: {officer.source}
                  </span>

                  <div className="flex items-center gap-2">
                    {isGrantActive && (
                      <Button
                        onClick={() => revokeAccess(cleanBt, activeGrant?.uid, officer.key)}
                        disabled={isBusy}
                        size="sm"
                        variant="danger"
                        className="cursor-pointer"
                      >
                        Revoke
                      </Button>
                    )}

                    <Button
                      onClick={() => grantAccess(officer.currentBtId, officer.role, undefined, officer.key)}
                      disabled={isBusy || !cleanBt}
                      size="sm"
                      variant={isGrantActive ? "outline" : "primary"}
                      className="cursor-pointer font-bold gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{isBusy ? "Updating…" : isGrantActive ? "Update BT ID" : "Grant Access"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: CLUB OWNERS SECTION */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#E78023]" />
              <h2 className="font-heading text-lg font-extrabold text-slate-900">
                Club Owners Access (Club-Wise Heads &amp; Co-Heads)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Access is strictly scoped to each club&apos;s events, listings, registrations, and payments.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search club or leader…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#17458F] focus:outline-hidden"
            />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {filteredClubGroups.map((group) => {
            const headSlotKey = `club:${group.club.id}:head`;
            const coHeadSlotKey = `club:${group.club.id}:cohead`;

            const headBt = group.head ? normalizeBtId(group.head.currentBtId) : "";
            const coHeadBt = group.coHead ? normalizeBtId(group.coHead.currentBtId) : "";

            const headActiveGrant = headBt ? activeAssignmentsByBtId.get(headBt) : null;
            const coHeadActiveGrant = coHeadBt ? activeAssignmentsByBtId.get(coHeadBt) : null;

            const isHeadActive = headActiveGrant && headActiveGrant.role === "CLUB_OWNER" && headActiveGrant.clubId === group.club.id;
            const isCoHeadActive = coHeadActiveGrant && coHeadActiveGrant.role === "CLUB_OWNER" && coHeadActiveGrant.clubId === group.club.id;

            const isClubBusy = busyKey === `club:${group.club.id}:all`;

            // 1-Click Grant for this entire club (both head & cohead)
            const handleGrantWholeClub = async () => {
              setBusyKey(`club:${group.club.id}:all`);
              try {
                if (headBt) {
                  await grantAccess(headBt, "CLUB_OWNER", group.club, headSlotKey);
                }
                if (coHeadBt) {
                  await grantAccess(coHeadBt, "CLUB_OWNER", group.club, coHeadSlotKey);
                }
              } finally {
                setBusyKey(null);
              }
            };

            return (
              <div
                key={group.club.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4"
              >
                {/* Club Header */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-white border border-slate-200 text-[#17458F] shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 truncate">{group.club.name}</h3>
                      <p className="text-[10px] text-slate-500 font-medium">{group.club.category}</p>
                    </div>
                  </div>

                  <Button
                    onClick={handleGrantWholeClub}
                    disabled={isClubBusy || (!headBt && !coHeadBt)}
                    size="sm"
                    variant="outline"
                    className="text-xs font-bold text-[#17458F] border-[#17458F]/30 hover:bg-blue-50 cursor-pointer"
                  >
                    {isClubBusy ? "Granting…" : "Grant Club Access"}
                  </Button>
                </div>

                {/* Leaders Section */}
                <div className="space-y-4">
                  {/* 1. Club Head */}
                  <div className="rounded-xl bg-white p-3.5 border border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 text-[#17458F]" />
                        <span className="text-xs font-bold text-slate-800">
                          {group.head?.name || "Club Head Unspecified"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">(Head)</span>
                      </div>

                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                          isHeadActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {isHeadActive ? "Active" : "Unassigned"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={group.head?.currentBtId || ""}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setBtIdOverrides((prev) => ({ ...prev, [headSlotKey]: val }));
                        }}
                        placeholder="BT ID (e.g. BT22CSE001)"
                        className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs font-bold uppercase text-slate-800 focus:border-[#17458F] focus:outline-hidden"
                      />

                      {isHeadActive ? (
                        <Button
                          onClick={() => revokeAccess(headBt, headActiveGrant?.uid, headSlotKey)}
                          disabled={busyKey === headSlotKey}
                          size="sm"
                          variant="danger"
                          className="h-8 px-2.5 text-xs cursor-pointer"
                        >
                          Revoke
                        </Button>
                      ) : (
                        <Button
                          onClick={() => grantAccess(headBt, "CLUB_OWNER", group.club, headSlotKey)}
                          disabled={busyKey === headSlotKey || !headBt}
                          size="sm"
                          variant="primary"
                          className="h-8 px-2.5 text-xs font-bold cursor-pointer"
                        >
                          {busyKey === headSlotKey ? "Saving…" : "Grant"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 2. Club Co-Head */}
                  <div className="rounded-xl bg-white p-3.5 border border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 text-[#E78023]" />
                        <span className="text-xs font-bold text-slate-800">
                          {group.coHead?.name || "Club Co-Head Unspecified"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">(Co-Head)</span>
                      </div>

                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                          isCoHeadActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {isCoHeadActive ? "Active" : "Unassigned"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={group.coHead?.currentBtId || ""}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setBtIdOverrides((prev) => ({ ...prev, [coHeadSlotKey]: val }));
                        }}
                        placeholder="BT ID (e.g. BT22CSE002)"
                        className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs font-bold uppercase text-slate-800 focus:border-[#17458F] focus:outline-hidden"
                      />

                      {isCoHeadActive ? (
                        <Button
                          onClick={() => revokeAccess(coHeadBt, coHeadActiveGrant?.uid, coHeadSlotKey)}
                          disabled={busyKey === coHeadSlotKey}
                          size="sm"
                          variant="danger"
                          className="h-8 px-2.5 text-xs cursor-pointer"
                        >
                          Revoke
                        </Button>
                      ) : (
                        <Button
                          onClick={() => grantAccess(coHeadBt, "CLUB_OWNER", group.club, coHeadSlotKey)}
                          disabled={busyKey === coHeadSlotKey || !coHeadBt}
                          size="sm"
                          variant="primary"
                          className="h-8 px-2.5 text-xs font-bold cursor-pointer"
                        >
                          {busyKey === coHeadSlotKey ? "Saving…" : "Grant"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: MANUAL CUSTOM ROLE GRANT */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div>
          <h2 className="font-heading text-lg font-extrabold text-slate-900">
            Manual BT-ID Clearance Grant
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manually grant console access to any student BT ID with custom role or club assignment.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase">Student BT ID</label>
            <input
              type="text"
              value={manualBtId}
              onChange={(e) => setManualBtId(e.target.value.toUpperCase())}
              placeholder="e.g. BT22CSE099"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs font-bold uppercase text-slate-800 focus:border-[#17458F] focus:outline-hidden"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase">Console Role</label>
            <select
              value={manualRole}
              onChange={(e) => setManualRole(e.target.value as AdminAccessRole)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#17458F] focus:outline-hidden"
            >
              <option value="CLUB_OWNER">Club Owner</option>
              <option value="TREASURER">Treasurer</option>
              <option value="PROTOCOL_OFFICER">Protocol Officer</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase">Club Scope</label>
            <select
              value={manualClubId}
              onChange={(e) => setManualClubId(e.target.value)}
              disabled={manualRole !== "CLUB_OWNER"}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50 focus:border-[#17458F] focus:outline-hidden"
            >
              <option value="">Select Club…</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => {
              const matchedClub = clubs.find((c) => c.id === manualClubId);
              grantAccess(manualBtId, manualRole, matchedClub ? { id: matchedClub.id, slug: matchedClub.slug, name: matchedClub.name } : undefined);
              setManualBtId("");
            }}
            disabled={!manualBtId.trim() || (manualRole === "CLUB_OWNER" && !manualClubId)}
            variant="primary"
            className="w-full font-bold cursor-pointer"
          >
            Grant Access
          </Button>
        </div>
      </section>

      {/* SECTION 4: ACTIVE ROLE ASSIGNMENTS AUDIT LEDGER */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-extrabold text-slate-900">
              Active Administrative Assignments
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live Firestore ledger. Revoking an assignment terminates the administrator session in real-time.
            </p>
          </div>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
            {assignments.filter((a) => a.active !== false).length} Active Assignments
          </span>
        </div>

        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {assignments.map((assignment) => {
            const cleanBt = normalizeBtId(assignment.btId);
            const isBusy = busyKey === cleanBt;
            const isOwnerAssignment = assignment.role === "OWNER";

            return (
              <div
                key={`${assignment.btId}-${assignment.uid}`}
                className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {assignment.btId || assignment.uid}
                    </span>
                    <Badge
                      variant={
                        assignment.role === "OWNER"
                          ? "orange"
                          : assignment.role === "TREASURER"
                          ? "success"
                          : assignment.role === "PROTOCOL_OFFICER"
                          ? "navy"
                          : "slate"
                      }
                      size="sm"
                    >
                      {ADMIN_ROLE_LABELS[assignment.role]}
                    </Badge>
                    {assignment.clubName && (
                      <span className="text-xs font-medium text-slate-500">
                        • {assignment.clubName}
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Granted by {assignment.grantedBy} on {new Date(assignment.grantedAt).toLocaleDateString()}
                    {assignment.uid && assignment.uid !== assignment.btId ? (
                      <span className="ml-2 font-medium text-emerald-600">✓ Linked Account</span>
                    ) : (
                      <span className="ml-2 font-medium text-amber-600">⏳ Awaiting First Login</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      assignment.active !== false
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {assignment.active !== false ? "Active" : "Revoked"}
                  </span>

                  {assignment.active !== false && !isOwnerAssignment && (
                    <Button
                      onClick={() => revokeAccess(cleanBt, assignment.uid)}
                      disabled={isBusy}
                      size="sm"
                      variant="danger"
                      className="cursor-pointer text-xs"
                    >
                      {isBusy ? "Revoking…" : "Revoke Access"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {assignments.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No active assignments recorded. Use &ldquo;Grant Detected Tenure Access&rdquo; to provision appointees.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
