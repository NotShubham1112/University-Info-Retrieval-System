"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteTeacher } from "@/hooks/use-teachers";
import { toast } from "@/components/ui/sonner";
import type { TeacherRow } from "@/lib/api/teachers";

export function DeleteConfirm({ open, onOpenChange, row }: { open: boolean; onOpenChange: (v: boolean) => void; row: TeacherRow | null }) {
  const del = useDeleteTeacher();
  const handleDelete = async () => {
    if (!row) return;
    try {
      await del.mutateAsync(row.id);
      toast.success("Teacher deactivated");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate teacher?</DialogTitle>
          <DialogDescription>Teacher {row?.name} ({row?.employee_id}) will be set to inactive (soft-delete). Salary never shown.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={del.isPending}>{del.isPending ? "Deactivating..." : "Deactivate"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
