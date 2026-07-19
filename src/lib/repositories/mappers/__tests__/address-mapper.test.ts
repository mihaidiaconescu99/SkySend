import { describe, expect, it } from "vitest";

import {
  createInputToRow,
  rowToAddress,
  updateInputToRow,
  validateCoordinates,
} from "@/lib/repositories/mappers/address-mapper";
import { RepositoryError, type DBRow } from "@/lib/repositories/types";

function buildAddressRow(
  overrides: Partial<DBRow<"addresses">> = {},
): DBRow<"addresses"> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    profile_id: "00000000-0000-0000-0000-000000000999",
    label: "Acasă",
    formatted_address: "Strada Republicii 1, Pitești",
    city: "Pitești",
    county: "Argeș",
    country: "România",
    postal_code: "110014",
    latitude: 44.8565,
    longitude: 24.8692,
    is_saved: true,
    usage_count: 3,
    last_used_at: "2026-05-23T12:00:00Z",
    created_at: "2026-05-20T10:00:00Z",
    updated_at: "2026-05-23T12:00:00Z",
    ...overrides,
  };
}

describe("rowToAddress", () => {
  it("maps every column for a fully populated row", () => {
    const row = buildAddressRow();
    const address = rowToAddress(row);

    expect(address).toEqual({
      id: row.id,
      profileId: row.profile_id,
      label: "Acasă",
      formattedAddress: row.formatted_address,
      city: "Pitești",
      county: "Argeș",
      country: "România",
      postalCode: "110014",
      latitude: 44.8565,
      longitude: 24.8692,
      isSaved: true,
      usageCount: 3,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
    });
  });

  it("maps profile_id null to profileId null (anonymous address)", () => {
    const result = rowToAddress(buildAddressRow({ profile_id: null }));
    expect(result.profileId).toBeNull();
  });

  it("rejects latitude outside the WGS-84 range", () => {
    expect(() =>
      rowToAddress(buildAddressRow({ latitude: 91 })),
    ).toThrowError(RepositoryError);
  });

  it("rejects longitude outside the WGS-84 range", () => {
    expect(() =>
      rowToAddress(buildAddressRow({ longitude: -181 })),
    ).toThrowError(RepositoryError);
  });

  it("defaults usageCount to 1 when usage_count is null or non-positive", () => {
    expect(
      rowToAddress(buildAddressRow({ usage_count: null as unknown as never }))
        .usageCount,
    ).toBe(1);
    expect(
      rowToAddress(buildAddressRow({ usage_count: 0 })).usageCount,
    ).toBe(1);
  });

  it("falls back lastUsedAt to createdAt when last_used_at is null", () => {
    const result = rowToAddress(
      buildAddressRow({
        created_at: "2026-04-01T00:00:00Z",
        last_used_at: null as unknown as never,
      }),
    );
    expect(result.lastUsedAt).toBe("2026-04-01T00:00:00Z");
  });

  it("keeps label as null when stored as null", () => {
    expect(rowToAddress(buildAddressRow({ label: null })).label).toBeNull();
  });

  it("maps is_saved=false to isSaved=false", () => {
    expect(rowToAddress(buildAddressRow({ is_saved: false })).isSaved).toBe(
      false,
    );
  });

  it("maps is_saved=true to isSaved=true", () => {
    expect(rowToAddress(buildAddressRow({ is_saved: true })).isSaved).toBe(
      true,
    );
  });
});

describe("createInputToRow", () => {
  it("emits a row with defaults for a minimal input", () => {
    const row = createInputToRow({
      formattedAddress: "Test 1",
      latitude: 44.85,
      longitude: 24.87,
    });
    expect(row).toEqual({
      formatted_address: "Test 1",
      latitude: 44.85,
      longitude: 24.87,
      is_saved: false,
    });
  });

  it("preserves an explicit profile_id null (anonymous)", () => {
    const row = createInputToRow({
      formattedAddress: "Anon",
      latitude: 0,
      longitude: 0,
      profileId: null,
    });
    expect(row.profile_id).toBeNull();
  });

  it("omits profile_id from the payload when not provided", () => {
    const row = createInputToRow({
      formattedAddress: "No profile",
      latitude: 0,
      longitude: 0,
    });
    expect("profile_id" in row).toBe(false);
  });

  it("respects an explicit isSaved=true", () => {
    const row = createInputToRow({
      formattedAddress: "Saved",
      latitude: 0,
      longitude: 0,
      isSaved: true,
    });
    expect(row.is_saved).toBe(true);
  });

  it("throws when formattedAddress is empty", () => {
    expect(() =>
      createInputToRow({
        formattedAddress: "",
        latitude: 0,
        longitude: 0,
      }),
    ).toThrowError(RepositoryError);
  });

  it("throws when latitude is undefined", () => {
    expect(() =>
      createInputToRow({
        formattedAddress: "X",
        latitude: undefined as unknown as number,
        longitude: 0,
      }),
    ).toThrowError(RepositoryError);
  });

  it("throws when longitude is undefined", () => {
    expect(() =>
      createInputToRow({
        formattedAddress: "X",
        latitude: 0,
        longitude: undefined as unknown as number,
      }),
    ).toThrowError(RepositoryError);
  });
});

describe("updateInputToRow", () => {
  it("emits a sparse payload with only the label key when only label changes", () => {
    expect(updateInputToRow({ label: "Birou" })).toEqual({ label: "Birou" });
  });

  it("throws validation_error for an empty input", () => {
    expect(() => updateInputToRow({})).toThrowError(RepositoryError);
  });

  it("preserves usageCount updates", () => {
    expect(updateInputToRow({ usageCount: 7 }).usage_count).toBe(7);
  });

  it("preserves isSaved=false (clears the saved flag)", () => {
    expect(updateInputToRow({ isSaved: false }).is_saved).toBe(false);
  });

  it("rejects invalid latitude on update", () => {
    expect(() =>
      updateInputToRow({ latitude: 91 }),
    ).toThrowError(RepositoryError);
  });
});

describe("validateCoordinates", () => {
  it("accepts a typical Pitești coordinate", () => {
    expect(validateCoordinates(44.85, 24.87)).toEqual({ lat: 44.85, lng: 24.87 });
  });

  it("accepts the origin (0, 0)", () => {
    expect(validateCoordinates(0, 0)).toEqual({ lat: 0, lng: 0 });
  });

  it("accepts the SW corner of the WGS-84 grid (-90, -180)", () => {
    expect(validateCoordinates(-90, -180)).toEqual({ lat: -90, lng: -180 });
  });

  it("accepts the NE corner of the WGS-84 grid (90, 180)", () => {
    expect(validateCoordinates(90, 180)).toEqual({ lat: 90, lng: 180 });
  });

  it("rejects latitude > 90", () => {
    expect(() => validateCoordinates(91, 0)).toThrowError(RepositoryError);
  });

  it("rejects a null latitude", () => {
    expect(() => validateCoordinates(null, 0)).toThrowError(RepositoryError);
  });

  it("rejects stringified latitude (strict number check)", () => {
    expect(() => validateCoordinates("44.85", 0)).toThrowError(RepositoryError);
  });
});
