"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { teacherCreateSchema } from "@/lib/validation/schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FormValues = {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  department_id?: number | null;
  designation?: string | null;
  joining_date?: string | null;
  status?: string;
};

export function TeacherForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  onCancel,
}: {
  defaultValues?: Partial<FormValues> & { id?: number; name?: string };
  onSubmit: (values: FormValues) => void;
  isSubmitting?: boolean;
  onCancel?: () => void;
}) {
  // Derive first/last from name if provided
  const derived = React.useMemo(() => {
    if (defaultValues?.first_name || defaultValues?.last_name) return defaultValues;
    if (defaultValues?.name) {
      const parts = String(defaultValues.name).trim().split(/\s+/);
      return { ...defaultValues, first_name: parts[0] ?? "", last_name: parts.slice(1).join(" ") ?? "" } as Partial<FormValues>;
    }
    return defaultValues;
  }, [defaultValues]);

  const form = useForm<FormValues>({
    resolver: zodResolver(teacherCreateSchema as unknown as never),
    defaultValues: {
      employee_id: (derived?.employee_id as string) ?? "",
      first_name: (derived?.first_name as string) ?? "",
      last_name: (derived?.last_name as string) ?? "",
      email: (derived?.email as string) ?? "",
      phone: (derived?.phone as string) ?? "",
      department_id: (derived?.department_id as number) ?? undefined,
      designation: (derived?.designation as string) ?? "",
      joining_date: (derived?.joining_date as string) ?? "",
      status: (derived?.status as string) ?? "active",
    } as FormValues,
  });

  const onValid = (vals: FormValues) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(vals)) {
      if (v === "" || v === null) continue;
      if (v !== undefined) clean[k] = v;
    }
    onSubmit(clean as unknown as FormValues);
  };

  return (
    <form onSubmit={form.handleSubmit(onValid)} className="space-y-6">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Employee ID *</Label><Input {...form.register("employee_id")} placeholder="EMP-000001" />{form.formState.errors.employee_id ? <p className="text-xs text-destructive">{form.formState.errors.employee_id.message as string}</p> : null}</div>
          <div className="space-y-1"><Label>Status</Label>
            {/* eslint-disable-next-line react-hooks/incompatible-library */}
            <Select value={form.watch("status") ?? "active"} onValueChange={(v) => form.setValue("status", v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["active", "inactive", "on_leave"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>First name *</Label><Input {...form.register("first_name")} />{form.formState.errors.first_name ? <p className="text-xs text-destructive">{form.formState.errors.first_name.message as string}</p> : null}</div>
          <div className="space-y-1"><Label>Last name *</Label><Input {...form.register("last_name")} />{form.formState.errors.last_name ? <p className="text-xs text-destructive">{form.formState.errors.last_name.message as string}</p> : null}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Email *</Label><Input {...form.register("email")} placeholder="teacher@example.com" />{form.formState.errors.email ? <p className="text-xs text-destructive">{form.formState.errors.email.message as string}</p> : null}</div>
          <div className="space-y-1"><Label>Phone</Label><Input {...form.register("phone")} placeholder="+919..." /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Department ID</Label><Input type="number" {...form.register("department_id", { valueAsNumber: true })} placeholder="1" /></div>
          <div className="space-y-1"><Label>Designation</Label><Input {...form.register("designation")} placeholder="Professor" /></div>
        </div>
        <div className="space-y-1"><Label>Joining date</Label><Input type="date" {...form.register("joining_date")} /></div>
        <p className="text-xs text-muted-foreground">Salary is never projected in list/GET and not editable here (salary excluded by default).</p>
      </div>
      <div className="flex justify-end gap-2 border-t pt-4">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" disabled={!!isSubmitting}>{isSubmitting ? "Saving..." : defaultValues?.id ? "Update" : "Create"}</Button>
      </div>
    </form>
  );
}
