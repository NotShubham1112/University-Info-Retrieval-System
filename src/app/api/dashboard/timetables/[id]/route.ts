import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { timetableUpdateSchema } from "@/lib/validation/schemas";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

const COLUMNS = "id,course_id,semester_no,day_of_week,period_no,subject_id,teacher_id,room_id,created_at,updated_at";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const cacheKey = buildCacheKey("GET", `/api/dashboard/timetables/${id}`, {});
  const prefixedKey = `list:timetables:${cacheKey}`;
  try {
    const data = await getCachedOrSet(prefixedKey, CACHE_TTL.reference, async () => {
      const svc = createServiceClient();
      const { data: row, error } = await svc.from("timetables").select(COLUMNS).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return row ?? null;
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
  const denied = assertPermissionOrFail(user, "timetable:write");
  if (denied) return denied;

  let json: unknown;
  try { json = await req.json(); } catch { return fail(400, "Invalid JSON body"); }
  const parsed = timetableUpdateSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return fail(400, msg);
  }
  const payload = parsed.data as Record<string, unknown>;
  const updateFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) if (v !== undefined) updateFields[k] = v;
  if (Object.keys(updateFields).length === 0) return fail(400, "No fields to update");

  const svc = createServiceClient();
  try {
    // Conflict checks if teacher/room/day/period changed
    const { data: existing } = await svc.from("timetables").select(COLUMNS).eq("id", id).maybeSingle();
    if (!existing) return fail(404, "not found", "NOT_FOUND");
    const cur = existing as Record<string, unknown>;
    const newDay = (updateFields["day_of_week"] as number | undefined) ?? (cur["day_of_week"] as number);
    const newPeriod = (updateFields["period_no"] as number | undefined) ?? (cur["period_no"] as number);
    const newTeacher = updateFields["teacher_id"] !== undefined ? (updateFields["teacher_id"] as number | null) : (cur["teacher_id"] as number | null);
    const newRoom = updateFields["room_id"] !== undefined ? (updateFields["room_id"] as number | null) : (cur["room_id"] as number | null);
    const newCourse = (updateFields["course_id"] as number | undefined) ?? (cur["course_id"] as number);
    const newSem = (updateFields["semester_no"] as number | undefined) ?? (cur["semester_no"] as number);

    const conflicts: string[] = [];
    // slot taken (different row)
    if (updateFields["course_id"] !== undefined || updateFields["semester_no"] !== undefined || updateFields["day_of_week"] !== undefined || updateFields["period_no"] !== undefined) {
      const { data: slot } = await svc.from("timetables").select("id").eq("course_id", newCourse).eq("semester_no", newSem).eq("day_of_week", newDay).eq("period_no", newPeriod).maybeSingle();
      if (slot && String((slot as { id: number }).id) !== String(id)) conflicts.push(`Slot taken for course ${newCourse} sem ${newSem} day ${newDay} period ${newPeriod}`);
    }
    if (newTeacher !== null && (updateFields["teacher_id"] !== undefined || updateFields["day_of_week"] !== undefined || updateFields["period_no"] !== undefined)) {
      const { data: busy } = await svc.from("timetables").select("id").eq("teacher_id", newTeacher).eq("day_of_week", newDay).eq("period_no", newPeriod).maybeSingle();
      if (busy && String((busy as { id: number }).id) !== String(id)) conflicts.push(`Teacher ${newTeacher} busy day ${newDay} period ${newPeriod}`);
    }
    if (newRoom !== null && (updateFields["room_id"] !== undefined || updateFields["day_of_week"] !== undefined || updateFields["period_no"] !== undefined)) {
      const { data: roomBusy } = await svc.from("timetables").select("id").eq("room_id", newRoom).eq("day_of_week", newDay).eq("period_no", newPeriod).maybeSingle();
      if (roomBusy && String((roomBusy as { id: number }).id) !== String(id)) conflicts.push(`Room ${newRoom} double-booked day ${newDay} period ${newPeriod}`);
    }
    if (conflicts.length > 0) return fail(409, conflicts.join("; "));

    const { data, error } = await svc.from("timetables").update(updateFields as never).eq("id", id).select(COLUMNS).maybeSingle();
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    if (!data) return fail(404, "not found", "NOT_FOUND");
    await cacheInvalidate("list:timetables:");
    await cacheInvalidate("list:");
    const res = ok(data);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("duplicate") || msg.includes("unique")) return fail(409, "Timetable conflict");
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "timetable:write");
  if (denied) return denied;

  const svc = createServiceClient();
  try {
    const { error } = await svc.from("timetables").delete().eq("id", id);
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    await cacheInvalidate("list:timetables:");
    await cacheInvalidate("list:");
    const res = ok({ ok: true });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
