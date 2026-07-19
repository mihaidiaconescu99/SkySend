import type { CandidatePoint } from "@/types/candidate-points";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";
import type { CreateDeliveryAddressDraft } from "@/lib/create-delivery-addresses";
import type { CreateDeliveryParcelDraft } from "@/lib/create-delivery-parcel";

const repeatDeliveryStorageKey = "skysend:create-delivery:prefill";

export type RepeatDeliveryPrefill = {
  routeAddresses: {
    pickup: CreateDeliveryAddressDraft;
    dropoff: CreateDeliveryAddressDraft;
  };
  selectedCandidatePoints: {
    pickup: CandidatePoint;
    dropoff: CandidatePoint;
  };
  parcel: CreateDeliveryParcelDraft;
  urgency: CreatedDeliveryOrder["payload"]["urgency"];
  scheduledAt: string | null;
  sourceOrderId: string;
};

function candidatePointFromOrderPoint(
  point: CreatedDeliveryOrder["payload"]["selectedPickupPoint"],
): CandidatePoint {
  return {
    id: point.id,
    label: point.label,
    point: point.location,
    type: point.type,
    description: point.description,
    suitabilityScore: point.smartScore,
    eligibilityState: point.eligibilityState,
    smartScore: point.smartScore,
    distanceFromOriginMeters: point.distanceFromOriginMeters,
    recommendationState: point.recommendationState,
    reason: point.description,
    source: "inferred",
    confidence: "medium",
  };
}

export function prepareRepeatDeliveryFromOrder(order: CreatedDeliveryOrder) {
  if (typeof window === "undefined") {
    return;
  }

  const prefill: RepeatDeliveryPrefill = {
    routeAddresses: {
      pickup: {
        address: order.payload.pickupAddress.formattedAddress,
        notes: order.payload.pickupAddress.notes ?? "",
        selectedAddress: {
          formattedAddress: order.payload.pickupAddress.formattedAddress,
          location: order.payload.pickupAddress.location,
          city: order.payload.pickupAddress.city ?? undefined,
          county: order.payload.pickupAddress.county ?? undefined,
          country: order.payload.pickupAddress.country ?? undefined,
        },
      },
      dropoff: {
        address: order.payload.dropoffAddress.formattedAddress,
        notes: order.payload.dropoffAddress.notes ?? "",
        selectedAddress: {
          formattedAddress: order.payload.dropoffAddress.formattedAddress,
          location: order.payload.dropoffAddress.location,
          city: order.payload.dropoffAddress.city ?? undefined,
          county: order.payload.dropoffAddress.county ?? undefined,
          country: order.payload.dropoffAddress.country ?? undefined,
        },
      },
    },
    selectedCandidatePoints: {
      pickup: candidatePointFromOrderPoint(order.payload.selectedPickupPoint),
      dropoff: candidatePointFromOrderPoint(order.payload.selectedDropoffPoint),
    },
    parcel: {
      ...order.payload.parcel,
      assistantResult: null,
      valueSource: "manual",
    },
    urgency: order.payload.urgency,
    scheduledAt: null,
    sourceOrderId: order.id,
  };

  window.localStorage.setItem(repeatDeliveryStorageKey, JSON.stringify(prefill));
}

export function readAndClearRepeatDeliveryPrefill(): RepeatDeliveryPrefill | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(repeatDeliveryStorageKey);

  if (!rawValue) {
    return null;
  }

  window.localStorage.removeItem(repeatDeliveryStorageKey);

  try {
    return JSON.parse(rawValue) as RepeatDeliveryPrefill;
  } catch {
    return null;
  }
}
