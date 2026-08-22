/**
 * Teacher shared types — mirrors students.ts thin file.
 */
export interface TeacherRow {
  id: number;
  department_id: number | null;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  employee_id: string;
  designation: string | null;
  email: string;
  phone: string | null;
  joining_date: string | null;
  status: string;
  departments?: { name: string } | null;
  department_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherListResponse {
  data: TeacherRow[];
  nextCursor: string | null;
}
