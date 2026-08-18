"use client";

import { useCallback, useRef, useState } from "react";
import type { StudentSummary } from "./run-search";

export function useStudentSearch() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<StudentSummary[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const run = useCallback(async (query: string, fromCursor?: number) => {
    const trimmed = query.trim();
    const id = ++seq.current;
    if (!trimmed) {
      setData([]);
      setCursor(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: trimmed });
      if (fromCursor) params.set("cursor", String(fromCursor));
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error(`search failed: ${res.status}`);
      const json = await res.json();
      if (id !== seq.current) return;
      setData((prev) => (fromCursor ? [...prev, ...json.data] : json.data));
      setCursor(json.nextCursor);
    } catch {
      if (id !== seq.current) return;
      setError("Search failed. Check your connection and try again.");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  const onChange = useCallback(
    (value: string) => {
      setQ(value);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => run(value), 250);
    },
    [run],
  );

  const loadMore = useCallback(() => {
    if (cursor) run(q, cursor);
  }, [cursor, q, run]);

  return { q, data, cursor, loading, error, onChange, loadMore };
}