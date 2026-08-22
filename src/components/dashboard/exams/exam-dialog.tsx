"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { examCreateSchema } from "@/lib/validation/schemas";
import { useCreateExam, useUpdateExam } from "@/hooks/use-exams";
import { toast } from "@/components/ui/sonner";
import type { ExamRow } from "@/lib/api/exams";
import { z } from "zod";

type FormValues = z.infer<typeof examCreateSchema>;

export function ExamDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing?: ExamRow | null }) {
  const createMut = useCreateExam();
  const updateMut = useUpdateExam();
  const isEdit = !!editing;

  const defaultVals: Partial<FormValues> = editing
    ? { course_id: editing.course_id, semester_no: editing.semester_no, exam_type: editing.exam_type as "midterm"|"final"|"supplementary", date: editing.date ?? undefined, status: editing.status as "draft"|"scheduled"|"published" }
    : { course_id: undefined as unknown as number, semester_no: 1, exam_type: "final", status: "draft" };

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(examCreateSchema) as any,
    defaultValues: defaultVals as FormValues,
  });

  React.useEffect(() => {
    if (editing) reset({ course_id: editing.course_id, semester_no: editing.semester_no, exam_type: editing.exam_type as never, date: editing.date ?? undefined, status: editing.status as never });
    else reset({ semester_no: 1, exam_type: "final", status: "draft" } as unknown as FormValues);
  }, [editing, reset]);

  const onSubmit = async (values: FormValues & Record<string, unknown>) => {
    try {
      if (isEdit && editing) {
        await updateMut.mutateAsync({ id: editing.id, payload: values as unknown as Record<string, unknown> });
        toast.success("Exam updated");
      } else {
        await createMut.mutateAsync(values as unknown as Record<string, unknown>);
        toast.success("Exam created");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const examType = watch("exam_type");
  const status = watch("status");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit exam" : "Create exam"}</SheetTitle>
          <SheetDescription>Course/semester/type/date + status. Add subjects via edit after creation (exam_subjects).</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit as never)} className="p-4 space-y-4">
          <div className="space-y-1">
            <Label>Course ID *</Label>
            <Input type="number" {...register("course_id", { valueAsNumber: true })} placeholder="e.g. 1" />
            {errors.course_id && <p className="text-xs text-destructive">{errors.course_id.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Semester No *</Label>
            <Input type="number" min={1} max={12} {...register("semester_no", { valueAsNumber: true })} />
            {errors.semester_no && <p className="text-xs text-destructive">{errors.semester_no.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Exam Type</Label>
            <Select value={examType} onValueChange={(v) => setValue("exam_type", v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="midterm">midterm</SelectItem>
                <SelectItem value="final">final</SelectItem>
                <SelectItem value="supplementary">supplementary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" {...register("date")} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setValue("status", v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="scheduled">scheduled</SelectItem>
                <SelectItem value="published">published</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="rounded border p-3 text-xs text-muted-foreground">
              To add subjects, save then use PATCH with {"{"} subjects: [{`{`} subject_id, max_marks, pass_marks {`}`} ] {"}"} — visible in detail view.
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || createMut.isPending || updateMut.isPending}>{isSubmitting ? "Saving..." : isEdit ? "Save" : "Create"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

