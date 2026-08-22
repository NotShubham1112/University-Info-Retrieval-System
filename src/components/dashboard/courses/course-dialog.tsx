"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CourseForm } from "./course-form";
import { useCreateCourse, useUpdateCourse } from "@/hooks/use-courses";
import { toast } from "@/components/ui/sonner";
import type { CourseRow } from "@/lib/api/courses";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CourseDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing?: CourseRow | null }) {
  const createMut = useCreateCourse();
  const updateMut = useUpdateCourse();
  const isEdit = !!editing;
  const [intake, setIntake] = React.useState<{ batch_year: string; intake_stream: string; total_seats: string }>({ batch_year: String(new Date().getFullYear()), intake_stream: "CAP", total_seats: "60" });

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      const payload: Record<string, unknown> = { ...values };
      // If editing and intake fields have values, attach inline intake_plan
      if (isEdit) {
        const by = Number(intake.batch_year);
        const ts = Number(intake.total_seats);
        if (!Number.isNaN(by) && !Number.isNaN(ts) && intake.intake_stream.trim()) {
          payload["intake_plan"] = { batch_year: by, intake_stream: intake.intake_stream.trim(), total_seats: ts };
        }
      }
      if (isEdit && editing) {
        await updateMut.mutateAsync({ id: editing.id, payload });
        toast.success("Course updated");
      } else {
        await createMut.mutateAsync(values);
        toast.success("Course created");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit course" : "Add course"}</SheetTitle>
          <SheetDescription>{isEdit ? "Update course and optionally upsert intake_plan for this edit." : "Create a new course. Intake plan can be added after creation."}</SheetDescription>
        </SheetHeader>
        <div className="p-4 space-y-6">
          <CourseForm defaultValues={editing ? (editing as unknown as Record<string, unknown>) : undefined} onSubmit={handleSubmit} isSubmitting={createMut.isPending || updateMut.isPending} onCancel={() => onOpenChange(false)} />
          {isEdit ? (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="text-sm font-semibold">Intake plan (inline, optional)</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Batch year</Label><Input value={intake.batch_year} onChange={(e) => setIntake((s) => ({ ...s, batch_year: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Stream</Label><Input value={intake.intake_stream} onChange={(e) => setIntake((s) => ({ ...s, intake_stream: e.target.value }))} placeholder="CAP" /></div>
                <div className="space-y-1"><Label>Total seats</Label><Input value={intake.total_seats} onChange={(e) => setIntake((s) => ({ ...s, total_seats: e.target.value }))} /></div>
              </div>
              <p className="text-xs text-muted-foreground">Will upsert intake_plan(course_id, batch_year, intake_stream) on save.</p>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
