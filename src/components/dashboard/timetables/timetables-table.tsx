"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import type { TimetableRow } from "@/lib/api/timetables";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface TimetablesTableProps {
  data: TimetableRow[];
  isLoading?: boolean;
  pageInfo: { hasNext: boolean; hasPrev: boolean; nextCursor: string | null; prevCursors: string[] };
  onNext: () => void;
  onPrev: () => void;
  onEdit: (row: TimetableRow) => void;
  onDelete: (row: TimetableRow) => void;
}

export function TimetablesTable({ data, isLoading, pageInfo, onNext, onPrev, onEdit, onDelete }: TimetablesTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={!pageInfo.hasPrev} onClick={onPrev}><ChevronLeft className="size-4" /> Prev</Button>
        <Button variant="outline" size="sm" disabled={!pageInfo.hasNext} onClick={onNext}>Next <ChevronRight className="size-4" /></Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Course/Sem</TableHead>
              <TableHead>Day/Period</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead>Room</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No timetable entries.</TableCell></TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell className="text-xs">{row.course_name ?? row.course_id} / Sem {row.semester_no}</TableCell>
                  <TableCell><Badge variant="outline">{DAYS[row.day_of_week] ?? row.day_of_week} · P{row.period_no}</Badge></TableCell>
                  <TableCell className="text-xs">{row.subject_name ?? row.subject_id ?? "—"}</TableCell>
                  <TableCell className="text-xs">{row.teacher_name ?? (row.teacher_id ? `#${row.teacher_id}` : "—")}</TableCell>
                  <TableCell className="text-xs">{row.room_name ?? (row.room_id ? `#${row.room_id}` : "—")}</TableCell>
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
      <div className="text-xs text-muted-foreground">Cursor: {pageInfo.nextCursor ?? "—"} · {data.length} rows · list:timetables: 300s · conflict checks: teacher busy / room double-booked</div>
    </div>
  );
}
