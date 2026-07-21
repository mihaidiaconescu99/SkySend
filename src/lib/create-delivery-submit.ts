import type {
  CreatedDeliveryFallbackOutcome,
  CreatedDeliveryFulfillmentStatus,
  CreatedDeliveryOrder,
  CreatedDeliveryPaymentStatus,
  CreateDeliveryPayload,
  CreateDeliverySubmitStatus,
} from "@/types/create-delivery";
import {
  generatePublicTrackingCode,
  generateRecipientTrackingToken,
} from "@/lib/recipient-tracking";

export const createdDeliveryOrdersChangedEvent = "skysend:created-orders-changed";

export function createLocalOrderId(createdAt: string) {
  const timestamp = Math.abs(Date.parse(createdAt) % 90000) + 10000;
  const entropy =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/\D/g, "").slice(0, 3)
      : Math.floor(Math.random() * 900 + 100).toString();

  return `SKY-PT-${timestamp}-${entropy.padEnd(3, "0")}`;
}

function getInitialOrderStatus(
  payload: CreateDeliveryPayload,
): CreateDeliverySubmitStatus {
  if (payload.coverageStatus === "review") {
    return "pending_review";
  }

  if (
    payload.urgency === "scheduled" &&
    payload.scheduledAt &&
    Date.parse(payload.scheduledAt) > Date.now()
  ) {
    return "pending_scheduled_start";
  }

  return "scheduled";
}

function buildCreatedOrder({
  id,
  payload,
  paymentStatus,
  stripePaymentIntentId,
  publicTrackingCode,
  recipientTrackingToken,
  paidAt,
}: {
  id: string;
  payload: CreateDeliveryPayload;
  paymentStatus: CreatedDeliveryPaymentStatus;
  stripePaymentIntentId?: string | null;
  publicTrackingCode: string;
  recipientTrackingToken: string;
  paidAt?: string | null;
}): CreatedDeliveryOrder {
  return {
    id,
    status: getInitialOrderStatus(payload),
    paymentStatus,
    fulfillmentStatus: "order_created",
    missionId: null,
    missionStatus: null,
    publicTrackingCode,
    recipientTrackingToken,
    stripePaymentIntentId: stripePaymentIntentId ?? null,
    paidAt:
      paidAt ?? (paymentStatus === "paid" ? new Date().toISOString() : null),
    completedAt: null,
    href: `/client/orders/${id}`,
    payload,
  };
}

export function subscribeCreatedDeliveryOrders() {
  return () => {};
}

export async function submitCreateDeliveryMock(
  payload: CreateDeliveryPayload,
  options?: {
    id?: string;
    paymentStatus?: CreatedDeliveryPaymentStatus;
    stripePaymentIntentId?: string | null;
    paidAt?: string | null;
  },
): Promise<CreatedDeliveryOrder> {
  return buildCreatedOrder({
    id: options?.id ?? createLocalOrderId(payload.createdAt),
    payload,
    paymentStatus: options?.paymentStatus ?? "unpaid",
    stripePaymentIntentId: options?.stripePaymentIntentId ?? null,
    publicTrackingCode: generatePublicTrackingCode(),
    recipientTrackingToken: generateRecipientTrackingToken(),
    paidAt: options?.paidAt,
  });
}

export async function submitCreateDelivery(
  payload: CreateDeliveryPayload,
  options?: {
    id?: string;
    paymentStatus?: CreatedDeliveryPaymentStatus;
    stripePaymentIntentId?: string | null;
    paidAt?: string | null;
  },
): Promise<CreatedDeliveryOrder> {
  if (typeof window === "undefined") {
    throw new Error("Order submission is only available in the browser.");
  }

  const id = options?.id ?? createLocalOrderId(payload.createdAt);
  const publicTrackingCode = generatePublicTrackingCode();
  const recipientTrackingToken = generateRecipientTrackingToken();
  const response = await fetch("/api/orders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payload,
      localOrderId: id,
      publicTrackingCode,
      recipientTrackingToken,
      paymentStatus: options?.paymentStatus ?? "unpaid",
      stripePaymentIntentId: options?.stripePaymentIntentId ?? null,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Comanda nu a putut fi salvata in baza de date.");
  }

  window.dispatchEvent(new Event(createdDeliveryOrdersChangedEvent));

  return buildCreatedOrder({
    id,
    payload,
    paymentStatus: options?.paymentStatus ?? "unpaid",
    stripePaymentIntentId: options?.stripePaymentIntentId ?? null,
    publicTrackingCode,
    recipientTrackingToken,
    paidAt: options?.paidAt,
  });
}

export function readCreatedDeliveryOrders(): CreatedDeliveryOrder[] {
  return [];
}

export function readCreatedDeliveryOrder(
  _orderId?: string,
): CreatedDeliveryOrder | null {
  void _orderId;
  return null;
}

export function readCreatedDeliveryOrderByRecipientTrackingToken(): CreatedDeliveryOrder | null {
  return null;
}

export function readCreatedDeliveryOrderByPublicTrackingCode(): CreatedDeliveryOrder | null {
  return null;
}

export function readCreatedDeliveryOrderByPublicTrackingIdentifier(): CreatedDeliveryOrder | null {
  return null;
}

let remoteStatusSyncBlockers = 0;

export function suspendCreatedDeliveryRemoteStatusSync() {
  remoteStatusSyncBlockers += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    remoteStatusSyncBlockers = Math.max(0, remoteStatusSyncBlockers - 1);
  };
}

function postOrderStatusUpdate(body: Record<string, unknown>) {
  if (typeof window === "undefined" || remoteStatusSyncBlockers > 0) return;
  void fetch("/api/orders/update-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(() => {
    window.dispatchEvent(new Event(createdDeliveryOrdersChangedEvent));
  });
}

export function updateCreatedDeliveryOrderPayment({
  orderId,
  paymentStatus,
  stripePaymentIntentId,
}: {
  orderId: string;
  paymentStatus: CreatedDeliveryPaymentStatus;
  stripePaymentIntentId?: string | null;
}): CreatedDeliveryOrder | null {
  postOrderStatusUpdate({
    orderId,
    paymentStatus,
    stripePaymentIntentId: stripePaymentIntentId ?? null,
  });

  return null;
}

export function updateCreatedDeliveryOrderFulfillment({
  orderId,
  fulfillmentStatus,
  fallbackReason,
}: {
  orderId: string;
  fulfillmentStatus: CreatedDeliveryFulfillmentStatus;
  missionId?: string | null;
  missionStatus?: string | null;
  completedAt?: string | null;
  fallbackReason?: string | null;
}): CreatedDeliveryOrder | null {
  postOrderStatusUpdate({
    orderId,
    fulfillmentStatus,
    fallbackReason: fallbackReason ?? null,
  });

  return null;
}

export async function markCreatedDeliveryOrderFallback({
  orderId,
  fallbackOutcome,
  fallbackReason,
}: {
  orderId: string;
  missionId?: string | null;
  missionStatus?: string | null;
  fallbackOutcome: CreatedDeliveryFallbackOutcome;
  fallbackReason: string;
  warehousePickupRequired?: boolean;
}): Promise<CreatedDeliveryOrder | null> {
  void fallbackOutcome;
  postOrderStatusUpdate({
    orderId,
    fulfillmentStatus: "failed_mission",
    fallbackReason,
  });

  return null;
}
