import { createInAppNotification } from "@/lib/notifications";
import { showToast } from "@/lib/toast-store";
import { areEmailNotificăriEnabled } from "@/lib/notification-preferences";
import { getRecipientTrackingPath } from "@/lib/recipient-tracking";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";
import type { MissionStatus } from "@/types/mission";

type NotificationContext = {
  userId?: string | null;
  email?: string | null;
};

export function notifyOrderConfirmation(order: CreatedDeliveryOrder) {
  const scheduled = order.payload.urgency === "scheduled" && Boolean(order.payload.scheduledAt);
  const ro = typeof document === "undefined" || document.documentElement.lang !== "en";
  showToast({
    title: ro ? "Comandă plasată" : "Order placed",
    message: ro ? "Plata a fost confirmată. Pregătim livrarea." : "Payment is confirmed. We are preparing your delivery.",
    tone: "success",
  });
  showToast({
    title: scheduled
      ? (ro ? "Livrare programată" : "Delivery scheduled")
      : (ro ? "Livrarea este pregătită" : "Delivery is ready"),
    message: scheduled
      ? (ro ? "Am rezervat data și ora alese." : "We reserved your chosen date and time.")
      : (ro ? "Urmărirea este disponibilă în Livrare activă." : "Tracking is available in Active delivery."),
    tone: "info",
  });
}

function getAbsoluteUrl(path: string) {
  if (typeof window !== "undefined") {
    return new URL(path, window.location.origin).toString();
  }

  return path;
}

function sendEmailEvent({
  event,
  email,
  order,
  trackingPath,
}: {
  event:
    | "order_confirmation"
    | "payment_confirmation"
    | "recipient_tracking_link"
    | "delivery_completed"
    | "order_cancelled";
  email?: string | null;
  order: CreatedDeliveryOrder;
  trackingPath?: string | null;
}) {
  if (!email || typeof window === "undefined" || !areEmailNotificăriEnabled()) {
    return;
  }

  void fetch("/api/notifications/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event,
      to: email,
      orderId: order.id,
      trackingUrl: trackingPath ? getAbsoluteUrl(trackingPath) : null,
    }),
  }).catch(() => undefined);
}

export function notifyOrderPlaced(
  order: CreatedDeliveryOrder,
  context: NotificationContext = {},
) {
  showToast({
    title: "Comandă confirmată",
    message: "Livrarea cu dronă a fost creată.",
    tone: "success",
  });
  createInAppNotification({
    userId: context.userId,
    title: "Comandă confirmată",
    message: "Livrarea cu dronă a fost creată.",
    type: "order",
    actionUrl: order.href,
  });
  sendEmailEvent({
    event: "order_confirmation",
    email: context.email,
    order,
  });
}

export function notifyTrackingAvailable(
  order: CreatedDeliveryOrder,
  context: NotificationContext = {},
) {
  const trackingPath = getRecipientTrackingPath({
    code: order.publicTrackingCode,
    token: order.recipientTrackingToken,
  });

  showToast({
    title: "Tracking disponibil",
    message: "Urmărirea live este pregătită.",
    tone: "info",
  });
  createInAppNotification({
    userId: context.userId,
    title: "Tracking disponibil",
    message: "Urmărirea live este pregătită.",
    type: "mission",
    actionUrl: order.href,
  });
  sendEmailEvent({
    event: "recipient_tracking_link",
    email: context.email,
    order,
    trackingPath,
  });
}

export function notifyPaymentConfirmed(
  order: CreatedDeliveryOrder,
  context: NotificationContext = {},
) {
  showToast({
    title: "Plată securizată",
    message: "SkySend pregătește dispatch-ul.",
    tone: "success",
  });
  createInAppNotification({
    userId: context.userId,
    title: "Plată securizată",
    message: "SkySend pregătește dispatch-ul.",
    type: "payment",
    actionUrl: order.href,
  });
  sendEmailEvent({
    event: "payment_confirmation",
    email: context.email,
    order,
    trackingPath: order.href,
  });
}

export function notifyOrderCancelled(
  order: CreatedDeliveryOrder,
  context: NotificationContext = {},
) {
  showToast({
    title: "Comandă anulată",
    message: "Dispatch-ul a fost oprit înainte de decolare.",
    tone: "warning",
  });
  createInAppNotification({
    userId: context.userId,
    title: "Comandă anulată",
    message: "Dispatch-ul a fost oprit înainte de decolare.",
    type: "order",
    actionUrl: order.href,
  });
  sendEmailEvent({
    event: "order_cancelled",
    email: context.email,
    order,
  });
}

export function notifyDeliveryCompleted(
  order: CreatedDeliveryOrder,
  context: NotificationContext = {},
) {
  showToast({
    title: "Livrare finalizată",
    message: "Coletul a fost livrat cu succes.",
    tone: "success",
  });
  createInAppNotification({
    userId: context.userId,
    title: "Livrare finalizată",
    message: "Coletul a fost livrat cu succes.",
    type: "mission",
    actionUrl: order.href,
  });
  sendEmailEvent({
    event: "delivery_completed",
    email: context.email,
    order,
  });
}

export function notifyMissionStatus({
  order,
  status,
  droneLabel,
  context = {},
}: {
  order: CreatedDeliveryOrder;
  status: MissionStatus | null;
  droneLabel: string;
  context?: NotificationContext;
}) {
  const notificationByStatus: Partial<
    Record<MissionStatus, { title: string; message: string; tone: "info" | "success" }>
  > = {
    preflight_checks: {
      title: "Dronă alocată",
      message: `${droneLabel} se pregătește pentru dispatch.`,
      tone: "info",
    },
    arrived_at_pickup: {
      title: "Drona a ajuns la ridicare",
      message: "Drona este la punctul de întâlnire pentru ridicare.",
      tone: "info",
    },
    parcel_secured: {
      title: "Colet securizat",
      message: "Coletul este blocat în locker și pregătit pentru zbor.",
      tone: "success",
    },
    en_route_to_dropoff: {
      title: "Drona zboară spre destinatar",
      message: "Drona zboară acum spre punctul de livrare.",
      tone: "info",
    },
    arrived_at_dropoff: {
      title: "Drona a ajuns la livrare",
      message: "Drona este la punctul de întâlnire al destinatarului.",
      tone: "info",
    },
  };
  const notification = status ? notificationByStatus[status] : null;

  if (!notification) {
    return;
  }

  showToast({
    title: notification.title,
    message: notification.message,
    tone: notification.tone,
  });
  createInAppNotification({
    userId: context.userId,
    title: notification.title,
    message: notification.message,
    type: "mission",
    actionUrl: order.href,
  });
}
