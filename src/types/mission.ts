

import type { DroneClass } from "@/types/domain";
import type {
  AddressSnapshot,
  ContactPoint,
  DeliveryOrderId,
  EntityTimestamps,
  ISODateTimeString,
  OrderPointId,
  ParcelId,
  UserProfileId,
} from "@/types/entities";
import type { GeoPoint } from "@/types/service-area";

export type MissionId = string;
export type MissionSegmentId = string;
export type MissionEventId = string;
export type MissionParticipantId = string;
export type MissionPinId = string;
export type MissionProofId = string;
export type DroneId = string;
export type HubId = string;
export type LockerId = string;

export type MissionStatus =
  | "mission_created"
  | "preflight_checks"
  | "drone_dispatched"
  | "en_route_to_pickup"
  | "arrived_at_pickup"
  | "awaiting_sender_position_confirmation"
  | "awaiting_pickup_pin"
  | "pickup_safety_check"
  | "locker_descending_pickup"
  | "awaiting_parcel_load"
  | "locker_ascending_pickup"
  | "payload_verification"
  | "parcel_secured"
  | "en_route_to_dropoff"
  | "arrived_at_dropoff"
  | "awaiting_recipient_position_confirmation"
  | "awaiting_recipient_pin"
  | "dropoff_safety_check"
  | "locker_descending_dropoff"
  | "awaiting_parcel_collection"
  | "locker_ascending_dropoff"
  | "delivery_completed"
  | "proof_generated"
  | "mission_closed"
  | "returning_to_hub"
  | "returned_to_hub"
  | "mission_failed"
  | "fallback_required";

export type MissionPhase =
  | "planning"
  | "preflight"
  | "dispatch"
  | "pickup"
  | "linehaul"
  | "dropoff"
  | "proof"
  | "closed"
  | "exception";

export type MissionAction =
  | "confirm_sender_position"
  | "verify_pickup_pin"
  | "confirm_parcel_loaded"
  | "confirm_recipient_position"
  | "verify_recipient_pin"
  | "confirm_parcel_collected"
  | "trigger_fallback";

export type LockerState =
  | "attached"
  | "preparing_descent"
  | "descending"
  | "ready_for_load"
  | "loaded"
  | "ascending"
  | "secured"
  | "ready_for_unload"
  | "emptied"
  | "locked";

export type MissionActor =
  | "system"
  | "sender"
  | "recipient"
  | "operator"
  | "admin";

export type MissionSegmentType =
  | "warehouse_to_pickup"
  | "hub_to_pickup"
  | "pickup_handoff"
  | "pickup_to_dropoff"
  | "dropoff_handoff"
  | "dropoff_to_warehouse"
  | "dropoff_to_hub"
  | "fallback";

export type MissionSegmentState =
  | "pending"
  | "active"
  | "completed"
  | "skipped"
  | "failed";

export type MissionPinPurpose =
  | "pickup_verification"
  | "dropoff_verification";

export type MissionPinStatus =
  | "pending"
  | "issued"
  | "verified"
  | "expired"
  | "failed";

export type MissionParticipantRole =
  | "sender"
  | "recipient"
  | "operator"
  | "admin"
  | "warehouse";

export type MissionProofType =
  | "delivery_receipt"
  | "pin_verification"
  | "locker_state"
  | "telemetry"
  | "photo"
  | "signature"
  | "operator_note";

export type MissionFailureReason =
  | "weather"
  | "airspace_restriction"
  | "drone_fault"
  | "locker_fault"
  | "sender_unavailable"
  | "recipient_unavailable"
  | "pin_verification_failed"
  | "unsafe_handoff_zone"
  | "no_suitable_pickup_meeting_point"
  | "no_suitable_dropoff_meeting_point"
  | "payload_mismatch"
  | "operator_abort"
  | "unknown";

export type MissionMeetingPointStatus =
  | "pending"
  | "current"
  | "accepted"
  | "rejected"
  | "skipped"
  | "unavailable";

export type MissionMeetingPointType =
  | "curbside"
  | "entrance"
  | "parking"
  | "public_point"
  | "building_side"
  | "street_side"
  | "storefront"
  | "access";

export type MissionMeetingPoint = {
  id: string;
  label: string;
  type: MissionMeetingPointType;
  coordinates: GeoPoint;
  distanceFromSelectedAddressMeters: number;
  confidence: "high" | "medium" | "low";
  reason: string;
  status: MissionMeetingPointStatus;
};

export type MissionMeetingPointAttempts = {
  pickupMeetingPoints: MissionMeetingPoint[];
  currentPickupMeetingPointIndex: number;
  rejectedPickupMeetingPointIds: string[];
  acceptedPickupMeetingPointId?: string | null;
  pickupFallbackActiveated: boolean;
  dropoffMeetingPoints: MissionMeetingPoint[];
  currentDropoffMeetingPointIndex: number;
  rejectedDropoffMeetingPointIds: string[];
  acceptedDropoffMeetingPointId?: string | null;
  dropoffFallbackActiveated: boolean;
};

export type MissionActionRequirement = {
  action: MissionAction;
  actor: MissionActor;
  label: string;
  description?: string;
  requiredBy?: ISODateTimeString | null;
};

export type MissionRoutePoint = {
  label: string;
  location: GeoPoint;
  address?: AddressSnapshot | null;
  eta?: ISODateTimeString | null;
};

export type MissionSegment = {
  id: MissionSegmentId;
  missionId: MissionId;
  type: MissionSegmentType;
  state: MissionSegmentState;
  sequence: number;
  from: MissionRoutePoint;
  to: MissionRoutePoint;
  distanceKm?: number | null;
  plannedDurationSeconds?: number | null;
  startedAt?: ISODateTimeString | null;
  completedAt?: ISODateTimeString | null;
};

export type MissionEvent = {
  id: MissionEventId;
  missionId: MissionId;
  timestamp: ISODateTimeString;
  status: MissionStatus;
  title: string;
  description: string;
  actor: MissionActor;
};

export type DroneTelemetry = {
  droneId: DroneId;
  recordedAt: ISODateTimeString;
  location: GeoPoint;
  altitudeMeters: number;
  groundSpeedMps: number;
  headingDegrees: number;
  batteryPercent: number;
  signalPercent: number;
  payloadWeightKg?: number | null;
  lockerState: LockerState;
  temperatureCelsius?: number | null;
  windSpeedMps?: number | null;
};

export type MissionParticipant = {
  id: MissionParticipantId;
  missionId: MissionId;
  role: MissionParticipantRole;
  profileId?: UserProfileId | null;
  displayName: string;
  contact?: ContactPoint | null;
  confirmedAt?: ISODateTimeString | null;
};

export type MissionPin = {
  id: MissionPinId;
  missionId: MissionId;
  purpose: MissionPinPurpose;
  participantId: MissionParticipantId;
  code: string;
  status: MissionPinStatus;
  issuedAt?: ISODateTimeString | null;
  expiresAt?: ISODateTimeString | null;
  verifiedAt?: ISODateTimeString | null;
  attempts: number;
};

export type MissionProof = {
  id: MissionProofId;
  missionId: MissionId;
  type: MissionProofType;
  generatedAt: ISODateTimeString;
  generatedBy: MissionActor;
  title: string;
  description?: string;
  uri?: string | null;
  checksum?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type MissionEtaTiming = {
  pickupMeetingPointDelaySeconds: number;
  parcelLoadDelaySeconds: number;
};

export type MissionOrderSnapshot = {
  orderId: DeliveryOrderId;
  pickupPointId: OrderPointId;
  dropoffPointId: OrderPointId;
  parcelId: ParcelId;
};

export type MissionHub = {
  id: HubId;
  name: string;
  address: AddressSnapshot;
};

export type MissionLocker = {
  id: LockerId;
  state: LockerState;
  lastStateChangedAt?: ISODateTimeString | null;
};

export type Mission = EntityTimestamps & {
  id: MissionId;
  sourceOrderId: DeliveryOrderId;
  orderSnapshot: MissionOrderSnapshot;
  status: MissionStatus;
  phase: MissionPhase;
  droneId?: DroneId | null;
  droneClass: DroneClass;
  hub: MissionHub;
  locker: MissionLocker;
  pickup: MissionRoutePoint;
  dropoff: MissionRoutePoint;
  meetingPointAttempts: MissionMeetingPointAttempts;
  segments: MissionSegment[];
  participants: MissionParticipant[];
  pendingActions: MissionActionRequirement[];
  pins: MissionPin[];
  events: MissionEvent[];
  etaTiming?: MissionEtaTiming;
  latestTelemetry?: DroneTelemetry | null;
  telemetryLog?: DroneTelemetry[];
  proofs: MissionProof[];
  failureReason?: MissionFailureReason | null;
  fallbackMissionId?: MissionId | null;
  startedAt?: ISODateTimeString | null;
  completedAt?: ISODateTimeString | null;
  closedAt?: ISODateTimeString | null;
};
