"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import type { TeacherRow } from "@/lib/api/teachers";

export interface TeachersTableProps {
  data: TeacherRow[];
  isLoading?: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  pageInfo: { hasNext: boolean; hasPrev: boolean; nextCursor: string | null; prevCursors: string[] };
  onNext: () => void;
  onPrev: () => void;
  onEdit: (row: TeacherRow) => void;
  onDelete: (row: TeacherRow) => void;
}

export function TeachersTable({ data, isLoading, search, onSearchChange, pageInfo, onNext, onPrev, onEdit, onDelete }: TeachersTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input placeholder="Search by name, email, employee ID..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="max-w-sm" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!pageInfo.hasPrev} onClick={onPrev}><ChevronLeft className="size-4" /> Prev</Button>
          <Button variant="outline" size="sm" disabled={!pageInfo.hasNext} onClick={onNext}>Next <ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No teachers found.</TableCell></TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">{row.designation ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-sm font-mono">{row.employee_id}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">{row.email}</TableCell>
                  <TableCell className="text-sm">{row.department_name ?? row.department_id ?? "—"}</TableCell>
                  <TableCell><Badge variant={row.status === "active" ? "default" : "secondary"}>{row.status}</Badge></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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
      <div className="text-xs text-muted-foreground">Page cursor: {pageInfo.nextCursor ?? "—"} · {data.length} rows · Salary never projected (cache list:teachers: 300s)</div>
    </div>
  );
}
