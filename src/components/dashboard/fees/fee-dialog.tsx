"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateFeePayment, useUpdateFeePayment } from "@/hooks/use-fees";
import { toast } from "@/components/ui/sonner";
import type { FeePaymentRow } from "@/lib/api/fees";
import { z } from "zod";

const formSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  fee_category_rate_id: z.coerce.number().int().positive().optional().nullable(),
  amount_due: z.coerce.number().min(0),
  amount_paid: z.coerce.number().min(0).default(0),
  status: z.enum(["unpaid", "partial", "paid", "overdue"]).default("unpaid"),
  payment_mode: z.string().max(50).optional().nullable(),
  payment_date: z.string().optional().nullable(),
  scholarship_application_id: z.coerce.number().int().positive().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export function FeeDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing?: FeePaymentRow | null }) {
  const createMut = useCreateFeePayment();
  const updateMut = useUpdateFeePayment();
  const isEdit = !!editing;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: editing ? { student_id: editing.student_id, fee_category_rate_id: editing.fee_category_rate_id ?? undefined, amount_due: Number(editing.amount_due), amount_paid: Number(editing.amount_paid), status: editing.status as never, payment_mode: editing.payment_mode ?? undefined, payment_date: editing.payment_date ?? undefined } : { amount_due: 50000, amount_paid: 0, status: "unpaid" as const },
  });

  React.useEffect(() => {
    if (editing) reset({ student_id: editing.student_id, fee_category_rate_id: editing.fee_category_rate_id ?? undefined, amount_due: Number(editing.amount_due), amount_paid: Number(editing.amount_paid), status: editing.status as never, payment_mode: editing.payment_mode ?? undefined, payment_date: editing.payment_date ?? undefined });
    else reset({ amount_due: 50000, amount_paid: 0, status: "unpaid" } as unknown as FormValues);
  }, [editing, reset]);

  const status = watch("status");

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = { ...values } as Record<string, unknown>;
      if (isEdit && editing) {
        await updateMut.mutateAsync({ id: editing.id, payload });
        toast.success("Fee payment updated");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Fee payment created");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit fee payment" : "Record fee payment"} </SheetTitle>
          <SheetDescription>Links fee_category_rates + optional scholarship_application_id. Pending report via mv_fee_collection.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit as never)} className="p-4 space-y-4">
          <div className="space-y-1">
            <Label>Student ID *</Label>
            <Input type="number" {...register("student_id", { valueAsNumber: true })} />
            {errors.student_id && <p className="text-xs text-destructive">{errors.student_id.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Fee Category Rate ID</Label>
            <Input type="number" {...register("fee_category_rate_id", { valueAsNumber: true })} placeholder="optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount Due *</Label>
              <Input type="number" step="0.01" {...register("amount_due", { valueAsNumber: true })} />
              {errors.amount_due && <p className="text-xs text-destructive">{errors.amount_due.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Amount Paid</Label>
              <Input type="number" step="0.01" {...register("amount_paid", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setValue("status", v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">unpaid</SelectItem>
                <SelectItem value="partial">partial</SelectItem>
                <SelectItem value="paid">paid</SelectItem>
                <SelectItem value="overdue">overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Payment Mode</Label>
              <Input {...register("payment_mode")} placeholder="online / cash / etc." />
            </div>
            <div className="space-y-1">
              <Label>Payment Date</Label>
              <Input type="date" {...register("payment_date")} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Scholarship Application ID</Label>
            <Input type="number" {...register("scholarship_application_id", { valueAsNumber: true })} placeholder="optional" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || createMut.isPending || updateMut.isPending}>{isSubmitting ? "Saving..." : isEdit ? "Save" : "Create"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}


