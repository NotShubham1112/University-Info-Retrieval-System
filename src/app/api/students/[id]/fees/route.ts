import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCachedOrSet, CACHE_TTL } from "@/lib/cache/index";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sid = Number(id);
  if (!Number.isFinite(sid)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const cacheKey = `profile:fees:${sid}`;

  try {
    const data = await getCachedOrSet(cacheKey, CACHE_TTL.profile, async () => {
      const supabase = await createServerClient();
      // v4: fee_payments + fee_category_rates (was student_fees + fee_structures + payments)
      const { data, error } = await supabase
        .from("fee_payments")
        .select(
          "id,status,amount_due,amount_paid,transaction_id,payment_date,payment_mode,fee_category_rates!left(fee_type,amount,academic_year,year_of_study)",
        )
        .eq("student_id", sid)
        .order("payment_date", { ascending: false })
        .limit(50);
      if (error) throw error;

      // normalize to shape expected by old fees-tab (status, amount_due, fee_structures, payments)
      return (data ?? []).map((r: any) => ({
        id: r.id,
        status: r.status,
        amount_due: r.amount_due,
        amount_paid: r.amount_paid,
        transaction_id: r.transaction_id,
        payment_date: r.payment_date,
        payment_mode: r.payment_mode,
        fee_type: r.fee_category_rates?.fee_type ?? "Tuition",
        fee_amount: r.fee_category_rates?.amount ?? r.amount_due,
        academic_year: r.fee_category_rates?.academic_year ?? null,
        // compat fields for old tab
        fee_structures: r.fee_category_rates ? { fee_type: r.fee_category_rates.fee_type, amount: r.fee_category_rates.amount } : null,
        payments: r.transaction_id ? [{ id: r.id, amount: r.amount_paid, payment_date: r.payment_date }] : [],
      }));
    });

    const res = NextResponse.json(data);
    res.headers.set("Cache-Control", `public, max-age=${CACHE_TTL.profile}, stale-while-revalidate=30`);
    return res;
  } catch (e: any) {
    console.warn("[fees] fallback empty:", e?.message);
    return NextResponse.json([]);
  }
}
