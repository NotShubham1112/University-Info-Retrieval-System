import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok } from "@/lib/api/handlers";
import { assertPermissionOrFail } from "@/lib/admin";
import { parseCsvText, bulkStudentRowSchema } from "@/lib/validation/student";
import { encryptAadhaar, aadhaarHash } from "@/lib/crypto";
import { cacheInvalidate } from "@/lib/cache/index";

// CSV import: validate every row, skip invalid with per-row errors, BATCH 100 inserts, return {inserted, failed}

const BATCH = 100;

export async function POST(req: NextRequest) {
  const auth = await createServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "student:write");
  if (denied) return denied;

  let csvText = "";
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (file) {
      csvText = await file.text();
    } else {
      csvText = String(form.get("csvText") ?? "");
    }
  } else if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    csvText = await req.text();
  } else {
    try {
      const json = (await req.json()) as Record<string, unknown>;
      csvText = String(json["csvText"] ?? "");
      // Also support { rows: [...] } direct JSON bulk (fallback)
      if (!csvText && Array.isArray(json["rows"])) {
        // handle JSON rows directly
        return handleJsonRows(json["rows"] as Record<string, unknown>[], user.id ?? null);
      }
    } catch {
      csvText = await req.text().catch(() => "");
    }
  }

  if (!csvText || csvText.trim().length === 0) {
    return fail(400, "csvText or file is required (CSV with headers)");
  }

  const { headers, rows } = parseCsvText(csvText);
  if (headers.length === 0) return fail(400, "Empty CSV");
  if (rows.length === 0) return fail(400, "CSV has no data rows");

  // Validate each row
  type ValidRow = { rowNumber: number; data: Record<string, unknown> };
  const valid: ValidRow[] = [];
  const failed: Array<{ row: number; error: string }> = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // 1-indexed + header
    // Normalize raw: empty strings -> undefined, handle admission nesting via bulkStudentRowSchema directly
    // We reuse the parseCsvRow logic but with inline normalization to capture per-row error detail
    const normalized: Record<string, unknown> = { row: rowNumber };
    for (const [k, v] of Object.entries(raw)) {
      const key = k.trim().toLowerCase();
      const val = (v ?? "").trim();
      if (val === "") normalized[key] = undefined;
      else normalized[key] = val;
    }
    // Nest admission fields
    const admission: Record<string, unknown> = {};
    for (const f of ["course_id", "academic_year_id", "admission_mode", "seat_type", "intake_stream", "expected_grad_year", "roll_number"]) {
      if (normalized[f] !== undefined) {
        admission[f] = normalized[f];
        delete normalized[f];
      }
    }
    if (Object.keys(admission).length > 0 && admission["course_id"] !== undefined) {
      normalized["admission"] = admission;
    }

    const result = bulkStudentRowSchema.safeParse(normalized);
    if (!result.success) {
      const msg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      failed.push({ row: rowNumber, error: msg });
    } else {
      valid.push({ rowNumber, data: result.data as unknown as Record<string, unknown> });
    }
  });

  if (valid.length === 0) {
    return ok({ inserted: 0, failed });
  }

  const svc = createServiceClient();

  // Pre-fetch defaults for required FKs
  let defaultUniversityId: number | null = null;
  let defaultCampusId: number | null = null;
  let defaultCourseId: number | null = null;
  try {
    const { data: uni } = await svc.from("universities").select("id").limit(1).maybeSingle();
    if (uni) defaultUniversityId = (uni as { id: number }).id;
    const { data: camp } = await svc.from("campuses").select("id").limit(1).maybeSingle();
    if (camp) defaultCampusId = (camp as { id: number }).id;
    const { data: course } = await svc.from("courses").select("id").limit(1).maybeSingle();
    if (course) defaultCourseId = (course as { id: number }).id;
  } catch {}

  let inserted = 0;
  const batchFailed: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < valid.length; i += BATCH) {
    const slice = valid.slice(i, i + BATCH);
    const studentRows: Record<string, unknown>[] = [];
    const admissionByIdx: Array<Record<string, unknown> | null> = [];

    for (const { data } of slice) {
      const admission = (data["admission"] as Record<string, unknown> | null) ?? null;
      const fields = { ...data } as Record<string, unknown>;
      delete fields["admission"];
      delete fields["row"];

      // Aadhaar encryption
      if (typeof fields["aadhaar_number"] === "string" && (fields["aadhaar_number"] as string).trim().length > 0) {
        const plain = (fields["aadhaar_number"] as string).trim();
        try {
          fields["aadhaar_number"] = encryptAadhaar(plain);
          fields["aadhaar_hash"] = aadhaarHash(plain);
        } catch {
          fields["aadhaar_number"] = undefined;
          delete fields["aadhaar_number"];
          delete fields["aadhaar_hash"];
        }
      } else {
        delete fields["aadhaar_number"];
        delete fields["aadhaar_hash"];
      }

      // Defaults
      if (!fields["university_id"] && defaultUniversityId) fields["university_id"] = defaultUniversityId;
      if (!fields["campus_id"] && defaultCampusId) fields["campus_id"] = defaultCampusId;
      if (!fields["program_id"]) {
        if (admission?.["course_id"]) fields["program_id"] = admission["course_id"];
        else if (defaultCourseId) fields["program_id"] = defaultCourseId;
      }
      if (!fields["search_name"] && fields["first_name"] && fields["last_name"]) {
        fields["search_name"] = `${fields["first_name"]} ${fields["last_name"]}`.trim().toLowerCase();
      }
      if (!fields["pnr"]) fields["pnr"] = `PNR-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
      if (!fields["roll_number"]) fields["roll_number"] = `RN${new Date().getFullYear()}${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`;
      if (!fields["admission_date"]) fields["admission_date"] = new Date().toISOString().slice(0, 10);
      if (!fields["status"]) fields["status"] = "active";
      if (!fields["country"]) fields["country"] = "India";

      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) clean[k] = v;

      studentRows.push(clean);
      admissionByIdx.push(admission);
    }

    // Insert students in this batch
    const { data: insertedStudents, error: insErr } = await svc.from("students").insert(studentRows as never).select("id").returns();
    if (insErr) {
      // Mark whole batch as failed per-row (fallback: try row-by-row)
      // Try individual inserts to isolate bad rows
      for (let j = 0; j < studentRows.length; j++) {
        const one = studentRows[j];
        const rowNum = slice[j].rowNumber;
        const { data: single, error: singleErr } = await svc.from("students").insert(one as never).select("id").single();
        if (singleErr) {
          batchFailed.push({ row: rowNum, error: singleErr.message });
        } else {
          inserted++;
          const sid = (single as { id: number }).id;
          const adm = admissionByIdx[j];
          if (adm && adm["course_id"]) {
            const aRow: Record<string, unknown> = {
              student_id: sid,
              course_id: adm["course_id"],
              academic_year_id: adm["academic_year_id"] ?? null,
              admission_mode: adm["admission_mode"] ?? "merit",
              seat_type: adm["seat_type"] ?? "general_open",
              intake_stream: adm["intake_stream"] ?? "general",
              expected_grad_year: adm["expected_grad_year"] ?? null,
              roll_number: (adm["roll_number"] as string) ?? (one["roll_number"] as string),
            };
            const { error: aErr } = await svc.from("admissions").insert(aRow as never);
            if (aErr) console.warn("admission insert failed for", sid, aErr.message);
            else {
              try {
                await svc.from("academic_progress").insert({ student_id: sid, current_semester: 1, backlog_count: 0 } as never);
              } catch {}
            }
          }
        }
      }
      continue;
    }

    const ids = (insertedStudents as unknown as Array<{ id: number }>).map((r) => r.id);
    inserted += ids.length;

    // Insert admissions for this batch (aligned by index)
    const admissionRows: Record<string, unknown>[] = [];
    const progressRows: Record<string, unknown>[] = [];
    ids.forEach((sid, idx) => {
      const adm = admissionByIdx[idx];
      if (adm && adm["course_id"]) {
        admissionRows.push({
          student_id: sid,
          course_id: adm["course_id"],
          academic_year_id: adm["academic_year_id"] ?? null,
          admission_mode: adm["admission_mode"] ?? "merit",
          seat_type: adm["seat_type"] ?? "general_open",
          intake_stream: adm["intake_stream"] ?? "general",
          expected_grad_year: adm["expected_grad_year"] ?? null,
          roll_number: (adm["roll_number"] as string) ?? (studentRows[idx]["roll_number"] as string),
        });
        progressRows.push({ student_id: sid, current_semester: 1, backlog_count: 0 });
      }
    });
    if (admissionRows.length > 0) {
      const { error: aErr } = await svc.from("admissions").insert(admissionRows as never);
      if (aErr) console.warn("batch admissions insert failed:", aErr.message);
    }
    if (progressRows.length > 0) {
      try {
        await svc.from("academic_progress").insert(progressRows as never);
      } catch {}
    }
  }

  const allFailed = [...failed, ...batchFailed];

  await cacheInvalidate("profile:");
  await cacheInvalidate("search:");
  await cacheInvalidate("list:");
  await cacheInvalidate("stats:");

  const res = ok({ inserted, failed: allFailed });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function handleJsonRows(rows: Record<string, unknown>[], _actorId: string | null) {
  // Bulk via JSON rows (alternative to CSV text) — same validation path
  const valid: Array<Record<string, unknown>> = [];
  const failed: Array<{ row: number; error: string }> = [];
  rows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    const result = bulkStudentRowSchema.safeParse({ ...raw, row: rowNumber });
    if (!result.success) {
      failed.push({ row: rowNumber, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    } else {
      valid.push(result.data as unknown as Record<string, unknown>);
    }
  });
  if (valid.length === 0) return ok({ inserted: 0, failed });

  const svc = createServiceClient();
  let inserted = 0;
  for (let i = 0; i < valid.length; i += BATCH) {
    const slice = valid.slice(i, i + BATCH);
    const studentRows = slice.map((d) => {
      const f = { ...d } as Record<string, unknown>;
      const adm = f["admission"] as Record<string, unknown> | null;
      delete f["admission"];
      delete f["row"];
      if (typeof f["aadhaar_number"] === "string" && (f["aadhaar_number"] as string).trim()) {
        const plain = (f["aadhaar_number"] as string).trim();
        try {
          f["aadhaar_number"] = encryptAadhaar(plain);
          f["aadhaar_hash"] = aadhaarHash(plain);
        } catch {
          delete f["aadhaar_number"];
          delete f["aadhaar_hash"];
        }
      } else {
        delete f["aadhaar_number"];
        delete f["aadhaar_hash"];
      }
      if (!f["search_name"] && f["first_name"] && f["last_name"]) f["search_name"] = `${f["first_name"]} ${f["last_name"]}`.trim().toLowerCase();
      if (!f["pnr"]) f["pnr"] = `PNR-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
      if (!f["roll_number"]) f["roll_number"] = `RN${String(Date.now()).slice(-6)}`;
      if (!f["admission_date"]) f["admission_date"] = new Date().toISOString().slice(0, 10);
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(f)) if (v !== undefined) clean[k] = v;
      // stash admission for later via hidden prop
      (clean as Record<string, unknown>)["__adm"] = adm;
      return clean;
    });
    const toInsert = studentRows.map((r) => {
      const c = { ...r };
      delete c["__adm"];
      return c;
    });
    const { data, error } = await svc.from("students").insert(toInsert as never).select("id").returns();
    if (error) {
      failed.push(...slice.map((_, idx) => ({ row: i + idx + 1, error: error.message })));
      continue;
    }
    const ids = (data as unknown as Array<{ id: number }>).map((r) => r.id);
    inserted += ids.length;
    const admRows = ids
      .map((sid, idx) => {
        const adm = studentRows[idx]["__adm"] as Record<string, unknown> | null;
        if (!adm || !adm["course_id"]) return null;
        return {
          student_id: sid,
          course_id: adm["course_id"],
          admission_mode: adm["admission_mode"] ?? "merit",
          seat_type: adm["seat_type"] ?? "general_open",
          intake_stream: adm["intake_stream"] ?? "general",
          roll_number: (adm["roll_number"] as string) ?? (toInsert[idx]["roll_number"] as string),
        };
      })
      .filter(Boolean) as Record<string, unknown>[];
    if (admRows.length) await svc.from("admissions").insert(admRows as never);
  }
  await cacheInvalidate("profile:");
  await cacheInvalidate("search:");
  await cacheInvalidate("list:");
  await cacheInvalidate("stats:");
  return ok({ inserted, failed });
}
