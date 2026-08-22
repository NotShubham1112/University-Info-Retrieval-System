import { describe, it, expect } from "vitest";
import {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getUserRole,
  hasPermission,
  assertPermission,
  PermissionDeniedError,
  canAccessDashboard,
  requireDashboardAccess,
} from "./rbac";

// Helper to make a mock Supabase user shape
function userWithRole(role: string | undefined, extra: Record<string, unknown> = {}) {
  if (role === undefined) {
    return { id: "u1", email: "viewer@example.com", ...extra } as unknown as Parameters<typeof getUserRole>[0];
  }
  return {
    id: "u1",
    email: `${role}@example.com`,
    app_metadata: { role },
    ...extra,
  } as unknown as Parameters<typeof getUserRole>[0];
}

describe("rbac — permission matrix", () => {
  it("PERMISSIONS has exactly 11 keys as seeded in 0008", () => {
    expect(PERMISSIONS).toHaveLength(11);
    expect(new Set(PERMISSIONS).size).toBe(11);
    // each key matches the seed list
    expect([...PERMISSIONS].sort()).toEqual(
      [
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
      ].sort(),
    );
  });

  it("ROLES has exactly 5 entries", () => {
    expect(ROLES).toHaveLength(5);
    expect([...ROLES].sort()).toEqual(["accountant", "admin", "super_admin", "teacher", "viewer"].sort());
  });

  it("matrix completeness: every seeded permission is reachable by at least one role", () => {
    for (const perm of PERMISSIONS) {
      const holders = (ROLES as readonly string[]).filter((r) =>
        (ROLE_PERMISSIONS[r as keyof typeof ROLE_PERMISSIONS] as readonly string[]).includes(perm),
      );
      expect(holders.length, `permission ${perm} should be held by at least one role`).toBeGreaterThan(0);
    }
  });

  it("super_admin has all 11 permissions", () => {
    const perms = ROLE_PERMISSIONS.super_admin;
    expect(perms).toHaveLength(11);
    for (const p of PERMISSIONS) {
      expect(hasPermission(userWithRole("super_admin"), p)).toBe(true);
    }
  });

  it("admin has 10 permissions (all except docs:verify)", () => {
    expect(ROLE_PERMISSIONS.admin).toHaveLength(10);
    expect(hasPermission(userWithRole("admin"), "docs:verify")).toBe(false);
    expect(hasPermission(userWithRole("admin"), "student:write")).toBe(true);
    expect(hasPermission(userWithRole("admin"), "student:delete")).toBe(true);
    expect(hasPermission(userWithRole("admin"), "fees:approve")).toBe(true);
  });

  it("teacher has exactly attendance:write, exam:publish, timetable:write", () => {
    const teacherPerms = [...ROLE_PERMISSIONS.teacher].sort();
    expect(teacherPerms).toEqual(["attendance:write", "exam:publish", "timetable:write"].sort());
    expect(hasPermission(userWithRole("teacher"), "attendance:write")).toBe(true);
    expect(hasPermission(userWithRole("teacher"), "student:write")).toBe(false);
    expect(hasPermission(userWithRole("teacher"), "fees:read")).toBe(false);
    expect(hasPermission(userWithRole("teacher"), "docs:verify")).toBe(false);
  });

  it("accountant has fees:read and fees:approve only", () => {
    expect([...ROLE_PERMISSIONS.accountant].sort()).toEqual(["fees:approve", "fees:read"].sort());
    expect(hasPermission(userWithRole("accountant"), "fees:read")).toBe(true);
    expect(hasPermission(userWithRole("accountant"), "fees:approve")).toBe(true);
    expect(hasPermission(userWithRole("accountant"), "student:write")).toBe(false);
  });

  it("viewer has no write permissions", () => {
    expect(ROLE_PERMISSIONS.viewer).toHaveLength(0);
    for (const p of PERMISSIONS) {
      expect(hasPermission(userWithRole("viewer"), p)).toBe(false);
    }
    // authenticated viewer fallback: user with id but no role claim → viewer
    const viewerFallback = { id: "u2", email: "anon@example.com" } as unknown as Parameters<typeof getUserRole>[0];
    expect(getUserRole(viewerFallback)).toBe("viewer");
    expect(hasPermission(viewerFallback, "student:write")).toBe(false);
  });

  it("getUserRole reads app_metadata.role, user_metadata.role, and direct role", () => {
    expect(getUserRole({ app_metadata: { role: "admin" }, id: "u1" } as never)).toBe("admin");
    expect(getUserRole({ user_metadata: { role: "teacher" }, id: "u1" } as never)).toBe("teacher");
    expect(getUserRole({ role: "accountant", id: "u1" } as never)).toBe("accountant");
    expect(getUserRole(null)).toBeNull();
    expect(getUserRole(undefined)).toBeNull();
  });

  it("hasPermission returns false for unauthenticated (null user)", () => {
    expect(hasPermission(null, "student:write")).toBe(false);
    expect(hasPermission(undefined, "fees:read")).toBe(false);
  });

  it("assertPermission throws PermissionDeniedError with 403 on denied", () => {
    expect(() => assertPermission(userWithRole("viewer"), "student:write")).toThrow(PermissionDeniedError);
    try {
      assertPermission(userWithRole("viewer"), "student:write");
    } catch (e) {
      expect((e as PermissionDeniedError).status).toBe(403);
      expect((e as PermissionDeniedError).code).toBe("FORBIDDEN");
      expect((e as Error).message).toMatch(/viewer.*student:write/);
    }
    // allowed does not throw
    expect(() => assertPermission(userWithRole("admin"), "student:write")).not.toThrow();
  });

  it("canAccessDashboard: viewer may access viewer, not admin; admin/super_admin may access both", () => {
    expect(canAccessDashboard("viewer", "viewer")).toBe(true);
    expect(canAccessDashboard("viewer", "admin")).toBe(false);
    expect(canAccessDashboard("admin", "viewer")).toBe(true);
    expect(canAccessDashboard("admin", "admin")).toBe(true);
    expect(canAccessDashboard("super_admin", "admin")).toBe(true);
    expect(canAccessDashboard(null, "viewer")).toBe(false);
    expect(canAccessDashboard("teacher", "admin")).toBe(false); // teacher lacks student:write
    expect(canAccessDashboard("accountant", "admin")).toBe(false);
  });

  it("requireDashboardAccess throws on denied, not on allowed", () => {
    expect(() => requireDashboardAccess("viewer", "admin")).toThrow(PermissionDeniedError);
    expect(() => requireDashboardAccess("admin", "admin")).not.toThrow();
    expect(() => requireDashboardAccess("viewer", "viewer")).not.toThrow();
  });
});
