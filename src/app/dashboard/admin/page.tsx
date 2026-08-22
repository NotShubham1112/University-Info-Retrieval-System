import { createServerClient } from "@/lib/supabase/server";
import { getCachedOrSet, CACHE_TTL } from "@/lib/cache/index";
import { WidgetCard } from "@/components/dashboard/widget-card";
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
      // Supabase RPC returns array for table-returning functions
      const row = Array.isArray(data) ? data[0] : data;
      return (row as DashboardStats) ?? null;
    }
  );
}

export default async function AdminOverviewPage() {
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
          <CardTitle className="text-sm text-destructive">
            Failed to load dashboard stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {error} — check Supabase connection and that `dashboard_stats()` RPC
            is deployed (migration 0010). Seed data may be missing.
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
            Run seed and <code>refresh_report_views()</code> to populate
            dashboard data.
          </p>
        </CardContent>
      </Card>
    );
  }

  const attendance = stats.attendance_pct ?? 0;
  const pendingAmount = stats.pending_fees_amount ?? 0;

  return (
    <div className="space-y-6">
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
          delta={`${(
            (Number(stats.active_students) /
              Math.max(1, Number(stats.total_students))) *
            100
          ).toFixed(1)}% of total`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Widgets are fed by the <code>dashboard_stats()</code> RPC through
            cache prefix <code>stats:</code> (30s TTL, layered LRU → Redis).
            Mutations in admin modules should call{" "}
            <code>cacheInvalidate(&quot;stats:&quot;)</code> and refresh
            materialized views where needed.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-muted px-2 py-1">
              Cache: <code>stats:dashboard_stats:default</code>
            </span>
            <span className="rounded bg-muted px-2 py-1">
              TTL: {CACHE_TTL.stats}s
            </span>
            <span className="rounded bg-muted px-2 py-1">
              RPC: <code>dashboard_stats(p_academic_year text)</code>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
