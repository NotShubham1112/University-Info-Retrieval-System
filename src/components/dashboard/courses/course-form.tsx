"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseCreateSchema } from "@/lib/validation/schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type FormValues = {
  branch_or_course: string;
  course_type?: string | null;
  duration_years?: number | null;
  credits?: number | null;
  description?: string | null;
  department_id?: number | null;
};

export function CourseForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  onCancel,
}: {
  defaultValues?: Partial<FormValues> & { id?: number };
  onSubmit: (values: Record<string, unknown>) => void;
  isSubmitting?: boolean;
  onCancel?: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(courseCreateSchema as unknown as never),
    defaultValues: {
      branch_or_course: (defaultValues?.branch_or_course as string) ?? "",
      course_type: (defaultValues?.course_type as string) ?? "",
      duration_years: (defaultValues?.duration_years as number) ?? 4,
      credits: (defaultValues?.credits as number) ?? 160,
      description: (defaultValues?.description as string) ?? "",
      department_id: (defaultValues?.department_id as number) ?? undefined,
    } as FormValues,
  });

  const onValid = (vals: FormValues) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(vals)) {
      if (v === "" || v === undefined) continue;
      clean[k] = v;
    }
    onSubmit(clean);
  };

  return (
    <form onSubmit={form.handleSubmit(onValid)} className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-1"><Label>Course / Branch *</Label><Input {...form.register("branch_or_course")} placeholder="B.Tech Computer Engineering" />{form.formState.errors.branch_or_course ? <p className="text-xs text-destructive">{form.formState.errors.branch_or_course.message as string}</p> : null}</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Course type</Label><Input {...form.register("course_type")} placeholder="B.Tech" /></div>
          <div className="space-y-1"><Label>Department ID</Label><Input type="number" {...form.register("department_id", { valueAsNumber: true })} placeholder="1" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Duration (years)</Label><Input type="number" {...form.register("duration_years", { valueAsNumber: true })} /></div>
          <div className="space-y-1"><Label>Credits</Label><Input type="number" {...form.register("credits", { valueAsNumber: true })} /></div>
        </div>
        <div className="space-y-1"><Label>Description</Label><Textarea {...form.register("description")} rows={3} placeholder="Course overview..." /></div>
        <p className="text-xs text-muted-foreground">Intake plan (seats per stream/batch) is editable inline after creation via the edit dialog.</p>
      </div>
      <div className="flex justify-end gap-2 border-t pt-4">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" disabled={!!isSubmitting}>{isSubmitting ? "Saving..." : defaultValues?.id ? "Update" : "Create"}</Button>
      </div>
    </form>
  );
}
