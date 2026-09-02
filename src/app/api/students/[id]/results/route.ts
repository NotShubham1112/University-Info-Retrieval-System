import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCachedOrSet, CACHE_TTL } from "@/lib/cache/index";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sid = Number(id);
  if (!Number.isFinite(sid)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const cacheKey = `profile:results:${sid}`;

  try {
    const data = await getCachedOrSet(cacheKey, CACHE_TTL.profile, async () => {
      const supabase = await createServerClient();
      // v4: subject_marks has student_id directly (indexed), join subjects for name/semester
      const { data, error } = await supabase
        .from("subject_marks")
        .select("id,subject_id,exam_id,internal_marks,external_marks,marks,grade,grade_point,result_status,attempt_number,subjects!inner(name,code,semester_no)")
        .eq("student_id", sid)
        .order("id", { ascending: true })
        .limit(100);
      if (error) throw error;
      // normalize — keep v4 fields + compat `enrollments.subjects` shape expected by academic-tab.tsx:49
      return (data ?? []).map((r: any) => {
        const subj = r.subjects ?? {};
        const computedMarks = r.marks ?? (r.internal_marks != null && r.external_marks != null ? Number(r.internal_marks) + Number(r.external_marks) : r.marks);
        return {
          id: r.id,
          subject_id: r.subject_id,
          exam_id: r.exam_id,
          marks: computedMarks,
          internal_marks: r.internal_marks,
          external_marks: r.external_marks,
          grade: r.grade,
          grade_point: r.grade_point,
          result_status: r.result_status,
          attempt_number: r.attempt_number,
          subject_name: subj.name ?? null,
          subject_code: subj.code ?? null,
          semester_no: subj.semester_no ?? null,
          // compat for old tab
          enrollments: { subjects: { name: subj.name ?? "—", code: subj.code ?? "—", semester_no: subj.semester_no ?? null } },
        };
      });
    });

    const res = NextResponse.json(data);
    res.headers.set("Cache-Control", `public, max-age=${CACHE_TTL.profile}, stale-while-revalidate=30`);
    return res;
  } catch (e: any) {
    // never 500 for missing table/empty — return empty array (profile still renders)
    console.warn("[results] fallback empty:", e?.message);
    return NextResponse.json([]);
  }
}
