import type { WeatherLevel, WeatherPointMetrics } from "@/types/operational-status";

export const WEATHER_THRESHOLDS = {
  warningWindKmh: 30,
  suspendedWindKmh: 50,
  lowVisibilityM: 1_500,
} as const;

const severeCodes = new Set([95, 96, 99]);
const warningCodes = new Set([45, 48, 56, 57, 65, 66, 67, 75, 82, 86]);

export function classifyWeatherPoint(input: Omit<WeatherPointMetrics, "level" | "reasonCodes" | "windMetricKmh">) {
  const windMetricKmh = Math.max(input.windSpeedKmh, input.windGustKmh);
  const reasonCodes: string[] = [];
  let level: WeatherLevel = "safe";

  if (severeCodes.has(input.weatherCode)) {
    level = "suspended";
    reasonCodes.push(input.weatherCode === 95 ? "thunderstorm" : "thunderstorm_hail");
  }
  if (windMetricKmh >= WEATHER_THRESHOLDS.suspendedWindKmh) {
    level = "suspended";
    reasonCodes.push("wind_suspended");
  } else if (windMetricKmh >= WEATHER_THRESHOLDS.warningWindKmh) {
    if (level === "safe") level = "warning";
    reasonCodes.push("wind_warning");
  }
  if (warningCodes.has(input.weatherCode)) {
    if (level === "safe") level = "warning";
    reasonCodes.push("difficult_weather");
  }
  if (input.visibilityM > 0 && input.visibilityM < WEATHER_THRESHOLDS.lowVisibilityM) {
    if (level === "safe") level = "warning";
    reasonCodes.push("low_visibility");
  }

  return { ...input, windMetricKmh, level, reasonCodes } satisfies WeatherPointMetrics;
}

export function aggregateCurrentArea(points: WeatherPointMetrics[]) {
  const hub = points.find((point) => point.id === "hub");
  const perimeterSevere = points.filter(
    (point) => point.id !== "hub" && point.level === "suspended",
  );
  const reasons = [...new Set(points.flatMap((point) => point.reasonCodes))];
  if (hub?.level === "suspended" || perimeterSevere.length >= 2) {
    return { level: "suspended" as const, reasonCodes: reasons };
  }
  if (
    perimeterSevere.length === 1 ||
    points.some((point) => point.level === "warning")
  ) {
    return { level: "warning" as const, reasonCodes: reasons };
  }
  return { level: "safe" as const, reasonCodes: reasons };
}

export function combineCurrentAndForecast(
  current: ReturnType<typeof aggregateCurrentArea>,
  forecasts: Array<ReturnType<typeof aggregateCurrentArea>>,
) {
  if (current.level === "suspended") return current;
  if (forecasts.some((forecast) => forecast.level === "suspended")) {
    return {
      level: "warning" as const,
      reasonCodes: [...new Set([...current.reasonCodes, "severe_weather_forecast"])],
    };
  }
  if (current.level === "warning" || forecasts.some((forecast) => forecast.level === "warning")) {
    return {
      level: "warning" as const,
      reasonCodes: [...new Set([
        ...current.reasonCodes,
        ...forecasts.flatMap((forecast) => forecast.reasonCodes),
      ])],
    };
  }
  return current;
}

