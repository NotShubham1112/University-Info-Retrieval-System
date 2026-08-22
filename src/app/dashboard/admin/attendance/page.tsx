"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttendance } from "@/hooks/use-attendance";
import { useStudents } from "@/hooks/use-students";
import { Upload } from "lucide-react";

// Heavy attendance components — dynamically imported
const AttendanceMarking = dynamic(
  () => import("@/components/dashboard/attendance/attendance-marking").then((m) => m.AttendanceMarking),
  { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
);
const AttendanceReport = dynamic(
  () => import("@/components/dashboard/attendance/attendance-report").then((m) => m.AttendanceReport),
  { loading: () => <Skeleton className="h-48 w-full" /> }
);
const CsvImportDialog = dynamic(
  () => import("@/components/dashboard/attendance/csv-import").then((m) => m.CsvImportDialog),
  { loading: () => <Skeleton className="h-32 w-full" />, ssr: false }
);

export default function AttendanceAdminPage() {
  const [courseId, setCourseId] = React.useState("1");
  const [subjectId, setSubjectId] = React.useState("");
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [filterCourse, setFilterCourse] = React.useState("");
  const [importOpen, setImportOpen] = React.useState(false);

  // Load attendance list for current filters (cache list:attendance: 60s)
  const { data: attData, isLoading: attLoading, error: attError } = useAttendance({
    course_id: courseId ? Number(courseId) : null,
    subject_id: subjectId ? Number(subjectId) : null,
    date: date || null,
    limit: 20,
  });

  // Roster: pull students for the course (simple: first 30 students as roster demo)
  // In production, roster would be enrolled students for course via admissions query.
  const { data: studentsData } = useStudents({ limit: 30, q: "" });
  const roster = React.useMemo(() => {
    const rows = (studentsData?.data ?? []) as Array<{ id: number; first_name: string; last_name: string; course_id?: number | null; program_id?: number | null }>;
    // Filter by course if possible (admission course_id or program_id)
    const cid = courseId ? Number(courseId) : null;
    const filtered = cid ? rows.filter((r) => r.course_id === cid || r.program_id === cid) : rows;
    // If filter yields none, fallback to all
    const pool = filtered.length > 0 ? filtered : rows;
    return pool.slice(0, 30).map((r) => ({ student_id: r.id, name: `${r.first_name} ${r.last_name}` }));
  }, [studentsData, courseId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">Marking with bulk upload and percentage reports. attendance:write for mutations, attendance:read for reports.</p>
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-4" /> Import CSV</Button>
      </div>

      <React.Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AttendanceMarking
          courseId={courseId}
          subjectId={subjectId}
          date={date}
          roster={roster}
          onCourseIdChange={setCourseId}
          onSubjectIdChange={setSubjectId}
          onDateChange={setDate}
        />
      </React.Suspense>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Attendance list (GET list, cache 60s)</CardTitle>
          <span className="text-xs text-muted-foreground">{attLoading ? "Loading..." : `${attData?.data?.length ?? 0} rows`}</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <div className="space-y-1"><Label>Filter course_id</Label><Input value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} placeholder="e.g. 1" className="max-w-[140px]" /></div>
            <div className="text-xs text-muted-foreground self-end">Filtering is server-side; pagination via cursor (id).</div>
          </div>
          {attError ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{(attError as Error).message}</div> : null}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="p-2 text-left">Student</th><th className="p-2 text-left">Date</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Subject</th></tr></thead>
              <tbody>
                {(attData?.data ?? []).length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No attendance records for this filter. Mark attendance above or bulk import.</td></tr> :
                  (attData?.data ?? []).slice(0, 20).map((r) => (
                    <tr key={r.id} className="border-t"><td className="p-2">#{r.student_id}</td><td className="p-2">{r.date}</td><td className="p-2"><span className="rounded-full border px-2 py-0.5 text-xs capitalize">{r.status}</span></td><td className="p-2">{r.subject_id ?? "—"}</td></tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Cache: list:attendance: 60s · Invalidated on write · enrollments check against admissions/course_id · status enum present/absent/late/leave</p>
        </CardContent>
      </Card>

      <React.Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <AttendanceReport courseId={courseId} subjectId={subjectId} />
      </React.Suspense>
      {importOpen ? <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} /> : null}
    </div>
  );
}
