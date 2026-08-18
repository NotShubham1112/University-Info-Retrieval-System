import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createServerClient } from "@/lib/supabase/server";
import { CourseForm } from "@/components/admin/course-form";

export default async function NewCoursePage() {
  const { admin } = await requireAdmin();
  if (!admin) redirect("/search");

  const supabase = await createServerClient();
  const { data: programs } = await supabase
    .from("programs")
    .select("id,name")
    .order("id");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        Back to admin
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold">Add course</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Add a course for a program.
      </p>
      <CourseForm programs={programs ?? []} />
    </main>
  );
}
