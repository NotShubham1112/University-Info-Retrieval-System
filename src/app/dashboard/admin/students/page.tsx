/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentsTable } from "@/components/dashboard/students/students-table";
import { StudentDialog } from "@/components/dashboard/students/student-dialog";
import { DeleteConfirm } from "@/components/dashboard/students/delete-confirm";
import { DocumentUpload } from "@/components/dashboard/students/document-upload";
import { useStudents } from "@/hooks/use-students";
import type { StudentRow } from "@/lib/api/students";
import { Plus, Upload } from "lucide-react";

// Heavy CSV import dialog — dynamic split keeps initial JS smaller
const CsvImportDialog = dynamic(
  () => import("@/components/dashboard/students/csv-import").then((m) => m.CsvImportDialog),
  { loading: () => <Skeleton className="h-32 w-full" />, ssr: false }
);

export default function StudentsAdminPage() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [prevCursors, setPrevCursors] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StudentRow | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<StudentRow | null>(null);
  const [docStudent, setDocStudent] = React.useState<StudentRow | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset pagination when search changes
  React.useEffect(() => {
    setCursor(null);
    setPrevCursors([]);
  }, [debounced]);

  const { data, isLoading, isFetching, error } = useStudents({
    q: debounced,
    limit: 20,
    cursor,
  });

  const rows = (data?.data ?? []) as StudentRow[];
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

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (row: StudentRow) => {
    setEditing(row);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">
            Reference module — full CRUD, bulk CSV import (BATCH 100), documents, autosave/draft.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" /> Import CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Add student
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Students list</CardTitle>
          <span className="text-xs text-muted-foreground">{isFetching ? "Refreshing..." : `${rows.length} rows`}</span>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {(error as Error).message}
            </div>
          ) : null}
          <StudentsTable
            data={rows}
            isLoading={isLoading}
            search={search}
            onSearchChange={setSearch}
            pageInfo={{
              hasNext: !!nextCursor,
              hasPrev: prevCursors.length > 0,
              nextCursor,
              prevCursors,
            }}
            onNext={onNext}
            onPrev={onPrev}
            onEdit={openEdit}
            onDelete={(row) => setDeleteRow(row)}
            onUploadDocs={(row) => setDocStudent(row)}
          />
          <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
            <span>Cache: list:GET:/api/dashboard/students (60s)</span>
            <span>·</span>
            <span>Invalidation: profile:, search:, list:, stats: on mutations</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Stats strip</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Visible rows</div>
              <div className="text-lg font-semibold">{rows.length}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="text-lg font-semibold">{rows.filter((r) => r.status === "active").length}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Inactive</div>
              <div className="text-lg font-semibold">{rows.filter((r) => r.status === "inactive").length}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Cursor</div>
              <div className="text-xs font-mono">{cursor ?? "—"} → {nextCursor ?? "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <StudentDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <DeleteConfirm open={!!deleteRow} onOpenChange={(v) => !v && setDeleteRow(null)} row={deleteRow} />
      <DocumentUpload open={!!docStudent} onOpenChange={(v) => !v && setDocStudent(null)} student={docStudent} />
      {importOpen ? <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} /> : null}
    </div>
  );
}
