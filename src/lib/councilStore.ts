import { TeamMember, ClubItem, ClubLeader, InstitutionalPillar } from "@/types";
import { 
  adminCouncilMembers as initialAdminCouncil, 
  hostingCommitteeMembers as initialHosting, 
  spokespersonMembers as initialSpokespersons,
  foundingMembers as initialFoundingMembers,
  institutionalPillars as initialPillars
} from "@/data/team";
import { mockClubs as initialClubs } from "@/data/clubs";
import { 
  getSiteContentFromFirestore, 
  saveSiteContentToFirestore,
  subscribeToSiteContent,
  cleanUndefined
} from "./firebase/firestore";
import { 
  enqueueCloudWrite, 
  reconcileArrayDatasets, 
  hasPendingWritesFor, 
  compactClubDataset, 
  compactCouncilDataset, 
  compactPillarsDataset,
  markLocalWrite,
  getLastLocalWriteTime,
  isLocalWriteRecent
} from "./dataSyncEngine";

export function getClubLeaders(club: ClubItem): ClubLeader[] {
  if (!club) return [];

  // Helper to filter out stock Unsplash photos from named humans
  const sanitizeAvatar = (av?: string): string => {
    if (!av || typeof av !== "string") return "";
    if (av.includes("images.unsplash.com")) return "";
    return av;
  };

  if (Array.isArray(club.leaders) && club.leaders.length > 0) {
    return club.leaders
      .filter((l) => l && l.name && l.name.trim().length > 0)
      .map((l, i) => {
        const isCoLead = l.roleType === "coLead" || (l.role && l.role.toLowerCase().includes("co-head"));
        const fallbackAvatar = isCoLead ? (club.coLead?.avatar || "") : (club.lead?.avatar || "");
        const rawAvatar = l.avatar || fallbackAvatar || "";
        return {
          ...l,
          id: l.id || `${club.id || club.slug}-leader-${i}`,
          roleType: l.roleType || (isCoLead ? "coLead" : "lead"),
          avatar: sanitizeAvatar(rawAvatar),
        };
      });
  }

  const list: ClubLeader[] = [];
  if (club.lead && club.lead.name && club.lead.name.trim().length > 0) {
    list.push({
      ...club.lead,
      id: club.lead.id || `${club.id || club.slug}-lead`,
      roleType: "lead",
      avatar: sanitizeAvatar(club.lead.avatar),
    });
  }

  if (Array.isArray(club.coLeads) && club.coLeads.length > 0) {
    club.coLeads.forEach((cl, i) => {
      if (cl && cl.name && cl.name.trim().length > 0) {
        list.push({
          ...cl,
          id: cl.id || `${club.id || club.slug}-colead-${i}`,
          roleType: "coLead",
          avatar: sanitizeAvatar(cl.avatar || club.coLead?.avatar),
        });
      }
    });
  } else if (club.coLead && club.coLead.name && club.coLead.name.trim().length > 0) {
    list.push({
      ...club.coLead,
      id: club.coLead.id || `${club.id || club.slug}-colead`,
      roleType: "coLead",
      avatar: sanitizeAvatar(club.coLead.avatar),
    });
  }

  return list;
}

/**
 * Hydrates avatars from the canonical `leaders` array into `lead`, `coLead`, and `coLeads`.
 * Also ensures any Unsplash stock photos are cleanly stripped from named students.
 * Guarantees a single source of truth (`leaders`) with seamless backward compatibility.
 */
export function hydrateClubAvatars(clubs: ClubItem[]): ClubItem[] {
  if (!Array.isArray(clubs)) return [];

  const sanitizeAvatar = (av?: string): string => {
    if (!av || typeof av !== "string") return "";
    if (av.includes("images.unsplash.com")) return "";
    return av;
  };

  return clubs.map((c) => {
    const leaders = Array.isArray(c.leaders) ? [...c.leaders] : [];

    // Find primary lead & coLead avatars from leaders
    const leadLeader = leaders.find(
      (l) => (l.roleType === "lead" || (l.role && !l.role.toLowerCase().includes("co-head"))) && l.avatar && !l.avatar.includes("images.unsplash.com")
    ) || leaders[0];

    const coLeadLeader = leaders.find(
      (l) => (l.roleType === "coLead" || (l.role && l.role.toLowerCase().includes("co-head"))) && l.avatar && !l.avatar.includes("images.unsplash.com")
    );

    const leadAvatar = sanitizeAvatar(leadLeader?.avatar) || sanitizeAvatar(c.lead?.avatar);
    const coLeadAvatar = sanitizeAvatar(coLeadLeader?.avatar) || sanitizeAvatar(c.coLead?.avatar);

    const lead = c.lead ? {
      ...c.lead,
      avatar: sanitizeAvatar(c.lead.avatar) || leadAvatar,
    } : (leadLeader ? { ...leadLeader, roleType: "lead" as const, avatar: leadAvatar } : c.lead);

    const coLead = c.coLead ? {
      ...c.coLead,
      avatar: sanitizeAvatar(c.coLead.avatar) || coLeadAvatar,
    } : (coLeadLeader ? { ...coLeadLeader, roleType: "coLead" as const, avatar: coLeadAvatar } : c.coLead);

    const coLeads = Array.isArray(c.coLeads)
      ? c.coLeads.map((cl) => {
          const matchingLeader = leaders.find(
            (l) => (l.id && l.id === cl.id) || (l.name && cl.name && l.name.toLowerCase().trim() === cl.name.toLowerCase().trim())
          );
          const avatar = sanitizeAvatar(matchingLeader?.avatar) || sanitizeAvatar(cl.avatar) || coLeadAvatar;
          return { ...cl, avatar };
        })
      : (coLead ? [coLead] : []);

    // Ensure leaders array is properly populated with canonical avatars
    let finalLeaders = leaders.map((l) => {
      const isCoLead = l.roleType === "coLead" || (l.role && l.role.toLowerCase().includes("co-head"));
      const fallback = isCoLead ? coLeadAvatar : leadAvatar;
      const safeAvatar = sanitizeAvatar(l.avatar) || fallback || "";
      return {
        ...l,
        avatar: safeAvatar,
      };
    });

    if (finalLeaders.length === 0) {
      if (lead && lead.name) finalLeaders.push({ ...lead, roleType: "lead" });
      if (coLead && coLead.name) finalLeaders.push({ ...coLead, roleType: "coLead" });
    }

    return {
      ...c,
      lead,
      coLead,
      coLeads,
      leaders: finalLeaders,
    };
  });
}

/**
 * Strips duplicate base64 strings from `lead.avatar`, `coLead.avatar`, and `coLeads[i].avatar`
 * prior to uploading to Firestore. The single source of truth remains `leaders[i].avatar`.
 * This reduces `site_content/clubs` document size by ~518 KB (~50%), keeping it well under 1MB.
 */
export function deduplicateClubAvatarsForCloud(clubs: ClubItem[]): ClubItem[] {
  if (!Array.isArray(clubs)) return [];
  return clubs.map((c) => {
    // 1. Ensure leaders has the avatars first
    const hydrated = hydrateClubAvatars([c])[0];
    const leaders = hydrated.leaders || [];

    // 2. Strip duplicate base64 from lead (preserved in leaders)
    const lead = hydrated.lead ? {
      ...hydrated.lead,
      avatar: (hydrated.lead.avatar && hydrated.lead.avatar.startsWith("data:image/"))
        ? "" // Stripped for Firestore document limit; hydrated in-memory on client
        : (hydrated.lead.avatar || ""),
    } : hydrated.lead;

    // 3. Strip duplicate base64 from coLead
    const coLead = hydrated.coLead ? {
      ...hydrated.coLead,
      avatar: (hydrated.coLead.avatar && hydrated.coLead.avatar.startsWith("data:image/"))
        ? ""
        : (hydrated.coLead.avatar || ""),
    } : hydrated.coLead;

    // 4. Strip duplicate base64 from coLeads
    const coLeads = Array.isArray(hydrated.coLeads)
      ? hydrated.coLeads.map((cl) => ({
          ...cl,
          avatar: (cl.avatar && cl.avatar.startsWith("data:image/")) ? "" : (cl.avatar || ""),
        }))
      : hydrated.coLeads;

    return {
      ...c,
      lead,
      coLead,
      coLeads,
      leaders, // leaders retains all avatars as the single canonical source of truth!
    };
  });
}

export const KNOWN_HARDCODED_BIO_SNIPPETS = [
  "Pioneered the founding architecture",
  "Led the inaugural foundation assembly",
  "Directing campus digital infrastructure",
  "Presiding over the entire Student Representative Council",
  "Assisting executive governance",
  "Heading administrative records",
  "Assisting secretariat documentation",
  "Leading large-scale festival logistics",
  "Managing on-ground event workflows",
  "Leading the official Sahastradeep magazine",
  "Strategizing technical symposia",
  "Structuring campus fests",
  "Directing media relations",
  "Managing council treasury",
  "Assisting financial ledger records",
  "Enforcing institutional conduct standards",
  "Supervising gate accreditation",
  "Curating stage scripts",
  "Hosting major cultural nights",
  "Anchoring hackathons",
  "Co-anchoring stage ceremonies",
  "Delivering central council addresses",
  "Voicing student representations",
  "Representing student needs across computing",
  "Liaisoning for business conclaves",
  "Facilitating smooth campus onboarding",
  "institutional oversight and council governance",
  "Student Representative Council.",
  "Executive coordination and student council operations",
  "Council officer representing",
  "society operations, student chapters, and collegiate events",
  "logistics, rehearsals, member coordination, and event execution",
  "activities, workshops, productions, and student talent mentorship",
];

export function isHardcodedBio(bio?: string | null): boolean {
  if (!bio || typeof bio !== "string") return false;
  const trimmed = bio.trim();
  if (!trimmed) return false;
  return KNOWN_HARDCODED_BIO_SNIPPETS.some((snippet) => trimmed.includes(snippet));
}

export function sanitizeTeamMember(m: TeamMember): TeamMember {
  if (!m) return m;
  const copy = { ...m };
  delete (copy as any).level;
  delete (copy as any).category;
  if (copy.bio && isHardcodedBio(copy.bio)) {
    copy.bio = "";
  }
  return copy;
}

export function stripCategoryAndLevel(members: TeamMember[]): TeamMember[] {
  if (!Array.isArray(members)) return [];
  return members.map(sanitizeTeamMember);
}

// Role and identity synchronization helpers between 1st Tenure Council Admins & Founding Members
export function formatAdminRoleToFounding(role?: string): string {
  if (!role) return "Founding Council Member";
  const trimmed = role.trim();
  if (/^founding\s+/i.test(trimmed)) return trimmed;
  return `Founding ${trimmed}`;
}

export function formatFoundingRoleToAdmin(role?: string): string {
  if (!role) return "Council Admin Officer";
  const trimmed = role.trim();
  const stripped = trimmed.replace(/^founding\s+/i, "").trim();
  return stripped || "Council Admin Officer";
}

export function normalizeMemberName(name?: string): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Phonetic / transliteration equivalence for Indian surnames/names (e.g. Jambulkar / Jambhulkar)
export function normalizePhoneticMemberName(name?: string): string {
  if (!name) return "";
  return normalizeMemberName(name)
    .replace(/bh/g, "b")
    .replace(/dh/g, "d")
    .replace(/th/g, "t")
    .replace(/sh/g, "s")
    .replace(/kh/g, "k")
    .replace(/gh/g, "g");
}

export function getBaseMemberId(id?: string): string {
  if (!id) return "";
  return id.replace(/^(admin|council-admin|founder|member)-/i, "").trim();
}

export function matchCouncilAndFounder(m1: TeamMember, m2: TeamMember): boolean {
  if (!m1 || !m2) return false;

  // 1. Match by clean normalized name or phonetic transliteration
  if (m1.name && m2.name) {
    const n1 = normalizeMemberName(m1.name);
    const n2 = normalizeMemberName(m2.name);
    if (n1 === n2 && n1.length > 2 && !n1.includes("placeholder")) {
      return true;
    }
    const p1 = normalizePhoneticMemberName(m1.name);
    const p2 = normalizePhoneticMemberName(m2.name);
    if (p1 === p2 && p1.length > 2 && !p1.includes("placeholder")) {
      return true;
    }
  }

  // 2. Match by unique Base ID if present (e.g. member-1788159155799 <-> founder-1788159155799)
  const base1 = getBaseMemberId(m1.id);
  const base2 = getBaseMemberId(m2.id);
  if (base1 && base2 && base1 === base2 && base1 !== "" && !base1.includes("placeholder")) {
    return true;
  }

  // 3. Match by BT ID (with same first name or matching phonetic name)
  if (m1.btId && m2.btId) {
    const b1 = m1.btId.trim().toUpperCase();
    const b2 = m2.btId.trim().toUpperCase();
    if (b1 === b2 && b1.length > 3 && b1 !== "000000" && !b1.includes("PLACEHOLDER") && !b1.startsWith("BT00") && !b1.startsWith("BT01")) {
      if (m1.name && m2.name) {
        const fn1 = m1.name.trim().toLowerCase().split(/\s+/)[0];
        const fn2 = m2.name.trim().toLowerCase().split(/\s+/)[0];
        const p1 = normalizePhoneticMemberName(m1.name);
        const p2 = normalizePhoneticMemberName(m2.name);
        if (p1 === p2 || fn1 === fn2) {
          return true;
        }
        return false;
      }
      return true;
    }
  }

  // 4. Match by Email if present
  if (m1.email && m2.email) {
    const e1 = m1.email.trim().toLowerCase();
    const e2 = m2.email.trim().toLowerCase();
    if (e1 === e2 && e1.length > 5 && e1.includes("@") && !e1.includes("placeholder")) {
      return true;
    }
  }

  return false;
}

export function deduplicateTeamMembers(members: TeamMember[]): TeamMember[] {
  if (!Array.isArray(members)) return [];
  const result: TeamMember[] = [];
  const seenBaseIds = new Set<string>();
  const seenBtIds = new Set<string>();
  const seenPhoneticNames = new Set<string>();

  for (const m of members) {
    if (!m) continue;
    const baseId = getBaseMemberId(m.id);
    const cleanBt = m.btId?.trim().toUpperCase();
    const pName = normalizePhoneticMemberName(m.name);
    const firstName = m.name?.trim().toLowerCase().split(/\s+/)[0] || "";

    let isDuplicate = false;

    if (baseId && seenBaseIds.has(baseId)) {
      isDuplicate = true;
    }

    if (!isDuplicate && cleanBt && cleanBt.length > 3 && cleanBt !== "BT00" && cleanBt !== "BT01" && !cleanBt.includes("PLACEHOLDER")) {
      if (seenBtIds.has(cleanBt)) {
        const match = result.find((existing) => {
          const exBt = existing.btId?.trim().toUpperCase();
          if (exBt !== cleanBt) return false;
          const exFn = existing.name?.trim().toLowerCase().split(/\s+/)[0] || "";
          const exP = normalizePhoneticMemberName(existing.name);
          return exFn === firstName || exP === pName;
        });
        if (match) {
          isDuplicate = true;
        }
      }
    }

    if (!isDuplicate && pName && pName.length > 3) {
      if (seenPhoneticNames.has(pName)) {
        isDuplicate = true;
      }
    }

    if (!isDuplicate) {
      if (baseId) seenBaseIds.add(baseId);
      if (cleanBt && cleanBt.length > 3 && cleanBt !== "BT00" && cleanBt !== "BT01" && !cleanBt.includes("PLACEHOLDER")) {
        seenBtIds.add(cleanBt);
      }
      if (pName && pName.length > 3) seenPhoneticNames.add(pName);
      result.push(m);
    }
  }

  return result;
}

export function repairCouncilSwapIfNeeded(members: TeamMember[], isFounding = false): { repaired: boolean; members: TeamMember[] } {
  if (!Array.isArray(members) || members.length === 0) {
    return { repaired: false, members: [] };
  }

  let repaired = false;
  const repairedList = members.map((m) => {
    let copy = { ...m };

    // Strip leaked student BT ID from mentors
    if (
      (/mentor/i.test(copy.role || "") || (copy.name && /sarvashree|munesh/i.test(copy.name))) &&
      (copy.btId === "BT240115DS" || copy.btId === "BT000000CS")
    ) {
      copy.btId = "";
      repaired = true;
    }

    // Fix swapped Sarvesh / Manaswi roles if detected in legacy cache
    if (
      copy.name &&
      /sarvesh\s+surkar/i.test(copy.name) &&
      (/technical/i.test(copy.role || "") || /technical/i.test(copy.designation || ""))
    ) {
      const targetRole = isFounding ? "Founding President" : "President";
      copy.role = targetRole;
      copy.designation = targetRole;
      repaired = true;
    }

    if (
      copy.name &&
      /manaswi\s+burile/i.test(copy.name) &&
      (/chief\s+event/i.test(copy.role || "") || /chief\s+event/i.test(copy.designation || ""))
    ) {
      const targetRole = isFounding ? "Founding Technical Affairs" : "Technical Affairs";
      copy.role = targetRole;
      copy.designation = targetRole;
      repaired = true;
    }

    return copy;
  });

  return { repaired, members: repairedList };
}

// Council Team Store
export function getStoredCouncilMembers(): TeamMember[] {
  if (typeof window === "undefined") return deduplicateTeamMembers(stripCategoryAndLevel(initialAdminCouncil));
  try {
    const stored = localStorage.getItem("src_council_team");
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        let { repaired, members } = repairCouncilSwapIfNeeded(stripCategoryAndLevel(parsed));
        members = deduplicateTeamMembers(members);
        // Auto-heal missing canonical officers from initialAdminCouncil (e.g. Nadeem Khan #11, Shruti Khadse #12, Vrutant Bingewar #13)
        if (members.length < initialAdminCouncil.length) {
          let healed = false;
          for (const canon of initialAdminCouncil) {
            if (!members.some((m) => matchCouncilAndFounder(m, canon))) {
              members.push(canon);
              healed = true;
            }
          }
          if (healed) {
            members = deduplicateTeamMembers(members);
            members.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
            repaired = true;
          }
        }
        if (repaired && typeof window !== "undefined") {
          try {
            localStorage.setItem("src_council_team", JSON.stringify(members));
          } catch {}
        }
        return deduplicateTeamMembers(members);
      }
    }
  } catch (e) {
    console.warn("Could not read council team from storage", e);
  }
  return deduplicateTeamMembers(stripCategoryAndLevel(initialAdminCouncil));
}

export async function saveStoredCouncilMembers(members: TeamMember[], autoSyncToFounding = true): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(deduplicateTeamMembers(stripCategoryAndLevel(members)));
    markLocalWrite("council_team");
    try {
      localStorage.setItem("src_council_team", JSON.stringify(sanitized));
    } catch (lsErr) {
      console.warn("Direct localStorage write notice, auto-compacting...", lsErr);
    }

    window.dispatchEvent(new CustomEvent("src_council_team_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_tenures_updated"));
    window.dispatchEvent(new CustomEvent("src_users_updated"));

    // Direct cloud write & queue backup immediately (Directive #3)
    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore("council_team", sanitized);
    } catch (err) {
      console.warn("Firestore direct write for council team failed, enqueuing:", err);
      cloudWriteError = err;
    }
    enqueueCloudWrite("council_team", sanitized, `Council Leadership (${members.length} Members)`);

    compactCouncilDataset(sanitized).then((compacted) => {
      const finalClean = cleanUndefined(compacted);
      try {
        localStorage.setItem("src_council_team", JSON.stringify(finalClean));
      } catch {}
      saveSiteContentToFirestore("council_team", finalClean).catch(() => {});
    });

    if (autoSyncToFounding && Array.isArray(sanitized)) {
      syncCouncilAdminsToFounding(sanitized, true);
    }

    if (cloudWriteError) {
      const errMsg = cloudWriteError?.message || String(cloudWriteError);
      if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
        throw new Error("Admin session expired. Please refresh the page and sign in again.");
      }
    }
  } catch (e) {
    console.error("Could not save council team to storage", e);
    throw e;
  }
}

export async function syncCouncilMembersFromFirestore(): Promise<TeamMember[]> {
  try {
    const requestTime = Date.now();
    if (hasPendingWritesFor("council_team") || getLastLocalWriteTime("council_team") >= requestTime) {
      return getStoredCouncilMembers();
    }
    const remote = await getSiteContentFromFirestore<TeamMember[]>("council_team");
    // Verify no local writes occurred while waiting for network response
    if (hasPendingWritesFor("council_team") || getLastLocalWriteTime("council_team") >= requestTime) {
      return getStoredCouncilMembers();
    }
    if (remote !== null && Array.isArray(remote)) {
      const current = getStoredCouncilMembers();
      let merged = deduplicateTeamMembers(stripCategoryAndLevel(reconcileArrayDatasets(current, remote)));
      const { repaired, members } = repairCouncilSwapIfNeeded(merged);
      if (repaired) {
        merged = deduplicateTeamMembers(members);
      }
      // Auto-heal missing canonical members if remote snapshot was missing them
      if (merged.length < initialAdminCouncil.length) {
        let healed = false;
        for (const canon of initialAdminCouncil) {
          if (!merged.some((m) => matchCouncilAndFounder(m, canon))) {
            merged.push(canon);
            healed = true;
          }
        }
        if (healed) {
          merged = deduplicateTeamMembers(merged);
          merged.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
          saveSiteContentToFirestore("council_team", cleanUndefined(merged)).catch(() => {});
        }
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_council_team", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_council_team_updated", { detail: merged }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      // Auto-heal 1st tenure founding members if count is out of sync with council admins
      const currentFounders = getStoredFoundingMembers();
      if (merged.length > 0 && currentFounders.length !== merged.length) {
        syncCouncilAdminsToFounding(merged, true);
      }
      return merged;
    }
  } catch {}
  return getStoredCouncilMembers();
}

// Hosting Committee Store
export function getStoredHostingCommittee(): TeamMember[] {
  if (typeof window === "undefined") return stripCategoryAndLevel(initialHosting);
  try {
    const stored = localStorage.getItem("src_hosting_committee");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return stripCategoryAndLevel(parsed);
    }
  } catch (e) {
    console.warn("Could not read hosting committee from storage", e);
  }
  return stripCategoryAndLevel(initialHosting);
}

export async function saveStoredHostingCommittee(members: TeamMember[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(stripCategoryAndLevel(members));
    markLocalWrite("hosting_committee");
    try {
      localStorage.setItem("src_hosting_committee", JSON.stringify(sanitized));
    } catch {}

    window.dispatchEvent(new CustomEvent("src_hosting_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_users_updated"));

    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore("hosting_committee", sanitized);
    } catch (err) {
      console.warn("Firestore direct write for hosting committee failed, enqueuing:", err);
      cloudWriteError = err;
    }
    enqueueCloudWrite("hosting_committee", sanitized, `Hosting Committee (${members.length} Members)`);

    compactCouncilDataset(sanitized).then((compacted) => {
      const finalClean = cleanUndefined(compacted);
      try {
        localStorage.setItem("src_hosting_committee", JSON.stringify(finalClean));
      } catch {}
      saveSiteContentToFirestore("hosting_committee", finalClean).catch(() => {});
    });

    if (cloudWriteError) {
      const errMsg = cloudWriteError?.message || String(cloudWriteError);
      if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
        throw new Error("Admin session expired. Please refresh the page and sign in again.");
      }
    }
  } catch (e) {
    console.error("Could not save hosting committee to storage", e);
    throw e;
  }
}

export async function syncHostingCommitteeFromFirestore(): Promise<TeamMember[]> {
  try {
    const requestTime = Date.now();
    if (hasPendingWritesFor("hosting_committee") || getLastLocalWriteTime("hosting_committee") >= requestTime) {
      return getStoredHostingCommittee();
    }
    const remote = await getSiteContentFromFirestore<TeamMember[]>("hosting_committee");
    if (hasPendingWritesFor("hosting_committee") || getLastLocalWriteTime("hosting_committee") >= requestTime) {
      return getStoredHostingCommittee();
    }
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const current = getStoredHostingCommittee();
      const merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_hosting_committee", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_hosting_updated", { detail: merged }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      return merged;
    }
  } catch {}
  return getStoredHostingCommittee();
}

export function subscribeToHostingCommittee(callback: (members: TeamMember[]) => void): () => void {
  return subscribeToSiteContent<TeamMember[]>("hosting_committee", (remote) => {
    if (remote !== null && Array.isArray(remote)) {
      if (hasPendingWritesFor("hosting_committee")) return;
      const current = getStoredHostingCommittee();
      const merged = stripCategoryAndLevel(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_hosting_committee", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_hosting_updated", { detail: merged }));
      }
      callback(merged);
    }
  });
}

// Spokespersons Store
export function getStoredSpokespersons(): TeamMember[] {
  if (typeof window === "undefined") return stripCategoryAndLevel(initialSpokespersons);
  try {
    const stored = localStorage.getItem("src_spokespersons");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return stripCategoryAndLevel(parsed);
    }
  } catch (e) {
    console.warn("Could not read spokespersons from storage", e);
  }
  return stripCategoryAndLevel(initialSpokespersons);
}

export function saveStoredSpokespersons(members: TeamMember[]): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(stripCategoryAndLevel(members));
    try { localStorage.setItem("src_spokespersons", JSON.stringify(sanitized)); } catch {}
    window.dispatchEvent(new CustomEvent("src_spokespersons_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_users_updated"));
    saveSiteContentToFirestore("spokespersons", sanitized).catch((err) => {
      console.warn("Firestore direct write for spokespersons failed, enqueuing:", err);
    });
    enqueueCloudWrite("spokespersons", sanitized, `Spokespersons (${members.length} Members)`);
  } catch (e) {
    console.error("Could not save spokespersons to storage", e);
  }
}

export async function syncSpokespersonsFromFirestore(): Promise<TeamMember[]> {
  try {
    if (hasPendingWritesFor("spokespersons")) return getStoredSpokespersons();
    const remote = await getSiteContentFromFirestore<TeamMember[]>("spokespersons");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const cleaned = stripCategoryAndLevel(remote);
      if (typeof window !== "undefined") {
        localStorage.setItem("src_spokespersons", JSON.stringify(cleaned));
        window.dispatchEvent(new CustomEvent("src_spokespersons_updated", { detail: cleaned }));
      }
      return cleaned;
    }
  } catch {}
  return getStoredSpokespersons();
}

export function subscribeToSpokespersons(callback: (members: TeamMember[]) => void): () => void {
  return subscribeToSiteContent<TeamMember[]>("spokespersons", (remote) => {
    if (remote !== null && Array.isArray(remote)) {
      if (hasPendingWritesFor("spokespersons")) return;
      if (typeof window !== "undefined") {
        localStorage.setItem("src_spokespersons", JSON.stringify(remote));
        window.dispatchEvent(new CustomEvent("src_spokespersons_updated", { detail: remote }));
      }
      callback(remote);
    }
  });
}

export function subscribeToCouncilMembers(callback: (members: TeamMember[]) => void): () => void {
  return subscribeToSiteContent<TeamMember[]>("council_team", (remote) => {
    if (remote !== null && Array.isArray(remote)) {
      if (hasPendingWritesFor("council_team")) return;
      const current = getStoredCouncilMembers();
      let merged = deduplicateTeamMembers(stripCategoryAndLevel(reconcileArrayDatasets(current, remote)));
      const { repaired, members } = repairCouncilSwapIfNeeded(merged);
      if (repaired) {
        merged = deduplicateTeamMembers(members);
      }
      if (merged.length < initialAdminCouncil.length) {
        let healed = false;
        for (const canon of initialAdminCouncil) {
          if (!merged.some((m) => matchCouncilAndFounder(m, canon))) {
            merged.push(canon);
            healed = true;
          }
        }
        if (healed) {
          merged = deduplicateTeamMembers(merged);
          merged.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
          saveStoredCouncilMembers(merged, true);
          callback(merged);
          return;
        }
      }
      if (repaired) {
        saveStoredCouncilMembers(merged, true);
      } else if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_council_team", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_council_team_updated", { detail: merged }));
      }
      // Auto-heal 1st tenure founding members if count is out of sync with council admins
      const currentFounders = getStoredFoundingMembers();
      if (merged.length > 0 && currentFounders.length !== merged.length) {
        syncCouncilAdminsToFounding(merged, true);
      }
      callback(merged);
    }
  });
}

// Clubs Roster Store
export function getStoredClubs(): ClubItem[] {
  if (typeof window === "undefined") return hydrateClubAvatars(initialClubs);
  let clubs: ClubItem[] = initialClubs;
  try {
    const stored = localStorage.getItem("src_clubs_roster");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        clubs = parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read clubs from storage", e);
  }
  return hydrateClubAvatars(clubs);
}

export async function saveStoredClubs(clubs: ClubItem[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    // 1. Fully synchronize avatars across all representations in memory
    const syncedClubs = hydrateClubAvatars(clubs);

    const compacted = await compactClubDataset(syncedClubs);
    const sanitized = cleanUndefined(compacted);
    markLocalWrite("clubs");
    try {
      localStorage.setItem("src_clubs_roster", JSON.stringify(sanitized));
    } catch (lsErr) {
      console.warn("Direct localStorage write notice for clubs, applying fallback:", lsErr);
      try {
        // Strip heavy presentation banners if quota is reached, but NEVER strip member/leader avatars (Directive #4)
        const stripped = sanitized.map((c: any) => ({
          ...c,
          cardImage: c.cardImage?.startsWith("data:") && c.cardImage.length > 50000 ? "" : c.cardImage,
          headerImage: c.headerImage?.startsWith("data:") && c.headerImage.length > 50000 ? "" : c.headerImage,
          lead: c.lead ? { ...c.lead, avatar: c.lead.avatar || "" } : c.lead,
          coLead: c.coLead ? { ...c.coLead, avatar: c.coLead.avatar || "" } : c.coLead,
          leaders: Array.isArray(c.leaders) ? c.leaders.map((l: any) => ({ ...l, avatar: l.avatar || "" })) : c.leaders,
        }));
        localStorage.setItem("src_clubs_roster", JSON.stringify(stripped));
      } catch {}
    }
    window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_tenures_updated"));
    window.dispatchEvent(new CustomEvent("src_users_updated"));

    // 2. Prepare deduplicated payload for Firestore (strips 4x duplicate base64 from lead/coLead)
    // Single source of truth is leaders[i].avatar, dropping document from 1MB down to ~510KB!
    const cloudPayload = deduplicateClubAvatarsForCloud(sanitized);

    // Direct cloud write & queue backup immediately (Directive #3)
    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore("clubs", cloudPayload);
    } catch (err) {
      console.warn("Firestore direct write for clubs failed, enqueuing:", err);
      cloudWriteError = err;
    }
    enqueueCloudWrite("clubs", cloudPayload, `Clubs Directory (${clubs.length} Clubs)`);

    if (cloudWriteError) {
      const errMsg = cloudWriteError?.message || String(cloudWriteError);
      if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
        throw new Error("Admin session expired. Please refresh the page and sign in again.");
      }
    }
  } catch (e) {
    console.error("Could not save clubs to storage", e);
    throw e;
  }
}

export async function syncClubsFromFirestore(): Promise<ClubItem[]> {
  try {
    const requestTime = Date.now();
    if (hasPendingWritesFor("clubs") || getLastLocalWriteTime("clubs") >= requestTime || isLocalWriteRecent("clubs", 5000)) {
      return getStoredClubs();
    }
    const remote = await getSiteContentFromFirestore<ClubItem[]>("clubs");
    if (hasPendingWritesFor("clubs") || getLastLocalWriteTime("clubs") >= requestTime || isLocalWriteRecent("clubs", 5000)) {
      return getStoredClubs();
    }
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const current = getStoredClubs();
      const merged = reconcileArrayDatasets(current, remote);
      const hydrated = hydrateClubAvatars(merged);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_clubs_roster", JSON.stringify(hydrated));
        } catch (lsErr) {
          console.warn("localStorage quota exceeded for clubs roster:", lsErr);
        }
        window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: hydrated }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      return hydrated;
    }
  } catch (e) {
    console.warn("Could not sync clubs from Firestore:", e);
  }
  return getStoredClubs();
}

export function subscribeToClubs(callback: (clubs: ClubItem[]) => void): () => void {
  return subscribeToSiteContent<ClubItem[]>("clubs", (remote) => {
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      if (hasPendingWritesFor("clubs") || isLocalWriteRecent("clubs", 5000)) return;
      const current = getStoredClubs();
      const merged = reconcileArrayDatasets(current, remote);
      const hydrated = hydrateClubAvatars(merged);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_clubs_roster", JSON.stringify(hydrated));
        } catch (lsErr) {
          console.warn("localStorage quota exceeded for clubs roster in subscription:", lsErr);
        }
        window.dispatchEvent(new CustomEvent("src_clubs_updated", { detail: hydrated }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      callback(hydrated);
    }
  });
}

// Helper to convert Founding Member to Council Admin Officer
export function mapFoundingMemberToCouncilAdmin(founder: TeamMember, idx?: number): TeamMember {
  const customIdx = idx !== undefined ? idx : 0;
  const baseId = getBaseMemberId(founder.id) || `${customIdx + 1}`;
  const adminId = baseId.startsWith("admin-") || baseId.startsWith("member-") ? baseId : `admin-${baseId}`;
  const adminRole = formatFoundingRoleToAdmin(founder.role);
  return {
    ...founder,
    id: adminId,
    designation: adminRole,
    role: adminRole,
    order: founder.order ?? customIdx + 1
  };
}

// Sync Council Admins to Founding Members (1st Tenure)
export function syncCouncilAdminsToFounding(councilList?: TeamMember[], persist = true): TeamMember[] {
  const council = councilList || getStoredCouncilMembers();
  if (!Array.isArray(council) || council.length === 0) return getStoredFoundingMembers();

  let currentFounders = getStoredFoundingMembers();
  if (!Array.isArray(currentFounders) || currentFounders.length === 0) {
    currentFounders = stripCategoryAndLevel(initialFoundingMembers);
  }

  const updatedFounders: TeamMember[] = council.map((admin, idx) => {
    const existing = currentFounders.find((f) => matchCouncilAndFounder(admin, f));
    const baseId = getBaseMemberId(admin.id) || (existing ? getBaseMemberId(existing.id) : "") || `${idx + 1}`;
    const founderId = `founder-${baseId}`;
    const foundingRole = formatAdminRoleToFounding(admin.role);

    let cleanBt = admin.btId || existing?.btId || "";
    if ((/mentor/i.test(admin.role || "") || (admin.name && /sarvashree|munesh/i.test(admin.name))) && (cleanBt === "BT240115DS" || cleanBt === "BT000000CS")) {
      cleanBt = "";
    }

    return {
      ...admin,
      id: founderId,
      role: foundingRole,
      designation: foundingRole,
      avatar: (admin.avatar && admin.avatar.length > 10) ? admin.avatar : (existing?.avatar || ""),
      email: admin.email || existing?.email || "",
      linkedin: admin.linkedin || existing?.linkedin || "",
      bio: admin.bio || existing?.bio || "",
      btId: cleanBt,
      department: admin.department || existing?.department || "",
      year: admin.year || existing?.year || "3rd Year",
      order: admin.order ?? idx + 1,
    };
  });

  const deduplicated = deduplicateTeamMembers(updatedFounders);

  if (persist) {
    saveStoredFoundingMembers(deduplicated, false);
  }
  return deduplicated;
}

// Sync Founding Members to Council Admins (1st Tenure)
export function syncFoundingToCouncilAdmins(foundingList?: TeamMember[], persist = true): TeamMember[] {
  const founders = foundingList || getStoredFoundingMembers();
  if (!Array.isArray(founders) || founders.length === 0) return getStoredCouncilMembers();

  let currentCouncil = getStoredCouncilMembers();
  if (!Array.isArray(currentCouncil) || currentCouncil.length === 0) {
    currentCouncil = stripCategoryAndLevel(initialAdminCouncil);
  }

  const updatedCouncil: TeamMember[] = founders.map((founder, idx) => {
    const existing = currentCouncil.find((a) => matchCouncilAndFounder(founder, a));
    const baseId = getBaseMemberId(founder.id) || (existing ? getBaseMemberId(existing.id) : "") || `${idx + 1}`;
    const adminId = existing?.id || (baseId.startsWith("admin-") || baseId.startsWith("member-") ? baseId : `admin-${baseId}`);
    const adminRole = formatFoundingRoleToAdmin(founder.role);

    let cleanBt = founder.btId || existing?.btId || "";
    if ((/mentor/i.test(founder.role || "") || (founder.name && /sarvashree|munesh/i.test(founder.name))) && (cleanBt === "BT240115DS" || cleanBt === "BT000000CS")) {
      cleanBt = "";
    }

    return {
      ...founder,
      id: adminId,
      role: adminRole,
      designation: adminRole,
      avatar: (founder.avatar && founder.avatar.length > 10) ? founder.avatar : (existing?.avatar || ""),
      email: founder.email || existing?.email || "",
      linkedin: founder.linkedin || existing?.linkedin || "",
      bio: founder.bio || existing?.bio || "",
      btId: cleanBt,
      department: founder.department || existing?.department || "",
      year: founder.year || existing?.year || "3rd Year",
      order: founder.order ?? idx + 1,
    };
  });

  if (persist) {
    saveStoredCouncilMembers(updatedCouncil, false);
  }
  return updatedCouncil;
}

// Automatic reconciliation between Council Admins and Founding Members
export function reconcileCouncilAndFoundingSync(): TeamMember[] {
  if (typeof window === "undefined") return getStoredFoundingMembers();
  try {
    let council = getStoredCouncilMembers();
    if (!Array.isArray(council) || council.length === 0) return getStoredFoundingMembers();

    const { repaired, members: repairedCouncil } = repairCouncilSwapIfNeeded(council, false);
    if (repaired) {
      council = repairedCouncil;
      try {
        localStorage.setItem("src_council_team", JSON.stringify(cleanUndefined(stripCategoryAndLevel(council))));
      } catch {}
    }

    const founders = getStoredFoundingMembers();
    
    let needsSync = false;
    if (council.length !== founders.length) {
      needsSync = true;
    } else {
      for (let i = 0; i < council.length; i++) {
        const c = council[i];
        const f = founders.find((item) => matchCouncilAndFounder(c, item));
        if (!f) {
          needsSync = true;
          break;
        }
        if (c.avatar && c.avatar !== f.avatar) {
          needsSync = true;
          break;
        }
        if (c.name && c.name !== f.name) {
          needsSync = true;
          break;
        }
        if (c.department && c.department !== f.department) {
          needsSync = true;
          break;
        }
        if (c.btId && c.btId !== f.btId) {
          needsSync = true;
          break;
        }
      }
    }

    if (needsSync) {
      return syncCouncilAdminsToFounding(council, true);
    }
  } catch (e) {
    console.warn("reconcileCouncilAndFoundingSync notice:", e);
  }
  return getStoredFoundingMembers();
}

// Founding Members Store
export function getStoredFoundingMembers(): TeamMember[] {
  if (typeof window === "undefined") return deduplicateTeamMembers(stripCategoryAndLevel(initialFoundingMembers));
  try {
    const stored = localStorage.getItem("src_founding_members");
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        let { repaired, members } = repairCouncilSwapIfNeeded(stripCategoryAndLevel(parsed), true);
        members = deduplicateTeamMembers(members);
        // Auto-heal missing canonical pioneers from initialFoundingMembers (13 canonical positions)
        if (members.length < initialFoundingMembers.length) {
          let healed = false;
          for (const canon of initialFoundingMembers) {
            if (!members.some((m) => matchCouncilAndFounder(m, canon))) {
              members.push(canon);
              healed = true;
            }
          }
          if (healed) {
            members = deduplicateTeamMembers(members);
            members.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
            repaired = true;
          }
        }
        if (repaired && typeof window !== "undefined") {
          try {
            localStorage.setItem("src_founding_members", JSON.stringify(members));
          } catch {}
        }
        return deduplicateTeamMembers(members);
      }
    }
  } catch (e) {
    console.warn("Could not read founding members from storage", e);
  }
  return deduplicateTeamMembers(stripCategoryAndLevel(initialFoundingMembers));
}

export async function saveStoredFoundingMembers(members: TeamMember[], autoSyncToCouncil = true): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const sanitized = cleanUndefined(deduplicateTeamMembers(stripCategoryAndLevel(members)));
    markLocalWrite("founding_members");
    try {
      localStorage.setItem("src_founding_members", JSON.stringify(sanitized));
    } catch (lsErr) {
      console.warn("Direct localStorage write notice for founders, auto-compacting...", lsErr);
    }

    window.dispatchEvent(new CustomEvent("src_founding_members_updated", { detail: sanitized }));
    window.dispatchEvent(new CustomEvent("src_tenures_updated"));
    window.dispatchEvent(new CustomEvent("src_users_updated"));

    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore("founding_members", sanitized);
    } catch (err) {
      console.warn("Firestore direct write for founding members failed, enqueuing:", err);
      cloudWriteError = err;
    }
    enqueueCloudWrite("founding_members", sanitized, `Founding Members (${members.length} Members)`);

    compactCouncilDataset(sanitized).then((compacted) => {
      const finalClean = cleanUndefined(compacted);
      try {
        localStorage.setItem("src_founding_members", JSON.stringify(finalClean));
      } catch {}
      saveSiteContentToFirestore("founding_members", finalClean).catch(() => {});
    });

    if (autoSyncToCouncil && Array.isArray(sanitized)) {
      syncFoundingToCouncilAdmins(sanitized, true);
    }

    if (cloudWriteError) {
      const errMsg = cloudWriteError?.message || String(cloudWriteError);
      if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
        throw new Error("Admin session expired. Please refresh the page and sign in again.");
      }
    }
  } catch (e) {
    console.error("Could not save founding members to storage", e);
    throw e;
  }
}

export async function syncFoundingMembersFromFirestore(): Promise<TeamMember[]> {
  try {
    const requestTime = Date.now();
    if (hasPendingWritesFor("founding_members") || getLastLocalWriteTime("founding_members") >= requestTime) {
      return getStoredFoundingMembers();
    }
    const remote = await getSiteContentFromFirestore<TeamMember[]>("founding_members");
    if (hasPendingWritesFor("founding_members") || getLastLocalWriteTime("founding_members") >= requestTime) {
      return getStoredFoundingMembers();
    }
    if (remote !== null && Array.isArray(remote)) {
      const current = getStoredFoundingMembers();
      let merged = deduplicateTeamMembers(stripCategoryAndLevel(reconcileArrayDatasets(current, remote)));
      const { repaired, members } = repairCouncilSwapIfNeeded(merged, true);
      if (repaired) {
        merged = deduplicateTeamMembers(members);
      }
      // If council has members and remote founding members count is out of sync, auto-heal from council (1st tenure 1:1)
      const currentCouncil = getStoredCouncilMembers();
      if (currentCouncil.length > 0 && merged.length !== currentCouncil.length) {
        merged = syncCouncilAdminsToFounding(currentCouncil, true);
        return merged;
      }
      if (merged.length < initialFoundingMembers.length) {
        let healed = false;
        for (const canon of initialFoundingMembers) {
          if (!merged.some((m) => matchCouncilAndFounder(m, canon))) {
            merged.push(canon);
            healed = true;
          }
        }
        if (healed) {
          merged = deduplicateTeamMembers(merged);
          merged.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
          saveSiteContentToFirestore("founding_members", cleanUndefined(merged)).catch(() => {});
        }
      }

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_founding_members", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_founding_members_updated", { detail: merged }));
        window.dispatchEvent(new CustomEvent("src_users_updated"));
      }
      return merged;
    }
  } catch {}
  return getStoredFoundingMembers();
}

export function subscribeToFoundingMembers(callback: (members: TeamMember[]) => void): () => void {
  return subscribeToSiteContent<TeamMember[]>("founding_members", (remote) => {
    if (remote !== null && Array.isArray(remote)) {
      if (hasPendingWritesFor("founding_members")) return;
      const current = getStoredFoundingMembers();
      let merged = deduplicateTeamMembers(stripCategoryAndLevel(reconcileArrayDatasets(current, remote)));
      const { repaired, members } = repairCouncilSwapIfNeeded(merged, true);
      if (repaired) {
        merged = deduplicateTeamMembers(members);
        saveStoredFoundingMembers(merged, true);
      } else {
        const currentCouncil = getStoredCouncilMembers();
        if (currentCouncil.length > 0 && merged.length !== currentCouncil.length) {
          merged = syncCouncilAdminsToFounding(currentCouncil, true);
          callback(merged);
          return;
        }
        if (merged.length < initialFoundingMembers.length) {
          let healed = false;
          for (const canon of initialFoundingMembers) {
            if (!merged.some((m) => matchCouncilAndFounder(m, canon))) {
              merged.push(canon);
              healed = true;
            }
          }
          if (healed) {
            merged = deduplicateTeamMembers(merged);
            merged.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
            saveStoredFoundingMembers(merged, true);
            callback(merged);
            return;
          }
        }
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("src_founding_members", JSON.stringify(merged));
          } catch {}
          window.dispatchEvent(new CustomEvent("src_founding_members_updated", { detail: merged }));
          window.dispatchEvent(new CustomEvent("src_users_updated"));
        }
      }
      callback(merged);
    }
  });
}

function stripPillarRole(pillars: any[]): InstitutionalPillar[] {
  if (!Array.isArray(pillars)) return [];
  return pillars.map((p) => {
    if (!p || typeof p !== "object") return p;
    const copy = { ...p };
    delete copy.role;
    return copy as InstitutionalPillar;
  });
}

// 5. 4 PILLARS OF STRENGTH (INSTITUTIONAL PATRONS & FACULTY MENTORS)
export function getStoredInstitutionalPillars(): InstitutionalPillar[] {
  if (typeof window === "undefined") return stripPillarRole(initialPillars);
  try {
    const stored = localStorage.getItem("src_pillars_of_strength");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return stripPillarRole(parsed);
    }
  } catch (e) {
    console.warn("Could not read pillars from storage", e);
  }
  return stripPillarRole(initialPillars);
}

export async function saveStoredInstitutionalPillars(pillars: InstitutionalPillar[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const cleanedPillars = stripPillarRole(pillars);
    const compacted = await compactPillarsDataset(cleanedPillars);
    const sanitized = cleanUndefined(compacted);
    try {
      localStorage.setItem("src_pillars_of_strength", JSON.stringify(sanitized));
    } catch (lsErr) {
      console.warn("Direct localStorage write notice for pillars, auto-compacting...", lsErr);
    }
    window.dispatchEvent(new CustomEvent("src_pillars_updated", { detail: sanitized }));

    // Direct cloud write to Firestore site_content/pillars_of_strength
    let cloudWriteError: any = null;
    try {
      await saveSiteContentToFirestore("pillars_of_strength", sanitized);
    } catch (err) {
      console.warn("Firestore direct write for pillars failed, enqueuing:", err);
      cloudWriteError = err;
    }
    enqueueCloudWrite("pillars_of_strength", sanitized, `4 Pillars of Strength (${pillars.length} Patrons)`);

    if (cloudWriteError) {
      const errMsg = cloudWriteError?.message || String(cloudWriteError);
      if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
        throw new Error("Admin session expired. Please refresh the page and sign in again.");
      }
    }
  } catch (e) {
    console.error("Could not save pillars to storage", e);
    throw e;
  }
}

export async function syncInstitutionalPillarsFromFirestore(): Promise<InstitutionalPillar[]> {
  try {
    if (hasPendingWritesFor("pillars_of_strength")) return getStoredInstitutionalPillars();
    const remote = await getSiteContentFromFirestore<InstitutionalPillar[]>("pillars_of_strength");
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      const current = getStoredInstitutionalPillars();
      const merged = stripPillarRole(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_pillars_of_strength", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_pillars_updated", { detail: merged }));
      }
      return merged;
    }
  } catch {}
  return getStoredInstitutionalPillars();
}

export function subscribeToInstitutionalPillars(callback: (pillars: InstitutionalPillar[]) => void): () => void {
  return subscribeToSiteContent<InstitutionalPillar[]>("pillars_of_strength", (remote) => {
    if (remote !== null && Array.isArray(remote) && remote.length > 0) {
      if (hasPendingWritesFor("pillars_of_strength")) return;
      const current = getStoredInstitutionalPillars();
      const merged = stripPillarRole(reconcileArrayDatasets(current, remote));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_pillars_of_strength", JSON.stringify(merged));
        } catch {}
        window.dispatchEvent(new CustomEvent("src_pillars_updated", { detail: merged }));
      }
      callback(merged);
    }
  });
}


