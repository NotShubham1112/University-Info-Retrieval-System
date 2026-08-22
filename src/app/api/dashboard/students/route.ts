import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseQuery, parseBody, fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { studentCreateSchema } from "@/lib/validation/schemas";
import { studentListQuerySchema } from "@/lib/validation/student";
import { getCachedOrSet, cacheInvalidate, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";
import { assertPermissionOrFail } from "@/lib/admin";
import { encryptAadhaar, aadhaarHash } from "@/lib/crypto";
import { recordStudentStatusTransition } from "@/lib/admin";

// Columns explicitly selected — never include aadhaar_number in list projection
const SUMMARY_COLUMNS =
  "id,pnr,roll_number,first_name,last_name,search_name,date_of_birth,email,phone,admission_date,status,program_id,campus_id,category_id,abc_id,gender,address,city,state,country,blood_group,photo_path,guardian_name,guardian_contact_number,created_at,updated_at,admission_id,course_id,admission_mode,seat_type,intake_stream,expected_grad_year,current_semester,backlog_count,latest_semester_no,latest_sgpa,latest_result_status";

export async function GET(req: NextRequest) {
  const parsed = parseQuery(studentListQuerySchema, req.nextUrl.searchParams);
  if (!parsed.success) return parsed.response;
  const { q, limit, cursor, status } = parsed.data as {
    q: string;
    limit: number;
    cursor?: string | null;
    status?: string | null;
  };

  const cacheKey = buildCacheKey("GET", "/api/dashboard/students", {
    q: q ?? "",
    limit,
    cursor: cursor ?? "",
    status: status ?? "",
  });
  const prefixedKey = `list:${cacheKey}`;

  try {
    const result = await getCachedOrSet(
      prefixedKey,
      CACHE_TTL.list,
      async () => {
        const supabase = createServiceClient();
        // Prefer RPC when searching, fallback to view
        if (q && q.trim().length > 0) {
          try {
            const { data, error } = await supabase.rpc("search_students", {
              q: q.trim(),
              p_limit: limit,
              p_cursor: cursor ?? null,
            });
            if (!error && data) {
              const rows = data as unknown as Array<Record<string, unknown>>;
              const nextCursor = rows.length === limit ? String((rows[rows.length - 1] as { id: number }).id) : null;
              // search_students returns id,pnr,roll_number,... may lack admission fields; normalize to StudentRow shape
              return { data: rows, nextCursor };
            }
          } catch {
            // fall through to view query
          }
        }

        let query = supabase.from("student_summary").select(SUMMARY_COLUMNS);
        if (q && q.trim().length > 0) {
          query = query.ilike("search_name", `%${q.trim().toLowerCase()}%`);
        }
        if (status) {
          query = query.eq("status", status);
        }
        if (cursor) {
          const c = Number(cursor);
          if (!Number.isNaN(c)) query = query.gt("id", c);
        }
        query = query.order("id", { ascending: true }).limit(limit);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as unknown as Array<{ id: number } & Record<string, unknown>>;
        const nextCursor = rows.length === limit ? String(rows[rows.length - 1].id) : null;
        return { data: rows, nextCursor };
      },
    );

    const res = ok(result);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.list));
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
  // RBAC
  const supabaseAuth = await createServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "student:write");
  if (denied) return denied;

  const parsed = await parseBody(studentCreateSchema, req);
  if (!parsed.success) return parsed.response;
  const payload = parsed.data as Record<string, unknown>;

  const admission = (payload["admission"] ?? null) as Record<string, unknown> | null;
  // Remove admission from student fields
  const studentFields = { ...payload } as Record<string, unknown>;
  delete studentFields["admission"];

  // Handle aadhaar encryption
  let aadhaar_number: string | null | undefined = undefined;
  let aadhaar_hash: string | null | undefined = undefined;
  if (typeof studentFields["aadhaar_number"] === "string" && (studentFields["aadhaar_number"] as string).trim().length > 0) {
    const plain = (studentFields["aadhaar_number"] as string).trim();
    try {
      aadhaar_number = encryptAadhaar(plain);
      aadhaar_hash = aadhaarHash(plain);
    } catch (e) {
      return fail(400, `Aadhaar encryption failed: ${(e as Error).message}`);
    }
    studentFields["aadhaar_number"] = aadhaar_number;
    studentFields["aadhaar_hash"] = aadhaar_hash;
  } else {
    delete studentFields["aadhaar_number"];
    delete studentFields["aadhaar_hash"];
  }

  // Auto-populate search_name, pnr, roll_number if missing
  const firstName = String(studentFields["first_name"] ?? "");
  const lastName = String(studentFields["last_name"] ?? "");
  if (!studentFields["search_name"]) {
    studentFields["search_name"] = `${firstName} ${lastName}`.trim().toLowerCase();
  }

  const svc = createServiceClient();

  // Resolve defaults for university_id / campus_id / program_id if missing
  // students table requires university_id, campus_id, program_id per types; ensure they exist
  try {
    if (!studentFields["university_id"]) {
      const { data: uni } = await svc.from("universities").select("id").limit(1).maybeSingle();
      if (uni) studentFields["university_id"] = (uni as { id: number }).id;
    }
    if (!studentFields["campus_id"]) {
      const { data: camp } = await svc.from("campuses").select("id").limit(1).maybeSingle();
      if (camp) studentFields["campus_id"] = (camp as { id: number }).id;
    }
    if (!studentFields["program_id"]) {
      // derive from admission.course_id or first course
      if (admission?.["course_id"]) {
        studentFields["program_id"] = admission["course_id"];
      } else {
        const { data: course } = await svc.from("courses").select("id").limit(1).maybeSingle();
        if (course) studentFields["program_id"] = (course as { id: number }).id;
      }
    }
    // Ensure pnr/roll_number have defaults — DB may have defaults/not-null?
    if (!studentFields["pnr"]) {
      studentFields["pnr"] = `PNR-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
    }
    if (!studentFields["roll_number"]) {
      studentFields["roll_number"] = `RN${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;
    }
    if (!studentFields["admission_date"]) {
      studentFields["admission_date"] = new Date().toISOString().slice(0, 10);
    }
  } catch {
    // ignore fallback errors
  }

  // Filter out undefined values; keep nulls
  const insertStudent: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(studentFields)) {
    if (v !== undefined) insertStudent[k] = v;
  }

  try {
    const { data: student, error: sErr } = await svc
      .from("students")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertStudent as any)
      .select(SUMMARY_COLUMNS.split(",").slice(0, 22).join(","))
      .single();
    if (sErr) return fail(500, sErr.message, "INTERNAL_ERROR");
    if (!student) return fail(500, "Failed to create student", "INTERNAL_ERROR");

    const studentId = (student as unknown as { id: number }).id;

    // Insert admission if provided
    if (admission && admission["course_id"]) {
      const admissionRow: Record<string, unknown> = {
        student_id: studentId,
        course_id: admission["course_id"],
        academic_year_id: admission["academic_year_id"] ?? null,
        admission_mode: admission["admission_mode"] ?? "merit",
        seat_type: admission["seat_type"] ?? "general_open",
        intake_stream: admission["intake_stream"] ?? "general",
        expected_grad_year: admission["expected_grad_year"] ?? null,
        roll_number: (admission["roll_number"] as string) ?? insertStudent["roll_number"] ?? `RN${String(studentId).padStart(6, "0")}`,
      };
      const { error: aErr } = await svc
        .from("admissions" as unknown as never)
        .insert(admissionRow as unknown as never);
      if (aErr) {
        // student created but admission failed — surface error but don't rollback (service client no txn)
        // Try to inform caller; keep student
        console.warn("admissions insert failed:", aErr.message);
      }
    }

    // Seed academic_progress row so student appears in summary with semester 1
    try {
      await svc
        .from("academic_progress" as unknown as never)
        .insert({ student_id: studentId, current_semester: 1, backlog_count: 0 } as unknown as never);
    } catch {}

    await cacheInvalidate("profile:");
    await cacheInvalidate("search:");
    await cacheInvalidate("list:");
    await cacheInvalidate("stats:");

    // Record initial status history
    try {
      await recordStudentStatusTransition({
        studentId,
        fromStatus: null,
        toStatus: String(insertStudent["status"] ?? "active"),
        changedBy: user.id ?? null,
        reason: "create",
        supabase: svc,
      });
    } catch {}

    const res = ok(student);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}
