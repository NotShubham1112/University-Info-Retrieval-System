"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import type { StudentRow } from "@/lib/api/students";

export interface StudentsTableProps {
  data: StudentRow[];
  isLoading?: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  pageInfo: { hasNext: boolean; hasPrev: boolean; nextCursor: string | null; prevCursors: string[] };
  onNext: () => void;
  onPrev: () => void;
  onEdit: (row: StudentRow) => void;
  onDelete: (row: StudentRow) => void;
  onUploadDocs: (row: StudentRow) => void;
  onView?: (row: StudentRow) => void;
}

export function StudentsTable({
  data,
  isLoading,
  search,
  onSearchChange,
  pageInfo,
  onNext,
  onPrev,
  onEdit,
  onDelete,
  onUploadDocs,
  onView,
}: StudentsTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search by name, PNR, roll number..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!pageInfo.hasPrev} onClick={onPrev}>
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <Button variant="outline" size="sm" disabled={!pageInfo.hasNext} onClick={onNext}>
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>PNR / Roll</TableHead>
              <TableHead>Email</TableHead>
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
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No students found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.first_name} {row.last_name}</div>
                    <div className="text-xs text-muted-foreground">#{row.id} · {row.course_id ? `Course ${row.course_id}` : row.program_id ? `Program ${row.program_id}` : ""}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{row.pnr ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.roll_number ?? row.admission_id ?? "—"}</div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">{row.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "active" ? "default" : row.status === "inactive" ? "secondary" : "outline"}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onView ? <DropdownMenuItem onClick={() => onView(row)}>View</DropdownMenuItem> : null}
                        <DropdownMenuItem onClick={() => onEdit(row)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onUploadDocs(row)}>Documents</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(row)} className="text-destructive focus:text-destructive">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-xs text-muted-foreground">
        Page cursor: {pageInfo.nextCursor ?? "—"} · {data.length} rows
      </div>
    </div>
  );
}
