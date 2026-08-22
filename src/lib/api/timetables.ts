/** Timetables shared types — Task 8 */

export interface TimetableRow {
  id: number;
  course_id: number;
  semester_no: number;
  day_of_week: number;
  period_no: number;
  subject_id: number | null;
  teacher_id: number | null;
  room_id: number | null;
  created_at: string;
  updated_at: string;
  subject_name?: string | null;
  teacher_name?: string | null;
  room_name?: string | null;
  course_name?: string | null;
}

export interface TimetableListResponse {
  data: TimetableRow[];
  nextCursor: string | null;
}

export interface TimetableConflictError {
  code: "CONFLICT";
  conflicts: Array<{
    type: "teacher_busy" | "room_double_booked" | "slot_taken";
    message: string;
  }>;
}
