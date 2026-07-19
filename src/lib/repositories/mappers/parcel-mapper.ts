

import {
  RepositoryError,
  type DBInsert,
  type DBRow,
  type DBUpdate,
} from "@/lib/repositories/types";
import type { Json } from "@/types/database";
import type { ParcelDimensions } from "@/types/drone";
import type {
  CreateParcelInput,
  Parcel,
  SecurityModule,
  ThermalProtection,
  UpdateParcelInput,
} from "@/types/parcel";

const THERMAL_DB_TO_DOMAIN: Record<string, ThermalProtection> = {
  none: "none",
  passive: "passive_insulated",
  active: "active_thermal",
};

const THERMAL_DOMAIN_TO_DB: Record<ThermalProtection, string> = {
  none: "none",
  passive_insulated: "passive",
  active_thermal: "active",
};

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RepositoryError(
      "validation_error",
      `Missing or invalid "${fieldName}".`,
      { details: { fieldName, value } },
    );
  }
  return value;
}

function thermalDbToDomain(raw: unknown): ThermalProtection {
  if (typeof raw === "string" && raw in THERMAL_DB_TO_DOMAIN) {
    return THERMAL_DB_TO_DOMAIN[raw];
  }

  return "none";
}

export function parseDimensions(value: unknown): ParcelDimensions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const l = obj.lengthCm;
  const w = obj.widthCm;
  const h = obj.heightCm;
  if (
    typeof l !== "number" ||
    typeof w !== "number" ||
    typeof h !== "number" ||
    !Number.isFinite(l) ||
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    l <= 0 ||
    w <= 0 ||
    h <= 0
  ) {
    return null;
  }
  return { lengthCm: l, widthCm: w, heightCm: h };
}

export function rowToParcel(row: DBRow<"parcels">): Parcel {
  return {
    id: requireString(row.id, "id"),
    contentsDescription: requireString(
      row.contents_description,
      "contents_description",
    ),
    fragilityLevel:
      (row.fragility_level as Parcel["fragilityLevel"]) ?? "low",
    packagingType:
      (row.packaging_type as Parcel["packagingType"]) ?? null,
    securityModule:
      (row.security_module as SecurityModule | undefined) ?? "standard",
    thermalProtection: thermalDbToDomain(row.thermal_protection),
    approximateSize:
      (row.approximate_size as Parcel["approximateSize"]) ?? null,
    declaredDimensionsCm: parseDimensions(row.declared_dimensions_cm),
    declaredWeightKg: row.declared_weight_kg ?? null,
    estimatedWeightRange: row.estimated_weight_range ?? null,
    createdAt: requireString(row.created_at, "created_at"),
  };
}

export function createInputToRow(
  input: CreateParcelInput,
): DBInsert<"parcels"> {
  const row: DBInsert<"parcels"> = {
    contents_description: requireString(
      input.contentsDescription,
      "contentsDescription",
    ),
  };

  if (input.fragilityLevel !== undefined) {
    row.fragility_level = input.fragilityLevel;
  }
  if (input.packagingType !== undefined) {
    row.packaging_type = input.packagingType;
  }
  if (input.securityModule !== undefined) {
    row.security_module = input.securityModule;
  }
  if (input.thermalProtection !== undefined) {
    row.thermal_protection = THERMAL_DOMAIN_TO_DB[input.thermalProtection];
  }
  if (input.approximateSize !== undefined) {
    row.approximate_size = input.approximateSize;
  }
  if (input.declaredDimensionsCm !== undefined) {
    row.declared_dimensions_cm =
      input.declaredDimensionsCm as unknown as Json;
  }
  if (input.declaredWeightKg !== undefined) {
    row.declared_weight_kg = input.declaredWeightKg;
  }
  if (input.estimatedWeightRange !== undefined) {
    row.estimated_weight_range = input.estimatedWeightRange;
  }

  return row;
}

export function updateInputToRow(
  input: UpdateParcelInput,
): DBUpdate<"parcels"> {
  const payload: DBUpdate<"parcels"> = {};

  if (input.contentsDescription !== undefined) {
    payload.contents_description = requireString(
      input.contentsDescription,
      "contentsDescription",
    );
  }
  if (input.fragilityLevel !== undefined) {
    payload.fragility_level = input.fragilityLevel;
  }
  if (input.packagingType !== undefined) {
    payload.packaging_type = input.packagingType;
  }
  if (input.securityModule !== undefined) {
    payload.security_module = input.securityModule;
  }
  if (input.thermalProtection !== undefined) {
    payload.thermal_protection = THERMAL_DOMAIN_TO_DB[input.thermalProtection];
  }
  if (input.approximateSize !== undefined) {
    payload.approximate_size = input.approximateSize;
  }
  if (input.declaredDimensionsCm !== undefined) {
    payload.declared_dimensions_cm =
      input.declaredDimensionsCm as unknown as Json;
  }
  if (input.declaredWeightKg !== undefined) {
    payload.declared_weight_kg = input.declaredWeightKg;
  }
  if (input.estimatedWeightRange !== undefined) {
    payload.estimated_weight_range = input.estimatedWeightRange;
  }

  if (Object.keys(payload).length === 0) {
    throw new RepositoryError(
      "validation_error",
      "Update payload contains no recognised fields.",
    );
  }

  return payload;
}
