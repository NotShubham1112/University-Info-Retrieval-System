export interface Student {
  pnr: string;
  name: string;
  email: string;
  phone: string | null;
  program_code: string;
  batch_year: number;
  status: "active" | "graduated" | "dropped" | "on_leave";
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  student_pnr: string;
  course_code: string;
  semester: number;
  academic_year: string;
  section: string | null;
  enrolled_at: string;
  created_at: string;
}

export interface Course {
  code: string;
  name: string;
  credits: number;
  department: string;
  description: string | null;
  created_at: string;
}

export interface Result {
  id: string;
  enrollment_id: string;
  marks_obtained: number | null;
  max_marks: number;
  grade: string | null;
  is_pass: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  enrollment_id: string;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  created_at: string;
}

export interface FeeStructure {
  id: string;
  program_code: string;
  batch_year: number;
  semester: number;
  fee_type: string;
  amount: number;
  due_date: string;
  created_at: string;
}

export interface FeePayment {
  id: string;
  student_pnr: string;
  fee_structure_id: string;
  amount_paid: number;
  payment_date: string;
  payment_mode: string;
  transaction_ref: string | null;
  status: "pending" | "completed" | "failed" | "refunded";
  created_at: string;
}

export interface StudentDocument {
  id: string;
  student_pnr: string;
  document_type: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  created_at: string;
}

export interface Db {
  public: {
    Tables: {
      students: {
        Row: Student;
        Insert: Omit<Student, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Student, "created_at" | "updated_at">> & {
          created_at?: string;
          updated_at?: string;
        };
      };
      enrollments: {
        Row: Enrollment;
        Insert: Omit<Enrollment, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Enrollment, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      courses: {
        Row: Course;
        Insert: Omit<Course, "created_at"> & {
          created_at?: string;
        };
        Update: Partial<Omit<Course, "created_at">> & {
          created_at?: string;
        };
      };
      results: {
        Row: Result;
        Insert: Omit<Result, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Result, "id" | "created_at" | "updated_at">> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      attendance: {
        Row: Attendance;
        Insert: Omit<Attendance, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Attendance, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      fee_structures: {
        Row: FeeStructure;
        Insert: Omit<FeeStructure, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<FeeStructure, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      fee_payments: {
        Row: FeePayment;
        Insert: Omit<FeePayment, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<FeePayment, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
      student_documents: {
        Row: StudentDocument;
        Insert: Omit<StudentDocument, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<StudentDocument, "id" | "created_at">> & {
          id?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      student_status: "active" | "graduated" | "dropped" | "on_leave";
      attendance_status: "present" | "absent" | "late" | "excused";
      payment_status: "pending" | "completed" | "failed" | "refunded";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}