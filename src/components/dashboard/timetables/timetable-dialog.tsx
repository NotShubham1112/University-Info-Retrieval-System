"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { timetableCreateSchema } from "@/lib/validation/schemas";
import { useCreateTimetable, useUpdateTimetable } from "@/hooks/use-timetables";
import { toast } from "@/components/ui/sonner";
import type { TimetableRow } from "@/lib/api/timetables";
import { z } from "zod";

type FormValues = z.infer<typeof timetableCreateSchema>;

export function TimetableDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing?: TimetableRow | null }) {
  const createMut = useCreateTimetable();
  const updateMut = useUpdateTimetable();
  const isEdit = !!editing;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(timetableCreateSchema) as never,
    defaultValues: editing ? { course_id: editing.course_id, semester_no: editing.semester_no, day_of_week: editing.day_of_week, period_no: editing.period_no, subject_id: editing.subject_id ?? 1, teacher_id: editing.teacher_id ?? 1, room_id: editing.room_id ?? undefined } as unknown as FormValues : { course_id: undefined as unknown as number, semester_no: 1, day_of_week: 1, period_no: 1, subject_id: 1, teacher_id: 1 } as unknown as FormValues,
  });

  React.useEffect(() => {
    if (editing) reset({ course_id: editing.course_id, semester_no: editing.semester_no, day_of_week: editing.day_of_week, period_no: editing.period_no, subject_id: editing.subject_id ?? 1, teacher_id: editing.teacher_id ?? 1, room_id: editing.room_id ?? undefined } as unknown as FormValues);
    else reset({ semester_no: 1, day_of_week: 1, period_no: 1 } as unknown as FormValues);
  }, [editing, reset]);

  const day = watch("day_of_week");
  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit && editing) {
        await updateMut.mutateAsync({ id: editing.id, payload: values as unknown as Record<string, unknown> });
        toast.success("Timetable updated");
      } else {
        await createMut.mutateAsync(values as unknown as Record<string, unknown>);
        toast.success("Timetable created");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit timetable" : "Create timetable entry"}</SheetTitle>
          <SheetDescription>Conflict checks: teacher busy + room double-booked + slot taken (course/sem/day/period unique).</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit as never)} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Course ID *</Label>
              <Input type="number" {...register("course_id", { valueAsNumber: true })} />
              {errors.course_id && <p className="text-xs text-destructive">{errors.course_id.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Semester No *</Label>
              <Input type="number" {...register("semester_no", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Day of Week (1-7)</Label>
              <Select value={String(day ?? 1)} onValueChange={(v) => setValue("day_of_week", Number(v) as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Mon (1)</SelectItem><SelectItem value="2">Tue (2)</SelectItem><SelectItem value="3">Wed (3)</SelectItem><SelectItem value="4">Thu (4)</SelectItem><SelectItem value="5">Fri (5)</SelectItem><SelectItem value="6">Sat (6)</SelectItem><SelectItem value="7">Sun (7)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Period No *</Label>
              <Input type="number" min={1} max={12} {...register("period_no", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Subject ID *</Label>
              <Input type="number" {...register("subject_id", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <Label>Teacher ID *</Label>
              <Input type="number" {...register("teacher_id", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Room ID (optional)</Label>
            <Input type="number" {...register("room_id", { valueAsNumber: true })} placeholder="optional" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || createMut.isPending || updateMut.isPending}>{isSubmitting ? "Saving..." : isEdit ? "Save" : "Create"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}


