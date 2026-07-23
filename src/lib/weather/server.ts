import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  aggregateCurrentArea,
  classifyWeatherPoint,
  combineCurrentAndForecast,
} from "@/lib/weather/classification";
import { getOperationalStatusSnapshot } from "@/lib/operational-status-server";
import type { Database } from "@/types/database";
import type { WeatherPointMetrics } from "@/types/operational-status";

const pointIds = ["hub", "north", "east", "south", "west"] as const;
const db = (supabase: SupabaseClient<Database>) => supabase as any;

export function createWeatherSamplingPoints(
  latitude: number,
  longitude: number,
  radiusKm: number,
) {
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.cos((latitude * Math.PI) / 180));
  return [
    { id: "hub" as const, latitude, longitude },
    { id: "north" as const, latitude: latitude + latDelta, longitude },
    { id: "east" as const, latitude, longitude: longitude + lonDelta },
    { id: "south" as const, latitude: latitude - latDelta, longitude },
    { id: "west" as const, latitude, longitude: longitude - lonDelta },
  ];
}

function finite(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function pointFromResponse(
  response: any,
  point: ReturnType<typeof createWeatherSamplingPoints>[number],
  hourIndex: number | null,
): WeatherPointMetrics {
  const source = hourIndex === null ? response.current ?? {} : Object.fromEntries(
    Object.entries(response.hourly ?? {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[hourIndex] : value,
    ]),
  );
  return classifyWeatherPoint({
    id: point.id,
    latitude: point.latitude,
    longitude: point.longitude,
    weatherCode: finite(source.weather_code),
    windSpeedKmh: finite(source.wind_speed_10m),
    windGustKmh: finite(source.wind_gusts_10m),
    precipitationMm: finite(source.precipitation),
    snowfallCm: finite(source.snowfall),
    visibilityM: finite(source.visibility, 100_000),
  });
}

export async function evaluateAndPersistWeather(
  supabase: SupabaseClient<Database> = createAdminSupabaseClient(),
  now = new Date(),
) {
  const database = db(supabase);
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  const hourIso = hour.toISOString();
  const { data: existing } = await database
    .from("weather_runtime_state")
    .select("evaluated_hour")
    .eq("id", "default")
    .maybeSingle();
  if (existing?.evaluated_hour === hourIso) return { skipped: true };

  await database.from("weather_runtime_state").update({
    last_attempt_at: now.toISOString(),
    evaluated_hour: hourIso,
  }).eq("id", "default");

  try {
    const operational = await getOperationalStatusSnapshot(supabase, now);
    const points = createWeatherSamplingPoints(
      operational.hub.latitude,
      operational.hub.longitude,
      operational.serviceRadiusKm,
    );
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", points.map((point) => point.latitude.toFixed(5)).join(","));
    url.searchParams.set("longitude", points.map((point) => point.longitude.toFixed(5)).join(","));
    const variables = "weather_code,wind_speed_10m,wind_gusts_10m,precipitation,snowfall,visibility";
    url.searchParams.set("current", variables);
    url.searchParams.set("hourly", variables);
    url.searchParams.set("forecast_hours", "3");
    url.searchParams.set("wind_speed_unit", "kmh");
    url.searchParams.set("timezone", "UTC");
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`open_meteo_http_${response.status}`);
    const payload = await response.json();
    const responses = Array.isArray(payload) ? payload : [payload];
    if (responses.length !== points.length) throw new Error("open_meteo_incomplete_points");

    const currentPoints = responses.map((item, index) => pointFromResponse(item, points[index], null));
    const forecasts = [1, 2].map((hourIndex) =>
      aggregateCurrentArea(
        responses.map((item, index) => pointFromResponse(item, points[index], hourIndex)),
      ),
    );
    const result = combineCurrentAndForecast(aggregateCurrentArea(currentPoints), forecasts);
    const observedAt = responses[0]?.current?.time ?? now.toISOString();
    await database.from("weather_runtime_state").update({
      level: result.level,
      reason_codes: result.reasonCodes,
      metrics: { currentPoints, forecasts, thresholdsVersion: 1 },
      source_observed_at: observedAt,
      last_valid_at: now.toISOString(),
      check_status: "success",
      last_error: null,
    }).eq("id", "default");
    return { skipped: false, level: result.level, reasonCodes: result.reasonCodes };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 160) : "weather_check_failed";
    await database.from("weather_runtime_state").update({
      check_status: "failed",
      last_error: message,
    }).eq("id", "default");
    return { skipped: false, error: message };
  }
}

export { pointIds };

