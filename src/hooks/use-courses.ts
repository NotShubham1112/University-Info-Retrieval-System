"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CourseRow, CourseListResponse } from "@/lib/api/courses";

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

export const courseKeys = {
  all: ["courses"] as const,
  list: (params: Record<string, string | number | null | undefined>) => ["courses", "list", params] as const,
  detail: (id: string | number) => ["courses", "detail", String(id)] as const,
  stats: ["dashboard-stats"] as const,
};

export interface UseCoursesParams {
  q?: string;
  limit?: number;
  cursor?: string | null;
  course_type?: string | null;
}

export function useCourses(params: UseCoursesParams = {}) {
  const { q = "", limit = 20, cursor = null, course_type = null } = params;
  const queryParams: Record<string, string> = {};
  if (q) queryParams.q = q;
  if (limit) queryParams.limit = String(limit);
  if (cursor) queryParams.cursor = cursor;
  if (course_type) queryParams.course_type = course_type;
  const qs = new URLSearchParams(queryParams).toString();
  const url = `/api/dashboard/courses${qs ? `?${qs}` : ""}`;
  return useQuery<CourseListResponse>({
    queryKey: courseKeys.list({ q, limit, cursor: cursor ?? "", course_type: course_type ?? "" }),
    queryFn: () => fetchJson<CourseListResponse>(url),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useCourse(id: string | number | null | undefined) {
  return useQuery<CourseRow>({
    queryKey: courseKeys.detail(id ?? ""),
    queryFn: () => fetchJson<CourseRow>(`/api/dashboard/courses/${id}`),
    enabled: id !== null && id !== undefined && String(id).length > 0,
    staleTime: 30_000,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation<CourseRow, Error, Record<string, unknown>>({
    mutationFn: (payload) => fetchJson<CourseRow>(`/api/dashboard/courses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: () => {
      getToast().success("Course created");
      qc.invalidateQueries({ queryKey: courseKeys.all });
      qc.invalidateQueries({ queryKey: courseKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to create course"),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation<CourseRow, Error, { id: string | number; payload: Record<string, unknown> }>({
    mutationFn: ({ id, payload }) => fetchJson<CourseRow>(`/api/dashboard/courses/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: (_data, vars) => {
      getToast().success("Course updated");
      qc.invalidateQueries({ queryKey: courseKeys.all });
      qc.invalidateQueries({ queryKey: courseKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: courseKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to update course"),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string | number>({
    mutationFn: (id) => fetchJson<{ ok: boolean }>(`/api/dashboard/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      getToast().success("Course deleted");
      qc.invalidateQueries({ queryKey: courseKeys.all });
      qc.invalidateQueries({ queryKey: courseKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to delete course"),
  });
}
