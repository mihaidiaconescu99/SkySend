import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { MissionsRepository } from "@/lib/repositories/missions-repository";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import type { Database } from "@/types/database";
import type { PremiumFailureCode } from "@/lib/mission-progress";
import type { MissionRecord, MissionStatus } from "@/types/mission-record";
import type { Json } from "@/types/database";
import { expireTrackingLinksAfterTerminal } from "@/lib/tracking-access-server";
import { activeHub } from "@/constants/hub";
import { calculateHeadingDegrees } from "@/lib/mission-route";

const timeoutFailureByStatus: Partial<Record<MissionStatus, PremiumFailureCode>> = {
  awaiting_sender_position_confirmation: "pickup_confirmation_timeout",
  awaiting_parcel_load: "pickup_load_timeout",
  awaiting_recipient_position_confirmation: "dropoff_confirmation_timeout",
  awaiting_parcel_collection: "dropoff_collection_timeout",
};

export async function expireMissionIfDue(
  db: SupabaseClient<Database>,
  mission: MissionRecord,
  now = new Date(),
) {
  if (!mission.stepExpiresAt || Date.parse(mission.stepExpiresAt) > now.getTime()) {
    return false;
  }
  const runtime =
    mission.runtimeState &&
    typeof mission.runtimeState === "object" &&
    !Array.isArray(mission.runtimeState)
      ? { ...(mission.runtimeState as Record<string, unknown>) }
      : {};
  const dispatch = runtime.dispatch;
  if (
    mission.currentStatus === "mission_created" &&
    dispatch &&
    typeof dispatch === "object" &&
    !Array.isArray(dispatch)
  ) {
    const dispatchState = dispatch as Record<string, unknown>;
    const flightDurationSeconds =
      typeof dispatchState.flightDurationSeconds === "number" &&
      dispatchState.flightDurationSeconds > 0
        ? Math.round(dispatchState.flightDurationSeconds)
        : 24;
    const pickup = runtime.pickup;
    if (
      !pickup ||
      typeof pickup !== "object" ||
      Array.isArray(pickup) ||
      !((pickup as Record<string, unknown>).location) ||
      typeof (pickup as Record<string, unknown>).location !== "object" ||
      Array.isArray((pickup as Record<string, unknown>).location)
    ) {
      return false;
    }
    const destination = (pickup as Record<string, { latitude?: unknown; longitude?: unknown }>).location;
    if (
      typeof destination.latitude !== "number" ||
      typeof destination.longitude !== "number"
    ) {
      return false;
    }
    const dispatchedAt = now.toISOString();
    const dueAt = new Date(now.getTime() + flightDurationSeconds * 1000).toISOString();
    runtime.automaticTransition = {
      dueAt,
      toStatus: "awaiting_sender_position_confirmation",
    };
    runtime.activeFlight = {
      phase: "pickup",
      from: activeHub.address.location,
      to: { latitude: destination.latitude, longitude: destination.longitude },
      startedAt: dispatchedAt,
      dueAt,
    };
    delete runtime.dispatch;
    const updated = await new MissionsRepository(db).updateIfVersion(
      mission.id,
      mission.stateVersion,
      {
        currentStatus: "en_route_to_pickup",
        startedAt: mission.startedAt ?? dispatchedAt,
        stepStartedAt: dispatchedAt,
        stepExpiresAt: dueAt,
        runtimeState: runtime as Json,
        droneTelemetrySnapshot: {
          ...mission.droneTelemetrySnapshot,
          position: activeHub.address.location,
          heading: calculateHeadingDegrees(
            activeHub.address.location,
            { latitude: destination.latitude, longitude: destination.longitude },
          ),
          speed: 0,
          segmentProgress: 0,
          segmentId:
            typeof dispatchState.flightSegmentId === "string"
              ? dispatchState.flightSegmentId
              : null,
          altitudeMeters: 18,
          batteryPercent: 100,
          lastUpdatedAt: dispatchedAt,
        },
      },
    );
    return updated.ok;
  }
  const automatic = runtime.automaticTransition;
  if (
    (mission.currentStatus === "en_route_to_pickup" ||
      mission.currentStatus === "en_route_to_dropoff") &&
    automatic &&
    typeof automatic === "object" &&
    !Array.isArray(automatic)
  ) {
    const transition = automatic as Record<string, unknown>;
    const expectedTarget =
      mission.currentStatus === "en_route_to_pickup"
        ? "awaiting_sender_position_confirmation"
        : "awaiting_recipient_position_confirmation";
    if (transition.toStatus === expectedTarget) {
      const { data } = await db
        .from("operational_settings")
        .select("confirmation_timer_minutes")
        .eq("id", "default")
        .maybeSingle();
      const confirmationMinutes =
        typeof data?.confirmation_timer_minutes === "number" &&
        data.confirmation_timer_minutes > 0
          ? data.confirmation_timer_minutes
          : 10;
      const activeFlight = runtime.activeFlight;
      const attempts = runtime.meetingPointAttempts;
      let arrivalPosition = mission.droneTelemetrySnapshot.position;
      if (
        activeFlight &&
        typeof activeFlight === "object" &&
        !Array.isArray(activeFlight) &&
        attempts &&
        typeof attempts === "object" &&
        !Array.isArray(attempts)
      ) {
        const attemptState = attempts as Record<string, unknown>;
        const flightState = activeFlight as Record<string, unknown>;
        const destination = flightState.to;
        if (
          destination &&
          typeof destination === "object" &&
          !Array.isArray(destination) &&
          typeof (destination as Record<string, unknown>).latitude === "number" &&
          typeof (destination as Record<string, unknown>).longitude === "number"
        ) {
          arrivalPosition = {
            latitude: (destination as Record<string, number>).latitude,
            longitude: (destination as Record<string, number>).longitude,
          };
        }
        const phase = mission.currentStatus === "en_route_to_pickup" ? "pickup" : "dropoff";
        const pointsKey = phase === "pickup" ? "pickupMeetingPoints" : "dropoffMeetingPoints";
        const indexKey = phase === "pickup" ? "currentPickupMeetingPointIndex" : "currentDropoffMeetingPointIndex";
        const points = Array.isArray(attemptState[pointsKey])
          ? (attemptState[pointsKey] as Array<Record<string, unknown>>)
          : [];
        const index = typeof attemptState[indexKey] === "number" ? attemptState[indexKey] : 0;
        if (points[index]) points[index].status = "current";
        attemptState[pointsKey] = points;
        runtime.meetingPointAttempts = attemptState;
      }
      delete runtime.automaticTransition;
      delete runtime.activeFlight;
      const arrivedAt = now.toISOString();
      const updated = await new MissionsRepository(db).updateIfVersion(
        mission.id,
        mission.stateVersion,
        {
          currentStatus: expectedTarget,
          stepStartedAt: arrivedAt,
          stepExpiresAt: new Date(
            now.getTime() + confirmationMinutes * 60_000,
          ).toISOString(),
          runtimeState: runtime as Json,
          droneTelemetrySnapshot: {
            ...mission.droneTelemetrySnapshot,
            position: arrivalPosition,
            speed: 0,
            segmentProgress: 1,
            lastUpdatedAt: arrivedAt,
          },
        },
      );
      return updated.ok;
    }
  }
  const failureCode = timeoutFailureByStatus[mission.currentStatus];
  if (!failureCode || mission.failedAt) return false;

  const failedAt = now.toISOString();
  const updated = await new MissionsRepository(db).updateIfVersion(
    mission.id,
    mission.stateVersion,
    {
      currentStatus: "mission_failed",
      failureCode,
      failedAt,
      completedAt: failedAt,
      stepExpiresAt: null,
      fallbackReason: failureCode,
    },
  );
  if (!updated.ok) return false;

  await new OrdersRepository(db).updateById(mission.orderId, {
    status: "failed",
    fulfillmentStatus: "failed_mission",
    refundStatus: "not_required",
    notes: failureCode,
  });
  await expireTrackingLinksAfterTerminal(db, mission.orderId, now);
  return true;
}
