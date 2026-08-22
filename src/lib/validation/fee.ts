/**
 * Fee validation — Task 8.
 * Re-exports schemas.ts DTOs and adds fee_category_rates + list schemas.
 */
export {
  feePaymentCreateSchema,
  feePaymentUpdateSchema,
} from "./schemas";
export type { FeePaymentCreateInput } from "./schemas";

import { z } from "zod";

export const feeCategoryRateCreateSchema = z.object({
  course_id: z.coerce.number().int().positive(),
  year_of_study: z.coerce.number().int().min(1).max(10),
  academic_year: z.string().trim().min(1).max(20),
  fee_type: z.string().trim().min(1).max(100).default("Tuition"),
  amount: z.coerce.number().min(0),
});

export type FeeCategoryRateCreateInput = z.infer<typeof feeCategoryRateCreateSchema>;
export const feeCategoryRateUpdateSchema = feeCategoryRateCreateSchema.partial();

export const feeListQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional().nullable(),
  student_id: z.coerce.number().int().positive().optional().nullable(),
  status: z.string().optional().nullable(),
  academic_year: z.string().optional().nullable(),
  fee_category_rate_id: z.coerce.number().int().positive().optional().nullable(),
});

export type FeeListQuery = z.infer<typeof feeListQuerySchema>;

export const feePaymentSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  fee_category_rate_id: z.coerce.number().int().positive().optional().nullable(),
  amount_due: z.coerce.number().min(0),
  amount_paid: z.coerce.number().min(0).default(0),
  status: z.enum(["unpaid", "partial", "paid", "overdue", "refunded"]).default("unpaid"),
  payment_mode: z.string().max(50).optional().nullable(),
  payment_date: z.string().optional().nullable(),
  transaction_id: z.string().max(100).optional().nullable(),
  scholarship_application_id: z.coerce.number().int().positive().optional().nullable(),
});

export const receiptQuerySchema = z.object({
  fee_payment_id: z.coerce.number().int().positive().optional().nullable(),
  student_id: z.coerce.number().int().positive().optional().nullable(),
  transaction_id: z.string().optional().nullable(),
});
