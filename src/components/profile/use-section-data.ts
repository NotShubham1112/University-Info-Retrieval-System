"use client";

/**
 * @deprecated Task 9 — replaced by TanStack Query hooks in `src/hooks/use-profile-sections.ts`.
 * Kept for backwards-compat only; new code should use `useAcademicResults` etc.
 * This file will be removed in a future task.
 */
import { useEffect, useState } from "react";

interface SectionState<T> {
  data: T[] | null;
  error: string | null;
}

export function useSectionData<T>(url: string): SectionState<T> {
  const [state, setState] = useState<SectionState<T>>({
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`request failed: ${res.status}`);
        return res.json();
      })
      .then((json: unknown) => {
        if (cancelled) return;
        setState({
          data: Array.isArray(json) ? (json as T[]) : [],
          error: null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ data: null, error: "Couldn't load this section. Try again." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
