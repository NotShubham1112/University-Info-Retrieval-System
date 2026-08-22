"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExamsTable } from "@/components/dashboard/exams/exams-table";
import { ExamDialog } from "@/components/dashboard/exams/exam-dialog";
import { MarksDialog } from "@/components/dashboard/exams/marks-dialog";
import { DeleteConfirm } from "@/components/dashboard/exams/delete-confirm";
import { useExams, usePublishExam } from "@/hooks/use-exams";
import type { ExamRow } from "@/lib/api/exams";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function ExamsAdminPage() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [prevCursors, setPrevCursors] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ExamRow | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<ExamRow | null>(null);
  const [marksExam, setMarksExam] = React.useState<ExamRow | null>(null);
  const publishMut = usePublishExam();

  React.useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  React.useEffect(() => { setCursor(null); setPrevCursors([]); }, [debounced]);

  const { data, isLoading, isFetching, error } = useExams({ q: debounced, limit: 20, cursor });

  const rows = (data?.data ?? []) as ExamRow[];
  const nextCursor = data?.nextCursor ?? null;

  const onNext = () => { if (!nextCursor) return; setPrevCursors((prev) => [...prev, cursor ?? ""]); setCursor(nextCursor); };
  const onPrev = () => { setPrevCursors((prev) => { const copy = [...prev]; const pc = copy.pop() ?? null; setCursor(pc || null); return copy; }); };

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (row: ExamRow) => { setEditing(row); setDialogOpen(true); };
  const handlePublish = async (row: ExamRow) => {
    try { const res = await publishMut.mutateAsync(row.id); toast.success(`Published: ${res.semester_records_created} semester_records, ${res.notifications_created} notifications`); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Exams</h1>
          <p className="text-sm text-muted-foreground">CRUD exams + exam_subjects · marks entry POST [id]/marks · publish computes sgpa → semester_records + notifications (transactional).</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> Add exam</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Exams list</CardTitle>
          <span className="text-xs text-muted-foreground">{isFetching ? "Refreshing..." : `${rows.length} rows`}</span>
        </CardHeader>
        <CardContent>
          {error ? <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{(error as Error).message}</div> : null}
          <ExamsTable
            data={rows}
            isLoading={isLoading}
            search={search}
            onSearchChange={setSearch}
            pageInfo={{ hasNext: !!nextCursor, hasPrev: prevCursors.length > 0, nextCursor, prevCursors }}
            onNext={onNext}
            onPrev={onPrev}
            onEdit={openEdit}
            onDelete={(row) => setDeleteRow(row)}
            onMarks={(row) => setMarksExam(row)}
            onPublish={handlePublish}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Upcoming exams widget (cache stats + exams)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {rows.filter((r) => r.status !== "published").slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <span>{r.course_name ?? `Course ${r.course_id}`} · Sem {r.semester_no} · {r.exam_type} · {r.date ?? "no date"}</span>
                <span className="text-xs text-muted-foreground">{r.status}</span>
              </div>
            ))}
            {rows.filter((r) => r.status !== "published").length === 0 && <p className="text-xs text-muted-foreground">No upcoming (draft/scheduled) exams in this page. Try creating one.</p>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Widgets: dashboard_stats RPC (stats: 30s) + upcoming exams from GET /api/dashboard/exams?status=draft,scheduled.</p>
        </CardContent>
      </Card>

      <ExamDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <DeleteConfirm open={!!deleteRow} onOpenChange={(v) => !v && setDeleteRow(null)} row={deleteRow} />
      <MarksDialog open={!!marksExam} onOpenChange={(v) => !v && setMarksExam(null)} exam={marksExam} />
    </div>
  );
}
