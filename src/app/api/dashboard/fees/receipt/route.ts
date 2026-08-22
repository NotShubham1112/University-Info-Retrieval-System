import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { receiptQuerySchema } from "@/lib/validation/fee";
import { getCachedOrSet, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { parseQuery } from "@/lib/api/handlers";

/**
 * GET /api/dashboard/fees/receipt?fee_payment_id=1 | ?transaction_id=TXN-... | ?student_id=1
 * Receipt is derived from fee_payments row (no separate table).
 * Returns receipt_no, balance_due, etc.
 */

export async function GET(req: NextRequest) {
  const parsed = parseQuery(receiptQuerySchema, req.nextUrl.searchParams);
  if (!parsed.success) return parsed.response;
  const { fee_payment_id, student_id, transaction_id } = parsed.data as {
    fee_payment_id?: number | null; student_id?: number | null; transaction_id?: string | null;
  };
  if (!fee_payment_id && !student_id && !transaction_id) {
    return fail(400, "One of fee_payment_id, student_id, transaction_id is required");
  }

  const cacheKey = buildCacheKey("GET", "/api/dashboard/fees/receipt", {
    fee_payment_id: fee_payment_id ?? "", student_id: student_id ?? "", transaction_id: transaction_id ?? "",
  });
  const prefixedKey = `list:fees:receipt:${cacheKey}`;

  try {
    const result = await getCachedOrSet(prefixedKey, CACHE_TTL.reference, async () => {
      const svc = createServiceClient();
      let query = svc.from("fee_payments").select("id,student_id,fee_category_rate_id,amount_due,amount_paid,status,transaction_id,payment_date,payment_mode,created_at,updated_at,students(first_name,last_name),fee_category_rates(fee_type,amount,academic_year,courses(branch_or_course))");
      if (fee_payment_id) query = query.eq("id", fee_payment_id);
      else if (transaction_id) query = query.eq("transaction_id", transaction_id);
      else if (student_id) query = query.eq("student_id", student_id).order("payment_date", { ascending: false }).limit(1);
      else query = query.limit(1);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
      const row = Array.isArray(data) && !fee_payment_id && !transaction_id ? rows[0] : (rows[0] ?? null);
      // Handle single vs array
      let target: Record<string, unknown> | null = null;
      if (Array.isArray(data)) {
        // when querying by id, still returns array of 1
        target = (data as unknown[])[0] as Record<string, unknown> | null ?? null;
        if (!target && rows.length > 0) target = rows[0];
      } else {
        target = data as unknown as Record<string, unknown> | null;
      }
      // Alternative single fetch path
      if (!target) {
        // try maybeSingle path for id
        if (fee_payment_id) {
          const { data: single } = await svc.from("fee_payments").select("id,student_id,fee_category_rate_id,amount_due,amount_paid,status,transaction_id,payment_date,payment_mode,created_at,updated_at").eq("id", fee_payment_id).maybeSingle();
          if (single) target = single as unknown as Record<string, unknown>;
        } else if (transaction_id) {
          const { data: single } = await svc.from("fee_payments").select("id,student_id,fee_category_rate_id,amount_due,amount_paid,status,transaction_id,payment_date,payment_mode,created_at,updated_at").eq("transaction_id", transaction_id).maybeSingle();
          if (single) target = single as unknown as Record<string, unknown>;
        }
      }
      if (!target) return { receipt: null };

      const t = target as Record<string, unknown> & {
        students?: { first_name: string; last_name: string } | null;
        fee_category_rates?: { fee_type: string; academic_year: string; courses?: { branch_or_course: string } | null } | null;
      };
      const amount_due = Number(t["amount_due"] ?? 0);
      const amount_paid = Number(t["amount_paid"] ?? 0);
      const balance = Math.max(0, amount_due - amount_paid);
      const receipt_no = `RCP-${String(t["id"]).padStart(6, "0")}-${String(t["transaction_id"] ?? "NA").slice(-6)}`;

      const receipt = {
        ...t,
        receipt_no,
        balance_due: balance,
        fee_type: t.fee_category_rates?.fee_type ?? null,
        academic_year: t.fee_category_rates?.academic_year ?? null,
        student_name: t.students ? `${t.students.first_name} ${t.students.last_name}` : null,
      };
      return { receipt };
    });

    if (!result || (result as { receipt: unknown }).receipt === null) {
      return fail(404, "receipt not found", "NOT_FOUND");
    }
    const res = ok(result);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.reference));
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
