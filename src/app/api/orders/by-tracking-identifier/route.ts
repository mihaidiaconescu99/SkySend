

import "server-only";

import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { AddressesRepository } from "@/lib/repositories/addresses-repository";
import { normalizeTrackingIdentifier } from "@/lib/recipient-tracking";
import { resolveTrackingToken } from "@/lib/tracking-access-server";
import type { TrackingAccessScope } from "@/lib/tracking-access-server";
import { MissionsRepository } from "@/lib/repositories/missions-repository";
import { expireMissionIfDue } from "@/lib/mission-expiration-server";
import type {
  CreatedDeliveryFulfillmentStatus,
  CreatedDeliveryOrder,
  CreatedDeliveryPaymentStatus,
  CreateDeliveryPayload,
} from "@/types/create-delivery";
import type { Order } from "@/types/order";
import type { MissionRecord } from "@/types/mission-record";
import type { Address } from "@/types/address";
import {
  completeOrderHandoffSnapshot,
  storedPointToDeliveryPoint,
} from "@/lib/meeting-point-snapshot";
import { ensureOrderMission } from "@/lib/mission-bootstrap-server";

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

function orderToTrackingShape(
  order: Order,
  trackingAccessScope: TrackingAccessScope,
  identifier: string,
  mission?: MissionRecord | null,
  pickupAddress?: Address | null,
  dropoffAddress?: Address | null,
): CreatedDeliveryOrder {
  const pickup = order.selectedPickupHandoffPoint;
  const dropoff = order.selectedDropoffHandoffPoint;
  const handoffSnapshot = completeOrderHandoffSnapshot(order);
  const pickupOrigin = pickup ?? handoffSnapshot.pickup[0];
  const dropoffOrigin = dropoff ?? handoffSnapshot.dropoff[0];

  const payload = {
    userId: null,
    pickupAddress: {
      input: pickupAddress?.formattedAddress ?? "",
      formattedAddress: pickupAddress?.formattedAddress ?? "",
      notes: null,
      location: {
        latitude: pickupAddress?.latitude ?? 0,
        longitude: pickupAddress?.longitude ?? 0,
      },
      city: pickupAddress?.city ?? null,
      county: pickupAddress?.county ?? null,
      country: pickupAddress?.country ?? null,
      postalCode: pickupAddress?.postalCode ?? null,
    },
    dropoffAddress: {
      input: dropoffAddress?.formattedAddress ?? "",
      formattedAddress: dropoffAddress?.formattedAddress ?? "",
      notes: null,
      location: {
        latitude: dropoffAddress?.latitude ?? 0,
        longitude: dropoffAddress?.longitude ?? 0,
      },
      city: dropoffAddress?.city ?? null,
      county: dropoffAddress?.county ?? null,
      country: dropoffAddress?.country ?? null,
      postalCode: dropoffAddress?.postalCode ?? null,
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
    pickupMeetingPoints: pickupOrigin
      ? handoffSnapshot.pickup.map((point) =>
          storedPointToDeliveryPoint(point, pickupOrigin),
        )
      : [],
    dropoffMeetingPoints: dropoffOrigin
      ? handoffSnapshot.dropoff.map((point) =>
          storedPointToDeliveryPoint(point, dropoffOrigin),
        )
      : [],
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
    paidAt: order.paidAt,
    dispatchStartsAt: order.dispatchStartsAt,
    completedAt: mission?.completedAt ?? null,
    refundStatus: order.refundStatus as CreatedDeliveryOrder["refundStatus"],
    publicCodeAccessMode: order.publicCodeAccessMode,
    trackingAccessScope,
    trackingIdentifier: identifier,
    missionId: mission?.id ?? null,
    missionStatus: mission?.currentStatus ?? null,
    missionStepStartedAt: mission?.stepStartedAt ?? null,
    missionStepExpiresAt: mission?.stepExpiresAt ?? null,
    missionFailureCode: mission?.failureCode ?? null,
    missionStateVersion: mission?.stateVersion,
    missionRuntimeState: mission?.runtimeState,
    missionDroneTelemetry: mission?.droneTelemetrySnapshot,
    missionPickupPin: mission?.pickupPin ?? null,
    missionDropoffPin: mission?.dropoffPin ?? null,
    missionStartedAt: mission?.startedAt ?? null,
    missionUpdatedAt: mission?.updatedAt ?? null,
    fallbackReason: mission?.fallbackReason ?? null,
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

  const normalised = normalizeTrackingIdentifier(identifier);
  let scope: TrackingAccessScope = "view";
  let result = normalised.startsWith("SKY-PT-")
    ? await repo.getByLocalOrderId(normalised)
    : await repo.getByPublicTrackingCode(normalised);

  if (result.ok && result.data) {
    scope = result.data.publicCodeAccessMode === "control" ? "full" : "view";
  }

  if (!result.ok || result.data === null) {
    result = await repo.getByRecipientTrackingToken(identifier);
    if (result.ok && result.data) scope = "full";
  }

  if (!result.ok || result.data === null) {
    const link = await resolveTrackingToken(supabase, identifier);
    if (link) {
      result = await repo.getById(link.order_id);
      scope = link.scope as TrackingAccessScope;
    }
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

  let mission = await new MissionsRepository(supabase).getByOrderId(result.data.id);
  if (
    mission.ok &&
    result.data.paymentStatus === "paid" &&
    result.data.status !== "completed" &&
    result.data.status !== "failed"
  ) {
    const ensuredMission = await ensureOrderMission(supabase, result.data);
    if (ensuredMission) mission = { ok: true, data: ensuredMission };
  }
  if (mission.ok && mission.data && (await expireMissionIfDue(supabase, mission.data))) {
    const refreshed = await repo.getById(result.data.id);
    if (refreshed.ok && refreshed.data) result = refreshed;
    const refreshedOrderId = result.ok && result.data ? result.data.id : null;
    if (refreshedOrderId) {
      mission = await new MissionsRepository(supabase).getByOrderId(refreshedOrderId);
    }
  }

  const order = result.ok ? result.data : null;
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const addresses = new AddressesRepository(supabase);
  const [pickupAddressResult, dropoffAddressResult] = await Promise.all([
    addresses.getById(order.pickupAddressId),
    addresses.getById(order.dropoffAddressId),
  ]);

  return NextResponse.json(
    orderToTrackingShape(
      order,
      scope,
      identifier,
      mission.ok ? mission.data : null,
      pickupAddressResult.ok ? pickupAddressResult.data : null,
      dropoffAddressResult.ok ? dropoffAddressResult.data : null,
    ),
  );
}
