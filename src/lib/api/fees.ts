/** Fees shared types — Task 8 */

export interface FeeCategoryRateRow {
  id: number;
  course_id: number;
  year_of_study: number;
  academic_year: string;
  fee_type: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface FeePaymentRow {
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
  student_name?: string | null;
  course_name?: string | null;
}

export interface FeeListResponse {
  data: FeePaymentRow[];
  nextCursor: string | null;
}

export interface PendingFeeRow {
  course_id: number | null;
  academic_year: string | null;
  payment_count: number;
  total_due: number;
  total_paid: number;
  collection_pct: number;
}

export interface ReceiptRow extends FeePaymentRow {
  receipt_no: string;
  balance_due: number;
  fee_type?: string | null;
}

export interface FeeReceiptResponse {
  receipt: ReceiptRow | null;
  pending_summary?: PendingFeeRow[];
}
