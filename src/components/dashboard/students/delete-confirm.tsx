"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteStudent } from "@/hooks/use-students";
import { toast } from "@/components/ui/sonner";
import type { StudentRow } from "@/lib/api/students";

export function DeleteConfirm({
  open,
  onOpenChange,
  row,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: StudentRow | null;
}) {
  const del = useDeleteStudent();
  const onConfirm = async () => {
    if (!row) return;
    try {
      await del.mutateAsync(row.id);
      toast.success("Student set to inactive (soft delete)");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete student?</DialogTitle>
          <DialogDescription>
            This will soft-delete <strong>{row ? `${row.first_name} ${row.last_name}` : ""}</strong> (status → inactive). Hard delete is only for super_admin. This action can be undone by setting status back to active.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={del.isPending}>
            {del.isPending ? "Deleting..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
