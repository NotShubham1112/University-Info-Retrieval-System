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

export interface StudentFormStudent {
  id: number;
  pnr: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  program_id: number;
  university_id: number;
  campus_id: number;
  admission_date: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
}

export interface ProgramOption {
  id: number;
  name: string;
}

interface StudentFormProps {
  programs: ProgramOption[];
  initial?: StudentFormStudent | null;
  defaults?: { universityId: number; campusId: number };
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

export function StudentForm({
  programs,
  initial,
  defaults,
}: StudentFormProps) {
  const router = useRouter();
  const isEdit = initial != null;

  const [first_name, setFirstName] = useState(initial?.first_name ?? "");
  const [last_name, setLastName] = useState(initial?.last_name ?? "");
  const [pnr, setPnr] = useState(initial?.pnr ?? "");
  const [roll_number, setRollNumber] = useState(initial?.roll_number ?? "");
  const [programId, setProgramId] = useState(
    initial ? String(initial.program_id) : programs[0] ? String(programs[0].id) : "",
  );
  const [admission_date, setAdmissionDate] = useState(
    initial?.admission_date ?? "",
  );
  const [date_of_birth, setDateOfBirth] = useState(
    initial?.date_of_birth ?? "",
  );
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      first_name,
      last_name,
      program_id: Number(programId),
      admission_date,
      date_of_birth: date_of_birth || null,
      email: email || null,
      phone: phone || null,
    };

    let url: string;
    let method: string;
    if (isEdit && initial) {
      url = `/api/admin/students/${initial.id}`;
      method = "PATCH";
    } else {
      payload.pnr = pnr;
      payload.roll_number = roll_number;
      payload.university_id = defaults?.universityId;
      payload.campus_id = defaults?.campusId;
      url = "/api/admin/students";
      method = "POST";
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => null)) as {
      id?: number;
      error?: string;
    } | null;

    if (!res.ok) {
      setError(
        json?.error ??
          (isEdit
            ? "Couldn't save changes. Try again."
            : "Couldn't add the student. Try again."),
      );
      setSaving(false);
      return;
    }

    if (isEdit && initial) {
      router.push(`/admin/students/${initial.id}/edit`);
    } else if (json?.id) {
      router.push(`/students/${json.id}`);
    } else {
      router.push("/admin");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <Input
                value={first_name}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </Field>
            <Field label="Last name">
              <Input
                value={last_name}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </Field>
            <Field label="PNR">
              <Input
                value={pnr}
                onChange={(e) => setPnr(e.target.value)}
                disabled={isEdit}
                required
              />
            </Field>
            <Field label="Roll number">
              <Input
                value={roll_number}
                onChange={(e) => setRollNumber(e.target.value)}
                disabled={isEdit}
                required
              />
            </Field>
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
            <Field label="Admission date">
              <Input
                type="date"
                value={admission_date}
                onChange={(e) => setAdmissionDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Date of birth">
              <Input
                type="date"
                value={date_of_birth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>
      {isEdit && (
        <p className="text-sm text-muted-foreground">
          PNR and roll number can't be changed once set.
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add student"}
        </Button>
        {error && <p className="text-sm text-muted-foreground">{error}</p>}
      </div>
    </form>
  );
}
