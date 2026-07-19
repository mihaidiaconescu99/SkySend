import { validateCoordinates } from "@/lib/repositories/mappers/address-mapper";
import {
  RepositoryError,
  type DBRow,
  type DBUpdate,
} from "@/lib/repositories/types";
import type {
  OperationalSettings,
  UpdateOperationalSettingsInput,
} from "@/types/operational-settings";

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

function requirePositiveNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new RepositoryError(
      "validation_error",
      `"${fieldName}" must be a finite number > 0; got ${value}.`,
      { details: { fieldName, value } },
    );
  }
  return value;
}

function requireNonNegativeInteger(
  value: unknown,
  fieldName: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new RepositoryError(
      "validation_error",
      `"${fieldName}" must be a non-negative integer; got ${value}.`,
      { details: { fieldName, value } },
    );
  }
  return value;
}

function requirePositiveInteger(
  value: unknown,
  fieldName: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new RepositoryError(
      "validation_error",
      `"${fieldName}" must be a positive integer (>= 1); got ${value}.`,
      { details: { fieldName, value } },
    );
  }
  return value;
}

export function rowToSettings(
  row: DBRow<"operational_settings">,
): OperationalSettings {
  validateCoordinates(row.hub_latitude, row.hub_longitude);

  return {
    id: requireString(row.id, "id"),
    isActive: row.is_active === true,
    serviceRadiusKm: requirePositiveNumber(
      row.service_radius_km,
      "service_radius_km",
    ),
    basePriceMinor: requireNonNegativeInteger(
      row.base_price_minor,
      "base_price_minor",
    ),
    pricePerKmMinor: requireNonNegativeInteger(
      row.price_per_km_minor,
      "price_per_km_minor",
    ),
    confirmationTimerMinutes: requirePositiveInteger(
      row.confirmation_timer_minutes,
      "confirmation_timer_minutes",
    ),
    loadingTimerMinutes: requirePositiveInteger(
      row.loading_timer_minutes,
      "loading_timer_minutes",
    ),
    unloadingTimerMinutes: requirePositiveInteger(
      row.unloading_timer_minutes,
      "unloading_timer_minutes",
    ),
    hubLatitude: row.hub_latitude,
    hubLongitude: row.hub_longitude,
    lastSavedAt: requireString(row.last_saved_at, "last_saved_at"),
    lastSavedBy: row.last_saved_by ?? null,
    createdAt: requireString(row.created_at, "created_at"),
    updatedAt: requireString(row.updated_at, "updated_at"),
  };
}

export function updateInputToRow(
  input: UpdateOperationalSettingsInput,
): DBUpdate<"operational_settings"> {
  const payload: DBUpdate<"operational_settings"> = {};

  if (input.isActive !== undefined) {
    payload.is_active = input.isActive;
  }
  if (input.serviceRadiusKm !== undefined) {
    payload.service_radius_km = requirePositiveNumber(
      input.serviceRadiusKm,
      "serviceRadiusKm",
    );
  }
  if (input.basePriceMinor !== undefined) {
    payload.base_price_minor = requireNonNegativeInteger(
      input.basePriceMinor,
      "basePriceMinor",
    );
  }
  if (input.pricePerKmMinor !== undefined) {
    payload.price_per_km_minor = requireNonNegativeInteger(
      input.pricePerKmMinor,
      "pricePerKmMinor",
    );
  }
  if (input.confirmationTimerMinutes !== undefined) {
    payload.confirmation_timer_minutes = requirePositiveInteger(
      input.confirmationTimerMinutes,
      "confirmationTimerMinutes",
    );
  }
  if (input.loadingTimerMinutes !== undefined) {
    payload.loading_timer_minutes = requirePositiveInteger(
      input.loadingTimerMinutes,
      "loadingTimerMinutes",
    );
  }
  if (input.unloadingTimerMinutes !== undefined) {
    payload.unloading_timer_minutes = requirePositiveInteger(
      input.unloadingTimerMinutes,
      "unloadingTimerMinutes",
    );
  }
  if (input.hubLatitude !== undefined) {
    validateCoordinates(input.hubLatitude, 0);
    payload.hub_latitude = input.hubLatitude;
  }
  if (input.hubLongitude !== undefined) {
    validateCoordinates(0, input.hubLongitude);
    payload.hub_longitude = input.hubLongitude;
  }
  if (input.lastSavedBy !== undefined) {
    payload.last_saved_by = input.lastSavedBy;
  }

  if (Object.keys(payload).length === 0) {
    throw new RepositoryError(
      "validation_error",
      "Update payload contains no recognised fields.",
    );
  }

  payload.last_saved_at = new Date().toISOString();

  return payload;
}
