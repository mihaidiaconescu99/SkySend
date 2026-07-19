import { describe, it, expect } from "vitest";

import { isPointInPolygon } from "@/lib/geo/polygon";
import type { GeoPoint } from "@/types/service-area";

const PITESTI_CENTER: GeoPoint = { latitude: 44.8565, longitude: 24.8692 };

const PITESTI_BBOX: GeoPoint[] = [
  { latitude: 44.82, longitude: 24.82 },
  { latitude: 44.82, longitude: 24.92 },
  { latitude: 44.90, longitude: 24.92 },
  { latitude: 44.90, longitude: 24.82 },
];

const U_SHAPE: GeoPoint[] = [
  { latitude: 44.82, longitude: 24.82 },
  { latitude: 44.82, longitude: 24.92 },
  { latitude: 44.90, longitude: 24.92 },
  { latitude: 44.90, longitude: 24.89 },
  { latitude: 44.86, longitude: 24.89 },
  { latitude: 44.86, longitude: 24.85 },
  { latitude: 44.90, longitude: 24.85 },
  { latitude: 44.90, longitude: 24.82 },
];

describe("isPointInPolygon", () => {
  it("returns true for a point clearly inside a convex polygon", () => {
    expect(isPointInPolygon(PITESTI_CENTER, PITESTI_BBOX)).toBe(true);
  });

  it("returns false for a point clearly outside a convex polygon", () => {
    const bucharest: GeoPoint = { latitude: 44.4268, longitude: 26.1025 };

    expect(isPointInPolygon(bucharest, PITESTI_BBOX)).toBe(false);
  });

  it("returns true for a point inside an arm of a concave (U-shaped) polygon", () => {
    const insideLeftArm: GeoPoint = { latitude: 44.88, longitude: 24.83 };
    const insideBase: GeoPoint = { latitude: 44.83, longitude: 24.87 };

    expect(isPointInPolygon(insideLeftArm, U_SHAPE)).toBe(true);
    expect(isPointInPolygon(insideBase, U_SHAPE)).toBe(true);
  });

  it("returns false for a point inside the indent of a concave (U-shaped) polygon", () => {
    const insideIndent: GeoPoint = { latitude: 44.88, longitude: 24.87 };

    expect(isPointInPolygon(insideIndent, U_SHAPE)).toBe(false);
  });

  it("returns a deterministic boolean for a point exactly on a polygon vertex (implementation-defined)", () => {

    const corner = PITESTI_BBOX[0];

    const result = isPointInPolygon(corner, PITESTI_BBOX);

    expect(typeof result).toBe("boolean");
    expect(result).toBe(true);
  });

  it("returns false for a degenerate polygon (fewer than 3 vertices)", () => {
    expect(isPointInPolygon(PITESTI_CENTER, [])).toBe(false);
    expect(isPointInPolygon(PITESTI_CENTER, [PITESTI_CENTER])).toBe(false);
    expect(
      isPointInPolygon(PITESTI_CENTER, [PITESTI_CENTER, { latitude: 45, longitude: 25 }]),
    ).toBe(false);
  });

  it("correctly classifies inside/outside points for a triangle", () => {
    const triangle: GeoPoint[] = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 10 },
      { latitude: 10, longitude: 5 },
    ];

    expect(isPointInPolygon({ latitude: 3, longitude: 5 }, triangle)).toBe(true);
    expect(isPointInPolygon({ latitude: 9, longitude: 5 }, triangle)).toBe(true);
    expect(isPointInPolygon({ latitude: -1, longitude: 5 }, triangle)).toBe(false);
    expect(isPointInPolygon({ latitude: 5, longitude: 11 }, triangle)).toBe(false);
  });

  it("handles a larger many-vertex polygon approximating Pitești's city footprint", () => {

    const radiusDeg = 0.027;
    const hex: GeoPoint[] = Array.from({ length: 6 }, (_, index) => {
      const angle = (index * Math.PI) / 3;
      return {
        latitude: PITESTI_CENTER.latitude + radiusDeg * Math.cos(angle),
        longitude: PITESTI_CENTER.longitude + radiusDeg * Math.sin(angle),
      };
    });

    expect(isPointInPolygon(PITESTI_CENTER, hex)).toBe(true);

    expect(
      isPointInPolygon({ latitude: 44.4268, longitude: 26.1025 }, hex),
    ).toBe(false);
  });
});
