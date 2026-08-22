"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notificationCreateSchema } from "@/lib/validation/schemas";
import { useCreateNotification } from "@/hooks/use-notifications";
import { toast } from "@/components/ui/sonner";
import { z } from "zod";

type FormValues = z.infer<typeof notificationCreateSchema>;

export function NotificationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createMut = useCreateNotification();
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(notificationCreateSchema) as never,
    defaultValues: { title: "", body: "", type: "info", priority: "medium", channel: "in_app" } as unknown as FormValues,
  });

  const type = watch("type");
  const priority = watch("priority");
  const channel = watch("channel");

  const onSubmit = async (values: FormValues) => {
    // Parse student_ids csv if provided via extra field
    const raw = values as unknown as Record<string, unknown>;
    const payload: Record<string, unknown> = { ...raw };
    // Handle student_ids as comma string from textarea? Keep array if already
    if (typeof raw["student_ids"] === "string") {
      const s = String(raw["student_ids"]).trim();
      if (s.length > 0) {
        payload["student_ids"] = s.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n));
      } else delete payload["student_ids"];
    }
    // recipient_role free text
    if (typeof payload["recipient_role"] === "string" && String(payload["recipient_role"]).trim() === "") delete payload["recipient_role"];
    try {
      await createMut.mutateAsync(payload);
      toast.success("Notification sent");
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Send notification</SheetTitle>
          <SheetDescription>Channel placeholder only (no SMTP/SMS). In-app delivery via notification_recipients (role or student_ids).</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit as never)} className="p-4 space-y-4">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input {...register("title")} placeholder="Exam results published" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Body *</Label>
            <Textarea {...register("body")} rows={4} placeholder="Your results for Sem 3 have been published..." />
            {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type as string} onValueChange={(v) => setValue("type", v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">info</SelectItem><SelectItem value="academic">academic</SelectItem><SelectItem value="fee">fee</SelectItem><SelectItem value="event">event</SelectItem><SelectItem value="urgent">urgent</SelectItem><SelectItem value="warning">warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={priority as string} onValueChange={(v) => setValue("priority", v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">low</SelectItem><SelectItem value="medium">medium</SelectItem><SelectItem value="high">high</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Channel</Label>
              <Select value={channel as string} onValueChange={(v) => setValue("channel", v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="in_app">in_app</SelectItem><SelectItem value="email">email (placeholder)</SelectItem><SelectItem value="sms">sms (placeholder)</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Recipient Role (optional)</Label>
            <Input {...register("recipient_role")} placeholder="teacher / admin / viewer / accountant" />
            <p className="text-xs text-muted-foreground">Single role recipient creates one notification_recipients row with recipient_role.</p>
          </div>
          <div className="space-y-1">
            <Label>Student IDs (optional, comma-separated)</Label>
            <Input {...register("student_ids" as never)} placeholder="1,2,3" />
            <p className="text-xs text-muted-foreground">Each id creates a recipient row (status unread). Leave both empty for broadcast-like notification (no recipients).</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || createMut.isPending}>{isSubmitting ? "Sending..." : "Send"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}


