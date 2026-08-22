"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteFeePayment } from "@/hooks/use-fees";
import { toast } from "@/components/ui/sonner";
import type { FeePaymentRow } from "@/lib/api/fees";

export function DeleteConfirm({ open, onOpenChange, row }: { open: boolean; onOpenChange: (v: boolean) => void; row: FeePaymentRow | null }) {
  const mut = useDeleteFeePayment();
  const handle = async () => {
    if (!row) return;
    try { await mut.mutateAsync(row.id); toast.success("Deleted"); onOpenChange(false); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete fee payment {row?.id}?</DialogTitle><DialogDescription>This will remove the payment row. Receipt derived will disappear.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="destructive" onClick={handle} disabled={mut.isPending}>{mut.isPending ? "Deleting..." : "Delete"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
