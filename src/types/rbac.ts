export type AdminAccessRole =
  | "OWNER"
  | "TREASURER"
  | "PROTOCOL_OFFICER"
  | "CLUB_OWNER";

export type AdminCapability =
  | "all"
  | "payments"
  | "src_operations"
  | "club_manage"
  | "events_manage"
  | "engagement_manage"
  | "club_registrations";

export interface AdminAccessAssignment {
  uid: string;
  btId: string;
  role: AdminAccessRole;
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
  CLUB_OWNER: "Club Owner",
};

// Break-glass owner identities. The first value may be overridden at deploy time.
export const DEFAULT_OWNER_EMAILS = [
  "shendeha@jdcoem.ac.in",
  "harshshende0718@gmail.com",
];

export function isOwnerEmail(email?: string | null): boolean {
  const configured = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SRC_OWNER_EMAIL : undefined;
  const allowed = [configured, ...DEFAULT_OWNER_EMAILS]
    .filter(Boolean)
    .map((value) => value!.trim().toLowerCase());
  return Boolean(email && allowed.includes(email.trim().toLowerCase()));
}

export const ADMIN_ROLE_CAPABILITIES: Record<AdminAccessRole, AdminCapability[]> = {
  OWNER: ["all"],
  TREASURER: ["payments"],
  PROTOCOL_OFFICER: ["src_operations"],
  CLUB_OWNER: [
    "club_manage",
    "events_manage",
    "engagement_manage",
    "club_registrations",
  ],
};

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
  if (pathname.startsWith("/admin/payments")) return ["payments"];
  if (pathname.startsWith("/admin/src-updates")) return ["src_operations"];
  if (pathname.startsWith("/admin/clubs")) return ["club_manage"];
  if (pathname.startsWith("/admin/events")) return ["events_manage"];
  if (pathname.startsWith("/admin/listings")) return ["engagement_manage"];
  if (pathname.startsWith("/admin/registrations")) return ["club_registrations"];
  return ["all"];
}
