"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useFeeReceipt } from "@/hooks/use-fees";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeePaymentRow } from "@/lib/api/fees";

export function ReceiptView({ open, onOpenChange, row }: { open: boolean; onOpenChange: (v: boolean) => void; row: FeePaymentRow | null }) {
  const { data, isLoading, error } = useFeeReceipt(row ? { fee_payment_id: row.id } : null);
  const receipt = (data as { receipt?: Record<string, unknown> } | undefined)?.receipt as Record<string, unknown> | undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receipt — Fee Payment {row?.id ?? ""}</DialogTitle>
          <DialogDescription>Derived from fee_payments row · receipt_no + balance_due computed.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : receipt ? (
          <div className="space-y-3 text-sm">
            <div className="rounded border p-3 bg-card space-y-1 font-mono text-xs">
              <div><span className="text-muted-foreground">Receipt No:</span> {String(receipt["receipt_no"] ?? "—")}</div>
              <div><span className="text-muted-foreground">Transaction:</span> {String(receipt["transaction_id"] ?? "—")}</div>
              <div><span className="text-muted-foreground">Student:</span> {String(receipt["student_name"] ?? receipt["student_id"] ?? "—")} ({String(receipt["student_id"] ?? "")})</div>
              <div><span className="text-muted-foreground">Due / Paid / Balance:</span> ₹{Number(receipt["amount_due"] ?? 0).toLocaleString()} / ₹{Number(receipt["amount_paid"] ?? 0).toLocaleString()} / ₹{Number(receipt["balance_due"] ?? 0).toLocaleString()}</div>
              <div><span className="text-muted-foreground">Status:</span> {String(receipt["status"] ?? "")} · {String(receipt["fee_type"] ?? "—")} {receipt["academic_year"] ? `(${String(receipt["academic_year"])})` : ""}</div>
              <div><span className="text-muted-foreground">Date:</span> {String(receipt["payment_date"] ?? receipt["created_at"] ?? "—")}</div>
            </div>
            <p className="text-xs text-muted-foreground">Receipt is derived (no separate table). Print/save as PDF from browser.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No receipt found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
