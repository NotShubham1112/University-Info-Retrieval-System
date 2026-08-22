import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok } from "@/lib/api/handlers";
import { assertPermissionOrFail } from "@/lib/admin";
import { attendanceBulkRowSchema, parseCsvText } from "@/lib/validation/attendance";
import { cacheInvalidate } from "@/lib/cache/index";

const BATCH = 100;
const ATTENDANCE_TABLE = "attendance_records";

export async function POST(req: NextRequest) {
  const auth = await createServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "attendance:write");
  if (denied) return denied;

  let csvText = "";
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (file) csvText = await file.text();
    else csvText = String(form.get("csvText") ?? "");
  } else if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    csvText = await req.text();
  } else {
    try {
      const json = (await req.json()) as Record<string, unknown>;
      csvText = String(json["csvText"] ?? "");
      if (!csvText && Array.isArray(json["rows"])) {
        return handleJsonRows(json["rows"] as Record<string, unknown>[]);
      }
    } catch {
      csvText = await req.text().catch(() => "");
    }
  }

  if (!csvText || csvText.trim().length === 0) return fail(400, "csvText or file is required (CSV with headers: student_id,course_id,date,status[,subject_id])");

  const { headers, rows } = parseCsvText(csvText);
  if (headers.length === 0) return fail(400, "Empty CSV");
  if (rows.length === 0) return fail(400, "CSV has no data rows");

  // Per-row validation like student import
  const valid: Array<{ rowNumber: number; data: Record<string, unknown> }> = [];
  const failed: Array<{ row: number; error: string }> = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = k.trim().toLowerCase();
      const val = (v ?? "").trim();
      normalized[key] = val === "" ? undefined : val;
    }
    const result = attendanceBulkRowSchema.safeParse({ ...normalized, row: rowNumber } as unknown as Record<string, unknown>);
    // attendanceBulkRowSchema expects course_id, date, status, student_id; subject_id optional extra?
    // extended check for subject_id passthrough
    if (!result.success) {
      const msg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      failed.push({ row: rowNumber, error: msg });
    } else {
      const data = result.data as unknown as Record<string, unknown>;
      // Preserve subject_id if present in CSV (not in base schema)
      const subjRaw = normalized["subject_id"];
      if (subjRaw !== undefined) {
        const sid = Number(subjRaw);
        if (!Number.isNaN(sid)) data["subject_id"] = sid;
      }
      valid.push({ rowNumber, data });
    }
  });

  if (valid.length === 0) return ok({ inserted: 0, updated: 0, failed });

  const svc = createServiceClient();
  let inserted = 0;
  let updated = 0;
  const batchFailed: Array<{ row: number; error: string }> = [];

  // Batch upsert
  for (let i = 0; i < valid.length; i += BATCH) {
    const slice = valid.slice(i, i + BATCH);
    const upsertRows = slice.map(({ data }) => ({
      student_id: Number(data["student_id"]),
      course_id: Number(data["course_id"]),
      subject_id: data["subject_id"] !== undefined && data["subject_id"] !== null ? Number(data["subject_id"]) : null,
      date: String(data["date"]),
      status: String(data["status"]),
    }));

    try {
      // Try per-row conflict handling: upsert with onConflict; need to know if table exists
      const { data, error } = await svc.from(ATTENDANCE_TABLE as never).upsert(upsertRows as never, { onConflict: "student_id,course_id,date" } as never).select("id") as unknown as { data: unknown[] | null; error: { message: string } | null };
      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        if (msg.includes("does not exist") || msg.includes("relation")) {
          // Report all as failed with guidance
          slice.forEach(({ rowNumber }) => batchFailed.push({ row: rowNumber, error: `attendance_records table not found: ${error.message}` }));
          continue;
        }
        // Try row-by-row to isolate
        for (let j = 0; j < upsertRows.length; j++) {
          const one = upsertRows[j];
          const rowNum = slice[j].rowNumber;
          const { error: e2 } = await svc.from(ATTENDANCE_TABLE as never).upsert([one] as never, { onConflict: "student_id,course_id,date" } as never) as unknown as { error: { message: string } | null };
          if (e2) batchFailed.push({ row: rowNum, error: e2.message });
          else inserted++;
        }
        continue;
      }
      inserted += data?.length ?? upsertRows.length;
      // Simplistic: count all as inserted; updated would require detecting existed rows
      void updated;
    } catch (e) {
      const msg = (e as Error).message;
      slice.forEach(({ rowNumber }) => batchFailed.push({ row: rowNumber, error: msg }));
    }
  }

  const allFailed = [...failed, ...batchFailed];
  await cacheInvalidate("list:attendance:");
  await cacheInvalidate("list:");
  await cacheInvalidate("stats:");
  // Not synchronous refresh_report_views; documented lazy.

  const res = ok({ inserted, updated, failed: allFailed });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function handleJsonRows(rows: Record<string, unknown>[]) {
  const svc = createServiceClient();
  const valid: Record<string, unknown>[] = [];
  const failed: Array<{ row: number; error: string }> = [];
  rows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    const result = attendanceBulkRowSchema.safeParse({ ...raw, row: rowNumber } as unknown as Record<string, unknown>);
    if (!result.success) failed.push({ row: rowNumber, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    else valid.push(result.data as unknown as Record<string, unknown>);
  });
  if (valid.length === 0) return ok({ inserted: 0, updated: 0, failed });
  let inserted = 0;
  for (let i = 0; i < valid.length; i += BATCH) {
    const slice = valid.slice(i, i + BATCH);
    const upsertRows = slice.map((d) => ({
      student_id: Number(d["student_id"]),
      course_id: Number(d["course_id"]),
      subject_id: d["subject_id"] !== undefined ? Number(d["subject_id"]) : null,
      date: String(d["date"]),
      status: String(d["status"]),
    }));
    const { error } = await svc.from("attendance_records" as never).upsert(upsertRows as never, { onConflict: "student_id,course_id,date" } as never) as unknown as { error: { message: string } | null };
    if (error) {
      failed.push(...slice.map((_, idx) => ({ row: i + idx + 1, error: error.message })));
    } else inserted += slice.length;
  }
  await cacheInvalidate("list:attendance:");
  await cacheInvalidate("list:");
  return ok({ inserted, updated: 0, failed });
}
