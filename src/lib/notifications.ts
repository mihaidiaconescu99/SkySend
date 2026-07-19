import type {
  SkySendNotification,
  SkySendNotificationInput,
} from "@/types/notifications";

const emptyNotificări: SkySendNotification[] = [];

function createNotificationId() {
  const entropy =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `ntf_${Date.now().toString(36)}_${entropy}`;
}

export function readNotificări(): SkySendNotification[] {
  return emptyNotificări;
}

export function subscribeNotificări() {
  return () => {};
}

export function createInAppNotification(input: SkySendNotificationInput) {
  const notification: SkySendNotification = {
    id: createNotificationId(),
    userId: input.userId ?? null,
    title: input.title,
    message: input.message,
    type: input.type,
    read: false,
    actionUrl: input.actionUrl ?? null,
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    void fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: notification.title,
        message: notification.message,
        type: notification.type,
        actionUrl: notification.actionUrl,
      }),
    });
  }

  return notification;
}

export function markNotificationAsRead() {}

export function markAllNotificăriAsRead() {}

export function deleteAllNotificari() {}

export function getUnreadNotificationCount() {
  return 0;
}
