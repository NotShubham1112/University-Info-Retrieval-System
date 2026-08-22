import { createServerClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/rbac";
import type { Role } from "@/lib/auth/rbac";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DashboardSidebar } from "@/components/dashboard/admin-nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userEmail: string | null = null;
  let role: Role | null = null;

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
    role = getUserRole(user);
  } catch {
    // Build-time or missing env: render unauthenticated shell; middleware handles redirect at runtime
  }

  return (
    <SidebarProvider>
      <DashboardSidebar role={role} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div className="text-sm font-medium">University ERP — Dashboard</div>
            <div className="flex items-center gap-2">
              {userEmail ? (
                <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                  <span className="max-w-[160px] truncate">{userEmail}</span>
                  {role ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                      {role}
                    </span>
                  ) : null}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Not signed in
                </span>
              )}
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
