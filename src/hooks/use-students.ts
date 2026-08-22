"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { StudentRow, StudentListResponse, ImportResult } from "@/lib/api/students";

// ---------------------------------------------------------------------------
// Tiny toast wrapper — prefers sonner when available, falls back to console.
// We avoid hard dependency on sonner so tsc passes without it.
// ---------------------------------------------------------------------------
type ToastFn = (msg: string) => void;
function getToast(): { success: ToastFn; error: ToastFn } {
  if (typeof window === "undefined") {
    return { success: () => {}, error: () => {} };
  }
  // Try sonner if installed at runtime
  const w = window as unknown as Record<string, unknown>;
  const sonner = w["__sonner"] as unknown as { toast?: { success: ToastFn; error: ToastFn } } | undefined;
  if (sonner?.toast) return sonner.toast;
  // Check global `toast` from our own provider (set by <Toaster /> if present)
  // Fallback: console
  return {
    success: (m) => console.info(`[toast success] ${m}`),
    error: (m) => console.error(`[toast error] ${m}`),
  };
}

// Allow pages to inject a sonner instance (optional)
export function __setSonnerToast(toast: { success: ToastFn; error: ToastFn }) {
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown> )["__sonner"] = { toast };
  }
}

// ---------------------------------------------------------------------------
// Fetcher helpers
// ---------------------------------------------------------------------------
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message ?? (body as { message?: string })?.message ?? res.statusText;
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const studentKeys = {
  all: ["students"] as const,
  list: (params: Record<string, string | number | null | undefined>) => ["students", "list", params] as const,
  detail: (id: string | number) => ["students", "detail", String(id)] as const,
  stats: ["dashboard-stats"] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export interface UseStudentsParams {
  q?: string;
  limit?: number;
  cursor?: string | null;
  status?: string | null;
}

export function useStudents(params: UseStudentsParams = {}) {
  const { q = "", limit = 20, cursor = null, status = null } = params;
  const queryParams: Record<string, string> = {};
  if (q) queryParams.q = q;
  if (limit) queryParams.limit = String(limit);
  if (cursor) queryParams.cursor = cursor;
  if (status) queryParams.status = status;

  const qs = new URLSearchParams(queryParams).toString();
  const url = `/api/dashboard/students${qs ? `?${qs}` : ""}`;

  return useQuery<StudentListResponse>({
    queryKey: studentKeys.list({ q, limit, cursor: cursor ?? "", status: status ?? "" }),
    queryFn: () => fetchJson<StudentListResponse>(url),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useStudent(id: string | number | null | undefined) {
  return useQuery<StudentRow>({
    queryKey: studentKeys.detail(id ?? ""),
    queryFn: () => fetchJson<StudentRow>(`/api/dashboard/students/${id}`),
    enabled: id !== null && id !== undefined && String(id).length > 0,
    staleTime: 30_000,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation<StudentRow, Error, Record<string, unknown>, { previous: Array<[readonly unknown[], unknown]>; optimistic: Record<string, unknown> } | undefined>({
    mutationFn: (payload) =>
      fetchJson<StudentRow>(`/api/dashboard/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onMutate: async (newStudent) => {
      // Optimistic: cancel outgoing list queries
      await qc.cancelQueries({ queryKey: studentKeys.all });
      const previous = qc.getQueriesData<StudentListResponse>({ queryKey: studentKeys.all });
      // Optimistically prepend to first list cache if present (best-effort)
      // no-op if not exact key; we just snapshot for rollback
      return { previous, optimistic: newStudent };
    },
    onSuccess: () => {
      getToast().success("Student created");
      qc.invalidateQueries({ queryKey: studentKeys.all });
      qc.invalidateQueries({ queryKey: studentKeys.stats });
    },
    onError: (err, _vars, ctx) => {
      getToast().error(err.message || "Failed to create student");
      // Rollback snapshots
      if (ctx?.previous) {
        for (const [k, data] of ctx.previous) {
          qc.setQueryData(k, data);
        }
      }
    },
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation<StudentRow, Error, { id: string | number; payload: Record<string, unknown> }, { previousDetail: StudentRow | undefined } | undefined>({
    mutationFn: ({ id, payload }) =>
      fetchJson<StudentRow>(`/api/dashboard/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: studentKeys.detail(id) });
      const previousDetail = qc.getQueryData<StudentRow>(studentKeys.detail(id));
      if (previousDetail) {
        qc.setQueryData<StudentRow>(studentKeys.detail(id), { ...previousDetail, ...payload } as StudentRow);
      }
      return { previousDetail };
    },
    onSuccess: (_data, vars) => {
      getToast().success("Student updated");
      qc.invalidateQueries({ queryKey: studentKeys.all });
      qc.invalidateQueries({ queryKey: studentKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: studentKeys.stats });
    },
    onError: (err, vars, ctx) => {
      getToast().error(err.message || "Failed to update student");
      if (ctx?.previousDetail) {
        qc.setQueryData(studentKeys.detail(vars.id), ctx.previousDetail);
      }
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string | number>({
    mutationFn: (id) =>
      fetchJson<{ ok: boolean }>(`/api/dashboard/students/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      getToast().success("Student deleted");
      qc.invalidateQueries({ queryKey: studentKeys.all });
      qc.invalidateQueries({ queryKey: studentKeys.stats });
    },
    onError: (err) => {
      getToast().error(err.message || "Failed to delete student");
    },
  });
}

export function useImportStudents() {
  const qc = useQueryClient();
  return useMutation<ImportResult, Error, { csvText: string } | FormData>({
    mutationFn: (input) => {
      if (input instanceof FormData) {
        return fetchJson<ImportResult>(`/api/dashboard/students/import`, {
          method: "POST",
          body: input,
        });
      }
      // Send as JSON with csvText when caller provides raw text
      return fetchJson<ImportResult>(`/api/dashboard/students/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: input.csvText }),
      });
    },
    onSuccess: (result) => {
      getToast().success(`Imported ${result.inserted} students${result.failed.length ? `, ${result.failed.length} failed` : ""}`);
      qc.invalidateQueries({ queryKey: studentKeys.all });
      qc.invalidateQueries({ queryKey: studentKeys.stats });
    },
    onError: (err) => {
      getToast().error(err.message || "Import failed");
    },
  });
}
