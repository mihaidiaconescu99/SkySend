import { beforeEach, describe, expect, it } from "vitest";

import { NotificationsRepository } from "@/lib/repositories/notifications-repository";
import {
  buildNotificationRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

let store: FakeStore;
let repo: NotificationsRepository;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  repo = new NotificationsRepository(fake.client);
});

describe("NotificationsRepository.getById", () => {
  it("returns the mapped Notification when the row exists", async () => {
    store.seedNotification(
      buildNotificationRow({
        id: "n-1",
        type: "order",
        title: "Comanda mea",
        message: "Confirmată.",
      }),
    );

    const result = await repo.getById("n-1");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.id).toBe("n-1");
      expect(result.data.type).toBe("order");
      expect(result.data.title).toBe("Comanda mea");
    }
  });

  it("returns data: null when no row matches", async () => {
    const result = await repo.getById("nope");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("NotificationsRepository.create", () => {
  it("creates a Notification with defaults", async () => {
    const result = await repo.create({
      type: "system",
      title: "Mentenanță",
      message: "5 minute downtime.",
      profileId: "p-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.profileId).toBe("p-1");
      expect(result.data.read).toBe(false);
      expect(result.data.readAt).toBeNull();
      expect(result.data.metadata).toEqual({});
    }
  });

  it("preserves a null profileId (broadcast)", async () => {
    const result = await repo.create({
      type: "system",
      title: "Anunț global",
      message: "Pentru toți.",
      profileId: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.profileId).toBeNull();
  });

  it("surfaces invalid type as validation_error", async () => {
    const result = await repo.create({
      type: "ads" as never,
      title: "X",
      message: "Y",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("rejects empty title/message via the mapper", async () => {
    const result = await repo.create({
      type: "system",
      title: "",
      message: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});

describe("NotificationsRepository.updateById", () => {
  it("flips read from false to true", async () => {
    store.seedNotification(
      buildNotificationRow({ id: "n-1", read: false }),
    );
    const result = await repo.updateById("n-1", {
      read: true,
      readAt: "2026-05-23T12:00:00Z",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.read).toBe(true);
      expect(result.data.readAt).toBe("2026-05-23T12:00:00Z");
    }
  });

  it("returns not_found for an unknown id", async () => {
    const result = await repo.updateById("nope", { read: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("rejects empty input", async () => {
    store.seedNotification(buildNotificationRow({ id: "n-1" }));
    const result = await repo.updateById("n-1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});

describe("NotificationsRepository.deleteById", () => {
  it("deletes an existing notification", async () => {
    store.seedNotification(buildNotificationRow({ id: "n-1" }));
    const result = await repo.deleteById("n-1");
    expect(result).toEqual({ ok: true, data: undefined });
    expect(store.notificationRows.has("n-1")).toBe(false);
  });

  it("returns not_found when nothing matches", async () => {
    const result = await repo.deleteById("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

describe("NotificationsRepository.listByProfileId", () => {
  beforeEach(() => {

    const isoFor = (day: number) =>
      `2026-05-${String(day).padStart(2, "0")}T10:00:00Z`;

    store.seedNotification(
      buildNotificationRow({
        id: "n-u1",
        profile_id: "p-1",
        type: "order",
        read: false,
        created_at: isoFor(1),
      }),
    );
    store.seedNotification(
      buildNotificationRow({
        id: "n-u2",
        profile_id: "p-1",
        type: "mission",
        read: false,
        created_at: isoFor(3),
      }),
    );
    store.seedNotification(
      buildNotificationRow({
        id: "n-u3",
        profile_id: "p-1",
        type: "system",
        read: false,
        created_at: isoFor(5),
      }),
    );
    store.seedNotification(
      buildNotificationRow({
        id: "n-r1",
        profile_id: "p-1",
        type: "order",
        read: true,
        read_at: isoFor(2),
        created_at: isoFor(2),
      }),
    );
    store.seedNotification(
      buildNotificationRow({
        id: "n-r2",
        profile_id: "p-1",
        type: "payment",
        read: true,
        read_at: isoFor(4),
        created_at: isoFor(4),
      }),
    );
    store.seedNotification(
      buildNotificationRow({
        id: "other",
        profile_id: "p-2",
        type: "system",
      }),
    );
  });

  it("returns all 5 notifications for the profile, newest first", async () => {
    const result = await repo.listByProfileId("p-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(5);
      expect(result.data[0].id).toBe("n-u3");
    }
  });

  it("returns only unread when unreadOnly=true", async () => {
    const result = await repo.listByProfileId("p-1", { unreadOnly: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
      expect(result.data.every((n) => n.read === false)).toBe(true);
    }
  });

  it("filters by type", async () => {
    const result = await repo.listByProfileId("p-1", { type: "order" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.every((n) => n.type === "order")).toBe(true);
    }
  });

  it("respects a limit", async () => {
    const result = await repo.listByProfileId("p-1", { limit: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(2);
  });

  it("returns an empty array for a profile without notifications", async () => {
    const result = await repo.listByProfileId("p-unknown");
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("does not leak notifications from other profiles", async () => {
    const result = await repo.listByProfileId("p-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.find((n) => n.id === "other")).toBeUndefined();
    }
  });
});

describe("NotificationsRepository.markAsRead", () => {
  it("flips read=true and stamps read_at", async () => {
    store.seedNotification(
      buildNotificationRow({ id: "n-1", read: false, read_at: null }),
    );
    const result = await repo.markAsRead("n-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.read).toBe(true);
      expect(result.data.readAt).toBeTruthy();
    }
  });

  it("returns not_found for an unknown id", async () => {
    const result = await repo.markAsRead("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

describe("NotificationsRepository.markAllReadForProfile", () => {
  it("flips every unread row for the profile and returns the count", async () => {
    store.seedNotification(
      buildNotificationRow({ id: "n-1", profile_id: "p-1", read: false }),
    );
    store.seedNotification(
      buildNotificationRow({ id: "n-2", profile_id: "p-1", read: false }),
    );
    store.seedNotification(
      buildNotificationRow({ id: "n-3", profile_id: "p-1", read: true }),
    );
    store.seedNotification(
      buildNotificationRow({ id: "other", profile_id: "p-2", read: false }),
    );

    const result = await repo.markAllReadForProfile("p-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(2);

    expect(store.notificationRows.get("n-1")?.read).toBe(true);
    expect(store.notificationRows.get("n-2")?.read).toBe(true);

    expect(store.notificationRows.get("n-3")?.read).toBe(true);
    expect(store.notificationRows.get("other")?.read).toBe(false);
  });

  it("returns 0 when the profile has no unread notifications", async () => {
    store.seedNotification(
      buildNotificationRow({ id: "n-1", profile_id: "p-1", read: true }),
    );
    const result = await repo.markAllReadForProfile("p-1");
    expect(result).toEqual({ ok: true, data: 0 });
  });

  it("returns 0 when the profile has no notifications at all", async () => {
    const result = await repo.markAllReadForProfile("p-empty");
    expect(result).toEqual({ ok: true, data: 0 });
  });
});

describe("NotificationsRepository.countUnread", () => {
  it("returns the unread count for the profile", async () => {
    store.seedNotification(
      buildNotificationRow({ id: "u1", profile_id: "p-1", read: false }),
    );
    store.seedNotification(
      buildNotificationRow({ id: "u2", profile_id: "p-1", read: false }),
    );
    store.seedNotification(
      buildNotificationRow({ id: "r1", profile_id: "p-1", read: true }),
    );
    store.seedNotification(
      buildNotificationRow({ id: "other", profile_id: "p-2", read: false }),
    );

    const result = await repo.countUnread("p-1");
    expect(result).toEqual({ ok: true, data: 2 });
  });

  it("returns 0 when nothing is unread", async () => {
    store.seedNotification(
      buildNotificationRow({ id: "r1", profile_id: "p-1", read: true }),
    );
    const result = await repo.countUnread("p-1");
    expect(result).toEqual({ ok: true, data: 0 });
  });

  it("returns 0 for a profile with no rows", async () => {
    const result = await repo.countUnread("p-empty");
    expect(result).toEqual({ ok: true, data: 0 });
  });
});
