"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NotificationRow, NotificationListResponse } from "@/lib/api/notifications";

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

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params: Record<string, string | number | null | undefined>) => ["notifications", "list", params] as const,
  detail: (id: string | number) => ["notifications", "detail", String(id)] as const,
  recipients: (id: string | number) => ["notifications", "recipients", String(id)] as const,
};

export interface UseNotificationsParams {
  q?: string;
  limit?: number;
  cursor?: string | null;
  type?: string | null;
  channel?: string | null;
  priority?: string | null;
}

export function useNotifications(params: UseNotificationsParams = {}) {
  const { q = "", limit = 20, cursor = null, type = null, channel = null, priority = null } = params;
  const qp: Record<string, string> = {};
  if (q) qp.q = q;
  if (limit) qp.limit = String(limit);
  if (cursor) qp.cursor = cursor;
  if (type) qp.type = type;
  if (channel) qp.channel = channel;
  if (priority) qp.priority = priority;
  const qs = new URLSearchParams(qp).toString();
  const url = `/api/dashboard/notifications${qs ? `?${qs}` : ""}`;
  return useQuery<NotificationListResponse>({
    queryKey: notificationKeys.list({ q, limit, cursor: cursor ?? "", type: type ?? "", channel: channel ?? "", priority: priority ?? "" }),
    queryFn: () => fetchJson<NotificationListResponse>(url),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}

export function useNotification(id: string | number | null | undefined) {
  return useQuery<NotificationRow & { recipients?: unknown[] }>({
    queryKey: notificationKeys.detail(id ?? ""),
    queryFn: () => fetchJson<NotificationRow & { recipients?: unknown[] }>(`/api/dashboard/notifications/${id}`),
    enabled: id !== null && id !== undefined && String(id).length > 0,
    staleTime: 30_000,
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation<NotificationRow, Error, Record<string, unknown>>({
    mutationFn: (payload) => fetchJson<NotificationRow>(`/api/dashboard/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: () => {
      getToast().success("Notification sent");
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (err) => getToast().error(err.message || "Failed to send notification"),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean; updated: number }, Error, { notification_id?: number; notification_recipient_id?: number; ids?: number[]; mark_all?: boolean }>({
    mutationFn: (payload) => fetchJson<{ ok: boolean; updated: number }>(`/api/dashboard/notifications/recipients`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    onSuccess: () => {
      getToast().success("Marked as read");
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (err) => getToast().error(err.message || "Failed to mark read"),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string | number>({
    mutationFn: (id) => fetchJson<{ ok: boolean }>(`/api/dashboard/notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      getToast().success("Notification deleted");
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (err) => getToast().error(err.message || "Failed to delete"),
  });
}
