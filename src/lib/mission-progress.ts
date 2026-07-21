import type { MissionStatus } from "@/types/mission";

const pickupArrivalStatuses = new Set<MissionStatus>([
  "arrived_at_pickup",
  "awaiting_sender_position_confirmation",
]);
const pickupConfirmedStatuses = new Set<MissionStatus>([
  "pickup_safety_check",
  "locker_descending_pickup",
  "awaiting_pickup_pin",
  "awaiting_parcel_load",
]);
const parcelLoadedStatuses = new Set<MissionStatus>([
  "locker_ascending_pickup",
  "payload_verification",
  "parcel_secured",
]);
const dropoffArrivalStatuses = new Set<MissionStatus>([
  "arrived_at_dropoff",
  "awaiting_recipient_position_confirmation",
]);
const dropoffConfirmedStatuses = new Set<MissionStatus>([
  "dropoff_safety_check",
  "locker_descending_dropoff",
  "awaiting_recipient_pin",
  "awaiting_parcel_collection",
]);

export function getMissionJourneyProgress(
  status: MissionStatus | null,
  segmentProgress: number,
) {
  if (!status) return 0;
  const progress = Math.max(0, Math.min(1, segmentProgress));

  if (status === "en_route_to_pickup") return Math.round(progress * 40);
  if (pickupArrivalStatuses.has(status)) return 40;
  if (pickupConfirmedStatuses.has(status)) return 45;
  if (parcelLoadedStatuses.has(status)) return 50;
  if (status === "en_route_to_dropoff") return Math.round(50 + progress * 40);
  if (dropoffArrivalStatuses.has(status)) return 90;
  if (dropoffConfirmedStatuses.has(status)) return 95;
  if (
    status === "delivery_completed" ||
    status === "proof_generated" ||
    status === "mission_closed"
  ) {
    return 100;
  }
  if (status === "mission_failed" || status === "fallback_required") return 0;
  return 0;
}

export type PremiumFailureCode =
  | "pickup_confirmation_timeout"
  | "pickup_load_timeout"
  | "dropoff_confirmation_timeout"
  | "dropoff_collection_timeout"
  | "no_suitable_pickup_meeting_point"
  | "no_suitable_dropoff_meeting_point";

export const premiumFailureContent: Record<
  PremiumFailureCode,
  { title: string; description: string; refundEligible: boolean }
> = {
  pickup_confirmation_timeout: {
    title: "Confirmarea la ridicare a expirat",
    description: "Poziția dronei nu a fost confirmată în intervalul disponibil.",
    refundEligible: false,
  },
  pickup_load_timeout: {
    title: "Coletul nu a fost încărcat la timp",
    description: "Încărcarea coletului nu a fost confirmată înainte de expirarea timerului.",
    refundEligible: false,
  },
  dropoff_confirmation_timeout: {
    title: "Confirmarea la livrare a expirat",
    description: "Poziția dronei nu a fost confirmată la destinație în intervalul disponibil.",
    refundEligible: false,
  },
  dropoff_collection_timeout: {
    title: "Predarea coletului nu a fost confirmată",
    description: "Coletul nu a fost preluat înainte de expirarea timerului.",
    refundEligible: false,
  },
  no_suitable_pickup_meeting_point: {
    title: "Nu a fost găsit un punct potrivit pentru ridicare",
    description: "Toate cele patru puncte de întâlnire pentru ridicare au fost refuzate.",
    refundEligible: true,
  },
  no_suitable_dropoff_meeting_point: {
    title: "Nu a fost găsit un punct potrivit pentru livrare",
    description: "Toate cele patru puncte de întâlnire pentru livrare au fost refuzate.",
    refundEligible: true,
  },
};

export function getFailureCodeForTimerKind(kind: string): PremiumFailureCode {
  switch (kind) {
    case "pickup_meeting_point":
      return "pickup_confirmation_timeout";
    case "parcel_load":
      return "pickup_load_timeout";
    case "dropoff_meeting_point":
      return "dropoff_confirmation_timeout";
    default:
      return "dropoff_collection_timeout";
  }
}
