"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimetablesTable } from "@/components/dashboard/timetables/timetables-table";
import { TimetableDialog } from "@/components/dashboard/timetables/timetable-dialog";
import { DeleteConfirm } from "@/components/dashboard/timetables/delete-confirm";
import { useTimetables } from "@/hooks/use-timetables";
import type { TimetableRow } from "@/lib/api/timetables";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TimetableAdminPage() {
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [prevCursors, setPrevCursors] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TimetableRow | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<TimetableRow | null>(null);

  const [filterCourse, setFilterCourse] = React.useState("");
  const [filterDay, setFilterDay] = React.useState("");

  // Debounced filters reset pagination
  React.useEffect(() => { setCursor(null); setPrevCursors([]); }, [filterCourse, filterDay]);

  const course_id = filterCourse ? Number(filterCourse) : null;
  const day_of_week = filterDay ? Number(filterDay) : null;

  const { data, isLoading, isFetching, error } = useTimetables({
    limit: 20,
    cursor,
    course_id: Number.isFinite(course_id as number) && (course_id as number) > 0 ? course_id : null,
    day_of_week: Number.isFinite(day_of_week as number) && (day_of_week as number) >= 0 ? day_of_week : null,
  });

  const rows = (data?.data ?? []) as TimetableRow[];
  const nextCursor = data?.nextCursor ?? null;

  const onNext = () => { if (!nextCursor) return; setPrevCursors((prev) => [...prev, cursor ?? ""]); setCursor(nextCursor); };
  const onPrev = () => { setPrevCursors((prev) => { const copy = [...prev]; const pc = copy.pop() ?? null; setCursor(pc || null); return copy; }); };

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (row: TimetableRow) => { setEditing(row); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Timetable</h1>
          <p className="text-sm text-muted-foreground">timetable:write gate · CRUD timetables (course/sem/day/period/subject/teacher/room) · conflict checks (teacher busy, room double-booked).</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> Add entry</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Filters</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label>Course ID</Label>
            <Input value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} placeholder="e.g. 1" className="w-32" />
          </div>
          <div className="space-y-1">
            <Label>Day of week (1=Mon)</Label>
            <Input value={filterDay} onChange={(e) => setFilterDay(e.target.value)} placeholder="1-7" className="w-32" />
          </div>
          <div className="self-end text-xs text-muted-foreground">Filters apply with cursor pagination · Teacher/room schedule views via query params · Cache list:timetables: 300s</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Timetable</CardTitle>
          <span className="text-xs text-muted-foreground">{isFetching ? "Refreshing..." : `${rows.length} rows`}</span>
        </CardHeader>
        <CardContent>
          {error ? <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{(error as Error).message}</div> : null}
          <TimetablesTable data={rows} isLoading={isLoading} pageInfo={{ hasNext: !!nextCursor, hasPrev: prevCursors.length > 0, nextCursor, prevCursors }} onNext={onNext} onPrev={onPrev} onEdit={openEdit} onDelete={(row) => setDeleteRow(row)} />
        </CardContent>
      </Card>

      <TimetableDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <DeleteConfirm open={!!deleteRow} onOpenChange={(v) => !v && setDeleteRow(null)} row={deleteRow} />
    </div>
  );
}
