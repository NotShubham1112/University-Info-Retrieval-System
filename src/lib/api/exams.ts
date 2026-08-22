/** Exam shared types — Task 8 */

export interface ExamRow {
  id: number;
  course_id: number;
  semester_no: number;
  exam_type: string;
  date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  course_name?: string | null;
  subjects?: ExamSubjectRow[] | null;
  subject_count?: number;
}

export interface ExamSubjectRow {
  id: number;
  exam_id: number;
  subject_id: number;
  max_marks: number;
  pass_marks: number;
  created_at: string;
  updated_at: string;
  subject_name?: string | null;
}

export interface SubjectMarkRow {
  id: number;
  student_id: number;
  subject_id: number;
  exam_id: number | null;
  internal_marks: number | null;
  external_marks: number | null;
  marks: number | null;
  grade: string | null;
  grade_point: number | null;
  result_status: string;
  attempt_number: number;
  created_at: string;
  updated_at: string;
}

export interface SemesterRecordRow {
  id: number;
  student_id: number;
  semester_no: number;
  sgpa: number | null;
  result_status: string;
  declared_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExamListResponse {
  data: ExamRow[];
  nextCursor: string | null;
}

export interface PublishResult {
  exam_id: number;
  semester_no: number;
  published: boolean;
  semester_records_created: number;
  notifications_created: number;
  sgpa_samples: Array<{ student_id: number; sgpa: number | null; result_status: string }>;
}
