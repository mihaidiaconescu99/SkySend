import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { orderLookupIdSchema } from "@/lib/stripe/input-schemas";
import type {
  CreatedDeliveryFulfillmentStatus,
  CreatedDeliveryOrder,
  CreatedDeliveryPaymentStatus,
  CreateDeliveryPayload,
} from "@/types/create-delivery";
import type { Order } from "@/types/order";

function mapPaymentStatus(status: string): CreatedDeliveryPaymentStatus {
  const map: Record<string, CreatedDeliveryPaymentStatus> = {
    paid: "paid",
    failed: "failed",
    refunded: "refunded",
    refund_pending: "refund_pending",
  };
  return map[status] ?? "unpaid";
}

function orderToCreatedDelivery(order: Order): CreatedDeliveryOrder {
  const pickup = order.selectedPickupHandoffPoint;
  const dropoff = order.selectedDropoffHandoffPoint;
  const payload = {
    userId: order.senderProfileId,
    pickupAddress: {
      input: pickup?.label ?? "",
      formattedAddress: pickup?.label ?? "",
      notes: null,
      location: pickup?.location ?? { latitude: 0, longitude: 0 },
      city: null,
      county: null,
      country: null,
      postalCode: null,
    },
    dropoffAddress: {
      input: dropoff?.label ?? "",
      formattedAddress: dropoff?.label ?? "",
      notes: null,
      location: dropoff?.location ?? { latitude: 0, longitude: 0 },
      city: null,
      county: null,
      country: null,
      postalCode: null,
    },
    selectedPickupPoint: {
      id: pickup?.id ?? `${order.localOrderId}:pickup`,
      label: pickup?.label ?? "Punct ridicare",
      type: "handoff",
      description: pickup?.label ?? "",
      location: pickup?.location ?? { latitude: 0, longitude: 0 },
      eligibilityState: "eligible",
      recommendationState: "none",
      smartScore: pickup?.smartScore ?? 0,
      distanceFromOriginMeters: 0,
    },
    selectedDropoffPoint: {
      id: dropoff?.id ?? `${order.localOrderId}:dropoff`,
      label: dropoff?.label ?? "Punct livrare",
      type: "handoff",
      description: dropoff?.label ?? "",
      location: dropoff?.location ?? { latitude: 0, longitude: 0 },
      eligibilityState: "eligible",
      recommendationState: "none",
      smartScore: dropoff?.smartScore ?? 0,
      distanceFromOriginMeters: 0,
    },
    parcel: {} as unknown,
    urgency: order.dispatchTiming === "scheduled" ? "scheduled" : order.dispatchTiming,
    scheduledAt: order.scheduledAt,
    recommendedDroneClass: order.droneClass,
    estimatedPrice: {
      amountMinor: order.totalAmountMinor,
      currency: order.currency as "RON",
    },
    pricingSnapshot: {
      ...order.pricingSnapshot,
      currency: order.currency,
      total: {
        amountMinor: order.totalAmountMinor,
        currency: order.currency,
      },
    } as unknown,
    estimatedEcoMetrics: {
      estimatedCo2SavedGrams: 0,
      estimatedRoadDistanceSavedKm: 0,
      estimatedEnergyUseKwh: 0,
    },
    estimatedEta: {
      minMinutes: order.etaMinMinutes ?? 0,
      maxMinutes: order.etaMaxMinutes ?? 0,
    },
    coverageStatus: "available",
    coverageSummary: {} as unknown,
    createdAt: order.createdAt,
  } as unknown as CreateDeliveryPayload;

  return {
    id: order.localOrderId,
    status: order.scheduledAt ? "pending_scheduled_start" : "scheduled",
    paymentStatus: mapPaymentStatus(order.paymentStatus),
    fulfillmentStatus:
      (order.fulfillmentStatus as CreatedDeliveryFulfillmentStatus) ??
      "order_created",
    publicTrackingCode: order.publicTrackingCode,
    recipientTrackingToken: order.recipientTrackingToken,
    stripePaymentIntentId: order.stripePaymentIntentId,
    paidAt: order.paidAt,
    dispatchStartsAt: order.dispatchStartsAt,
    completedAt: order.status === "completed" ? order.updatedAt : null,
    refundStatus: order.refundStatus as CreatedDeliveryOrder["refundStatus"],
    href: `/client/orders/${order.localOrderId}`,
    payload,
  };
}

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const orderId = new URL(request.url).searchParams.get("orderId");
  const parsedOrderId = orderLookupIdSchema.safeParse(orderId);
  if (!parsedOrderId.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  const supabase = createAdminSupabaseClient();
  const profiles = new ProfilesRepository(supabase);
  const orders = new OrdersRepository(supabase);
  const profile = await profiles.getByClerkUserId(userId);

  if (!profile.ok || !profile.data) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  let orderResult = await orders.getByLocalOrderId(parsedOrderId.data);

  if (orderResult.ok && !orderResult.data) {
    orderResult = await orders.getById(parsedOrderId.data);
  }

  if (!orderResult.ok) {
    return NextResponse.json({ error: "Order lookup failed." }, { status: 502 });
  }

  if (!orderResult.data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (orderResult.data.senderProfileId !== profile.data.id) {
    return NextResponse.json(
      { error: "Order does not belong to this account." },
      { status: 403 },
    );
  }

  if (["pending", "failed"].includes(orderResult.data.paymentStatus)) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json(orderToCreatedDelivery(orderResult.data));
}
