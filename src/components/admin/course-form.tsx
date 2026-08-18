"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export interface ProgramOption {
  id: number;
  name: string;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function CourseForm({ programs }: { programs: ProgramOption[] }) {
  const router = useRouter();
  const [programId, setProgramId] = useState(
    programs[0] ? String(programs[0].id) : "",
  );
  const [semesterNo, setSemesterNo] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        program_id: Number(programId),
        semester_no: Number(semesterNo),
        code,
        name,
      }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(json?.error ?? "Couldn't add the course. Try again.");
      setSaving(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Program">
              <Select
                value={programId}
                onValueChange={(value) => setProgramId(value ?? "")}
                items={programs.map((program) => ({
                  value: String(program.id),
                  label: program.name,
                }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={String(program.id)}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Semester number">
              <Input
                type="number"
                min={1}
                value={semesterNo}
                onChange={(e) => setSemesterNo(e.target.value)}
                required
              />
            </Field>
            <Field label="Code">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </Field>
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Add course"}
        </Button>
        {error && <p className="text-sm text-muted-foreground">{error}</p>}
      </div>
    </form>
  );
}
