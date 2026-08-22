"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttendanceReport } from "@/hooks/use-attendance";
import * as React from "react";

export function AttendanceReport({ courseId, subjectId }: { courseId: string; subjectId: string }) {
  const [date, setDate] = React.useState("");
  const [month, setMonth] = React.useState("");
  const [groupBy, setGroupBy] = React.useState<string>("daily");
  const [applied, setApplied] = React.useState<{ date?: string | null; month?: string | null; group_by?: string | null }>({});

  const { data, isLoading, error } = useAttendanceReport({
    course_id: courseId ? Number(courseId) : null,
    subject_id: subjectId ? Number(subjectId) : null,
    date: applied.date ?? null,
    month: applied.month ?? null,
    group_by: (applied.group_by as string) ?? "daily",
  });

  const rows = data?.rows ?? [];
  const summary = data?.summary;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Attendance report — daily/monthly % from mv_attendance_summary (lazy stale-timeout)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Month (YYYY-MM)</Label><Input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="2026-08" /></div>
          <div className="space-y-1"><Label>Group by</Label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v ?? "daily")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["daily", "monthly", "course", "subject"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button variant="outline" onClick={() => setApplied({ date: date || null, month: month || null, group_by: groupBy })}>Apply</Button></div>
        </div>
        {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{(error as Error).message}</div> : null}
        {isLoading ? <Skeleton className="h-24 w-full" /> : (
          <>
            {summary ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-lg font-semibold">{summary.total}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Present</div><div className="text-lg font-semibold">{summary.present}</div></div>
                <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Attendance %</div><div className="text-lg font-semibold">{summary.attendance_pct}%</div></div>
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="p-2 text-left">Date/Course</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Present</th><th className="p-2 text-right">%</th></tr></thead>
                <tbody>
                  {rows.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No rows — try importing attendance first. Cache list:attendance: 60s.</td></tr> :
                    rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t"><td className="p-2">{r.date ?? r.course_id ?? r.subject_id ?? "—"}</td><td className="p-2 text-right">{r.total}</td><td className="p-2 text-right">{r.present}</td><td className="p-2 text-right">{r.attendance_pct}%</td></tr>
                    ))}
                </tbody>
              </table>
            </div>
            {data?.stale ? <p className="text-xs text-muted-foreground">Stale matview — refresh via <code>refresh_report_views()</code> after bulk imports (lazy refresh attempted).</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
