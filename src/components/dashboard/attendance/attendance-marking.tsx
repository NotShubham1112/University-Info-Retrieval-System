"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarkAttendance } from "@/hooks/use-attendance";
import { toast } from "@/components/ui/sonner";

type Status = "present" | "absent" | "late" | "leave";
const STATUSES: Status[] = ["present", "absent", "late", "leave"];

interface RosterRow {
  student_id: number;
  name?: string;
}

export function AttendanceMarking({
  courseId,
  subjectId,
  date,
  roster,
  onCourseIdChange,
  onSubjectIdChange,
  onDateChange,
}: {
  courseId: string;
  subjectId: string;
  date: string;
  roster: RosterRow[];
  onCourseIdChange: (v: string) => void;
  onSubjectIdChange: (v: string) => void;
  onDateChange: (v: string) => void;
}) {
  const [statusMap, setStatusMap] = React.useState<Record<number, Status>>({});
  const markMut = useMarkAttendance();

  React.useEffect(() => {
    // Initialize all to present by default when roster changes
    const init: Record<number, Status> = {};
    roster.forEach((r) => { init[r.student_id] = statusMap[r.student_id] ?? "present"; });
    if (roster.length > 0 && Object.keys(statusMap).length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatusMap(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  const setStatus = (sid: number, s: Status) => setStatusMap((prev) => ({ ...prev, [sid]: s }));
  const markAll = (s: Status) => {
    const next: Record<number, Status> = {};
    roster.forEach((r) => { next[r.student_id] = s; });
    setStatusMap(next);
  };

  const handleSave = async () => {
    const cid = Number(courseId);
    if (!cid || !date) {
      toast.error("course_id and date are required");
      return;
    }
    const records = roster.map((r) => ({ student_id: r.student_id, status: statusMap[r.student_id] ?? "present" }));
    if (records.length === 0) {
      toast.error("No students in roster");
      return;
    }
    try {
      await markMut.mutateAsync({ course_id: cid, subject_id: subjectId ? Number(subjectId) : null, date, records });
      toast.success(`Attendance saved for ${records.length} students`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Mark attendance — date + subject picker, roster segmented control, save all one mutation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label>Course ID *</Label><Input value={courseId} onChange={(e) => onCourseIdChange(e.target.value)} placeholder="1" /></div>
          <div className="space-y-1"><Label>Subject ID</Label><Input value={subjectId} onChange={(e) => onSubjectIdChange(e.target.value)} placeholder="optional" /></div>
          <div className="space-y-1"><Label>Date *</Label><Input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button key={s} variant="outline" size="sm" onClick={() => markAll(s)} className="capitalize">{`All ${s}`}</Button>
          ))}
        </div>
        {roster.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No roster — search/select course to load students, or import via CSV bulk below.</div>
        ) : (
          <div className="max-h-[380px] space-y-2 overflow-y-auto rounded-lg border p-3">
            {roster.map((r) => (
              <div key={r.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
                <div className="text-sm font-medium">#{r.student_id} {r.name ? `· ${r.name}` : ""}</div>
                <div className="flex gap-1">
                  {STATUSES.map((s) => (
                    <Button key={s} size="sm" variant={statusMap[r.student_id] === s ? "default" : "outline"} onClick={() => setStatus(r.student_id, s)} className="h-7 px-2 text-xs capitalize">{s}</Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <Button onClick={handleSave} disabled={markMut.isPending || roster.length === 0 || !courseId || !date} className="w-full sm:w-auto">
          {markMut.isPending ? "Saving..." : `Save all (${roster.length})`}
        </Button>
        <p className="text-xs text-muted-foreground">POST single: {"{ course_id, subject_id, date, records:[{student_id,status}] }"} — upsert against admissions, status enum present/absent/late/leave. Cache list:attendance: 60s.</p>
      </CardContent>
    </Card>
  );
}
