export type SkySendNotificationType = "order" | "mission" | "payment" | "system";

export type SkySendNotification = {
  id: string;
  userId: string | null;
  title: string;
  message: string;
  type: SkySendNotificationType;
  read: boolean;
  actionUrl?: string | null;
  createdAt: string;
};

export type SkySendNotificationInput = {
  userId?: string | null;
  title: string;
  message: string;
  type: SkySendNotificationType;
  actionUrl?: string | null;
};

export type SkySendToastTone = "info" | "success" | "warning" | "destructive";

export type SkySendToast = {
  id: string;
  title: string;
  message?: string;
  tone: SkySendToastTone;
  durationMs: number;
  createdAt: number;
};

export type SkySendToastInput = {
  title: string;
  message?: string;
  tone?: SkySendToastTone;
  durationMs?: number;
  importance?: "normal" | "critical";
};
