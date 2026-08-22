import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { notFound } from "next/navigation";

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

async function StudentProfile({ id }: { id: string }) {
  const supabase = await createServerClient();

  // Prefer student_summary view (v4) — single row with admissions + academic_progress + latest semester
  const { data, error } = await supabase
    .from("student_summary")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!error && data) {
    return <ProfileTabs student={data as unknown as Parameters<typeof ProfileTabs>[0]["student"]} />;
  }

  // Fallback to direct students row (v3 core) when view not yet deployed or row missing summary join
  const { data: fallback, error: fallbackErr } = await supabase
    .from("students")
    .select(
      "id,pnr,roll_number,first_name,last_name,date_of_birth,email,phone,admission_date,status,program_id,campus_id,category_id,abc_id,gender,address,city,state,country,blood_group,photo_path,guardian_name,guardian_contact_number,created_at,updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (fallbackErr || !fallback) notFound();

  // Enrich fallback with admissions + academic_progress if available (best-effort)
  let enriched: Record<string, unknown> = { ...fallback };
  try {
    const [{ data: adm }, { data: ap }, { data: sr }] = await Promise.all([
      supabase.from("admissions").select("id,course_id,academic_year_id,admission_mode,seat_type,intake_stream,expected_grad_year,roll_number").eq("student_id", id).maybeSingle(),
      supabase.from("academic_progress").select("current_semester,backlog_count").eq("student_id", id).maybeSingle(),
      supabase.from("semester_records").select("semester_no,sgpa,result_status,declared_at").eq("student_id", id).order("semester_no", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (adm) {
      enriched = {
        ...enriched,
        admission_id: (adm as { id: number }).id,
        course_id: (adm as { course_id: number | null }).course_id,
        academic_year_id: (adm as { academic_year_id: number | null }).academic_year_id,
        admission_mode: (adm as { admission_mode: string | null }).admission_mode,
        seat_type: (adm as { seat_type: string | null }).seat_type,
        intake_stream: (adm as { intake_stream: string | null }).intake_stream,
        expected_grad_year: (adm as { expected_grad_year: number | null }).expected_grad_year,
        admission_roll_number: (adm as { roll_number: string | null }).roll_number,
      };
    }
    if (ap) {
      enriched = {
        ...enriched,
        current_semester: (ap as { current_semester: number | null }).current_semester,
        backlog_count: (ap as { backlog_count: number | null }).backlog_count,
      };
    }
    if (sr) {
      enriched = {
        ...enriched,
        latest_semester_no: (sr as { semester_no: number | null }).semester_no,
        latest_sgpa: (sr as { sgpa: number | null }).sgpa,
        latest_result_status: (sr as { result_status: string | null }).result_status,
        latest_declared_at: (sr as { declared_at: string | null }).declared_at,
      };
    }
  } catch {
    // best-effort only
  }

  return <ProfileTabs student={enriched as unknown as Parameters<typeof ProfileTabs>[0]["student"]} />;
}

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-5xl p-6">
      <Suspense fallback={<ProfileSkeleton />}>
        <StudentProfile id={id} />
      </Suspense>
    </main>
  );
}
