"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import type { CourseRow } from "@/lib/api/courses";

export interface CoursesTableProps {
  data: CourseRow[];
  isLoading?: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  pageInfo: { hasNext: boolean; hasPrev: boolean; nextCursor: string | null; prevCursors: string[] };
  onNext: () => void;
  onPrev: () => void;
  onEdit: (row: CourseRow) => void;
  onDelete: (row: CourseRow) => void;
}

export function CoursesTable({ data, isLoading, search, onSearchChange, pageInfo, onNext, onPrev, onEdit, onDelete }: CoursesTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input placeholder="Search by course, type, description..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="max-w-sm" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!pageInfo.hasPrev} onClick={onPrev}><ChevronLeft className="size-4" /> Prev</Button>
          <Button variant="outline" size="sm" disabled={!pageInfo.hasNext} onClick={onNext}>Next <ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No courses found.</TableCell></TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.branch_or_course}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[280px]">{row.description ?? "—"}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{row.course_type ?? "—"}</Badge></TableCell>
                  <TableCell className="text-sm">{row.duration_years ? `${row.duration_years}y` : "—"}</TableCell>
                  <TableCell className="text-sm">{row.credits ?? "—"}</TableCell>
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
      <div className="text-xs text-muted-foreground">Page cursor: {pageInfo.nextCursor ?? "—"} · {data.length} rows · Cache list:courses: 300s · intake_plan editable inline via edit</div>
    </div>
  );
}
