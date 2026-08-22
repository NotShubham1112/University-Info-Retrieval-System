"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteTimetable } from "@/hooks/use-timetables";
import { toast } from "@/components/ui/sonner";
import type { TimetableRow } from "@/lib/api/timetables";

export function DeleteConfirm({ open, onOpenChange, row }: { open: boolean; onOpenChange: (v: boolean) => void; row: TimetableRow | null }) {
  const mut = useDeleteTimetable();
  const handle = async () => {
    if (!row) return;
    try { await mut.mutateAsync(row.id); toast.success("Deleted"); onOpenChange(false); } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete timetable {row?.id}?</DialogTitle><DialogDescription>Course {row?.course_id} Sem {row?.semester_no} Day {row?.day_of_week} Period {row?.period_no}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="destructive" onClick={handle} disabled={mut.isPending}>{mut.isPending ? "Deleting..." : "Delete"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
