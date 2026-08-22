/** Notifications shared types — Task 8 */

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
  recipient_count?: number;
  unread_count?: number;
}

export interface NotificationRecipientRow {
  id: number;
  notification_id: number;
  recipient_role: string | null;
  student_id: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationListResponse {
  data: NotificationRow[];
  nextCursor: string | null;
}

export interface RecipientsResponse {
  data: NotificationRecipientRow[];
}
