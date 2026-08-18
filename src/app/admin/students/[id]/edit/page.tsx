import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServerClient } from "@/lib/supabase/server";
import { StudentForm } from "@/components/admin/student-form";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { admin } = await requireAdmin();
  if (!admin) redirect("/search");

  const { id } = await params;
  const supabase = await createServerClient();
  const { data: student } = await supabase
    .from("students")
    .select(
      "id,pnr,roll_number,first_name,last_name,date_of_birth,email,phone,admission_date,program_id,university_id,campus_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!student) notFound();

  const { data: programs } = await supabase
    .from("programs")
    .select("id,name")
    .order("id");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        Back to admin
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Edit student</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Update the student's details.
      </p>
      <StudentForm initial={student} programs={programs ?? []} />
    </main>
  );
}
