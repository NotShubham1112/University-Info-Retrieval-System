import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { examUpdateSchema } from "@/lib/validation/schemas";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

const COLUMNS = "id,course_id,semester_no,exam_type,date,status,created_at,updated_at";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const cacheKey = buildCacheKey("GET", `/api/dashboard/exams/${id}`, {});
  const prefixedKey = `list:exams:${cacheKey}`;
  try {
    const data = await getCachedOrSet(prefixedKey, CACHE_TTL.list, async () => {
      const svc = createServiceClient();
      const { data: row, error } = await svc.from("exams").select(`${COLUMNS},courses(branch_or_course)`).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) return null;
      const r = row as unknown as Record<string, unknown> & { courses: { branch_or_course: string } | null };
      const base = { ...r, course_name: r.courses?.branch_or_course ?? null };
      // Attach exam_subjects
      let subjects: unknown = [];
      try {
        const { data: subj } = await svc.from("exam_subjects").select("id,exam_id,subject_id,max_marks,pass_marks,created_at,updated_at,subjects(name)").eq("exam_id", id);
        subjects = (subj ?? []).map((s: unknown) => {
          const rec = s as Record<string, unknown> & { subjects: { name: string } | null };
          return { ...rec, subject_name: rec.subjects?.name ?? null };
        });
      } catch {}
      return { ...(base as Record<string, unknown>), subjects, subject_count: Array.isArray(subjects) ? subjects.length : 0 };
    });
    if (!data) return fail(404, "not found", "NOT_FOUND");
    const res = ok(data);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.list));
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
  // allow teacher:write or exam:publish
  const canTeacher = !assertPermissionOrFail(user, "teacher:write");
  const canPublish = !assertPermissionOrFail(user, "exam:publish");
  if (!canTeacher && !canPublish) return fail(403, "Forbidden: missing teacher:write or exam:publish", "FORBIDDEN");

  let json: unknown;
  try { json = await req.json(); } catch { return fail(400, "Invalid JSON body"); }
  const raw = json as Record<string, unknown>;
  const subjects = raw["subjects"] ?? raw["exam_subjects"];

  // Validate update fields via schema (partial)
  const { examUpdateSchema: upd } = await import("@/lib/validation/schemas");
  const parsed = upd.safeParse(json);
  // Allow extra fields like subjects; only validate known fields
  // If parsed fails but only due to unknown subjects, still allow
  const payload: Record<string, unknown> = {};
  if (parsed.success) {
    Object.assign(payload, parsed.data as Record<string, unknown>);
  } else {
    // collect only valid known keys
    const allowed = ["course_id", "semester_no", "exam_type", "date", "status"];
    for (const k of allowed) if (raw[k] !== undefined) payload[k] = raw[k];
    // if no allowed fields and subjects present, still continue for subjects patch
    if (Object.keys(payload).length === 0 && !subjects) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return fail(400, msg);
    }
  }
  // Filter undefined
  const updateFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) if (v !== undefined) updateFields[k] = v;

  const svc = createServiceClient();
  try {
    if (Object.keys(updateFields).length > 0) {
      const { data, error } = await svc.from("exams").update(updateFields as never).eq("id", id).select(COLUMNS).maybeSingle();
      if (error) return fail(500, error.message, "INTERNAL_ERROR");
      if (!data) return fail(404, "not found", "NOT_FOUND");
    }

    // Handle exam_subjects replacement if provided
    if (Array.isArray(subjects)) {
      // upsert: delete existing then insert
      const rows = (subjects as Array<Record<string, unknown>>).map((s) => ({
        exam_id: Number(id),
        subject_id: Number(s["subject_id"]),
        max_marks: Number(s["max_marks"] ?? 100),
        pass_marks: Number(s["pass_marks"] ?? 40),
      }));
      // delete and insert transactionally (best-effort)
      await svc.from("exam_subjects").delete().eq("exam_id", id);
      if (rows.length > 0) {
        const { error: insErr } = await svc.from("exam_subjects").insert(rows as never);
        if (insErr) console.warn("exam_subjects upsert failed:", insErr.message);
      }
    }

    await cacheInvalidate("list:exams:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");

    const { data: updated } = await svc.from("exams").select(COLUMNS).eq("id", id).maybeSingle();
    const res = ok(updated ?? { id });
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
  const denied = assertPermissionOrFail(user, "exam:publish");
  if (denied) {
    // fallback to teacher:write
    const d2 = assertPermissionOrFail(user, "teacher:write");
    if (d2) return denied;
  }

  const svc = createServiceClient();
  try {
    // Check status: if published, soft-prevent? allow but warn
    const { data: cur } = await svc.from("exams").select("status").eq("id", id).maybeSingle();
    if (cur && (cur as { status: string }).status === "published") {
      // still allow delete but ensure cache invalidates; alternatively block
      // We'll allow deletion of draft/scheduled only strictly; block published
      return fail(400, "Cannot delete a published exam");
    }
    const { error } = await svc.from("exams").delete().eq("id", id);
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    await cacheInvalidate("list:exams:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");
    const res = ok({ ok: true });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
