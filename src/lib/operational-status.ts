import type {
  EffectivePlatformStatus,
  ManualPlatformStatus,
  OperationalStatusSnapshot,
  WeatherLevel,
} from "@/types/operational-status";

export function resolveEffectivePlatformStatus(input: {
  manualStatus: ManualPlatformStatus;
  weatherLevel: WeatherLevel | null;
  overrideExpiresAt: string | null;
  overrideCancelledAt?: string | null;
  now?: Date;
}): EffectivePlatformStatus {
  if (input.manualStatus === "maintenance") return "maintenance";
  const now = input.now ?? new Date();
  const overrideActive =
    !input.overrideCancelledAt &&
    Boolean(input.overrideExpiresAt) &&
    Date.parse(input.overrideExpiresAt!) > now.getTime();
  if (overrideActive) return "active";
  return input.weatherLevel === "suspended" ? "suspended" : "active";
}

export function isOrderPlacementAvailable(snapshot: OperationalStatusSnapshot) {
  return snapshot.effectiveStatus === "active";
}

