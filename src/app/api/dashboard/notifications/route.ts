import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseQuery, parseBody, fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { notificationCreateSchema } from "@/lib/validation/schemas";
import { notificationListQuerySchema } from "@/lib/validation/notification";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

const COLUMNS = "id,title,body,type,priority,channel,sent_at,created_at,updated_at";

export async function GET(req: NextRequest) {
  const parsed = parseQuery(notificationListQuerySchema, req.nextUrl.searchParams);
  if (!parsed.success) return parsed.response;
  const { q, limit, cursor, type, channel, priority, student_id, recipient_role, status } = parsed.data as {
    q: string; limit: number; cursor?: string | null; type?: string | null; channel?: string | null; priority?: string | null; student_id?: number | null; recipient_role?: string | null; status?: string | null;
  };

  // If filtering by recipient, we need to join recipients
  const useRecipientFilter = !!(student_id || recipient_role || status);

  const cacheKey = buildCacheKey("GET", "/api/dashboard/notifications", {
    q: q ?? "", limit, cursor: cursor ?? "", type: type ?? "", channel: channel ?? "", priority: priority ?? "", student_id: student_id ?? "", recipient_role: recipient_role ?? "", status: status ?? "",
  });
  const prefixedKey = `list:notifications:${cacheKey}`;

  try {
    const result = await getCachedOrSet(prefixedKey, CACHE_TTL.list, async () => {
      const svc = createServiceClient();

      if (useRecipientFilter) {
        // Resolve notification ids from recipients then fetch notifications
        let recQuery = svc.from("notification_recipients").select("notification_id");
        if (student_id) recQuery = recQuery.eq("student_id", student_id);
        if (recipient_role) recQuery = recQuery.eq("recipient_role", recipient_role);
        if (status) recQuery = recQuery.eq("status", status);
        // Need distinct ids
        const { data: recs, error: recErr } = await recQuery as unknown as { data: Array<{ notification_id: number }> | null; error: { message: string } | null };
        if (recErr) throw new Error(recErr.message);
        const ids = [...new Set((recs ?? []).map((r) => r.notification_id))];
        if (ids.length === 0) return { data: [], nextCursor: null };
        // Fetch notifications for those ids, with pagination
        let query = svc.from("notifications").select(COLUMNS).in("id", ids as never);
        if (q && q.trim().length > 0) query = query.or(`title.ilike.%${q.trim()}%,body.ilike.%${q.trim()}%`);
        if (type) query = query.eq("type", type);
        if (channel) query = query.eq("channel", channel);
        if (priority) query = query.eq("priority", priority);
        if (cursor) {
          const c = Number(cursor);
          if (!Number.isNaN(c)) query = query.gt("id", c);
        }
        query = query.order("id", { ascending: true }).limit(limit);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as unknown as Array<{ id: number } & Record<string, unknown>>;
        const nextCursor = rows.length === limit ? String(rows[rows.length - 1].id) : null;
        return { data: rows, nextCursor };
      }

      let query = svc.from("notifications").select(COLUMNS);
      if (q && q.trim().length > 0) {
        const term = q.trim();
        query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
      }
      if (type) query = query.eq("type", type);
      if (channel) query = query.eq("channel", channel);
      if (priority) query = query.eq("priority", priority);
      if (cursor) {
        const c = Number(cursor);
        if (!Number.isNaN(c)) query = query.gt("id", c);
      }
      query = query.order("id", { ascending: true }).limit(limit);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<{ id: number } & Record<string, unknown>>;
      const nextCursor = rows.length === limit ? String(rows[rows.length - 1].id) : null;
      // Attach recipient counts
      let enriched = rows;
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        try {
          const { data: counts } = await svc.from("notification_recipients").select("notification_id,status").in("notification_id", ids as never) as unknown as { data: Array<{ notification_id: number; status: string }> | null };
          const map = new Map<number, { total: number; unread: number }>();
          (counts ?? []).forEach((c) => {
            const m = map.get(c.notification_id) ?? { total: 0, unread: 0 };
            m.total += 1;
            if (c.status === "unread") m.unread += 1;
            map.set(c.notification_id, m);
          });
          enriched = rows.map((r) => ({
            ...r,
            recipient_count: map.get(r.id)?.total ?? 0,
            unread_count: map.get(r.id)?.unread ?? 0,
          }));
        } catch {}
      }
      return { data: enriched, nextCursor };
    });
    const res = ok(result);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.list));
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "notification:send");
  if (denied) return denied;

  const parsed = await parseBody(notificationCreateSchema, req);
  if (!parsed.success) return parsed.response;
  const payload = parsed.data as Record<string, unknown>;

  const svc = createServiceClient();

  // Map priority/channel/type to DB enums (DB: type general/academic/fee/exam/admin; priority low/normal/high/urgent; channel in_app/email/sms)
  let dbType = String(payload["type"] ?? "general");
  const allowedTypes = ["general", "academic", "fee", "exam", "admin"];
  if (!allowedTypes.includes(dbType)) {
    const map: Record<string, string> = { info: "general", warning: "general", urgent: "general", event: "general" };
    dbType = map[dbType] ?? "general";
  }
  let dbPriority = String(payload["priority"] ?? "normal");
  const allowedPriorities = ["low", "normal", "high", "urgent"];
  if (!allowedPriorities.includes(dbPriority)) {
    const pmap: Record<string, string> = { medium: "normal", low: "low", high: "high" };
    dbPriority = pmap[dbPriority] ?? "normal";
  }
  let dbChannel = String(payload["channel"] ?? "in_app");
  const allowedChannels = ["in_app", "email", "sms"];
  if (!allowedChannels.includes(dbChannel)) dbChannel = "in_app";

  const nowIso = new Date().toISOString();

  const insertRow: Record<string, unknown> = {
    title: payload["title"],
    body: payload["body"],
    type: dbType,
    priority: dbPriority,
    channel: dbChannel,
    sent_at: nowIso,
  };

  try {
    const { data: notif, error } = await svc.from("notifications").insert(insertRow as never).select(COLUMNS).single();
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    const nid = (notif as { id: number }).id;

    // Determine recipients
    const recipientRole = payload["recipient_role"] as string | null | undefined;
    const studentIds = payload["student_ids"] as number[] | null | undefined;

    const recipientRows: Array<Record<string, unknown>> = [];
    if (recipientRole) {
      // Role recipient: single row with recipient_role
      recipientRows.push({ notification_id: nid, recipient_role: recipientRole, status: "unread" });
    }
    if (studentIds && studentIds.length > 0) {
      // Validate students exist
      const { data: students } = await svc.from("students").select("id").in("id", studentIds as never) as unknown as { data: Array<{ id: number }> | null };
      const validIds = new Set((students ?? []).map((s) => s.id));
      for (const sid of studentIds) {
        if (validIds.has(sid)) recipientRows.push({ notification_id: nid, student_id: sid, status: "unread" });
      }
      // If some invalid, warn but still create for valid ones
      const invalid = studentIds.filter((id) => !validIds.has(id));
      if (invalid.length > 0) console.warn("notification: invalid student_ids", invalid);
    }

    // If no explicit recipients, default behavior: broadcast to role if provided else no recipients (allow empty)
    if (recipientRows.length === 0) {
      // No recipients: still allow notification to exist (or optionally create viewer recipient)
      // We'll not auto-create; caller must specify. But if none, create a general 'viewer' recipient to ensure list still appears?
      // Keep empty for flexibility.
    } else {
      // Batch insert 500 at a time
      for (let i = 0; i < recipientRows.length; i += 500) {
        const slice = recipientRows.slice(i, i + 500);
        const { error: rErr } = await svc.from("notification_recipients").insert(slice as never);
        if (rErr) console.warn("notification_recipients insert failed:", rErr.message);
      }
    }

    await cacheInvalidate("list:notifications:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");

    // Channel placeholder: for email/sms just log (G8)
    if (dbChannel === "email" || dbChannel === "sms") {
      console.info(JSON.stringify({ notification: true, channel: dbChannel, notification_id: nid, status: "queued_placeholder", ts: nowIso }));
    }

    const res = ok({ ...notif as Record<string, unknown>, recipient_count: recipientRows.length });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
