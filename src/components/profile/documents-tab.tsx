"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStudentDocuments, useInvalidateProfileSection } from "@/hooks/use-profile-sections";

const DOCUMENT_TYPES = [
  "Transcript",
  "ID card",
  "Marksheet",
  "Certificate",
  "Other",
];

interface UploadFormProps {
  studentId: number;
  onUploaded: () => void;
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

async function openDocument(id: number) {
  const res = await fetch(`/api/documents/${id}/url`);
  if (!res.ok) return;
  const json = (await res.json()) as { url?: string };
  if (json.url) window.open(json.url, "_blank", "noopener,noreferrer");
}

function UploadForm({ studentId, onUploaded }: UploadFormProps) {
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !documentType || uploading) return;

    setUploading(true);
    setStatus(null);
    try {
      const body = new FormData();
      body.append("studentId", String(studentId));
      body.append("documentType", documentType);
      body.append("file", file);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setStatus(json?.error ?? "Upload failed. Try again.");
        return;
      }
      setStatus("Document uploaded.");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch {
      setStatus("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="text-sm font-medium">Upload a document</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Document type</Label>
              <Select
                value={documentType}
                onValueChange={(value) => setDocumentType(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>File</Label>
              <Input
                type="file"
                ref={fileRef}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={uploading || !file || !documentType}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
            {status && (
              <p className="text-sm text-muted-foreground">{status}</p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function DocumentsTab({ studentId }: { studentId: number }) {
  const { data, error, isLoading } = useStudentDocuments(studentId);
  const { invalidateDocuments } = useInvalidateProfileSection();

  return (
    <div className="flex flex-col gap-4">
      <UploadForm
        studentId={studentId}
        onUploaded={() => invalidateDocuments(studentId)}
      />
      {error ? (
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      ) : isLoading || data === undefined ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading documents">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No documents yet. Upload one to get started.
        </p>
      ) : (
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
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right">
                      <Button
                        variant="link"
                        className="px-0"
                        onClick={() => void openDocument(row.id)}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
