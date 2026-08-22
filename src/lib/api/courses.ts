/**
 * Course shared types.
 */
export interface CourseRow {
  id: number;
  department_id: number;
  branch_or_course: string;
  course_type: string | null;
  duration_years: number | null;
  credits: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  // optional intake summary
  intake_plan?: IntakePlanRow[] | null;
}

export interface IntakePlanRow {
  id: number;
  course_id: number;
  batch_year: number;
  intake_stream: string;
  total_seats: number;
  general_open_seats: number;
  tfws_seats: number;
  ews_seats: number;
  reserved_breakdown: unknown;
}

export interface CourseListResponse {
  data: CourseRow[];
  nextCursor: string | null;
}
