"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSectionData } from "@/components/profile/use-section-data";

interface AttendanceRow {
  id: number;
  classes_conducted: number;
  classes_attended: number;
}

export function AttendanceTab({ studentId }: { studentId: number }) {
  const { data, error } = useSectionData<AttendanceRow>(
    `/api/students/${studentId}/attendance`,
  );

  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }
  if (data === null) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No attendance yet.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Attended</TableHead>
              <TableHead>Conducted</TableHead>
              <TableHead>Percentage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const percentage =
                row.classes_conducted > 0
                  ? Math.round(
                      (row.classes_attended / row.classes_conducted) * 100,
                    )
                  : null;
              return (
                <TableRow key={row.id}>
                  <TableCell>{row.classes_attended}</TableCell>
                  <TableCell>{row.classes_conducted}</TableCell>
                  <TableCell>
                    {percentage != null ? `${percentage}%` : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}