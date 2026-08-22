import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getCachedOrSet, CACHE_TTL } from "@/lib/cache/index";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Users, GraduationCap, BookOpen, Activity, Search } from "lucide-react";

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

type StudentSummaryRow = {
  id: number;
  pnr: string;
  roll_number: string | null;
  first_name: string;
  last_name: string;
  search_name: string | null;
  status: string | null;
  program_id: number | null;
  course_id: number | null;
  category_id: number | null;
};

async function fetchViewerStats(): Promise<DashboardStats | null> {
  const cacheKey = "stats:dashboard_stats:viewer";
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

async function fetchViewerStudents(
  q: string,
  limit = 20
): Promise<StudentSummaryRow[]> {
  const safeQ = q.trim().slice(0, 100);
  const cacheKey = `search:viewer:${safeQ}:${limit}`;
  return getCachedOrSet<StudentSummaryRow[]>(
    cacheKey,
    CACHE_TTL.search,
    async () => {
      const supabase = await createServerClient();
      const { data, error } = await supabase.rpc("search_students", {
        q: safeQ,
        p_limit: limit,
        p_cursor: null,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as StudentSummaryRow[];
    }
  );
}

function ViewerSearchForm({ q }: { q: string }) {
  return (
    <form
      action="/dashboard/viewer"
      method="get"
      className="flex items-center gap-2"
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by name, PNR, or roll number…"
          className="pl-8"
          autoComplete="off"
        />
      </div>
      <button
        type="submit"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Search
      </button>
      {q ? (
        <Link
          href="/dashboard/viewer"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}

export default async function ViewerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = params?.q ?? "";

  let stats: DashboardStats | null = null;
  let students: StudentSummaryRow[] = [];
  let statsError: string | null = null;
  let studentsError: string | null = null;

  try {
    stats = await fetchViewerStats();
  } catch (e) {
    statsError = (e as Error).message;
  }

  try {
    students = await fetchViewerStudents(q, 20);
  } catch (e) {
    studentsError = (e as Error).message;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Viewer — Read-only
        </h1>
        <p className="text-sm text-muted-foreground">
          No mutation controls. For edits, request <code>admin</code> access.
          Data comes from <code>student_summary</code> via cached{" "}
          <code>search_students</code> RPC (<code>search:</code> 10s TTL) and{" "}
          <code>dashboard_stats</code> (<code>stats:</code> 30s TTL).
        </p>
      </div>

      {/* Stat cards — 4 compact cards for viewer */}
      {statsError ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-sm text-destructive">
              Stats unavailable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{statsError}</p>
          </CardContent>
        </Card>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <WidgetCard
            label="Total Students"
            value={Number(stats.total_students).toLocaleString()}
            icon={<Users />}
            delta={`${Number(stats.active_students).toLocaleString()} active`}
          />
          <WidgetCard
            label="Teachers"
            value={Number(stats.total_teachers).toLocaleString()}
            icon={<GraduationCap />}
            delta="Active faculty"
          />
          <WidgetCard
            label="Courses"
            value={Number(stats.total_courses).toLocaleString()}
            icon={<BookOpen />}
            delta="All departments"
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
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm">Students</CardTitle>
          <span className="text-xs text-muted-foreground">
            Read-only table from <code>student_summary</code> via{" "}
            <code>search_students</code>
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <ViewerSearchForm q={q} />

          {studentsError ? (
            <p className="text-xs text-destructive">{studentsError}</p>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students found{q ? ` for "${q}"` : ""}. Seed data may be missing
              — run <code>npm run db:seed</code>.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PNR</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll No.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.pnr}</TableCell>
                      <TableCell className="font-medium">
                        {s.first_name} {s.last_name}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.roll_number ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {s.status ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/students/${s.id}`}
                          className={buttonVariants({ variant: "ghost", size: "xs" })}
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Showing up to 20 results{filtersActive(q) ? ` filtered by "${q}"` : ""}. No
            edit/delete controls in viewer — switch to{" "}
            <Link href="/dashboard/admin" className="underline underline-offset-4">
              Admin ERP
            </Link>{" "}
            for mutations (requires admin role).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function filtersActive(q: string): boolean {
  return q.trim().length > 0;
}
