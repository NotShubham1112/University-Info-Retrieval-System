import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { User } from "lucide-react";
import type { StudentSummary } from "@/lib/search/run-search";

export function ResultCard({ student }: { student: StudentSummary }) {
  const initials = `${student.first_name?.[0] ?? ""}${student.last_name?.[0] ?? ""}`.toUpperCase();

  return (
    <Link
      href={`/students/${student.id}`}
      className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="flex items-center gap-4 py-3">
          {/* rectangle profile placeholder — photo_path or initials fallback */}
          <div className="h-[72px] w-[56px] shrink-0 overflow-hidden rounded-md border bg-muted">
            {student.photo_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={student.photo_path}
                alt={`${student.first_name} ${student.last_name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
                {initials ? (
                  <span className="text-sm font-medium tracking-tight">{initials}</span>
                ) : (
                  <User className="h-6 w-6" />
                )}
                <span className="text-[10px] leading-none">Photo</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {student.first_name} {student.last_name}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {student.pnr} · {student.roll_number}
            </p>
          </div>

          <span className="shrink-0 text-sm text-muted-foreground">→</span>
        </CardContent>
      </Card>
    </Link>
  );
}
