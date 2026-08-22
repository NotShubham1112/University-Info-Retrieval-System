import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { teacherUpdateSchema } from "@/lib/validation/schemas";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

const SAFE_COLUMNS = "id,department_id,name,employee_id,designation,email,phone,joining_date,status,created_at,updated_at";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const cacheKey = buildCacheKey("GET", `/api/dashboard/teachers/${id}`, {});
  const prefixedKey = `list:teachers:${cacheKey}`;
  try {
    const data = await getCachedOrSet(prefixedKey, CACHE_TTL.reference, async () => {
      const svc = createServiceClient();
      const { data: row, error } = await svc.from("teachers").select(`${SAFE_COLUMNS},departments(name)`).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) return null;
      const r = row as unknown as Record<string, unknown> & { departments: { name: string } | null };
      const dep = (r["departments"] as { name: string } | null)?.name ?? null;
      return { ...r, department_name: dep };
    });
    if (!data) return fail(404, "not found", "NOT_FOUND");
    const res = ok(data);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.reference));
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "teacher:write");
  if (denied) return denied;

  let json: unknown;
  try { json = await req.json(); } catch { return fail(400, "Invalid JSON body"); }
  const parsed = teacherUpdateSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return fail(400, msg);
  }
  const payload = parsed.data as Record<string, unknown>;
  const svc = createServiceClient();

  // email unique check if changed
  if (payload["email"]) {
    const email = String(payload["email"]).trim().toLowerCase();
    const { data: existing } = await svc.from("teachers").select("id").eq("email", email).maybeSingle();
    if (existing && String((existing as { id: number }).id) !== String(id)) return fail(400, `email already exists: ${email}`);
    payload["email"] = email;
  }
  if (payload["employee_id"]) {
    const emp = String(payload["employee_id"]).trim();
    const { data: existing } = await svc.from("teachers").select("id").eq("employee_id", emp).maybeSingle();
    if (existing && String((existing as { id: number }).id) !== String(id)) return fail(400, `employee_id already exists: ${emp}`);
  }

  const updateFields: Record<string, unknown> = {};
  // Map first/last -> name if provided
  if (payload["first_name"] !== undefined || payload["last_name"] !== undefined) {
    try {
      const { data: cur } = await svc.from("teachers").select("name").eq("id", id).maybeSingle();
      const curName = String((cur as { name: string } | null)?.name ?? "");
      const parts = curName.trim().split(/\s+/);
      const curFirst = parts[0] ?? "";
      const curLast = parts.slice(1).join(" ") ?? "";
      const fn = (payload["first_name"] as string | undefined) ?? curFirst;
      const ln = (payload["last_name"] as string | undefined) ?? curLast;
      updateFields["name"] = `${fn} ${ln}`.trim();
    } catch {}
  }
  for (const [k, v] of Object.entries(payload)) {
    if (k === "first_name" || k === "last_name") continue;
    if (v !== undefined) updateFields[k] = v;
  }
  if (Object.keys(updateFields).length === 0) return fail(400, "No fields to update");

  try {
    const { data, error } = await svc.from("teachers").update(updateFields as never).eq("id", id).select(SAFE_COLUMNS).maybeSingle();
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    if (!data) return fail(404, "not found", "NOT_FOUND");
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

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "teacher:write");
  if (denied) return denied;

  const svc = createServiceClient();
  try {
    // Soft-delete via status inactive (preserve salary/history)
    const { error } = await svc.from("teachers").update({ status: "inactive" } as never).eq("id", id);
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    await cacheInvalidate("list:teachers:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");
    const res = ok({ ok: true });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
