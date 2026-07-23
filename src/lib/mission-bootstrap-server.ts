import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { activeHub } from "@/constants/hub";
import {
  completeOrderHandoffSnapshot,
  storedPointToDeliveryPoint,
} from "@/lib/meeting-point-snapshot";
import { buildMissionSegments, calculateHeadingDegrees } from "@/lib/mission-route";
import { MissionsRepository } from "@/lib/repositories/missions-repository";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import type { Database, Json } from "@/types/database";
import type { MissionMeetingPoint, MissionRoutePoint } from "@/types/mission";
import type { MissionRecord } from "@/types/mission-record";
import type { Order, StoredHandoffPoint } from "@/types/order";

function createPin() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(1000 + (values[0] % 9000));
}

function toMissionPoint(
  point: StoredHandoffPoint,
  origin: StoredHandoffPoint,
  index: number,
): MissionMeetingPoint {
  const deliveryPoint = storedPointToDeliveryPoint(point, origin);
  return {
    id: deliveryPoint.id,
    label: deliveryPoint.label,
    type: deliveryPoint.type,
    coordinates: deliveryPoint.location,
    distanceFromSelectedAddressMeters: deliveryPoint.distanceFromOriginMeters,
    confidence:
      deliveryPoint.smartScore >= 78
        ? "high"
        : deliveryPoint.smartScore >= 55
          ? "medium"
          : "low",
    reason: deliveryPoint.description,
    status: index === 0 ? "current" : "pending",
  };
}

function routePoint(point: StoredHandoffPoint): MissionRoutePoint {
  return { label: point.label, location: point.location };
}

function canStartImmediately(order: Order, now: Date) {
  const dispatchStartsAt = order.dispatchStartsAt
    ? Date.parse(order.dispatchStartsAt)
    : null;
  return (
    order.paymentStatus === "paid" &&
    (!order.scheduledAt || Date.parse(order.scheduledAt) <= now.getTime()) &&
    (dispatchStartsAt === null || dispatchStartsAt <= now.getTime())
  );
}

function getDispatchStartAt(order: Order, now: Date) {
  const value = order.dispatchStartsAt
    ? Date.parse(order.dispatchStartsAt)
    : now.getTime();
  return Number.isNaN(value) ? now.getTime() : value;
}

async function repairLegacyPredispatchMission(
  missions: MissionsRepository,
  order: Order,
  mission: MissionRecord,
) {
  if (
    !["mission_created", "preflight_checks"].includes(mission.currentStatus) ||
    mission.stepExpiresAt
  ) {
    return mission;
  }

  const snapshot = completeOrderHandoffSnapshot(order);
  const pickupOrigin = order.selectedPickupHandoffPoint ?? snapshot.pickup[0];
  const dropoffOrigin = order.selectedDropoffHandoffPoint ?? snapshot.dropoff[0];
  if (!pickupOrigin || !dropoffOrigin) return mission;

  const pickup = routePoint(snapshot.pickup[0] ?? pickupOrigin);
  const dropoff = routePoint(snapshot.dropoff[0] ?? dropoffOrigin);
  const segments = buildMissionSegments({
    missionId: `bootstrap:${order.localOrderId}`,
    pickup,
    dropoff,
    warehouse: activeHub,
  });
  const firstFlight = segments.find((segment) => segment.type === "warehouse_to_pickup");
  const runtime =
    mission.runtimeState &&
    typeof mission.runtimeState === "object" &&
    !Array.isArray(mission.runtimeState)
      ? { ...(mission.runtimeState as Record<string, unknown>) }
      : {};
  const now = new Date();
  const dispatchStartAt = getDispatchStartAt(order, now);
  runtime.pickup ??= pickup;
  runtime.dropoff ??= dropoff;
  runtime.dispatch = {
    startsAt: new Date(dispatchStartAt).toISOString(),
    flightDurationSeconds: firstFlight?.plannedDurationSeconds ?? 24,
    flightSegmentId: firstFlight?.id ?? null,
  };
  const updated = await missions.updateIfVersion(mission.id, mission.stateVersion, {
    currentStatus: "mission_created",
    stepStartedAt: new Date(dispatchStartAt).toISOString(),
    stepExpiresAt: new Date(dispatchStartAt).toISOString(),
    runtimeState: runtime as Json,
  });
  return updated.ok ? updated.data : mission;
}

export async function ensureOrderMission(
  db: SupabaseClient<Database>,
  order: Order,
): Promise<MissionRecord | null> {
  const missions = new MissionsRepository(db);
  const existing = await missions.getByOrderId(order.id);
  if (existing.ok && existing.data) {
    return repairLegacyPredispatchMission(missions, order, existing.data);
  }
  if (!existing.ok) return null;

  const snapshot = completeOrderHandoffSnapshot(order);
  const pickupOrigin = order.selectedPickupHandoffPoint ?? snapshot.pickup[0];
  const dropoffOrigin = order.selectedDropoffHandoffPoint ?? snapshot.dropoff[0];
  if (!pickupOrigin || !dropoffOrigin) return null;

  if (
    (order.handoffPointsSnapshot?.pickup.length ?? 0) < 4 ||
    (order.handoffPointsSnapshot?.dropoff.length ?? 0) < 4
  ) {
    await new OrdersRepository(db).updateById(order.id, {
      handoffPointsSnapshot: snapshot,
    });
  }

  const now = new Date();
  const startsNow = canStartImmediately(order, now);
  const dispatchStartAt = getDispatchStartAt(order, now);
  const pickup = routePoint(snapshot.pickup[0] ?? pickupOrigin);
  const dropoff = routePoint(snapshot.dropoff[0] ?? dropoffOrigin);
  const segments = buildMissionSegments({
    missionId: `bootstrap:${order.localOrderId}`,
    pickup,
    dropoff,
    warehouse: activeHub,
  });
  const firstFlight = segments.find((segment) => segment.type === "warehouse_to_pickup");
  const flightSeconds = firstFlight?.plannedDurationSeconds ?? 24;
  const dueAt = new Date(now.getTime() + flightSeconds * 1000).toISOString();
  const pickupMeetingPoints = snapshot.pickup.map((point, index) =>
    toMissionPoint(point, pickupOrigin, index),
  );
  const dropoffMeetingPoints = snapshot.dropoff.map((point, index) =>
    toMissionPoint(point, dropoffOrigin, index),
  );
  const runtimeState = {
    meetingPointAttempts: {
      pickupMeetingPoints,
      currentPickupMeetingPointIndex: 0,
      rejectedPickupMeetingPointIds: [],
      acceptedPickupMeetingPointId: null,
      pickupFallbackActiveated: false,
      dropoffMeetingPoints,
      currentDropoffMeetingPointIndex: 0,
      rejectedDropoffMeetingPointIds: [],
      acceptedDropoffMeetingPointId: null,
      dropoffFallbackActiveated: false,
    },
    pickup,
    dropoff,
    parcelLoaded: false,
    ...(startsNow
      ? {
          automaticTransition: {
            dueAt,
            toStatus: "awaiting_sender_position_confirmation" as const,
          },
          activeFlight: {
            phase: "pickup" as const,
            from: activeHub.address.location,
            to: pickup.location,
            startedAt: now.toISOString(),
            dueAt,
          },
        }
      : {
          dispatch: {
            startsAt: new Date(dispatchStartAt).toISOString(),
            flightDurationSeconds: flightSeconds,
            flightSegmentId: firstFlight?.id ?? null,
          },
        }),
  };
  const created = await missions.create({
    orderId: order.id,
    currentStatus: startsNow ? "en_route_to_pickup" : "mission_created",
    pickupPin: createPin(),
    dropoffPin: createPin(),
    stepStartedAt: startsNow ? now.toISOString() : new Date(dispatchStartAt).toISOString(),
    stepExpiresAt: startsNow ? dueAt : new Date(dispatchStartAt).toISOString(),
    runtimeState: runtimeState as unknown as Json,
  });
  if (!created.ok) {
    const raced = await missions.getByOrderId(order.id);
    return raced.ok ? raced.data : null;
  }

  if (!startsNow) return created.data;

  const updated = await missions.updateById(created.data.id, {
    startedAt: now.toISOString(),
    droneTelemetrySnapshot: {
      position: activeHub.address.location,
      heading: calculateHeadingDegrees(activeHub.address.location, pickup.location),
      speed: 0,
      segmentProgress: 0,
      segmentId: firstFlight?.id ?? null,
      altitudeMeters: 18,
      batteryPercent: 100,
      lastUpdatedAt: now.toISOString(),
    },
  });
  return updated.ok ? updated.data : created.data;
}
