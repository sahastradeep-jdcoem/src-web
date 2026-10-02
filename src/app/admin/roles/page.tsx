"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, KeyRound, RefreshCw, ShieldAlert, UserRound, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getAllAdminAccessFromFirestore,
  saveAdminAccessToFirestore,
  subscribeToAdminAccessFromFirestore,
  revokeAdminAccessFromFirestore,
} from "@/lib/firebase/firestore";
import { getStoredClubs, getClubLeaders, getStoredCouncilMembers, getStoredHostingCommittee, getStoredSpokespersons, syncClubsFromFirestore, syncCouncilMembersFromFirestore, syncHostingCommitteeFromFirestore, syncSpokespersonsFromFirestore } from "@/lib/councilStore";
import { lookupUserByBtId } from "@/lib/usersStore";
import { AdminAccessAssignment, AdminAccessRole, ADMIN_ROLE_LABELS, normalizeBtId } from "@/types/rbac";
import { ClubItem, ClubLeader, TeamMember } from "@/types";

type Candidate = {
  key: string;
  name: string;
  email?: string;
  btId: string;
  role: AdminAccessRole;
  club?: Pick<ClubItem, "id" | "slug" | "name">;
  source: string;
};

function asCandidate(member: ClubLeader | TeamMember, role: AdminAccessRole, source: string, club?: ClubItem): Candidate {
  return {
    key: `${role}:${member.btId || member.email || member.name}:${club?.id || "global"}`,
    name: member.name,
    email: member.email,
    btId: normalizeBtId(member.btId),
    role,
    club: club ? { id: club.id, slug: club.slug, name: club.name } : undefined,
    source,
  };
}

export default function AdminRolesPage() {
  const { isOwner, user } = useAuth();
  const [assignments, setAssignments] = useState<AdminAccessAssignment[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualBtId, setManualBtId] = useState("");
  const [manualRole, setManualRole] = useState<AdminAccessRole>("CLUB_OWNER");
  const [manualClubId, setManualClubId] = useState("");

  const [clubs, setClubs] = useState<ClubItem[]>(() => getStoredClubs());
  const load = useCallback(async () => {
    const [remoteClubs, remoteCouncil, remoteHosting, remoteSpokespersons] = await Promise.all([
      syncClubsFromFirestore(),
      syncCouncilMembersFromFirestore(),
      syncHostingCommitteeFromFirestore(),
      syncSpokespersonsFromFirestore(),
    ]);
    if (remoteClubs.length > 0) setClubs(remoteClubs);
    setAssignments(await getAllAdminAccessFromFirestore());
    const clubCandidates = clubs.flatMap((club) => getClubLeaders(club)
      .filter((leader) => leader.roleType === "lead" || leader.role.toLowerCase().includes("head"))
      .map((leader) => asCandidate(leader, "CLUB_OWNER", "Club Head / Co-Head", club)));
    const officers = [
      ...(remoteCouncil.length > 0 ? remoteCouncil : getStoredCouncilMembers()),
      ...(remoteHosting.length > 0 ? remoteHosting : getStoredHostingCommittee()),
      ...(remoteSpokespersons.length > 0 ? remoteSpokespersons : getStoredSpokespersons()),
    ];
    const treasurers = officers.filter((member) => member.role.toLowerCase().includes("treasurer"))
      .map((member) => asCandidate(member, "TREASURER", "Treasurer roster"));
    const protocol = officers.filter((member) => /protocol|operations|hospitality/i.test(member.role))
      .map((member) => asCandidate(member, "PROTOCOL_OFFICER", "Protocol / Operations roster"));
    const unique = new Map<string, Candidate>();
    [...clubCandidates, ...treasurers, ...protocol].forEach((candidate) => { if (!unique.has(candidate.key)) unique.set(candidate.key, candidate); });
    setCandidates([...unique.values()]);
  }, [clubs]);

  useEffect(() => {
    if (!isOwner) return;
    load().catch(() => setNotice("Could not load role assignments from Firestore."));
    const unsubscribe = subscribeToAdminAccessFromFirestore(setAssignments);
    return () => unsubscribe();
  }, [isOwner, load]);

  if (!isOwner) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center text-rose-900"><ShieldAlert className="mx-auto mb-3 h-8 w-8" /><h1 className="font-heading text-xl font-extrabold">Owner access required</h1></div>;
  }

  const grant = async (candidate: Candidate) => {
    const btId = normalizeBtId(candidate.btId);
    if (!btId) { setNotice(`${candidate.name} has no BT ID in the current roster.`); return; }
    setBusyKey(candidate.key);
    try {
      const matched = await lookupUserByBtId(btId);
      if (!matched) throw new Error(`No authenticated user is linked to ${btId}. Ask them to sign in once first.`);
      const now = new Date().toISOString();
      await saveAdminAccessToFirestore({ uid: matched.uid, btId, role: candidate.role, clubId: candidate.club?.id, clubSlug: candidate.club?.slug, clubName: candidate.club?.name, active: true, grantedBy: user?.email || user?.uid || "owner", grantedAt: now, updatedAt: now });
      setNotice(`${ADMIN_ROLE_LABELS[candidate.role]} access granted to ${candidate.name}.`);
      await load();
    } catch (error: any) { setNotice(error?.message || "Could not grant access."); }
    finally { setBusyKey(null); }
  };

  const grantAll = async () => {
    setBusyKey("bulk");
    let granted = 0;
    for (const candidate of candidates) {
      if (!candidate.btId) continue;
      try {
        const matched = await lookupUserByBtId(candidate.btId);
        if (!matched) continue;
        const now = new Date().toISOString();
        await saveAdminAccessToFirestore({ uid: matched.uid, btId: candidate.btId, role: candidate.role, clubId: candidate.club?.id, clubSlug: candidate.club?.slug, clubName: candidate.club?.name, active: true, grantedBy: user?.email || "owner", grantedAt: now, updatedAt: now });
        granted++;
      } catch {}
    }
    await load(); setBusyKey(null); setNotice(`Tenure access sync complete. ${granted} assignment(s) granted.`);
  };

  const revoke = async (assignment: AdminAccessAssignment) => {
    setBusyKey(assignment.uid);
    try { await revokeAdminAccessFromFirestore(assignment.uid, user?.email || user?.uid || "owner"); setNotice(`Access revoked for ${assignment.btId}.`); await load(); }
    catch { setNotice("Could not revoke access."); }
    finally { setBusyKey(null); }
  };

  const grantManual = async () => {
    const club = clubs.find((item) => item.id === manualClubId);
    await grant({ key: `manual:${manualBtId}`, name: normalizeBtId(manualBtId), btId: manualBtId, role: manualRole, club: club ? { id: club.id, slug: club.slug, name: club.name } : undefined, source: "Manual" });
    setManualBtId("");
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E78023]">Owner control plane</p><h1 className="font-heading text-3xl font-extrabold text-[#17458F]">Roles &amp; Access</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">BT-ID assignments are stored in Firestore and evaluated on every admin session. Local roster data is used only to suggest appointees.</p></div>
        <Button onClick={grantAll} disabled={busyKey === "bulk"} variant="primary"><KeyRound className="mr-2 h-4 w-4" />{busyKey === "bulk" ? "Syncing…" : "Grant detected tenure access"}</Button>
      </div>
      {notice && <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button></div>}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-heading text-lg font-extrabold text-slate-900">Auto-detected appointees</h2><p className="text-xs text-slate-500">Club heads/co-heads, Treasurer, and Protocol/Operations BT IDs from the active roster.</p></div><button onClick={() => load()} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:text-[#17458F]" title="Refresh"><RefreshCw className="h-4 w-4" /></button></div>
        <div className="grid gap-3 lg:grid-cols-2">{candidates.map((candidate) => <div key={candidate.key} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="min-w-0"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[#17458F]" /><span className="truncate text-sm font-bold text-slate-900">{candidate.name}</span><Badge variant="slate" size="sm">{ADMIN_ROLE_LABELS[candidate.role]}</Badge></div><p className="mt-1 font-mono text-xs font-bold text-[#E78023]">{candidate.btId || "BT ID missing"}</p><p className="text-[10px] text-slate-400">{candidate.club?.name || candidate.source}</p></div><Button onClick={() => grant(candidate)} disabled={busyKey === candidate.key || !candidate.btId} size="sm" variant="outline">{busyKey === candidate.key ? "Granting…" : <><Check className="mr-1 h-3.5 w-3.5" />Grant</>}</Button></div>)}</div>
        {candidates.length === 0 && <p className="rounded-2xl bg-slate-50 p-6 text-center text-xs text-slate-500">No roster appointees detected yet.</p>}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs"><h2 className="font-heading text-lg font-extrabold text-slate-900">Manual BT-ID assignment</h2><p className="mb-4 text-xs text-slate-500">Use this when an appointee’s BT ID needs correction or is not present in the roster.</p><div className="grid gap-3 md:grid-cols-4"><input value={manualBtId} onChange={(event) => setManualBtId(event.target.value.toUpperCase())} placeholder="BT ID" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono font-bold" /><select value={manualRole} onChange={(event) => setManualRole(event.target.value as AdminAccessRole)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="CLUB_OWNER">Club Owner</option><option value="TREASURER">Treasurer</option><option value="PROTOCOL_OFFICER">Protocol Officer</option></select><select value={manualClubId} onChange={(event) => setManualClubId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">No club scope</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select><Button onClick={grantManual} disabled={!manualBtId.trim()} variant="primary">Grant access</Button></div></section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-heading text-lg font-extrabold text-slate-900">Active assignments</h2><p className="text-xs text-slate-500">Revocation is immediate through the live Firestore listener.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{assignments.filter((item) => item.active !== false).length} active</span></div><div className="divide-y divide-slate-100">{assignments.map((assignment) => <div key={assignment.uid} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold text-slate-900">{assignment.btId || assignment.uid}</p><p className="text-xs text-slate-500">{ADMIN_ROLE_LABELS[assignment.role]}{assignment.clubName ? ` • ${assignment.clubName}` : ""}</p></div><div className="flex items-center gap-3"><span className={`text-[10px] font-bold uppercase ${assignment.active === false ? "text-rose-600" : "text-emerald-600"}`}>{assignment.active === false ? "Revoked" : "Active"}</span>{assignment.active !== false && assignment.role !== "OWNER" && <button onClick={() => revoke(assignment)} disabled={busyKey === assignment.uid} className="rounded-lg bg-rose-50 p-2 text-rose-600 hover:bg-rose-100" title="Revoke access"><X className="h-4 w-4" /></button>}</div></div>)}</div>{assignments.length === 0 && <p className="py-5 text-center text-xs text-slate-500">No explicit assignments yet. The owner remains available through the configured break-glass identity.</p>}</section>
    </div>
  );
}
