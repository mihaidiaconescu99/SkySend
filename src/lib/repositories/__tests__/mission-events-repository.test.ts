import { beforeEach, describe, expect, it } from "vitest";

import { MissionEventsRepository } from "@/lib/repositories/mission-events-repository";
import {
  buildMissionEventRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

let store: FakeStore;
let repo: MissionEventsRepository;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  repo = new MissionEventsRepository(fake.client);
});

describe("MissionEventsRepository.getById", () => {
  it("returns the mapped event when the row exists", async () => {
    store.seedMissionEvent(
      buildMissionEventRow({
        id: "ev-1",
        event_type: "pin_generated",
        title: "PIN generat",
        metadata: { pin_id: "p-1" } as never,
      }),
    );

    const result = await repo.getById("ev-1");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.eventType).toBe("pin_generated");
      expect(result.data.metadata).toEqual({ pin_id: "p-1" });
    }
  });

  it("returns data: null on miss", async () => {
    const result = await repo.getById("nope");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("MissionEventsRepository.create", () => {
  it("appends a minimal event with metadata defaulting to {}", async () => {
    const result = await repo.create({
      missionId: "m-1",
      eventType: "drone_dispatched",
      title: "Drona a fost dispusă",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.missionId).toBe("m-1");
      expect(result.data.eventType).toBe("drone_dispatched");
      expect(result.data.metadata).toEqual({});
    }
  });

  it("preserves description, metadata, and occurredAt when provided", async () => {
    const occurredAt = "2026-05-23T11:00:00Z";
    const result = await repo.create({
      missionId: "m-1",
      eventType: "fallback_triggered",
      title: "Fallback activat",
      description: "Niciun punct potrivit",
      metadata: { reason: "no_suitable_pickup_meeting_point", attempts: 2 },
      occurredAt,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.description).toBe("Niciun punct potrivit");
      expect(result.data.metadata).toEqual({
        reason: "no_suitable_pickup_meeting_point",
        attempts: 2,
      });
      expect(result.data.occurredAt).toBe(occurredAt);
    }
  });

  it("round-trips metadata deep-equal on read-back", async () => {
    const created = await repo.create({
      missionId: "m-1",
      eventType: "telemetry_anomaly",
      title: "Anomalie telemetrie",
      metadata: {
        batteryPercent: 23,
        signalDip: 8,
        recovered: true,
        details: { code: 12, level: "warning" },
      },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const refetched = await repo.getById(created.data.id);
    expect(refetched.ok).toBe(true);
    if (refetched.ok && refetched.data) {
      expect(refetched.data.metadata).toEqual(created.data.metadata);
    }
  });

  it("rejects missing missionId / eventType / title", async () => {
    const cases = [
      { missionId: "", eventType: "x", title: "Y" },
      { missionId: "m-1", eventType: "", title: "Y" },
      { missionId: "m-1", eventType: "x", title: "" },
    ];
    for (const input of cases) {
      const result = await repo.create(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("validation_error");
    }
  });
});

describe("MissionEventsRepository immutability", () => {
  it("does not expose updateById", () => {
    expect(
      (repo as unknown as { updateById?: unknown }).updateById,
    ).toBeUndefined();
  });

  it("does not expose deleteById", () => {
    expect(
      (repo as unknown as { deleteById?: unknown }).deleteById,
    ).toBeUndefined();
  });
});

describe("MissionEventsRepository.listByMissionId", () => {
  beforeEach(() => {
    const isoFor = (day: number) =>
      `2026-05-${String(day).padStart(2, "0")}T10:00:00Z`;

    store.seedMissionEvent(
      buildMissionEventRow({
        id: "e1",
        mission_id: "m-1",
        event_type: "drone_dispatched",
        occurred_at: isoFor(1),
      }),
    );
    store.seedMissionEvent(
      buildMissionEventRow({
        id: "e2",
        mission_id: "m-1",
        event_type: "en_route",
        occurred_at: isoFor(5),
      }),
    );
    store.seedMissionEvent(
      buildMissionEventRow({
        id: "e3",
        mission_id: "m-1",
        event_type: "pin_generated",
        occurred_at: isoFor(10),
      }),
    );
    store.seedMissionEvent(
      buildMissionEventRow({
        id: "e4",
        mission_id: "m-1",
        event_type: "delivery_completed",
        occurred_at: isoFor(15),
      }),
    );
    store.seedMissionEvent(
      buildMissionEventRow({
        id: "other",
        mission_id: "m-2",
        event_type: "drone_dispatched",
        occurred_at: isoFor(3),
      }),
    );
  });

  it("returns events for the mission in occurred_at ASC order", async () => {
    const result = await repo.listByMissionId("m-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((e) => e.id)).toEqual(["e1", "e2", "e3", "e4"]);
    }
  });

  it("does not leak events from other missions", async () => {
    const result = await repo.listByMissionId("m-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.find((e) => e.id === "other")).toBeUndefined();
    }
  });

  it("respects a limit", async () => {
    const result = await repo.listByMissionId("m-1", { limit: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(2);
  });

  it("filters by sinceTimestamp (inclusive lower bound)", async () => {
    const result = await repo.listByMissionId("m-1", {
      sinceTimestamp: "2026-05-05T10:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {

      expect(result.data.map((e) => e.id)).toEqual(["e2", "e3", "e4"]);
    }
  });

  it("supports orderBy=created_at", async () => {

    const result = await repo.listByMissionId("m-1", {
      orderBy: "created_at",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(4);
  });

  it("returns an empty array for a mission with no events", async () => {
    const result = await repo.listByMissionId("m-empty");
    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe("MissionEventsRepository.listByEventType", () => {
  beforeEach(() => {
    const isoFor = (day: number) =>
      `2026-05-${String(day).padStart(2, "0")}T10:00:00Z`;

    store.seedMissionEvent(
      buildMissionEventRow({
        id: "f1",
        event_type: "fallback_triggered",
        occurred_at: isoFor(1),
      }),
    );
    store.seedMissionEvent(
      buildMissionEventRow({
        id: "f2",
        event_type: "fallback_triggered",
        occurred_at: isoFor(5),
      }),
    );
    store.seedMissionEvent(
      buildMissionEventRow({
        id: "f3",
        event_type: "fallback_triggered",
        occurred_at: isoFor(10),
      }),
    );
    store.seedMissionEvent(
      buildMissionEventRow({
        id: "other",
        event_type: "drone_dispatched",
        occurred_at: isoFor(8),
      }),
    );
  });

  it("returns events of the given type, newest first", async () => {
    const result = await repo.listByEventType("fallback_triggered");
    expect(result.ok).toBe(true);
    if (result.ok) {

      expect(result.data.map((e) => e.id)).toEqual(["f3", "f2", "f1"]);
    }
  });

  it("does not include events of other types", async () => {
    const result = await repo.listByEventType("fallback_triggered");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.every((e) => e.eventType === "fallback_triggered")).toBe(
        true,
      );
    }
  });

  it("respects a limit", async () => {
    const result = await repo.listByEventType("fallback_triggered", {
      limit: 1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it("returns an empty array for an unknown type", async () => {
    const result = await repo.listByEventType("nonexistent");
    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe("MissionEventsRepository.countByMissionId", () => {
  it("returns the number of events for a mission", async () => {
    store.seedMissionEvent(
      buildMissionEventRow({ id: "e1", mission_id: "m-1" }),
    );
    store.seedMissionEvent(
      buildMissionEventRow({ id: "e2", mission_id: "m-1" }),
    );
    store.seedMissionEvent(
      buildMissionEventRow({ id: "e3", mission_id: "m-1" }),
    );
    store.seedMissionEvent(
      buildMissionEventRow({ id: "other", mission_id: "m-2" }),
    );

    const result = await repo.countByMissionId("m-1");
    expect(result).toEqual({ ok: true, data: 3 });
  });

  it("returns 0 for a mission with no events", async () => {
    const result = await repo.countByMissionId("m-empty");
    expect(result).toEqual({ ok: true, data: 0 });
  });
});
