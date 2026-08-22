/**
 * Attendance validation — Task 7.
 * Re-exports schemas.ts DTOs and provides CSV + report helpers.
 */
export {
  attendanceCreateSchema,
  attendanceRecordSchema,
  attendanceBulkRowSchema,
  paginationSchema,
} from "./schemas";
export type { AttendanceCreateInput } from "./schemas";

import { z } from "zod";

export const attendanceListQuerySchema = z.object({
  course_id: z.coerce.number().int().positive().optional().nullable(),
  subject_id: z.coerce.number().int().positive().optional().nullable(),
  date: z.string().optional().nullable(),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional().nullable(),
});

export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;

export const attendanceReportQuerySchema = z.object({
  course_id: z.coerce.number().int().positive().optional().nullable(),
  subject_id: z.coerce.number().int().positive().optional().nullable(),
  date: z.string().optional().nullable(),
  month: z.string().optional().nullable(), // YYYY-MM
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  group_by: z.enum(["daily", "monthly", "course", "subject"]).optional().default("daily"),
});

export type AttendanceReportQuery = z.infer<typeof attendanceReportQuerySchema>;

/** CSV helpers — mirrors student parseCsvText */
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
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) { out.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    out.push(cur.trim());
    return out.map((v) => v.replace(/^"(.*)"$/, "$1"));
  };
  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] ?? ""; });
    rows.push(obj);
  }
  return { headers, rows };
}

export const ATTENDANCE_CSV_HEADERS = ["student_id", "course_id", "subject_id", "date", "status"] as const;
