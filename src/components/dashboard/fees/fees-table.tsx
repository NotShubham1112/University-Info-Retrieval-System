"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import type { FeePaymentRow } from "@/lib/api/fees";

export interface FeesTableProps {
  data: FeePaymentRow[];
  isLoading?: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  pageInfo: { hasNext: boolean; hasPrev: boolean; nextCursor: string | null; prevCursors: string[] };
  onNext: () => void;
  onPrev: () => void;
  onEdit: (row: FeePaymentRow) => void;
  onDelete: (row: FeePaymentRow) => void;
  onReceipt: (row: FeePaymentRow) => void;
}

export function FeesTable({ data, isLoading, search, onSearchChange, pageInfo, onNext, onPrev, onEdit, onDelete, onReceipt }: FeesTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input placeholder="Search by transaction_id..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="max-w-sm" />
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
              <TableHead>Student</TableHead>
              <TableHead>Due / Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Txn</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No fee payments found.</TableCell></TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell className="text-sm">{row.student_name ?? row.student_id}</TableCell>
                  <TableCell className="text-xs">₹{Number(row.amount_due).toLocaleString()} / ₹{Number(row.amount_paid).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={row.status === "paid" ? "default" : row.status === "partial" ? "secondary" : "outline"}>{row.status}</Badge></TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-[120px]">{row.transaction_id ?? "—"}</TableCell>
                  <TableCell className="text-xs">{row.payment_date ?? "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onReceipt(row)}>Receipt</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(row)}>Edit</DropdownMenuItem>
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
      <div className="text-xs text-muted-foreground">Cursor: {pageInfo.nextCursor ?? "—"} · {data.length} rows · list:fees: 300s · pending via mv_fee_collection</div>
    </div>
  );
}
