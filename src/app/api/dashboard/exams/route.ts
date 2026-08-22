import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseQuery, parseBody, fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { examCreateSchema } from "@/lib/validation/schemas";
import { examListQuerySchema } from "@/lib/validation/exam";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

const COLUMNS = "id,course_id,semester_no,exam_type,date,status,created_at,updated_at";

export async function GET(req: NextRequest) {
  const parsed = parseQuery(examListQuerySchema, req.nextUrl.searchParams);
  if (!parsed.success) return parsed.response;
  const { q, limit, cursor, course_id, semester_no, status, exam_type } = parsed.data as {
    q: string; limit: number; cursor?: string | null; course_id?: number | null; semester_no?: number | null; status?: string | null; exam_type?: string | null;
  };

  const cacheKey = buildCacheKey("GET", "/api/dashboard/exams", {
    q: q ?? "", limit, cursor: cursor ?? "", course_id: course_id ?? "", semester_no: semester_no ?? "", status: status ?? "", exam_type: exam_type ?? "",
  });
  const prefixedKey = `list:exams:${cacheKey}`;

  try {
    const result = await getCachedOrSet(prefixedKey, CACHE_TTL.list, async () => {
      const svc = createServiceClient();
      let query = svc.from("exams").select(`${COLUMNS},courses(branch_or_course),exam_subjects(count)`);
      if (course_id) query = query.eq("course_id", course_id);
      if (semester_no) query = query.eq("semester_no", semester_no);
      if (status) query = query.eq("status", status);
      if (exam_type) query = query.eq("exam_type", exam_type);
      if (q && q.trim().length > 0) {
        // filter by exam_type or status textual match
        query = query.or(`exam_type.ilike.%${q.trim()}%,status.ilike.%${q.trim()}%`);
      }
      if (cursor) {
        const c = Number(cursor);
        if (!Number.isNaN(c)) query = query.gt("id", c);
      }
      query = query.order("id", { ascending: true }).limit(limit);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<{ id: number } & Record<string, unknown>>;
      const nextCursor = rows.length === limit ? String(rows[rows.length - 1].id) : null;
      // normalize course_name
      const normalized = rows.map((r) => {
        const courses = (r as unknown as { courses: { branch_or_course: string } | null }).courses;
        return { ...r, course_name: courses?.branch_or_course ?? null };
      });
      return { data: normalized, nextCursor };
    });
    const res = ok(result);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.list));
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  // creation allowed for teacher:write or admin; plan says teacher:write/admin for creation
  const canTeacher = (() => { try { return !assertPermissionOrFail(user, "teacher:write"); } catch { return false; } })();
  const canAdmin = (() => { try { return !assertPermissionOrFail(user, "exam:publish"); } catch { return false; } })();
  if (!canTeacher && !canAdmin) {
    // fallback check student:write too
    const denied = assertPermissionOrFail(user, "teacher:write");
    if (denied && canAdmin === false) return denied;
  }

  const parsed = await parseBody(examCreateSchema, req);
  if (!parsed.success) return parsed.response;
  const payload = parsed.data as Record<string, unknown>;

  // Validate course exists
  const svc = createServiceClient();
  const courseId = Number(payload["course_id"]);
  const { data: course } = await svc.from("courses").select("id").eq("id", courseId).maybeSingle();
  if (!course) return fail(400, `course_id not found: ${courseId}`);

  // Optional subjects array passthrough (exam_subjects inline)
  let subjects: Array<{ subject_id: number; max_marks: number; pass_marks: number }> | null = null;
  try {
    const raw = payload as Record<string, unknown>;
    if (Array.isArray(raw["subjects"])) {
      subjects = raw["subjects"] as Array<{ subject_id: number; max_marks: number; pass_marks: number }>;
    } else if (Array.isArray(raw["exam_subjects"])) {
      subjects = raw["exam_subjects"] as Array<{ subject_id: number; max_marks: number; pass_marks: number }>;
    }
  } catch {}

  const insertRow: Record<string, unknown> = {
    course_id: payload["course_id"],
    semester_no: payload["semester_no"],
    exam_type: payload["exam_type"] ?? "final",
    date: payload["date"] ?? null,
    status: payload["status"] ?? "draft",
  };

  try {
    const { data, error } = await svc.from("exams").insert(insertRow as never).select(COLUMNS).single();
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    const examId = (data as { id: number }).id;

    // Insert exam_subjects if provided
    if (subjects && subjects.length > 0) {
      const rows = subjects.map((s) => ({
        exam_id: examId,
        subject_id: Number(s.subject_id),
        max_marks: Number(s.max_marks ?? 100),
        pass_marks: Number(s.pass_marks ?? 40),
      }));
      const { error: subjErr } = await svc.from("exam_subjects").insert(rows as never);
      if (subjErr) {
        console.warn("exam_subjects insert failed:", subjErr.message);
      }
    }

    await cacheInvalidate("list:exams:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");

    const res = ok(data);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
