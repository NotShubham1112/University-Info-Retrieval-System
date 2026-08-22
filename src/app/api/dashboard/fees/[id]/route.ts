import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { feePaymentSchema } from "@/lib/validation/fee";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

const PAYMENT_COLUMNS = "id,student_id,fee_category_rate_id,scholarship_application_id,amount_due,amount_paid,status,transaction_id,payment_date,payment_mode,created_at,updated_at";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const cacheKey = buildCacheKey("GET", `/api/dashboard/fees/${id}`, {});
  const prefixedKey = `list:fees:${cacheKey}`;
  try {
    const data = await getCachedOrSet(prefixedKey, CACHE_TTL.reference, async () => {
      const svc = createServiceClient();
      // Try fee_payments first
      const { data: row, error } = await svc.from("fee_payments").select(`${PAYMENT_COLUMNS},students(first_name,last_name)`).eq("id", id).maybeSingle();
      if (!error && row) {
        const r = row as unknown as Record<string, unknown> & { students: { first_name: string; last_name: string } | null };
        return { ...r, student_name: r.students ? `${r.students.first_name} ${r.students.last_name}` : null, kind: "payment" };
      }
      // Fallback: try fee_category_rates
      const { data: rate, error: rErr } = await svc.from("fee_category_rates").select("id,course_id,year_of_study,academic_year,fee_type,amount,created_at,updated_at").eq("id", id).maybeSingle();
      if (!rErr && rate) return { ...(rate as Record<string, unknown>), kind: "rate" };
      if (rErr && !row) throw new Error(rErr.message);
      return null;
    });
    if (!data) return fail(404, "not found", "NOT_FOUND");
    const res = ok(data);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.reference));
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
  const denied = assertPermissionOrFail(user, "fees:approve");
  if (denied) return denied;

  let json: unknown;
  try { json = await req.json(); } catch { return fail(400, "Invalid JSON body"); }
  const raw = json as Record<string, unknown>;

  // Determine if patching a rate (has course_id/academic_year) vs payment
  const isRatePatch = raw["course_id"] !== undefined || raw["academic_year"] !== undefined || raw["fee_type"] !== undefined || raw["year_of_study"] !== undefined;

  const svc = createServiceClient();
  try {
    if (isRatePatch) {
      const allowed = ["course_id", "year_of_study", "academic_year", "fee_type", "amount"];
      const updateFields: Record<string, unknown> = {};
      for (const k of allowed) if (raw[k] !== undefined) updateFields[k] = raw[k];
      if (Object.keys(updateFields).length === 0) return fail(400, "No fields to update");
      const { data, error } = await svc.from("fee_category_rates").update(updateFields as never).eq("id", id).select("id,course_id,year_of_study,academic_year,fee_type,amount,created_at,updated_at").maybeSingle();
      if (error) return fail(500, error.message, "INTERNAL_ERROR");
      if (!data) return fail(404, "not found", "NOT_FOUND");
      await cacheInvalidate("list:fees:");
      await cacheInvalidate("list:");
      const res = ok(data);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    // Payment patch
    const parsed = feePaymentSchema.partial().safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return fail(400, msg);
    }
    const payload = parsed.data as Record<string, unknown>;
    const updateFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) if (v !== undefined) updateFields[k] = v;
    if (Object.keys(updateFields).length === 0) return fail(400, "No fields to update");
    // Auto-set payment_date when marking paid
    if (updateFields["status"] === "paid" && !updateFields["payment_date"]) {
      updateFields["payment_date"] = new Date().toISOString().slice(0, 10);
    }
    if ((updateFields["status"] === "paid" || updateFields["status"] === "partial") && !updateFields["transaction_id"]) {
      // keep existing or generate
      const { data: cur } = await svc.from("fee_payments").select("transaction_id").eq("id", id).maybeSingle();
      if (!(cur as { transaction_id: string | null } | null)?.transaction_id) {
        updateFields["transaction_id"] = `TXN-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
      }
    }
    const { data, error } = await svc.from("fee_payments").update(updateFields as never).eq("id", id).select(PAYMENT_COLUMNS).maybeSingle();
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    if (!data) return fail(404, "not found", "NOT_FOUND");
    await cacheInvalidate("list:fees:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");
    try { await svc.rpc("refresh_report_views" as never); } catch {}
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
  const denied = assertPermissionOrFail(user, "fees:approve");
  if (denied) return denied;

  const svc = createServiceClient();
  try {
    // Try payments first
    const { error } = await svc.from("fee_payments").delete().eq("id", id);
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    await cacheInvalidate("list:fees:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");
    const res = ok({ ok: true });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
