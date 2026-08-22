import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCachedOrSet, CACHE_TTL } from "@/lib/cache/index";
import { WidgetCard, WidgetCardSkeleton } from "@/components/dashboard/widget-card";
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  Wallet,
  Calendar,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export const dynamic = "force-dynamic";

type DashboardStats = {
  total_students: number;
  total_teachers: number;
  total_courses: number;
  attendance_pct: number | string | null;
  pending_fees: number;
  pending_fees_amount: number | string | null;
  upcoming_exams: number;
  active_students: number;
};

async function fetchDashboardStats(): Promise<DashboardStats | null> {
  const cacheKey = "stats:dashboard_stats:default";
  return getCachedOrSet<DashboardStats | null>(
    cacheKey,
    CACHE_TTL.stats,
    async () => {
      const supabase = await createServerClient();
      const { data, error } = await supabase.rpc("dashboard_stats", {
        p_academic_year: null,
      });
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as DashboardStats) ?? null;
    }
  );
}

async function fetchUpcomingExams(): Promise<Array<{ id: number; course_id: number; semester_no: number; exam_type: string; date: string | null; status: string; course_name?: string | null }>> {
  const cacheKey = "stats:upcoming_exams:list";
  return getCachedOrSet<Array<{ id: number; course_id: number; semester_no: number; exam_type: string; date: string | null; status: string; course_name?: string | null }>>(
    cacheKey,
    CACHE_TTL.stats,
    async () => {
      const svc = createServiceClient();
      const { data, error } = await svc
        .from("exams")
        .select("id,course_id,semester_no,exam_type,date,status,courses(branch_or_course)")
        .in("status", ["draft", "scheduled"] as never)
        .order("date", { ascending: true, nullsFirst: false })
        .limit(5);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<{ id: number; course_id: number; semester_no: number; exam_type: string; date: string | null; status: string; courses: { branch_or_course: string } | null }>;
      return rows.map((r) => ({ ...r, course_name: r.courses?.branch_or_course ?? null }));
    }
  ).catch(() => []);
}

async function StatsWidgets() {
  let stats: DashboardStats | null = null;
  let error: string | null = null;
  try {
    stats = await fetchDashboardStats();
  } catch (e) {
    error = (e as Error).message;
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Failed to load dashboard stats</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {error} — check Supabase connection and that `dashboard_stats()` RPC is deployed (migration 0010). Seed data may be missing.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">No stats available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Run seed and <code>refresh_report_views()</code> to populate dashboard data.
          </p>
        </CardContent>
      </Card>
    );
  }

  const attendance = stats.attendance_pct ?? 0;
  const pendingAmount = stats.pending_fees_amount ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <WidgetCard
        label="Total Students"
        value={Number(stats.total_students).toLocaleString()}
        icon={<Users />}
        delta={`${Number(stats.active_students).toLocaleString()} active`}
      />
      <WidgetCard
        label="Total Teachers"
        value={Number(stats.total_teachers).toLocaleString()}
        icon={<GraduationCap />}
        delta="Active faculty"
      />
      <WidgetCard
        label="Total Courses"
        value={Number(stats.total_courses).toLocaleString()}
        icon={<BookOpen />}
        delta="Across all departments"
      />
      <WidgetCard
        label="Attendance"
        value={`${Number(attendance).toFixed(1)}%`}
        icon={<ClipboardCheck />}
        delta="Overall attendance"
      />
      <WidgetCard
        label="Pending Fees"
        value={Number(stats.pending_fees).toLocaleString()}
        icon={<Wallet />}
        delta={`₹${Number(pendingAmount).toLocaleString()} outstanding`}
      />
      <WidgetCard
        label="Upcoming Exams"
        value={Number(stats.upcoming_exams).toLocaleString()}
        icon={<Calendar />}
        delta="Scheduled & draft"
      />
      <WidgetCard
        label="Active Students"
        value={Number(stats.active_students).toLocaleString()}
        icon={<Activity />}
        delta={`${((Number(stats.active_students) / Math.max(1, Number(stats.total_students))) * 100).toFixed(1)}% of total`}
      />
    </div>
  );
}

async function UpcomingExamsSection() {
  const upcoming = await fetchUpcomingExams();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">Upcoming exams</CardTitle>
        <Link href="/dashboard/admin/exams" className="text-xs text-muted-foreground underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-xs text-muted-foreground">No upcoming exams (draft/scheduled). Create one in Exams.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">
                    {ex.course_name ?? `Course ${ex.course_id}`} · Sem {ex.semester_no}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ex.exam_type} · {ex.date ?? "no date"} · {ex.status}
                  </div>
                </div>
                <span className="text-xs font-mono">#{ex.id}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Cache stats:upcoming_exams:list (30s) · from exams table via service role.</p>
      </CardContent>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <WidgetCardSkeleton key={i} />
      ))}
    </div>
  );
}

function UpcomingSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-12" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-3 w-48" />
      </CardContent>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<StatsSkeleton />}>
        <StatsWidgets />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<UpcomingSkeleton />}>
          <UpcomingExamsSection />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Widgets are fed by the <code>dashboard_stats()</code> RPC through cache prefix <code>stats:</code> (30s TTL, layered LRU → Redis). Mutations in admin modules should call{" "}
              <code>cacheInvalidate(&quot;stats:&quot;)</code> and refresh materialized views where needed.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded bg-muted px-2 py-1">
                Cache: <code>stats:dashboard_stats:default</code>
              </span>
              <span className="rounded bg-muted px-2 py-1">TTL: {CACHE_TTL.stats}s</span>
              <span className="rounded bg-muted px-2 py-1">
                RPC: <code>dashboard_stats(p_academic_year text)</code>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
