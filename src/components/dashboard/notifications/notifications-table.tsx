"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import type { NotificationRow } from "@/lib/api/notifications";

export interface NotificationsTableProps {
  data: NotificationRow[];
  isLoading?: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  pageInfo: { hasNext: boolean; hasPrev: boolean; nextCursor: string | null; prevCursors: string[] };
  onNext: () => void;
  onPrev: () => void;
  onView: (row: NotificationRow) => void;
  onDelete: (row: NotificationRow) => void;
  onMarkRead: (row: NotificationRow) => void;
}

export function NotificationsTable({ data, isLoading, search, onSearchChange, pageInfo, onNext, onPrev, onView, onDelete, onMarkRead }: NotificationsTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input placeholder="Search title, body..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="max-w-sm" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!pageInfo.hasPrev} onClick={onPrev}><ChevronLeft className="size-4" /> Prev</Button>
          <Button variant="outline" size="sm" disabled={!pageInfo.hasNext} onClick={onNext}>Next <ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No notifications.</TableCell></TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm truncate max-w-[220px]">{row.title}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[220px]">{row.body.slice(0, 60)}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{row.type}</Badge></TableCell>
                  <TableCell><Badge variant={row.priority === "high" || row.priority === "urgent" ? "default" : "secondary"}>{row.priority}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{row.channel === "in_app" ? "in-app" : row.channel}</Badge></TableCell>
                  <TableCell className="text-xs">{row.recipient_count ?? "—"} total · {row.unread_count ?? "—"} unread</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(row)}>View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMarkRead(row)}>Mark read</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(row)} className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-xs text-muted-foreground">Cursor: {pageInfo.nextCursor ?? "—"} · {data.length} rows · channel placeholder (email/sms log only, G8) · list:notifications: 60s</div>
    </div>
  );
}
