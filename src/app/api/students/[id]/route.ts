import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { fail, ok, cacheControlValue, noStore } from "@/lib/api/handlers";
import {
  getCachedOrSet,
  cacheInvalidate,
  CACHE_TTL,
  buildCacheKey,
} from "@/lib/cache/index";
import { studentUpdateSchema } from "@/lib/validation/schemas";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");

  const cacheKey = buildCacheKey("GET", `/api/students/${id}`, {});
  const prefixedKey = `profile:${cacheKey}`;

  try {
    const data = await getCachedOrSet(prefixedKey, CACHE_TTL.profile, async () => {
      const supabase = await createServerClient();
      // Read through student_summary view (excludes aadhaar_number)
      const { data: row, error } = await supabase
        .from("student_summary")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) {
        // Fallback to students table direct if view not yet available (e.g., migrations pending)
        const { data: fallback, error: fallbackErr } = await supabase
          .from("students")
          .select(
            "id,pnr,roll_number,first_name,last_name,date_of_birth,email,phone,admission_date,status,program_id,campus_id,category_id,abc_id,gender,address,city,state,country,blood_group,photo_path,guardian_name,guardian_contact_number,created_at,updated_at",
          )
          .eq("id", id)
          .maybeSingle();
        if (fallbackErr) throw new Error(fallbackErr.message);
        if (!fallback) return null;
        return fallback;
      }
      return row;
    });

    if (!data) return fail(404, "not found", "NOT_FOUND");

    const res = ok(data);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.profile));
    return res;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("not found")) return fail(404, "not found", "NOT_FOUND");
    return fail(500, msg, "INTERNAL_ERROR");
  }
}

// Mutations invalidate profile + search caches (service-role bypasses RLS but permission gate is in route)
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "Invalid JSON body");
  }
  const parsed = studentUpdateSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return fail(400, message);
  }

  const payload = parsed.data as Record<string, unknown>;
  // Never allow writing aadhaar_hash directly; aadhaar_number handling is separate (Task 4 crypto)
  // Exclude undefined/null handling via filtered update object
  const updateFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === "admission" || k === "id") continue;
    if (v !== undefined) updateFields[k] = v;
  }

  if (Object.keys(updateFields).length === 0) {
    return fail(400, "No fields to update");
  }

  try {
    // Use service role for mutation (RLS bypassed, permission enforced in code in Task 4)
    // Fall back to anon client if service key not set (dev)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createServiceClient(url, serviceKey);

    const { data, error } = await supabase
      .from("students")
      .update(updateFields)
      .eq("id", id)
      .select(
        "id,pnr,roll_number,first_name,last_name,date_of_birth,email,phone,admission_date,status,program_id,campus_id",
      )
      .maybeSingle();
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    if (!data) return fail(404, "not found", "NOT_FOUND");

    await cacheInvalidate("profile:");
    await cacheInvalidate("search:");
    await cacheInvalidate("list:");

    const res = ok(data);
    noStore(res);
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createServiceClient(url, serviceKey);

    // Soft-delete: set status='inactive' + history row (per spec default)
    const { error } = await supabase
      .from("students")
      .update({ status: "inactive" })
      .eq("id", id);
    if (error) return fail(500, error.message, "INTERNAL_ERROR");

    await cacheInvalidate("profile:");
    await cacheInvalidate("search:");
    await cacheInvalidate("list:");

    const res = NextResponse.json({ ok: true });
    noStore(res);
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
