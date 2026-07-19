import { beforeEach, describe, expect, it } from "vitest";

import { OperationalSettingsRepository } from "@/lib/repositories/operational-settings-repository";
import {
  buildSettingsRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

let store: FakeStore;
let repo: OperationalSettingsRepository;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  repo = new OperationalSettingsRepository(fake.client);
});

describe("OperationalSettingsRepository.getCurrent", () => {
  it("returns the singleton row as a domain OperationalSettings", async () => {
    store.seedSettings(
      buildSettingsRow({
        id: "settings-1",
        base_price_minor: 990,
        price_per_km_minor: 220,
        service_radius_km: 6,
      }),
    );

    const result = await repo.getCurrent();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("settings-1");
      expect(result.data.basePriceMinor).toBe(990);
      expect(result.data.pricePerKmMinor).toBe(220);
      expect(result.data.serviceRadiusKm).toBe(6);
      expect(result.data.hubLatitude).toBe(44.8565);
      expect(result.data.hubLongitude).toBe(24.8692);
    }
  });

  it("returns a database_error when the singleton row is missing", async () => {
    const result = await repo.getCurrent();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("database_error");
      expect(result.error.message).toMatch(/singleton/i);
    }
  });
});

describe("OperationalSettingsRepository.update", () => {
  beforeEach(() => {
    store.seedSettings(
      buildSettingsRow({
        id: "settings-1",
        base_price_minor: 990,
        price_per_km_minor: 220,
        service_radius_km: 6,
        last_saved_at: "2026-01-01T00:00:00Z",
      }),
    );
  });

  it("applies a sparse basePriceMinor change and refreshes lastSavedAt", async () => {
    const before = await repo.getCurrent();
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const previousLastSavedAt = before.data.lastSavedAt;

    const result = await repo.update({ basePriceMinor: 1200 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.basePriceMinor).toBe(1200);
      expect(result.data.pricePerKmMinor).toBe(220);
      expect(result.data.lastSavedAt).not.toBe(previousLastSavedAt);
    }
  });

  it("returns validation_error for an empty input", async () => {
    const result = await repo.update({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("applies all fields together", async () => {
    const result = await repo.update({
      isActive: false,
      serviceRadiusKm: 8,
      basePriceMinor: 1200,
      pricePerKmMinor: 300,
      confirmationTimerMinutes: 15,
      loadingTimerMinutes: 12,
      unloadingTimerMinutes: 8,
      hubLatitude: 45.0,
      hubLongitude: 25.0,
      lastSavedBy: "admin-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        isActive: false,
        serviceRadiusKm: 8,
        basePriceMinor: 1200,
        pricePerKmMinor: 300,
        confirmationTimerMinutes: 15,
        loadingTimerMinutes: 12,
        unloadingTimerMinutes: 8,
        hubLatitude: 45.0,
        hubLongitude: 25.0,
        lastSavedBy: "admin-1",
      });
    }
  });

  it("preserves the singleton row id across an update", async () => {
    const before = await repo.getCurrent();
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const beforeId = before.data.id;

    const result = await repo.update({ basePriceMinor: 1500 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(beforeId);
    expect(store.settingsRows.size).toBe(1);
  });

  it("records a new lastSavedBy", async () => {
    const result = await repo.update({ lastSavedBy: "admin-2" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.lastSavedBy).toBe("admin-2");
  });

  it("rejects an invalid serviceRadiusKm value", async () => {
    const result = await repo.update({ serviceRadiusKm: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("persists changes so a subsequent getCurrent reflects them", async () => {
    const updated = await repo.update({ pricePerKmMinor: 350 });
    expect(updated.ok).toBe(true);

    const refetched = await repo.getCurrent();
    expect(refetched.ok).toBe(true);
    if (refetched.ok) expect(refetched.data.pricePerKmMinor).toBe(350);
  });
});

describe("OperationalSettingsRepository.update — singleton missing", () => {
  it("propagates the database_error when no settings row exists", async () => {

    const result = await repo.update({ basePriceMinor: 1500 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("database_error");
  });
});
