"use client";

import { Button } from "@/components/ui/button";
import { ResultCard } from "@/components/result-card";
import type { StudentSummary } from "@/lib/search/run-search";

interface Props {
  q: string;
  data: StudentSummary[];
  cursor: number | null;
  loading: boolean;
  error: string | null;
  loadMore: () => void;
}

export function StudentResults({
  q,
  data,
  cursor,
  loading,
  error,
  loadMore,
}: Props) {
  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }
  if (q.trim() === "") {
    return (
      <p className="text-sm text-muted-foreground">
        Enter a PNR, roll number, or name to find a student.
      </p>
    );
  }
  if (loading && data.length === 0) {
    return <p className="text-sm text-muted-foreground">Searching…</p>;
  }
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No students found. Try a different PNR, roll number, or name.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {data.map((s) => (
        <ResultCard key={s.id} student={s} />
      ))}
      {cursor && (
        <Button variant="outline" onClick={loadMore} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}