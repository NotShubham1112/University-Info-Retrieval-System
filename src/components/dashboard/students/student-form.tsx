"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { studentCreateSchema } from "@/lib/validation/schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAutosave } from "@/hooks/use-autosave";
// StudentRow used via FormValues typing; keep import for future use
// import type { StudentRow } from "@/lib/api/students";

type FormValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  abc_id?: string | null;
  aadhaar_number?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  blood_group?: string | null;
  guardian_name?: string | null;
  guardian_contact_number?: string | null;
  category_id?: number | null;
  program_id?: number | null;
  campus_id?: number | null;
  status?: string;
  admission?: {
    course_id?: number | null;
    academic_year_id?: number | null;
    admission_mode?: string | null;
    seat_type?: string | null;
    intake_stream?: string | null;
    expected_grad_year?: number | null;
    roll_number?: string | null;
  } | null;
};

function maskAadhaar(v: string): string {
  if (!v) return "";
  const digits = v.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
  return `${digits.slice(0, 4)} **** ${digits.slice(-4)}`;
}

export function StudentForm({
  defaultValues,
  autosaveKey,
  onSubmit,
  isSubmitting,
  onCancel,
}: {
  defaultValues?: Partial<FormValues> & { id?: number };
  autosaveKey: string;
  onSubmit: (values: FormValues) => void;
  isSubmitting?: boolean;
  onCancel?: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(studentCreateSchema as unknown as never),
    defaultValues: {
      first_name: (defaultValues?.first_name as string) ?? "",
      last_name: (defaultValues?.last_name as string) ?? "",
      email: (defaultValues?.email as string) ?? "",
      phone: (defaultValues?.phone as string) ?? "",
      date_of_birth: (defaultValues?.date_of_birth as string) ?? "",
      gender: (defaultValues?.gender as string) ?? undefined,
      abc_id: (defaultValues?.abc_id as string) ?? "",
      aadhaar_number: (defaultValues?.aadhaar_number as string) ?? "",
      address: (defaultValues?.address as string) ?? "",
      city: (defaultValues?.city as string) ?? "",
      state: (defaultValues?.state as string) ?? "",
      country: (defaultValues?.country as string) ?? "India",
      blood_group: (defaultValues?.blood_group as string) ?? undefined,
      guardian_name: (defaultValues?.guardian_name as string) ?? "",
      guardian_contact_number: (defaultValues?.guardian_contact_number as string) ?? "",
      category_id: (defaultValues?.category_id as number) ?? undefined,
      program_id: (defaultValues?.program_id as number) ?? undefined,
      campus_id: (defaultValues?.campus_id as number) ?? undefined,
      status: (defaultValues?.status as string) ?? "active",
      admission: (defaultValues?.admission as FormValues["admission"]) ?? undefined,
    } as FormValues,
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const values = form.watch();
  const { showBanner, draft, clearDraft, dismissBanner, restore } = useAutosave<FormValues>({
    key: autosaveKey,
    value: values as FormValues,
    delay: 800,
    enabled: true,
  });

  const [aadhaarDisplay, setAadhaarDisplay] = React.useState(() => {
    const raw = String((defaultValues?.aadhaar_number as string) ?? "");
    return raw ? maskAadhaar(raw) : "";
  });

  const handleRestore = () => {
    const d = restore();
    if (d) {
      // reset form to draft
      Object.entries(d).forEach(([k, v]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setValue(k as any, v as never);
      });
      dismissBanner();
    }
  };

  const onValid = (vals: FormValues) => {
    // Unmask aadhaar before submit: if display is masked, use raw digits if available
    const rawAadhaar = vals.aadhaar_number?.replace(/\D/g, "") ?? "";
    const toSend: FormValues = {
      ...vals,
      aadhaar_number: rawAadhaar.length === 12 ? rawAadhaar : (vals.aadhaar_number || null) as string | null,
    };
    // Remove empty strings -> undefined for zod optional
    const clean = (obj: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(obj)) {
        if (v === "") (obj as Record<string, unknown>)[k] = undefined;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) clean(v as Record<string, unknown>);
      }
    };
    clean(toSend as unknown as Record<string, unknown>);
    onSubmit(toSend);
    // Clear draft on successful submit handled by caller
  };

  return (
    <form onSubmit={form.handleSubmit(onValid)} className="space-y-6">
      {showBanner && draft ? (
        <div className="flex items-center justify-between rounded-lg border bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950">
          <span>Draft found — resume previous edits?</span>
          <span className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleRestore}>
              Restore
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { clearDraft(); dismissBanner(); }}>
              Dismiss
            </Button>
          </span>
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="text-sm font-semibold">Personal</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>First name *</Label>
            <Input {...form.register("first_name")} placeholder="Rahul" />
            {form.formState.errors.first_name ? <p className="text-xs text-destructive">{form.formState.errors.first_name.message as string}</p> : null}
          </div>
          <div className="space-y-1">
            <Label>Last name *</Label>
            <Input {...form.register("last_name")} placeholder="Sharma" />
            {form.formState.errors.last_name ? <p className="text-xs text-destructive">{form.formState.errors.last_name.message as string}</p> : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Email *</Label>
            <Input {...form.register("email")} placeholder="rahul@example.com" />
            {form.formState.errors.email ? <p className="text-xs text-destructive">{form.formState.errors.email.message as string}</p> : null}
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input {...form.register("phone")} placeholder="+919000000000" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Date of birth</Label>
            <Input type="date" {...form.register("date_of_birth")} />
          </div>
          <div className="space-y-1">
            <Label>Gender</Label>
            <Select
              value={form.watch("gender") ?? ""}
              onValueChange={(v) => form.setValue("gender", v as never)}
            >
              <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">male</SelectItem>
                <SelectItem value="female">female</SelectItem>
                <SelectItem value="other">other</SelectItem>
                <SelectItem value="prefer_not_to_say">prefer_not_to_say</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Aadhaar (12 digits, never echoed back after save)</Label>
          <Input
            value={aadhaarDisplay}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "").slice(0, 12);
              setAadhaarDisplay(raw.length >= 4 ? maskAadhaar(raw) : raw);
              form.setValue("aadhaar_number", raw as never, { shouldDirty: true });
            }}
            placeholder="XXXX XXXX XXXX"
            inputMode="numeric"
            autoComplete="off"
          />
          {form.formState.errors.aadhaar_number ? <p className="text-xs text-destructive">{form.formState.errors.aadhaar_number.message as string}</p> : null}
          <p className="text-xs text-muted-foreground">Stored encrypted at rest; masked in UI.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>ABC ID</Label>
            <Input {...form.register("abc_id")} placeholder="ABC..." />
          </div>
          <div className="space-y-1">
            <Label>Blood group</Label>
            <Select value={form.watch("blood_group") ?? ""} onValueChange={(v) => form.setValue("blood_group", v as never)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Address</Label>
          <Textarea {...form.register("address")} placeholder="Street, area" rows={2} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1"><Label>City</Label><Input {...form.register("city")} /></div>
          <div className="space-y-1"><Label>State</Label><Input {...form.register("state")} /></div>
          <div className="space-y-1"><Label>Country</Label><Input {...form.register("country")} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Guardian name</Label><Input {...form.register("guardian_name")} /></div>
          <div className="space-y-1"><Label>Guardian phone</Label><Input {...form.register("guardian_contact_number")} /></div>
        </div>
      </div>

      <div className="grid gap-4 border-t pt-4">
        <div className="text-sm font-semibold">Admission</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Course ID</Label><Input type="number" {...form.register("admission.course_id", { valueAsNumber: true })} placeholder="1" /></div>
          <div className="space-y-1"><Label>Roll number</Label><Input {...form.register("admission.roll_number")} placeholder="RN..." /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Admission mode</Label>
            <Select value={((form.watch as unknown as (n: string) => unknown)("admission.admission_mode") as string) ?? ""} onValueChange={(v) => form.setValue("admission.admission_mode" as never, v as never)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {["merit", "management", "spot", "tfws", "ews"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Seat type</Label>
            <Select value={((form.watch as unknown as (n: string) => unknown)("admission.seat_type") as string) ?? ""} onValueChange={(v) => form.setValue("admission.seat_type" as never, v as never)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {["general_open", "tfws", "ews", "reserved"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Expected grad year</Label><Input type="number" {...form.register("admission.expected_grad_year", { valueAsNumber: true })} placeholder="2028" /></div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.watch("status") ?? "active"} onValueChange={(v) => form.setValue("status", v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["active", "inactive", "graduated", "suspended"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" disabled={!!isSubmitting}>
          {isSubmitting ? "Saving..." : defaultValues?.id ? "Update" : "Create"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { clearDraft(); }}>
          Clear draft
        </Button>
      </div>
    </form>
  );
}
