import { defaultMissionDurations } from "@/constants/mission";
import type {
  LockerState,
  MissionAction,
  MissionPhase,
  MissionStatus,
} from "@/types/mission";

export type MissionAdvanceMode =
  | "automatic"
  | "requires_action"
  | "terminal";

export type MissionStepConfig = {
  status: MissionStatus;
  nextStatus: MissionStatus | null;
  advanceMode: MissionAdvanceMode;
  allowedAction?: MissionAction;
  lockerState?: LockerState;
  phase: MissionPhase;
  durationSeconds?: number;
};

const shortSystemStepSeconds = 2;
const verificationStepSeconds = 3;
const closeoutStepSeconds = 2;

export const missionStateMachine = {
  mission_created: {
    status: "mission_created",
    nextStatus: "preflight_checks",
    advanceMode: "automatic",
    lockerState: "attached",
    phase: "planning",
    durationSeconds: shortSystemStepSeconds,
  },
  preflight_checks: {
    status: "preflight_checks",
    nextStatus: "drone_dispatched",
    advanceMode: "automatic",
    lockerState: "attached",
    phase: "preflight",
    durationSeconds: defaultMissionDurations.preflightChecks,
  },
  drone_dispatched: {
    status: "drone_dispatched",
    nextStatus: "en_route_to_pickup",
    advanceMode: "automatic",
    lockerState: "secured",
    phase: "dispatch",
    durationSeconds: shortSystemStepSeconds,
  },
  en_route_to_pickup: {
    status: "en_route_to_pickup",
    nextStatus: "arrived_at_pickup",
    advanceMode: "automatic",
    lockerState: "secured",
    phase: "dispatch",
    durationSeconds: defaultMissionDurations.warehouseToPickup.maxSeconds,
  },
  arrived_at_pickup: {
    status: "arrived_at_pickup",
    nextStatus: "awaiting_sender_position_confirmation",
    advanceMode: "automatic",
    lockerState: "secured",
    phase: "pickup",
    durationSeconds: shortSystemStepSeconds,
  },
  awaiting_sender_position_confirmation: {
    status: "awaiting_sender_position_confirmation",
    nextStatus: "pickup_safety_check",
    advanceMode: "requires_action",
    allowedAction: "confirm_sender_position",
    lockerState: "secured",
    phase: "pickup",
  },
  pickup_safety_check: {
    status: "pickup_safety_check",
    nextStatus: "locker_descending_pickup",
    advanceMode: "automatic",
    lockerState: "preparing_descent",
    phase: "pickup",
    durationSeconds: defaultMissionDurations.pickupSafetyCheck,
  },
  locker_descending_pickup: {
    status: "locker_descending_pickup",
    nextStatus: "awaiting_pickup_pin",
    advanceMode: "automatic",
    lockerState: "descending",
    phase: "pickup",
    durationSeconds: defaultMissionDurations.lockerDescent,
  },
  awaiting_pickup_pin: {
    status: "awaiting_pickup_pin",
    nextStatus: "awaiting_parcel_load",
    advanceMode: "requires_action",
    allowedAction: "verify_pickup_pin",
    lockerState: "ready_for_load",
    phase: "pickup",
  },
  awaiting_parcel_load: {
    status: "awaiting_parcel_load",
    nextStatus: "locker_ascending_pickup",
    advanceMode: "requires_action",
    allowedAction: "confirm_parcel_loaded",
    lockerState: "ready_for_load",
    phase: "pickup",
  },
  locker_ascending_pickup: {
    status: "locker_ascending_pickup",
    nextStatus: "payload_verification",
    advanceMode: "automatic",
    lockerState: "ascending",
    phase: "pickup",
    durationSeconds: defaultMissionDurations.lockerAscent,
  },
  payload_verification: {
    status: "payload_verification",
    nextStatus: "parcel_secured",
    advanceMode: "automatic",
    lockerState: "loaded",
    phase: "pickup",
    durationSeconds: verificationStepSeconds,
  },
  parcel_secured: {
    status: "parcel_secured",
    nextStatus: "en_route_to_dropoff",
    advanceMode: "automatic",
    lockerState: "secured",
    phase: "linehaul",
    durationSeconds: shortSystemStepSeconds,
  },
  en_route_to_dropoff: {
    status: "en_route_to_dropoff",
    nextStatus: "arrived_at_dropoff",
    advanceMode: "automatic",
    lockerState: "secured",
    phase: "linehaul",
    durationSeconds: defaultMissionDurations.pickupToDropoff.maxSeconds,
  },
  arrived_at_dropoff: {
    status: "arrived_at_dropoff",
    nextStatus: "awaiting_recipient_position_confirmation",
    advanceMode: "automatic",
    lockerState: "secured",
    phase: "dropoff",
    durationSeconds: shortSystemStepSeconds,
  },
  awaiting_recipient_position_confirmation: {
    status: "awaiting_recipient_position_confirmation",
    nextStatus: "dropoff_safety_check",
    advanceMode: "requires_action",
    allowedAction: "confirm_recipient_position",
    lockerState: "secured",
    phase: "dropoff",
  },
  dropoff_safety_check: {
    status: "dropoff_safety_check",
    nextStatus: "locker_descending_dropoff",
    advanceMode: "automatic",
    lockerState: "preparing_descent",
    phase: "dropoff",
    durationSeconds: defaultMissionDurations.dropoffSafetyCheck,
  },
  locker_descending_dropoff: {
    status: "locker_descending_dropoff",
    nextStatus: "awaiting_recipient_pin",
    advanceMode: "automatic",
    lockerState: "descending",
    phase: "dropoff",
    durationSeconds: defaultMissionDurations.lockerDescent,
  },
  awaiting_recipient_pin: {
    status: "awaiting_recipient_pin",
    nextStatus: "awaiting_parcel_collection",
    advanceMode: "requires_action",
    allowedAction: "verify_recipient_pin",
    lockerState: "ready_for_unload",
    phase: "dropoff",
  },
  awaiting_parcel_collection: {
    status: "awaiting_parcel_collection",
    nextStatus: "locker_ascending_dropoff",
    advanceMode: "requires_action",
    allowedAction: "confirm_parcel_collected",
    lockerState: "ready_for_unload",
    phase: "dropoff",
  },
  locker_ascending_dropoff: {
    status: "locker_ascending_dropoff",
    nextStatus: "delivery_completed",
    advanceMode: "automatic",
    lockerState: "ascending",
    phase: "dropoff",
    durationSeconds: defaultMissionDurations.lockerAscent,
  },
  delivery_completed: {
    status: "delivery_completed",
    nextStatus: "proof_generated",
    advanceMode: "automatic",
    lockerState: "emptied",
    phase: "proof",
    durationSeconds: closeoutStepSeconds,
  },
  proof_generated: {
    status: "proof_generated",
    nextStatus: "mission_closed",
    advanceMode: "automatic",
    lockerState: "locked",
    phase: "proof",
    durationSeconds: closeoutStepSeconds,
  },
  mission_closed: {
    status: "mission_closed",
    nextStatus: null,
    advanceMode: "terminal",
    lockerState: "locked",
    phase: "closed",
  },
  returning_to_hub: {
    status: "returning_to_hub",
    nextStatus: "returned_to_hub",
    advanceMode: "automatic",
    lockerState: "locked",
    phase: "exception",
    durationSeconds: defaultMissionDurations.warehouseToPickup.maxSeconds,
  },
  returned_to_hub: {
    status: "returned_to_hub",
    nextStatus: "mission_failed",
    advanceMode: "automatic",
    lockerState: "locked",
    phase: "exception",
    durationSeconds: closeoutStepSeconds,
  },
  mission_failed: {
    status: "mission_failed",
    nextStatus: null,
    advanceMode: "terminal",
    lockerState: "locked",
    phase: "exception",
  },
  fallback_required: {
    status: "fallback_required",
    nextStatus: "mission_failed",
    advanceMode: "requires_action",
    allowedAction: "trigger_fallback",
    lockerState: "locked",
    phase: "exception",
  },
} satisfies Record<MissionStatus, MissionStepConfig>;

export const automaticMissionStatuses = Object.values(missionStateMachine)
  .filter((step) => step.advanceMode === "automatic")
  .map((step) => step.status);

export const missionActionStatuses = Object.values(missionStateMachine)
  .filter((step) => step.advanceMode === "requires_action")
  .map((step) => step.status);

export function getMissionStepConfig(
  status: MissionStatus,
): MissionStepConfig {
  return missionStateMachine[status];
}

export function getNextMissionStatus(
  status: MissionStatus,
): MissionStatus | null {
  return getMissionStepConfig(status).nextStatus;
}

export function isMissionWaitingForUser(status: MissionStatus) {
  return getMissionStepConfig(status).advanceMode === "requires_action";
}

export function getAllowedMissionAction(
  status: MissionStatus,
): MissionAction | null {
  return getMissionStepConfig(status).allowedAction ?? null;
}

export function getLockerStateForStatus(
  status: MissionStatus,
): LockerState | null {
  return getMissionStepConfig(status).lockerState ?? null;
}

export function getMissionPhaseForStatus(
  status: MissionStatus,
): MissionPhase {
  return getMissionStepConfig(status).phase;
}

