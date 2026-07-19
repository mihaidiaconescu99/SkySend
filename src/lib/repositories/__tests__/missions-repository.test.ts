import { beforeEach, describe, expect, it } from "vitest";

import { MissionsRepository } from "@/lib/repositories/missions-repository";
import {
  buildMissionRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";
import type { DroneTelemetrySnapshot } from "@/types/mission-record";

const VALID_TELEMETRY: DroneTelemetrySnapshot = {
  position: { latitude: 44.8565, longitude: 24.8692 },
  heading: 142,
  speed: 12.5,
  segmentProgress: 0.42,
  segmentId: "segment-1",
  altitudeMeters: 82,
  batteryPercent: 87,
  lastUpdatedAt: "2026-05-23T11:00:00Z",
};

let store: FakeStore;
let repo: MissionsRepository;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  repo = new MissionsRepository(fake.client);
});

describe("MissionsRepository.getById", () => {
  it("returns the mapped Mission when the row exists", async () => {
    store.seedMission(
      buildMissionRow({
        id: "m-1",
        order_id: "o-1",
        current_status: "en_route_to_pickup",
        pickup_pin: "1234",
      }),
    );
    const result = await repo.getById("m-1");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.orderId).toBe("o-1");
      expect(result.data.currentStatus).toBe("en_route_to_pickup");
      expect(result.data.pickupPin).toBe("1234");
    }
  });

  it("returns data: null on miss", async () => {
    const result = await repo.getById("nope");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("MissionsRepository.getByOrderId", () => {
  it("returns the Mission for the given order", async () => {
    store.seedMission(buildMissionRow({ id: "m-1", order_id: "o-1" }));
    const result = await repo.getByOrderId("o-1");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) expect(result.data.id).toBe("m-1");
  });

  it("returns null when no mission exists for the order", async () => {
    const result = await repo.getByOrderId("o-missing");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("short-circuits empty string", async () => {
    const result = await repo.getByOrderId("");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("MissionsRepository.create", () => {
  it("creates a mission with the default status", async () => {
    const result = await repo.create({ orderId: "o-1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.orderId).toBe("o-1");
      expect(result.data.currentStatus).toBe("mission_created");
      expect(result.data.pickupPin).toBeNull();
      expect(result.data.dropoffPin).toBeNull();
    }
  });

  it("respects an explicit currentStatus and PINs", async () => {
    const result = await repo.create({
      orderId: "o-1",
      currentStatus: "preflight_checks",
      pickupPin: "0042",
      dropoffPin: "9999",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.currentStatus).toBe("preflight_checks");
      expect(result.data.pickupPin).toBe("0042");
      expect(result.data.dropoffPin).toBe("9999");
    }
  });

  it("rejects a malformed PIN", async () => {
    const result = await repo.create({
      orderId: "o-1",
      pickupPin: "abc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("rejects missing orderId", async () => {
    const result = await repo.create({ orderId: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});

describe("MissionsRepository.updateById", () => {
  it("applies a sparse status update", async () => {
    store.seedMission(
      buildMissionRow({ id: "m-1", current_status: "preflight_checks" }),
    );
    const result = await repo.updateById("m-1", {
      currentStatus: "drone_dispatched",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.currentStatus).toBe("drone_dispatched");
  });

  it("returns not_found for unknown id", async () => {
    const result = await repo.updateById("nope", {
      currentStatus: "mission_closed",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("rejects empty input", async () => {
    store.seedMission(buildMissionRow({ id: "m-1" }));
    const result = await repo.updateById("m-1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("accepts a fallback_reason clear", async () => {
    store.seedMission(
      buildMissionRow({ id: "m-1", fallback_reason: "no_meeting_point" }),
    );
    const result = await repo.updateById("m-1", { fallbackReason: null });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.fallbackReason).toBeNull();
  });
});

describe("MissionsRepository.updateStatus", () => {
  it("flips status via the convenience wrapper", async () => {
    store.seedMission(
      buildMissionRow({ id: "m-1", current_status: "mission_created" }),
    );
    const result = await repo.updateStatus("m-1", "preflight_checks");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.currentStatus).toBe("preflight_checks");
  });

  it("does NOT impose state-machine gating (allows reverse transitions)", async () => {

    store.seedMission(
      buildMissionRow({ id: "m-1", current_status: "mission_closed" }),
    );
    const result = await repo.updateStatus("m-1", "mission_created");
    expect(result.ok).toBe(true);
  });
});

describe("MissionsRepository.updateTelemetry", () => {
  it("writes a fresh telemetry snapshot and reads back deep-equal", async () => {
    store.seedMission(buildMissionRow({ id: "m-1" }));
    const result = await repo.updateTelemetry("m-1", VALID_TELEMETRY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.droneTelemetrySnapshot).toEqual(VALID_TELEMETRY);
    }

    const refetched = await repo.getById("m-1");
    expect(refetched.ok).toBe(true);
    if (refetched.ok && refetched.data) {
      expect(refetched.data.droneTelemetrySnapshot).toEqual(VALID_TELEMETRY);
    }
  });

  it("rejects malformed telemetry (out-of-range heading)", async () => {
    store.seedMission(buildMissionRow({ id: "m-1" }));
    const result = await repo.updateTelemetry("m-1", {
      ...VALID_TELEMETRY,
      heading: 720,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("returns not_found when the mission does not exist", async () => {
    const result = await repo.updateTelemetry("nope", VALID_TELEMETRY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

describe("MissionsRepository.recordPinAttempt", () => {
  it("increments pickup attempts on a failed try and leaves verifiedAt null", async () => {
    store.seedMission(
      buildMissionRow({
        id: "m-1",
        pickup_pin_attempts: 1,
        pickup_pin_verified_at: null,
      }),
    );
    const result = await repo.recordPinAttempt("m-1", "pickup", false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pickupPinAttempts).toBe(2);
      expect(result.data.pickupPinVerifiedAt).toBeNull();
    }
  });

  it("increments pickup attempts AND stamps verifiedAt on success", async () => {
    store.seedMission(
      buildMissionRow({ id: "m-1", pickup_pin_attempts: 0 }),
    );
    const result = await repo.recordPinAttempt("m-1", "pickup", true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pickupPinAttempts).toBe(1);
      expect(result.data.pickupPinVerifiedAt).toBeTruthy();
    }
  });

  it("increments dropoff attempts independently of pickup", async () => {
    store.seedMission(
      buildMissionRow({
        id: "m-1",
        pickup_pin_attempts: 2,
        dropoff_pin_attempts: 0,
      }),
    );
    const result = await repo.recordPinAttempt("m-1", "dropoff", true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dropoffPinAttempts).toBe(1);
      expect(result.data.dropoffPinVerifiedAt).toBeTruthy();

      expect(result.data.pickupPinAttempts).toBe(2);
      expect(result.data.pickupPinVerifiedAt).toBeNull();
    }
  });

  it("returns not_found for an unknown mission", async () => {
    const result = await repo.recordPinAttempt("nope", "pickup", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("refuses a 4th pickup attempt (mapper enforces MAX_PIN_ATTEMPTS)", async () => {
    store.seedMission(
      buildMissionRow({ id: "m-1", pickup_pin_attempts: 3 }),
    );
    const result = await repo.recordPinAttempt("m-1", "pickup", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});

describe("MissionsRepository.deleteById", () => {
  it("removes the row when it exists", async () => {
    store.seedMission(buildMissionRow({ id: "m-1" }));
    const result = await repo.deleteById("m-1");
    expect(result).toEqual({ ok: true, data: undefined });
    expect(store.missionRows.has("m-1")).toBe(false);
  });

  it("returns not_found on miss", async () => {
    const result = await repo.deleteById("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});
