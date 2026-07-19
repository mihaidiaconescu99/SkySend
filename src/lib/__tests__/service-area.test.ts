import { describe, it, expect } from "vitest";

import {
  getDistanceKm,
  isGeocodedAddressEligible,
  isPointInServiceArea,
} from "@/lib/service-area";
import type {
  GeoPoint,
  PolygonServiceArea,
  ServiceAreaConfig,
} from "@/types/service-area";

const PITESTI_CENTER: GeoPoint = { latitude: 44.8565, longitude: 24.8692 };
const BUCHAREST_CENTER: GeoPoint = { latitude: 44.4268, longitude: 26.1025 };

function buildRadiusConfig(
  overrides: Partial<ServiceAreaConfig> = {},
): ServiceAreaConfig {
  return {
    cityName: "Pitești",
    county: "Argeș",
    country: "România",
    center: PITESTI_CENTER,
    coverageRadiusKm: 6,
    activeMode: "radius",
    fallbackMode: "radius",
    area: { mode: "radius", center: PITESTI_CENTER, radiusKm: 6 },
    futurePolygonArea: null,
    statusMessages: {
      available: "available",
      outside: "outside",
      unsupported: "unsupported",
      review: "review",
    },
    ...overrides,
  };
}

function buildPolygonConfig(polygon: GeoPoint[]): ServiceAreaConfig {
  return buildRadiusConfig({
    activeMode: "polygon",
    area: { mode: "polygon", polygon } satisfies PolygonServiceArea,
  });
}

const PITESTI_BBOX: GeoPoint[] = [
  { latitude: 44.82, longitude: 24.82 },
  { latitude: 44.82, longitude: 24.92 },
  { latitude: 44.90, longitude: 24.92 },
  { latitude: 44.90, longitude: 24.82 },
];

function offsetKm(origin: GeoPoint, kmEast: number, kmNorth: number): GeoPoint {
  const latDelta = kmNorth / 111;
  const lonDelta =
    kmEast / (111 * Math.cos((origin.latitude * Math.PI) / 180));
  return {
    latitude: origin.latitude + latDelta,
    longitude: origin.longitude + lonDelta,
  };
}

describe("getDistanceKm", () => {
  it("returns ~108 km between Pitești and București (±1 km)", () => {
    const distance = getDistanceKm(PITESTI_CENTER, BUCHAREST_CENTER);

    expect(distance).toBeGreaterThan(107);
    expect(distance).toBeLessThan(109);
  });

  it("returns 0 when both points are identical", () => {
    expect(getDistanceKm(PITESTI_CENTER, PITESTI_CENTER)).toBe(0);
  });

  it("returns ~20015 km for antipodal points (half Earth's circumference)", () => {
    const north: GeoPoint = { latitude: 10, longitude: 20 };
    const south: GeoPoint = { latitude: -10, longitude: -160 };

    const distance = getDistanceKm(north, south);

    expect(distance).toBeGreaterThan(20010);
    expect(distance).toBeLessThan(20020);
  });
});

describe("isPointInServiceArea — radius mode", () => {
  it("returns isCovered=true for a point ~1 km from the center with a 6 km radius", () => {
    const point = offsetKm(PITESTI_CENTER, 1, 0);
    const config = buildRadiusConfig();

    const result = isPointInServiceArea(point, config);

    expect(result.isCovered).toBe(true);
    expect(result.modeUsed).toBe("radius");
    expect(result.distanceKm).toBeLessThan(6);
  });

  it("returns isCovered=false for a point ~7 km from the center with a 6 km radius", () => {
    const point = offsetKm(PITESTI_CENTER, 7, 0);
    const config = buildRadiusConfig();

    const result = isPointInServiceArea(point, config);

    expect(result.isCovered).toBe(false);
    expect(result.distanceKm).toBeGreaterThan(6);
  });

  it("returns isCovered=true for a point sitting exactly on the radius boundary (inclusive ≤)", () => {

    const config = buildRadiusConfig();
    const point = offsetKm(PITESTI_CENTER, 0, 6);

    const measured = getDistanceKm(PITESTI_CENTER, point);
    const boundaryConfig = buildRadiusConfig({
      coverageRadiusKm: measured,
      area: { mode: "radius", center: PITESTI_CENTER, radiusKm: measured },
    });

    const result = isPointInServiceArea(point, boundaryConfig);

    expect(result.isCovered).toBe(true);
    expect(result.distanceKm).toBeCloseTo(measured, 9);
    expect(config).toBeDefined();
  });
});

describe("isPointInServiceArea — polygon mode", () => {
  it("returns isCovered=true for a point clearly inside a convex polygon", () => {
    const config = buildPolygonConfig(PITESTI_BBOX);

    const result = isPointInServiceArea(PITESTI_CENTER, config);

    expect(result.isCovered).toBe(true);
    expect(result.modeUsed).toBe("polygon");
  });

  it("returns isCovered=false for a point clearly outside a convex polygon", () => {
    const config = buildPolygonConfig(PITESTI_BBOX);

    const result = isPointInServiceArea(BUCHAREST_CENTER, config);

    expect(result.isCovered).toBe(false);
    expect(result.distanceKm).toBeGreaterThan(0);
  });

  it("documents ray-casting behavior on a vertex/edge: a corner vertex may report not covered", () => {
    const config = buildPolygonConfig(PITESTI_BBOX);

    const corner = PITESTI_BBOX[0];

    const result = isPointInServiceArea(corner, config);

    expect(typeof result.isCovered).toBe("boolean");
    expect(result.isCovered).toBe(true);
  });

  it("correctly excludes a point inside the bounding box but inside the indent of a concave (U-shaped) polygon", () => {

    const uShape: GeoPoint[] = [
      { latitude: 44.82, longitude: 24.82 },
      { latitude: 44.82, longitude: 24.92 },
      { latitude: 44.90, longitude: 24.92 },
      { latitude: 44.90, longitude: 24.89 },
      { latitude: 44.86, longitude: 24.89 },
      { latitude: 44.86, longitude: 24.85 },
      { latitude: 44.90, longitude: 24.85 },
      { latitude: 44.90, longitude: 24.82 },
    ];
    const config = buildPolygonConfig(uShape);

    const insideArm: GeoPoint = { latitude: 44.88, longitude: 24.83 };
    const insideIndent: GeoPoint = { latitude: 44.88, longitude: 24.87 };
    const insideBase: GeoPoint = { latitude: 44.83, longitude: 24.87 };

    expect(isPointInServiceArea(insideArm, config).isCovered).toBe(true);
    expect(isPointInServiceArea(insideBase, config).isCovered).toBe(true);
    expect(isPointInServiceArea(insideIndent, config).isCovered).toBe(false);
  });
});

describe("isGeocodedAddressEligible", () => {
  const config = buildRadiusConfig();

  it("flags an in-radius Pitești address as eligible with no manual review", () => {
    const result = isGeocodedAddressEligible(
      {
        formattedAddress: "Strada Test 1, Pitești",
        location: offsetKm(PITESTI_CENTER, 0.5, 0),
        city: "Pitești",
        county: "Argeș",
        country: "România",
      },
      config,
    );

    expect(result.isEligible).toBe(true);
    expect(result.needsManualReview).toBe(false);
  });

  it("flags an in-radius Pitești address near the boundary (~5.7 km) as eligible but needing review", () => {
    const result = isGeocodedAddressEligible(
      {
        formattedAddress: "Strada Margine, Pitești",
        location: offsetKm(PITESTI_CENTER, 5.7, 0),
        city: "Pitești",
        county: "Argeș",
        country: "România",
      },
      config,
    );

    expect(result.coverage.isCovered).toBe(true);
    expect(result.coverage.distanceKm).toBeGreaterThanOrEqual(5.65);
    expect(result.isEligible).toBe(true);
    expect(result.needsManualReview).toBe(true);
  });

  it("rejects an address whose coordinates are inside the radius but whose city is different (București)", () => {
    const result = isGeocodedAddressEligible(
      {
        formattedAddress: "Some address",
        location: offsetKm(PITESTI_CENTER, 0.5, 0),
        city: "București",
        county: "București",
        country: "România",
      },
      config,
    );

    expect(result.coverage.isCovered).toBe(true);
    expect(result.isEligible).toBe(false);
    expect(result.needsManualReview).toBe(true);
  });

  it("flags an address with matching county (Argeș) but different city as needing manual review", () => {
    const result = isGeocodedAddressEligible(
      {
        formattedAddress: "Curtea de Argeș, Argeș",
        location: offsetKm(PITESTI_CENTER, 1, 0),
        city: "Curtea de Argeș",
        county: "Argeș",
        country: "România",
      },
      config,
    );

    expect(result.coverage.isCovered).toBe(true);
    expect(result.isEligible).toBe(false);
    expect(result.needsManualReview).toBe(true);
  });

  it("treats 'Pitesti' (no diacritics) and 'Pitești' as equivalent city values", () => {
    const withoutDiacritics = isGeocodedAddressEligible(
      {
        formattedAddress: "Strada Test 1, Pitesti",
        location: offsetKm(PITESTI_CENTER, 0.5, 0),
        city: "Pitesti",
        county: "Arges",
        country: "Romania",
      },
      config,
    );
    const withDiacritics = isGeocodedAddressEligible(
      {
        formattedAddress: "Strada Test 1, Pitești",
        location: offsetKm(PITESTI_CENTER, 0.5, 0),
        city: "Pitești",
        county: "Argeș",
        country: "România",
      },
      config,
    );

    expect(withoutDiacritics.isEligible).toBe(true);
    expect(withDiacritics.isEligible).toBe(true);
    expect(withoutDiacritics.needsManualReview).toBe(false);
    expect(withDiacritics.needsManualReview).toBe(false);
  });
});
