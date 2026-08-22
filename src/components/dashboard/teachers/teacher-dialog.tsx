"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TeacherForm } from "./teacher-form";
import { useCreateTeacher, useUpdateTeacher } from "@/hooks/use-teachers";
import { toast } from "@/components/ui/sonner";
import type { TeacherRow } from "@/lib/api/teachers";

export function TeacherDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing?: TeacherRow | null }) {
  const createMut = useCreateTeacher();
  const updateMut = useUpdateTeacher();
  const isEdit = !!editing;

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      if (isEdit && editing) {
        await updateMut.mutateAsync({ id: editing.id, payload: values });
        toast.success("Teacher updated");
      } else {
        await createMut.mutateAsync(values);
        toast.success("Teacher created");
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
          <SheetTitle>{isEdit ? "Edit teacher" : "Add teacher"}</SheetTitle>
          <SheetDescription>{isEdit ? "Update teacher details. Email unique check enforced." : "Create a new teacher. Salary excluded by default."}</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <TeacherForm defaultValues={editing ? (editing as unknown as Record<string, unknown>) : undefined} onSubmit={handleSubmit} isSubmitting={createMut.isPending || updateMut.isPending} onCancel={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
