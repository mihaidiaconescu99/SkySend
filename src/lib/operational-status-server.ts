import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resolveEffectivePlatformStatus } from "@/lib/operational-status";
import type { Database } from "@/types/database";
import type {
  ManualPlatformStatus,
  OperationalStatusSnapshot,
  WeatherLevel,
} from "@/types/operational-status";

const db = (supabase: SupabaseClient<Database>) => supabase as any;

export async function getOperationalStatusSnapshot(
  supabase: SupabaseClient<Database> = createAdminSupabaseClient(),
  now = new Date(),
): Promise<OperationalStatusSnapshot> {
  const database = db(supabase);
  const [{ data: settings }, { data: weather }, { data: override }] =
    await Promise.all([
      database.from("operational_settings").select("*").limit(1).maybeSingle(),
      database.from("weather_runtime_state").select("*").eq("id", "default").maybeSingle(),
      database.from("platform_override_state").select("*").eq("id", "default").maybeSingle(),
    ]);

  const manualStatus: ManualPlatformStatus =
    settings?.manual_status === "maintenance" || settings?.is_active === false
      ? "maintenance"
      : "active";
  const weatherLevel =
    weather?.level === "safe" || weather?.level === "warning" || weather?.level === "suspended"
      ? (weather.level as WeatherLevel)
      : null;
  const effectiveStatus = resolveEffectivePlatformStatus({
    manualStatus,
    weatherLevel,
    overrideExpiresAt: override?.expires_at ?? null,
    overrideCancelledAt: override?.cancelled_at ?? null,
    now,
  });

  return {
    manualStatus,
    effectiveStatus,
    weather: {
      level: weatherLevel,
      reasonCodes: Array.isArray(weather?.reason_codes) ? weather.reason_codes : [],
      metrics: weather?.metrics && typeof weather.metrics === "object" ? weather.metrics : {},
      sourceObservedAt: weather?.source_observed_at ?? null,
      lastAttemptAt: weather?.last_attempt_at ?? null,
      lastValidAt: weather?.last_valid_at ?? null,
      checkStatus:
        weather?.check_status === "success" || weather?.check_status === "failed"
          ? weather.check_status
          : "never",
      lastError: weather?.last_error ?? null,
    },
    override: {
      active:
        !override?.cancelled_at &&
        Boolean(override?.expires_at) &&
        Date.parse(override.expires_at) > now.getTime(),
      startedAt: override?.started_at ?? null,
      expiresAt: override?.expires_at ?? null,
      actorProfileId: override?.created_by ?? null,
      cancelledAt: override?.cancelled_at ?? null,
    },
    serviceRadiusKm: Number(settings?.service_radius_km ?? 6),
    hub: {
      latitude: Number(settings?.hub_latitude ?? 44.8565),
      longitude: Number(settings?.hub_longitude ?? 24.8692),
    },
  };
}

export async function assertOperationsAvailable(
  supabase: SupabaseClient<Database> = createAdminSupabaseClient(),
) {
  const snapshot = await getOperationalStatusSnapshot(supabase);
  if (snapshot.effectiveStatus !== "active") {
    const error = new Error(`operations_${snapshot.effectiveStatus}`);
    error.name = "OperationalAvailabilityError";
    throw error;
  }
  return snapshot;
}
