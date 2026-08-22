"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useImportAttendance } from "@/hooks/use-attendance";
import { toast } from "@/components/ui/sonner";

export function CsvImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [csvText, setCsvText] = React.useState("student_id,course_id,subject_id,date,status\n1,1,1,2026-08-20,present\n2,1,1,2026-08-20,absent\n");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const mut = useImportAttendance();
  const [result, setResult] = React.useState<{ inserted: number; updated: number; failed: Array<{ row: number; error: string }> } | null>(null);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    const text = await f.text();
    setCsvText(text);
  };

  const handleImport = async () => {
    try {
      const res = await mut.mutateAsync({ csvText });
      setResult(res);
      toast.success(`Imported ${res.inserted}, ${res.failed.length} failed`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(["student_id,course_id,subject_id,date,status\n1,1,,2026-08-20,present\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "attendance_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk attendance import (CSV)</DialogTitle>
          <DialogDescription>Per-row validation like student import. BATCH 100 upsert. Refresh mv_attendance_summary after imports (lazy stale-timeout acceptable).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>Download template</Button>
            <Label className="flex items-center gap-2 text-sm">
              <Input type="file" accept=".csv,text/csv" className="max-w-[200px]" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              {fileName ? <span className="text-xs text-muted-foreground">{fileName}</span> : null}
            </Label>
          </div>
          <div className="space-y-1">
            <Label>CSV text</Label>
            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={10} className="w-full rounded-lg border bg-background p-2 font-mono text-xs" placeholder="student_id,course_id,subject_id,date,status" />
          </div>
          {result ? (
            <div className="rounded-lg border p-3 text-sm">
              <div>Inserted: {result.inserted} · Updated: {result.updated} · Failed: {result.failed.length}</div>
              {result.failed.length > 0 ? (
                <ul className="mt-2 max-h-32 list-disc overflow-y-auto pl-5 text-xs text-destructive">
                  {result.failed.slice(0, 20).map((f) => <li key={f.row}>Row {f.row}: {f.error}</li>)}
                  {result.failed.length > 20 ? <li>...and {result.failed.length - 20} more</li> : null}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleImport} disabled={mut.isPending}>{mut.isPending ? "Importing..." : "Import"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
