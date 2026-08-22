"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteExam } from "@/hooks/use-exams";
import { toast } from "@/components/ui/sonner";
import type { ExamRow } from "@/lib/api/exams";

export function DeleteConfirm({ open, onOpenChange, row }: { open: boolean; onOpenChange: (v: boolean) => void; row: ExamRow | null }) {
  const mut = useDeleteExam();
  const handle = async () => {
    if (!row) return;
    try {
      await mut.mutateAsync(row.id);
      toast.success("Exam deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete exam {row?.id}?</DialogTitle>
          <DialogDescription>Published exams cannot be deleted. Draft/scheduled will be removed.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handle} disabled={mut.isPending}>{mut.isPending ? "Deleting..." : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
