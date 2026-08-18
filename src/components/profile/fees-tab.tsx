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
import { useSectionData } from "@/components/profile/use-section-data";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

function formatINR(value: number): string {
  return inr.format(value);
}

interface PaymentRef {
  id: number;
  amount: number;
  payment_date: string | null;
}

interface FeeStructureRef {
  fee_type: string | null;
  amount: number | null;
}

interface FeeRow {
  id: number;
  status: string | null;
  amount_due: number | null;
  fee_structures: FeeStructureRef | null;
  payments: PaymentRef[] | null;
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
  const { data, error } = useSectionData<FeeRow>(
    `/api/students/${studentId}/fees`,
  );

  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }
  if (data === null) {
    return (
      <div className="flex flex-col gap-2">
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
                  <TableCell>
                    {row.fee_structures?.amount != null
                      ? formatINR(row.fee_structures.amount)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {row.amount_due != null ? formatINR(row.amount_due) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "unpaid" ? "outline" : "secondary"
                      }
                    >
                      {statusLabel(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {payment
                      ? `${formatINR(payment.amount)} · ${payment.payment_date ?? "—"}`
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}