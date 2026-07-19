import { describe, expect, it } from "vitest";

import {
  createInputToRow,
  parseDimensions,
  rowToParcel,
  updateInputToRow,
} from "@/lib/repositories/mappers/parcel-mapper";
import { RepositoryError, type DBRow } from "@/lib/repositories/types";

function buildRow(
  overrides: Partial<DBRow<"parcels">> = {},
): DBRow<"parcels"> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    contents_description: "Cărți tehnice",
    approximate_size: null,
    declared_dimensions_cm: null,
    declared_weight_kg: null,
    estimated_weight_range: null,
    fragility_level: "low",
    packaging_type: null,
    security_module: "standard",
    thermal_protection: "none",
    created_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

describe("rowToParcel", () => {
  it("maps all columns for a complete row", () => {
    const parcel = rowToParcel(
      buildRow({
        approximate_size: "medium",
        fragility_level: "high",
        packaging_type: "boxed",
        security_module: "secure",
        thermal_protection: "passive",
        declared_weight_kg: 1.5,
        estimated_weight_range: "1-2 kg",
        declared_dimensions_cm: { lengthCm: 30, widthCm: 20, heightCm: 10 } as never,
      }),
    );

    expect(parcel).toEqual({
      id: "00000000-0000-0000-0000-000000000001",
      contentsDescription: "Cărți tehnice",
      approximateSize: "medium",
      fragilityLevel: "high",
      packagingType: "boxed",
      securityModule: "secure",
      thermalProtection: "passive_insulated",
      declaredWeightKg: 1.5,
      estimatedWeightRange: "1-2 kg",
      declaredDimensionsCm: { lengthCm: 30, widthCm: 20, heightCm: 10 },
      createdAt: "2026-05-23T10:00:00Z",
    });
  });

  it("maps thermal_protection 'none' → 'none'", () => {
    expect(
      rowToParcel(buildRow({ thermal_protection: "none" })).thermalProtection,
    ).toBe("none");
  });

  it("maps thermal_protection 'passive' → 'passive_insulated'", () => {
    expect(
      rowToParcel(buildRow({ thermal_protection: "passive" }))
        .thermalProtection,
    ).toBe("passive_insulated");
  });

  it("maps thermal_protection 'active' → 'active_thermal'", () => {
    expect(
      rowToParcel(buildRow({ thermal_protection: "active" })).thermalProtection,
    ).toBe("active_thermal");
  });

  it("falls back to 'none' for an unrecognised thermal_protection value", () => {
    expect(
      rowToParcel(buildRow({ thermal_protection: "unknown_future_value" }))
        .thermalProtection,
    ).toBe("none");
  });

  it("parses valid declared_dimensions_cm JSONB", () => {
    const dims = rowToParcel(
      buildRow({
        declared_dimensions_cm: {
          lengthCm: 40,
          widthCm: 25,
          heightCm: 15,
        } as never,
      }),
    ).declaredDimensionsCm;
    expect(dims).toEqual({ lengthCm: 40, widthCm: 25, heightCm: 15 });
  });

  it("returns null for null declared_dimensions_cm", () => {
    expect(
      rowToParcel(buildRow({ declared_dimensions_cm: null }))
        .declaredDimensionsCm,
    ).toBeNull();
  });

  it("returns null for malformed declared_dimensions_cm (missing fields)", () => {
    expect(
      rowToParcel(buildRow({ declared_dimensions_cm: { lengthCm: 10 } as never }))
        .declaredDimensionsCm,
    ).toBeNull();
  });

  it("returns null for null packaging_type", () => {
    expect(
      rowToParcel(buildRow({ packaging_type: null })).packagingType,
    ).toBeNull();
  });

  it("returns null for null approximate_size", () => {
    expect(
      rowToParcel(buildRow({ approximate_size: null })).approximateSize,
    ).toBeNull();
  });

  it("returns null for null declared_weight_kg", () => {
    expect(
      rowToParcel(buildRow({ declared_weight_kg: null })).declaredWeightKg,
    ).toBeNull();
  });

  it("returns null for null estimated_weight_range", () => {
    expect(
      rowToParcel(buildRow({ estimated_weight_range: null }))
        .estimatedWeightRange,
    ).toBeNull();
  });

  it("throws validation_error on missing id", () => {
    expect(() => rowToParcel(buildRow({ id: "" }))).toThrowError(
      RepositoryError,
    );
  });

  it("throws validation_error on missing contents_description", () => {
    expect(() =>
      rowToParcel(buildRow({ contents_description: "" })),
    ).toThrowError(RepositoryError);
  });
});

describe("createInputToRow", () => {
  it("maps a minimal input (only contentsDescription)", () => {
    const row = createInputToRow({ contentsDescription: "Carte" });
    expect(row.contents_description).toBe("Carte");

    expect(row.thermal_protection).toBeUndefined();
    expect(row.fragility_level).toBeUndefined();
  });

  it("translates thermalProtection 'passive_insulated' → 'passive'", () => {
    const row = createInputToRow({
      contentsDescription: "Carne congelată",
      thermalProtection: "passive_insulated",
    });
    expect(row.thermal_protection).toBe("passive");
  });

  it("translates thermalProtection 'active_thermal' → 'active'", () => {
    const row = createInputToRow({
      contentsDescription: "Vaccin",
      thermalProtection: "active_thermal",
    });
    expect(row.thermal_protection).toBe("active");
  });

  it("translates thermalProtection 'none' → 'none'", () => {
    const row = createInputToRow({
      contentsDescription: "Documente",
      thermalProtection: "none",
    });
    expect(row.thermal_protection).toBe("none");
  });

  it("serialises declaredDimensionsCm as JSONB", () => {
    const row = createInputToRow({
      contentsDescription: "Cutie",
      declaredDimensionsCm: { lengthCm: 30, widthCm: 20, heightCm: 10 },
    });
    expect(row.declared_dimensions_cm).toEqual({
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    });
  });

  it("passes through all optional fields when provided", () => {
    const row = createInputToRow({
      contentsDescription: "Farmacie",
      fragilityLevel: "high",
      packagingType: "insulated",
      securityModule: "secure_plus",
      thermalProtection: "active_thermal",
      approximateSize: "small",
      declaredWeightKg: 0.8,
      estimatedWeightRange: "0.5-1 kg",
    });
    expect(row.fragility_level).toBe("high");
    expect(row.packaging_type).toBe("insulated");
    expect(row.security_module).toBe("secure_plus");
    expect(row.thermal_protection).toBe("active");
    expect(row.approximate_size).toBe("small");
    expect(row.declared_weight_kg).toBe(0.8);
    expect(row.estimated_weight_range).toBe("0.5-1 kg");
  });

  it("throws validation_error on empty contentsDescription", () => {
    expect(() => createInputToRow({ contentsDescription: "" })).toThrowError(
      RepositoryError,
    );
  });
});

describe("updateInputToRow", () => {
  it("builds a sparse payload with only provided fields", () => {
    const payload = updateInputToRow({ fragilityLevel: "moderate" });
    expect(payload).toEqual({ fragility_level: "moderate" });
  });

  it("translates thermalProtection on update", () => {
    const payload = updateInputToRow({
      thermalProtection: "passive_insulated",
    });
    expect(payload.thermal_protection).toBe("passive");
  });

  it("throws validation_error for empty update input", () => {
    expect(() => updateInputToRow({})).toThrowError(RepositoryError);
  });

  it("includes multiple fields when provided", () => {
    const payload = updateInputToRow({
      contentsDescription: "Nou",
      securityModule: "secure",
    });
    expect(payload.contents_description).toBe("Nou");
    expect(payload.security_module).toBe("secure");
    expect(Object.keys(payload)).toHaveLength(2);
  });
});

describe("parseDimensions", () => {
  it("parses a valid dimensions object", () => {
    expect(
      parseDimensions({ lengthCm: 30, widthCm: 20, heightCm: 10 }),
    ).toEqual({ lengthCm: 30, widthCm: 20, heightCm: 10 });
  });

  it("returns null for null", () => {
    expect(parseDimensions(null)).toBeNull();
  });

  it("returns null for a string", () => {
    expect(parseDimensions("30x20x10")).toBeNull();
  });

  it("returns null for an array", () => {
    expect(parseDimensions([30, 20, 10])).toBeNull();
  });

  it("returns null for a number", () => {
    expect(parseDimensions(42)).toBeNull();
  });

  it("returns null when a dimension field is missing", () => {
    expect(parseDimensions({ lengthCm: 30, widthCm: 20 })).toBeNull();
  });

  it("returns null when a dimension field is non-positive", () => {
    expect(
      parseDimensions({ lengthCm: 0, widthCm: 20, heightCm: 10 }),
    ).toBeNull();
    expect(
      parseDimensions({ lengthCm: 30, widthCm: -5, heightCm: 10 }),
    ).toBeNull();
  });

  it("returns null for non-finite values", () => {
    expect(
      parseDimensions({ lengthCm: Infinity, widthCm: 20, heightCm: 10 }),
    ).toBeNull();
  });
});
