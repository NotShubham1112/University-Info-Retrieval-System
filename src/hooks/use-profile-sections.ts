"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

// Base fetcher that handles JSON error shape { error: { message } }
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { error?: { message?: string } })?.error?.message ??
      (body as { message?: string })?.message ??
      res.statusText;
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  // API routes return raw arrays or { data: [] } — normalize to caller
  return body as T;
}

export const profileKeys = {
  all: (studentId: number | string) => ["profile", String(studentId)] as const,
  academic: (studentId: number | string) => ["profile", String(studentId), "academic"] as const,
  attendance: (studentId: number | string) => ["profile", String(studentId), "attendance"] as const,
  fees: (studentId: number | string) => ["profile", String(studentId), "fees"] as const,
  documents: (studentId: number | string) => ["profile", String(studentId), "documents"] as const,
  summary: (studentId: number | string) => ["profile", String(studentId), "summary"] as const,
};

// ---------------------------------------------------------------------------
// Types mirroring the API payloads (kept local to avoid circular deps)
// ---------------------------------------------------------------------------
export interface AcademicRow {
  id: number;
  marks: number | null;
  grade: string | null;
  grade_point: number | null;
  result_status: string | null;
  enrollments?: { subjects?: { name: string | null; semester_no: number | null } | null } | null;
}

export interface AttendanceRow {
  id: number;
  classes_conducted: number;
  classes_attended: number;
}

export interface FeeRow {
  id: number;
  status: string | null;
  amount_due: number | null;
  fee_structures?: { fee_type: string | null; amount: number | null } | null;
  payments?: Array<{ id: number; amount: number; payment_date: string | null }> | null;
}

export interface DocumentRow {
  id: number;
  document_type: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string | null;
  version: number | null;
}

// ---------------------------------------------------------------------------
// Hooks — deduplicated + cached via TanStack Query
// staleTime 30s, gcTime 5m align with QueryClient defaults but set explicitly
// for clarity on profile sections.
// ---------------------------------------------------------------------------
export function useAcademicResults(studentId: number | string | null | undefined) {
  return useQuery<AcademicRow[]>({
    queryKey: profileKeys.academic(studentId ?? ""),
    queryFn: () => fetchJson<AcademicRow[]>(`/api/students/${studentId}/results`),
    enabled: studentId !== null && studentId !== undefined && String(studentId).length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}

export function useStudentAttendance(studentId: number | string | null | undefined) {
  return useQuery<AttendanceRow[]>({
    queryKey: profileKeys.attendance(studentId ?? ""),
    queryFn: () => fetchJson<AttendanceRow[]>(`/api/students/${studentId}/attendance`),
    enabled: studentId !== null && studentId !== undefined && String(studentId).length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}

export function useStudentFees(studentId: number | string | null | undefined) {
  return useQuery<FeeRow[]>({
    queryKey: profileKeys.fees(studentId ?? ""),
    queryFn: () => fetchJson<FeeRow[]>(`/api/students/${studentId}/fees`),
    enabled: studentId !== null && studentId !== undefined && String(studentId).length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}

export function useStudentDocuments(studentId: number | string | null | undefined) {
  return useQuery<DocumentRow[]>({
    queryKey: profileKeys.documents(studentId ?? ""),
    queryFn: () => fetchJson<DocumentRow[]>(`/api/students/${studentId}/documents`),
    enabled: studentId !== null && studentId !== undefined && String(studentId).length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}

// Optional helper for components that need to invalidate documents after upload
export function useInvalidateProfileSection() {
  const qc = useQueryClient();
  return {
    invalidateDocuments: (studentId: number | string) =>
      qc.invalidateQueries({ queryKey: profileKeys.documents(studentId) }),
    invalidateAll: (studentId: number | string) =>
      qc.invalidateQueries({ queryKey: profileKeys.all(studentId) }),
  };
}
