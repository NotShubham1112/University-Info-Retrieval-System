/**
 * Timetable validation — Task 8.
 * Re-exports schemas.ts DTOs and adds list/query + conflict helpers.
 */
export {
  timetableCreateSchema,
  timetableUpdateSchema,
} from "./schemas";
export type { TimetableCreateInput } from "./schemas";

import { z } from "zod";

export const timetableListQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional().nullable(),
  course_id: z.coerce.number().int().positive().optional().nullable(),
  semester_no: z.coerce.number().int().min(1).max(12).optional().nullable(),
  day_of_week: z.coerce.number().int().min(0).max(7).optional().nullable(),
  teacher_id: z.coerce.number().int().positive().optional().nullable(),
  room_id: z.coerce.number().int().positive().optional().nullable(),
  subject_id: z.coerce.number().int().positive().optional().nullable(),
});

export type TimetableListQuery = z.infer<typeof timetableListQuerySchema>;

/** Conflict error shape returned when validation finds collision */
export interface TimetableConflict {
  type: "teacher_busy" | "room_double_booked" | "slot_taken";
  message: string;
  conflictingId?: number;
}
