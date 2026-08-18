import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { buttonVariants } from "@/components/ui/button";

export default async function AdminPage() {
  const { admin } = await requireAdmin();
  if (!admin) redirect("/search");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Admin</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Add students, courses, and departments.
      </p>
      <div className="flex flex-col gap-2">
        <Link href="/admin/students/new" className={buttonVariants()}>
          Add student
        </Link>
        <Link
          href="/admin/students/1/edit"
          className={buttonVariants({ variant: "outline" })}
        >
          Edit student
        </Link>
        <Link
          href="/admin/courses/new"
          className={buttonVariants({ variant: "outline" })}
        >
          Add course
        </Link>
        <Link
          href="/admin/departments/new"
          className={buttonVariants({ variant: "outline" })}
        >
          Add department
        </Link>
        <Link
          href="/search"
          className={buttonVariants({ variant: "ghost" })}
        >
          Back to search
        </Link>
      </div>
    </main>
  );
}
