"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteCourse } from "@/hooks/use-courses";
import { toast } from "@/components/ui/sonner";
import type { CourseRow } from "@/lib/api/courses";

export function DeleteConfirm({ open, onOpenChange, row }: { open: boolean; onOpenChange: (v: boolean) => void; row: CourseRow | null }) {
  const del = useDeleteCourse();
  const handleDelete = async () => {
    if (!row) return;
    try {
      await del.mutateAsync(row.id);
      toast.success("Course deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete course?</DialogTitle>
          <DialogDescription>Delete {row?.branch_or_course} (ID {row?.id})? Intake plans for this course will also be removed (cascade).</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={del.isPending}>{del.isPending ? "Deleting..." : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
