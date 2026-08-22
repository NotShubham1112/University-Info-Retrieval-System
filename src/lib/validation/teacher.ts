/**
 * Teacher validation — Task 7.
 * Re-exports schemas.ts DTOs and provides list query + CSV helpers.
 */
export {
  teacherCreateSchema,
  teacherUpdateSchema,
  paginationSchema,
  searchQuerySchema,
} from "./schemas";
export type { TeacherCreateInput } from "./schemas";

import { z } from "zod";

export const teacherListQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional().nullable(),
  department_id: z.coerce.number().int().positive().optional().nullable(),
  status: z.string().optional().nullable(),
});

export type TeacherListQuery = z.infer<typeof teacherListQuerySchema>;
