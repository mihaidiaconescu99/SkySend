import { beforeEach, describe, expect, it } from "vitest";

import {
  AuditEventsRepository,
  recordAuditEvent,
} from "@/lib/repositories/audit-events-repository";
import {
  buildAuditEventRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

let store: FakeStore;
let repo: AuditEventsRepository;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  repo = new AuditEventsRepository(fake.client);
});

describe("AuditEventsRepository.create", () => {
  it("creates a minimal event with changes defaulting to {}", async () => {
    const result = await repo.create({
      actorRole: "system",
      action: "mission.created",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.actorRole).toBe("system");
      expect(result.data.action).toBe("mission.created");
      expect(result.data.changes).toEqual({});
      expect(result.data.actorProfileId).toBeNull();
      expect(result.data.entityType).toBeNull();
      expect(result.data.entityId).toBeNull();
    }
  });

  it("preserves all optional fields when provided", async () => {
    const result = await repo.create({
      actorRole: "admin",
      action: "profile.role_changed",
      actorProfileId: "prof-1",
      entityType: "profiles",
      entityId: "prof-2",
      changes: { from: "client", to: "operator" },
      occurredAt: "2026-05-23T12:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.actorProfileId).toBe("prof-1");
      expect(result.data.entityType).toBe("profiles");
      expect(result.data.entityId).toBe("prof-2");
      expect(result.data.changes).toEqual({ from: "client", to: "operator" });
      expect(result.data.occurredAt).toBe("2026-05-23T12:00:00Z");
    }
  });

  it("rejects empty actorRole", async () => {
    const result = await repo.create({ actorRole: "", action: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("rejects empty action", async () => {
    const result = await repo.create({ actorRole: "admin", action: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("round-trips changes deep-equal on read-back via listRecent", async () => {
    const changes = { before: { status: "pending" }, after: { status: "confirmed" } };
    const created = await repo.create({
      actorRole: "admin",
      action: "order.status_changed",
      changes,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const list = await repo.listRecent(1);
    expect(list.ok).toBe(true);
    if (list.ok && list.data[0]) {
      expect(list.data[0].changes).toEqual(changes);
    }
  });
});

describe("AuditEventsRepository.listByActor", () => {
  const isoFor = (h: number) =>
    `2026-05-23T${String(h).padStart(2, "0")}:00:00Z`;

  beforeEach(() => {
    store.seedAuditEvent(
      buildAuditEventRow({
        id: "a1",
        actor_profile_id: "prof-1",
        occurred_at: isoFor(8),
      }),
    );
    store.seedAuditEvent(
      buildAuditEventRow({
        id: "a2",
        actor_profile_id: "prof-1",
        occurred_at: isoFor(12),
      }),
    );
    store.seedAuditEvent(
      buildAuditEventRow({
        id: "a3",
        actor_profile_id: "prof-2",
        occurred_at: isoFor(10),
      }),
    );
  });

  it("returns events for the actor newest first", async () => {
    const result = await repo.listByActor("prof-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((e) => e.id)).toEqual(["a2", "a1"]);
    }
  });

  it("does not leak events from other actors", async () => {
    const result = await repo.listByActor("prof-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.find((e) => e.id === "a3")).toBeUndefined();
    }
  });

  it("respects a limit", async () => {
    const result = await repo.listByActor("prof-1", { limit: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it("returns empty array for unknown actor", async () => {
    const result = await repo.listByActor("nobody");
    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe("AuditEventsRepository.listByEntity", () => {
  const isoFor = (h: number) =>
    `2026-05-23T${String(h).padStart(2, "0")}:00:00Z`;

  beforeEach(() => {
    store.seedAuditEvent(
      buildAuditEventRow({
        id: "e1",
        entity_type: "orders",
        entity_id: "ord-1",
        occurred_at: isoFor(9),
      }),
    );
    store.seedAuditEvent(
      buildAuditEventRow({
        id: "e2",
        entity_type: "orders",
        entity_id: "ord-1",
        occurred_at: isoFor(11),
      }),
    );
    store.seedAuditEvent(
      buildAuditEventRow({
        id: "e3",
        entity_type: "orders",
        entity_id: "ord-2",
        occurred_at: isoFor(10),
      }),
    );
    store.seedAuditEvent(
      buildAuditEventRow({
        id: "e4",
        entity_type: "profiles",
        entity_id: "ord-1",
        occurred_at: isoFor(8),
      }),
    );
  });

  it("returns events for entity_type+entity_id newest first", async () => {
    const result = await repo.listByEntity("orders", "ord-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((e) => e.id)).toEqual(["e2", "e1"]);
    }
  });

  it("does not leak events from other entities or types", async () => {
    const result = await repo.listByEntity("orders", "ord-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.data.map((e) => e.id);
      expect(ids).not.toContain("e3");
      expect(ids).not.toContain("e4");
    }
  });

  it("respects a limit", async () => {
    const result = await repo.listByEntity("orders", "ord-1", { limit: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it("returns empty array for unknown entity", async () => {
    const result = await repo.listByEntity("orders", "no-such-order");
    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe("AuditEventsRepository.listRecent", () => {
  beforeEach(() => {
    const isoFor = (h: number) =>
      `2026-05-23T${String(h).padStart(2, "0")}:00:00Z`;
    for (let i = 1; i <= 5; i++) {
      store.seedAuditEvent(
        buildAuditEventRow({ id: `r${i}`, occurred_at: isoFor(i) }),
      );
    }
  });

  it("returns events newest first", async () => {
    const result = await repo.listRecent();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((e) => e.id)).toEqual(["r5", "r4", "r3", "r2", "r1"]);
    }
  });

  it("respects the limit argument", async () => {
    const result = await repo.listRecent(3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
      expect(result.data[0].id).toBe("r5");
    }
  });
});

describe("AuditEventsRepository immutability", () => {
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

  it("does not expose getById", () => {
    expect(
      (repo as unknown as { getById?: unknown }).getById,
    ).toBeUndefined();
  });
});

describe("recordAuditEvent (module helper)", () => {
  it("creates an audit event via the convenience wrapper", async () => {
    const fake = createFakeSupabase();
    const result = await recordAuditEvent(fake.client, {
      actorRole: "operator",
      action: "drone.dispatched",
      entityType: "missions",
      entityId: "msn-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.actorRole).toBe("operator");
      expect(result.data.action).toBe("drone.dispatched");
      expect(result.data.entityType).toBe("missions");
      expect(result.data.changes).toEqual({});
    }
  });

  it("propagates validation_error from the helper", async () => {
    const fake = createFakeSupabase();
    const result = await recordAuditEvent(fake.client, {
      actorRole: "",
      action: "x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});
