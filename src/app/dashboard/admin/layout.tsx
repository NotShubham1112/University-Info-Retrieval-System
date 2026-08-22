import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getUserRole, requireDashboardAccess } from "@/lib/auth/rbac";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let role: ReturnType<typeof getUserRole> = null;

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    role = getUserRole(user);
  } catch {
    // If Supabase not configured at build time, allow rendering; middleware enforces at runtime
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Admin ERP</h1>
            <p className="text-sm text-muted-foreground">
              Full data-entry operations.
            </p>
          </div>
        </div>
        {children}
      </div>
    );
  }

  try {
    requireDashboardAccess(role, "admin");
  } catch {
    redirect("/dashboard/viewer");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Admin ERP</h1>
          <p className="text-sm text-muted-foreground">
            Full data-entry operations. Changes invalidate cache and refresh
            materialized views.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/admin/students"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Import CSV
          </Link>
          <Link
            href="/dashboard/admin/students"
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            New Student
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
