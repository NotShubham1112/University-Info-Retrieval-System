"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStudentFees } from "@/hooks/use-profile-sections";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

function formatINR(value: number): string {
  return inr.format(value);
}

function statusLabel(status: string | null): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "unpaid":
      return "Unpaid";
    case "partial":
      return "Partial";
    default:
      return status ?? "—";
  }
}

export function FeesTab({ studentId }: { studentId: number }) {
  const { data, error, isLoading } = useStudentFees(studentId);

  if (error) {
    return <p className="text-sm text-muted-foreground">{(error as Error).message ?? "Couldn't load this section. Try again."}</p>;
  }
  if (isLoading || data === undefined) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading fees">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No fees yet.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fee type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Amount due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const payment = row.payments?.[0] ?? null;
              return (
                <TableRow key={row.id}>
                  <TableCell>{row.fee_structures?.fee_type ?? "—"}</TableCell>
                  <TableCell>{row.fee_structures?.amount != null ? formatINR(row.fee_structures.amount) : "—"}</TableCell>
                  <TableCell>{row.amount_due != null ? formatINR(row.amount_due) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "unpaid" ? "outline" : "secondary"}>{statusLabel(row.status)}</Badge>
                  </TableCell>
                  <TableCell>{payment ? `${formatINR(payment.amount)} · ${payment.payment_date ?? "—"}` : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
