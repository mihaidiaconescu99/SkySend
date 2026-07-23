import { activeHub } from "@/constants/hub";
import { missionActionLabels } from "@/constants/mission";
import {
  appendMissionEvent,
  createActionEvent,
  createStatusChangeEvent,
  createSystemEvent,
} from "@/lib/mission-events";
import { readOperationalSettings } from "@/lib/admin-data";
import {
  clearOrderAsRehydrating,
  markOrderAsRehydrating,
  maybeWriteTelemetryFromRuntime,
  persistMissionCreated,
  persistMissionEvent,
  persistPinAttempt,
  persistStatusChange,
} from "@/lib/mission-persistence";
import { generateMissionPins, validateMissionPin } from "@/lib/mission-pin";
import {
  buildMissionSegments,
  calculateDistanceKm,
  calculateHeadingDegrees,
  interpolateGeoPoint,
} from "@/lib/mission-route";
import {
  getAllowedMissionAction,
  getLockerStateForStatus,
  getMissionPhaseForStatus,
  getMissionStepConfig,
  isMissionWaitingForUser,
} from "@/lib/mission-state-machine";
import {
  markCreatedDeliveryOrderFallback,
  readCreatedDeliveryOrder,
  updateCreatedDeliveryOrderFulfillment,
} from "@/lib/create-delivery-submit";
import { getFailureCodeForTimerKind } from "@/lib/mission-progress";
import {
  missionDispatchDelayMs,
  missionDispatchDelaySeconds,
} from "@/lib/mission-dispatch";
import type { PremiumFailureCode } from "@/lib/mission-progress";
import { showToast } from "@/lib/toast-store";
import type {
  CreatedDeliveryOrder,
  CreateDeliveryMeetingPointPayload,
} from "@/types/create-delivery";
import type { AddressSnapshot } from "@/types/entities";
import type { GeoPoint } from "@/types/service-area";
import type {
  DroneTelemetry,
  LockerState,
  Mission,
  MissionAction,
  MissionActionRequirement,
  MissionActor,
  MissionEtaTiming,
  MissionEvent,
  MissionMeetingPoint,
  MissionParticipant,
  MissionPin,
  MissionRoutePoint,
  MissionSegment,
  MissionStatus,
} from "@/types/mission";
import type {
  DroneTelemetrySnapshot,
  MissionRecord,
} from "@/types/mission-record";

export type MissionRuntimeSnapshot = {
  currentMission: Mission | null;
  currentStatus: MissionStatus | null;
  activeSegment: MissionSegment | null;
  segmentProgress: number;
  dronePosition: GeoPoint | null;
  lockerState: LockerState | null;
  droneTelemetry: DroneTelemetry | null;
  pendingAction: MissionAction | null;
  eventLog: MissionEvent[];
  isMissionRunning: boolean;
  isWaitingForUser: boolean;
  userActionTimer: MissionUserActionTimer | null;
  isRehydrating: boolean;
};

export type MissionUserActionTimerKind =
  | "pickup_meeting_point"
  | "dropoff_meeting_point"
  | "parcel_load"
  | "parcel_collection";

export type MissionUserActionTimer = {
  kind: MissionUserActionTimerKind;
  status: MissionStatus;
  title: string;
  actionLabel: string;
  helperText: string;
  expiryText: string;
  fallbackTitle: string;
  fallbackDescription: string;
  phase: "pickup" | "dropoff";
  startedAt: string;
  expiresAt: string;
  timeoutMs: number;
};

export type MissionRuntimeListener = (
  snapshot: MissionRuntimeSnapshot,
) => void;

type RuntimeTimers = {
  stepTimeout: ReturnType<typeof setTimeout> | null;
  progressInterval: ReturnType<typeof setInterval> | null;
  userActionTimeout: ReturnType<typeof setTimeout> | null;
};

const initialSnapshot: MissionRuntimeSnapshot = {
  currentMission: null,
  currentStatus: null,
  activeSegment: null,
  segmentProgress: 0,
  dronePosition: null,
  lockerState: null,
  droneTelemetry: null,
  pendingAction: null,
  eventLog: [],
  isMissionRunning: false,
  isWaitingForUser: false,
  userActionTimer: null,
  isRehydrating: false,
};

const knownMissionStatuses: MissionStatus[] = [
  "mission_created",
  "preflight_checks",
  "drone_dispatched",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "awaiting_sender_position_confirmation",
  "pickup_safety_check",
  "locker_descending_pickup",
  "awaiting_pickup_pin",
  "awaiting_parcel_load",
  "locker_ascending_pickup",
  "payload_verification",
  "parcel_secured",
  "en_route_to_dropoff",
  "arrived_at_dropoff",
  "awaiting_recipient_position_confirmation",
  "dropoff_safety_check",
  "locker_descending_dropoff",
  "awaiting_recipient_pin",
  "awaiting_parcel_collection",
  "locker_ascending_dropoff",
  "delivery_completed",
  "proof_generated",
  "mission_closed",
  "returning_to_hub",
  "returned_to_hub",
  "mission_failed",
  "fallback_required",
];
const finalProofStatuses: MissionStatus[] = [
  "delivery_completed",
  "proof_generated",
  "mission_closed",
];

let snapshot = initialSnapshot;
const listeners = new Set<MissionRuntimeListener>();
const timers: RuntimeTimers = {
  stepTimeout: null,
  progressInterval: null,
  userActionTimeout: null,
};

const pendingDBRehydrationOrders = new Set<string>();
const syncedMissionVersions = new Map<string, number>();

export { missionDispatchDelaySeconds } from "@/lib/mission-dispatch";
const missionRuntimeStoragePrefix = "skysend:mission-runtime:";
const userActionNotificationStoragePrefix =
  "skysend:mission-runtime:first-action-notified:";

function getCurrentTimestamp() {
  return new Date().toISOString();
}

function canRunTimers() {
  return typeof window !== "undefined";
}

function getRuntimeStorageKey(orderId: string) {
  return `${missionRuntimeStoragePrefix}${orderId}`;
}

function getUserActionNotificationStorageKey(orderId: string) {
  return `${userActionNotificationStoragePrefix}${orderId}`;
}

function getValidTimestampMs(value?: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : timestamp;
}

function getDefaultEtaTiming(): MissionEtaTiming {
  return {
    pickupMeetingPointDelaySeconds: 0,
    parcelLoadDelaySeconds: 0,
  };
}

function sanitizeOperationalTimeoutMinutes(value: number) {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : 10));
}

function getOperationalTimeoutMinutes(kind: MissionUserActionTimerKind) {
  const settings = readOperationalSettings();

  if (kind === "parcel_load") {
    return sanitizeOperationalTimeoutMinutes(settings.timeouts.parcelLoadMinutes);
  }

  if (kind === "parcel_collection") {
    return sanitizeOperationalTimeoutMinutes(
      settings.timeouts.parcelUnloadMinutes,
    );
  }

  return sanitizeOperationalTimeoutMinutes(
    settings.timeouts.meetingPointConfirmationMinutes,
  );
}

function formatOperationalMinutes(minutes: number) {
  return minutes === 1 ? "1 minut" : `${minutes} minute`;
}

function getOperationalTimeoutLabel(kind: MissionUserActionTimerKind) {
  return formatOperationalMinutes(getOperationalTimeoutMinutes(kind));
}

function getUserActionTimeoutMs(kind: MissionUserActionTimerKind) {
  return getOperationalTimeoutMinutes(kind) * 60 * 1000;
}

function formatTimerDuration(timeoutMs: number) {
  return formatOperationalMinutes(Math.max(1, Math.round(timeoutMs / 60_000)));
}

function normalizeEtaTiming(
  etaTiming?: Partial<MissionEtaTiming> | null,
): MissionEtaTiming {
  return {
    pickupMeetingPointDelaySeconds: Math.max(
      0,
      Math.round(etaTiming?.pickupMeetingPointDelaySeconds ?? 0),
    ),
    parcelLoadDelaySeconds: Math.max(
      0,
      Math.round(etaTiming?.parcelLoadDelaySeconds ?? 0),
    ),
  };
}

function normalizeMissionEtaTiming(mission: Mission): Mission {
  return {
    ...mission,
    etaTiming: normalizeEtaTiming(mission.etaTiming),
  };
}

function isDeliveryEtaDelayTimerKind(kind: MissionUserActionTimerKind) {
  return kind === "pickup_meeting_point" || kind === "parcel_load";
}

function getTimerElapsedSeconds(
  timer: MissionUserActionTimer,
  nowMs = Date.now(),
) {
  const startedAtMs = getValidTimestampMs(timer.startedAt);

  if (startedAtMs === null) {
    return 0;
  }

  const timeoutSeconds = Math.max(0, Math.floor(timer.timeoutMs / 1000));
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));

  return Math.min(timeoutSeconds, elapsedSeconds);
}

function addMissionEtaDelay(
  mission: Mission,
  kind: MissionUserActionTimerKind,
  elapsedSeconds: number,
): Mission {
  if (!isDeliveryEtaDelayTimerKind(kind) || elapsedSeconds <= 0) {
    return normalizeMissionEtaTiming(mission);
  }

  const etaTiming = normalizeEtaTiming(mission.etaTiming);

  return {
    ...mission,
    etaTiming:
      kind === "pickup_meeting_point"
        ? {
            ...etaTiming,
            pickupMeetingPointDelaySeconds:
              etaTiming.pickupMeetingPointDelaySeconds + elapsedSeconds,
          }
        : {
            ...etaTiming,
            parcelLoadDelaySeconds:
              etaTiming.parcelLoadDelaySeconds + elapsedSeconds,
          },
  };
}

function consumeCurrentEtaDelay(mission: Mission) {
  const timer = snapshot.userActionTimer;

  if (!timer) {
    return normalizeMissionEtaTiming(mission);
  }

  return addMissionEtaDelay(mission, timer.kind, getTimerElapsedSeconds(timer));
}

export function getPaidOrderMissionDispatchStartMs(order: CreatedDeliveryOrder) {
  const persistedDispatchStart = getValidTimestampMs(order.dispatchStartsAt);
  if (persistedDispatchStart !== null) return persistedDispatchStart;
  const paidAtMs =
    getValidTimestampMs(order.paidAt) ??
    getValidTimestampMs(order.payload.createdAt);

  if (paidAtMs === null) {
    return null;
  }

  const scheduledAtMs =
    order.payload.urgency === "scheduled"
      ? getValidTimestampMs(order.payload.scheduledAt)
      : null;
  const eligibleStartMs =
    scheduledAtMs !== null ? Math.max(paidAtMs, scheduledAtMs) : paidAtMs;

  return eligibleStartMs + missionDispatchDelayMs;
}

function isOrderScheduledForFuture(order: CreatedDeliveryOrder, nowMs: number) {
  const scheduledAtMs =
    order.payload.urgency === "scheduled"
      ? getValidTimestampMs(order.payload.scheduledAt)
      : null;

  return scheduledAtMs !== null && scheduledAtMs > nowMs;
}

function canAutoStartPaidOrder(order: CreatedDeliveryOrder, nowMs = Date.now()) {
  if (order.paymentStatus !== "paid") {
    return false;
  }

  if (
    order.fulfillmentStatus === "completed_mission" ||
    order.fulfillmentStatus === "failed_mission" ||
    order.fulfillmentStatus === "fallback_required" ||
    order.fulfillmentStatus === "canceled"
  ) {
    return false;
  }

  return !isOrderScheduledForFuture(order, nowMs);
}

function createRuntimeId(prefix: string, sourceId: string) {
  const entropy =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `${prefix}_${sourceId}_${entropy}`;
}

function isKnownMissionStatus(
  status?: string | null,
): status is MissionStatus {
  return Boolean(
    status && knownMissionStatuses.includes(status as MissionStatus),
  );
}

function isFinalProofStatus(status: MissionStatus) {
  return finalProofStatuses.includes(status);
}

function getUserActionTimerConfig(status: MissionStatus):
  | Omit<MissionUserActionTimer, "startedAt" | "expiresAt" | "timeoutMs">
  | null {
  switch (status) {
    case "awaiting_sender_position_confirmation":
      return {
        kind: "pickup_meeting_point",
        status,
        title: "Confirmare punct de întâlnire",
        actionLabel: "Confirma inainte ca timerul sa expire.",
        helperText:
          `Ai la dispozitie ${getOperationalTimeoutLabel("pickup_meeting_point")} sa confirmi punctul de intalnire.`,
        expiryText:
          "Dupa expirare, comanda intra automat in fallback pickup.",
        fallbackTitle:
          "Comanda a fost anulata deoarece punctul de intalnire nu a fost confirmat in intervalul disponibil.",
        fallbackDescription:
          `Expeditorul nu a confirmat punctul de intalnire in ${getOperationalTimeoutLabel("pickup_meeting_point")}. SkySend opreste pickup-ul si porneste fallback-ul existent.`,
        phase: "pickup",
      };
    case "awaiting_recipient_position_confirmation":
      return {
        kind: "dropoff_meeting_point",
        status,
        title: "Confirmare punct de întâlnire",
        actionLabel: "Confirma inainte ca timerul sa expire.",
        helperText:
          `Ai la dispozitie ${getOperationalTimeoutLabel("dropoff_meeting_point")} sa confirmi punctul de predare.`,
        expiryText:
          "Dupa expirare, livrarea intra automat in fallback.",
        fallbackTitle:
          "Livrarea a intrat in fallback deoarece punctul de predare nu a fost confirmat in intervalul disponibil.",
        fallbackDescription:
          `Destinatarul nu a confirmat punctul de predare in ${getOperationalTimeoutLabel("dropoff_meeting_point")}. Coletul se intoarce la hub-ul SkySend.`,
        phase: "dropoff",
      };
    case "awaiting_parcel_load":
      return {
        kind: "parcel_load",
        status,
        title: "Incarcare colet",
        actionLabel: "Incarca coletul in locker inainte ca timerul sa expire.",
        helperText:
          `Ai la dispozitie ${getOperationalTimeoutLabel("parcel_load")} sa incarci coletul in locker.`,
        expiryText:
          "Dupa expirare, lockerul se ridica si comanda se anuleaza.",
        fallbackTitle:
          `Comanda a fost anulata deoarece coletul nu a fost incarcat in locker in ${getOperationalTimeoutLabel("parcel_load")}.`,
        fallbackDescription:
          "Expeditorul nu a incarcat coletul in locker in intervalul disponibil. Drona ridica lockerul si revine in fallback.",
        phase: "pickup",
      };
    case "awaiting_parcel_collection":
      return {
        kind: "parcel_collection",
        status,
        title: "Ridicare colet",
        actionLabel: "Ridica coletul din locker inainte ca timerul sa expire.",
        helperText:
          `Ai la dispozitie ${getOperationalTimeoutLabel("parcel_collection")} sa ridici coletul din locker.`,
        expiryText:
          "Dupa expirare, lockerul se ridica si drona revine la hub.",
        fallbackTitle:
          `Livrarea a intrat in fallback deoarece coletul nu a fost ridicat din locker in ${getOperationalTimeoutLabel("parcel_collection")}.`,
        fallbackDescription:
          "Destinatarul nu a ridicat coletul din locker in intervalul disponibil. Drona ridica lockerul si se intoarce la hub.",
        phase: "dropoff",
      };
    default:
      return null;
  }
}

function getUserActionTimerForStatus(
  status: MissionStatus,
  startedAtMsOverride?: number,
): MissionUserActionTimer | null {
  const config = getUserActionTimerConfig(status);

  if (!config) {
    return null;
  }

  if (
    startedAtMsOverride === undefined &&
    snapshot.userActionTimer?.status === status
  ) {
    return snapshot.userActionTimer;
  }

  const startedAtMs = startedAtMsOverride ?? Date.now();
  const timeoutMs = getUserActionTimeoutMs(config.kind);

  return {
    ...config,
    startedAt: new Date(startedAtMs).toISOString(),
    expiresAt: new Date(startedAtMs + timeoutMs).toISOString(),
    timeoutMs,
  };
}

function getInitialMissionStatusForOrder(order: CreatedDeliveryOrder): MissionStatus {
  if (
    order.fulfillmentStatus === "completed_mission" &&
    isKnownMissionStatus(order.missionStatus) &&
    isFinalProofStatus(order.missionStatus)
  ) {
    return order.missionStatus;
  }

  if (order.fulfillmentStatus === "completed_mission") {
    return "proof_generated";
  }

  if (order.fulfillmentStatus === "failed_mission") {
    return "mission_failed";
  }

  if (order.fulfillmentStatus === "fallback_required") {
    return "fallback_required";
  }

  if (isKnownMissionStatus(order.missionStatus)) {
    return order.missionStatus;
  }

  return "mission_created";
}

function notifyListeners() {
  listeners.forEach((listener) => listener(snapshot));
}

function persistMissionRuntimeSnapshot(nextSnapshot: MissionRuntimeSnapshot) {
  if (typeof window === "undefined" || !nextSnapshot.currentMission) {
    return;
  }

  window.localStorage.setItem(
    getRuntimeStorageKey(nextSnapshot.currentMission.sourceOrderId),
    JSON.stringify({
      savedAt: getCurrentTimestamp(),
      snapshot: nextSnapshot,
    }),
  );
}

function setSnapshot(nextSnapshot: Omit<MissionRuntimeSnapshot, "isRehydrating">) {
  snapshot = { ...nextSnapshot, isRehydrating: pendingDBRehydrationOrders.size > 0 };
  persistMissionRuntimeSnapshot(snapshot);
  notifyListeners();
}

function clearRuntimeTimers() {
  if (timers.stepTimeout) {
    clearTimeout(timers.stepTimeout);
    timers.stepTimeout = null;
  }

  if (timers.progressInterval) {
    clearInterval(timers.progressInterval);
    timers.progressInterval = null;
  }

  if (timers.userActionTimeout) {
    clearTimeout(timers.userActionTimeout);
    timers.userActionTimeout = null;
  }
}

function toAddressSnapshot(
  address: CreatedDeliveryOrder["payload"]["pickupAddress"],
): AddressSnapshot {
  return {
    formattedAddress: address.formattedAddress,
    city: address.city ?? activeHub.address.city,
    county: address.county ?? activeHub.address.county,
    country: address.country ?? activeHub.address.country,
    postalCode: address.postalCode,
    location: address.location,
  };
}

function toMissionRoutePoint({
  label,
  address,
  location,
}: {
  label: string;
  address: CreatedDeliveryOrder["payload"]["pickupAddress"];
  location?: GeoPoint;
}): MissionRoutePoint {
  return {
    label,
    location: location ?? address.location,
    address: toAddressSnapshot(address),
  };
}

function showMissionToast(input: {
  title: string;
  message: string;
  tone?: "info" | "success" | "warning" | "destructive";
}) {
  if (typeof window === "undefined") {
    return;
  }

  showToast(input);
}

function getMeetingPointConfidence(
  point: CreateDeliveryMeetingPointPayload,
): MissionMeetingPoint["confidence"] {
  if (point.smartScore >= 78) {
    return "high";
  }

  if (point.smartScore >= 55) {
    return "medium";
  }

  return "low";
}

function toMissionMeetingPoint(
  point: CreateDeliveryMeetingPointPayload,
  index: number,
): MissionMeetingPoint {
  return {
    id: point.id,
    label: point.label,
    type: point.type,
    coordinates: point.location,
    distanceFromSelectedAddressMeters: Math.round(
      point.distanceFromOriginMeters,
    ),
    confidence: getMeetingPointConfidence(point),
    reason: point.description || "Punct de intalnire disponibil.",
    status: index === 0 ? "current" : "pending",
  };
}

function buildMissionMeetingPoints({
  selectedPoint,
  availablePoints,
}: {
  selectedPoint: CreateDeliveryMeetingPointPayload;
  availablePoints?: CreateDeliveryMeetingPointPayload[];
}) {
  const pointMap = new Map<string, CreateDeliveryMeetingPointPayload>();

  [selectedPoint, ...(availablePoints ?? [])].forEach((point) => {
    if (
      point.eligibilityState !== "outside" &&
      point.recommendationState !== "unavailable"
    ) {
      pointMap.set(point.id, point);
    }
  });

  return [...pointMap.values()].map(toMissionMeetingPoint);
}

function getCurrentPickupMeetingPoint(mission: Mission) {
  return (
    mission.meetingPointAttempts.pickupMeetingPoints[
      mission.meetingPointAttempts.currentPickupMeetingPointIndex
    ] ?? null
  );
}

function getCurrentDropoffMeetingPoint(mission: Mission) {
  return (
    mission.meetingPointAttempts.dropoffMeetingPoints[
      mission.meetingPointAttempts.currentDropoffMeetingPointIndex
    ] ?? null
  );
}

function getActionActor(action: MissionAction): MissionActor {
  if (
    action === "confirm_sender_position" ||
    action === "verify_pickup_pin" ||
    action === "confirm_parcel_loaded"
  ) {
    return "sender";
  }

  if (
    action === "confirm_recipient_position" ||
    action === "verify_recipient_pin" ||
    action === "confirm_parcel_collected"
  ) {
    return "recipient";
  }

  return "operator";
}

function getPendingActionRequirement(
  status: MissionStatus,
): MissionActionRequirement | null {
  const action = getAllowedMissionAction(status);

  if (!action) {
    return null;
  }

  return {
    action,
    actor: getActionActor(action),
    label: missionActionLabels[action],
  };
}

function getPendingActions(status: MissionStatus): MissionActionRequirement[] {
  const requirement = getPendingActionRequirement(status);

  return requirement ? [requirement] : [];
}

function getActiveSegmentForStatus(
  mission: Mission,
  status: MissionStatus,
): MissionSegment | null {
  if (
    status === "drone_dispatched" ||
    status === "en_route_to_pickup" ||
    status === "arrived_at_pickup"
  ) {
    return (
      mission.segments.find((segment) => segment.type === "warehouse_to_pickup") ??
      null
    );
  }

  if (
    status === "parcel_secured" ||
    status === "en_route_to_dropoff" ||
    status === "arrived_at_dropoff"
  ) {
    return (
      mission.segments.find((segment) => segment.type === "pickup_to_dropoff") ??
      null
    );
  }

  if (status === "returning_to_hub" || status === "returned_to_hub") {
    return (
      mission.segments.find((segment) => segment.type === "dropoff_to_warehouse") ??
      mission.segments.find((segment) => segment.type === "fallback") ??
      null
    );
  }

  return null;
}

function getProgressForStatus(status: MissionStatus, currentProgress: number) {
  if (status === "arrived_at_pickup" || status === "arrived_at_dropoff") {
    return 1;
  }

  if (status === "returned_to_hub") {
    return 1;
  }

  if (
    status === "en_route_to_pickup" ||
    status === "en_route_to_dropoff" ||
    status === "returning_to_hub"
  ) {
    return currentProgress;
  }

  return 0;
}

function getDronePosition(
  mission: Mission,
  activeSegment: MissionSegment | null,
  progress: number,
  status: MissionStatus,
): GeoPoint {
  if (!activeSegment) {
    const phase = getMissionPhaseForStatus(status);

    if (phase === "pickup" || phase === "linehaul") {
      return mission.pickup.location;
    }

    if (phase === "dropoff" || phase === "proof" || phase === "closed") {
      return mission.dropoff.location;
    }

    return snapshot.currentMission?.sourceOrderId === mission.sourceOrderId
      ? snapshot.dronePosition ?? mission.hub.address.location
      : mission.hub.address.location;
  }

  return interpolateGeoPoint(
    activeSegment.from.location,
    activeSegment.to.location,
    progress,
  );
}

function createTelemetry({
  mission,
  status,
  activeSegment,
  position,
  lockerState,
  progress,
}: {
  mission: Mission;
  status: MissionStatus;
  activeSegment: MissionSegment | null;
  position: GeoPoint;
  lockerState: LockerState;
  progress: number;
}): DroneTelemetry {
  const headingDegrees = activeSegment
    ? calculateHeadingDegrees(
        activeSegment.from.location,
        activeSegment.to.location,
      )
    : snapshot.droneTelemetry?.headingDegrees ?? 0;
  const distanceMeters = (activeSegment?.distanceKm ?? 0) * 1000;
  const durationSeconds = activeSegment?.plannedDurationSeconds ?? 1;
  const isFlying = Boolean(activeSegment && progress > 0 && progress < 1);
  const payloadStatuses: MissionStatus[] = [
    "locker_ascending_pickup",
    "payload_verification",
    "parcel_secured",
    "en_route_to_dropoff",
    "arrived_at_dropoff",
    "awaiting_recipient_position_confirmation",
    "dropoff_safety_check",
    "locker_descending_dropoff",
    "awaiting_recipient_pin",
    "awaiting_parcel_collection",
    "returning_to_hub",
    "returned_to_hub",
  ];
  const payloadWeightKg = payloadStatuses.includes(status) ? 1.8 : 0;
  const batteryUsed =
    mission.events.length * 1.4 +
    (status === "en_route_to_pickup" || status === "en_route_to_dropoff"
      ? progress * 4
      : 0);
  const signalDip = isFlying ? Math.round(progress * 2) : 0;

  return {
    droneId: mission.droneId ?? `${mission.droneClass}_runtime`,
    recordedAt: getCurrentTimestamp(),
    location: position,
    altitudeMeters: isFlying ? 82 : 18,
    groundSpeedMps: isFlying
      ? Math.round((distanceMeters / durationSeconds) * 10) / 10
      : 0,
    headingDegrees,
    batteryPercent: Math.max(35, Math.round(100 - batteryUsed)),
    signalPercent: Math.max(91, 97 - signalDip),
    payloadWeightKg,
    lockerState,
  };
}

function updateSegmentsForStatus(
  segments: MissionSegment[],
  status: MissionStatus,
): MissionSegment[] {
  return segments.map((segment) => {
    const isPickupSegment = segment.type === "warehouse_to_pickup";
    const isDropoffSegment = segment.type === "pickup_to_dropoff";
    const pickupDoneStatuses: MissionStatus[] = [
      "arrived_at_pickup",
      "awaiting_sender_position_confirmation",
      "pickup_safety_check",
      "locker_descending_pickup",
      "awaiting_pickup_pin",
      "awaiting_parcel_load",
      "locker_ascending_pickup",
      "payload_verification",
      "parcel_secured",
      "en_route_to_dropoff",
      "arrived_at_dropoff",
      "awaiting_recipient_position_confirmation",
      "dropoff_safety_check",
      "locker_descending_dropoff",
      "awaiting_recipient_pin",
      "awaiting_parcel_collection",
      "locker_ascending_dropoff",
      "delivery_completed",
      "proof_generated",
      "mission_closed",
      "returning_to_hub",
      "returned_to_hub",
    ];
    const dropoffDoneStatuses: MissionStatus[] = [
      "arrived_at_dropoff",
      "awaiting_recipient_position_confirmation",
      "dropoff_safety_check",
      "locker_descending_dropoff",
      "awaiting_recipient_pin",
      "awaiting_parcel_collection",
      "locker_ascending_dropoff",
      "delivery_completed",
      "proof_generated",
      "mission_closed",
      "returning_to_hub",
      "returned_to_hub",
    ];

    if (isPickupSegment && status === "en_route_to_pickup") {
      return { ...segment, state: "active" };
    }

    if (isDropoffSegment && status === "en_route_to_dropoff") {
      return { ...segment, state: "active" };
    }

    if (isPickupSegment && pickupDoneStatuses.includes(status)) {
      return { ...segment, state: "completed" };
    }

    if (isDropoffSegment && dropoffDoneStatuses.includes(status)) {
      return { ...segment, state: "completed" };
    }

    if (
      (segment.type === "dropoff_to_warehouse" || segment.type === "fallback") &&
      status === "returning_to_hub"
    ) {
      return { ...segment, state: "active" };
    }

    if (
      (segment.type === "dropoff_to_warehouse" || segment.type === "fallback") &&
      (status === "returned_to_hub" || status === "mission_failed")
    ) {
      return { ...segment, state: "completed" };
    }

    if (status === "mission_failed" || status === "fallback_required") {
      return segment.state === "active" ? { ...segment, state: "failed" } : segment;
    }

    return segment.state === "active" ? { ...segment, state: "pending" } : segment;
  });
}

function applyMissionStatus(
  mission: Mission,
  status: MissionStatus,
  events: MissionEvent[] = mission.events,
  progress = snapshot.segmentProgress,
  userActionStartedAtMs?: number,
): Omit<MissionRuntimeSnapshot, "isRehydrating"> {
  const missionWithEtaTiming = normalizeMissionEtaTiming(mission);
  const lockerState =
    getLockerStateForStatus(status) ?? missionWithEtaTiming.locker.state;
  const nextMission: Mission = {
    ...missionWithEtaTiming,
    status,
    phase: getMissionPhaseForStatus(status),
    updatedAt: getCurrentTimestamp(),
    locker: {
      ...missionWithEtaTiming.locker,
      state: lockerState,
      lastStateChangedAt:
        lockerState === missionWithEtaTiming.locker.state
          ? missionWithEtaTiming.locker.lastStateChangedAt
          : getCurrentTimestamp(),
    },
    pendingActions: getPendingActions(status),
    events,
    segments: updateSegmentsForStatus(missionWithEtaTiming.segments, status),
  };
  const activeSegment = getActiveSegmentForStatus(nextMission, status);
  const segmentProgress = getProgressForStatus(status, progress);
  const dronePosition = getDronePosition(
    nextMission,
    activeSegment,
    segmentProgress,
    status,
  );
  const droneTelemetry = createTelemetry({
    mission: nextMission,
    status,
    activeSegment,
    position: dronePosition,
    lockerState,
    progress: segmentProgress,
  });
  const telemetryLog = [
    ...(nextMission.telemetryLog ?? []),
    droneTelemetry,
  ].slice(-50);
  const missionWithTelemetry: Mission = {
    ...nextMission,
    latestTelemetry: droneTelemetry,
    telemetryLog,
  };
  const stepConfig = getMissionStepConfig(status);
  const userActionTimer = getUserActionTimerForStatus(
    status,
    userActionStartedAtMs,
  );

  return {
    currentMission: missionWithTelemetry,
    currentStatus: status,
    activeSegment,
    segmentProgress,
    dronePosition,
    lockerState,
    droneTelemetry,
    pendingAction: getAllowedMissionAction(status),
    eventLog: events,
    isMissionRunning: stepConfig.advanceMode !== "terminal",
    isWaitingForUser: isMissionWaitingForUser(status),
    userActionTimer,
  };
}

function getStepDurationSeconds(
  mission: Mission,
  status: MissionStatus,
  activeSegment: MissionSegment | null,
) {
  if (
    (status === "en_route_to_pickup" || status === "en_route_to_dropoff") &&
    activeSegment?.plannedDurationSeconds
  ) {
    return activeSegment.plannedDurationSeconds;
  }

  return getMissionStepConfig(status).durationSeconds ?? 0;
}

function scheduleAutomaticProgress() {
  clearRuntimeTimers();

  const mission = snapshot.currentMission;
  const status = snapshot.currentStatus;

  if (!mission || !status) {
    return;
  }

  if (isMissionWaitingForUser(status)) {
    scheduleUserActionTimeout(status);
    return;
  }

  const stepConfig = getMissionStepConfig(status);

  if (stepConfig.advanceMode !== "automatic") {
    return;
  }

  const durationSeconds = getStepDurationSeconds(
    mission,
    status,
    snapshot.activeSegment,
  );
  const durationMs = durationSeconds * 1000;
  const canTrackProgress =
    status === "en_route_to_pickup" ||
    status === "en_route_to_dropoff" ||
    status === "returning_to_hub";
  const initialProgress = canTrackProgress ? snapshot.segmentProgress : 0;
  const remainingDurationMs = Math.max(
    0,
    durationMs * (1 - initialProgress),
  );
  const startedAt = Date.now() - durationMs * initialProgress;

  if (!canRunTimers() || durationMs <= 0) {
    return;
  }

  if (canTrackProgress) {
    timers.progressInterval = setInterval(() => {
      const currentMission = snapshot.currentMission;
      const currentStatus = snapshot.currentStatus;

      if (!currentMission || currentStatus !== status) {
        clearRuntimeTimers();
        return;
      }

      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
      setSnapshot(
        applyMissionStatus(
          currentMission,
          status,
          currentMission.events,
          progress,
        ),
      );

      const dbTelemetry: DroneTelemetrySnapshot = {
        position: snapshot.dronePosition ?? { latitude: 0, longitude: 0 },
        heading: snapshot.droneTelemetry?.headingDegrees ?? 0,
        speed: snapshot.droneTelemetry?.groundSpeedMps ?? 0,
        segmentProgress: progress,
        segmentId: snapshot.activeSegment?.id ?? null,
        altitudeMeters: snapshot.droneTelemetry?.altitudeMeters,
        batteryPercent: snapshot.droneTelemetry?.batteryPercent,
        lastUpdatedAt: new Date().toISOString(),
      };
      maybeWriteTelemetryFromRuntime(currentMission.sourceOrderId, dbTelemetry);
    }, 100);
  }

  timers.stepTimeout = setTimeout(() => {
    completeCurrentAutomaticStep();
  }, remainingDurationMs);
}

function readPersistedMissionRuntimeSnapshot(orderId: string):
  | {
      savedAtMs: number;
      snapshot: MissionRuntimeSnapshot;
    }
  | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(getRuntimeStorageKey(orderId));

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as {
      savedAt?: string;
      snapshot?: MissionRuntimeSnapshot;
    };
    const savedAtMs = getValidTimestampMs(parsedValue.savedAt);
    const persistedSnapshot = parsedValue.snapshot;

    if (
      savedAtMs === null ||
      !persistedSnapshot?.currentMission ||
      persistedSnapshot.currentMission.sourceOrderId !== orderId
    ) {
      return null;
    }

    return {
      savedAtMs,
      snapshot: {
        ...persistedSnapshot,
        currentMission: normalizeMissionEtaTiming(
          persistedSnapshot.currentMission,
        ),
      },
    };
  } catch {
    return null;
  }
}

function restorePersistedMissionRuntimeSnapshot(order: CreatedDeliveryOrder) {
  const persisted = readPersistedMissionRuntimeSnapshot(order.id);

  if (!persisted) {
    return null;
  }

  setSnapshot(persisted.snapshot);

  return persisted;
}

function persistCreatedDeliveryOrderMissionState() {
  const mission = snapshot.currentMission;
  const status = snapshot.currentStatus;

  if (!mission || !status) {
    return;
  }

  const storedOrder = readCreatedDeliveryOrder(mission.sourceOrderId);
  const fulfillmentStatus = isFinalProofStatus(status)
    ? "completed_mission"
    : status === "mission_failed"
      ? "failed_mission"
      : "active_mission";

  if (
    storedOrder?.fulfillmentStatus === "failed_mission" ||
    storedOrder?.fulfillmentStatus === "fallback_required" ||
    storedOrder?.fulfillmentStatus === "canceled"
  ) {
    return;
  }

  if (
    storedOrder?.fulfillmentStatus === fulfillmentStatus &&
    storedOrder.missionId === mission.id &&
    storedOrder.missionStatus === status
  ) {
    return;
  }

  updateCreatedDeliveryOrderFulfillment({
    orderId: mission.sourceOrderId,
    fulfillmentStatus,
    missionId: mission.id,
    missionStatus: status,
    completedAt: isFinalProofStatus(status) ? getCurrentTimestamp() : null,
  });
}

function maybeNotifyFirstUserAction({
  orderId,
  isLiveTrackingVisible,
}: {
  orderId: string;
  isLiveTrackingVisible?: boolean;
}) {
  const timer = snapshot.userActionTimer;

  if (!timer || isLiveTrackingVisible || typeof window === "undefined") {
    return;
  }

  const storageKey = getUserActionNotificationStorageKey(orderId);

  if (window.localStorage.getItem(storageKey)) {
    return;
  }

  window.localStorage.setItem(storageKey, getCurrentTimestamp());
  showMissionToast({
    title:
      timer.kind === "pickup_meeting_point" ||
      timer.kind === "dropoff_meeting_point"
        ? "Drona a ajuns la punctul de intalnire"
        : timer.title,
    message:
      timer.kind === "pickup_meeting_point" ||
      timer.kind === "dropoff_meeting_point"
        ? `Ai ${formatTimerDuration(timer.timeoutMs)} sa confirmi.`
        : timer.helperText,
    tone: "warning",
  });
}

function handleWaitingStatusCatchup({
  orderId,
  isLiveTrackingVisible,
}: {
  orderId: string;
  isLiveTrackingVisible?: boolean;
}) {
  const timer = snapshot.userActionTimer;

  if (!timer) {
    return snapshot;
  }

  if (Date.parse(timer.expiresAt) <= Date.now()) {
    return expireUserActionTimer(timer);
  }

  maybeNotifyFirstUserAction({ orderId, isLiveTrackingVisible });
  scheduleAutomaticProgress();

  return snapshot;
}

function isProgressTrackedStatus(status: MissionStatus) {
  return (
    status === "en_route_to_pickup" ||
    status === "en_route_to_dropoff" ||
    status === "returning_to_hub"
  );
}

function fastForwardAutomaticMission({
  elapsedMs,
  orderId,
  isLiveTrackingVisible,
}: {
  elapsedMs: number;
  orderId: string;
  isLiveTrackingVisible?: boolean;
}) {
  let remainingMs = Math.max(0, elapsedMs);

  while (remainingMs >= 0) {
    const mission = snapshot.currentMission;
    const status = snapshot.currentStatus;

    if (!mission || !status) {
      return snapshot;
    }

    if (isMissionWaitingForUser(status)) {
      return handleWaitingStatusCatchup({ orderId, isLiveTrackingVisible });
    }

    const stepConfig = getMissionStepConfig(status);

    if (stepConfig.advanceMode !== "automatic") {
      scheduleAutomaticProgress();
      return snapshot;
    }

    const durationSeconds = getStepDurationSeconds(
      mission,
      status,
      snapshot.activeSegment,
    );
    const durationMs = durationSeconds * 1000;

    if (durationMs <= 0) {
      completeCurrentAutomaticStep();
      continue;
    }

    const statusProgressMs = isProgressTrackedStatus(status)
      ? snapshot.segmentProgress * durationMs
      : 0;
    const totalStatusElapsedMs = statusProgressMs + remainingMs;

    if (totalStatusElapsedMs < durationMs) {
      const progress = isProgressTrackedStatus(status)
        ? totalStatusElapsedMs / durationMs
        : snapshot.segmentProgress;

      setSnapshot(applyMissionStatus(mission, status, mission.events, progress));
      scheduleAutomaticProgress();

      return snapshot;
    }

    remainingMs = totalStatusElapsedMs - durationMs;
    completeCurrentAutomaticStep();

    if (
      snapshot.currentStatus &&
      isMissionWaitingForUser(snapshot.currentStatus)
    ) {
      const timerStartedAtMs = Date.now() - remainingMs;
      const waitingMission = snapshot.currentMission;
      const waitingStatus = snapshot.currentStatus;

      if (waitingMission) {
        setSnapshot(
          applyMissionStatus(
            waitingMission,
            waitingStatus,
            waitingMission.events,
            0,
            timerStartedAtMs,
          ),
        );
      }

      return handleWaitingStatusCatchup({ orderId, isLiveTrackingVisible });
    }
  }

  scheduleAutomaticProgress();

  return snapshot;
}

function transitionToStatus(
  mission: Mission,
  status: MissionStatus,
  extraEvents: MissionEvent[] = [],
) {
  const event = createStatusChangeEvent({
    missionId: mission.id,
    status,
  });
  const events = [...mission.events, ...extraEvents, event];

  setSnapshot(applyMissionStatus(mission, status, events));
  scheduleAutomaticProgress();

  const orderId = mission.sourceOrderId;
  persistStatusChange(orderId, status, {
    stepStartedAt: snapshot.userActionTimer?.startedAt ?? getCurrentTimestamp(),
    stepExpiresAt: snapshot.userActionTimer?.expiresAt ?? null,
    failureCode:
      status === "mission_failed" ? mission.failureReason ?? "unknown" : null,
    failedAt: status === "mission_failed" ? getCurrentTimestamp() : null,
    runtimeState: {
      meetingPointAttempts: mission.meetingPointAttempts as never,
      pickup: mission.pickup as never,
      dropoff: mission.dropoff as never,
      startedAt: mission.startedAt ?? null,
      completedAt: mission.completedAt ?? null,
      parcelLoaded: [
        "en_route_to_dropoff",
        "arrived_at_dropoff",
        "awaiting_recipient_position_confirmation",
        "awaiting_parcel_collection",
        "delivery_completed",
        "proof_generated",
        "mission_closed",
      ].includes(status),
    },
  }).catch(() => {});
  for (const newEvent of [...extraEvents, event]) {
    persistMissionEvent(orderId, newEvent).catch(() => {});
  }

  return snapshot;
}

function getCurrentMission() {
  return snapshot.currentMission;
}

function runRequiredAction(action: MissionAction, actor: MissionActor) {
  const mission = getCurrentMission();
  const status = snapshot.currentStatus;

  if (!mission || !status || getAllowedMissionAction(status) !== action) {
    return snapshot;
  }

  const actionEvent = createActionEvent({
    missionId: mission.id,
    status,
    action,
    actor,
  });
  const missionWithEtaDelay = consumeCurrentEtaDelay(mission);
  const missionWithActionEvent = appendMissionEvent(
    missionWithEtaDelay,
    actionEvent,
  );
  const nextStatus = getMissionStepConfig(status).nextStatus;

  if (!nextStatus) {
    clearRuntimeTimers();
    return snapshot;
  }

  return transitionToStatus(missionWithActionEvent, nextStatus);
}

function updateMissionPins(mission: Mission, pins: MissionPin[]) {
  return {
    ...mission,
    pins,
  };
}

function findMissionPin(mission: Mission, purpose: MissionPin["purpose"]) {
  return mission.pins.find((pin) => pin.purpose === purpose) ?? null;
}

function updateMissionForPickupMeetingPoint(
  mission: Mission,
  pointIndex: number,
): Mission {
  const point = mission.meetingPointAttempts.pickupMeetingPoints[pointIndex];

  if (!point) {
    return mission;
  }

  const pickup = {
    ...mission.pickup,
    label: point.label,
    location: point.coordinates,
  };
  const currentDronePosition = snapshot.dronePosition ?? mission.pickup.location;
  const warehouseToPickupDistanceKm = calculateDistanceKm(
    currentDronePosition,
    point.coordinates,
  );
  const pickupToDropoffDistanceKm = calculateDistanceKm(
    point.coordinates,
    mission.dropoff.location,
  );
  const segments = mission.segments.map((segment) => {
    if (segment.type === "warehouse_to_pickup") {
      return {
        ...segment,
        state: "pending" as const,
        from: {
          label: "Pozitie curenta drona",
          location: currentDronePosition,
        },
        to: pickup,
        distanceKm: warehouseToPickupDistanceKm,
        plannedDurationSeconds: Math.max(
          6,
          Math.round(warehouseToPickupDistanceKm * 18 + 6),
        ),
      };
    }

    if (segment.type === "pickup_to_dropoff") {
      return {
        ...segment,
        state: "pending" as const,
        from: pickup,
        distanceKm: pickupToDropoffDistanceKm,
        plannedDurationSeconds: Math.max(
          10,
          Math.round(pickupToDropoffDistanceKm * 18 + 10),
        ),
      };
    }

    return segment;
  });

  return {
    ...mission,
    pickup,
    orderSnapshot: {
      ...mission.orderSnapshot,
      pickupPointId: point.id,
    },
    meetingPointAttempts: {
      ...mission.meetingPointAttempts,
      currentPickupMeetingPointIndex: pointIndex,
      pickupMeetingPoints:
        mission.meetingPointAttempts.pickupMeetingPoints.map((meetingPoint, index) =>
          index === pointIndex && meetingPoint.status !== "accepted"
            ? { ...meetingPoint, status: "current" }
            : meetingPoint.status === "current"
              ? { ...meetingPoint, status: "pending" }
              : meetingPoint,
        ),
    },
    segments,
  };
}

function updateMissionForDropoffMeetingPoint(
  mission: Mission,
  pointIndex: number,
): Mission {
  const point = mission.meetingPointAttempts.dropoffMeetingPoints[pointIndex];

  if (!point) {
    return mission;
  }

  const dropoff = {
    ...mission.dropoff,
    label: point.label,
    location: point.coordinates,
  };
  const currentDronePosition = snapshot.dronePosition ?? mission.dropoff.location;
  const pickupToDropoffDistanceKm = calculateDistanceKm(
    currentDronePosition,
    point.coordinates,
  );
  const segments = mission.segments.map((segment) => {
    if (segment.type === "pickup_to_dropoff") {
      return {
        ...segment,
        state: "pending" as const,
        from: {
          label: "Pozitie curenta drona",
          location: currentDronePosition,
        },
        to: dropoff,
        distanceKm: pickupToDropoffDistanceKm,
        plannedDurationSeconds: Math.max(
          6,
          Math.round(pickupToDropoffDistanceKm * 18 + 6),
        ),
      };
    }

    return segment;
  });

  return {
    ...mission,
    dropoff,
    orderSnapshot: {
      ...mission.orderSnapshot,
      dropoffPointId: point.id,
    },
    meetingPointAttempts: {
      ...mission.meetingPointAttempts,
      currentDropoffMeetingPointIndex: pointIndex,
      dropoffMeetingPoints:
        mission.meetingPointAttempts.dropoffMeetingPoints.map((meetingPoint, index) =>
          index === pointIndex && meetingPoint.status !== "accepted"
            ? { ...meetingPoint, status: "current" }
            : meetingPoint.status === "current"
              ? { ...meetingPoint, status: "pending" }
              : meetingPoint,
        ),
    },
    segments,
  };
}

function buildReturnToHubSegment(mission: Mission): MissionSegment {
  const currentDronePosition =
    snapshot.dronePosition ?? mission.latestTelemetry?.location ?? mission.dropoff.location;
  const hubPoint = {
    label: mission.hub.name,
    location: mission.hub.address.location,
    address: mission.hub.address,
  };
  const distanceKm = calculateDistanceKm(currentDronePosition, hubPoint.location);

  return {
    id: `${mission.id}:return_to_hub:${mission.events.length}`,
    missionId: mission.id,
    type: "dropoff_to_warehouse",
    state: "pending",
    sequence: mission.segments.length + 1,
    from: {
      label: "Pozitie curenta drona",
      location: currentDronePosition,
    },
    to: hubPoint,
    distanceKm,
    plannedDurationSeconds: Math.max(8, Math.round(distanceKm * 18 + 8)),
  };
}

function activeateFallback({
  mission,
  phase,
  fallbackTitle,
  fallbackDescription,
  fallbackEventTitle,
  fallbackEventDescription,
  failureCode,
  refundEligible = false,
}: {
  mission: Mission;
  phase: "pickup" | "dropoff";
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackEventTitle?: string;
  fallbackEventDescription?: string;
  failureCode?: PremiumFailureCode;
  refundEligible?: boolean;
}) {
  const isPickup = phase === "pickup";
  const title = fallbackTitle ?? (isPickup
    ? "Nu am gasit un punct potrivit pentru pickup"
    : "Livrarea nu a putut fi finalizata");
  const description = fallbackDescription ?? (isPickup
    ? "Drona nu a putut cobori lockerul in siguranta la punctele disponibile. Comanda a fost anulata, iar suma platita va fi rambursata pe cardul folosit la plata."
    : "Drona nu a gasit un punct potrivit pentru coborarea lockerului la destinatie. Coletul se intoarce in siguranta la hub-ul SkySend si va putea fi ridicat de acolo.");
  const failureReason = failureCode ?? (isPickup
    ? "no_suitable_pickup_meeting_point"
    : "no_suitable_dropoff_meeting_point");
  const fallbackOutcome = failureReason === "no_suitable_pickup_meeting_point"
    ? "no_suitable_pickup_meeting_point"
    : failureReason === "no_suitable_dropoff_meeting_point"
      ? "delivery_failed_return_required"
      : failureReason;
  const noPointsEvent = createSystemEvent({
    missionId: mission.id,
    status: mission.status,
    title:
      fallbackEventTitle ??
      (isPickup
        ? "Nu mai exista puncte de pickup disponibile."
        : "Nu mai exista puncte de livrare disponibile."),
    description:
      fallbackEventDescription ??
      (isPickup
        ? "Toate punctele de pickup disponibile au fost respinse."
        : "Toate punctele de livrare disponibile au fost respinse."),
  });
  const failureEvent = createSystemEvent({
    missionId: mission.id,
    status: "mission_failed",
    title,
    description,
  });
  const refundEvent = refundEligible ? createSystemEvent({
    missionId: mission.id,
    status: "mission_failed",
    title: "Rambursarea este in curs.",
    description:
      "Rambursarea integrala a fost solicitata catre metoda de plata folosita.",
  }) : null;
  const missionWithFallback: Mission = {
    ...mission,
    failureReason,
    meetingPointAttempts: {
      ...mission.meetingPointAttempts,
      pickupFallbackActiveated:
        mission.meetingPointAttempts.pickupFallbackActiveated || isPickup,
      dropoffFallbackActiveated:
        mission.meetingPointAttempts.dropoffFallbackActiveated || !isPickup,
    },
  };

  markCreatedDeliveryOrderFallback({
    orderId: mission.sourceOrderId,
    missionId: mission.id,
    missionStatus: "mission_failed",
    fallbackOutcome,
    fallbackReason: title,
    warehousePickupRequired: !isPickup,
  });

  if (refundEligible && typeof window !== "undefined") {
    void fetch("/api/stripe/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: mission.sourceOrderId,
        reason: failureReason,
      }),
    });
  }

  return transitionToStatus(missionWithFallback, "mission_failed", [
    noPointsEvent,
    failureEvent,
    ...(refundEvent ? [refundEvent] : []),
  ]);
}

type PersistedActiveFlight = {
  phase: "pickup" | "dropoff";
  from: GeoPoint;
  to: GeoPoint;
  startedAt: string;
  dueAt: string;
};

function isGeoPoint(value: unknown): value is GeoPoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude)
  );
}

function readPersistedActiveFlight(value: unknown): PersistedActiveFlight | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const flight = value as Record<string, unknown>;
  if (
    (flight.phase !== "pickup" && flight.phase !== "dropoff") ||
    !isGeoPoint(flight.from) ||
    !isGeoPoint(flight.to) ||
    typeof flight.startedAt !== "string" ||
    typeof flight.dueAt !== "string" ||
    !Number.isFinite(Date.parse(flight.startedAt)) ||
    !Number.isFinite(Date.parse(flight.dueAt))
  ) {
    return null;
  }
  return flight as PersistedActiveFlight;
}

function hydrateMissionFromRecord(
  mission: Mission,
  dbMission: MissionRecord,
) {
  const runtime =
    dbMission.runtimeState &&
    typeof dbMission.runtimeState === "object" &&
    !Array.isArray(dbMission.runtimeState)
      ? (dbMission.runtimeState as Record<string, unknown>)
      : {};
  const persistedAttempts = runtime.meetingPointAttempts;
  const meetingPointAttempts =
    persistedAttempts &&
    typeof persistedAttempts === "object" &&
    !Array.isArray(persistedAttempts)
      ? {
          ...mission.meetingPointAttempts,
          ...(persistedAttempts as Partial<Mission["meetingPointAttempts"]>),
        }
      : mission.meetingPointAttempts;
  const pickupPoint =
    meetingPointAttempts.pickupMeetingPoints[
      meetingPointAttempts.currentPickupMeetingPointIndex
    ];
  const dropoffPoint =
    meetingPointAttempts.dropoffMeetingPoints[
      meetingPointAttempts.currentDropoffMeetingPointIndex
    ];
  const pickup = pickupPoint
    ? { ...mission.pickup, label: pickupPoint.label, location: pickupPoint.coordinates }
    : mission.pickup;
  const dropoff = dropoffPoint
    ? { ...mission.dropoff, label: dropoffPoint.label, location: dropoffPoint.coordinates }
    : mission.dropoff;
  const activeFlight = readPersistedActiveFlight(runtime.activeFlight);
  let segments = buildMissionSegments({
    missionId: mission.id,
    pickup,
    dropoff,
    warehouse: mission.hub,
  });

  if (activeFlight) {
    const segmentType =
      activeFlight.phase === "pickup"
        ? "warehouse_to_pickup"
        : "pickup_to_dropoff";
    const durationSeconds = Math.max(
      1,
      (Date.parse(activeFlight.dueAt) - Date.parse(activeFlight.startedAt)) / 1000,
    );
    segments = segments.map((segment) =>
      segment.type === segmentType
        ? {
            ...segment,
            from: { label: "Poziție de plecare", location: activeFlight.from },
            to: {
              label: activeFlight.phase === "pickup" ? pickup.label : dropoff.label,
              location: activeFlight.to,
            },
            distanceKm: calculateDistanceKm(activeFlight.from, activeFlight.to),
            plannedDurationSeconds: durationSeconds,
          }
        : segment,
    );
  }

  const pins = mission.pins.map((pin) => {
    const code =
      pin.purpose === "pickup_verification"
        ? dbMission.pickupPin
        : dbMission.dropoffPin;
    return code ? { ...pin, code } : pin;
  });

  return {
    mission: {
      ...mission,
      meetingPointAttempts,
      pickup,
      dropoff,
      segments,
      pins,
      startedAt: dbMission.startedAt ?? mission.startedAt,
      completedAt: dbMission.completedAt ?? mission.completedAt,
      failureReason:
        (dbMission.failureCode as Mission["failureReason"]) ??
        mission.failureReason,
    },
    activeFlight,
  };
}

function getPersistedFlightProgress(flight: PersistedActiveFlight | null) {
  if (!flight) return null;
  const startedAt = Date.parse(flight.startedAt);
  const dueAt = Date.parse(flight.dueAt);
  if (dueAt <= startedAt) return 1;
  return Math.min(1, Math.max(0, (Date.now() - startedAt) / (dueAt - startedAt)));
}

function expireUserActionTimer(timer: MissionUserActionTimer) {
  const mission = getCurrentMission();
  const status = snapshot.currentStatus;

  if (!mission || status !== timer.status) {
    return snapshot;
  }

  const timeoutEvent = createSystemEvent({
    missionId: mission.id,
    status,
    title: timer.fallbackTitle,
    description: timer.fallbackDescription,
  });
  const missionWithEtaDelay = addMissionEtaDelay(
    mission,
    timer.kind,
    getTimerElapsedSeconds(timer),
  );
  const missionWithTimeoutEvent = {
    ...missionWithEtaDelay,
    events: [...missionWithEtaDelay.events, timeoutEvent],
  };

  showMissionToast({
    title:
      timer.phase === "pickup"
        ? "Comanda a fost anulata"
        : "Livrarea intra in fallback",
    message: timer.fallbackTitle,
    tone: "warning",
  });

  return activeateFallback({
    mission: missionWithTimeoutEvent,
    phase: timer.phase,
    fallbackTitle: timer.fallbackTitle,
    fallbackDescription: timer.fallbackDescription,
    fallbackEventTitle: `Timerul de ${formatTimerDuration(timer.timeoutMs)} a expirat.`,
    fallbackEventDescription: timer.fallbackDescription,
    failureCode: getFailureCodeForTimerKind(timer.kind),
    refundEligible: false,
  });
}

function scheduleUserActionTimeout(status: MissionStatus) {
  const timer = snapshot.userActionTimer;

  if (!canRunTimers() || !timer || timer.status !== status) {
    return;
  }

  timers.userActionTimeout = setTimeout(
    () => expireUserActionTimer(timer),
    Math.max(0, Date.parse(timer.expiresAt) - Date.now()),
  );
}

function findNextAvailableMeetingPointIndex(
  points: readonly MissionMeetingPoint[],
  currentIndex: number,
) {
  return points.findIndex(
    (point, index) =>
      index > currentIndex &&
      (point.status === "pending" || point.status === "skipped"),
  );
}

export function subscribeMissionRuntime(listener: MissionRuntimeListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getMissionRuntimeSnapshot() {
  return snapshot;
}

export function markOrderPendingDBRehydration(orderId: string): void {
  pendingDBRehydrationOrders.add(orderId);
  snapshot = { ...snapshot, isRehydrating: true };
  notifyListeners();
}

export function clearOrderPendingDBRehydration(orderId: string): void {
  pendingDBRehydrationOrders.delete(orderId);
  snapshot = { ...snapshot, isRehydrating: pendingDBRehydrationOrders.size > 0 };
  notifyListeners();
}

export function createMissionFromOrder(
  order: CreatedDeliveryOrder,
  options: { persist?: boolean } = {},
): Mission {
  clearRuntimeTimers();

  const missionId = order.missionId ?? createRuntimeId("mission", order.id);
  const createdAt = getCurrentTimestamp();
  const initialStatus = getInitialMissionStatusForOrder(order);
  const isRestoredCompletedMission =
    order.fulfillmentStatus === "completed_mission";
  const completedAt =
    isRestoredCompletedMission || initialStatus === "mission_failed"
      ? order.completedAt ?? createdAt
      : null;
  const senderParticipantId = `${missionId}:sender`;
  const recipientParticipantId = `${missionId}:recipient`;
  const pickupMeetingPoints = buildMissionMeetingPoints({
    selectedPoint: order.payload.selectedPickupPoint,
    availablePoints: order.payload.pickupMeetingPoints,
  });
  const dropoffMeetingPoints = buildMissionMeetingPoints({
    selectedPoint: order.payload.selectedDropoffPoint,
    availablePoints: order.payload.dropoffMeetingPoints,
  });
  const initialPickupMeetingPoint =
    pickupMeetingPoints[0] ??
    toMissionMeetingPoint(order.payload.selectedPickupPoint, 0);
  const initialDropoffMeetingPoint =
    dropoffMeetingPoints[0] ??
    toMissionMeetingPoint(order.payload.selectedDropoffPoint, 0);
  const pickup = toMissionRoutePoint({
    address: order.payload.pickupAddress,
    label: initialPickupMeetingPoint.label,
    location: initialPickupMeetingPoint.coordinates,
  });
  const dropoff = toMissionRoutePoint({
    address: order.payload.dropoffAddress,
    label: initialDropoffMeetingPoint.label,
    location: initialDropoffMeetingPoint.coordinates,
  });
  const participants: MissionParticipant[] = [
    {
      id: senderParticipantId,
      missionId,
      role: "sender",
      profileId: order.payload.userId,
      displayName: "Sender",
    },
    {
      id: recipientParticipantId,
      missionId,
      role: "recipient",
      profileId: null,
      displayName: "Recipient",
    },
  ];
  const pins = generateMissionPins({
    missionId,
    senderParticipantId,
    recipientParticipantId,
    issuedAt: createdAt,
  }).map((pin) =>
    isRestoredCompletedMission
      ? {
          ...pin,
          status: "verified" as const,
          verifiedAt: order.completedAt ?? createdAt,
        }
      : pin,
  );
  const pickupPinCode =
    pins.find((p) => p.purpose === "pickup_verification")?.code ?? null;
  const dropoffPinCode =
    pins.find((p) => p.purpose === "dropoff_verification")?.code ?? null;
  const initialEvent = createStatusChangeEvent({
    missionId,
    status: initialStatus,
    timestamp: createdAt,
  });
  const mission: Mission = {
    id: missionId,
    sourceOrderId: order.id,
    orderSnapshot: {
      orderId: order.id,
      pickupPointId: order.payload.selectedPickupPoint.id,
      dropoffPointId: order.payload.selectedDropoffPoint.id,
      parcelId: `${order.id}:parcel`,
    },
    status: initialStatus,
    phase: getMissionPhaseForStatus(initialStatus),
    droneId: createRuntimeId("drone", order.payload.recommendedDroneClass),
    droneClass: order.payload.recommendedDroneClass,
    hub: activeHub,
    locker: {
      id: createRuntimeId("locker", order.id),
      state: getLockerStateForStatus(initialStatus) ?? "attached",
      lastStateChangedAt: createdAt,
    },
    pickup,
    dropoff,
    meetingPointAttempts: {
      pickupMeetingPoints,
      currentPickupMeetingPointIndex: 0,
      rejectedPickupMeetingPointIds: [],
      acceptedPickupMeetingPointId: null,
      pickupFallbackActiveated: false,
      dropoffMeetingPoints,
      currentDropoffMeetingPointIndex: 0,
      rejectedDropoffMeetingPointIds: [],
      acceptedDropoffMeetingPointId: null,
      dropoffFallbackActiveated: false,
    },
    segments: buildMissionSegments({
      missionId,
      pickup,
      dropoff,
      warehouse: activeHub,
    }),
    participants,
    pendingActions: getPendingActions(initialStatus),
    pins,
    events: [initialEvent],
    etaTiming: getDefaultEtaTiming(),
    latestTelemetry: null,
    telemetryLog: [],
    proofs: [],
    failureReason:
      (order.missionFailureCode as Mission["failureReason"]) ?? null,
    fallbackMissionId: null,
    startedAt: isRestoredCompletedMission ? order.paidAt ?? createdAt : null,
    completedAt,
    closedAt: initialStatus === "mission_closed" ? completedAt : null,
    createdAt,
    updatedAt: createdAt,
  };

  setSnapshot({
    ...applyMissionStatus(
      mission,
      initialStatus,
      mission.events,
      0,
      order.missionStepStartedAt
        ? Date.parse(order.missionStepStartedAt)
        : undefined,
    ),
    isMissionRunning: false,
  });

  if (options.persist !== false) {
    persistMissionCreated(order.id, pickupPinCode, dropoffPinCode).catch(
      () => {},
    );
  }

  return snapshot.currentMission ?? mission;
}

export function startMission() {
  const mission = getCurrentMission();

  if (!mission) {
    return snapshot;
  }

  setSnapshot({
    ...snapshot,
    currentMission: {
      ...mission,
      startedAt: mission.startedAt ?? getCurrentTimestamp(),
    },
    isMissionRunning: true,
  });
  scheduleAutomaticProgress();

  return snapshot;
}

export function syncPaidCreatedDeliveryOrderMission(
  order: CreatedDeliveryOrder,
  options: {
    notify?: boolean;
    isLiveTrackingVisible?: boolean;
    readOnly?: boolean;
  } = {},
) {
  const nowMs = Date.now();

  if (!canAutoStartPaidOrder(order, nowMs)) {
    return snapshot;
  }

  const dispatchStartMs = getPaidOrderMissionDispatchStartMs(order);

  if (dispatchStartMs === null || dispatchStartMs > nowMs) {
    return snapshot;
  }

  if (
    order.missionId &&
    isKnownMissionStatus(order.missionStatus) &&
    order.missionStatus !== "mission_created" &&
    typeof order.missionStateVersion === "number" &&
    order.missionRuntimeState !== undefined
  ) {
    const syncedSnapshot = syncMissionStatusFromOrder(order);
    if (options.notify) {
      maybeNotifyFirstUserAction({
        orderId: order.id,
        isLiveTrackingVisible: options.isLiveTrackingVisible,
      });
    }
    return syncedSnapshot;
  }

  if (snapshot.currentMission?.sourceOrderId === order.id) {
    if (snapshot.currentStatus && isMissionWaitingForUser(snapshot.currentStatus)) {
      handleWaitingStatusCatchup({
        orderId: order.id,
        isLiveTrackingVisible: options.isLiveTrackingVisible,
      });
    } else if (!snapshot.isMissionRunning) {
      setSnapshot({
        ...snapshot,
        isMissionRunning: true,
      });
      scheduleAutomaticProgress();
    }

    if (options.notify) {
      maybeNotifyFirstUserAction({
        orderId: order.id,
        isLiveTrackingVisible: options.isLiveTrackingVisible,
      });
    }
    persistCreatedDeliveryOrderMissionState();

    return snapshot;
  }

  if (
    isKnownMissionStatus(order.missionStatus) &&
    order.missionStatus !== "mission_created"
  ) {
    const mission = createMissionFromOrder(order, {
      persist: !options.readOnly,
    });
    const isTerminal =
      getMissionStepConfig(order.missionStatus).advanceMode === "terminal";

    setSnapshot({
      ...applyMissionStatus(
        mission,
        order.missionStatus,
        mission.events,
        0,
        order.missionStepStartedAt
          ? Date.parse(order.missionStepStartedAt)
          : undefined,
      ),
      isMissionRunning: !isTerminal,
    });
    scheduleAutomaticProgress();
    return snapshot;
  }

  const persistedRuntime = restorePersistedMissionRuntimeSnapshot(order);

  if (persistedRuntime) {
    setSnapshot({
      ...snapshot,
      isMissionRunning:
        snapshot.currentStatus !== null &&
        getMissionStepConfig(snapshot.currentStatus).advanceMode !== "terminal",
    });
    fastForwardAutomaticMission({
      elapsedMs: nowMs - persistedRuntime.savedAtMs,
      orderId: order.id,
      isLiveTrackingVisible: options.isLiveTrackingVisible,
    });

    if (options.notify) {
      maybeNotifyFirstUserAction({
        orderId: order.id,
        isLiveTrackingVisible: options.isLiveTrackingVisible,
      });
    }
    persistCreatedDeliveryOrderMissionState();

    return snapshot;
  }

  if (pendingDBRehydrationOrders.has(order.id)) {
    return snapshot;
  }

  const mission = createMissionFromOrder(order, {
    persist: !options.readOnly,
  });

  setSnapshot({
    ...snapshot,
    currentMission: {
      ...(snapshot.currentMission ?? mission),
      startedAt: new Date(dispatchStartMs).toISOString(),
    },
    isMissionRunning: true,
  });
  fastForwardAutomaticMission({
    elapsedMs: nowMs - dispatchStartMs,
    orderId: order.id,
    isLiveTrackingVisible: options.isLiveTrackingVisible,
  });

  if (options.notify) {
    maybeNotifyFirstUserAction({
      orderId: order.id,
      isLiveTrackingVisible: options.isLiveTrackingVisible,
    });
  }
  persistCreatedDeliveryOrderMissionState();

  return snapshot;
}

export function advanceMission(eventsOverride?: MissionEvent[]) {
  const mission = getCurrentMission();
  const status = snapshot.currentStatus;

  if (!mission || !status) {
    return snapshot;
  }

  const nextStatus = getMissionStepConfig(status).nextStatus;

  if (!nextStatus) {
    clearRuntimeTimers();
    return snapshot;
  }

  return transitionToStatus(
    {
      ...mission,
      events: eventsOverride ?? mission.events,
    },
    nextStatus,
  );
}

export function completeCurrentAutomaticStep() {
  const status = snapshot.currentStatus;

  if (!status || isMissionWaitingForUser(status)) {
    return snapshot;
  }

  return advanceMission();
}

export function confirmPickupMeetingPoint() {
  const mission = getCurrentMission();
  const status = snapshot.currentStatus;

  if (!mission || status !== "awaiting_sender_position_confirmation") {
    return snapshot;
  }

  const currentPoint = getCurrentPickupMeetingPoint(mission);
  const actionEvent = createActionEvent({
    missionId: mission.id,
    status,
    action: "confirm_sender_position",
    actor: "sender",
  });
  const acceptedEvent = createSystemEvent({
    missionId: mission.id,
    status,
    title: "Punctul de pickup a fost confirmat.",
    description:
      "Expeditorul a confirmat ca vede drona si ca locul este potrivit pentru coborarea lockerului.",
  });
  const missionWithEtaDelay = consumeCurrentEtaDelay(mission);
  const now = getCurrentTimestamp();
  const missionWithAcceptedPoint: Mission = {
    ...missionWithEtaDelay,
    meetingPointAttempts: {
      ...missionWithEtaDelay.meetingPointAttempts,
      acceptedPickupMeetingPointId: currentPoint?.id ?? null,
      pickupMeetingPoints:
        missionWithEtaDelay.meetingPointAttempts.pickupMeetingPoints.map((point) =>
          point.id === currentPoint?.id
            ? { ...point, status: "accepted" }
            : point,
        ),
    },
    pins: missionWithEtaDelay.pins.map((pin) =>
      pin.purpose === "pickup_verification"
        ? { ...pin, status: "verified", verifiedAt: now }
        : pin,
    ),
    events: [...missionWithEtaDelay.events, actionEvent, acceptedEvent],
  };
  return transitionToStatus(missionWithAcceptedPoint, "awaiting_parcel_load");
}

export function rejectPickupMeetingPointAndTryNext() {
  const mission = getCurrentMission();
  const status = snapshot.currentStatus;

  if (!mission || status !== "awaiting_sender_position_confirmation") {
    return snapshot;
  }

  const currentIndex =
    mission.meetingPointAttempts.currentPickupMeetingPointIndex;
  const currentPoint = getCurrentPickupMeetingPoint(mission);
  const points = mission.meetingPointAttempts.pickupMeetingPoints;
  const nextIndex = findNextAvailableMeetingPointIndex(points, currentIndex);
  const rejectedEvent = createSystemEvent({
    missionId: mission.id,
    status,
    title: "Expeditorul a respins punctul de intalnire.",
    description:
      "Locul nu este potrivit pentru coborarea lockerului. Punctul ramane in istoric ca respins.",
  });
  const missionWithEtaDelay = consumeCurrentEtaDelay(mission);
  const missionWithRejectedPoint: Mission = {
    ...missionWithEtaDelay,
    meetingPointAttempts: {
      ...missionWithEtaDelay.meetingPointAttempts,
      rejectedPickupMeetingPointIds: currentPoint
        ? [
            ...missionWithEtaDelay.meetingPointAttempts
              .rejectedPickupMeetingPointIds,
            currentPoint.id,
          ]
        : missionWithEtaDelay.meetingPointAttempts
            .rejectedPickupMeetingPointIds,
      pickupMeetingPoints: points.map((point, index) =>
        index === currentIndex ? { ...point, status: "rejected" } : point,
      ),
    },
  };

  if (nextIndex < 0) {
    showMissionToast({
      title: "Comanda a fost anulata",
      message:
        "Nu am gasit un punct potrivit pentru pickup. Rambursarea este in curs.",
      tone: "warning",
    });
    return activeateFallback({
      mission: missionWithRejectedPoint,
      phase: "pickup",
      failureCode: "no_suitable_pickup_meeting_point",
      refundEligible: true,
    });
  }

  const nextPoint = points[nextIndex];
  const rerouteEvent = createSystemEvent({
    missionId: mission.id,
    status: "en_route_to_pickup",
    title: "Drona se deplaseaza catre urmatorul punct de pickup.",
    description: nextPoint
      ? `Urmatorul punct de intalnire: ${nextPoint.label} · ${nextPoint.distanceFromSelectedAddressMeters} m de adresa selectata.`
      : "Drona se deplaseaza catre urmatorul punct disponibil.",
  });
  const nextMission = updateMissionForPickupMeetingPoint(
    missionWithRejectedPoint,
    nextIndex,
  );

  showMissionToast({
    title: "Punctul de intalnire a fost respins",
    message: "Drona se deplaseaza catre urmatorul punct disponibil.",
    tone: "info",
  });

  return transitionToStatus(nextMission, "en_route_to_pickup", [
    rejectedEvent,
    rerouteEvent,
  ]);
}

export function activeatePickupFallbackIfNoPointsLeft() {
  const mission = getCurrentMission();

  if (!mission) {
    return snapshot;
  }

  return activeateFallback({ mission, phase: "pickup" });
}

export function confirmSenderPosition() {
  return confirmPickupMeetingPoint();
}

export function verifyPickupPin(code?: string) {
  const mission = getCurrentMission();
  const status = snapshot.currentStatus;

  if (!mission || status !== "awaiting_pickup_pin") {
    return snapshot;
  }

  const pickupPin = findMissionPin(mission, "pickup_verification");

  if (!pickupPin) {
    const event = createSystemEvent({
      missionId: mission.id,
      status,
      title: "PIN ridicare indisponibil",
      description: "PIN-ul de ridicare nu a putut fi găsit pentru această misiune.",
    });
    setSnapshot(applyMissionStatus(mission, status, [...mission.events, event]));
    return snapshot;
  }

  const result = validateMissionPin(pickupPin, code ?? pickupPin.code);

  persistPinAttempt(mission.sourceOrderId, "pickup", result.valid).catch(
    () => {},
  );
  const pins = mission.pins.map((pin) =>
    pin.id === result.pin.id ? result.pin : pin,
  );
  const missionWithPins = updateMissionPins(mission, pins);

  if (!result.valid) {
    const event = createSystemEvent({
      missionId: mission.id,
      status,
      title: "PIN ridicare respins",
      description: result.message,
    });
    setSnapshot(
      applyMissionStatus(missionWithPins, status, [
        ...mission.events,
        event,
      ]),
    );
    return snapshot;
  }

  const actionEvent = createActionEvent({
    missionId: mission.id,
    status,
    action: "verify_pickup_pin",
    actor: "sender",
  });
  const nextStatus = getMissionStepConfig(status).nextStatus;

  if (!nextStatus) {
    return snapshot;
  }

  return transitionToStatus(
    {
      ...missionWithPins,
      events: [...mission.events, actionEvent],
    },
    nextStatus,
  );
}

export function confirmParcelLoaded() {
  const mission = getCurrentMission();
  if (!mission || snapshot.currentStatus !== "awaiting_parcel_load") return snapshot;
  const actionEvent = createActionEvent({
    missionId: mission.id,
    status: "awaiting_parcel_load",
    action: "confirm_parcel_loaded",
    actor: "sender",
  });
  return transitionToStatus(
    consumeCurrentEtaDelay(appendMissionEvent(mission, actionEvent)),
    "en_route_to_dropoff",
  );
}

export function confirmDropoffMeetingPoint() {
  const mission = getCurrentMission();
  const status = snapshot.currentStatus;

  if (!mission || status !== "awaiting_recipient_position_confirmation") {
    return snapshot;
  }

  const currentPoint = getCurrentDropoffMeetingPoint(mission);
  const actionEvent = createActionEvent({
    missionId: mission.id,
    status,
    action: "confirm_recipient_position",
    actor: "recipient",
  });
  const acceptedEvent = createSystemEvent({
    missionId: mission.id,
    status,
    title: "Punctul de livrare a fost confirmat.",
    description:
      "Destinatarul a confirmat ca vede drona si ca locul este potrivit pentru coborarea lockerului.",
  });
  const now = getCurrentTimestamp();
  const missionWithAcceptedPoint: Mission = {
    ...mission,
    meetingPointAttempts: {
      ...mission.meetingPointAttempts,
      acceptedDropoffMeetingPointId: currentPoint?.id ?? null,
      dropoffMeetingPoints:
        mission.meetingPointAttempts.dropoffMeetingPoints.map((point) =>
          point.id === currentPoint?.id
            ? { ...point, status: "accepted" }
            : point,
        ),
    },
    pins: mission.pins.map((pin) =>
      pin.purpose === "dropoff_verification"
        ? { ...pin, status: "verified", verifiedAt: now }
        : pin,
    ),
    events: [...mission.events, actionEvent, acceptedEvent],
  };
  return transitionToStatus(missionWithAcceptedPoint, "awaiting_parcel_collection");
}

export function rejectDropoffMeetingPointAndTryNext() {
  const mission = getCurrentMission();
  const status = snapshot.currentStatus;

  if (!mission || status !== "awaiting_recipient_position_confirmation") {
    return snapshot;
  }

  const currentIndex =
    mission.meetingPointAttempts.currentDropoffMeetingPointIndex;
  const currentPoint = getCurrentDropoffMeetingPoint(mission);
  const points = mission.meetingPointAttempts.dropoffMeetingPoints;
  const nextIndex = findNextAvailableMeetingPointIndex(points, currentIndex);
  const rejectedEvent = createSystemEvent({
    missionId: mission.id,
    status,
    title: "Destinatarul a respins punctul de intalnire.",
    description:
      "Locul nu este potrivit pentru coborarea lockerului. Punctul ramane in istoric ca respins.",
  });
  const missionWithRejectedPoint: Mission = {
    ...mission,
    meetingPointAttempts: {
      ...mission.meetingPointAttempts,
      rejectedDropoffMeetingPointIds: currentPoint
        ? [
            ...mission.meetingPointAttempts.rejectedDropoffMeetingPointIds,
            currentPoint.id,
          ]
        : mission.meetingPointAttempts.rejectedDropoffMeetingPointIds,
      dropoffMeetingPoints: points.map((point, index) =>
        index === currentIndex ? { ...point, status: "rejected" } : point,
      ),
    },
  };

  if (nextIndex < 0) {
    showMissionToast({
      title: "Colet returnat la hub",
      message:
        "Livrarea nu a putut fi finalizata. Coletul se intoarce la hub.",
      tone: "warning",
    });
    return activeateFallback({
      mission: missionWithRejectedPoint,
      phase: "dropoff",
      failureCode: "no_suitable_dropoff_meeting_point",
      refundEligible: true,
    });
  }

  const nextPoint = points[nextIndex];
  const rerouteEvent = createSystemEvent({
    missionId: mission.id,
    status: "en_route_to_dropoff",
    title: "Drona se deplaseaza catre urmatorul punct de livrare.",
    description: nextPoint
      ? `Urmatorul punct de intalnire: ${nextPoint.label} · ${nextPoint.distanceFromSelectedAddressMeters} m de adresa selectata.`
      : "Drona se deplaseaza catre urmatorul punct disponibil.",
  });
  const nextMission = updateMissionForDropoffMeetingPoint(
    missionWithRejectedPoint,
    nextIndex,
  );

  showMissionToast({
    title: "Punctul de intalnire a fost respins",
    message: "Drona se deplaseaza catre urmatorul punct disponibil.",
    tone: "info",
  });

  return transitionToStatus(nextMission, "en_route_to_dropoff", [
    rejectedEvent,
    rerouteEvent,
  ]);
}

export function activeateDropoffFallbackIfNoPointsLeft() {
  const mission = getCurrentMission();

  if (!mission) {
    return snapshot;
  }

  return activeateFallback({ mission, phase: "dropoff" });
}

export function confirmRecipientPosition() {
  return confirmDropoffMeetingPoint();
}

export function verifyRecipientPin(code?: string) {
  const mission = getCurrentMission();
  const status = snapshot.currentStatus;

  if (!mission || status !== "awaiting_recipient_pin") {
    return snapshot;
  }

  const recipientPin = findMissionPin(mission, "dropoff_verification");

  if (!recipientPin) {
    const event = createSystemEvent({
      missionId: mission.id,
      status,
      title: "PIN livrare indisponibil",
      description: "PIN-ul de livrare nu a putut fi găsit pentru această misiune.",
    });
    setSnapshot(applyMissionStatus(mission, status, [...mission.events, event]));
    return snapshot;
  }

  const result = validateMissionPin(recipientPin, code ?? recipientPin.code);

  persistPinAttempt(mission.sourceOrderId, "dropoff", result.valid).catch(
    () => {},
  );
  const pins = mission.pins.map((pin) =>
    pin.id === result.pin.id ? result.pin : pin,
  );
  const missionWithPins = updateMissionPins(mission, pins);

  if (!result.valid) {
    const event = createSystemEvent({
      missionId: mission.id,
      status,
      title: "PIN livrare respins",
      description: result.message,
    });
    setSnapshot(
      applyMissionStatus(missionWithPins, status, [
        ...mission.events,
        event,
      ]),
    );
    return snapshot;
  }

  const actionEvent = createActionEvent({
    missionId: mission.id,
    status,
    action: "verify_recipient_pin",
    actor: "recipient",
  });
  const nextStatus = getMissionStepConfig(status).nextStatus;

  if (!nextStatus) {
    return snapshot;
  }

  return transitionToStatus(
    {
      ...missionWithPins,
      events: [...mission.events, actionEvent],
    },
    nextStatus,
  );
}

export function confirmParcelCollected() {
  const mission = getCurrentMission();
  if (!mission || snapshot.currentStatus !== "awaiting_parcel_collection") return snapshot;
  const actionEvent = createActionEvent({
    missionId: mission.id,
    status: "awaiting_parcel_collection",
    action: "confirm_parcel_collected",
    actor: "recipient",
  });
  return transitionToStatus(appendMissionEvent(mission, actionEvent), "delivery_completed");
}

export function resetMission() {
  clearRuntimeTimers();
  setSnapshot(initialSnapshot);

  return snapshot;
}

export function syncMissionStatusFromOrder(order: CreatedDeliveryOrder) {
  if (
    order.missionId &&
    isKnownMissionStatus(order.missionStatus) &&
    typeof order.missionStateVersion === "number" &&
    order.missionRuntimeState !== undefined
  ) {
    return syncMissionFromRecord(
      {
        id: order.missionId,
        orderId: order.id,
        currentStatus: order.missionStatus,
        startedAt: order.missionStartedAt ?? null,
        completedAt: order.completedAt ?? null,
        droneTelemetrySnapshot:
          order.missionDroneTelemetry ?? {
            position: activeHub.address.location,
            heading: 0,
            speed: 0,
            segmentProgress: 0,
            segmentId: null,
            lastUpdatedAt: order.missionUpdatedAt ?? getCurrentTimestamp(),
          },
        pickupPin: order.missionPickupPin ?? null,
        dropoffPin: order.missionDropoffPin ?? null,
        pickupPinAttempts: 0,
        dropoffPinAttempts: 0,
        pickupPinVerifiedAt: null,
        dropoffPinVerifiedAt: null,
        fallbackReason: order.fallbackReason ?? null,
        stateVersion: order.missionStateVersion,
        stepStartedAt: order.missionStepStartedAt ?? null,
        stepExpiresAt: order.missionStepExpiresAt ?? null,
        failureCode: order.missionFailureCode ?? null,
        failedAt:
          order.missionStatus === "mission_failed"
            ? order.missionUpdatedAt ?? getCurrentTimestamp()
            : null,
        runtimeState: order.missionRuntimeState,
        createdAt: order.paidAt ?? order.payload.createdAt,
        updatedAt: order.missionUpdatedAt ?? getCurrentTimestamp(),
      },
      order,
    );
  }

  const mission = getCurrentMission();
  if (
    !mission ||
    mission.sourceOrderId !== order.id ||
    !isKnownMissionStatus(order.missionStatus) ||
    snapshot.currentStatus === order.missionStatus
  ) {
    return snapshot;
  }

  const nextMission: Mission = {
    ...mission,
    failureReason:
      (order.missionFailureCode as Mission["failureReason"]) ??
      mission.failureReason,
  };
  clearRuntimeTimers();
  setSnapshot({
    ...applyMissionStatus(
      nextMission,
      order.missionStatus,
      nextMission.events,
      snapshot.segmentProgress,
      order.missionStepStartedAt
        ? Date.parse(order.missionStepStartedAt)
        : undefined,
    ),
  });
  scheduleAutomaticProgress();
  return snapshot;
}

export function syncMissionFromRecord(
  dbMission: MissionRecord,
  order: CreatedDeliveryOrder,
) {
  if (
    snapshot.currentMission?.sourceOrderId === order.id &&
    syncedMissionVersions.get(order.id) === dbMission.stateVersion
  ) {
    return snapshot;
  }

  return applyMissionRecord(dbMission, order);
}

function applyMissionRecord(
  dbMission: MissionRecord,
  order: CreatedDeliveryOrder,
): MissionRuntimeSnapshot {
  if (snapshot.currentMission?.sourceOrderId !== order.id) {
    createMissionFromOrder(order, { persist: false });
  }

  const currentMission = snapshot.currentMission;
  if (!currentMission) return snapshot;

  const hydrated = hydrateMissionFromRecord(currentMission, dbMission);
  const persistedFlightProgress = getPersistedFlightProgress(
    hydrated.activeFlight,
  );
  const telemetryTimestamp = Date.parse(
    dbMission.droneTelemetrySnapshot?.lastUpdatedAt ?? "",
  );
  const telemetryProgress =
    Number.isFinite(telemetryTimestamp) && telemetryTimestamp > 946_684_800_000
      ? dbMission.droneTelemetrySnapshot.segmentProgress
      : 0;
  const dbProgress = persistedFlightProgress ?? telemetryProgress;
  const appliedSnapshot = applyMissionStatus(
    hydrated.mission,
    dbMission.currentStatus,
    hydrated.mission.events,
    dbProgress,
    dbMission.stepStartedAt
      ? Date.parse(dbMission.stepStartedAt)
      : undefined,
  );

  clearRuntimeTimers();
  setSnapshot({
    ...appliedSnapshot,
    isMissionRunning:
      getMissionStepConfig(dbMission.currentStatus).advanceMode !== "terminal",
  });
  syncedMissionVersions.set(order.id, dbMission.stateVersion);
  scheduleAutomaticProgress();
  persistCreatedDeliveryOrderMissionState();
  return snapshot;
}

export function rehydrateMissionFromDB(
  dbMission: MissionRecord,
  order: CreatedDeliveryOrder,
): MissionRuntimeSnapshot {

  clearOrderPendingDBRehydration(order.id);

  markOrderAsRehydrating(order.id);

  try {
    applyMissionRecord(dbMission, order);
  } finally {
    clearOrderAsRehydrating(order.id);
  }

  return snapshot;
}

export const missionRuntimeStore = {
  subscribe: subscribeMissionRuntime,
  getSnapshot: getMissionRuntimeSnapshot,
  createMissionFromOrder,
  startMission,
  syncPaidCreatedDeliveryOrderMission,
  advanceMission,
  completeCurrentAutomaticStep,
  confirmSenderPosition,
  confirmPickupMeetingPoint,
  rejectPickupMeetingPointAndTryNext,
  activeatePickupFallbackIfNoPointsLeft,
  verifyPickupPin,
  confirmParcelLoaded,
  confirmRecipientPosition,
  confirmDropoffMeetingPoint,
  rejectDropoffMeetingPointAndTryNext,
  activeateDropoffFallbackIfNoPointsLeft,
  verifyRecipientPin,
  confirmParcelCollected,
  resetMission,
  syncMissionStatusFromOrder,
  syncMissionFromRecord,
};
