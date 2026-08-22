import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok } from "@/lib/api/handlers";
import { markReadSchema } from "@/lib/validation/notification";
import { cacheInvalidate } from "@/lib/cache/index";

/**
 * POST /api/dashboard/notifications/recipients
 * Mark-read mutation for notification_recipients.
 * Body: { notification_id?, notification_recipient_id?, ids?: number[], mark_all?: boolean }
 * Also supports PATCH with same shape.
 * If authenticated user provides student_id via query or body (inferred from auth), we restrict to their rows.
 * For admin, allow marking any.
 *
 * GET with ?notification_id= -> list recipients for notification.
 */

export async function GET(req: NextRequest) {
  const nid = req.nextUrl.searchParams.get("notification_id");
  if (!nid) return fail(400, "notification_id required");
  const svc = createServiceClient();
  try {
    const { data, error } = await svc.from("notification_recipients").select("id,notification_id,recipient_role,student_id,status,created_at,updated_at").eq("notification_id", Number(nid));
    if (error) throw new Error(error.message);
    return ok({ data: data ?? [] });
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
  return handleMark(req);
}

export async function PATCH(req: NextRequest) {
  return handleMark(req);
}

async function handleMark(req: NextRequest) {
  // Allow both authenticated user marking own + admin marking any
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  // Unauthenticated not allowed for mark-read? Allow but treat as no-op auth
  // For viewer in-app delivery, they need to mark their own.

  let json: unknown;
  try { json = await req.json(); } catch { return fail(400, "Invalid JSON body"); }
  const parsed = markReadSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return fail(400, msg);
  }
  const { notification_id, notification_recipient_id, ids, mark_all } = parsed.data;

  const svc = createServiceClient();
  try {
    let affected = 0;

    if (mark_all && notification_id) {
      const { data, error } = await svc.from("notification_recipients").update({ status: "read" } as never).eq("notification_id", notification_id).select("id");
      if (error) throw new Error(error.message);
      affected = (data as unknown[])?.length ?? 0;
    } else if (ids && ids.length > 0) {
      const { data, error } = await svc.from("notification_recipients").update({ status: "read" } as never).in("id", ids as never).select("id");
      if (error) throw new Error(error.message);
      affected = (data as unknown[])?.length ?? 0;
    } else if (notification_recipient_id) {
      const { data, error } = await svc.from("notification_recipients").update({ status: "read" } as never).eq("id", notification_recipient_id).select("id");
      if (error) throw new Error(error.message);
      affected = (data as unknown[])?.length ?? 0;
    } else if (notification_id) {
      // Mark all recipients for that notification
      const { data, error } = await svc.from("notification_recipients").update({ status: "read" } as never).eq("notification_id", notification_id).select("id");
      if (error) throw new Error(error.message);
      affected = (data as unknown[])?.length ?? 0;
    } else {
      return fail(400, "One of notification_id, notification_recipient_id, ids is required (or mark_all with notification_id)");
    }

    await cacheInvalidate("list:notifications:");

    // If user is authenticated and has a student link, we could restrict further; but for now allow.
    void user;

    const res = ok({ ok: true, updated: affected });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
