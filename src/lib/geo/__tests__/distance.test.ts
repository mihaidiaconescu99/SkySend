import { describe, it, expect } from "vitest";

import { calculateDistanceKm } from "@/lib/geo/distance";
import type { GeoPoint } from "@/types/service-area";

const PITESTI_CENTER: GeoPoint = { latitude: 44.8565, longitude: 24.8692 };
const BUCHAREST_CENTER: GeoPoint = { latitude: 44.4268, longitude: 26.1025 };

describe("calculateDistanceKm", () => {
  it("returns 0 for two identical points", () => {
    expect(calculateDistanceKm(PITESTI_CENTER, PITESTI_CENTER)).toBe(0);
  });

  it("returns ~20015 km for antipodal points (half the Earth's circumference)", () => {
    const north: GeoPoint = { latitude: 10, longitude: 20 };
    const south: GeoPoint = { latitude: -10, longitude: -160 };

    const distance = calculateDistanceKm(north, south);

    expect(distance).toBeGreaterThan(20010);
    expect(distance).toBeLessThan(20020);
  });

  it("returns ~108 km between Pitești and București", () => {
    const distance = calculateDistanceKm(PITESTI_CENTER, BUCHAREST_CENTER);

    expect(distance).toBeGreaterThan(107);
    expect(distance).toBeLessThan(109);
  });

  it("returns a small sub-kilometre distance between two close points in Pitești", () => {

    const nearby: GeoPoint = {
      latitude: PITESTI_CENTER.latitude,
      longitude: PITESTI_CENTER.longitude + 0.001,
    };

    const distance = calculateDistanceKm(PITESTI_CENTER, nearby);

    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(0.2);
  });

  it("computes the same distance for points with negative latitudes (southern hemisphere)", () => {
    const a: GeoPoint = { latitude: -33.8688, longitude: 151.2093 };
    const b: GeoPoint = { latitude: -37.8136, longitude: 144.9631 };

    const distance = calculateDistanceKm(a, b);

    expect(distance).toBeGreaterThan(710);
    expect(distance).toBeLessThan(716);
  });

  it("rounds the result to 2 decimal places (≈10 m precision)", () => {
    const distance = calculateDistanceKm(PITESTI_CENTER, BUCHAREST_CENTER);

    expect(Math.round(distance * 100)).toBe(distance * 100);
  });
});
