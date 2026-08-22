/**
 * Minimal shared StudentRow type (Task 6 spec §6: thin file, delete in Task 10 if unused).
 * Shared by hooks and routes to avoid importing full DB types where not needed.
 */

export interface StudentRow {
  id: number;
  pnr: string | null;
  roll_number: string | null;
  first_name: string;
  last_name: string;
  search_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  program_id: number | null;
  campus_id: number | null;
  category_id: number | null;
  abc_id: string | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  blood_group: string | null;
  guardian_name: string | null;
  guardian_contact_number: string | null;
  admission_id?: number | null;
  course_id?: number | null;
  admission_mode?: string | null;
  seat_type?: string | null;
  intake_stream?: string | null;
  expected_grad_year?: number | null;
  current_semester?: number | null;
  backlog_count?: number | null;
  latest_semester_no?: number | null;
  latest_sgpa?: number | null;
  latest_result_status?: string | null;
  // NOTE: aadhaar_number never projected by default (see crypto.ts)
  created_at: string;
  updated_at: string;
}

export interface StudentListResponse {
  data: StudentRow[];
  nextCursor: string | null;
}

export interface ImportResult {
  inserted: number;
  failed: Array<{ row: number; error: string }>;
}

export interface DocumentRow {
  id: number;
  student_id: number;
  document_type: string;
  file_name: string;
  storage_key: string;
  file_size: number;
  mime_type: string;
  verified_status: string;
  verified_by: string | null;
  verified_date: string | null;
  uploaded_at: string;
  created_at: string;
}
