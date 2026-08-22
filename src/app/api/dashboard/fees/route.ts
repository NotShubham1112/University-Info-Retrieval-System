import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseQuery, fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { feePaymentSchema } from "@/lib/validation/fee";
import { feeListQuerySchema, feeCategoryRateCreateSchema } from "@/lib/validation/fee";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";

/**
 * GET /api/dashboard/fees
 * Query params: q, limit, cursor, student_id, status, academic_year, fee_category_rate_id
 * Supports two modes:
 *  - payments: default, returns fee_payments list (fees:read)
 *  - rates: when ?view=rates, returns fee_category_rates
 * Also handles ?report=pending via mv_fee_collection
 *
 * POST /api/dashboard/fees
 * Creates fee_payment (fees:approve) or fee_category_rate when body has course_id+fee_type
 */

const PAYMENT_COLUMNS = "id,student_id,fee_category_rate_id,scholarship_application_id,amount_due,amount_paid,status,transaction_id,payment_date,payment_mode,created_at,updated_at";
const RATE_COLUMNS = "id,course_id,year_of_study,academic_year,fee_type,amount,created_at,updated_at";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const view = url.searchParams.get("view");
  const report = url.searchParams.get("report");

  if (view === "rates") {
    // Return fee_category_rates with cache
    const q = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const cursor = url.searchParams.get("cursor");
    const course_id = url.searchParams.get("course_id");
    const academic_year = url.searchParams.get("academic_year");
    const cacheKey = buildCacheKey("GET", "/api/dashboard/fees", { view, q, limit, cursor: cursor ?? "", course_id: course_id ?? "", academic_year: academic_year ?? "" });
    const prefixedKey = `list:fees:rates:${cacheKey}`;
    try {
      const result = await getCachedOrSet(prefixedKey, CACHE_TTL.reference, async () => {
        const svc = createServiceClient();
        let query = svc.from("fee_category_rates").select(RATE_COLUMNS);
        if (course_id) query = query.eq("course_id", Number(course_id));
        if (academic_year) query = query.eq("academic_year", academic_year);
        if (q && q.trim().length > 0) query = query.or(`fee_type.ilike.%${q.trim()}%,academic_year.ilike.%${q.trim()}%`);
        if (cursor) {
          const c = Number(cursor);
          if (!Number.isNaN(c)) query = query.gt("id", c);
        }
        query = query.order("id", { ascending: true }).limit(Number.isFinite(limit) ? limit : 20);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as unknown as Array<{ id: number } & Record<string, unknown>>;
        const nextCursor = rows.length === (Number.isFinite(limit) ? limit : 20) ? String(rows[rows.length - 1].id) : null;
        return { data: rows, nextCursor };
      });
      const res = ok(result);
      res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.reference));
      return res;
    } catch (e) {
      return fail(500, (e as Error).message, "INTERNAL_ERROR");
    }
  }

  if (report === "pending") {
    // Pending fees report from mv_fee_collection
    const cacheKey = "list:fees:report:pending";
    try {
      const result = await getCachedOrSet(cacheKey, CACHE_TTL.list, async () => {
        const svc = createServiceClient();
        // Try mv first
        try {
          const { data, error } = await svc.from("mv_fee_collection").select("*");
          if (!error && data) {
            return { data: data as unknown[], source: "mv_fee_collection" };
          }
        } catch {}
        // Fallback: live aggregation from fee_payments + fee_category_rates
        const { data, error } = await svc.from("fee_payments").select("id,amount_due,amount_paid,status,fee_category_rate_id,fee_category_rates(course_id,academic_year)").eq("status", "unpaid").limit(1000) as unknown as { data: unknown[] | null; error: { message: string } | null };
        if (error) throw new Error(error.message);
        return { data: data ?? [], source: "live" };
      });
      const res = ok(result);
      res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.list));
      return res;
    } catch (e) {
      return fail(500, (e as Error).message, "INTERNAL_ERROR");
    }
  }

  // Default: payments list
  const parsed = parseQuery(feeListQuerySchema, url.searchParams);
  if (!parsed.success) return parsed.response;
  const { q, limit, cursor, student_id, status, academic_year, fee_category_rate_id } = parsed.data as {
    q: string; limit: number; cursor?: string | null; student_id?: number | null; status?: string | null; academic_year?: string | null; fee_category_rate_id?: number | null;
  };

  const cacheKey = buildCacheKey("GET", "/api/dashboard/fees", {
    q: q ?? "", limit, cursor: cursor ?? "", student_id: student_id ?? "", status: status ?? "", academic_year: academic_year ?? "", fee_category_rate_id: fee_category_rate_id ?? "",
  });
  const prefixedKey = `list:fees:${cacheKey}`;

  // fees:read gate (allow both authenticated reads? spec says fees:read for reads)
  try {
    const result = await getCachedOrSet(prefixedKey, CACHE_TTL.reference, async () => {
      const svc = createServiceClient();
      let query = svc.from("fee_payments").select(`${PAYMENT_COLUMNS},students(first_name,last_name),fee_category_rates(fee_type,course_id,academic_year)`);
      if (student_id) query = query.eq("student_id", student_id);
      if (status) query = query.eq("status", status);
      if (fee_category_rate_id) query = query.eq("fee_category_rate_id", fee_category_rate_id);
      if (q && q.trim().length > 0) {
        // search by transaction_id
        query = query.or(`transaction_id.ilike.%${q.trim()}%`);
      }
      // academic_year filter via join — fetch and filter post if needed
      if (cursor) {
        const c = Number(cursor);
        if (!Number.isNaN(c)) query = query.gt("id", c);
      }
      query = query.order("id", { ascending: true }).limit(limit);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      let rows = (data ?? []) as unknown as Array<{ id: number; fee_category_rates: { fee_type: string; academic_year: string } | null; students: { first_name: string; last_name: string } | null } & Record<string, unknown>>;
      if (academic_year) {
        rows = rows.filter((r) => {
          const fr = r.fee_category_rates as unknown as { academic_year: string } | null;
          return fr?.academic_year === academic_year;
        });
      }
      const normalized = rows.map((r) => ({
        ...r,
        student_name: r.students ? `${r.students.first_name} ${r.students.last_name}` : null,
        fee_type: (r.fee_category_rates as unknown as { fee_type: string } | null)?.fee_type ?? null,
      }));
      const nextCursor = rows.length === limit ? String(rows[rows.length - 1].id) : null;
      return { data: normalized, nextCursor };
    });
    const res = ok(result);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.reference));
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");

  // Determine intent: if body has course_id+amount+academic_year => fee_category_rate, else fee_payment
  let json: unknown;
  try { json = await req.json(); } catch { return fail(400, "Invalid JSON body"); }
  const raw = json as Record<string, unknown>;

  // Fee category rate creation path — needs course:write or fees:approve?
  if (raw["course_id"] !== undefined && raw["academic_year"] !== undefined && raw["amount"] !== undefined && raw["student_id"] === undefined) {
    const denied = assertPermissionOrFail(user, "fees:approve");
    if (denied) {
      const d2 = assertPermissionOrFail(user, "course:write");
      if (d2) return denied;
    }
    const parsed = feeCategoryRateCreateSchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return fail(400, msg);
    }
    const svc = createServiceClient();
    try {
      const { data, error } = await svc.from("fee_category_rates").insert(parsed.data as never).select(RATE_COLUMNS).single();
      if (error) return fail(500, error.message, "INTERNAL_ERROR");
      await cacheInvalidate("list:fees:");
      await cacheInvalidate("list:");
      await cacheInvalidate("stats:");
      const res = ok(data);
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (e) {
      return fail(500, (e as Error).message, "INTERNAL_ERROR");
    }
  }

  // Fee payment path
  const denied = assertPermissionOrFail(user, "fees:approve");
  if (denied) return denied;

  const parsed = feePaymentSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return fail(400, msg);
  }
  const payload = parsed.data;
  const svc = createServiceClient();

  // Validate student exists
  const { data: student } = await svc.from("students").select("id").eq("id", payload.student_id).maybeSingle();
  if (!student) return fail(400, `student_id not found: ${payload.student_id}`);
  if (payload.fee_category_rate_id) {
    const { data: rate } = await svc.from("fee_category_rates").select("id").eq("id", payload.fee_category_rate_id).maybeSingle();
    if (!rate) return fail(400, `fee_category_rate_id not found: ${payload.fee_category_rate_id}`);
  }
  if (payload.scholarship_application_id) {
    const { data: sch } = await svc.from("scholarship_applications").select("id").eq("id", payload.scholarship_application_id).maybeSingle();
    if (!sch) return fail(400, `scholarship_application_id not found: ${payload.scholarship_application_id}`);
  }

  // Generate transaction_id if missing and status paid/partial
  let transactionId = payload.transaction_id as string | null | undefined;
  if (!transactionId && (payload.status === "paid" || payload.status === "partial")) {
    transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
  }

  const insertRow: Record<string, unknown> = {
    student_id: payload.student_id,
    fee_category_rate_id: payload.fee_category_rate_id ?? null,
    scholarship_application_id: payload.scholarship_application_id ?? null,
    amount_due: payload.amount_due,
    amount_paid: payload.amount_paid ?? 0,
    status: payload.status ?? "unpaid",
    transaction_id: transactionId ?? null,
    payment_date: payload.payment_date ?? (payload.status === "paid" ? new Date().toISOString().slice(0, 10) : null),
    payment_mode: payload.payment_mode ?? null,
  };

  try {
    const { data, error } = await svc.from("fee_payments").insert(insertRow as never).select(PAYMENT_COLUMNS).single();
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
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
