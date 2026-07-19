import {
  RepositoryError,
  type DBInsert,
  type DBRow,
  type DBUpdate,
} from "@/lib/repositories/types";
import type {
  Address,
  CreateAddressInput,
  UpdateAddressInput,
} from "@/types/address";

const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;

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

export function validateCoordinates(
  lat: unknown,
  lng: unknown,
): { lat: number; lng: number } {
  if (typeof lat !== "number" || !Number.isFinite(lat)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid latitude: expected finite number, got ${typeof lat}.`,
      { details: { lat } },
    );
  }
  if (typeof lng !== "number" || !Number.isFinite(lng)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid longitude: expected finite number, got ${typeof lng}.`,
      { details: { lng } },
    );
  }
  if (lat < LATITUDE_MIN || lat > LATITUDE_MAX) {
    throw new RepositoryError(
      "validation_error",
      `Latitude out of range (${LATITUDE_MIN}..${LATITUDE_MAX}): ${lat}.`,
      { details: { lat } },
    );
  }
  if (lng < LONGITUDE_MIN || lng > LONGITUDE_MAX) {
    throw new RepositoryError(
      "validation_error",
      `Longitude out of range (${LONGITUDE_MIN}..${LONGITUDE_MAX}): ${lng}.`,
      { details: { lng } },
    );
  }
  return { lat, lng };
}

export function rowToAddress(row: DBRow<"addresses">): Address {
  const { lat, lng } = validateCoordinates(row.latitude, row.longitude);
  const createdAt = requireString(row.created_at, "created_at");

  return {
    id: requireString(row.id, "id"),
    profileId: row.profile_id ?? null,
    label: row.label ?? null,
    formattedAddress: requireString(row.formatted_address, "formatted_address"),
    city: row.city ?? null,
    county: row.county ?? null,
    country: row.country ?? null,
    postalCode: row.postal_code ?? null,
    latitude: lat,
    longitude: lng,
    isSaved: row.is_saved ?? false,
    usageCount:
      typeof row.usage_count === "number" && row.usage_count > 0
        ? row.usage_count
        : 1,
    lastUsedAt: row.last_used_at ?? createdAt,
    createdAt,
  };
}

export function createInputToRow(
  input: CreateAddressInput,
): DBInsert<"addresses"> {
  const formattedAddress = requireString(
    input.formattedAddress,
    "formattedAddress",
  );
  const { lat, lng } = validateCoordinates(input.latitude, input.longitude);

  const row: DBInsert<"addresses"> = {
    formatted_address: formattedAddress,
    latitude: lat,
    longitude: lng,
    is_saved: input.isSaved ?? false,
  };

  if (input.profileId !== undefined) {
    row.profile_id = input.profileId;
  }
  if (input.label !== undefined) {
    row.label = input.label;
  }
  if (input.city !== undefined) {
    row.city = input.city;
  }
  if (input.county !== undefined) {
    row.county = input.county;
  }
  if (input.country !== undefined) {
    row.country = input.country;
  }
  if (input.postalCode !== undefined) {
    row.postal_code = input.postalCode;
  }

  return row;
}

export function updateInputToRow(
  input: UpdateAddressInput,
): DBUpdate<"addresses"> {
  const payload: DBUpdate<"addresses"> = {};

  if (input.label !== undefined) {
    payload.label = input.label;
  }
  if (input.formattedAddress !== undefined) {
    payload.formatted_address = requireString(
      input.formattedAddress,
      "formattedAddress",
    );
  }
  if (input.city !== undefined) payload.city = input.city;
  if (input.county !== undefined) payload.county = input.county;
  if (input.country !== undefined) payload.country = input.country;
  if (input.postalCode !== undefined) payload.postal_code = input.postalCode;

  if (input.latitude !== undefined) {

    validateCoordinates(input.latitude, 0);
    payload.latitude = input.latitude;
  }
  if (input.longitude !== undefined) {
    validateCoordinates(0, input.longitude);
    payload.longitude = input.longitude;
  }
  if (input.isSaved !== undefined) payload.is_saved = input.isSaved;
  if (input.usageCount !== undefined) {
    if (
      typeof input.usageCount !== "number" ||
      !Number.isFinite(input.usageCount) ||
      input.usageCount < 0
    ) {
      throw new RepositoryError(
        "validation_error",
        `Invalid usageCount: ${input.usageCount}.`,
      );
    }
    payload.usage_count = input.usageCount;
  }
  if (input.lastUsedAt !== undefined) {
    payload.last_used_at = requireString(input.lastUsedAt, "lastUsedAt");
  }

  if (Object.keys(payload).length === 0) {
    throw new RepositoryError(
      "validation_error",
      "Update payload contains no recognised fields.",
    );
  }

  return payload;
}
