import type { CreatedDeliveryOrder } from "@/types/create-delivery";

export function getScheduledDeliveryStartMs(
  order: CreatedDeliveryOrder,
): number | null {
  if (order.payload.urgency !== "scheduled" || !order.payload.scheduledAt) {
    return null;
  }

  const startMs = Date.parse(order.payload.scheduledAt);

  return Number.isNaN(startMs) ? null : startMs;
}

export function isScheduledDeliveryWaiting(
  order: CreatedDeliveryOrder,
  nowMs = Date.now(),
) {
  const startMs = getScheduledDeliveryStartMs(order);

  return (
    startMs !== null &&
    startMs > nowMs &&
    order.fulfillmentStatus !== "active_mission" &&
    order.fulfillmentStatus !== "completed_mission" &&
    order.fulfillmentStatus !== "failed_mission" &&
    order.fulfillmentStatus !== "fallback_required" &&
    order.fulfillmentStatus !== "canceled"
  );
}

export function formatScheduledDeliveryDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatScheduledDeliveryCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}z ${hours}h ${minutes}m ${seconds}s`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}
