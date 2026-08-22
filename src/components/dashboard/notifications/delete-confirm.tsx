"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteNotification } from "@/hooks/use-notifications";
import { toast } from "@/components/ui/sonner";
import type { NotificationRow } from "@/lib/api/notifications";

export function DeleteConfirm({ open, onOpenChange, row }: { open: boolean; onOpenChange: (v: boolean) => void; row: NotificationRow | null }) {
  const mut = useDeleteNotification();
  const handle = async () => {
    if (!row) return;
    try { await mut.mutateAsync(row.id); toast.success("Deleted"); onOpenChange(false); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete notification {row?.id}?</DialogTitle><DialogDescription>{row?.title}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="destructive" onClick={handle} disabled={mut.isPending}>{mut.isPending ? "Deleting..." : "Delete"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
