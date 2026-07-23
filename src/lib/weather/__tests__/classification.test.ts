import { describe, expect, it } from "vitest";
import { aggregateCurrentArea, classifyWeatherPoint, combineCurrentAndForecast } from "@/lib/weather/classification";

function point(id: "hub" | "north" | "east" | "south" | "west", wind: number, gust = wind, weatherCode = 0) {
  return classifyWeatherPoint({
    id, latitude: 44, longitude: 24, weatherCode,
    windSpeedKmh: wind, windGustKmh: gust,
    precipitationMm: 0, snowfallCm: 0, visibilityM: 10_000,
  });
}

describe("weather classification", () => {
  it.each([[29.9, "safe"], [30, "warning"], [49.9, "warning"], [50, "suspended"]] as const)("classifies %s km/h as %s", (wind, level) => {
    expect(point("hub", wind).level).toBe(level);
  });

  it("uses the maximum of sustained wind and gust", () => {
    expect(point("hub", 10, 50).windMetricKmh).toBe(50);
    expect(point("hub", 10, 50).level).toBe("suspended");
  });

  it.each([95, 96, 99])("suspends for WMO %s", (code) => {
    expect(point("hub", 0, 0, code).level).toBe("suspended");
  });

  it.each([61, 63, 71, 73])("keeps ordinary rain or snow WMO %s safe", (code) => {
    expect(point("hub", 0, 0, code).level).toBe("safe");
  });

  it("warns for one severe perimeter point and suspends for two", () => {
    const base = [point("hub", 0), point("north", 50), point("east", 0), point("south", 0), point("west", 0)];
    expect(aggregateCurrentArea(base).level).toBe("warning");
    expect(aggregateCurrentArea(base.map((item) => item.id === "east" ? point("east", 50) : item)).level).toBe("suspended");
  });

  it("turns a forecast suspension into warning only", () => {
    const safe = aggregateCurrentArea([point("hub", 0)]);
    const severe = aggregateCurrentArea([point("hub", 50)]);
    expect(combineCurrentAndForecast(safe, [severe]).level).toBe("warning");
  });
});
