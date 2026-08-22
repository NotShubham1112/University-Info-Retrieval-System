"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TeacherRow, TeacherListResponse } from "@/lib/api/teachers";

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

export const teacherKeys = {
  all: ["teachers"] as const,
  list: (params: Record<string, string | number | null | undefined>) => ["teachers", "list", params] as const,
  detail: (id: string | number) => ["teachers", "detail", String(id)] as const,
  stats: ["dashboard-stats"] as const,
};

export interface UseTeachersParams {
  q?: string;
  limit?: number;
  cursor?: string | null;
  department_id?: number | null;
  status?: string | null;
}

export function useTeachers(params: UseTeachersParams = {}) {
  const { q = "", limit = 20, cursor = null, department_id = null, status = null } = params;
  const queryParams: Record<string, string> = {};
  if (q) queryParams.q = q;
  if (limit) queryParams.limit = String(limit);
  if (cursor) queryParams.cursor = cursor;
  if (department_id) queryParams.department_id = String(department_id);
  if (status) queryParams.status = status;
  const qs = new URLSearchParams(queryParams).toString();
  const url = `/api/dashboard/teachers${qs ? `?${qs}` : ""}`;
  return useQuery<TeacherListResponse>({
    queryKey: teacherKeys.list({ q, limit, cursor: cursor ?? "", department_id: department_id ?? "", status: status ?? "" }),
    queryFn: () => fetchJson<TeacherListResponse>(url),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useTeacher(id: string | number | null | undefined) {
  return useQuery<TeacherRow>({
    queryKey: teacherKeys.detail(id ?? ""),
    queryFn: () => fetchJson<TeacherRow>(`/api/dashboard/teachers/${id}`),
    enabled: id !== null && id !== undefined && String(id).length > 0,
    staleTime: 30_000,
  });
}

export function useCreateTeacher() {
  const qc = useQueryClient();
  return useMutation<TeacherRow, Error, Record<string, unknown>>({
    mutationFn: (payload) => fetchJson<TeacherRow>(`/api/dashboard/teachers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: () => {
      getToast().success("Teacher created");
      qc.invalidateQueries({ queryKey: teacherKeys.all });
      qc.invalidateQueries({ queryKey: teacherKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to create teacher"),
  });
}

export function useUpdateTeacher() {
  const qc = useQueryClient();
  return useMutation<TeacherRow, Error, { id: string | number; payload: Record<string, unknown> }>({
    mutationFn: ({ id, payload }) => fetchJson<TeacherRow>(`/api/dashboard/teachers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: (_data, vars) => {
      getToast().success("Teacher updated");
      qc.invalidateQueries({ queryKey: teacherKeys.all });
      qc.invalidateQueries({ queryKey: teacherKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: teacherKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to update teacher"),
  });
}

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string | number>({
    mutationFn: (id) => fetchJson<{ ok: boolean }>(`/api/dashboard/teachers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      getToast().success("Teacher deleted");
      qc.invalidateQueries({ queryKey: teacherKeys.all });
      qc.invalidateQueries({ queryKey: teacherKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to delete teacher"),
  });
}
