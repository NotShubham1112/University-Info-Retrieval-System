/**
 * Course validation — Task 7.
 * Re-exports schemas.ts DTOs and provides list query schema.
 */
export {
  courseCreateSchema,
  courseUpdateSchema,
  paginationSchema,
  searchQuerySchema,
} from "./schemas";
export type { CourseCreateInput } from "./schemas";

import { z } from "zod";

export const courseListQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional().nullable(),
  course_type: z.string().optional().nullable(),
});

export type CourseListQuery = z.infer<typeof courseListQuerySchema>;

export const intakePlanUpdateSchema = z.object({
  course_id: z.coerce.number().int().positive(),
  batch_year: z.coerce.number().int().min(2000).max(2100),
  intake_stream: z.string().trim().min(1).max(50),
  total_seats: z.coerce.number().int().min(0),
  general_open_seats: z.coerce.number().int().min(0).optional().nullable(),
  tfws_seats: z.coerce.number().int().min(0).optional().nullable(),
  ews_seats: z.coerce.number().int().min(0).optional().nullable(),
  reserved_breakdown: z.record(z.string(), z.unknown()).optional().nullable(),
});
