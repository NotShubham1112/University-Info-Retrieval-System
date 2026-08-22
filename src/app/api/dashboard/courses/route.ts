import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseQuery, parseBody, fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { courseCreateSchema } from "@/lib/validation/schemas";
import { courseListQuerySchema } from "@/lib/validation/course";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

const COLUMNS = "id,department_id,branch_or_course,course_type,duration_years,credits,description,created_at,updated_at";

export async function GET(req: NextRequest) {
  const parsed = parseQuery(courseListQuerySchema, req.nextUrl.searchParams);
  if (!parsed.success) return parsed.response;
  const { q, limit, cursor, course_type } = parsed.data as { q: string; limit: number; cursor?: string | null; course_type?: string | null };
  const cacheKey = buildCacheKey("GET", "/api/dashboard/courses", { q: q ?? "", limit, cursor: cursor ?? "", course_type: course_type ?? "" });
  const prefixedKey = `list:courses:${cacheKey}`;
  try {
    const result = await getCachedOrSet(prefixedKey, CACHE_TTL.reference, async () => {
      const svc = createServiceClient();
      let query = svc.from("courses").select(COLUMNS);
      if (q && q.trim().length > 0) {
        const term = q.trim();
        query = query.or(`branch_or_course.ilike.%${term}%,course_type.ilike.%${term}%,description.ilike.%${term}%`);
      }
      if (course_type) query = query.eq("course_type", course_type);
      if (cursor) {
        const c = Number(cursor);
        if (!Number.isNaN(c)) query = query.gt("id", c);
      }
      query = query.order("id", { ascending: true }).limit(limit);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<{ id: number } & Record<string, unknown>>;
      const nextCursor = rows.length === limit ? String(rows[rows.length - 1].id) : null;
      return { data: rows, nextCursor };
    });
    const res = ok(result);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.reference));
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "course:write");
  if (denied) return denied;

  const parsed = await parseBody(courseCreateSchema, req);
  if (!parsed.success) return parsed.response;
  const payload = parsed.data as Record<string, unknown>;
  const svc = createServiceClient();

  // Resolve department_id default
  let departmentId = payload["department_id"] as number | undefined;
  // courseCreateSchema does not include department_id per schemas.ts; accept from raw json fallback
  try {
    const raw = (await req.clone?.().json?.().catch(() => null)) as Record<string, unknown> | null;
    if (raw && raw["department_id"] !== undefined) departmentId = Number(raw["department_id"]);
  } catch {}
  // Instead, read from original parsed raw via payload department_id if present else fallback
  if (!departmentId) {
    // Try payload department_id if forwarded via extra field
    const maybe = (payload as Record<string, unknown>)["department_id"];
    if (maybe !== undefined && maybe !== null) departmentId = Number(maybe);
  }
  if (!departmentId) {
    const { data: dept } = await svc.from("departments").select("id").limit(1).maybeSingle();
    if (dept) departmentId = (dept as { id: number }).id;
  }
  if (!departmentId) return fail(400, "department_id is required (no departments found)");

  // Payload already validated; ensure department_id present
  const insertRow: Record<string, unknown> = {
    department_id: departmentId,
    branch_or_course: payload["branch_or_course"],
    course_type: payload["course_type"] ?? "B.Tech",
    duration_years: payload["duration_years"] ?? 4,
    credits: payload["credits"] ?? 160,
    description: payload["description"] ?? null,
  };

  try {
    const { data, error } = await svc.from("courses").insert(insertRow as never).select(COLUMNS).single();
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    await cacheInvalidate("list:courses:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");
    const res = ok(data);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
