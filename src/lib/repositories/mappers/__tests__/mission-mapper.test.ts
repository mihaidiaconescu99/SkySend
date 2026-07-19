import { describe, expect, it } from "vitest";

import {
  createInputToRow,
  parseDroneTelemetry,
  parseMissionPin,
  parseMissionStatus,
  parsePinAttempts,
  rowToMission,
  updateInputToRow,
} from "@/lib/repositories/mappers/mission-mapper";
import { RepositoryError, type DBRow } from "@/lib/repositories/types";
import type { DroneTelemetrySnapshot } from "@/types/mission-record";

const VALID_TELEMETRY: DroneTelemetrySnapshot = {
  position: { latitude: 44.8565, longitude: 24.8692 },
  heading: 142,
  speed: 12.5,
  segmentProgress: 0.42,
  segmentId: "segment-1",
  altitudeMeters: 82,
  batteryPercent: 87,
  lastUpdatedAt: "2026-05-23T10:00:00Z",
};

function buildRow(
  overrides: Partial<DBRow<"missions">> = {},
): DBRow<"missions"> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    order_id: "00000000-0000-0000-0000-000000000111",
    current_status: "mission_created",
    started_at: null,
    completed_at: null,
    drone_telemetry_snapshot: VALID_TELEMETRY as never,
    pickup_pin: "1234",
    dropoff_pin: null,
    pickup_pin_attempts: 0,
    dropoff_pin_attempts: 0,
    pickup_pin_verified_at: null,
    dropoff_pin_verified_at: null,
    fallback_reason: null,
    created_at: "2026-05-23T10:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

describe("rowToMission", () => {
  it("maps every column for a healthy row", () => {
    const mission = rowToMission(buildRow());
    expect(mission.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(mission.orderId).toBe("00000000-0000-0000-0000-000000000111");
    expect(mission.currentStatus).toBe("mission_created");
    expect(mission.pickupPin).toBe("1234");
    expect(mission.dropoffPin).toBeNull();
    expect(mission.droneTelemetrySnapshot).toEqual(VALID_TELEMETRY);
  });

  it("returns default telemetry when the JSONB is null", () => {
    const mission = rowToMission(
      buildRow({ drone_telemetry_snapshot: null as unknown as never }),
    );
    expect(mission.droneTelemetrySnapshot.heading).toBe(0);
    expect(mission.droneTelemetrySnapshot.position).toEqual({
      latitude: 0,
      longitude: 0,
    });
  });

  it("returns default telemetry when the JSONB is the empty object", () => {
    const mission = rowToMission(
      buildRow({ drone_telemetry_snapshot: {} as never }),
    );
    expect(mission.droneTelemetrySnapshot.segmentProgress).toBe(0);
  });

  it("throws on an unknown current_status", () => {
    expect(() =>
      rowToMission(buildRow({ current_status: "moonwalking" })),
    ).toThrowError(RepositoryError);
  });

  it("throws on a malformed pickup_pin (too short)", () => {
    expect(() => rowToMission(buildRow({ pickup_pin: "12" }))).toThrowError(
      RepositoryError,
    );
  });

  it("throws on a malformed pickup_pin (letters)", () => {
    expect(() =>
      rowToMission(buildRow({ pickup_pin: "ABCD" })),
    ).toThrowError(RepositoryError);
  });

  it("throws on pickup_pin_attempts above the max", () => {
    expect(() =>
      rowToMission(buildRow({ pickup_pin_attempts: 4 })),
    ).toThrowError(RepositoryError);
  });

  it("throws on negative dropoff_pin_attempts", () => {
    expect(() =>
      rowToMission(buildRow({ dropoff_pin_attempts: -1 })),
    ).toThrowError(RepositoryError);
  });

  it("preserves verified_at timestamps when set", () => {
    const mission = rowToMission(
      buildRow({
        pickup_pin_verified_at: "2026-05-23T11:00:00Z",
        dropoff_pin_verified_at: "2026-05-23T12:00:00Z",
      }),
    );
    expect(mission.pickupPinVerifiedAt).toBe("2026-05-23T11:00:00Z");
    expect(mission.dropoffPinVerifiedAt).toBe("2026-05-23T12:00:00Z");
  });
});

describe("parseDroneTelemetry", () => {
  it("accepts a complete valid snapshot", () => {
    expect(parseDroneTelemetry(VALID_TELEMETRY)).toEqual(VALID_TELEMETRY);
  });

  it("returns defaults for null and empty-object inputs", () => {
    const fromNull = parseDroneTelemetry(null);
    const fromEmpty = parseDroneTelemetry({});
    expect(fromNull.heading).toBe(0);
    expect(fromEmpty.position).toEqual({ latitude: 0, longitude: 0 });
  });

  it("rejects a position outside WGS-84 ranges", () => {
    expect(() =>
      parseDroneTelemetry({
        ...VALID_TELEMETRY,
        position: { latitude: 95, longitude: 24 },
      }),
    ).toThrowError(RepositoryError);
    expect(() =>
      parseDroneTelemetry({
        ...VALID_TELEMETRY,
        position: { latitude: 44, longitude: -200 },
      }),
    ).toThrowError(RepositoryError);
  });

  it("rejects heading outside 0..360", () => {
    expect(() =>
      parseDroneTelemetry({ ...VALID_TELEMETRY, heading: -10 }),
    ).toThrowError(RepositoryError);
    expect(() =>
      parseDroneTelemetry({ ...VALID_TELEMETRY, heading: 361 }),
    ).toThrowError(RepositoryError);
  });

  it("rejects negative speed", () => {
    expect(() =>
      parseDroneTelemetry({ ...VALID_TELEMETRY, speed: -1 }),
    ).toThrowError(RepositoryError);
  });

  it("rejects segmentProgress outside 0..1", () => {
    expect(() =>
      parseDroneTelemetry({ ...VALID_TELEMETRY, segmentProgress: 1.5 }),
    ).toThrowError(RepositoryError);
  });

  it("rejects batteryPercent outside 0..100", () => {
    expect(() =>
      parseDroneTelemetry({ ...VALID_TELEMETRY, batteryPercent: 150 }),
    ).toThrowError(RepositoryError);
  });

  it("requires lastUpdatedAt", () => {
    expect(() =>
      parseDroneTelemetry({ ...VALID_TELEMETRY, lastUpdatedAt: "" }),
    ).toThrowError(RepositoryError);
  });

  it("accepts a null segmentId (idle drone)", () => {
    const snapshot = parseDroneTelemetry({
      ...VALID_TELEMETRY,
      segmentId: null,
    });
    expect(snapshot.segmentId).toBeNull();
  });
});

describe("createInputToRow", () => {
  it("emits a minimal row when only orderId is provided", () => {
    expect(createInputToRow({ orderId: "o-1" })).toEqual({
      order_id: "o-1",
    });
  });

  it("respects an explicit currentStatus", () => {
    expect(
      createInputToRow({ orderId: "o-1", currentStatus: "preflight_checks" }),
    ).toMatchObject({ current_status: "preflight_checks" });
  });

  it("accepts a valid pickupPin", () => {
    expect(
      createInputToRow({ orderId: "o-1", pickupPin: "1234" }),
    ).toMatchObject({ pickup_pin: "1234" });
  });

  it("rejects an invalid pickupPin", () => {
    expect(() =>
      createInputToRow({ orderId: "o-1", pickupPin: "12" }),
    ).toThrowError(RepositoryError);
  });

  it("throws on missing orderId", () => {
    expect(() => createInputToRow({ orderId: "" })).toThrowError(
      RepositoryError,
    );
  });
});

describe("updateInputToRow", () => {
  it("emits a sparse payload for a single status update", () => {
    expect(updateInputToRow({ currentStatus: "en_route_to_pickup" })).toEqual({
      current_status: "en_route_to_pickup",
    });
  });

  it("writes a telemetry update", () => {
    const result = updateInputToRow({ droneTelemetrySnapshot: VALID_TELEMETRY });
    expect(result.drone_telemetry_snapshot).toEqual(VALID_TELEMETRY);
  });

  it("rejects empty input", () => {
    expect(() => updateInputToRow({})).toThrowError(RepositoryError);
  });

  it("re-validates a telemetry update on write", () => {
    expect(() =>
      updateInputToRow({
        droneTelemetrySnapshot: { ...VALID_TELEMETRY, heading: -50 },
      }),
    ).toThrowError(RepositoryError);
  });

  it("preserves explicit null for fallback_reason (clears)", () => {
    expect(updateInputToRow({ fallbackReason: null })).toEqual({
      fallback_reason: null,
    });
  });
});

describe("parseMissionStatus / parseMissionPin / parsePinAttempts", () => {
  it("accepts every canonical MissionStatus value", () => {
    expect(parseMissionStatus("mission_closed")).toBe("mission_closed");
    expect(parseMissionStatus("fallback_required")).toBe("fallback_required");
  });

  it("rejects an unknown MissionStatus", () => {
    expect(() => parseMissionStatus("zombie")).toThrowError(RepositoryError);
  });

  it("accepts a 4-digit PIN string and null", () => {
    expect(parseMissionPin("0000")).toBe("0000");
    expect(parseMissionPin(null)).toBeNull();
  });

  it("rejects PINs with letters or wrong length", () => {
    expect(() => parseMissionPin("12345")).toThrowError(RepositoryError);
    expect(() => parseMissionPin("12A4")).toThrowError(RepositoryError);
  });

  it("accepts pin attempts 0..3 and rejects others", () => {
    expect(parsePinAttempts(0, "x")).toBe(0);
    expect(parsePinAttempts(3, "x")).toBe(3);
    expect(() => parsePinAttempts(4, "x")).toThrowError(RepositoryError);
    expect(() => parsePinAttempts(-1, "x")).toThrowError(RepositoryError);
    expect(() => parsePinAttempts(1.5, "x")).toThrowError(RepositoryError);
  });
});
