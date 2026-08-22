"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useImportStudents } from "@/hooks/use-students";
import { useAutosave } from "@/hooks/use-autosave";

const TEMPLATE_HEADERS =
  "first_name,last_name,email,phone,date_of_birth,gender,abc_id,aadhaar_number,address,city,state,country,blood_group,guardian_name,guardian_contact_number,category_id,program_id,campus_id,status,course_id,admission_mode,seat_type,intake_stream,expected_grad_year,roll_number";

const TEMPLATE_ROW =
  "Rahul,Sharma,rahul.sharma@example.com,+919000000001,2002-05-10,male,ABC20240001,123456789012,123 Main St,Demo City,Demo State,India,O+,Guardian Name,+919000000002,1,1,1,active,1,merit,general_open,general,2028,RN20240001";

export function CsvImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [csvText, setCsvText] = React.useState("");
  const [results, setResults] = React.useState<{ inserted: number; failed: Array<{ row: number; error: string }> } | null>(null);
  const autosaveKey = "student:import";
  const { showBanner, restore, clearDraft, dismissBanner } = useAutosave<string>({
    key: autosaveKey,
    value: csvText,
    delay: 800,
    enabled: open,
  });

  const mut = useImportStudents();

  const onFile = async (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    const text = await f.text();
    setCsvText(text);
  };

  const onDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_HEADERS + "\n" + TEMPLATE_ROW + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async () => {
    if (!csvText.trim()) { toast.error("CSV is empty"); return; }
    try {
      const res = await mut.mutateAsync({ csvText });
      setResults(res);
      toast.success(`Imported ${res.inserted}, failed ${res.failed.length}`);
      try { window.localStorage.removeItem(`autosave:${autosaveKey}`); } catch {}
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const draftBanner = showBanner ? (
    <div className="flex items-center justify-between rounded-lg border bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950">
      <span>Previous import draft found.</span>
      <span className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { const d = restore(); if (d) setCsvText(d); dismissBanner(); }}>Restore</Button>
        <Button size="sm" variant="ghost" onClick={() => { clearDraft(); dismissBanner(); }}>Dismiss</Button>
      </span>
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>CSV Import — Students (BATCH 100)</DialogTitle>
          <DialogDescription>Upload CSV with headers. Invalid rows are skipped with per-row errors; valid rows are inserted in batches of 100.</DialogDescription>
        </DialogHeader>

        {draftBanner}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onDownloadTemplate}>Download template</Button>
          <span className="text-xs text-muted-foreground self-center">Headers: {TEMPLATE_HEADERS.split(",").slice(0,4).join(", ")} ...</span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>CSV file</Label>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            {fileName ? <p className="text-xs text-muted-foreground">{fileName} — {csvText.split("\n").length - 1} data rows</p> : null}
          </div>
          <div className="space-y-1">
            <Label>Or paste CSV text</Label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={TEMPLATE_HEADERS + "\n..."}
              rows={8}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        {results ? (
          <div className="rounded-lg border p-3 text-sm">
            <div className="font-medium">Result: {results.inserted} inserted, {results.failed.length} failed</div>
            {results.failed.length > 0 ? (
              <div className="mt-2 max-h-[160px] overflow-y-auto rounded bg-muted p-2 text-xs">
                {results.failed.map((f) => (
                  <div key={f.row} className="border-b py-1 last:border-0">Row {f.row}: {f.error}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={onImport} disabled={mut.isPending || !csvText.trim()}>
            {mut.isPending ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
