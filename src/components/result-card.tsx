import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { StudentSummary } from "@/lib/search/run-search";

export function ResultCard({ student }: { student: StudentSummary }) {
  return (
    <Link
      href={`/students/${student.id}`}
      className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card>
        <CardContent className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">
              {student.first_name} {student.last_name}
            </p>
            <p className="text-sm text-muted-foreground">
              {student.pnr} · {student.roll_number}
            </p>
          </div>
          <span className="text-sm text-muted-foreground">→</span>
        </CardContent>
      </Card>
    </Link>
  );
}