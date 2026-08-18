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

interface DocumentRow {
  id: number;
  document_type: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string | null;
  version: number | null;
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN");
}

export function DocumentsTab({ studentId }: { studentId: number }) {
  const { data, error } = useSectionData<DocumentRow>(
    `/api/students/${studentId}/documents`,
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
    return <p className="text-sm text-muted-foreground">No documents yet.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.document_type ?? "—"}</TableCell>
                <TableCell>{row.file_name ?? "—"}</TableCell>
                <TableCell>{formatBytes(row.file_size)}</TableCell>
                <TableCell>{formatDate(row.uploaded_at)}</TableCell>
                <TableCell>{row.version ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}