"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeachersTable } from "@/components/dashboard/teachers/teachers-table";
import { TeacherDialog } from "@/components/dashboard/teachers/teacher-dialog";
import { DeleteConfirm } from "@/components/dashboard/teachers/delete-confirm";
import { useTeachers } from "@/hooks/use-teachers";
import type { TeacherRow } from "@/lib/api/teachers";
import { Plus } from "lucide-react";

export default function TeachersAdminPage() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [prevCursors, setPrevCursors] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TeacherRow | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<TeacherRow | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  React.useEffect(() => { setCursor(null); setPrevCursors([]); }, [debounced]);

  const { data, isLoading, isFetching, error } = useTeachers({ q: debounced, limit: 20, cursor });

  const rows = (data?.data ?? []) as TeacherRow[];
  const nextCursor = data?.nextCursor ?? null;

  const onNext = () => {
    if (!nextCursor) return;
    setPrevCursors((prev) => [...prev, cursor ?? ""]);
    setCursor(nextCursor);
  };
  const onPrev = () => {
    setPrevCursors((prev) => {
      const copy = [...prev];
      const prevCursor = copy.pop() ?? null;
      setCursor(prevCursor || null);
      return copy;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Teachers</h1>
          <p className="text-sm text-muted-foreground">CRUD with teacher:write gate, email unique check, department join. Salary never projected.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="size-4" /> Add teacher</Button>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Teachers list</CardTitle>
          <span className="text-xs text-muted-foreground">{isFetching ? "Refreshing..." : `${rows.length} rows`}</span>
        </CardHeader>
        <CardContent>
          {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{(error as Error).message}</div> : null}
          <TeachersTable data={rows} isLoading={isLoading} search={search} onSearchChange={setSearch} pageInfo={{ hasNext: !!nextCursor, hasPrev: prevCursors.length > 0, nextCursor, prevCursors }} onNext={onNext} onPrev={onPrev} onEdit={(row) => { setEditing(row); setDialogOpen(true); }} onDelete={(row) => setDeleteRow(row)} />
          <div className="mt-3 flex gap-2 text-xs text-muted-foreground"><span>Cache: list:teachers: 300s</span><span>·</span><span>Invalidation: list:, stats: on mutations</span></div>
        </CardContent>
      </Card>
      <TeacherDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <DeleteConfirm open={!!deleteRow} onOpenChange={(v) => !v && setDeleteRow(null)} row={deleteRow} />
    </div>
  );
}
