"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { FeePaymentRow, FeeListResponse } from "@/lib/api/fees";

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

export const feeKeys = {
  all: ["fees"] as const,
  list: (params: Record<string, string | number | null | undefined>) => ["fees", "list", params] as const,
  detail: (id: string | number) => ["fees", "detail", String(id)] as const,
  receipt: (params: Record<string, string | number | null | undefined>) => ["fees", "receipt", params] as const,
  pending: ["fees", "pending"] as const,
  stats: ["dashboard-stats"] as const,
};

export interface UseFeesParams {
  q?: string;
  limit?: number;
  cursor?: string | null;
  student_id?: number | null;
  status?: string | null;
}

export function useFees(params: UseFeesParams = {}) {
  const { q = "", limit = 20, cursor = null, student_id = null, status = null } = params;
  const qp: Record<string, string> = {};
  if (q) qp.q = q;
  if (limit) qp.limit = String(limit);
  if (cursor) qp.cursor = cursor;
  if (student_id) qp.student_id = String(student_id);
  if (status) qp.status = status;
  const qs = new URLSearchParams(qp).toString();
  const url = `/api/dashboard/fees${qs ? `?${qs}` : ""}`;
  return useQuery<FeeListResponse>({
    queryKey: feeKeys.list({ q, limit, cursor: cursor ?? "", student_id: student_id ?? "", status: status ?? "" }),
    queryFn: () => fetchJson<FeeListResponse>(url),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useFeePayment(id: string | number | null | undefined) {
  return useQuery<FeePaymentRow>({
    queryKey: feeKeys.detail(id ?? ""),
    queryFn: () => fetchJson<FeePaymentRow>(`/api/dashboard/fees/${id}`),
    enabled: id !== null && id !== undefined && String(id).length > 0,
    staleTime: 30_000,
  });
}

export function useFeeReceipt(params: { fee_payment_id?: number | null; student_id?: number | null; transaction_id?: string | null } | null) {
  const fee_payment_id = params?.fee_payment_id ?? null;
  const student_id = params?.student_id ?? null;
  const transaction_id = params?.transaction_id ?? null;
  const qp: Record<string, string> = {};
  if (fee_payment_id) qp.fee_payment_id = String(fee_payment_id);
  if (student_id) qp.student_id = String(student_id);
  if (transaction_id) qp.transaction_id = transaction_id;
  const qs = new URLSearchParams(qp).toString();
  const url = `/api/dashboard/fees/receipt${qs ? `?${qs}` : ""}`;
  const enabled = !!(fee_payment_id || student_id || transaction_id);
  return useQuery<{ receipt: unknown }>({
    queryKey: feeKeys.receipt({ fee_payment_id: fee_payment_id ?? "", student_id: student_id ?? "", transaction_id: transaction_id ?? "" }),
    queryFn: () => fetchJson<{ receipt: unknown }>(url),
    enabled,
    staleTime: 30_000,
  });
}

export function usePendingFees() {
  return useQuery<{ data: unknown[] }>({
    queryKey: feeKeys.pending,
    queryFn: () => fetchJson<{ data: unknown[] }>(`/api/dashboard/fees?report=pending`),
    staleTime: 30_000,
  });
}

export function useCreateFeePayment() {
  const qc = useQueryClient();
  return useMutation<FeePaymentRow, Error, Record<string, unknown>>({
    mutationFn: (payload) => fetchJson<FeePaymentRow>(`/api/dashboard/fees`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: () => {
      getToast().success("Fee payment recorded");
      qc.invalidateQueries({ queryKey: feeKeys.all });
      qc.invalidateQueries({ queryKey: feeKeys.stats });
      qc.invalidateQueries({ queryKey: feeKeys.pending });
    },
    onError: (err) => getToast().error(err.message || "Failed to create fee payment"),
  });
}

export function useUpdateFeePayment() {
  const qc = useQueryClient();
  return useMutation<FeePaymentRow, Error, { id: string | number; payload: Record<string, unknown> }>({
    mutationFn: ({ id, payload }) => fetchJson<FeePaymentRow>(`/api/dashboard/fees/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: (_data, vars) => {
      getToast().success("Fee payment updated");
      qc.invalidateQueries({ queryKey: feeKeys.all });
      qc.invalidateQueries({ queryKey: feeKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: feeKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to update fee payment"),
  });
}

export function useDeleteFeePayment() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string | number>({
    mutationFn: (id) => fetchJson<{ ok: boolean }>(`/api/dashboard/fees/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      getToast().success("Fee payment deleted");
      qc.invalidateQueries({ queryKey: feeKeys.all });
      qc.invalidateQueries({ queryKey: feeKeys.stats });
    },
    onError: (err) => getToast().error(err.message || "Failed to delete"),
  });
}
