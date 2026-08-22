import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok } from "@/lib/api/handlers";
import { marksBatchSchema } from "@/lib/validation/exam";
import { cacheInvalidate } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

/**
 * POST /api/dashboard/exams/[id]/marks
 * Upserts subject_marks (internal/external, attempt_number) for an exam.
 * Body: { marks: Array<{ student_id, subject_id, internal_marks?, external_marks?, attempt_number? }> }
 * Also GET to list marks for exam.
 */

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const svc = createServiceClient();
  try {
    const examId = Number(id);
    const { data, error } = await svc
      .from("subject_marks")
      .select("id,student_id,subject_id,exam_id,internal_marks,external_marks,marks,grade,grade_point,result_status,attempt_number,created_at,updated_at")
      .eq("exam_id", examId)
      .order("student_id", { ascending: true })
      .order("subject_id", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return ok({ data: data ?? [] });
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
  // Support both { marks: [...] } and direct array
  const payload = (() => {
    const raw = json as Record<string, unknown>;
    if (Array.isArray(raw["marks"])) return { marks: raw["marks"] };
    if (Array.isArray(json)) return { marks: json };
    return raw as Record<string, unknown>;
  })();

  const parsed = marksBatchSchema.safeParse(payload);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return fail(400, msg);
  }
  const { marks } = parsed.data;

  const examId = Number(id);
  const svc = createServiceClient();

  // Verify exam exists and not yet published (allow marks even if published? but warn)
  const { data: exam } = await svc.from("exams").select("id,status,semester_no,course_id").eq("id", examId).maybeSingle();
  if (!exam) return fail(404, "exam not found", "NOT_FOUND");

  // Validate subjects belong to exam (exam_subjects)
  const { data: examSubjects } = await svc
    .from("exam_subjects")
    .select("subject_id,max_marks,pass_marks")
    .eq("exam_id", examId);
  const subjectMap = new Map<number, { max_marks: number; pass_marks: number }>();
  (examSubjects ?? []).forEach((es: unknown) => {
    const r = es as { subject_id: number; max_marks: number; pass_marks: number };
    subjectMap.set(Number(r.subject_id), { max_marks: Number(r.max_marks), pass_marks: Number(r.pass_marks) });
  });

  // Build upsert rows
  const toUpsert: Array<Record<string, unknown>> = marks.map((m) => {
    const internal = m.internal_marks ?? null;
    const external = m.external_marks ?? null;
    // total marks = internal + external (or whichever present)
    let total: number | null = null;
    if (internal !== null && external !== null) total = Number(internal) + Number(external);
    else if (internal !== null) total = Number(internal);
    else if (external !== null) total = Number(external);
    const subjInfo = subjectMap.get(Number(m.subject_id));
    const maxMarks = subjInfo?.max_marks ?? 100;
    const passMarks = subjInfo?.pass_marks ?? 40;
    let result_status: string = "pending";
    if (total !== null) {
      result_status = total >= passMarks ? "pass" : "fail";
      // cap at max
      if (total > maxMarks) {
        // still pass but clamped validation; allow but note
      }
    }
    // grade derivation (simple): >=90 A+, >=80 A, >=70 B+, >=60 B, >=50 C, >=40 D else F
    let grade: string | null = null;
    let grade_point: number | null = null;
    if (total !== null && maxMarks > 0) {
      const pct = (total / maxMarks) * 100;
      if (pct >= 90) { grade = "A+"; grade_point = 10; }
      else if (pct >= 80) { grade = "A"; grade_point = 9; }
      else if (pct >= 70) { grade = "B+"; grade_point = 8; }
      else if (pct >= 60) { grade = "B"; grade_point = 7; }
      else if (pct >= 50) { grade = "C"; grade_point = 6; }
      else if (pct >= 40) { grade = "D"; grade_point = 5; }
      else { grade = "F"; grade_point = 0; }
    }
    return {
      student_id: Number(m.student_id),
      subject_id: Number(m.subject_id),
      exam_id: examId,
      internal_marks: internal,
      external_marks: external,
      marks: total,
      grade,
      grade_point,
      result_status,
      attempt_number: Number(m.attempt_number ?? 1),
    };
  });

  // Validate students exist
  const studentIds = [...new Set(toUpsert.map((r) => Number(r["student_id"])))];
  const { data: students } = await svc.from("students").select("id").in("id", studentIds as never) as unknown as { data: Array<{ id: number }> | null };
  const validIds = new Set((students ?? []).map((s) => s.id));
  const invalid = studentIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    return fail(400, `students not found: ${invalid.join(",")}`);
  }
  // Filter unknown subjects (warn but still allow? We'll error if subject not in exam_subjects when exam has subjects)
  if (subjectMap.size > 0) {
    const unknownSubjects = [...new Set(toUpsert.map((r) => Number(r["subject_id"])))].filter((sid) => !subjectMap.has(sid));
    if (unknownSubjects.length > 0) {
      return fail(400, `subjects not part of exam ${examId}: ${unknownSubjects.join(",")}`);
    }
  }

  try {
    // Upsert with composite conflict: student_id, subject_id, exam_id, attempt_number
    // Use onConflict that matches availability — try most specific first
    const onConflict = "student_id,subject_id,exam_id,attempt_number";
    const { data, error } = await svc
      .from("subject_marks")
      .upsert(toUpsert as never, { onConflict } as never)
      .select("id");
    if (error) {
      // Fallback: try without onConflict (insert)
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("on conflict") || msg.includes("constraint") || msg.includes("duplicate")) {
        // Row-by-row with individual fallback
        let okCount = 0;
        const errors: string[] = [];
        for (const row of toUpsert) {
          const { error: e2 } = await svc.from("subject_marks").upsert([row] as never, { onConflict } as never) as unknown as { error: { message: string } | null };
          if (e2) errors.push(e2.message);
          else okCount++;
        }
        if (errors.length > 0 && okCount === 0) return fail(500, errors[0], "INTERNAL_ERROR");
        await cacheInvalidate("list:exams:");
        const res = ok({ inserted: okCount, upserted: okCount, errors: errors.slice(0, 5) });
        res.headers.set("Cache-Control", "no-store");
        return res;
      }
      throw new Error(error.message);
    }

    await cacheInvalidate("list:exams:");
    await cacheInvalidate("list:");
    const res = ok({ inserted: (data as unknown[])?.length ?? toUpsert.length, upserted: (data as unknown[])?.length ?? toUpsert.length });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
