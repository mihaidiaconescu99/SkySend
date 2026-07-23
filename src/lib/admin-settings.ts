import {
  defaultOperationalSettings,
  operationalPlatformStatusLabels,
  readOperationalSettings,
} from "@/lib/admin-data";
import type { OperationalSettings } from "@/types/admin";
import type {
  OperationalSettingsFormState,
  OperationalSettingsSaveResult,
  OperationalSettingsValidationErrors,
  PlatformStatus,
} from "@/types/admin-settings";

export const platformStatusOptions = Object.entries(
  operationalPlatformStatusLabels,
) as [PlatformStatus, string][];

function formatRon(valueMinor: number) {
  return (valueMinor / 100).toFixed(2);
}

function parsePositiveNumber(value: string) {
  const normalizedValue = value.replace(",", ".").trim();
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toMinor(value: number) {
  return Math.round(value * 100);
}

export function getAdminOperationalSettings() {
  return readOperationalSettings();
}

export function settingsToFormState(
  settings: OperationalSettings,
): OperationalSettingsFormState {
  return {
    serviceRadiusKm: String(settings.serviceRadiusKm),
    hubAddress: settings.hubAddress.formattedAddress,
    basePriceRon: formatRon(settings.basePrice.amountMinor),
    pricePerKmRon: formatRon(settings.pricePerKm.amountMinor),
    meetingPointConfirmationMinutes: String(
      settings.timeouts.meetingPointConfirmationMinutes,
    ),
    parcelLoadMinutes: String(settings.timeouts.parcelLoadMinutes),
    parcelUnloadMinutes: String(settings.timeouts.parcelUnloadMinutes),
    platformStatus: settings.platformStatus,
  };
}

export function getDefaultOperationalSettingsFormState() {
  return settingsToFormState(defaultOperationalSettings);
}

function validateFormState(form: OperationalSettingsFormState) {
  const errors: OperationalSettingsValidationErrors = {};
  const serviceRadiusKm = parsePositiveNumber(form.serviceRadiusKm);
  const basePriceRon = parsePositiveNumber(form.basePriceRon);
  const pricePerKmRon = parsePositiveNumber(form.pricePerKmRon);
  const meetingPointConfirmationMinutes = parsePositiveNumber(
    form.meetingPointConfirmationMinutes,
  );
  const parcelLoadMinutes = parsePositiveNumber(form.parcelLoadMinutes);
  const parcelUnloadMinutes = parsePositiveNumber(form.parcelUnloadMinutes);

  if (serviceRadiusKm === null || serviceRadiusKm <= 0 || serviceRadiusKm > 50) {
    errors.serviceRadiusKm = "Raza trebuie sa fie intre 0 si 50 km.";
  }

  if (basePriceRon === null || basePriceRon < 0 || basePriceRon > 10000) {
    errors.basePriceRon = "Pretul de baza trebuie sa fie intre 0 si 10000 RON.";
  }

  if (pricePerKmRon === null || pricePerKmRon < 0 || pricePerKmRon > 10000) {
    errors.pricePerKmRon = "Pretul pe km trebuie sa fie intre 0 si 10000 RON.";
  }

  if (
    meetingPointConfirmationMinutes === null ||
    meetingPointConfirmationMinutes < 1 ||
    meetingPointConfirmationMinutes > 60
  ) {
    errors.meetingPointConfirmationMinutes =
      "Timpul pentru confirmare trebuie sa fie intre 1 si 60 minute.";
  }

  if (parcelLoadMinutes === null || parcelLoadMinutes < 1 || parcelLoadMinutes > 60) {
    errors.parcelLoadMinutes =
      "Timpul pentru incarcare trebuie sa fie intre 1 si 60 minute.";
  }

  if (
    parcelUnloadMinutes === null ||
    parcelUnloadMinutes < 1 ||
    parcelUnloadMinutes > 60
  ) {
    errors.parcelUnloadMinutes =
      "Timpul pentru descarcare trebuie sa fie intre 1 si 60 minute.";
  }

  if (!(form.platformStatus in operationalPlatformStatusLabels)) {
    errors.platformStatus = "Statusul platformei nu este valid.";
  }

  return {
    errors,
    parsed: {
      serviceRadiusKm: serviceRadiusKm ?? 0,
      basePriceRon: basePriceRon ?? 0,
      pricePerKmRon: pricePerKmRon ?? 0,
      meetingPointConfirmationMinutes: meetingPointConfirmationMinutes ?? 0,
      parcelLoadMinutes: parcelLoadMinutes ?? 0,
      parcelUnloadMinutes: parcelUnloadMinutes ?? 0,
    },
  };
}

export function saveAdminOperationalSettings(
  form: OperationalSettingsFormState,
): OperationalSettingsSaveResult {
  const { errors, parsed } = validateFormState(form);

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      reason: "validation_error",
      errors,
    };
  }

  const currentSettings = readOperationalSettings();
  const hubAddress =
    form.hubAddress.trim() || currentSettings.hubAddress.formattedAddress;
  const updatedSettings: OperationalSettings = {
      ...currentSettings,
      serviceRadiusKm: parsed.serviceRadiusKm,
      hubAddress: {
        ...currentSettings.hubAddress,
        formattedAddress: hubAddress,
      },
      basePrice: {
        amountMinor: toMinor(parsed.basePriceRon),
        currency: "RON",
      },
      pricePerKm: {
        amountMinor: toMinor(parsed.pricePerKmRon),
        currency: "RON",
      },
      timeouts: {
        meetingPointConfirmationMinutes: Math.round(
          parsed.meetingPointConfirmationMinutes,
        ),
        parcelLoadMinutes: Math.round(parsed.parcelLoadMinutes),
        parcelUnloadMinutes: Math.round(parsed.parcelUnloadMinutes),
      },
      platformStatus: form.platformStatus,
      platformStatusLabel: operationalPlatformStatusLabels[form.platformStatus],
      source: "supabase",
      persistence: "persisted",
      updatedAt: new Date().toISOString(),
    };

  return {
    ok: true,
    settings: updatedSettings,
    persistence: "persisted",
  };
}
