"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useExamMarks, useSubmitMarks } from "@/hooks/use-exams";
import { toast } from "@/components/ui/sonner";
import type { ExamRow } from "@/lib/api/exams";

export function MarksDialog({ open, onOpenChange, exam }: { open: boolean; onOpenChange: (v: boolean) => void; exam: ExamRow | null }) {
  const examId = exam?.id ?? null;
  const { data: marksData, isLoading } = useExamMarks(examId);
  const submitMut = useSubmitMarks();
  const [jsonText, setJsonText] = React.useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => {
    if (marksData) {
      try { setJsonText(JSON.stringify(marksData.data?.slice(0, 3) ?? [], null, 2)); } catch {}
    }
  }, [marksData]);

  const handleSubmit = async () => {
    if (!examId) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      toast.error("Invalid JSON");
      return;
    }
    const marks = Array.isArray(parsed) ? parsed : (parsed as { marks?: unknown[] })?.marks ?? parsed;
    if (!Array.isArray(marks)) { toast.error("Expect array of { student_id, subject_id, internal_marks?, external_marks?, attempt_number? }"); return; }
    try {
      await submitMut.mutateAsync({ id: examId, marks: marks as Record<string, unknown>[] });
      toast.success("Marks saved");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Marks entry — Exam {exam?.id ?? ""} (Sem {exam?.semester_no ?? ""})</SheetTitle>
          <SheetDescription>Submit JSON array: {`{ student_id, subject_id, internal_marks, external_marks, attempt_number }`}. First  fetch shows current marks (up to 3 rows as hint).</SheetDescription>
        </SheetHeader>
        <div className="p-4 space-y-4">
          <div className="rounded border p-3 bg-muted/30 text-xs space-y-2">
            <div className="font-medium">Current marks {isLoading ? "(loading...)" : `(${(marksData?.data?.length ?? 0)} rows)`}</div>
            <pre className="whitespace-pre-wrap break-all text-[11px] max-h-32 overflow-auto">{isLoading ? "Loading..." : (marksData?.data?.length ? JSON.stringify(marksData.data.slice(0,2), null, 2) : "No marks yet")}</pre>
          </div>
          <div className="space-y-1">
            <Label>Marks JSON (array)</Label>
            <Textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={12} placeholder={`[\n  { "student_id": 1, "subject_id": 1, "internal_marks": 18, "external_marks": 62 },\n  { "student_id": 2, "subject_id": 1, "internal_marks": 15, "external_marks": 55 }\n]`} className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">Each subject_marks upserts on (student_id, subject_id, exam_id, attempt_number). Grade/result derived server-side.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={handleSubmit} disabled={submitMut.isPending}>{submitMut.isPending ? "Saving..." : "Submit marks"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
