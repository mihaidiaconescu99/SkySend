import {
  RepositoryError,
  type DBInsert,
  type DBRow,
  type DBUpdate,
} from "@/lib/repositories/types";
import type { Json } from "@/types/database";
import {
  DEFAULT_DRONE_TELEMETRY,
  MAX_PIN_ATTEMPTS,
  MISSION_PIN_LENGTH,
  MISSION_STATUSES,
  type CreateMissionInput,
  type DroneTelemetrySnapshot,
  type MissionRecord,
  type MissionStatus,
  type UpdateMissionInput,
} from "@/types/mission-record";

const PIN_REGEX = new RegExp(`^\\d{${MISSION_PIN_LENGTH}}$`);

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RepositoryError(
      "validation_error",
      `Missing or invalid "${fieldName}".`,
      { details: { fieldName, value } },
    );
  }
  return value;
}

export function parseMissionStatus(value: unknown): MissionStatus {
  if (typeof value !== "string") {
    throw new RepositoryError(
      "validation_error",
      `Invalid mission status: expected string, got ${typeof value}.`,
      { details: { value } },
    );
  }
  if (!(MISSION_STATUSES as readonly string[]).includes(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid mission status: "${value}".`,
      { details: { value, allowed: MISSION_STATUSES } },
    );
  }
  return value as MissionStatus;
}

export function parseMissionPin(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !PIN_REGEX.test(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid mission PIN: must be ${MISSION_PIN_LENGTH} digits.`,
      { details: { value } },
    );
  }
  return value;
}

export function parsePinAttempts(
  value: unknown,
  fieldName: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_PIN_ATTEMPTS
  ) {
    throw new RepositoryError(
      "validation_error",
      `Invalid "${fieldName}": must be an integer 0..${MAX_PIN_ATTEMPTS}; got ${value}.`,
      { details: { fieldName, value, max: MAX_PIN_ATTEMPTS } },
    );
  }
  return value;
}

export function parseDroneTelemetry(value: unknown): DroneTelemetrySnapshot {
  if (value === null || value === undefined) {
    return { ...DEFAULT_DRONE_TELEMETRY };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid drone_telemetry_snapshot: expected object, got ${typeof value}.`,
      { details: { value } },
    );
  }
  const record = value as Record<string, unknown>;

  if (Object.keys(record).length === 0) {
    return { ...DEFAULT_DRONE_TELEMETRY };
  }

  const position = record.position;
  if (!position || typeof position !== "object" || Array.isArray(position)) {
    throw new RepositoryError(
      "validation_error",
      "drone_telemetry_snapshot.position must be an object.",
      { details: { position } },
    );
  }
  const positionRecord = position as Record<string, unknown>;
  const lat = positionRecord.latitude;
  const lng = positionRecord.longitude;
  if (
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90
  ) {
    throw new RepositoryError(
      "validation_error",
      `drone_telemetry_snapshot.position.latitude must be a number in [-90, 90]; got ${lat}.`,
    );
  }
  if (
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    throw new RepositoryError(
      "validation_error",
      `drone_telemetry_snapshot.position.longitude must be a number in [-180, 180]; got ${lng}.`,
    );
  }

  const heading = record.heading;
  if (
    typeof heading !== "number" ||
    !Number.isFinite(heading) ||
    heading < 0 ||
    heading > 360
  ) {
    throw new RepositoryError(
      "validation_error",
      `drone_telemetry_snapshot.heading must be a number in [0, 360]; got ${heading}.`,
    );
  }
  const speed = record.speed;
  if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0) {
    throw new RepositoryError(
      "validation_error",
      `drone_telemetry_snapshot.speed must be a non-negative number; got ${speed}.`,
    );
  }
  const segmentProgress = record.segmentProgress;
  if (
    typeof segmentProgress !== "number" ||
    !Number.isFinite(segmentProgress) ||
    segmentProgress < 0 ||
    segmentProgress > 1
  ) {
    throw new RepositoryError(
      "validation_error",
      `drone_telemetry_snapshot.segmentProgress must be a number in [0, 1]; got ${segmentProgress}.`,
    );
  }

  const segmentId =
    record.segmentId === null || record.segmentId === undefined
      ? null
      : requireString(record.segmentId, "drone_telemetry_snapshot.segmentId");

  const snapshot: DroneTelemetrySnapshot = {
    position: { latitude: lat, longitude: lng },
    heading,
    speed,
    segmentProgress,
    segmentId,
    lastUpdatedAt: requireString(
      record.lastUpdatedAt,
      "drone_telemetry_snapshot.lastUpdatedAt",
    ),
  };

  if (record.altitudeMeters !== undefined) {
    if (
      typeof record.altitudeMeters !== "number" ||
      !Number.isFinite(record.altitudeMeters)
    ) {
      throw new RepositoryError(
        "validation_error",
        `drone_telemetry_snapshot.altitudeMeters must be a finite number.`,
      );
    }
    snapshot.altitudeMeters = record.altitudeMeters;
  }
  if (record.batteryPercent !== undefined) {
    if (
      typeof record.batteryPercent !== "number" ||
      !Number.isFinite(record.batteryPercent) ||
      record.batteryPercent < 0 ||
      record.batteryPercent > 100
    ) {
      throw new RepositoryError(
        "validation_error",
        `drone_telemetry_snapshot.batteryPercent must be in [0, 100].`,
      );
    }
    snapshot.batteryPercent = record.batteryPercent;
  }

  return snapshot;
}

export function rowToMission(row: DBRow<"missions">): MissionRecord {
  return {
    id: requireString(row.id, "id"),
    orderId: requireString(row.order_id, "order_id"),
    currentStatus: parseMissionStatus(row.current_status),
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    droneTelemetrySnapshot: parseDroneTelemetry(row.drone_telemetry_snapshot),
    pickupPin: parseMissionPin(row.pickup_pin),
    dropoffPin: parseMissionPin(row.dropoff_pin),
    pickupPinAttempts: parsePinAttempts(
      row.pickup_pin_attempts,
      "pickup_pin_attempts",
    ),
    dropoffPinAttempts: parsePinAttempts(
      row.dropoff_pin_attempts,
      "dropoff_pin_attempts",
    ),
    pickupPinVerifiedAt: row.pickup_pin_verified_at ?? null,
    dropoffPinVerifiedAt: row.dropoff_pin_verified_at ?? null,
    fallbackReason: row.fallback_reason ?? null,
    stateVersion: row.state_version,
    stepStartedAt: row.step_started_at ?? null,
    stepExpiresAt: row.step_expires_at ?? null,
    failureCode: row.failure_code ?? null,
    failedAt: row.failed_at ?? null,
    runtimeState: row.runtime_state,
    createdAt: requireString(row.created_at, "created_at"),
    updatedAt: requireString(row.updated_at, "updated_at"),
  };
}

export function createInputToRow(
  input: CreateMissionInput,
): DBInsert<"missions"> {
  const orderId = requireString(input.orderId, "orderId");
  const row: DBInsert<"missions"> = { order_id: orderId };

  if (input.currentStatus !== undefined) {
    row.current_status = parseMissionStatus(input.currentStatus);
  }
  if (input.pickupPin !== undefined) {
    row.pickup_pin = parseMissionPin(input.pickupPin);
  }
  if (input.dropoffPin !== undefined) {
    row.dropoff_pin = parseMissionPin(input.dropoffPin);
  }
  if (input.stepStartedAt !== undefined) {
    row.step_started_at = input.stepStartedAt;
  }
  if (input.stepExpiresAt !== undefined) {
    row.step_expires_at = input.stepExpiresAt;
  }
  if (input.runtimeState !== undefined) {
    row.runtime_state = input.runtimeState;
  }
  return row;
}

export function updateInputToRow(
  input: UpdateMissionInput,
): DBUpdate<"missions"> {
  const payload: DBUpdate<"missions"> = {};

  if (input.currentStatus !== undefined) {
    payload.current_status = parseMissionStatus(input.currentStatus);
  }
  if (input.startedAt !== undefined) {
    payload.started_at = input.startedAt;
  }
  if (input.completedAt !== undefined) {
    payload.completed_at = input.completedAt;
  }
  if (input.droneTelemetrySnapshot !== undefined) {

    parseDroneTelemetry(input.droneTelemetrySnapshot);
    payload.drone_telemetry_snapshot =
      input.droneTelemetrySnapshot as unknown as Json;
  }
  if (input.pickupPin !== undefined) {
    payload.pickup_pin = parseMissionPin(input.pickupPin);
  }
  if (input.dropoffPin !== undefined) {
    payload.dropoff_pin = parseMissionPin(input.dropoffPin);
  }
  if (input.pickupPinAttempts !== undefined) {
    payload.pickup_pin_attempts = parsePinAttempts(
      input.pickupPinAttempts,
      "pickupPinAttempts",
    );
  }
  if (input.dropoffPinAttempts !== undefined) {
    payload.dropoff_pin_attempts = parsePinAttempts(
      input.dropoffPinAttempts,
      "dropoffPinAttempts",
    );
  }
  if (input.pickupPinVerifiedAt !== undefined) {
    payload.pickup_pin_verified_at = input.pickupPinVerifiedAt;
  }
  if (input.dropoffPinVerifiedAt !== undefined) {
    payload.dropoff_pin_verified_at = input.dropoffPinVerifiedAt;
  }
  if (input.fallbackReason !== undefined) {
    payload.fallback_reason = input.fallbackReason;
  }
  if (input.stateVersion !== undefined) {
    payload.state_version = input.stateVersion;
  }
  if (input.stepStartedAt !== undefined) {
    payload.step_started_at = input.stepStartedAt;
  }
  if (input.stepExpiresAt !== undefined) {
    payload.step_expires_at = input.stepExpiresAt;
  }
  if (input.failureCode !== undefined) {
    payload.failure_code = input.failureCode;
  }
  if (input.failedAt !== undefined) {
    payload.failed_at = input.failedAt;
  }
  if (input.runtimeState !== undefined) {
    payload.runtime_state = input.runtimeState;
  }

  if (Object.keys(payload).length === 0) {
    throw new RepositoryError(
      "validation_error",
      "Update payload contains no recognised fields.",
    );
  }

  return payload;
}
