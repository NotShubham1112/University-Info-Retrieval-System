/**
 * RBAC permission matrix (Task 4, spec §6) — mirrors `supabase/migrations/0008_v4_rbac_seed.sql`.
 *
 * - 5 roles, 11 permission keys seeded as data (not just code).
 * - `getUserRole(user)` reads JWT `role` claim or Supabase `user_metadata` fallbacks.
 * - `hasPermission(user, key)` / `assertPermission(user, key)` for every admin route + UI gate.
 * - `requireDashboardAccess` stub for Task 5 (viewer vs admin tree).
 */

// ---------------------------------------------------------------------------
// Constants — mirrors 0008 seed
// ---------------------------------------------------------------------------
export const ROLES = [
  "super_admin",
  "admin",
  "teacher",
  "accountant",
  "viewer",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "student:write",
  "student:delete",
  "fees:read",
  "fees:approve",
  "docs:verify",
  "timetable:write",
  "exam:publish",
  "teacher:write",
  "course:write",
  "attendance:write",
  "notification:send",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

// Grant matrix as data — matches 0008_v4_rbac_seed.sql
export const ROLE_PERMISSIONS: Record<Role, readonly PermissionKey[]> = {
  super_admin: [
    "student:write",
    "student:delete",
    "fees:read",
    "fees:approve",
    "docs:verify",
    "timetable:write",
    "exam:publish",
    "teacher:write",
    "course:write",
    "attendance:write",
    "notification:send",
  ],
  admin: [
    // all except docs:verify (per seed)
    "student:write",
    "student:delete",
    "fees:read",
    "fees:approve",
    "timetable:write",
    "exam:publish",
    "teacher:write",
    "course:write",
    "attendance:write",
    "notification:send",
  ],
  teacher: ["attendance:write", "exam:publish", "timetable:write"],
  accountant: ["fees:read", "fees:approve"],
  viewer: [],
} as const;

// Quick lookup set per role
const ROLE_PERMISSION_SETS: Record<Role, ReadonlySet<PermissionKey>> = {
  super_admin: new Set(ROLE_PERMISSIONS.super_admin),
  admin: new Set(ROLE_PERMISSIONS.admin),
  teacher: new Set(ROLE_PERMISSIONS.teacher),
  accountant: new Set(ROLE_PERMISSIONS.accountant),
  viewer: new Set(ROLE_PERMISSIONS.viewer),
};

// ---------------------------------------------------------------------------
// User role extraction
// ---------------------------------------------------------------------------
export type AuthUserLike = {
  id?: string;
  sub?: string;
  email?: string;
  role?: string;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
} | null
  | undefined;

/**
 * Extract the caller's Role from a Supabase/JWT user shape.
 * Checks (in order): `user.role`, `app_metadata.role`, `user_metadata.role`.
 * Falls back to `'viewer'` for any authenticated user with no explicit role (matches
 * `current_user_role()` default in `0009_v4_indexes_rls.sql`).
 * Returns `null` for unauthenticated (null/undefined user).
 */
export function getUserRole(user: AuthUserLike): Role | null {
  if (!user || typeof user !== "object") return null;

  const u = user as Record<string, unknown>;
  const appMeta = (u["app_metadata"] as Record<string, unknown> | null) ?? null;
  const userMeta = (u["user_metadata"] as Record<string, unknown> | null) ?? null;

  const candidates: unknown[] = [
    u["role"],
    appMeta?.["role"],
    userMeta?.["role"],
    // legacy fallbacks
    appMeta?.["user_role"],
    userMeta?.["user_role"],
  ];

  for (const c of candidates) {
    if (typeof c === "string" && (ROLES as readonly string[]).includes(c)) {
      return c as Role;
    }
  }

  // Authenticated but no role claim → viewer (matches DB helper default)
  if (typeof u["id"] === "string" || typeof u["sub"] === "string" || typeof u["email"] === "string") {
    return "viewer";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Permission checks
// ---------------------------------------------------------------------------
export function hasPermission(
  user: AuthUserLike,
  permission: PermissionKey,
): boolean {
  const role = getUserRole(user);
  if (!role) return false;
  return ROLE_PERMISSION_SETS[role].has(permission);
}

export class PermissionDeniedError extends Error {
  status = 403 as const;
  code = "FORBIDDEN" as const;
  permission: PermissionKey;
  role: Role | null;

  constructor(permission: PermissionKey, role: Role | null) {
    super(`Forbidden: role '${role ?? "none"}' lacks permission '${permission}'`);
    this.name = "PermissionDeniedError";
    this.permission = permission;
    this.role = role;
  }
}

/**
 * Throw `PermissionDeniedError` (403) if the caller lacks the permission.
 * Use in API routes before any mutation; catch and map to `fail(403, ...)` in `src/lib/admin.ts`.
 */
export function assertPermission(
  user: AuthUserLike,
  permission: PermissionKey,
): void {
  if (!hasPermission(user, permission)) {
    throw new PermissionDeniedError(permission, getUserRole(user));
  }
}

// ---------------------------------------------------------------------------
// Dashboard access (Task 5 stub — implemented here so Task 5 only extends it)
// ---------------------------------------------------------------------------
export type DashboardKind = "viewer" | "admin";

/**
 * Whether a role may access a dashboard tree.
 * - viewer: any authenticated role (including `viewer`) may read.
 * - admin: requires `super_admin`/`admin` OR `student:write` (covers future granular admins).
 * Returns boolean (no throw) — middleware/route can redirect on false.
 */
export function canAccessDashboard(
  role: Role | null,
  kind: DashboardKind,
): boolean {
  if (!role) return false;
  if (kind === "viewer") return true;
  // admin tree
  if (role === "super_admin" || role === "admin") return true;
  // granular: any role that has student:write
  return ROLE_PERMISSION_SETS[role].has("student:write");
}

/**
 * Throw if the role may not access the dashboard kind. Mirrors `canAccessDashboard`.
 * Useful in server components: `requireDashboardAccess(getUserRole(user), 'admin')`.
 */
export function requireDashboardAccess(
  role: Role | null,
  kind: DashboardKind,
): void {
  if (!canAccessDashboard(role, kind)) {
    throw new PermissionDeniedError(
      "student:write" as PermissionKey,
      role,
    );
  }
}
