import { describe, expect, it } from "vitest";

import {
  createInputToRow,
  parseChanges,
  rowToAuditEvent,
} from "@/lib/repositories/mappers/audit-event-mapper";
import { RepositoryError, type DBRow } from "@/lib/repositories/types";

function buildRow(
  overrides: Partial<DBRow<"audit_events">> = {},
): DBRow<"audit_events"> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    actor_profile_id: "00000000-0000-0000-0000-000000000111",
    actor_role: "admin",
    action: "order.status_changed",
    entity_type: "orders",
    entity_id: "00000000-0000-0000-0000-000000000222",
    changes: { from: "pending", to: "confirmed" },
    occurred_at: "2026-05-23T10:00:00Z",
    created_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

describe("rowToAuditEvent", () => {
  it("maps all columns for a complete row", () => {
    const event = rowToAuditEvent(buildRow());
    expect(event).toEqual({
      id: "00000000-0000-0000-0000-000000000001",
      actorProfileId: "00000000-0000-0000-0000-000000000111",
      actorRole: "admin",
      action: "order.status_changed",
      entityType: "orders",
      entityId: "00000000-0000-0000-0000-000000000222",
      changes: { from: "pending", to: "confirmed" },
      occurredAt: "2026-05-23T10:00:00Z",
      createdAt: "2026-05-23T10:00:00Z",
    });
  });

  it("actor_profile_id null → actorProfileId null", () => {
    expect(
      rowToAuditEvent(buildRow({ actor_profile_id: null })).actorProfileId,
    ).toBeNull();
  });

  it("entity_type and entity_id null → null in domain", () => {
    const event = rowToAuditEvent(
      buildRow({ entity_type: null, entity_id: null }),
    );
    expect(event.entityType).toBeNull();
    expect(event.entityId).toBeNull();
  });

  it("changes null → defaults to {}", () => {
    expect(
      rowToAuditEvent(buildRow({ changes: null })).changes,
    ).toEqual({});
  });

  it("occurredAt falls back to createdAt when null", () => {
    const event = rowToAuditEvent(
      buildRow({ occurred_at: null as unknown as string }),
    );
    expect(event.occurredAt).toBe("2026-05-23T10:00:00Z");
  });

  it("throws validation_error on missing actor_role", () => {
    expect(() =>
      rowToAuditEvent(buildRow({ actor_role: "" })),
    ).toThrowError(RepositoryError);
  });

  it("throws validation_error on missing action", () => {
    expect(() =>
      rowToAuditEvent(buildRow({ action: "" })),
    ).toThrowError(RepositoryError);
  });

  it("throws validation_error on missing id", () => {
    expect(() =>
      rowToAuditEvent(buildRow({ id: "" })),
    ).toThrowError(RepositoryError);
  });
});

describe("createInputToRow", () => {
  it("maps a minimal input (actorRole + action)", () => {
    const row = createInputToRow({
      actorRole: "system",
      action: "mission.created",
    });
    expect(row.actor_role).toBe("system");
    expect(row.action).toBe("mission.created");
    expect(row.changes).toEqual({});

    expect(row.actor_profile_id).toBeUndefined();
    expect(row.entity_type).toBeUndefined();
  });

  it("passes through all optional fields", () => {
    const row = createInputToRow({
      actorRole: "admin",
      action: "profile.role_changed",
      actorProfileId: "prof-1",
      entityType: "profiles",
      entityId: "prof-2",
      changes: { from: "client", to: "operator" },
      occurredAt: "2026-05-23T12:00:00Z",
    });
    expect(row.actor_profile_id).toBe("prof-1");
    expect(row.entity_type).toBe("profiles");
    expect(row.entity_id).toBe("prof-2");
    expect(row.changes).toEqual({ from: "client", to: "operator" });
    expect(row.occurred_at).toBe("2026-05-23T12:00:00Z");
  });

  it("changes defaults to {} when omitted", () => {
    const row = createInputToRow({ actorRole: "admin", action: "x" });
    expect(row.changes).toEqual({});
  });

  it("throws validation_error on empty actorRole", () => {
    expect(() =>
      createInputToRow({ actorRole: "", action: "x" }),
    ).toThrowError(RepositoryError);
  });

  it("throws validation_error on empty action", () => {
    expect(() =>
      createInputToRow({ actorRole: "admin", action: "" }),
    ).toThrowError(RepositoryError);
  });
});

describe("parseChanges", () => {
  it("returns a shallow copy of a plain object", () => {
    const input = { from: "a", to: "b" };
    const out = parseChanges(input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it("returns {} for null", () => {
    expect(parseChanges(null)).toEqual({});
  });

  it("returns {} for arrays", () => {
    expect(parseChanges([1, 2])).toEqual({});
  });

  it("returns {} for primitives", () => {
    expect(parseChanges(42)).toEqual({});
    expect(parseChanges("oops")).toEqual({});
  });
});
