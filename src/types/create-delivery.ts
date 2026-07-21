import type { CandidatePoint } from "@/types/candidate-points";
import type { DeliveryUrgency, DroneClass } from "@/types/domain";
import type {
  CargoModuleId,
  DeliveryPlatformId,
  DeliverySecurityLevel,
  DeliveryShockProtection,
  DeliveryTemperatureProtection,
} from "@/types/drone";
import type { CreateDeliveryParcelDraft } from "@/lib/create-delivery-parcel";
import type { ParcelCategory } from "@/types/parcel-assistant";
import type { CreateDeliveryPricingSnapshot } from "@/types/pricing";
import type {
  CreateDeliveryCoverageSummary,
  CreateDeliveryAddressDraft,
} from "@/lib/create-delivery-addresses";
import type { GeoPoint } from "@/types/service-area";
import type { Json } from "@/types/database";
import type { DroneTelemetrySnapshot } from "@/types/mission-record";

export type CreateDeliveryReviewUrgency = DeliveryUrgency | "scheduled";

export type CreateDeliverySubmitStatus =
  | "scheduled"
  | "pending_scheduled_start"
  | "pending_review";

export type CreatedDeliveryFulfillmentStatus =
  | "order_created"
  | "active_mission"
  | "completed_mission"
  | "failed_mission"
  | "fallback_required"
  | "canceled";

export type CreatedDeliveryPaymentStatus =
  | "unpaid"
  | "processing"
  | "paid"
  | "failed"
  | "refunded"
  | "refund_pending";

export type CreatedDeliveryFallbackOutcome =
  | "no_suitable_pickup_meeting_point"
  | "delivery_failed_return_required"
  | "pickup_confirmation_timeout"
  | "pickup_load_timeout"
  | "dropoff_confirmation_timeout"
  | "dropoff_collection_timeout";

export type CreateDeliveryAddressPayload = {
  input: string;
  formattedAddress: string;
  notes: string | null;
  location: GeoPoint;
  city: string | null;
  county: string | null;
  country: string | null;
  postalCode: string | null;
};

export type CreateDeliverySelectedPointPayload = {
  id: string;
  label: string;
  type: CandidatePoint["type"];
  description: string;
  location: GeoPoint;
  eligibilityState: CandidatePoint["eligibilityState"];
  recommendationState: CandidatePoint["recommendationState"];
  smartScore: number;
  distanceFromOriginMeters: number;
};

export type CreateDeliveryMeetingPointPayload =
  CreateDeliverySelectedPointPayload;

export type CreateDeliveryParcelPayload = CreateDeliveryParcelDraft & {
  category: ParcelCategory;
  estimatedWeightRange: string;
};

export type CreateDeliveryEcoMetricsPayload = {
  estimatedCo2SavedGrams: number;
  estimatedRoadDistanceSavedKm: number;
  estimatedEnergyUseKwh: number;
};

export type CreateDeliverySelectedConfigurationPayload = {
  id: CargoModuleId;
  platform: DeliveryPlatformId;
  moduleName: string;
  shortDescription: string;
  mappedDroneClass: DroneClass;
  selectionReason: string;
  eligibility: {
    isEligible: boolean;
    ineligibleReason: string | null;
    score: number;
  };
  capacity: {
    maxPayloadKg: number;
    maxVolumeLiters: number;
    maxDimensionsCm: {
      lengthCm: number;
      widthCm: number;
      heightCm: number;
    };
  };
  protection: {
    temperatureProtection: DeliveryTemperatureProtection;
    securityLevel: DeliverySecurityLevel;
    shockProtection: DeliveryShockProtection;
  };
  pricingImpact: {
    amountMinor: number;
    currency: "RON";
  };
};

export type CreateDeliveryPayload = {
  userId: string | null;
  pickupAddress: CreateDeliveryAddressPayload;
  dropoffAddress: CreateDeliveryAddressPayload;
  selectedPickupPoint: CreateDeliverySelectedPointPayload;
  selectedDropoffPoint: CreateDeliverySelectedPointPayload;
  pickupMeetingPoints?: CreateDeliveryMeetingPointPayload[];
  dropoffMeetingPoints?: CreateDeliveryMeetingPointPayload[];
  parcel: CreateDeliveryParcelPayload;
  urgency: CreateDeliveryReviewUrgency;
  scheduledAt: string | null;
  recommendedDroneClass: DroneClass;
  selectedDeliveryConfiguration?: CreateDeliverySelectedConfigurationPayload | null;
  estimatedPrice: {
    amountMinor: number;
    currency: "RON";
  };
  pricingSnapshot: CreateDeliveryPricingSnapshot;
  estimatedEcoMetrics: CreateDeliveryEcoMetricsPayload;
  estimatedEta: {
    minMinutes: number;
    maxMinutes: number;
  };
  coverageStatus: CreateDeliveryCoverageSummary["state"];
  coverageSummary: CreateDeliveryCoverageSummary;
  createdAt: string;
};

export type CreatedDeliveryOrder = {
  id: string;
  status: CreateDeliverySubmitStatus;
  paymentStatus?: CreatedDeliveryPaymentStatus;
  fulfillmentStatus?: CreatedDeliveryFulfillmentStatus;
  missionId?: string | null;
  missionStatus?: string | null;
  missionStepStartedAt?: string | null;
  missionStepExpiresAt?: string | null;
  missionFailureCode?: string | null;
  missionStateVersion?: number;
  missionRuntimeState?: Json;
  missionDroneTelemetry?: DroneTelemetrySnapshot;
  missionPickupPin?: string | null;
  missionDropoffPin?: string | null;
  missionStartedAt?: string | null;
  missionUpdatedAt?: string | null;
  publicTrackingCode?: string | null;
  recipientTrackingToken?: string | null;
  recipientTrackingTokenExpiresAt?: string | null;
  stripePaymentIntentId?: string | null;
  paidAt?: string | null;
  completedAt?: string | null;
  fallbackOutcome?: CreatedDeliveryFallbackOutcome | null;
  fallbackReason?: string | null;
  refundStatus?: "not_required" | "pending" | "started" | "completed" | "failed";
  warehousePickupRequired?: boolean;
  publicCodeAccessMode?: "view" | "control";
  trackingAccessScope?: "owner" | "full" | "pickup" | "dropoff" | "view";
  trackingIdentifier?: string | null;
  href: string;
  payload: CreateDeliveryPayload;
};

export function toCreateDeliveryAddressPayload(
  draft: CreateDeliveryAddressDraft,
): CreateDeliveryAddressPayload | null {
  if (!draft.selectedAddress) {
    return null;
  }

  return {
    input: draft.address,
    formattedAddress: draft.selectedAddress.formattedAddress,
    notes: draft.notes.trim() || null,
    location: draft.selectedAddress.location,
    city: draft.selectedAddress.city ?? null,
    county: draft.selectedAddress.county ?? null,
    country: draft.selectedAddress.country ?? null,
    postalCode: draft.selectedAddress.postalCode ?? null,
  };
}

export function toCreateDeliverySelectedPointPayload(
  point: CandidatePoint | null,
): CreateDeliverySelectedPointPayload | null {
  if (!point) {
    return null;
  }

  return {
    id: point.id,
    label: point.label,
    type: point.type,
    description: point.description,
    location: point.point,
    eligibilityState: point.eligibilityState,
    recommendationState: point.recommendationState,
    smartScore: point.smartScore,
    distanceFromOriginMeters: point.distanceFromOriginMeters,
  };
}
