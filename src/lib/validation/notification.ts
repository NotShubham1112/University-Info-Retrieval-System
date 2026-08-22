/**
 * Notification validation — Task 8.
 * Re-exports schemas.ts DTOs and adds list/query + mark-read schemas.
 */
export {
  notificationCreateSchema,
} from "./schemas";
export type { NotificationCreateInput } from "./schemas";

import { z } from "zod";

export const notificationListQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  channel: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  student_id: z.coerce.number().int().positive().optional().nullable(),
  recipient_role: z.string().optional().nullable(),
  status: z.enum(["unread", "read", "archived"]).optional().nullable(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const markReadSchema = z.object({
  notification_id: z.coerce.number().int().positive().optional().nullable(),
  notification_recipient_id: z.coerce.number().int().positive().optional().nullable(),
  ids: z.array(z.coerce.number().int().positive()).optional().nullable(),
  mark_all: z.boolean().optional().default(false),
});

export const recipientsQuerySchema = z.object({
  notification_id: z.coerce.number().int().positive(),
});

export type RecipientsQuery = z.infer<typeof recipientsQuerySchema>;
