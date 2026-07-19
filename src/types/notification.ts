

export type NotificationType = "order" | "mission" | "payment" | "system";

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "order",
  "mission",
  "payment",
  "system",
] as const;

export interface Notification {
  id: string;

  profileId: string | null;
  type: NotificationType;
  title: string;
  message: string;

  metadata: Record<string, unknown>;

  actionUrl: string | null;

  read: boolean;

  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationInput {

  profileId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  actionUrl?: string | null;
}

export interface UpdateNotificationInput {
  read?: boolean;
  readAt?: string | null;
}
