"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExamRow, ExamListResponse, PublishResult } from "@/lib/api/exams";

type ToastFn = (msg: string) => void;
function getToast(): { success: ToastFn; error: ToastFn } {
  if (typeof window === "undefined") return { success: () => {}, error: () => {} };
  return { success: (m) => console.info(`[toast success] ${m}`), error: (m) => console.error(`[toast error] ${m}`) };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message ?? (body as { message?: string })?.message ?? res.statusText;
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return body as T;
}

export const examKeys = {
  all: ["exams"] as const,
  list: (params: Record<string, string | number | null | undefined>) => ["exams", "list", params] as const,
  detail: (id: string | number) => ["exams", "detail", String(id)] as const,
  marks: (id: string | number) => ["exams", "marks", String(id)] as const,
  stats: ["dashboard-stats"] as const,
};

export interface UseExamsParams {
  q?: string;
  limit?: number;
  cursor?: string | null;
  course_id?: number | null;
  status?: string | null;
}

export function useExams(params: UseExamsParams = {}) {
  const { q = "", limit = 20, cursor = null, course_id = null, status = null } = params;
  const qp: Record<string, string> = {};
  if (q) qp.q = q;
  if (limit) qp.limit = String(limit);
  if (cursor) qp.cursor = cursor;
  if (course_id) qp.course_id = String(course_id);
  if (status) qp.status = status;
  const qs = new URLSearchParams(qp).toString();
  const url = `/api/dashboard/exams${qs ? `?${qs}` : ""}`;
  return useQuery<ExamListResponse>({
    queryKey: examKeys.list({ q, limit, cursor: cursor ?? "", course_id: course_id ?? "", status: status ?? "" }),
    queryFn: () => fetchJson<ExamListResponse>(url),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useExam(id: string | number | null | undefined) {
  return useQuery<ExamRow & { subjects?: unknown[] }>({
    queryKey: examKeys.detail(id ?? ""),
    queryFn: () => fetchJson<ExamRow & { subjects?: unknown[] }>(`/api/dashboard/exams/${id}`),
    enabled: id !== null && id !== undefined && String(id).length > 0,
    staleTime: 30_000,
  });
}

export function useExamMarks(id: string | number | null | undefined) {
  return useQuery<{ data: unknown[] }>({
    queryKey: examKeys.marks(id ?? ""),
    queryFn: () => fetchJson<{ data: unknown[] }>(`/api/dashboard/exams/${id}/marks`),
    enabled: id !== null && id !== undefined && String(id).length > 0,
    staleTime: 15_000,
  });
}

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation<ExamRow, Error, Record<string, unknown>>({
    mutationFn: (payload) => fetchJson<ExamRow>(`/api/dashboard/exams`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: () => {
      getToast().success("Exam created");
      qc.invalidateQueries({ queryKey: examKeys.all });
      qc.invalidateQueries({ queryKey: examKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to create exam"),
  });
}

export function useUpdateExam() {
  const qc = useQueryClient();
  return useMutation<ExamRow, Error, { id: string | number; payload: Record<string, unknown> }>({
    mutationFn: ({ id, payload }) => fetchJson<ExamRow>(`/api/dashboard/exams/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: (_data, vars) => {
      getToast().success("Exam updated");
      qc.invalidateQueries({ queryKey: examKeys.all });
      qc.invalidateQueries({ queryKey: examKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: examKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to update exam"),
  });
}

export function useDeleteExam() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string | number>({
    mutationFn: (id) => fetchJson<{ ok: boolean }>(`/api/dashboard/exams/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      getToast().success("Exam deleted");
      qc.invalidateQueries({ queryKey: examKeys.all });
      qc.invalidateQueries({ queryKey: examKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to delete exam"),
  });
}

export function useSubmitMarks() {
  const qc = useQueryClient();
  return useMutation<{ inserted: number }, Error, { id: string | number; marks: Array<Record<string, unknown>> }>({
    mutationFn: ({ id, marks }) => fetchJson<{ inserted: number }>(`/api/dashboard/exams/${id}/marks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marks }) }),
    onSuccess: (_data, vars) => {
      getToast().success("Marks saved");
      qc.invalidateQueries({ queryKey: examKeys.marks(vars.id) });
      qc.invalidateQueries({ queryKey: examKeys.all });
    },
    onError: (err) => getToast().error(err.message || "Failed to save marks"),
  });
}

export function usePublishExam() {
  const qc = useQueryClient();
  return useMutation<PublishResult, Error, string | number>({
    mutationFn: (id) => fetchJson<PublishResult>(`/api/dashboard/exams/${id}/publish`, { method: "POST" }),
    onSuccess: () => {
      getToast().success("Exam published — semester records & notifications created");
      qc.invalidateQueries({ queryKey: examKeys.all });
      qc.invalidateQueries({ queryKey: examKeys.stats });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => getToast().error(err.message || "Failed to publish exam"),
  });
}
