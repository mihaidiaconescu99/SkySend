import { describe, expect, it } from "vitest";

import { calculateDistanceMeters } from "@/lib/geo/distance";

describe("delivery address separation", () => {
  const pickup = { latitude: 44.4268, longitude: 26.1025 };

  it("rejects a point below the 150 m threshold", () => {
    const closeDropoff = { latitude: 44.4278, longitude: 26.1025 };

    expect(calculateDistanceMeters(pickup, closeDropoff)).toBeLessThan(150);
  });

  it("treats exactly 150 m as valid", () => {
    const latitudeDeltaFor150Meters = (150 / 6_371_000) * (180 / Math.PI);
    const dropoff = {
      latitude: pickup.latitude + latitudeDeltaFor150Meters,
      longitude: pickup.longitude,
    };

    expect(calculateDistanceMeters(pickup, dropoff)).toBeCloseTo(150, 6);
    expect(calculateDistanceMeters(pickup, dropoff)).toBeGreaterThanOrEqual(150);
  });
});
