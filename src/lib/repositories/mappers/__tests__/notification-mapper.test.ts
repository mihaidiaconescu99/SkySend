import { describe, expect, it } from "vitest";

import {
  createInputToRow,
  parseNotificationMetadata,
  parseNotificationType,
  rowToNotification,
  updateInputToRow,
} from "@/lib/repositories/mappers/notification-mapper";
import { RepositoryError, type DBRow } from "@/lib/repositories/types";

function buildNotificationRow(
  overrides: Partial<DBRow<"notifications">> = {},
): DBRow<"notifications"> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    profile_id: "00000000-0000-0000-0000-000000000999",
    type: "order",
    title: "Comanda confirmată",
    message: "Comanda SKY-PT-12345 a fost confirmată.",
    metadata: { orderId: "SKY-PT-12345" },
    action_url: "/client/orders/SKY-PT-12345",
    read: false,
    read_at: null,
    created_at: "2026-05-23T10:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

describe("rowToNotification", () => {
  it("maps every column for a fully populated row", () => {
    const row = buildNotificationRow();
    expect(rowToNotification(row)).toEqual({
      id: row.id,
      profileId: row.profile_id,
      type: "order",
      title: row.title,
      message: row.message,
      metadata: { orderId: "SKY-PT-12345" },
      actionUrl: row.action_url,
      read: false,
      readAt: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  it("maps profile_id null to profileId null (broadcast)", () => {
    expect(
      rowToNotification(buildNotificationRow({ profile_id: null })).profileId,
    ).toBeNull();
  });

  it("rejects an unknown type value", () => {
    expect(() =>
      rowToNotification(buildNotificationRow({ type: "ads" as never })),
    ).toThrowError(RepositoryError);
  });

  it("falls back to {} when metadata is malformed (string)", () => {
    expect(
      rowToNotification(
        buildNotificationRow({
          metadata: "oops" as unknown as never,
        }),
      ).metadata,
    ).toEqual({});
  });

  it("falls back to {} when metadata is null", () => {
    expect(
      rowToNotification(
        buildNotificationRow({ metadata: null as unknown as never }),
      ).metadata,
    ).toEqual({});
  });

  it("maps read=true with a populated read_at to {read,readAt}", () => {
    const row = buildNotificationRow({
      read: true,
      read_at: "2026-05-23T11:00:00Z",
    });
    const result = rowToNotification(row);
    expect(result.read).toBe(true);
    expect(result.readAt).toBe("2026-05-23T11:00:00Z");
  });
});

describe("createInputToRow", () => {
  it("emits a row with sensible defaults from a minimal input", () => {
    const row = createInputToRow({
      type: "system",
      title: "Întreținere planificată",
      message: "Sistemul va fi indisponibil 5 minute.",
    });
    expect(row).toEqual({
      type: "system",
      title: "Întreținere planificată",
      message: "Sistemul va fi indisponibil 5 minute.",
      metadata: {},
      read: false,
      read_at: null,
    });
  });

  it("preserves profile_id null (broadcast)", () => {
    const row = createInputToRow({
      type: "system",
      title: "Anunț",
      message: "Pentru toți utilizatorii.",
      profileId: null,
    });
    expect(row.profile_id).toBeNull();
  });

  it("passes through metadata and actionUrl when provided", () => {
    const row = createInputToRow({
      type: "order",
      title: "Comanda mea",
      message: "Status actualizat",
      metadata: { orderId: "X" },
      actionUrl: "/orders/X",
    });
    expect(row.metadata).toEqual({ orderId: "X" });
    expect(row.action_url).toBe("/orders/X");
  });

  it("throws when title is empty", () => {
    expect(() =>
      createInputToRow({
        type: "order",
        title: "",
        message: "X",
      }),
    ).toThrowError(RepositoryError);
  });

  it("throws when message is empty", () => {
    expect(() =>
      createInputToRow({
        type: "order",
        title: "X",
        message: "",
      }),
    ).toThrowError(RepositoryError);
  });

  it("throws when type is invalid", () => {
    expect(() =>
      createInputToRow({
        type: "ads" as never,
        title: "X",
        message: "X",
      }),
    ).toThrowError(RepositoryError);
  });
});

describe("updateInputToRow", () => {
  it("emits a sparse payload toggling read", () => {
    expect(updateInputToRow({ read: true })).toEqual({ read: true });
  });

  it("emits both read and read_at when both are provided", () => {
    expect(
      updateInputToRow({ read: true, readAt: "2026-05-23T12:00:00Z" }),
    ).toEqual({ read: true, read_at: "2026-05-23T12:00:00Z" });
  });

  it("throws validation_error for an empty input", () => {
    expect(() => updateInputToRow({})).toThrowError(RepositoryError);
  });
});

describe("parseNotificationMetadata", () => {
  it("returns a shallow copy of a valid object", () => {
    const input = { a: 1, b: "two" };
    const out = parseNotificationMetadata(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it("returns {} for arrays", () => {
    expect(parseNotificationMetadata([1, 2, 3])).toEqual({});
  });

  it("returns {} for primitives", () => {
    expect(parseNotificationMetadata("oops")).toEqual({});
    expect(parseNotificationMetadata(42)).toEqual({});
    expect(parseNotificationMetadata(true)).toEqual({});
  });
});

describe("parseNotificationType", () => {
  it.each(["order", "mission", "payment", "system"] as const)(
    "accepts the canonical type %s",
    (value) => {
      expect(parseNotificationType(value)).toBe(value);
    },
  );

  it("rejects unknown strings", () => {
    expect(() => parseNotificationType("ads")).toThrowError(RepositoryError);
  });

  it("rejects null", () => {
    expect(() => parseNotificationType(null)).toThrowError(RepositoryError);
  });
});
