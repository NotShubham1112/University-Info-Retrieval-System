"use client";

import { Badge } from "@/components/ui/badge";
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

interface SubjectRef {
  name: string | null;
  semester_no: number | null;
}

interface EnrollmentRef {
  subjects: SubjectRef | null;
}

interface AcademicRow {
  id: number;
  marks: number | null;
  grade: string | null;
  grade_point: number | null;
  result_status: string | null;
  enrollments: EnrollmentRef | null;
}

function resultLabel(status: string | null): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "fail":
      return "Fail";
    case "pending":
      return "Pending";
    default:
      return status ?? "—";
  }
}

export function AcademicTab({ studentId }: { studentId: number }) {
  const { data, error } = useSectionData<AcademicRow>(
    `/api/students/${studentId}/results`,
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
    return <p className="text-sm text-muted-foreground">No results yet.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semester</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Marks</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.enrollments?.subjects?.semester_no ?? "—"}
                </TableCell>
                <TableCell>{row.enrollments?.subjects?.name ?? "—"}</TableCell>
                <TableCell>{row.marks ?? "—"}</TableCell>
                <TableCell>
                  {row.grade ?? "—"}
                  {row.grade_point != null ? ` (${row.grade_point})` : ""}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.result_status === "fail" ? "outline" : "secondary"
                    }
                  >
                    {resultLabel(row.result_status)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}