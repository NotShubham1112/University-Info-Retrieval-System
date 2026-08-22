/**
 * Student validation — reference module (Task 6).
 * Re-exports and extends schemas.ts for explicit import path required by plan.
 * All zod DTOs live in schemas.ts; this file provides task-specific re-exports
 * and CSV-row helpers so `import { bulkStudentRowSchema } from "@/lib/validation/student"` works.
 */
export {
  studentCreateSchema,
  studentUpdateSchema,
  bulkStudentRowSchema,
  paginationSchema,
  searchQuerySchema,
} from "./schemas";
export type {
  StudentCreateInput,
  StudentUpdateInput,
  BulkStudentRow,
  PaginationInput,
  SearchQueryInput,
} from "./schemas";

// CSV-specific: header -> field mapping validation
import { z } from "zod";
import { bulkStudentRowSchema } from "./schemas";

/** Headers expected in the CSV template (lowercase, trimmed). */
export const CSV_HEADERS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "date_of_birth",
  "gender",
  "abc_id",
  "aadhaar_number",
  "address",
  "city",
  "state",
  "country",
  "blood_group",
  "guardian_name",
  "guardian_contact_number",
  "category_id",
  "program_id",
  "campus_id",
  "status",
  "course_id",
  "admission_mode",
  "seat_type",
  "intake_stream",
  "expected_grad_year",
  "roll_number",
] as const;

export type CsvHeader = (typeof CSV_HEADERS)[number];

/**
 * Parse a raw CSV row object (string values per header) into a BulkStudentRow.
 * Normalizes empty strings to null/undefined before zod validation.
 */
export function parseCsvRow(
  raw: Record<string, string>,
  rowNumber: number,
): ReturnType<typeof bulkStudentRowSchema.safeParse> & { row: number } {
  const normalized: Record<string, unknown> = { row: rowNumber };
  for (const [k, v] of Object.entries(raw)) {
    const key = k.trim().toLowerCase();
    const val = (v ?? "").trim();
    if (val === "") {
      normalized[key] = undefined;
    } else {
      normalized[key] = val;
    }
  }
  // Nest course-related fields under `admission` when present
  const admission: Record<string, unknown> = {};
  for (const f of ["course_id", "academic_year_id", "admission_mode", "seat_type", "intake_stream", "expected_grad_year", "roll_number"]) {
    if (normalized[f] !== undefined) {
      admission[f] = normalized[f];
      delete normalized[f];
    }
  }
  // CSV header uses `roll_number` for admissions rolling number; if admission has roll_number use it, else admission object may be empty
  if (Object.keys(admission).length > 0) {
    // only attach admission if course_id exists; otherwise omit (optional)
    if (admission["course_id"] !== undefined) {
      normalized["admission"] = admission;
    }
  }

  const result = bulkStudentRowSchema.safeParse(normalized);
  return Object.assign(result, { row: rowNumber }) as typeof result & { row: number };
}

/** Minimal CSV parser: handles commas inside quotes, trims headers. */
export function parseCsvText(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out.map((v) => v.replace(/^"(.*)"$/, "$1"));
  };
  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? "";
    });
    rows.push(obj);
  }
  return { headers, rows };
}

/** Schema for query params on GET /api/dashboard/students */
export const studentListQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});

export type StudentListQuery = z.infer<typeof studentListQuerySchema>;
