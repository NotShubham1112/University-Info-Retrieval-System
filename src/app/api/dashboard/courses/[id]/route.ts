import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { courseUpdateSchema } from "@/lib/validation/schemas";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";
import { z } from "zod";

const COLUMNS = "id,department_id,branch_or_course,course_type,duration_years,credits,description,created_at,updated_at";

// Extended update schema that allows department_id and intake_plan inline edit hook
const extendedCourseUpdateSchema = courseUpdateSchema.extend({
  department_id: z.coerce.number().int().positive().optional().nullable(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const cacheKey = buildCacheKey("GET", `/api/dashboard/courses/${id}`, {});
  const prefixedKey = `list:courses:${cacheKey}`;
  try {
    const data = await getCachedOrSet(prefixedKey, CACHE_TTL.reference, async () => {
      const svc = createServiceClient();
      const { data: row, error } = await svc.from("courses").select(COLUMNS).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) return null;
      // Attach intake_plan for this course (inline editable)
      let intake: unknown = null;
      try {
        const { data: ip } = await svc.from("intake_plan").select("*").eq("course_id", id).order("batch_year", { ascending: true });
        intake = ip ?? [];
      } catch {}
      return { ...(row as Record<string, unknown>), intake_plan: intake };
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
  const denied = assertPermissionOrFail(user, "course:write");
  if (denied) return denied;

  let json: unknown;
  try { json = await req.json(); } catch { return fail(400, "Invalid JSON body"); }

  // Handle intake_plan inline edit if present — process separately
  const raw = json as Record<string, unknown>;
  const intakePlanPayload = raw["intake_plan"] as Record<string, unknown> | undefined;

  const parsed = extendedCourseUpdateSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return fail(400, msg);
  }
  const payload = parsed.data as Record<string, unknown>;
  // Remove intake_plan from payload if zod kept it (it won't, but guard)
  delete (payload as Record<string, unknown>)["intake_plan"];

  const updateFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) if (v !== undefined) updateFields[k] = v;
  if (Object.keys(updateFields).length === 0 && !intakePlanPayload) return fail(400, "No fields to update");

  const svc = createServiceClient();
  try {
    let updated: unknown = null;
    if (Object.keys(updateFields).length > 0) {
      const { data, error } = await svc.from("courses").update(updateFields as never).eq("id", id).select(COLUMNS).maybeSingle();
      if (error) return fail(500, error.message, "INTERNAL_ERROR");
      if (!data) return fail(404, "not found", "NOT_FOUND");
      updated = data;
    } else {
      const { data } = await svc.from("courses").select(COLUMNS).eq("id", id).maybeSingle();
      updated = data;
    }

    // Inline intake_plan upsert if provided: { batch_year, intake_stream, total_seats, general_open_seats, tfws_seats, ews_seats, reserved_breakdown }
    if (intakePlanPayload && typeof intakePlanPayload === "object") {
      const ip = intakePlanPayload as Record<string, unknown>;
      if (ip["batch_year"] && ip["intake_stream"] && ip["total_seats"] !== undefined) {
        const upsertRow: Record<string, unknown> = {
          course_id: Number(id),
          batch_year: Number(ip["batch_year"]),
          intake_stream: String(ip["intake_stream"]),
          total_seats: Number(ip["total_seats"]),
          general_open_seats: ip["general_open_seats"] !== undefined ? Number(ip["general_open_seats"]) : 0,
          tfws_seats: ip["tfws_seats"] !== undefined ? Number(ip["tfws_seats"]) : 0,
          ews_seats: ip["ews_seats"] !== undefined ? Number(ip["ews_seats"]) : 0,
          reserved_breakdown: ip["reserved_breakdown"] ?? {},
        };
        try {
          await svc.from("intake_plan").upsert(upsertRow as never, { onConflict: "course_id,batch_year,intake_stream" } as never);
        } catch (e) {
          console.warn("intake_plan upsert failed:", (e as Error).message);
        }
      }
    }

    await cacheInvalidate("list:courses:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");
    const res = ok(updated);
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
  const denied = assertPermissionOrFail(user, "course:write");
  if (denied) return denied;

  const svc = createServiceClient();
  try {
    const { error } = await svc.from("courses").delete().eq("id", id);
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    await cacheInvalidate("list:courses:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");
    const res = ok({ ok: true });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
