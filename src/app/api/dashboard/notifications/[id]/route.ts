import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

const COLUMNS = "id,title,body,type,priority,channel,sent_at,created_at,updated_at";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const cacheKey = buildCacheKey("GET", `/api/dashboard/notifications/${id}`, {});
  const prefixedKey = `list:notifications:${cacheKey}`;
  try {
    const data = await getCachedOrSet(prefixedKey, CACHE_TTL.list, async () => {
      const svc = createServiceClient();
      const { data: row, error } = await svc.from("notifications").select(COLUMNS).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) return null;
      let recipients: unknown = [];
      try {
        const { data: recs } = await svc.from("notification_recipients").select("id,notification_id,recipient_role,student_id,status,created_at,updated_at").eq("notification_id", id);
        recipients = recs ?? [];
      } catch {}
      return { ...(row as Record<string, unknown>), recipients };
    });
    if (!data) return fail(404, "not found", "NOT_FOUND");
    const res = ok(data);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.list));
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "notification:send");
  if (denied) return denied;
  let json: unknown;
  try { json = await req.json(); } catch { return fail(400, "Invalid JSON body"); }
  const raw = json as Record<string, unknown>;
  const allowed = ["title", "body", "type", "priority", "channel"];
  const updateFields: Record<string, unknown> = {};
  for (const k of allowed) if (raw[k] !== undefined) updateFields[k] = raw[k];
  if (Object.keys(updateFields).length === 0) return fail(400, "No fields to update");
  if (updateFields["type"]) {
    const allowedTypes = ["general", "academic", "fee", "exam", "admin"];
    let t = String(updateFields["type"]);
    if (!allowedTypes.includes(t)) t = "general";
    updateFields["type"] = t;
  }
  if (updateFields["priority"]) {
    const allowedP = ["low", "normal", "high", "urgent"];
    let p = String(updateFields["priority"]);
    if (!allowedP.includes(p)) p = "normal";
    updateFields["priority"] = p;
  }
  if (updateFields["channel"]) {
    const allowedC = ["in_app", "email", "sms"];
    let c = String(updateFields["channel"]);
    if (!allowedC.includes(c)) c = "in_app";
    updateFields["channel"] = c;
  }
  const svc = createServiceClient();
  try {
    const { data, error } = await svc.from("notifications").update(updateFields as never).eq("id", id).select(COLUMNS).maybeSingle();
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    if (!data) return fail(404, "not found", "NOT_FOUND");
    await cacheInvalidate("list:notifications:");
    await cacheInvalidate("list:");
    const res = ok(data);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "notification:send");
  if (denied) return denied;
  const svc = createServiceClient();
  try {
    const { error } = await svc.from("notifications").delete().eq("id", id);
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    await cacheInvalidate("list:notifications:");
    await cacheInvalidate("list:");
    const res = ok({ ok: true });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
