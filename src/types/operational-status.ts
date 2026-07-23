export type ManualPlatformStatus = "active" | "maintenance";
export type WeatherLevel = "safe" | "warning" | "suspended";
export type EffectivePlatformStatus = "active" | "maintenance" | "suspended";
export type WeatherCheckStatus = "never" | "success" | "failed";

export type WeatherPointMetrics = {
  id: "hub" | "north" | "east" | "south" | "west";
  latitude: number;
  longitude: number;
  weatherCode: number;
  windSpeedKmh: number;
  windGustKmh: number;
  windMetricKmh: number;
  precipitationMm: number;
  snowfallCm: number;
  visibilityM: number;
  level: WeatherLevel;
  reasonCodes: string[];
};

export type OperationalStatusSnapshot = {
  manualStatus: ManualPlatformStatus;
  effectiveStatus: EffectivePlatformStatus;
  weather: {
    level: WeatherLevel | null;
    reasonCodes: string[];
    metrics: Record<string, unknown>;
    sourceObservedAt: string | null;
    lastAttemptAt: string | null;
    lastValidAt: string | null;
    checkStatus: WeatherCheckStatus;
    lastError: string | null;
  };
  override: {
    active: boolean;
    startedAt: string | null;
    expiresAt: string | null;
    actorProfileId: string | null;
    cancelledAt: string | null;
  };
  serviceRadiusKm: number;
  hub: { latitude: number; longitude: number };
};
