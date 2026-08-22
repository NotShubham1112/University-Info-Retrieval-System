import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { studentUpdateSchema } from "@/lib/validation/schemas";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail, getUserRole } from "@/lib/admin";
import { encryptAadhaar, aadhaarHash } from "@/lib/crypto";
import { recordStudentStatusTransition } from "@/lib/admin";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SUMMARY_COLUMNS =
  "id,pnr,roll_number,first_name,last_name,search_name,date_of_birth,email,phone,admission_date,status,program_id,campus_id,category_id,abc_id,gender,address,city,state,country,blood_group,photo_path,guardian_name,guardian_contact_number,created_at,updated_at,admission_id,course_id,admission_mode,seat_type,intake_stream,expected_grad_year,current_semester,backlog_count,latest_semester_no,latest_sgpa,latest_result_status";

const DETAIL_SAFE_COLUMNS =
  "id,pnr,roll_number,first_name,last_name,search_name,date_of_birth,email,phone,admission_date,status,program_id,campus_id,category_id,abc_id,gender,address,city,state,country,blood_group,photo_path,guardian_name,guardian_contact_number,created_at,updated_at";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");

  const cacheKey = buildCacheKey("GET", `/api/dashboard/students/${id}`, {});
  const prefixedKey = `profile:${cacheKey}`;

  try {
    const data = await getCachedOrSet(prefixedKey, CACHE_TTL.profile, async () => {
      const svc = createServiceClient();
      const { data: row, error } = await svc.from("student_summary").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) {
        // Fallback direct
        const { data: fallback, error: fErr } = await svc.from("students").select(DETAIL_SAFE_COLUMNS).eq("id", id).maybeSingle();
        if (fErr) throw new Error(fErr.message);
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
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");

  const auth = await createServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "student:write");
  if (denied) return denied;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "Invalid JSON body");
  }
  const parsed = studentUpdateSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return fail(400, msg);
  }
  const payload = parsed.data as Record<string, unknown>;
  const admission = (payload["admission"] as Record<string, unknown> | null) ?? null;

  const updateFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === "admission" || k === "id") continue;
    if (v !== undefined) updateFields[k] = v;
  }

  // Aadhaar encryption if provided
  if (typeof updateFields["aadhaar_number"] === "string" && (updateFields["aadhaar_number"] as string).trim().length > 0) {
    const plain = (updateFields["aadhaar_number"] as string).trim();
    try {
      updateFields["aadhaar_number"] = encryptAadhaar(plain);
      updateFields["aadhaar_hash"] = aadhaarHash(plain);
    } catch (e) {
      return fail(400, `Aadhaar encryption failed: ${(e as Error).message}`);
    }
  } else if ("aadhaar_number" in updateFields) {
    // explicit null/empty -> do not update aadhaar columns
    delete updateFields["aadhaar_number"];
    delete updateFields["aadhaar_hash"];
  }

  // Keep search_name in sync if name changed
  if (updateFields["first_name"] || updateFields["last_name"]) {
    // Need current names if partial; fetch current row for search_name merge
    // We do optimistic: if both not present, skip
  }

  const svc = createServiceClient();

  // Fetch existing status for history
  let prevStatus: string | null = null;
  try {
    const { data: prev } = await svc.from("students").select("status").eq("id", id).maybeSingle();
    if (prev) prevStatus = (prev as { status: string }).status;
  } catch {}

  // Handle search_name recompute when only one of first/last changed
  if (updateFields["first_name"] !== undefined || updateFields["last_name"] !== undefined) {
    try {
      const { data: cur } = await svc.from("students").select("first_name,last_name").eq("id", id).maybeSingle();
      if (cur) {
        const fn = (updateFields["first_name"] as string) ?? (cur as { first_name: string }).first_name;
        const ln = (updateFields["last_name"] as string) ?? (cur as { last_name: string }).last_name;
        updateFields["search_name"] = `${fn} ${ln}`.trim().toLowerCase();
      }
    } catch {}
  }

  // If no student fields but admission present, still update admission
  const hasStudentFields = Object.keys(updateFields).length > 0;

  try {
    let updatedStudent: Record<string, unknown> | null = null;

    if (hasStudentFields) {
      const { data, error } = await svc.from("students").update(updateFields as never).eq("id", id).select(DETAIL_SAFE_COLUMNS).maybeSingle();
      if (error) return fail(500, error.message, "INTERNAL_ERROR");
      if (!data) return fail(404, "not found", "NOT_FOUND");
      updatedStudent = data as Record<string, unknown>;
    } else if (admission) {
      // No student fields; fetch student for response
      const { data } = await svc.from("students").select(DETAIL_SAFE_COLUMNS).eq("id", id).maybeSingle();
      updatedStudent = (data as Record<string, unknown>) ?? null;
    } else {
      return fail(400, "No fields to update");
    }

    // Update admissions if provided
    if (admission && Object.keys(admission).some((k) => admission[k] !== undefined && admission[k] !== null && String(admission[k]).trim() !== "")) {
      const admissionFields: Record<string, unknown> = {};
      for (const k of ["course_id", "academic_year_id", "admission_mode", "seat_type", "intake_stream", "expected_grad_year", "roll_number", "category_id"]) {
        const v = admission[k];
        if (v !== undefined && v !== null && String(v).trim() !== "") admissionFields[k] = v;
      }
      if (Object.keys(admissionFields).length > 0) {
        // Upsert: try update existing, else insert
        const { data: existing } = await svc.from("admissions").select("id").eq("student_id", id).maybeSingle();
        if (existing) {
          await svc.from("admissions").update(admissionFields as never).eq("student_id", id);
        } else if (admissionFields["course_id"]) {
          await svc.from("admissions").insert({ student_id: Number(id), ...admissionFields } as never);
        }
      }
    }

    // Status history when status changed
    const newStatus = (updateFields["status"] as string | undefined) ?? null;
    if (newStatus && prevStatus !== null && newStatus !== prevStatus) {
      try {
        await recordStudentStatusTransition({
          studentId: Number(id),
          fromStatus: prevStatus,
          toStatus: newStatus,
          changedBy: user.id ?? null,
          reason: "patch",
          supabase: svc,
        });
      } catch {}
    }

    await cacheInvalidate("profile:");
    await cacheInvalidate("search:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");

    const res = ok(updatedStudent ?? { id });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");

  const auth = await createServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const role = getUserRole(user as never);

  // Require student:delete for any delete (soft or hard)
  const denied = assertPermissionOrFail(user, "student:delete");
  if (denied) return denied;

  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "true";

  const svc = createServiceClient();

  if (hard) {
    if (role !== "super_admin") {
      return fail(403, "Hard delete requires super_admin", "FORBIDDEN");
    }
    const { error } = await svc.from("students").delete().eq("id", id);
    if (error) return fail(500, error.message, "INTERNAL_ERROR");
    await cacheInvalidate("profile:");
    await cacheInvalidate("search:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");
    const res = ok({ ok: true, hard: true });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // Soft delete: status='inactive' + history
  let prevStatus: string | null = null;
  try {
    const { data: prev } = await svc.from("students").select("status").eq("id", id).maybeSingle();
    if (prev) prevStatus = (prev as { status: string }).status;
  } catch {}

  const { error } = await svc.from("students").update({ status: "inactive" } as never).eq("id", id);
  if (error) return fail(500, error.message, "INTERNAL_ERROR");

  try {
    await recordStudentStatusTransition({
      studentId: Number(id),
      fromStatus: prevStatus,
      toStatus: "inactive",
      changedBy: user.id ?? null,
      reason: "soft-delete",
      supabase: svc,
    });
  } catch {}

  await cacheInvalidate("profile:");
  await cacheInvalidate("search:");
  await cacheInvalidate("list:");
  await cacheInvalidate("stats:");

  const res = ok({ ok: true });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
