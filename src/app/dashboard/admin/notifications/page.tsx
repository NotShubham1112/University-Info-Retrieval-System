"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationsTable } from "@/components/dashboard/notifications/notifications-table";
import { NotificationDialog } from "@/components/dashboard/notifications/notification-dialog";
import { DeleteConfirm } from "@/components/dashboard/notifications/delete-confirm";
import { useNotifications, useMarkRead } from "@/hooks/use-notifications";
import type { NotificationRow } from "@/lib/api/notifications";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function NotificationsAdminPage() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [prevCursors, setPrevCursors] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteRow, setDeleteRow] = React.useState<NotificationRow | null>(null);
  const [viewRow, setViewRow] = React.useState<NotificationRow | null>(null);
  const markMut = useMarkRead();

  React.useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  React.useEffect(() => { setCursor(null); setPrevCursors([]); }, [debounced]);

  const { data, isLoading, isFetching, error } = useNotifications({ q: debounced, limit: 20, cursor });

  const rows = (data?.data ?? []) as NotificationRow[];
  const nextCursor = data?.nextCursor ?? null;

  const onNext = () => { if (!nextCursor) return; setPrevCursors((prev) => [...prev, cursor ?? ""]); setCursor(nextCursor); };
  const onPrev = () => { setPrevCursors((prev) => { const copy = [...prev]; const pc = copy.pop() ?? null; setCursor(pc || null); return copy; }); };

  const handleMarkRead = async (row: NotificationRow) => {
    try { await markMut.mutateAsync({ notification_id: row.id }); toast.success(`Marked notification ${row.id} as read`); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">notification:send gate · POST with channel (in-app/email/sms placeholder) · recipients by role or student_ids · mark-read mutation.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="size-4" /> Send notification</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Notifications</CardTitle>
          <span className="text-xs text-muted-foreground">{isFetching ? "Refreshing..." : `${rows.length} rows`}</span>
        </CardHeader>
        <CardContent>
          {error ? <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{(error as Error).message}</div> : null}
          <NotificationsTable
            data={rows}
            isLoading={isLoading}
            search={search}
            onSearchChange={setSearch}
            pageInfo={{ hasNext: !!nextCursor, hasPrev: prevCursors.length > 0, nextCursor, prevCursors }}
            onNext={onNext}
            onPrev={onPrev}
            onView={(row) => setViewRow(row)}
            onDelete={(row) => setDeleteRow(row)}
            onMarkRead={handleMarkRead}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">In-app delivery</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>Recipients GET their unread via <code>/api/dashboard/notifications?student_id=...&status=unread</code>. Use <code>POST /api/dashboard/notifications/recipients {"{"} notification_id, ids, mark_all {"}"}</code> to mark read.</p>
          <p>Email/SMS are placeholders only — channel stored on row, sent_at set without SMTP/SMS call (G8).</p>
        </CardContent>
      </Card>

      <NotificationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <DeleteConfirm open={!!deleteRow} onOpenChange={(v) => !v && setDeleteRow(null)} row={deleteRow} />
      <Dialog open={!!viewRow} onOpenChange={(v) => !v && setViewRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewRow?.title}</DialogTitle>
            <DialogDescription>Type {viewRow?.type} · Priority {viewRow?.priority} · Channel {viewRow?.channel}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm whitespace-pre-wrap">{viewRow?.body}</p>
            <div className="text-xs text-muted-foreground">Sent at: {viewRow?.sent_at ?? "—"} · Recipients: {String(viewRow?.recipient_count ?? "—")} total, {String(viewRow?.unread_count ?? "—")} unread</div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => viewRow && handleMarkRead(viewRow)} disabled={markMut.isPending}>Mark read</Button>
              <Button variant="outline" onClick={() => setViewRow(null)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
