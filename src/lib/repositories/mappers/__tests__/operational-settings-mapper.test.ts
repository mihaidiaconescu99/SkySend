import { describe, expect, it } from "vitest";

import {
  rowToSettings,
  updateInputToRow,
} from "@/lib/repositories/mappers/operational-settings-mapper";
import { RepositoryError, type DBRow } from "@/lib/repositories/types";

function buildSettingsRow(
  overrides: Partial<DBRow<"operational_settings">> = {},
): DBRow<"operational_settings"> {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    is_active: true,
    is_singleton: true,
    service_radius_km: 6,
    base_price_minor: 990,
    price_per_km_minor: 220,
    confirmation_timer_minutes: 10,
    loading_timer_minutes: 10,
    unloading_timer_minutes: 10,
    hub_latitude: 44.8565,
    hub_longitude: 24.8692,
    last_saved_at: "2026-05-23T10:00:00Z",
    last_saved_by: null,
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

describe("rowToSettings", () => {
  it("maps every column for a healthy default row", () => {
    const row = buildSettingsRow();
    expect(rowToSettings(row)).toEqual({
      id: row.id,
      isActive: true,
      serviceRadiusKm: 6,
      basePriceMinor: 990,
      pricePerKmMinor: 220,
      confirmationTimerMinutes: 10,
      loadingTimerMinutes: 10,
      unloadingTimerMinutes: 10,
      hubLatitude: 44.8565,
      hubLongitude: 24.8692,
      lastSavedAt: row.last_saved_at,
      lastSavedBy: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  it("preserves lastSavedBy when set", () => {
    expect(
      rowToSettings(
        buildSettingsRow({
          last_saved_by: "22222222-2222-2222-2222-222222222222",
        }),
      ).lastSavedBy,
    ).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("throws when service_radius_km is 0", () => {
    expect(() =>
      rowToSettings(buildSettingsRow({ service_radius_km: 0 })),
    ).toThrowError(RepositoryError);
  });

  it("throws when service_radius_km is negative", () => {
    expect(() =>
      rowToSettings(buildSettingsRow({ service_radius_km: -1 })),
    ).toThrowError(RepositoryError);
  });

  it("throws when base_price_minor is negative", () => {
    expect(() =>
      rowToSettings(buildSettingsRow({ base_price_minor: -100 })),
    ).toThrowError(RepositoryError);
  });

  it("accepts base_price_minor = 0 (free deliveries are legal config)", () => {
    expect(
      rowToSettings(buildSettingsRow({ base_price_minor: 0 })).basePriceMinor,
    ).toBe(0);
  });

  it("throws when price_per_km_minor is a non-integer", () => {
    expect(() =>
      rowToSettings(buildSettingsRow({ price_per_km_minor: 1.5 })),
    ).toThrowError(RepositoryError);
  });

  it("throws when confirmation_timer_minutes is 0", () => {
    expect(() =>
      rowToSettings(buildSettingsRow({ confirmation_timer_minutes: 0 })),
    ).toThrowError(RepositoryError);
  });

  it("throws when loading_timer_minutes is 0", () => {
    expect(() =>
      rowToSettings(buildSettingsRow({ loading_timer_minutes: 0 })),
    ).toThrowError(RepositoryError);
  });

  it("throws when unloading_timer_minutes is 0", () => {
    expect(() =>
      rowToSettings(buildSettingsRow({ unloading_timer_minutes: 0 })),
    ).toThrowError(RepositoryError);
  });

  it("throws when hub_latitude is out of range", () => {
    expect(() =>
      rowToSettings(buildSettingsRow({ hub_latitude: 95 })),
    ).toThrowError(RepositoryError);
  });

  it("throws when hub_longitude is out of range", () => {
    expect(() =>
      rowToSettings(buildSettingsRow({ hub_longitude: -200 })),
    ).toThrowError(RepositoryError);
  });

  it("treats is_active=false correctly (platform paused)", () => {
    expect(rowToSettings(buildSettingsRow({ is_active: false })).isActive).toBe(
      false,
    );
  });
});

describe("updateInputToRow", () => {
  it("emits a sparse payload for a single-field update and injects last_saved_at", () => {
    const payload = updateInputToRow({ basePriceMinor: 1200 });
    expect(payload.base_price_minor).toBe(1200);
    expect(typeof payload.last_saved_at).toBe("string");

    const keys = Object.keys(payload).sort();
    expect(keys).toEqual(["base_price_minor", "last_saved_at"]);
  });

  it("throws validation_error on an empty input", () => {
    expect(() => updateInputToRow({})).toThrowError(RepositoryError);
  });

  it("rejects invalid serviceRadiusKm (0)", () => {
    expect(() =>
      updateInputToRow({ serviceRadiusKm: 0 }),
    ).toThrowError(RepositoryError);
  });
});
