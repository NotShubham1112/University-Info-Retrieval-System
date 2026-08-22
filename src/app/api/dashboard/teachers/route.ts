import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseQuery, parseBody, fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { teacherCreateSchema } from "@/lib/validation/schemas";
import { teacherListQuerySchema } from "@/lib/validation/teacher";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

const SAFE_COLUMNS = "id,department_id,name,employee_id,designation,email,phone,joining_date,status,created_at,updated_at";

export async function GET(req: NextRequest) {
  const parsed = parseQuery(teacherListQuerySchema, req.nextUrl.searchParams);
  if (!parsed.success) return parsed.response;
  const { q, limit, cursor, department_id, status } = parsed.data as {
    q: string; limit: number; cursor?: string | null; department_id?: number | null; status?: string | null;
  };

  const cacheKey = buildCacheKey("GET", "/api/dashboard/teachers", { q: q ?? "", limit, cursor: cursor ?? "", department_id: department_id ?? "", status: status ?? "" });
  const prefixedKey = `list:teachers:${cacheKey}`;

  try {
    const result = await getCachedOrSet(prefixedKey, CACHE_TTL.reference, async () => {
      const svc = createServiceClient();
      let query = svc.from("teachers").select(`${SAFE_COLUMNS},departments(name)`);
      if (q && q.trim().length > 0) {
        const term = q.trim();
        // search by name or email or employee_id
        query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,employee_id.ilike.%${term}%`);
      }
      if (department_id) query = query.eq("department_id", department_id);
      if (status) query = query.eq("status", status);
      if (cursor) {
        const c = Number(cursor);
        if (!Number.isNaN(c)) query = query.gt("id", c);
      }
      query = query.order("id", { ascending: true }).limit(limit);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<{ id: number } & Record<string, unknown>>;
      const nextCursor = rows.length === limit ? String(rows[rows.length - 1].id) : null;
      // Normalize department join
      const normalized = rows.map((r) => {
        const dep = (r as unknown as { departments: { name: string } | null }).departments;
        const rn = { ...r, department_name: dep?.name ?? null } as Record<string, unknown>;
        // split name into first/last for UI convenience
        const name = String((rn["name"] as string) ?? "");
        const parts = name.trim().split(/\s+/);
        rn["first_name"] = parts[0] ?? "";
        rn["last_name"] = parts.slice(1).join(" ") ?? "";
        return rn;
      });
      return { data: normalized, nextCursor };
    });
    const res = ok(result);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.reference));
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
  const supabaseAuth = await createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "teacher:write");
  if (denied) return denied;

  const parsed = await parseBody(teacherCreateSchema, req);
  if (!parsed.success) return parsed.response;
  const payload = parsed.data as Record<string, unknown>;

  const svc = createServiceClient();

  // Email unique check via query
  const email = String(payload["email"] ?? "").trim().toLowerCase();
  if (email) {
    const { data: existing } = await svc.from("teachers").select("id").eq("email", email).maybeSingle();
    if (existing) return fail(400, `email already exists: ${email}`);
  }
  const employeeId = String(payload["employee_id"] ?? "").trim();
  if (employeeId) {
    const { data: existingEmp } = await svc.from("teachers").select("id").eq("employee_id", employeeId).maybeSingle();
    if (existingEmp) return fail(400, `employee_id already exists: ${employeeId}`);
  }

  // Map first_name/last_name -> name column
  const firstName = String(payload["first_name"] ?? "").trim();
  const lastName = String(payload["last_name"] ?? "").trim();
  const name = `${firstName} ${lastName}`.trim() || firstName || lastName || email;

  // Resolve department_id default if missing
  let departmentId = payload["department_id"] as number | null | undefined;
  if (!departmentId) {
    const { data: dept } = await svc.from("departments").select("id").limit(1).maybeSingle();
    if (dept) departmentId = (dept as { id: number }).id;
  }
  if (!departmentId) return fail(400, "department_id is required (no departments found)");

  const insertRow: Record<string, unknown> = {
    department_id: departmentId,
    name,
    employee_id: employeeId || `EMP-${Date.now()}`,
    designation: payload["designation"] ?? null,
    email,
    phone: payload["phone"] ?? null,
    joining_date: payload["joining_date"] ?? null,
    status: payload["status"] ?? "active",
  };

  // salary never projected by default, but allow creation if provided via extra field (not in DTO — ignore)
  // Keep insert sanitized: remove undefined
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(insertRow)) if (v !== undefined) clean[k] = v;

  try {
    const { data, error } = await svc.from("teachers").insert(clean as never).select(SAFE_COLUMNS).single();
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    await cacheInvalidate("list:teachers:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");
    const res = ok(data);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
