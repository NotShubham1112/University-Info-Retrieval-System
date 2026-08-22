"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AttendanceListResponse, AttendanceReportResponse, AttendanceImportResult } from "@/lib/api/attendance";

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

export const attendanceKeys = {
  all: ["attendance"] as const,
  list: (params: Record<string, string | number | null | undefined>) => ["attendance", "list", params] as const,
  report: (params: Record<string, string | number | null | undefined>) => ["attendance", "report", params] as const,
};

export interface UseAttendanceParams {
  course_id?: number | null;
  subject_id?: number | null;
  date?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
  cursor?: string | null;
}

export function useAttendance(params: UseAttendanceParams = {}) {
  const { course_id, subject_id, date, from, to, limit = 20, cursor = null } = params;
  const qp: Record<string, string> = {};
  if (course_id) qp.course_id = String(course_id);
  if (subject_id) qp.subject_id = String(subject_id);
  if (date) qp.date = date;
  if (from) qp.from = from;
  if (to) qp.to = to;
  if (limit) qp.limit = String(limit);
  if (cursor) qp.cursor = cursor;
  const qs = new URLSearchParams(qp).toString();
  const url = `/api/dashboard/attendance${qs ? `?${qs}` : ""}`;
  return useQuery<AttendanceListResponse>({
    queryKey: attendanceKeys.list({ course_id: course_id ?? "", subject_id: subject_id ?? "", date: date ?? "", from: from ?? "", to: to ?? "", limit, cursor: cursor ?? "" }),
    queryFn: () => fetchJson<AttendanceListResponse>(url),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export interface UseAttendanceReportParams {
  course_id?: number | null;
  subject_id?: number | null;
  date?: string | null;
  month?: string | null;
  from?: string | null;
  to?: string | null;
  group_by?: string | null;
}

export function useAttendanceReport(params: UseAttendanceReportParams = {}) {
  const { course_id, subject_id, date, month, from, to, group_by = "daily" } = params;
  const qp: Record<string, string> = {};
  if (course_id) qp.course_id = String(course_id);
  if (subject_id) qp.subject_id = String(subject_id);
  if (date) qp.date = date;
  if (month) qp.month = month;
  if (from) qp.from = from;
  if (to) qp.to = to;
  if (group_by) qp.group_by = group_by;
  const qs = new URLSearchParams(qp).toString();
  const url = `/api/dashboard/attendance/report${qs ? `?${qs}` : ""}`;
  return useQuery<AttendanceReportResponse>({
    queryKey: attendanceKeys.report({ course_id: course_id ?? "", subject_id: subject_id ?? "", date: date ?? "", month: month ?? "", from: from ?? "", to: to ?? "", group_by: group_by ?? "" }),
    queryFn: () => fetchJson<AttendanceReportResponse>(url),
    staleTime: 30_000,
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation<{ inserted: number }, Error, { course_id: number; subject_id?: number | null; date: string; records: Array<{ student_id: number; status: string }> }>({
    mutationFn: (payload) => fetchJson<{ inserted: number }>(`/api/dashboard/attendance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: () => {
      getToast().success("Attendance saved");
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
    },
    onError: (err) => getToast().error(err.message || "Failed to save attendance"),
  });
}

export function useImportAttendance() {
  const qc = useQueryClient();
  return useMutation<AttendanceImportResult, Error, { csvText: string } | FormData>({
    mutationFn: (input) => {
      if (input instanceof FormData) return fetchJson<AttendanceImportResult>(`/api/dashboard/attendance/bulk`, { method: "POST", body: input });
      return fetchJson<AttendanceImportResult>(`/api/dashboard/attendance/bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csvText: (input as { csvText: string }).csvText }) });
    },
    onSuccess: (result) => {
      getToast().success(`Attendance import: ${result.inserted} ok${result.failed.length ? `, ${result.failed.length} failed` : ""}`);
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
    },
    onError: (err) => getToast().error(err.message || "Import failed"),
  });
}
