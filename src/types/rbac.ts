export type AdminAccessRole =
  | "OWNER"
  | "TREASURER"
  | "PROTOCOL_OFFICER"
  | "CHIEF_EDITOR"
  | "PUBLIC_RELATIONS_OFFICER"
  | "CLUB_OWNER"
  | "EVENT_COORDINATOR";

export type AdminCapability =
  | "all"
  | "payments"
  | "src_operations"
  | "gallery_manage"
  | "users_manage"
  | "club_manage"
  | "events_manage"
  | "engagement_manage"
  | "club_registrations";

export interface AdminAccessClubScope {
  id: string;
  slug: string;
  name: string;
}

export interface AdminAccessAssignment {
  uid: string;
  btId: string;
  role: AdminAccessRole;
  name?: string;
  email?: string;
  clubId?: string;
  clubSlug?: string;
  clubName?: string;
  clubIds?: string[];
  clubSlugs?: string[];
  clubNames?: string[];
  clubs?: AdminAccessClubScope[];
  tenureId?: string;
  active: boolean;
  grantedBy: string;
  grantedAt: string;
  updatedAt: string;
  hasEventCoordinatorAccess?: boolean;
}

export const ADMIN_ROLE_LABELS: Record<AdminAccessRole, string> = {
  OWNER: "Owner",
  TREASURER: "Treasurer",
  PROTOCOL_OFFICER: "Protocol Officer",
  CHIEF_EDITOR: "Chief Editor",
  PUBLIC_RELATIONS_OFFICER: "Public Relations Officer",
  CLUB_OWNER: "Club Owner",
  EVENT_COORDINATOR: "Event Coordinator",
};

// Break-glass owner identities. The first value may be overridden at deploy time.
export const DEFAULT_OWNER_EMAILS = [
  "shendeha@jdcoem.ac.in",
  "harshshende0718@gmail.com",
  "harshxfr@gmail.com",
  "studentrepresentcouncil@jdcoem.ac.in",
  "admin@jdcoem.ac.in",
  "src.president@jdcoem.ac.in",
  "src.mentor@jdcoem.ac.in",
  "src.gensec@jdcoem.ac.in",
];

export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const configured = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SRC_OWNER_EMAIL : undefined;
  const configuredList = configured ? configured.split(",").map((e) => e.trim().toLowerCase()) : [];
  const allowed = [...configuredList, ...DEFAULT_OWNER_EMAILS]
    .filter(Boolean)
    .map((value) => value.trim().toLowerCase());
  return allowed.includes(email.trim().toLowerCase());
}

export const ADMIN_ROLE_CAPABILITIES: Record<AdminAccessRole, AdminCapability[]> = {
  OWNER: ["all"],
  TREASURER: ["payments"],
  PROTOCOL_OFFICER: ["src_operations"],
  CHIEF_EDITOR: ["gallery_manage"],
  PUBLIC_RELATIONS_OFFICER: ["users_manage"],
  CLUB_OWNER: [
    "club_manage",
    "events_manage",
    "engagement_manage",
    "club_registrations",
    "payments",
  ],
  EVENT_COORDINATOR: [
    "events_manage",
    "club_registrations",
    "payments",
  ],
};

export function getDefaultAdminRoute(role?: AdminAccessRole | null): string {
  switch (role) {
    case "TREASURER":
      return "/admin/payments";
    case "PROTOCOL_OFFICER":
      return "/admin/src-updates";
    case "CHIEF_EDITOR":
      return "/admin/gallery";
    case "PUBLIC_RELATIONS_OFFICER":
      return "/admin/users";
    case "CLUB_OWNER":
      return "/admin/clubs";
    case "EVENT_COORDINATOR":
      return "/admin/events";
    case "OWNER":
    default:
      return "/admin";
  }
}


export function normalizeBtId(btId?: string | null): string {
  return (btId || "").trim().toUpperCase();
}

export function isActiveAssignment(
  assignment?: Partial<AdminAccessAssignment> | null
): assignment is AdminAccessAssignment {
  return Boolean(assignment?.active !== false && assignment?.role && assignment?.uid);
}

export function hasAdminCapability(
  assignment: Partial<AdminAccessAssignment> | null | undefined,
  capability: AdminCapability,
  club?: { id?: string; slug?: string; name?: string }
): boolean {
  if (!isActiveAssignment(assignment)) return false;
  if (assignment.role === "OWNER") return true;
  if (assignment.hasEventCoordinatorAccess && ADMIN_ROLE_CAPABILITIES.EVENT_COORDINATOR.includes(capability) && !club) {
    return true;
  }
  if (!ADMIN_ROLE_CAPABILITIES[assignment.role].includes(capability)) return false;
  if (assignment.role !== "CLUB_OWNER" || !club) return true;

  return isEntityOwnedByClub(club, assignment);
}

export function adminRouteCapabilities(pathname: string): AdminCapability[] {
  if (pathname === "/admin" || pathname === "/admin/roles") {
    return ["all"];
  }
  if (pathname.startsWith("/admin/users")) return ["users_manage"];
  if (pathname.startsWith("/admin/gallery")) return ["gallery_manage"];
  if (pathname.startsWith("/admin/payments")) return ["payments"];
  if (pathname.startsWith("/admin/src-updates")) return ["src_operations"];
  if (pathname.startsWith("/admin/clubs")) return ["club_manage"];
  if (pathname.startsWith("/admin/events")) return ["events_manage"];
  if (pathname.startsWith("/admin/listings")) return ["engagement_manage"];
  if (pathname.startsWith("/admin/registrations")) return ["club_registrations"];
  return ["all"];
}

/**
 * Strict Club Ownership Verification
 * Checks whether an event, listing, or registration record belongs to any of the assigned clubs.
 * Supports multiple clubs (clubIds, clubSlugs, clubNames, clubs). Matches by slug, id, or normalized organizer name.
 */
export function isEntityOwnedByClub(
  entity: { organizerClubSlug?: string; organizer?: string; clubId?: string; clubSlug?: string; clubName?: string; id?: string; slug?: string; name?: string } | null | undefined,
  assignedClub?: (Partial<AdminAccessAssignment> & { clubId?: string; clubSlug?: string; clubName?: string }) | null
): boolean {
  if (!entity || !assignedClub) return false;

  const targetSlugs = new Set<string>();
  const targetIds = new Set<string>();
  const targetNames = new Set<string>();

  if (assignedClub.clubSlug) targetSlugs.add(assignedClub.clubSlug.toLowerCase().trim());
  if (assignedClub.clubSlugs && Array.isArray(assignedClub.clubSlugs)) {
    assignedClub.clubSlugs.forEach((s) => s && targetSlugs.add(s.toLowerCase().trim()));
  }

  if (assignedClub.clubId) targetIds.add(assignedClub.clubId.toLowerCase().trim());
  if (assignedClub.clubIds && Array.isArray(assignedClub.clubIds)) {
    assignedClub.clubIds.forEach((i) => i && targetIds.add(i.toLowerCase().trim()));
  }

  if (assignedClub.clubName) targetNames.add(assignedClub.clubName.toLowerCase().trim());
  if (assignedClub.clubNames && Array.isArray(assignedClub.clubNames)) {
    assignedClub.clubNames.forEach((n) => n && targetNames.add(n.toLowerCase().trim()));
  }

  if (assignedClub.clubs && Array.isArray(assignedClub.clubs)) {
    assignedClub.clubs.forEach((c) => {
      if (c.slug) targetSlugs.add(c.slug.toLowerCase().trim());
      if (c.id) targetIds.add(c.id.toLowerCase().trim());
      if (c.name) targetNames.add(c.name.toLowerCase().trim());
    });
  }

  if (targetSlugs.size === 0 && targetIds.size === 0 && targetNames.size === 0) return false;

  const evSlug = (entity.organizerClubSlug || entity.clubSlug || entity.slug || "").toLowerCase().trim();
  const evId = (entity.clubId || entity.id || "").toLowerCase().trim();
  const evOrg = (entity.organizer || entity.clubName || entity.name || "").toLowerCase().trim();

  // 1. Direct slug match
  if (evSlug) {
    if (targetSlugs.has(evSlug)) return true;
    const cleanEv = evSlug.replace(/^club-/, "");
    for (const ts of targetSlugs) {
      const cleanTarget = ts.replace(/^club-/, "");
      if (cleanTarget && cleanEv && cleanTarget === cleanEv) return true;
    }
  }

  // 2. Direct ID match
  if (evId) {
    if (targetIds.has(evId)) return true;
    if (targetSlugs.has(evId)) return true;
  }
  if (evSlug && targetIds.has(evSlug)) return true;

  // 3. Organizer name match (e.g. "Agentic AI", "SRC Agentic AI", "Agentic AI Club")
  if (evOrg) {
    if (targetNames.has(evOrg)) return true;
    const cleanEvOrg = evOrg.replace(/^src\s+/i, "").replace(/\s+club$/i, "").trim();
    for (const tn of targetNames) {
      if (evOrg === `src ${tn}`) return true;
      const cleanTarget = tn.replace(/^src\s+/i, "").replace(/\s+club$/i, "").trim();
      if (cleanEvOrg && cleanTarget && cleanEvOrg === cleanTarget) return true;
    }
  }

  return false;
}
