/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import type { StudentRow } from "@/lib/api/students";

export function DocumentUpload({
  open,
  onOpenChange,
  student,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: StudentRow | null;
}) {
  const [type, setType] = React.useState("aadhaar");
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [docs, setDocs] = React.useState<Array<Record<string, unknown>>>([]);

  const fetchDocs = React.useCallback(async () => {
    if (!student) return;
    try {
      const res = await fetch(`/api/dashboard/students/${student.id}/documents`);
      const body = await res.json();
      if (res.ok) setDocs((body.data ?? body?.data ?? []) as Array<Record<string, unknown>>);
      else if (body?.data) setDocs(body.data);
    } catch {}
  }, [student]);

  React.useEffect(() => {
    if (open) {
      void fetchDocs();
    }
  }, [open, fetchDocs]);

  const onUpload = async () => {
    if (!student) return;
    if (!file) { toast.error("Select a file"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("document_type", type);
      fd.set("file", file);
      const res = await fetch(`/api/dashboard/students/${student.id}/documents`, { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Upload failed");
      toast.success("Document uploaded (pending verification)");
      setFile(null);
      fetchDocs();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Documents — {student ? `${student.first_name} ${student.last_name}` : ""}</DialogTitle>
          <DialogDescription>Upload files (Storage) and verify (docs:verify permission for verification). All uploads start as pending.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Document type</Label>
              <Select value={type} onValueChange={(v) => setType((v as string) ?? "other")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aadhaar">aadhaar</SelectItem>
                  <SelectItem value="marksheet">marksheet</SelectItem>
                  <SelectItem value="certificate">certificate</SelectItem>
                  <SelectItem value="other">other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>File</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <Button onClick={onUpload} disabled={uploading || !file}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>

          <div className="space-y-2">
            <div className="text-sm font-medium">Existing documents</div>
            {docs.length === 0 ? <p className="text-sm text-muted-foreground">No documents.</p> : (
              <div className="max-h-[200px] overflow-y-auto rounded border">
                {docs.map((d) => (
                  <div key={String(d["id"])} className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0">
                    <span className="truncate">{String(d["file_name"])} — {String(d["document_type"])}</span>
                    <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">{String(d["verified_status"] ?? d["status"] ?? "pending")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
