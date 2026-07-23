import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { MissionsRepository } from "@/lib/repositories/missions-repository";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { processEligibleRefund } from "@/lib/refund-reconciliation-server";
import {
  expireTrackingLinksAfterTerminal,
  isOrderTerminal,
  resolveTrackingToken,
  type TrackingAccessScope,
} from "@/lib/tracking-access-server";
import { normalizeTrackingIdentifier } from "@/lib/recipient-tracking";
import type { Json } from "@/types/database";
import type { Order } from "@/types/order";
import { calculateDistanceKm } from "@/lib/mission-route";
import { expireMissionIfDue } from "@/lib/mission-expiration-server";
import { ensureOrderMission } from "@/lib/mission-bootstrap-server";

type Context = { params: Promise<{ identifier: string }> };

const bodySchema = z.object({
  action: z.enum(["confirm_position", "next_point", "parcel_loaded", "parcel_delivered"]),
  expectedVersion: z.number().int().nonnegative().optional(),
});

type RuntimeState = {
  meetingPointAttempts?: {
    currentPickupMeetingPointIndex?: number;
    currentDropoffMeetingPointIndex?: number;
    pickupMeetingPoints?: RuntimeMeetingPoint[];
    dropoffMeetingPoints?: RuntimeMeetingPoint[];
    rejectedPickupMeetingPointIds?: string[];
    rejectedDropoffMeetingPointIds?: string[];
    acceptedPickupMeetingPointId?: string | null;
    acceptedDropoffMeetingPointId?: string | null;
  };
  parcelLoaded?: boolean;
  automaticTransition?: {
    dueAt: string;
    toStatus:
      | "awaiting_sender_position_confirmation"
      | "awaiting_recipient_position_confirmation";
  };
  activeFlight?: {
    phase: "pickup" | "dropoff";
    from: { latitude: number; longitude: number };
    to: { latitude: number; longitude: number };
    startedAt: string;
    dueAt: string;
  };
  [key: string]: unknown;
};

type RuntimeMeetingPoint = {
  id: string;
  label?: string;
  status?: string;
  coordinates?: { latitude: number; longitude: number };
  location?: { latitude: number; longitude: number };
};

async function resolveOrder(identifier: string) {
  const db = createAdminSupabaseClient();
  const orders = new OrdersRepository(db);
  const normalized = normalizeTrackingIdentifier(identifier);
  let orderResult = normalized.startsWith("SKY-PT-")
    ? await orders.getByLocalOrderId(normalized)
    : await orders.getByPublicTrackingCode(normalized);
  let scope: TrackingAccessScope = "view";

  if (orderResult.ok && orderResult.data) {
    scope = orderResult.data.publicCodeAccessMode === "control" ? "full" : "view";
  } else {
    orderResult = await orders.getByRecipientTrackingToken(identifier);
    if (orderResult.ok && orderResult.data) scope = "full";
  }

  if (!orderResult.ok || !orderResult.data) {
    const link = await resolveTrackingToken(db, identifier);
    if (link) {
      orderResult = await orders.getById(link.order_id);
      scope = link.scope as TrackingAccessScope;
    }
  }

  const { userId } = await auth();
  if (userId && orderResult.ok && orderResult.data) {
    const profile = await new ProfilesRepository(db).getByClerkUserId(userId);
    if (profile.ok && profile.data?.id === orderResult.data.senderProfileId) scope = "owner";
  }

  return { db, orders, order: orderResult.ok ? orderResult.data : null, scope };
}

function hasCapability(scope: TrackingAccessScope, phase: "pickup" | "dropoff") {
  return scope === "owner" || scope === "full" || scope === phase;
}

async function getTimeoutMinutes(db: ReturnType<typeof createAdminSupabaseClient>, column: "loading_timer_minutes" | "unloading_timer_minutes") {
  const { data } = await db
    .from("operational_settings")
    .select("loading_timer_minutes,unloading_timer_minutes")
    .eq("id", "default")
    .maybeSingle();
  const value = data?.[column];
  return typeof value === "number" && value > 0 ? value : 10;
}

function pointStateForOrder(order: Order, runtime: RuntimeState, phase: "pickup" | "dropoff") {
  const attempts = runtime.meetingPointAttempts ?? {};
  const snapshotPoints = phase === "pickup"
    ? order.handoffPointsSnapshot?.pickup
    : order.handoffPointsSnapshot?.dropoff;
  const points = phase === "pickup"
    ? attempts.pickupMeetingPoints ?? snapshotPoints?.map((point) => ({ id: point.id, label: point.label, coordinates: point.location, status: "pending" })) ?? []
    : attempts.dropoffMeetingPoints ?? snapshotPoints?.map((point) => ({ id: point.id, label: point.label, coordinates: point.location, status: "pending" })) ?? [];
  const index = phase === "pickup"
    ? attempts.currentPickupMeetingPointIndex ?? 0
    : attempts.currentDropoffMeetingPointIndex ?? 0;
  return { attempts, points, index };
}

function pointCoordinates(point?: RuntimeMeetingPoint | null) {
  return point?.coordinates ?? point?.location ?? null;
}

function getFlightDurationSeconds(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  phase: "pickup" | "dropoff",
  reroute = false,
) {
  const distanceKm = calculateDistanceKm(from, to);
  if (reroute) return Math.max(10, Math.round(distanceKm * 18 + 8));
  const range = phase === "pickup"
    ? { min: 20, max: 35 }
    : { min: 25, max: 40 };
  return Math.max(
    range.min,
    Math.round(range.min + (range.max - range.min) * Math.min(1, distanceKm / 6)),
  );
}

function setActiveFlight(
  runtime: RuntimeState,
  phase: "pickup" | "dropoff",
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  now: Date,
  reroute = false,
) {
  const seconds = getFlightDurationSeconds(from, to, phase, reroute);
  const dueAt = new Date(now.getTime() + seconds * 1000).toISOString();
  runtime.activeFlight = {
    phase,
    from,
    to,
    startedAt: now.toISOString(),
    dueAt,
  };
  runtime.automaticTransition = {
    dueAt,
    toStatus:
      phase === "pickup"
        ? "awaiting_sender_position_confirmation"
        : "awaiting_recipient_position_confirmation",
  };
  return dueAt;
}

export async function POST(request: Request, { params }: Context) {
  const { identifier } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const resolved = await resolveOrder(decodeURIComponent(identifier));
  if (!resolved.order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (isOrderTerminal(resolved.order)) {
    return NextResponse.json({ error: "Terminal orders are read-only." }, { status: 409 });
  }
  if (resolved.scope === "view") return NextResponse.json({ error: "Read-only tracking access." }, { status: 403 });

  const missions = new MissionsRepository(resolved.db);
  let missionResult = await missions.getByOrderId(resolved.order.id);
  if (missionResult.ok && resolved.order.paymentStatus === "paid") {
    const ensuredMission = await ensureOrderMission(resolved.db, resolved.order);
    if (ensuredMission) missionResult = { ok: true, data: ensuredMission };
  }
  if (!missionResult.ok || !missionResult.data) {
    return NextResponse.json({ error: "Mission not available." }, { status: 409 });
  }
  let mission = missionResult.data;
  if (await expireMissionIfDue(resolved.db, mission)) {
    const refreshedMission = await missions.getByOrderId(resolved.order.id);
    if (!refreshedMission.ok || !refreshedMission.data) {
      return NextResponse.json({ error: "Mission state could not be refreshed." }, { status: 409 });
    }
    mission = refreshedMission.data;
  }
  if (parsed.data.expectedVersion !== undefined && parsed.data.expectedVersion !== mission.stateVersion) {
    return NextResponse.json({ error: "Mission state changed.", mission }, { status: 409 });
  }

  const runtime = (mission.runtimeState ?? {}) as RuntimeState;
  const now = new Date();
  let nextStatus = mission.currentStatus;
  let failureCode: string | null = null;
  let stepExpiresAt: string | null = null;

  if (parsed.data.action === "confirm_position") {
    const pickup =
      mission.currentStatus === "awaiting_sender_position_confirmation" ||
      mission.currentStatus === "arrived_at_pickup";
    const dropoff =
      mission.currentStatus === "awaiting_recipient_position_confirmation" ||
      mission.currentStatus === "arrived_at_dropoff";
    if ((!pickup && !dropoff) || !hasCapability(resolved.scope, pickup ? "pickup" : "dropoff")) {
      return NextResponse.json({ error: "Action is not allowed in this state." }, { status: 409 });
    }
    nextStatus = pickup ? "awaiting_parcel_load" : "awaiting_parcel_collection";
    const { attempts, points, index } = pointStateForOrder(
      resolved.order,
      runtime,
      pickup ? "pickup" : "dropoff",
    );
    const current = points[index];
    if (current) current.status = "accepted";
    if (pickup) {
      attempts.pickupMeetingPoints = points;
      attempts.acceptedPickupMeetingPointId = current?.id ?? null;
    } else {
      attempts.dropoffMeetingPoints = points;
      attempts.acceptedDropoffMeetingPointId = current?.id ?? null;
    }
    runtime.meetingPointAttempts = attempts;
    delete runtime.automaticTransition;
    delete runtime.activeFlight;
    const minutes = await getTimeoutMinutes(resolved.db, pickup ? "loading_timer_minutes" : "unloading_timer_minutes");
    stepExpiresAt = new Date(now.getTime() + minutes * 60_000).toISOString();
  } else if (parsed.data.action === "parcel_loaded") {
    if (mission.currentStatus !== "awaiting_parcel_load" || !hasCapability(resolved.scope, "pickup")) {
      return NextResponse.json({ error: "Action is not allowed in this state." }, { status: 409 });
    }
    runtime.parcelLoaded = true;
    nextStatus = "en_route_to_dropoff";
    const pickupState = pointStateForOrder(resolved.order, runtime, "pickup");
    const dropoffState = pointStateForOrder(resolved.order, runtime, "dropoff");
    const from = pointCoordinates(pickupState.points[pickupState.index]);
    const to = pointCoordinates(dropoffState.points[dropoffState.index]);
    if (!from || !to) {
      return NextResponse.json({ error: "Flight route is incomplete." }, { status: 409 });
    }
    stepExpiresAt = setActiveFlight(runtime, "dropoff", from, to, now);
  } else if (parsed.data.action === "parcel_delivered") {
    if (mission.currentStatus !== "awaiting_parcel_collection" || !hasCapability(resolved.scope, "dropoff")) {
      return NextResponse.json({ error: "Action is not allowed in this state." }, { status: 409 });
    }
    nextStatus = "delivery_completed";
    delete runtime.automaticTransition;
    delete runtime.activeFlight;
  } else {
    const pickup =
      mission.currentStatus === "awaiting_sender_position_confirmation" ||
      mission.currentStatus === "arrived_at_pickup";
    const dropoff =
      mission.currentStatus === "awaiting_recipient_position_confirmation" ||
      mission.currentStatus === "arrived_at_dropoff";
    if ((!pickup && !dropoff) || !hasCapability(resolved.scope, pickup ? "pickup" : "dropoff")) {
      return NextResponse.json({ error: "Action is not allowed in this state." }, { status: 409 });
    }
    const phase = pickup ? "pickup" : "dropoff";
    const { attempts, points, index } = pointStateForOrder(resolved.order, runtime, phase);
    const current = points[index];
    if (current) current.status = "rejected";
    const nextIndex = points.findIndex((point, pointIndex) => pointIndex > index && point.status !== "rejected");
    if (nextIndex >= 0) points[nextIndex].status = "current";
    if (phase === "pickup") {
      attempts.pickupMeetingPoints = points;
      attempts.rejectedPickupMeetingPointIds = [...(attempts.rejectedPickupMeetingPointIds ?? []), ...(current ? [current.id] : [])];
      attempts.currentPickupMeetingPointIndex = Math.max(index, nextIndex);
    } else {
      attempts.dropoffMeetingPoints = points;
      attempts.rejectedDropoffMeetingPointIds = [...(attempts.rejectedDropoffMeetingPointIds ?? []), ...(current ? [current.id] : [])];
      attempts.currentDropoffMeetingPointIndex = Math.max(index, nextIndex);
    }
    runtime.meetingPointAttempts = attempts;
    if (nextIndex < 0) {
      nextStatus = "mission_failed";
      failureCode = phase === "pickup" ? "no_suitable_pickup_meeting_point" : "no_suitable_dropoff_meeting_point";
      delete runtime.automaticTransition;
    } else {
      nextStatus = phase === "pickup" ? "en_route_to_pickup" : "en_route_to_dropoff";
      const from = pointCoordinates(current);
      const to = pointCoordinates(points[nextIndex]);
      if (!from || !to) {
        return NextResponse.json({ error: "Reroute coordinates are incomplete." }, { status: 409 });
      }
      stepExpiresAt = setActiveFlight(runtime, phase, from, to, now, true);
    }
  }

  const updated = await missions.updateIfVersion(mission.id, mission.stateVersion, {
    currentStatus: nextStatus,
    stepStartedAt: now.toISOString(),
    stepExpiresAt,
    failureCode,
    failedAt: failureCode ? now.toISOString() : null,
    completedAt: nextStatus === "delivery_completed" || failureCode ? now.toISOString() : undefined,
    runtimeState: runtime as Json,
  });
  if (!updated.ok) return NextResponse.json({ error: updated.error.message }, { status: 409 });

  if (failureCode) {
    await resolved.orders.updateById(resolved.order.id, {
      status: "failed",
      fulfillmentStatus: "failed_mission",
      refundStatus: "pending",
      notes: failureCode,
    });
    await processEligibleRefund(resolved.db, resolved.order, failureCode);
    await expireTrackingLinksAfterTerminal(
      resolved.db,
      resolved.order.id,
      now,
    );
  } else if (nextStatus === "delivery_completed") {
    await resolved.orders.updateById(resolved.order.id, {
      status: "completed",
      fulfillmentStatus: "completed_mission",
      refundStatus: "not_required",
    });
    await expireTrackingLinksAfterTerminal(
      resolved.db,
      resolved.order.id,
      now,
    );
  }

  return NextResponse.json({ ok: true, mission: updated.data });
}
