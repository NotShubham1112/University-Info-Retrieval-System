import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServerClient } from "@/lib/supabase/server";
import { StudentForm } from "@/components/admin/student-form";

export default async function NewStudentPage() {
  const { admin } = await requireAdmin();
  if (!admin) redirect("/search");

  const supabase = await createServerClient();
  const { data: university } = await supabase
    .from("universities")
    .select("id")
    .order("id")
    .limit(1)
    .maybeSingle();
  const { data: campus } = university
    ? await supabase
        .from("campuses")
        .select("id")
        .eq("university_id", university.id)
        .order("id")
        .limit(1)
        .maybeSingle()
    : { data: null };
  const { data: programs } = await supabase
    .from("programs")
    .select("id,name")
    .order("id");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        Back to admin
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Add student</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Create a new student record.
      </p>
      {!university || !campus ? (
        <p className="text-sm text-muted-foreground">
          No university or campus found. Seed the database first.
        </p>
      ) : (
        <StudentForm
          programs={programs ?? []}
          defaults={{ universityId: university.id, campusId: campus.id }}
        />
      )}
    </main>
  );
}
