import { buildInferredHandoffPoints } from "@/lib/handoff-points";
import { calculateDistanceKm } from "@/lib/mission-route";
import type {
  CreateDeliveryAddressPayload,
  CreateDeliveryMeetingPointPayload,
  CreateDeliveryPayload,
} from "@/types/create-delivery";
import type {
  HandoffPointsSnapshot,
  Order,
  StoredHandoffPoint,
} from "@/types/order";

const missionMeetingPointLimit = 4;

function toStoredHandoffPoint(
  point: CreateDeliveryMeetingPointPayload,
): StoredHandoffPoint {
  return {
    id: point.id,
    label: point.label,
    location: point.location,
    type: point.type,
    reason: point.description,
    smartScore: point.smartScore,
    distanceFromOriginMeters: point.distanceFromOriginMeters,
    recommendationState: point.recommendationState,
    eligibility: {
      state: point.eligibilityState,
      message: point.description,
    },
  };
}

function inferStoredPoints(
  field: "pickup" | "dropoff",
  address: Pick<CreateDeliveryAddressPayload, "formattedAddress" | "location" | "city" | "county" | "country" | "postalCode">,
) {
  return buildInferredHandoffPoints({
    field,
    address: {
      formattedAddress: address.formattedAddress,
      location: address.location,
      city: address.city,
      county: address.county,
      country: address.country,
      postalCode: address.postalCode,
    },
    isAddressEligible: true,
  }).map((point) => ({
      id: point.id,
      label: point.label,
      location: point.point,
      type: point.type,
      source: point.source,
      confidence: point.confidence,
      reason: point.reason,
      smartScore: point.smartScore,
      distanceFromOriginMeters: point.distanceFromOriginMeters,
      recommendationState: point.recommendationState,
      eligibility: point.eligibility,
    }));
}

function uniquePoints(points: readonly StoredHandoffPoint[]) {
  const seenIds = new Set<string>();
  const seenCoordinates = new Set<string>();

  return points.filter((point) => {
    const coordinateKey = `${point.location.latitude.toFixed(6)}:${point.location.longitude.toFixed(6)}`;
    if (seenIds.has(point.id) || seenCoordinates.has(coordinateKey)) return false;
    seenIds.add(point.id);
    seenCoordinates.add(coordinateKey);
    return true;
  });
}

function completeSide(
  field: "pickup" | "dropoff",
  address: CreateDeliveryAddressPayload,
  selected: CreateDeliveryMeetingPointPayload,
  available: readonly CreateDeliveryMeetingPointPayload[] = [],
) {
  const selectedStored = toStoredHandoffPoint(selected);
  const supplied = [
    selectedStored,
    ...available
      .filter(
        (point) =>
          point.eligibilityState !== "outside" &&
          point.recommendationState !== "unavailable",
      )
      .map(toStoredHandoffPoint),
  ];
  const inferred = inferStoredPoints(field, address);

  return uniquePoints([...supplied, ...inferred]).slice(0, missionMeetingPointLimit);
}

export function createCompleteHandoffSnapshot(
  payload: CreateDeliveryPayload,
): HandoffPointsSnapshot {
  return {
    pickup: completeSide(
      "pickup",
      payload.pickupAddress,
      payload.selectedPickupPoint,
      payload.pickupMeetingPoints,
    ),
    dropoff: completeSide(
      "dropoff",
      payload.dropoffAddress,
      payload.selectedDropoffPoint,
      payload.dropoffMeetingPoints,
    ),
  };
}

function isCompleteSnapshot(snapshot: HandoffPointsSnapshot | null) {
  return Boolean(
    snapshot &&
      snapshot.pickup.length >= missionMeetingPointLimit &&
      snapshot.dropoff.length >= missionMeetingPointLimit,
  );
}

export function completeOrderHandoffSnapshot(
  order: Pick<
    Order,
    | "localOrderId"
    | "handoffPointsSnapshot"
    | "selectedPickupHandoffPoint"
    | "selectedDropoffHandoffPoint"
  >,
): HandoffPointsSnapshot {
  if (isCompleteSnapshot(order.handoffPointsSnapshot)) {
    return {
      pickup: order.handoffPointsSnapshot!.pickup.slice(0, missionMeetingPointLimit),
      dropoff: order.handoffPointsSnapshot!.dropoff.slice(0, missionMeetingPointLimit),
    };
  }

  const pickup = order.selectedPickupHandoffPoint;
  const dropoff = order.selectedDropoffHandoffPoint;
  const existingPickup = order.handoffPointsSnapshot?.pickup ?? [];
  const existingDropoff = order.handoffPointsSnapshot?.dropoff ?? [];

  if (!pickup || !dropoff) {
    return { pickup: existingPickup, dropoff: existingDropoff };
  }

  const toPayload = (
    point: StoredHandoffPoint,
    origin: StoredHandoffPoint,
  ): CreateDeliveryMeetingPointPayload => ({
    id: point.id,
    label: point.label,
    type: (point.type as CreateDeliveryMeetingPointPayload["type"]) ?? "public_point",
    description: point.eligibility?.message ?? point.reason ?? point.label,
    location: point.location,
    eligibilityState:
      point.eligibility?.state === "outside" || point.eligibility?.state === "review"
        ? point.eligibility.state
        : "eligible",
    recommendationState:
      point.recommendationState === "recommended" ||
      point.recommendationState === "unavailable"
        ? point.recommendationState
        : "alternative",
    smartScore: typeof point.smartScore === "number" ? point.smartScore : 75,
    distanceFromOriginMeters:
      typeof point.distanceFromOriginMeters === "number"
        ? point.distanceFromOriginMeters
        : Math.round(calculateDistanceKm(origin.location, point.location) * 1000),
  });

  return createCompleteHandoffSnapshot({
    pickupAddress: {
      input: pickup.label,
      formattedAddress: pickup.label,
      location: pickup.location,
      notes: null,
      city: null,
      county: null,
      country: null,
      postalCode: null,
    },
    dropoffAddress: {
      input: dropoff.label,
      formattedAddress: dropoff.label,
      location: dropoff.location,
      notes: null,
      city: null,
      county: null,
      country: null,
      postalCode: null,
    },
    selectedPickupPoint: toPayload(pickup, pickup),
    selectedDropoffPoint: toPayload(dropoff, dropoff),
    pickupMeetingPoints: existingPickup.map((point) => toPayload(point, pickup)),
    dropoffMeetingPoints: existingDropoff.map((point) => toPayload(point, dropoff)),
  } as CreateDeliveryPayload);
}

export function storedPointToDeliveryPoint(
  point: StoredHandoffPoint,
  origin: StoredHandoffPoint,
): CreateDeliveryMeetingPointPayload {
  return {
    id: point.id,
    label: point.label,
    type: (point.type as CreateDeliveryMeetingPointPayload["type"]) ?? "public_point",
    description: point.eligibility?.message ?? point.reason ?? point.label,
    location: point.location,
    eligibilityState:
      point.eligibility?.state === "outside" || point.eligibility?.state === "review"
        ? point.eligibility.state
        : "eligible",
    recommendationState:
      point.recommendationState === "recommended" ||
      point.recommendationState === "unavailable"
        ? point.recommendationState
        : point.id === origin.id
          ? "recommended"
          : "alternative",
    smartScore: typeof point.smartScore === "number" ? point.smartScore : 75,
    distanceFromOriginMeters:
      typeof point.distanceFromOriginMeters === "number"
        ? point.distanceFromOriginMeters
        : Math.round(calculateDistanceKm(origin.location, point.location) * 1000),
  };
}
