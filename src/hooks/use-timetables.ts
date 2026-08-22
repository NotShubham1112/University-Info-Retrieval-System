"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TimetableRow, TimetableListResponse } from "@/lib/api/timetables";

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

export const timetableKeys = {
  all: ["timetables"] as const,
  list: (params: Record<string, string | number | null | undefined>) => ["timetables", "list", params] as const,
  detail: (id: string | number) => ["timetables", "detail", String(id)] as const,
  stats: ["dashboard-stats"] as const,
};

export interface UseTimetablesParams {
  q?: string;
  limit?: number;
  cursor?: string | null;
  course_id?: number | null;
  semester_no?: number | null;
  day_of_week?: number | null;
  teacher_id?: number | null;
  room_id?: number | null;
}

export function useTimetables(params: UseTimetablesParams = {}) {
  const { q = "", limit = 20, cursor = null, course_id = null, semester_no = null, day_of_week = null, teacher_id = null, room_id = null } = params;
  const qp: Record<string, string> = {};
  if (q) qp.q = q;
  if (limit) qp.limit = String(limit);
  if (cursor) qp.cursor = cursor;
  if (course_id) qp.course_id = String(course_id);
  if (semester_no) qp.semester_no = String(semester_no);
  if (day_of_week !== null && day_of_week !== undefined) qp.day_of_week = String(day_of_week);
  if (teacher_id) qp.teacher_id = String(teacher_id);
  if (room_id) qp.room_id = String(room_id);
  const qs = new URLSearchParams(qp).toString();
  const url = `/api/dashboard/timetables${qs ? `?${qs}` : ""}`;
  return useQuery<TimetableListResponse>({
    queryKey: timetableKeys.list({ q, limit, cursor: cursor ?? "", course_id: course_id ?? "", semester_no: semester_no ?? "", day_of_week: day_of_week ?? "", teacher_id: teacher_id ?? "", room_id: room_id ?? "" }),
    queryFn: () => fetchJson<TimetableListResponse>(url),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useTimetable(id: string | number | null | undefined) {
  return useQuery<TimetableRow>({
    queryKey: timetableKeys.detail(id ?? ""),
    queryFn: () => fetchJson<TimetableRow>(`/api/dashboard/timetables/${id}`),
    enabled: id !== null && id !== undefined && String(id).length > 0,
    staleTime: 30_000,
  });
}

export function useCreateTimetable() {
  const qc = useQueryClient();
  return useMutation<TimetableRow, Error, Record<string, unknown>>({
    mutationFn: (payload) => fetchJson<TimetableRow>(`/api/dashboard/timetables`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: () => {
      getToast().success("Timetable entry created");
      qc.invalidateQueries({ queryKey: timetableKeys.all });
      qc.invalidateQueries({ queryKey: timetableKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to create timetable"),
  });
}

export function useUpdateTimetable() {
  const qc = useQueryClient();
  return useMutation<TimetableRow, Error, { id: string | number; payload: Record<string, unknown> }>({
    mutationFn: ({ id, payload }) => fetchJson<TimetableRow>(`/api/dashboard/timetables/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: (_data, vars) => {
      getToast().success("Timetable updated");
      qc.invalidateQueries({ queryKey: timetableKeys.all });
      qc.invalidateQueries({ queryKey: timetableKeys.detail(vars.id) });
    },
    onError: (err) => getToast().error(err.message || "Failed to update timetable"),
  });
}

export function useDeleteTimetable() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string | number>({
    mutationFn: (id) => fetchJson<{ ok: boolean }>(`/api/dashboard/timetables/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      getToast().success("Timetable entry deleted");
      qc.invalidateQueries({ queryKey: timetableKeys.all });
    },
    onError: (err) => getToast().error(err.message || "Failed to delete"),
  });
}
