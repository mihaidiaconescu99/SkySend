import { describe, expect, it } from "vitest";

import {
  createInputToRow,
  parseMissionEventMetadata,
  rowToMissionEvent,
} from "@/lib/repositories/mappers/mission-event-mapper";
import { RepositoryError, type DBRow } from "@/lib/repositories/types";

function buildRow(
  overrides: Partial<DBRow<"mission_events">> = {},
): DBRow<"mission_events"> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    mission_id: "00000000-0000-0000-0000-000000000111",
    event_type: "drone_dispatched",
    title: "Drona a fost dispusă",
    description: null,
    metadata: { droneClass: "medium_standard" },
    occurred_at: "2026-05-23T10:00:00Z",
    created_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

describe("rowToMissionEvent", () => {
  it("maps every column for a healthy row", () => {
    const event = rowToMissionEvent(buildRow());
    expect(event).toEqual({
      id: "00000000-0000-0000-0000-000000000001",
      missionId: "00000000-0000-0000-0000-000000000111",
      eventType: "drone_dispatched",
      title: "Drona a fost dispusă",
      description: null,
      metadata: { droneClass: "medium_standard" },
      occurredAt: "2026-05-23T10:00:00Z",
      createdAt: "2026-05-23T10:00:00Z",
    });
  });

  it("preserves description when present", () => {
    expect(
      rowToMissionEvent(buildRow({ description: "Detalii suplimentare" }))
        .description,
    ).toBe("Detalii suplimentare");
  });

  it("falls back to {} for malformed metadata (string)", () => {
    expect(
      rowToMissionEvent(buildRow({ metadata: "oops" as unknown as never }))
        .metadata,
    ).toEqual({});
  });

  it("falls back to {} for null metadata", () => {
    expect(
      rowToMissionEvent(buildRow({ metadata: null as unknown as never }))
        .metadata,
    ).toEqual({});
  });

  it("throws on missing event_type", () => {
    expect(() =>
      rowToMissionEvent(buildRow({ event_type: "" })),
    ).toThrowError(RepositoryError);
  });

  it("throws on missing title", () => {
    expect(() =>
      rowToMissionEvent(buildRow({ title: "" })),
    ).toThrowError(RepositoryError);
  });

  it("throws on missing mission_id", () => {
    expect(() =>
      rowToMissionEvent(buildRow({ mission_id: "" })),
    ).toThrowError(RepositoryError);
  });
});

describe("createInputToRow", () => {
  it("returns a minimal row with metadata defaulted to {}", () => {
    const row = createInputToRow({
      missionId: "m-1",
      eventType: "drone_dispatched",
      title: "T",
    });
    expect(row).toEqual({
      mission_id: "m-1",
      event_type: "drone_dispatched",
      title: "T",
      metadata: {},
    });
  });

  it("includes description and occurred_at when provided", () => {
    const row = createInputToRow({
      missionId: "m-1",
      eventType: "pin_generated",
      title: "PIN generat",
      description: "Cod expediere",
      occurredAt: "2026-05-23T11:00:00Z",
    });
    expect(row.description).toBe("Cod expediere");
    expect(row.occurred_at).toBe("2026-05-23T11:00:00Z");
  });

  it("passes through metadata when provided", () => {
    const row = createInputToRow({
      missionId: "m-1",
      eventType: "fallback_triggered",
      title: "Fallback",
      metadata: { reason: "no_suitable_pickup_meeting_point", attempts: 2 },
    });
    expect(row.metadata).toEqual({
      reason: "no_suitable_pickup_meeting_point",
      attempts: 2,
    });
  });

  it("rejects missing missionId / eventType / title", () => {
    expect(() =>
      createInputToRow({
        missionId: "",
        eventType: "drone_dispatched",
        title: "T",
      }),
    ).toThrowError(RepositoryError);
    expect(() =>
      createInputToRow({
        missionId: "m-1",
        eventType: "",
        title: "T",
      }),
    ).toThrowError(RepositoryError);
    expect(() =>
      createInputToRow({
        missionId: "m-1",
        eventType: "drone_dispatched",
        title: "",
      }),
    ).toThrowError(RepositoryError);
  });
});

describe("parseMissionEventMetadata", () => {
  it("returns a shallow copy of a plain object", () => {
    const input = { a: 1, b: "two" };
    const out = parseMissionEventMetadata(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it("returns {} for arrays and primitives", () => {
    expect(parseMissionEventMetadata([1, 2])).toEqual({});
    expect(parseMissionEventMetadata(42)).toEqual({});
    expect(parseMissionEventMetadata("oops")).toEqual({});
  });
});
