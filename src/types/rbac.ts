export type AdminAccessRole =
  | "OWNER"
  | "TREASURER"
  | "PROTOCOL_OFFICER"
  | "CHIEF_EDITOR"
  | "CLUB_OWNER";

export type AdminCapability =
  | "all"
  | "payments"
  | "src_operations"
  | "gallery_manage"
  | "club_manage"
  | "events_manage"
  | "engagement_manage"
  | "club_registrations";

export interface AdminAccessAssignment {
  uid: string;
  btId: string;
  role: AdminAccessRole;
  name?: string;
  clubId?: string;
  clubSlug?: string;
  clubName?: string;
  tenureId?: string;
  active: boolean;
  grantedBy: string;
  grantedAt: string;
  updatedAt: string;
}

export const ADMIN_ROLE_LABELS: Record<AdminAccessRole, string> = {
  OWNER: "Owner",
  TREASURER: "Treasurer",
  PROTOCOL_OFFICER: "Protocol Officer",
  CHIEF_EDITOR: "Chief Editor",
  CLUB_OWNER: "Club Owner",
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
  CLUB_OWNER: [
    "club_manage",
    "events_manage",
    "engagement_manage",
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
    case "CLUB_OWNER":
      return "/admin/clubs";
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
  if (!ADMIN_ROLE_CAPABILITIES[assignment.role].includes(capability)) return false;
  if (assignment.role !== "CLUB_OWNER" || !club) return true;

  const requested = [club.id, club.slug, club.name].filter(Boolean).map((value) => value!.toLowerCase());
  const assigned = [assignment.clubId, assignment.clubSlug, assignment.clubName]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());
  return requested.some((value) => assigned.includes(value));
}

export function adminRouteCapabilities(pathname: string): AdminCapability[] {
  if (pathname === "/admin" || pathname === "/admin/users" || pathname === "/admin/roles") {
    return ["all"];
  }
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
 * Checks whether an event, listing, or registration record belongs to the assigned club.
 * Matches by slug, id, or normalized organizer name.
 */
export function isEntityOwnedByClub(
  entity: { organizerClubSlug?: string; organizer?: string; clubId?: string; clubSlug?: string; clubName?: string; id?: string; slug?: string; name?: string } | null | undefined,
  assignedClub?: { clubId?: string; clubSlug?: string; clubName?: string } | null
): boolean {
  if (!entity || !assignedClub) return false;
  const targetSlug = (assignedClub.clubSlug || "").toLowerCase().trim();
  const targetId = (assignedClub.clubId || "").toLowerCase().trim();
  const targetName = (assignedClub.clubName || "").toLowerCase().trim();

  if (!targetSlug && !targetId && !targetName) return false;

  const evSlug = (entity.organizerClubSlug || entity.clubSlug || entity.slug || "").toLowerCase().trim();
  const evId = (entity.clubId || entity.id || "").toLowerCase().trim();
  const evOrg = (entity.organizer || entity.clubName || entity.name || "").toLowerCase().trim();

  // 1. Direct slug match
  if (targetSlug && evSlug) {
    if (evSlug === targetSlug) return true;
    const cleanTarget = targetSlug.replace(/^club-/, "");
    const cleanEv = evSlug.replace(/^club-/, "");
    if (cleanTarget && cleanEv && cleanTarget === cleanEv) return true;
  }

  // 2. Direct ID match
  if (targetId && (evId === targetId || evSlug === targetId)) {
    return true;
  }

  // 3. Organizer name match (e.g. "Agentic AI", "SRC Agentic AI", "Agentic AI Club")
  if (targetName && evOrg) {
    if (evOrg === targetName) return true;
    if (evOrg === `src ${targetName}`) return true;
    const cleanEvOrg = evOrg.replace(/^src\s+/i, "").replace(/\s+club$/i, "").trim();
    const cleanTarget = targetName.replace(/^src\s+/i, "").replace(/\s+club$/i, "").trim();
    if (cleanEvOrg && cleanTarget && cleanEvOrg === cleanTarget) return true;
  }

  return false;
}
