/**
 * Attendance shared types.
 */
export interface AttendanceRecord {
  id: number;
  student_id: number;
  course_id: number | null;
  subject_id: number | null;
  date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceListResponse {
  data: AttendanceRecord[];
  nextCursor: string | null;
}

export interface AttendanceReportRow {
  date?: string | null;
  course_id?: number | null;
  subject_id?: number | null;
  total: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  attendance_pct: number;
}

export interface AttendanceReportResponse {
  rows: AttendanceReportRow[];
  summary: { total: number; present: number; attendance_pct: number };
  stale?: boolean;
}

export interface AttendanceImportResult {
  inserted: number;
  updated: number;
  failed: Array<{ row: number; error: string }>;
}
