

import type { MissionStatus } from "@/types/mission";
import type { Json } from "@/types/database";

export type { MissionStatus };

export interface DroneTelemetrySnapshot {
  position: { latitude: number; longitude: number };

  heading: number;

  speed: number;

  segmentProgress: number;

  segmentId: string | null;

  altitudeMeters?: number;

  batteryPercent?: number;

  lastUpdatedAt: string;
}

export interface MissionRecord {
  id: string;
  orderId: string;
  currentStatus: MissionStatus;
  startedAt: string | null;
  completedAt: string | null;
  droneTelemetrySnapshot: DroneTelemetrySnapshot;
  pickupPin: string | null;
  dropoffPin: string | null;
  pickupPinAttempts: number;
  dropoffPinAttempts: number;
  pickupPinVerifiedAt: string | null;
  dropoffPinVerifiedAt: string | null;
  fallbackReason: string | null;
  stateVersion: number;
  stepStartedAt: string | null;
  stepExpiresAt: string | null;
  failureCode: string | null;
  failedAt: string | null;
  runtimeState: Json;
  createdAt: string;
  updatedAt: string;
}

export type Mission = MissionRecord;

export interface CreateMissionInput {
  orderId: string;

  currentStatus?: MissionStatus;
  pickupPin?: string | null;
  dropoffPin?: string | null;
  stepStartedAt?: string | null;
  stepExpiresAt?: string | null;
  runtimeState?: Json;
}

export interface UpdateMissionInput {
  currentStatus?: MissionStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  droneTelemetrySnapshot?: DroneTelemetrySnapshot;
  pickupPin?: string | null;
  dropoffPin?: string | null;
  pickupPinAttempts?: number;
  dropoffPinAttempts?: number;
  pickupPinVerifiedAt?: string | null;
  dropoffPinVerifiedAt?: string | null;
  fallbackReason?: string | null;
  stateVersion?: number;
  stepStartedAt?: string | null;
  stepExpiresAt?: string | null;
  failureCode?: string | null;
  failedAt?: string | null;
  runtimeState?: Json;
}

export type TrackingLinkScope = "full" | "pickup" | "dropoff";

export interface OrderTrackingLink {
  id: string;
  orderId: string;
  scope: TrackingLinkScope;
  token: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MISSION_STATUSES: readonly MissionStatus[] = [
  "mission_created",
  "preflight_checks",
  "drone_dispatched",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "awaiting_sender_position_confirmation",
  "awaiting_pickup_pin",
  "pickup_safety_check",
  "locker_descending_pickup",
  "awaiting_parcel_load",
  "locker_ascending_pickup",
  "payload_verification",
  "parcel_secured",
  "en_route_to_dropoff",
  "arrived_at_dropoff",
  "awaiting_recipient_position_confirmation",
  "awaiting_recipient_pin",
  "dropoff_safety_check",
  "locker_descending_dropoff",
  "awaiting_parcel_collection",
  "locker_ascending_dropoff",
  "delivery_completed",
  "proof_generated",
  "mission_closed",
  "returning_to_hub",
  "returned_to_hub",
  "mission_failed",
  "fallback_required",
] as const;

export const DEFAULT_DRONE_TELEMETRY: DroneTelemetrySnapshot = {
  position: { latitude: 0, longitude: 0 },
  heading: 0,
  speed: 0,
  segmentProgress: 0,
  segmentId: null,
  lastUpdatedAt: "1970-01-01T00:00:00Z",
};

export const MISSION_PIN_LENGTH = 4;

export const MAX_PIN_ATTEMPTS = 3;
