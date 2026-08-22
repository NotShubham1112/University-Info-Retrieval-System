// v4 types — hand-written to match migrations 0005-0009
// NOTE: Run `npm run db:types` (npx supabase gen types typescript --local) after `npx supabase db reset` to regenerate from live DB
// This file is intentionally hand-maintained until Supabase local is available.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface University { id: number; name: string; created_at: string; }
export interface Campus { id: number; university_id: number; name: string; }
export interface Department { id: number; campus_id: number; name: string; created_at: string; updated_at: string; }
export interface Course {
  id: number;
  department_id: number;
  branch_or_course: string;
  course_type: string;
  duration_years: number;
  credits: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}
export interface AcademicYear { id: number; label: string; start_date: string; end_date: string; }
export interface Semester { id: number; program_id: number; semester_no: number; academic_year_id: number; }
export interface Subject { id: number; program_id: number; semester_no: number; code: string; name: string; }
export interface ReservationCategory {
  id: number;
  code: string;
  name: string;
  parent_code: string | null;
  category_type: string;
  created_at: string;
  updated_at: string;
}
export interface Room { id: number; name: string; building: string | null; capacity: number; created_at: string; updated_at: string; }
export interface IntakePlan {
  id: number;
  course_id: number;
  batch_year: number;
  intake_stream: string;
  total_seats: number;
  general_open_seats: number;
  tfws_seats: number;
  ews_seats: number;
  reserved_breakdown: Json;
  created_at: string;
  updated_at: string;
}
export interface CategorySeatEligibility {
  id: number;
  category_id: number;
  seat_type: string;
  admission_mode: string;
  created_at: string;
  updated_at: string;
}
export interface Student {
  id: number;
  university_id: number;
  campus_id: number;
  program_id: number;
  pnr: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  search_name: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  admission_date: string;
  status: string;
  category_id: number | null;
  abc_id: string | null;
  gender: string | null;
  aadhaar_number: string | null;
  aadhaar_hash: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  blood_group: string | null;
  photo_path: string | null;
  guardian_name: string | null;
  guardian_contact_number: string | null;
  created_at: string;
  updated_at: string;
}
export interface Teacher {
  id: number;
  department_id: number;
  name: string;
  employee_id: string;
  designation: string | null;
  email: string;
  phone: string | null;
  joining_date: string | null;
  salary: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}
export interface Admission {
  id: number;
  student_id: number;
  course_id: number;
  academic_year_id: number | null;
  category_id: number | null;
  admission_mode: string;
  seat_type: string;
  intake_stream: string;
  roll_number: string;
  expected_grad_year: number | null;
  created_at: string;
  updated_at: string;
}
export interface Exam {
  id: number;
  course_id: number;
  semester_no: number;
  exam_type: string;
  date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
export interface ExamSubject {
  id: number;
  exam_id: number;
  subject_id: number;
  max_marks: number;
  pass_marks: number;
  created_at: string;
  updated_at: string;
}
export interface SubjectMark {
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
export interface SemesterRecord {
  id: number;
  student_id: number;
  semester_no: number;
  sgpa: number | null;
  result_status: string;
  declared_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface AcademicProgress {
  id: number;
  student_id: number;
  current_semester: number;
  backlog_count: number;
  created_at: string;
  updated_at: string;
}
export interface Backlog {
  id: number;
  student_id: number;
  subject_id: number;
  attempt: number;
  cleared: boolean;
  created_at: string;
  updated_at: string;
}
export interface FeeCategoryRate {
  id: number;
  course_id: number;
  year_of_study: number;
  academic_year: string;
  fee_type: string;
  amount: number;
  created_at: string;
  updated_at: string;
}
export interface FeePayment {
  id: number;
  student_id: number;
  fee_category_rate_id: number | null;
  scholarship_application_id: number | null;
  amount_due: number;
  amount_paid: number;
  status: string;
  transaction_id: string | null;
  payment_date: string | null;
  payment_mode: string | null;
  created_at: string;
  updated_at: string;
}
export interface DocumentRow {
  id: number;
  student_id: number;
  document_type: string;
  file_name: string;
  storage_key: string;
  file_size: number;
  mime_type: string;
  version: number;
  uploaded_at: string;
  uploaded_by: string | null;
  status: string;
  verified_status: string;
  verified_by: string | null;
  verified_date: string | null;
  created_at: string;
  updated_at: string;
}
export interface Scholarship { id: number; name: string; provider: string | null; amount: number | null; eligibility: Json; created_at: string; updated_at: string; }
export interface ScholarshipApplication {
  id: number;
  student_id: number;
  scholarship_id: number;
  status: string;
  applied_date: string;
  created_at: string;
  updated_at: string;
}
export interface ExtraCurricular {
  id: number;
  student_id: number;
  activity_name: string;
  role: string | null;
  achievement: string | null;
  academic_year: string | null;
  created_at: string;
  updated_at: string;
}
export interface Certification {
  id: number;
  student_id: number;
  title: string;
  issuer: string | null;
  issue_date: string | null;
  credential_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface Internship {
  id: number;
  student_id: number;
  company: string;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
export interface Assignment {
  id: number;
  course_id: number;
  subject_id: number | null;
  teacher_id: number | null;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}
export interface AssignmentSubmission {
  id: number;
  assignment_id: number;
  student_id: number;
  file_path: string | null;
  storage_key: string | null;
  submitted_at: string;
  grade: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}
export interface Timetable {
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
}
export interface NotificationRow {
  id: number;
  title: string;
  body: string;
  type: string;
  priority: string;
  channel: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface NotificationRecipient {
  id: number;
  notification_id: number;
  recipient_role: string | null;
  student_id: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}
export interface StudentStatusHistory {
  id: number;
  student_id: number;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}
export interface Permission { id: number; key: string; description: string | null; created_at: string; updated_at: string; }
export interface RolePermission { id: number; role_name: string; permission_id: number; created_at: string; }

// legacy keep for reference
export interface UserRow { id: string; email: string; name: string | null; created_at: string; }

export interface Db {
  public: {
    Tables: {
      universities: { Row: University; Insert: Omit<University, "id" | "created_at"> & { id?: number; created_at?: string }; Update: Partial<University> };
      campuses: { Row: Campus; Insert: Omit<Campus, "id"> & { id?: number }; Update: Partial<Campus> };
      departments: { Row: Department; Insert: Omit<Department, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Department> };
      courses: { Row: Course; Insert: Omit<Course, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Course> };
      academic_years: { Row: AcademicYear; Insert: Omit<AcademicYear, "id"> & { id?: number }; Update: Partial<AcademicYear> };
      semesters: { Row: Semester; Insert: Omit<Semester, "id"> & { id?: number }; Update: Partial<Semester> };
      subjects: { Row: Subject; Insert: Omit<Subject, "id"> & { id?: number }; Update: Partial<Subject> };
      reservation_category: { Row: ReservationCategory; Insert: Omit<ReservationCategory, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<ReservationCategory> };
      rooms: { Row: Room; Insert: Omit<Room, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Room> };
      intake_plan: { Row: IntakePlan; Insert: Omit<IntakePlan, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<IntakePlan> };
      category_seat_eligibility: { Row: CategorySeatEligibility; Insert: Omit<CategorySeatEligibility, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<CategorySeatEligibility> };
      students: { Row: Student; Insert: Omit<Student, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Student> };
      teachers: { Row: Teacher; Insert: Omit<Teacher, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Teacher> };
      admissions: { Row: Admission; Insert: Omit<Admission, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Admission> };
      exams: { Row: Exam; Insert: Omit<Exam, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Exam> };
      exam_subjects: { Row: ExamSubject; Insert: Omit<ExamSubject, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<ExamSubject> };
      subject_marks: { Row: SubjectMark; Insert: Omit<SubjectMark, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<SubjectMark> };
      semester_records: { Row: SemesterRecord; Insert: Omit<SemesterRecord, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<SemesterRecord> };
      academic_progress: { Row: AcademicProgress; Insert: Omit<AcademicProgress, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<AcademicProgress> };
      backlogs: { Row: Backlog; Insert: Omit<Backlog, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Backlog> };
      fee_category_rates: { Row: FeeCategoryRate; Insert: Omit<FeeCategoryRate, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<FeeCategoryRate> };
      fee_payments: { Row: FeePayment; Insert: Omit<FeePayment, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<FeePayment> };
      documents: { Row: DocumentRow; Insert: Omit<DocumentRow, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<DocumentRow> };
      scholarships: { Row: Scholarship; Insert: Omit<Scholarship, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Scholarship> };
      scholarship_applications: { Row: ScholarshipApplication; Insert: Omit<ScholarshipApplication, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<ScholarshipApplication> };
      extra_curricular: { Row: ExtraCurricular; Insert: Omit<ExtraCurricular, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<ExtraCurricular> };
      certifications: { Row: Certification; Insert: Omit<Certification, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Certification> };
      internships: { Row: Internship; Insert: Omit<Internship, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Internship> };
      assignments: { Row: Assignment; Insert: Omit<Assignment, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Assignment> };
      assignment_submissions: { Row: AssignmentSubmission; Insert: Omit<AssignmentSubmission, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<AssignmentSubmission> };
      timetables: { Row: Timetable; Insert: Omit<Timetable, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Timetable> };
      notifications: { Row: NotificationRow; Insert: Omit<NotificationRow, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<NotificationRow> };
      notification_recipients: { Row: NotificationRecipient; Insert: Omit<NotificationRecipient, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<NotificationRecipient> };
      student_status_history: { Row: StudentStatusHistory; Insert: Omit<StudentStatusHistory, "id" | "created_at"> & { id?: number }; Update: Partial<StudentStatusHistory> };
      permissions: { Row: Permission; Insert: Omit<Permission, "id" | "created_at" | "updated_at"> & { id?: number }; Update: Partial<Permission> };
      role_permissions: { Row: RolePermission; Insert: Omit<RolePermission, "id" | "created_at"> & { id?: number }; Update: Partial<RolePermission> };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      student_status: "active" | "graduated" | "dropped" | "on_leave";
      attendance_status: "present" | "absent" | "late" | "excused";
      payment_status: "pending" | "completed" | "failed" | "refunded";
    };
    CompositeTypes: { [_ in never]: never };
  };
}
