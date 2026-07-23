import type { OperationalPlatformStatus, OperationalSettings } from "@/types/admin";

export type PlatformStatus = OperationalPlatformStatus;

export type OperationalSettingsFormState = {
  serviceRadiusKm: string;
  hubAddress: string;
  basePriceRon: string;
  pricePerKmRon: string;
  meetingPointConfirmationMinutes: string;
  parcelLoadMinutes: string;
  parcelUnloadMinutes: string;
  platformStatus: PlatformStatus;
};

export type OperationalSettingsValidationErrors = Partial<
  Record<keyof OperationalSettingsFormState, string>
>;

export type OperationalSettingsSaveResult =
  | {
      ok: true;
      settings: OperationalSettings;
      persistence: "persisted";
    }
  | {
      ok: false;
      reason: "validation_error" | "storage_unavailable";
      errors: OperationalSettingsValidationErrors;
    };

