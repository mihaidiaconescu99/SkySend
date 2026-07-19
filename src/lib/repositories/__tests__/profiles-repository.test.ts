import { beforeEach, describe, expect, it } from "vitest";

import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import {
  buildProfileRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

let store: FakeStore;
let profiles: ProfilesRepository;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  profiles = new ProfilesRepository(fake.client);
});

describe("ProfilesRepository.getById", () => {
  it("returns the mapped Profile when the row exists", async () => {
    const row = buildProfileRow({
      id: "p-1",
      email: "ana@example.com",
      full_name: "Ana",
    });
    store.seedProfile(row);

    const result = await profiles.getById("p-1");

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.id).toBe("p-1");
      expect(result.data.email).toBe("ana@example.com");
      expect(result.data.fullName).toBe("Ana");
      expect(result.data.role).toBe("client");
      expect(result.data.notificationPreferences).toEqual({
        popup: true,
        email: true,
      });
    }
  });

  it("returns data: null when no row matches", async () => {
    const result = await profiles.getById("does-not-exist");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("surfaces injected DB errors as a failed result", async () => {
    store.injectErrorOnNext("select", {
      code: "08006",
      message: "connection drop",
    });

    const result = await profiles.getById("p-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("database_error");
    }
  });

  it("returns a validation_error when the stored row has a bad role", async () => {
    store.seedProfile(
      buildProfileRow({ id: "p-bad", role: "superuser" as never }),
    );

    const result = await profiles.getById("p-bad");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("recovers gracefully when notification_preferences is malformed in storage", async () => {
    store.seedProfile(
      buildProfileRow({
        id: "p-corrupt",
        notification_preferences: "garbage" as never,
      }),
    );

    const result = await profiles.getById("p-corrupt");

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {

      expect(result.data.notificationPreferences).toEqual({
        popup: true,
        email: true,
      });
    }
  });
});

describe("ProfilesRepository.getByClerkUserId", () => {
  it("returns the Profile when a row matches the clerk id", async () => {
    store.seedProfile(
      buildProfileRow({ id: "p-1", clerk_user_id: "user_abc" }),
    );
    const result = await profiles.getByClerkUserId("user_abc");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) expect(result.data.clerkUserId).toBe("user_abc");
  });

  it("returns null when no row matches", async () => {
    const result = await profiles.getByClerkUserId("user_missing");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("does not match across case differences in the clerk id (matching is exact)", async () => {
    store.seedProfile(
      buildProfileRow({ clerk_user_id: "user_lowercase" }),
    );
    const result = await profiles.getByClerkUserId("USER_LOWERCASE");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("short-circuits an empty clerkUserId to data: null without querying", async () => {
    store.injectErrorOnNext("select", {
      code: "08006",
      message: "this should never fire",
    });
    const result = await profiles.getByClerkUserId("");
    expect(result).toEqual({ ok: true, data: null });

    expect(store.consumeError("select")?.code).toBe("08006");
  });
});

describe("ProfilesRepository.create", () => {
  it("creates a Profile with mapper defaults applied when only required fields are provided", async () => {
    const result = await profiles.create({
      clerkUserId: "user_new",
      email: "new@example.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.clerkUserId).toBe("user_new");
      expect(result.data.email).toBe("new@example.com");
      expect(result.data.role).toBe("client");
      expect(result.data.notificationPreferences).toEqual({
        popup: true,
        email: true,
      });
      expect(result.data.id).toMatch(/[0-9a-f-]{36}/i);
      expect(result.data.createdAt).toBeTruthy();
    }
  });

  it("returns validation_error when required fields are missing", async () => {
    const result = await profiles.create({
      clerkUserId: "",
      email: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("propagates a unique-violation as validation_error when clerk_user_id is taken", async () => {
    store.seedProfile(buildProfileRow({ clerk_user_id: "user_taken" }));

    const result = await profiles.create({
      clerkUserId: "user_taken",
      email: "another@example.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation_error");
      expect(result.error.details?.postgresCode).toBe("23505");
    }
  });

  it("honours an explicit role argument", async () => {
    const result = await profiles.create({
      clerkUserId: "user_op",
      email: "ops@skysend.com",
      role: "operator",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.role).toBe("operator");
  });

  it("merges a partial notificationPreferences override with the defaults", async () => {
    const result = await profiles.create({
      clerkUserId: "user_partial",
      email: "p@example.com",
      notificationPreferences: { email: false },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.notificationPreferences).toEqual({
        popup: true,
        email: false,
      });
    }
  });
});

describe("ProfilesRepository.updateById", () => {
  it("applies a sparse update and returns the refreshed Profile", async () => {
    store.seedProfile(buildProfileRow({ id: "p-1", email: "old@example.com" }));

    const result = await profiles.updateById("p-1", {
      email: "new@example.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.email).toBe("new@example.com");

    expect(store.rows.get("p-1")?.email).toBe("new@example.com");
    expect(store.rows.get("p-1")?.role).toBe("client");
  });

  it("returns not_found when the row does not exist", async () => {
    const result = await profiles.updateById("nope", {
      email: "x@example.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("returns validation_error when the input is empty", async () => {
    store.seedProfile(buildProfileRow({ id: "p-1" }));
    const result = await profiles.updateById("p-1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("preserves explicit null in fullName as a clear operation", async () => {
    store.seedProfile(
      buildProfileRow({ id: "p-1", full_name: "Was set" }),
    );

    const result = await profiles.updateById("p-1", { fullName: null });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.fullName).toBeNull();
    expect(store.rows.get("p-1")?.full_name).toBeNull();
  });

  it("leaves untouched columns intact when the update only mentions one field", async () => {
    store.seedProfile(
      buildProfileRow({
        id: "p-1",
        email: "before@example.com",
        full_name: "Before",
        role: "client",
      }),
    );

    const result = await profiles.updateById("p-1", { role: "admin" });

    expect(result.ok).toBe(true);
    const updated = store.rows.get("p-1");
    expect(updated?.role).toBe("admin");
    expect(updated?.email).toBe("before@example.com");
    expect(updated?.full_name).toBe("Before");
  });
});

describe("ProfilesRepository.deleteById", () => {
  it("deletes an existing row and returns ok: true", async () => {
    store.seedProfile(buildProfileRow({ id: "p-1" }));
    const result = await profiles.deleteById("p-1");
    expect(result).toEqual({ ok: true, data: undefined });
    expect(store.rows.has("p-1")).toBe(false);
  });

  it("returns not_found when the id does not match any row", async () => {
    const result = await profiles.deleteById("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

describe("ProfilesRepository.findOrCreateByClerkUserId", () => {
  it("returns the existing Profile without creating a duplicate when one already exists", async () => {
    store.seedProfile(
      buildProfileRow({ id: "p-1", clerk_user_id: "user_existing" }),
    );
    const before = store.rows.size;

    const result = await profiles.findOrCreateByClerkUserId("user_existing", {
      clerkUserId: "user_existing",
      email: "ignored@example.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe("p-1");
    expect(store.rows.size).toBe(before);
  });

  it("creates a new Profile when none exists for the clerk id", async () => {
    const result = await profiles.findOrCreateByClerkUserId("user_new", {
      clerkUserId: "user_new",
      email: "new@example.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.clerkUserId).toBe("user_new");
    expect(store.rows.size).toBe(1);
  });

  it("recovers from a race condition by re-fetching when INSERT fails with 23505", async () => {

    const victorRow = buildProfileRow({
      id: "p-victor",
      clerk_user_id: "user_race",
      email: "victor@example.com",
    });
    store.injectInsertRace(victorRow);

    const result = await profiles.findOrCreateByClerkUserId("user_race", {
      clerkUserId: "user_race",
      email: "loser@example.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("p-victor");

      expect(result.data.email).toBe("victor@example.com");
    }
  });

  it("propagates non-conflict errors from create without re-fetching", async () => {
    store.injectErrorOnNext("insert", {
      code: "23502",
      message: "not_null_violation",
    });

    const result = await profiles.findOrCreateByClerkUserId("user_x", {
      clerkUserId: "user_x",
      email: "x@example.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation_error");
      expect(result.error.details?.postgresCode).toBe("23502");
    }
  });
});
