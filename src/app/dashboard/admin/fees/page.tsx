"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeesTable } from "@/components/dashboard/fees/fees-table";
import { FeeDialog } from "@/components/dashboard/fees/fee-dialog";
import { ReceiptView } from "@/components/dashboard/fees/receipt-view";
import { DeleteConfirm } from "@/components/dashboard/fees/delete-confirm";
import { useFees, usePendingFees } from "@/hooks/use-fees";
import type { FeePaymentRow } from "@/lib/api/fees";
import { Plus } from "lucide-react";

export default function FeesAdminPage() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [prevCursors, setPrevCursors] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FeePaymentRow | null>(null);
  const [deleteRow, setDeleteRow] = React.useState<FeePaymentRow | null>(null);
  const [receiptRow, setReceiptRow] = React.useState<FeePaymentRow | null>(null);

  React.useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  React.useEffect(() => { setCursor(null); setPrevCursors([]); }, [debounced]);

  const { data, isLoading, isFetching, error } = useFees({ q: debounced, limit: 20, cursor });
  const { data: pending } = usePendingFees();

  const rows = (data?.data ?? []) as FeePaymentRow[];
  const nextCursor = data?.nextCursor ?? null;

  const onNext = () => { if (!nextCursor) return; setPrevCursors((prev) => [...prev, cursor ?? ""]); setCursor(nextCursor); };
  const onPrev = () => { setPrevCursors((prev) => { const copy = [...prev]; const pc = copy.pop() ?? null; setCursor(pc || null); return copy; }); };

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (row: FeePaymentRow) => { setEditing(row); setDialogOpen(true); };

  const pendingRows = (pending as { data?: unknown[] } | undefined)?.data as unknown[] | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Fees</h1>
          <p className="text-sm text-muted-foreground">fee_category_rates + fee_payments (scholarship link) · pending via mv_fee_collection · receipt derived.</p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> Record payment</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fee payments</CardTitle>
          <span className="text-xs text-muted-foreground">{isFetching ? "Refreshing..." : `${rows.length} rows`}</span>
        </CardHeader>
        <CardContent>
          {error ? <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{(error as Error).message}</div> : null}
          <FeesTable data={rows} isLoading={isLoading} search={search} onSearchChange={setSearch} pageInfo={{ hasNext: !!nextCursor, hasPrev: prevCursors.length > 0, nextCursor, prevCursors }} onNext={onNext} onPrev={onPrev} onEdit={openEdit} onDelete={(row) => setDeleteRow(row)} onReceipt={(row) => setReceiptRow(row)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Pending fees report (mv_fee_collection)</CardTitle></CardHeader>
        <CardContent>
          {pendingRows ? (
            <div className="space-y-2">
              <pre className="max-h-40 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(pendingRows.slice(0, 5), null, 2)}</pre>
              <p className="text-xs text-muted-foreground">{pendingRows.length} groups — source mv_fee_collection (refresh via RPC after payments).</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Loading pending report...</p>
          )}
        </CardContent>
      </Card>

      <FeeDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
      <DeleteConfirm open={!!deleteRow} onOpenChange={(v) => !v && setDeleteRow(null)} row={deleteRow} />
      <ReceiptView open={!!receiptRow} onOpenChange={(v) => !v && setReceiptRow(null)} row={receiptRow} />
    </div>
  );
}
