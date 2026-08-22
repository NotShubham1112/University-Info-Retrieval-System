/**
 * Exam validation — Task 8.
 * Re-exports schemas.ts DTOs and adds list/query + marks helpers.
 */
export {
  examCreateSchema,
  examUpdateSchema,
  examSubjectSchema,
  marksEntrySchema,
} from "./schemas";
export type { ExamCreateInput } from "./schemas";

import { z } from "zod";

export const examListQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional().nullable(),
  course_id: z.coerce.number().int().positive().optional().nullable(),
  semester_no: z.coerce.number().int().min(1).max(12).optional().nullable(),
  status: z.string().optional().nullable(),
  exam_type: z.string().optional().nullable(),
});

export type ExamListQuery = z.infer<typeof examListQuerySchema>;

export const examSubjectBatchSchema = z.object({
  subjects: z.array(
    z.object({
      subject_id: z.coerce.number().int().positive(),
      max_marks: z.coerce.number().min(1).max(1000),
      pass_marks: z.coerce.number().min(0).max(1000),
    })
  ).min(1).max(50),
});

export const publishExamSchema = z.object({
  mark_inactive_backlogs: z.boolean().optional().default(false),
});

export const marksBatchSchema = z.object({
  marks: z.array(
    z.object({
      student_id: z.coerce.number().int().positive(),
      subject_id: z.coerce.number().int().positive(),
      internal_marks: z.coerce.number().min(0).max(1000).optional().nullable(),
      external_marks: z.coerce.number().min(0).max(1000).optional().nullable(),
      attempt_number: z.coerce.number().int().min(1).default(1).optional(),
    })
  ).min(1).max(1000),
});

export type MarksBatchInput = z.infer<typeof marksBatchSchema>;
