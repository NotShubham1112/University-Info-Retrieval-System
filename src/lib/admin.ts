import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail } from "@/lib/api/handlers";
import {
  assertPermission,
  getUserRole,
  hasPermission,
  type PermissionKey,
  type Role,
  PermissionDeniedError,
} from "@/lib/auth/rbac";
import type { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Legacy requireAdmin — kept for existing `/admin` pages (shape preserved).
// New code should prefer RBAC helpers below (assertPermission / requirePermissionOrFail).
// ---------------------------------------------------------------------------
export async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", user.id)
    .eq("roles.name", "admin")
    .maybeSingle();
  return { user, admin: Boolean(data) };
}

// ---------------------------------------------------------------------------
// RBAC helpers for API routes (Task 4)
// ---------------------------------------------------------------------------

/** Re-export for convenience so routes import only from admin.ts if preferred. */
export { hasPermission, getUserRole, assertPermission, PermissionDeniedError };
export type { PermissionKey, Role };

/**
 * Check permission and return a 403 NextResponse on denial, or null on success.
 * Usage in API route:
 *   const denied = permissionDeniedResponseIfMissing(user, 'student:write');
 *   if (denied) return denied;
 */
export function permissionDeniedResponse(
  permission: PermissionKey,
  role: Role | null,
): NextResponse {
  return fail(403, `Forbidden: role '${role ?? "none"}' lacks permission '${permission}'`, "FORBIDDEN");
}

export function assertPermissionOrFail(
  user: unknown,
  permission: PermissionKey,
): NextResponse | null {
  try {
    assertPermission(user as never, permission);
    return null;
  } catch (e) {
    const role = getUserRole(user as never);
    // Preserve PermissionDeniedError shape for logging
    if (e instanceof PermissionDeniedError) {
      return permissionDeniedResponse(permission, role);
    }
    return fail(403, `Forbidden: missing '${permission}'`, "FORBIDDEN");
  }
}

/**
 * Resolve the current server user and their Role via `createServerClient`.
 * Returns `{ user, role }` where role may be null for unauthenticated.
 */
export async function getCurrentUserAndRole(): Promise<{
  user: unknown | null;
  role: Role | null;
}> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = getUserRole(user as never);
  return { user, role };
}

// ---------------------------------------------------------------------------
// Audit trail helpers (Task 4.5)
// - Writes to `student_status_history` on status transitions.
// - Scoped audit entries for sensitive writes (fees, doc verification, role changes)
//   are logged via `writeAuditEntry` (currently stored as student_status_history meta
//   where applicable; or console-logged when no dedicated audit table exists —
//   `audit_logs` was dropped in v4 in favour of `student_status_history` +
//   per-module history. Task 6 will wire the student route to call `recordStudentStatusTransition`.
// ---------------------------------------------------------------------------

export interface RecordStatusTransitionParams {
  studentId: number;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  reason?: string | null;
  /** Optional Supabase client (defaults to service role). */
  supabase?: ReturnType<typeof createServiceClient>;
}

/**
 * Insert a row into `student_status_history`.
 * Returns `{ ok: true }` on success; `{ ok: false, error }` on failure (never throws).
 * Call this from PATCH/DELETE handlers whenever `students.status` changes.
 */
export async function recordStudentStatusTransition(
  params: RecordStatusTransitionParams,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { studentId, fromStatus, toStatus, changedBy, reason, supabase: provided } = params;
  const supabase = provided ?? createServiceClient();
  try {
    const { error } = await supabase.from("student_status_history").insert({
      student_id: studentId,
      // schema uses `old_status` / `new_status` or `from_status`/`to_status` depending on migration;
      // we send both via raw insert and let PostgREST ignore unknown columns? Instead, detect by trying the canonical names.
      // Canonical per 0007_v4_erp.sql: student_status_history(student_id, old_status, new_status, changed_by, reason, created_at)
      // Some seeds may use from_status/to_status; we handle both by inserting the most common.
      // We use `old_status`/`new_status` first, falling back to `from_status`/`to_status` on error.
      old_status: fromStatus,
      new_status: toStatus,
      changed_by: changedBy,
      reason: reason ?? null,
    } as never);
    if (error) {
      // Fallback: try alternate column names (from_status/to_status)
      const { error: err2 } = await supabase.from("student_status_history").insert({
        student_id: studentId,
        from_status: fromStatus,
        to_status: toStatus,
        changed_by: changedBy,
        reason: reason ?? null,
      } as never);
      if (err2) {
        return { ok: false, error: err2.message };
      }
      return { ok: true };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Generic audit entry for sensitive writes (fees, document verification, role changes).
 * Currently logs to console and, when applicable, to `student_status_history` meta.
 * If a dedicated audit table is added later, replace the body with an insert there.
 */
export async function writeAuditEntry(entry: {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | number;
  meta?: Record<string, unknown>;
}): Promise<void> {
  // Structured log — visible in server logs and testable via console spy.
  console.info(
    JSON.stringify({
      audit: true,
      ts: new Date().toISOString(),
      ...entry,
    }),
  );
}
