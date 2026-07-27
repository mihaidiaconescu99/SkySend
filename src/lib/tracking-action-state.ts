import type { MissionStatus } from "@/types/mission-record";

export type TrackingMissionAction =
  | "confirm_position"
  | "next_point"
  | "parcel_loaded"
  | "parcel_delivered";

export function getAlreadyAppliedTrackingActionPhase(
  action: TrackingMissionAction,
  status: MissionStatus,
  parcelLoaded = false,
): "pickup" | "dropoff" | null {
  if (action === "confirm_position") {
    if (status === "awaiting_parcel_load") return "pickup";
    if (status === "awaiting_parcel_collection") return "dropoff";
  }

  if (action === "next_point") {
    if (status === "en_route_to_pickup") return "pickup";
    if (status === "en_route_to_dropoff") return "dropoff";
  }

  if (
    action === "parcel_loaded" &&
    status === "en_route_to_dropoff" &&
    parcelLoaded
  ) {
    return "pickup";
  }

  if (action === "parcel_delivered" && status === "delivery_completed") {
    return "dropoff";
  }

  return null;
}
