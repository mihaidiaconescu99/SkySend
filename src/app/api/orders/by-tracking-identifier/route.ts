

import "server-only";

import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { normalizePublicTrackingCode } from "@/lib/recipient-tracking";
import type {
  CreatedDeliveryFulfillmentStatus,
  CreatedDeliveryOrder,
  CreatedDeliveryPaymentStatus,
  CreateDeliveryPayload,
} from "@/types/create-delivery";
import type { Order } from "@/types/order";

const MAX_IDENTIFIER_LENGTH = 200;

function mapPaymentStatus(status: string): CreatedDeliveryPaymentStatus {
  const map: Record<string, CreatedDeliveryPaymentStatus> = {
    paid: "paid",
    failed: "failed",
    refunded: "refunded",
    refund_pending: "refund_pending",
  };
  return map[status] ?? "unpaid";
}

function orderToTrackingShape(order: Order): CreatedDeliveryOrder {
  const pickup = order.selectedPickupHandoffPoint;
  const dropoff = order.selectedDropoffHandoffPoint;

  const payload = {
    userId: null,
    pickupAddress: {
      input: "",
      formattedAddress: "",
      notes: null,
      location: { latitude: 0, longitude: 0 },
      city: null,
      county: null,
      country: null,
      postalCode: null,
    },
    dropoffAddress: {
      input: "",
      formattedAddress: "",
      notes: null,
      location: { latitude: 0, longitude: 0 },
      city: null,
      county: null,
      country: null,
      postalCode: null,
    },
    selectedPickupPoint: {
      id: pickup?.id ?? "",
      label: pickup?.label ?? "",
      type: "handoff",
      description: "",
      location:
        (pickup as { location?: unknown })?.location ?? {
          latitude: 0,
          longitude: 0,
        },
      eligibilityState: "eligible",
      recommendationState: "none",
      smartScore: 0,
      distanceFromOriginMeters: 0,
    },
    selectedDropoffPoint: {
      id: dropoff?.id ?? "",
      label: dropoff?.label ?? "",
      type: "handoff",
      description: "",
      location:
        (dropoff as { location?: unknown })?.location ?? {
          latitude: 0,
          longitude: 0,
        },
      eligibilityState: "eligible",
      recommendationState: "none",
      smartScore: 0,
      distanceFromOriginMeters: 0,
    },
    parcel: {} as unknown,
    urgency: "standard",
    scheduledAt: order.scheduledAt,
    recommendedDroneClass: order.droneClass,
    estimatedPrice: {
      amountMinor: order.totalAmountMinor,
      currency: order.currency as "RON",
    },
    pricingSnapshot: order.pricingSnapshot as unknown,
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
    status: "scheduled",
    paymentStatus: mapPaymentStatus(order.paymentStatus),
    fulfillmentStatus:
      (order.fulfillmentStatus as CreatedDeliveryFulfillmentStatus) ??
      "order_created",
    publicTrackingCode: order.publicTrackingCode,
    recipientTrackingToken: order.recipientTrackingToken,
    stripePaymentIntentId: order.stripePaymentIntentId,
    paidAt: null,
    completedAt: null,
    refundStatus: order.refundStatus as CreatedDeliveryOrder["refundStatus"],
    href: `/client/orders/${order.localOrderId}`,
    payload,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const identifier = searchParams.get("identifier");

  if (!identifier || identifier.trim() === "" || identifier.length > MAX_IDENTIFIER_LENGTH) {
    return NextResponse.json({ error: "invalid_identifier" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const repo = new OrdersRepository(supabase);

  const normalised = normalizePublicTrackingCode(identifier);
  let result = await repo.getByPublicTrackingCode(normalised);

  if (!result.ok || result.data === null) {
    result = await repo.getByRecipientTrackingToken(identifier);
  }

  if (!result.ok) {
    console.warn(
      "[by-tracking-identifier] Repository error:",
      result.error.message,
    );
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  if (result.data === null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(orderToTrackingShape(result.data));
}
