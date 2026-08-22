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
import { useStudentAttendance } from "@/hooks/use-profile-sections";

export function AttendanceTab({ studentId }: { studentId: number }) {
  const { data, error, isLoading } = useStudentAttendance(studentId);

  if (error) {
    return <p className="text-sm text-muted-foreground">{(error as Error).message ?? "Couldn't load this section. Try again."}</p>;
  }
  if (isLoading || data === undefined) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading attendance">
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
                  ? Math.round((row.classes_attended / row.classes_conducted) * 100)
                  : null;
              return (
                <TableRow key={row.id}>
                  <TableCell>{row.classes_attended}</TableCell>
                  <TableCell>{row.classes_conducted}</TableCell>
                  <TableCell>{percentage != null ? `${percentage}%` : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
