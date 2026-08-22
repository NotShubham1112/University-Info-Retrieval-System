import { z } from "zod";

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
// Query params arrive as strings; coerce limit to number.
// Default limit 20, allowed 1..100. Cursor is opaque string (keyset id as text).
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).optional()
    .transform((v) => v ?? 20),
  cursor: z.string().optional().nullable(),
  q: z.string().optional().default(""),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// Extended search pagination (used by /api/search)
export const searchQuerySchema = z.object({
  q: z.string().trim().default(""),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional()
    .transform((v) => v ?? 20),
  cursor: z.string().optional().nullable(),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

// ---------------------------------------------------------------------------
// Student DTOs — per v4 students + admissions fields
// aadhaar_number is optional, validated as 12 digits when present, never echoed back.
// ---------------------------------------------------------------------------

const aadhaarRegex = /^\d{12}$/;
const phoneRegex = /^\+?[0-9]{10,15}$/;
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const genders = ["male", "female", "other", "prefer_not_to_say"] as const;
const studentStatuses = ["active", "inactive", "graduated", "suspended"] as const;
const admissionModes = ["merit", "management", "spot", "tfws", "ews"] as const;
const seatTypes = ["general_open", "tfws", "ews", "reserved"] as const;
const intakeStreams = ["general", "tfws", "ews", "reserved"] as const;

export const studentCreateSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().regex(phoneRegex, "invalid phone").optional().nullable(),
  date_of_birth: z.string().optional().nullable(), // ISO date string
  gender: z.enum(genders).optional().nullable(),
  abc_id: z.string().max(50).optional().nullable(),
  aadhaar_number: z.string().regex(aadhaarRegex, "aadhaar must be 12 digits").optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().default("India"),
  blood_group: z.enum(bloodGroups).optional().nullable(),
  guardian_name: z.string().max(100).optional().nullable(),
  guardian_contact_number: z.string().regex(phoneRegex, "invalid guardian phone").optional().nullable(),
  category_id: z.coerce.number().int().positive().optional().nullable(),
  program_id: z.coerce.number().int().positive().optional().nullable(),
  campus_id: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(studentStatuses).default("active"),
  // Admissions nested payload
  admission: z
    .object({
      course_id: z.coerce.number().int().positive(),
      academic_year_id: z.coerce.number().int().positive().optional().nullable(),
      admission_mode: z.enum(admissionModes).optional().nullable(),
      seat_type: z.enum(seatTypes).optional().nullable(),
      intake_stream: z.enum(intakeStreams).optional().nullable(),
      expected_grad_year: z.coerce.number().int().min(2000).max(2100).optional().nullable(),
      roll_number: z.string().max(50).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;

export const studentUpdateSchema = studentCreateSchema.partial().extend({
  id: z.coerce.number().int().positive().optional(),
});

export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;

export const bulkStudentRowSchema = studentCreateSchema.extend({
  row: z.coerce.number().int().positive().optional(),
});

export type BulkStudentRow = z.infer<typeof bulkStudentRowSchema>;

// ---------------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------------
export const teacherCreateSchema = z.object({
  employee_id: z.string().trim().min(1).max(50),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().regex(phoneRegex, "invalid phone").optional().nullable(),
  department_id: z.coerce.number().int().positive().optional().nullable(),
  designation: z.string().max(100).optional().nullable(),
  joining_date: z.string().optional().nullable(),
  status: z.enum(["active", "inactive", "on_leave"]).default("active"),
});

export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;
export const teacherUpdateSchema = teacherCreateSchema.partial();

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------
export const courseCreateSchema = z.object({
  branch_or_course: z.string().trim().min(1).max(200),
  course_type: z.string().max(100).optional().nullable(),
  duration_years: z.coerce.number().int().min(1).max(10).optional().nullable(),
  credits: z.coerce.number().int().min(0).max(500).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
});

export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export const courseUpdateSchema = courseCreateSchema.partial();

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
export const attendanceRecordSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  status: z.enum(["present", "absent", "late", "leave"]),
});

export const attendanceCreateSchema = z.object({
  course_id: z.coerce.number().int().positive(),
  subject_id: z.coerce.number().int().positive().optional().nullable(),
  date: z.string().min(1), // ISO date
  records: z.array(attendanceRecordSchema).min(1).max(1000),
});

export type AttendanceCreateInput = z.infer<typeof attendanceCreateSchema>;

export const attendanceBulkRowSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  course_id: z.coerce.number().int().positive(),
  date: z.string().min(1),
  status: z.enum(["present", "absent", "late", "leave"]),
});

// ---------------------------------------------------------------------------
// Exam
// ---------------------------------------------------------------------------
export const examCreateSchema = z.object({
  course_id: z.coerce.number().int().positive(),
  semester_no: z.coerce.number().int().min(1).max(12),
  exam_type: z.enum(["midterm", "final", "supplementary"]).default("final"),
  date: z.string().optional().nullable(),
  status: z.enum(["draft", "scheduled", "published"]).default("draft"),
});

export type ExamCreateInput = z.infer<typeof examCreateSchema>;
export const examUpdateSchema = examCreateSchema.partial();

export const examSubjectSchema = z.object({
  subject_id: z.coerce.number().int().positive(),
  max_marks: z.coerce.number().min(1).max(1000),
  pass_marks: z.coerce.number().min(0).max(1000),
});

export const marksEntrySchema = z.object({
  student_id: z.coerce.number().int().positive(),
  subject_id: z.coerce.number().int().positive(),
  internal_marks: z.coerce.number().min(0).max(1000).optional().nullable(),
  external_marks: z.coerce.number().min(0).max(1000).optional().nullable(),
  attempt_number: z.coerce.number().int().min(1).default(1),
});

// ---------------------------------------------------------------------------
// Fee
// ---------------------------------------------------------------------------
export const feePaymentCreateSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  fee_category_rate_id: z.coerce.number().int().positive(),
  amount_due: z.coerce.number().min(0),
  amount_paid: z.coerce.number().min(0).default(0),
  status: z.enum(["unpaid", "partial", "paid", "overdue"]).default("unpaid"),
  scholarship_application_id: z.coerce.number().int().positive().optional().nullable(),
});

export type FeePaymentCreateInput = z.infer<typeof feePaymentCreateSchema>;
export const feePaymentUpdateSchema = feePaymentCreateSchema.partial();

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------
export const timetableCreateSchema = z.object({
  course_id: z.coerce.number().int().positive(),
  semester_no: z.coerce.number().int().min(1).max(12),
  day_of_week: z.coerce.number().int().min(0).max(6), // 0=Sun
  period_no: z.coerce.number().int().min(1).max(12),
  subject_id: z.coerce.number().int().positive(),
  teacher_id: z.coerce.number().int().positive(),
  room_id: z.coerce.number().int().positive().optional().nullable(),
});

export type TimetableCreateInput = z.infer<typeof timetableCreateSchema>;
export const timetableUpdateSchema = timetableCreateSchema.partial();

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------
export const notificationCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  type: z.enum(["info", "warning", "urgent", "academic", "fee", "event"]).default("info"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  channel: z.enum(["in_app", "email", "sms"]).default("in_app"),
  recipient_role: z.string().max(50).optional().nullable(),
  student_ids: z.array(z.coerce.number().int().positive()).optional().nullable(),
});

export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
