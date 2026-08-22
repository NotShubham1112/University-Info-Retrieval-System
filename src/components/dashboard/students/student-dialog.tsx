"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { StudentForm } from "./student-form";
import { useCreateStudent, useUpdateStudent } from "@/hooks/use-students";
import { toast } from "@/components/ui/sonner";
import type { StudentRow } from "@/lib/api/students";
import { useAutosave } from "@/hooks/use-autosave";

export function StudentDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: StudentRow | null;
}) {
  const createMut = useCreateStudent();
  const updateMut = useUpdateStudent();
  const isEdit = !!editing;
  const autosaveKey = isEdit ? `student:edit:${editing?.id}` : "student:create";

  // Clear autosave on success handled via form's clearDraft; we also clear here
  // keep autosave hook mounted with disabled to allow future restores
  useAutosave({ key: autosaveKey, value: {}, enabled: false });

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      if (isEdit && editing) {
        await updateMut.mutateAsync({ id: editing.id, payload: values });
        toast.success("Student updated");
      } else {
        await createMut.mutateAsync(values);
        toast.success("Student created");
      }
      // draft is cleared by form; also clear autosave entry
      try { window.localStorage.removeItem(`autosave:${autosaveKey}`); } catch {}
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit student" : "Add student"}</SheetTitle>
          <SheetDescription>{isEdit ? "Update student details. Aadhaar is masked and encrypted." : "Create a new student. Fields marked * are required."}</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <StudentForm
            defaultValues={editing ? (editing as unknown as Record<string, unknown>) : undefined}
            autosaveKey={autosaveKey}
            onSubmit={handleSubmit}
            isSubmitting={createMut.isPending || updateMut.isPending}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
