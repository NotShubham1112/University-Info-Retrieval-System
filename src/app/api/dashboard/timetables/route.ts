import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseQuery, parseBody, fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { timetableCreateSchema } from "@/lib/validation/schemas";
import { timetableListQuerySchema } from "@/lib/validation/timetable";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

const COLUMNS = "id,course_id,semester_no,day_of_week,period_no,subject_id,teacher_id,room_id,created_at,updated_at";

export async function GET(req: NextRequest) {
  const parsed = parseQuery(timetableListQuerySchema, req.nextUrl.searchParams);
  if (!parsed.success) return parsed.response;
  const { q, limit, cursor, course_id, semester_no, day_of_week, teacher_id, room_id, subject_id } = parsed.data as {
    q: string; limit: number; cursor?: string | null; course_id?: number | null; semester_no?: number | null; day_of_week?: number | null; teacher_id?: number | null; room_id?: number | null; subject_id?: number | null;
  };

  const cacheKey = buildCacheKey("GET", "/api/dashboard/timetables", {
    q: q ?? "", limit, cursor: cursor ?? "", course_id: course_id ?? "", semester_no: semester_no ?? "", day_of_week: day_of_week ?? "", teacher_id: teacher_id ?? "", room_id: room_id ?? "", subject_id: subject_id ?? "",
  });
  const prefixedKey = `list:timetables:${cacheKey}`;

  try {
    const result = await getCachedOrSet(prefixedKey, CACHE_TTL.reference, async () => {
      const svc = createServiceClient();
      let query = svc.from("timetables").select(`${COLUMNS},courses(branch_or_course),subjects(name),rooms(name)`);
      if (course_id) query = query.eq("course_id", course_id);
      if (semester_no) query = query.eq("semester_no", semester_no);
      if (day_of_week !== null && day_of_week !== undefined) query = query.eq("day_of_week", day_of_week);
      if (teacher_id) query = query.eq("teacher_id", teacher_id);
      if (room_id) query = query.eq("room_id", room_id);
      if (subject_id) query = query.eq("subject_id", subject_id);
      if (q && q.trim().length > 0) {
        // not much to ilike on timetables; search by course name via join would require extra; skip
      }
      if (cursor) {
        const c = Number(cursor);
        if (!Number.isNaN(c)) query = query.gt("id", c);
      }
      query = query.order("course_id", { ascending: true }).order("day_of_week", { ascending: true }).order("period_no", { ascending: true }).limit(limit);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<{ id: number } & Record<string, unknown>>;
      const nextCursor = rows.length === limit ? String(rows[rows.length - 1].id) : null;

      // Enrich with teacher name via separate fetch (timetables doesn't join teachers name by default in postgREST? we can fetch teachers)
      const teacherMap = new Map<number, string>();
      const tIds = [...new Set(rows.map((r) => r["teacher_id"] as number).filter(Boolean))];
      if (tIds.length > 0) {
        try {
          const { data: teachers } = await svc.from("teachers").select("id,name").in("id", tIds as never);
          (teachers ?? []).forEach((t: unknown) => {
            const rec = t as { id: number; name: string };
            teacherMap.set(rec.id, rec.name);
          });
        } catch {}
      }

      const normalized = rows.map((r) => {
        const courses = (r as unknown as { courses: { branch_or_course: string } | null }).courses;
        const subjects = (r as unknown as { subjects: { name: string } | null }).subjects;
        const rooms = (r as unknown as { rooms: { name: string } | null }).rooms;
        const tid = r["teacher_id"] as number | null;
        return {
          ...r,
          course_name: courses?.branch_or_course ?? null,
          subject_name: subjects?.name ?? null,
          room_name: rooms?.name ?? null,
          teacher_name: tid ? teacherMap.get(tid) ?? null : null,
        };
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
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "timetable:write");
  if (denied) return denied;

  const parsed = await parseBody(timetableCreateSchema, req);
  if (!parsed.success) return parsed.response;
  const payload = parsed.data as Record<string, unknown>;

  const svc = createServiceClient();

  // Conflict checks: teacher busy, room double-booked, slot taken (unique course/sem/day/period)
  const courseId = Number(payload["course_id"]);
  const semesterNo = Number(payload["semester_no"]);
  const day = Number(payload["day_of_week"]);
  const period = Number(payload["period_no"]);
  const teacherId = payload["teacher_id"] !== null && payload["teacher_id"] !== undefined ? Number(payload["teacher_id"]) : null;
  const roomId = payload["room_id"] !== null && payload["room_id"] !== undefined ? Number(payload["room_id"]) : null;

  const conflicts: Array<{ type: string; message: string }> = [];

  // Slot taken check
  try {
    const { data: slot } = await svc.from("timetables").select("id").eq("course_id", courseId).eq("semester_no", semesterNo).eq("day_of_week", day).eq("period_no", period).maybeSingle();
    if (slot) conflicts.push({ type: "slot_taken", message: `Slot already taken for course ${courseId} sem ${semesterNo} day ${day} period ${period}` });
  } catch {}

  if (teacherId !== null) {
    try {
      const { data: busy } = await svc.from("timetables").select("id,course_id,period_no").eq("teacher_id", teacherId).eq("day_of_week", day).eq("period_no", period).maybeSingle();
      if (busy) conflicts.push({ type: "teacher_busy", message: `Teacher ${teacherId} already assigned on day ${day} period ${period} (timetable ${(busy as { id: number }).id})` });
    } catch {}
  }

  if (roomId !== null) {
    try {
      const { data: roomBusy } = await svc.from("timetables").select("id").eq("room_id", roomId).eq("day_of_week", day).eq("period_no", period).maybeSingle();
      if (roomBusy) conflicts.push({ type: "room_double_booked", message: `Room ${roomId} already booked on day ${day} period ${period}` });
    } catch {}
  }

  if (conflicts.length > 0) {
    return fail(409, conflicts.map((c) => c.message).join("; "), "BAD_REQUEST");
  }

  // Validate FK existence (course, subject, teacher, room)
  const { data: course } = await svc.from("courses").select("id").eq("id", courseId).maybeSingle();
  if (!course) return fail(400, `course_id not found: ${courseId}`);

  if (payload["subject_id"] !== undefined && payload["subject_id"] !== null) {
    const sid = Number(payload["subject_id"]);
    const { data: subj } = await svc.from("subjects").select("id").eq("id", sid).maybeSingle();
    if (!subj) return fail(400, `subject_id not found: ${sid}`);
  }
  if (teacherId !== null) {
    const { data: teacher } = await svc.from("teachers").select("id").eq("id", teacherId).maybeSingle();
    if (!teacher) return fail(400, `teacher_id not found: ${teacherId}`);
  }
  if (roomId !== null) {
    const { data: room } = await svc.from("rooms").select("id").eq("id", roomId).maybeSingle();
    if (!room) return fail(400, `room_id not found: ${roomId}`);
  }

  const insertRow: Record<string, unknown> = {
    course_id: courseId,
    semester_no: semesterNo,
    day_of_week: day,
    period_no: period,
    subject_id: payload["subject_id"] ?? null,
    teacher_id: teacherId,
    room_id: roomId,
  };

  try {
    const { data, error } = await svc.from("timetables").insert(insertRow as never).select(COLUMNS).single();
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    await cacheInvalidate("list:timetables:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");
    const res = ok(data);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    // Handle unique violation fallback
    const msg = (e as Error).message?.toLowerCase() ?? "";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return fail(409, "Timetable slot conflict (duplicate key)");
    }
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
