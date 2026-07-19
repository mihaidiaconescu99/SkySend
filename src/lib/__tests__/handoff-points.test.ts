import { describe, it, expect } from "vitest";

import { generateCandidatePointsForAddress } from "@/lib/candidate-points";
import {
  buildHandoffPointResponse,
  buildInferredHandoffPoints,
} from "@/lib/handoff-points";
import type {
  HandoffPointRequest,
  HandoffProviderPoint,
} from "@/types/handoff-points";
import type { GeocodedAddress, GeoPoint } from "@/types/service-area";

const PITESTI_CENTER: GeoPoint = { latitude: 44.8565, longitude: 24.8692 };

const eligiblePitestiAddress: GeocodedAddress = {
  formattedAddress: "Strada Republicii 1, Pitești",
  location: PITESTI_CENTER,
  city: "Pitești",
  county: "Argeș",
  country: "România",
  postalCode: "110014",
};

const eligibleRequest: HandoffPointRequest = {
  field: "pickup",
  address: eligiblePitestiAddress,
  isAddressEligible: true,
};

function getTestCardinalDirection(point: GeoPoint) {
  const deltaLatitude = point.latitude - PITESTI_CENTER.latitude;
  const deltaLongitude = point.longitude - PITESTI_CENTER.longitude;

  if (Math.abs(deltaLatitude) >= Math.abs(deltaLongitude)) {
    return deltaLatitude >= 0 ? "north" : "south";
  }

  return deltaLongitude >= 0 ? "east" : "west";
}

describe("buildInferredHandoffPoints", () => {
  it("returns up to 4 fallback points for an eligible address", () => {
    const points = buildInferredHandoffPoints(eligibleRequest);

    expect(points.length).toBeLessThanOrEqual(4);
    expect(points.length).toBeGreaterThan(0);

    for (const point of points) {
      expect(point.source).toBe("inferred");
      expect(point.type).toBe("street_side");
      expect(Number.isFinite(point.point.latitude)).toBe(true);
      expect(Number.isFinite(point.point.longitude)).toBe(true);
      expect(point.eligibilityState).not.toBe("outside");
      expect(point.distanceFromOriginMeters).toBeGreaterThan(0);
    }
  });

  it("keeps the fallback visually asymmetric instead of a perfect plus", () => {
    const points = buildInferredHandoffPoints(eligibleRequest);

    expect(points).toHaveLength(4);
    expect(
      points.some((point) => {
        const dLat = Math.abs(point.point.latitude - PITESTI_CENTER.latitude);
        const dLon = Math.abs(point.point.longitude - PITESTI_CENTER.longitude);

        return dLat > 0 && dLon > 0;
      }),
    ).toBe(true);
  });

  it("keeps inferred fallback points close to the selected block", () => {
    const points = buildInferredHandoffPoints(eligibleRequest);

    expect(points).toHaveLength(4);
    for (const point of points) {
      expect(point.distanceFromOriginMeters).toBeGreaterThanOrEqual(8);
      expect(point.distanceFromOriginMeters).toBeLessThanOrEqual(15);
    }
  });

  it("marks exactly one selectable point as recommended", () => {
    const points = buildInferredHandoffPoints(eligibleRequest);
    const recommended = points.filter(
      (point) => point.recommendationState === "recommended",
    );

    expect(recommended.length).toBe(1);
    expect(recommended[0].eligibilityState).not.toBe("outside");
  });

  it("returns outside-eligibility points (not an empty list) when the address is outside the service area", () => {
    const points = buildInferredHandoffPoints({
      ...eligibleRequest,
      isAddressEligible: false,
    });

    expect(points.length).toBe(4);
    for (const point of points) {
      expect(point.eligibilityState).toBe("outside");
    }
  });
});

describe("buildHandoffPointResponse — inferred fallback", () => {
  it("falls back to inferred points when provider points are empty", () => {
    const response = buildHandoffPointResponse(eligibleRequest, []);

    expect(response.points.length).toBeGreaterThan(0);
    expect(response.sourcesUsed).toContain("inferred");
    for (const point of response.points) {
      expect(point.source).toBe("inferred");
    }
  });

  it("keeps a provider point ahead of inferred fallback points", () => {
    const providerPoint: HandoffProviderPoint = {
      label: "Punct lângă stradă",

      point: {
        latitude: PITESTI_CENTER.latitude + 0.000_35,
        longitude: PITESTI_CENTER.longitude + 0.000_45,
      },
      type: "street_side",
      source: "osm_overpass",
      confidence: "high",
      reason: "Punct validat pe segment de drum.",
      baseScore: 80,
      roadDistanceMeters: 4,
      roadSegmentKey: "way:1",
    };

    const response = buildHandoffPointResponse(eligibleRequest, [providerPoint]);

    expect(response.points[0].source).toBe("osm_overpass");
  });

  it("accepts road-edge provider points that are very close to the selected address", () => {
    const providerPoint: HandoffProviderPoint = {
      label: "Punct lângă stradă",
      point: {
        latitude: PITESTI_CENTER.latitude,
        longitude: PITESTI_CENTER.longitude + 0.000_09,
      },
      type: "street_side",
      source: "osm_overpass",
      confidence: "high",
      reason: "Punct validat pe segment de drum.",
      baseScore: 88,
      roadDistanceMeters: 4,
      roadSegmentKey: "way:1",
    };

    const response = buildHandoffPointResponse(eligibleRequest, [providerPoint]);

    expect(response.points[0].source).toBe("osm_overpass");
  });

  it("does not mix approximate fallback points into a provider-backed response", () => {
    const providerPoint: HandoffProviderPoint = {
      label: "Punct lÃ¢ngÄƒ stradÄƒ",
      point: {
        latitude: PITESTI_CENTER.latitude + 0.000_35,
        longitude: PITESTI_CENTER.longitude + 0.000_45,
      },
      type: "street_side",
      source: "osm_overpass",
      confidence: "high",
      reason: "Punct validat pe segment de drum.",
      baseScore: 88,
      roadDistanceMeters: 4,
      roadSegmentKey: "way:1",
    };

    const response = buildHandoffPointResponse(eligibleRequest, [providerPoint]);

    expect(response.points).toHaveLength(1);
    expect(response.points.every((point) => point.source === "osm_overpass")).toBe(true);
    expect(response.sourcesUsed).not.toContain("inferred");
  });

  it("prefers the closest road-edge provider point over a farther one", () => {
    const closeProviderPoint: HandoffProviderPoint = {
      label: "Punct langa strada",
      point: {
        latitude: PITESTI_CENTER.latitude,
        longitude: PITESTI_CENTER.longitude + 0.000_09,
      },
      type: "street_side",
      source: "osm_overpass",
      confidence: "high",
      reason: "Punct validat pe segment de drum apropiat.",
      baseScore: 94,
      roadDistanceMeters: 1.4,
      roadSegmentKey: "way:close",
    };
    const fartherProviderPoint: HandoffProviderPoint = {
      label: "Punct langa strada",
      point: {
        latitude: PITESTI_CENTER.latitude + 0.000_45,
        longitude: PITESTI_CENTER.longitude + 0.000_45,
      },
      type: "street_side",
      source: "osm_overpass",
      confidence: "high",
      reason: "Punct validat pe segment de drum mai indepartat.",
      baseScore: 96,
      roadDistanceMeters: 1.4,
      roadSegmentKey: "way:farther",
    };

    const response = buildHandoffPointResponse(eligibleRequest, [
      fartherProviderPoint,
      closeProviderPoint,
    ]);

    expect(response.points[0].point).toEqual(closeProviderPoint.point);
  });

  it("keeps unnamed internal paths as valid road candidates", () => {
    const unnamedInternalPath: HandoffProviderPoint = {
      label: "Punct langa strada",
      point: {
        latitude: PITESTI_CENTER.latitude,
        longitude: PITESTI_CENTER.longitude + 0.000_09,
      },
      type: "street_side",
      source: "osm_overpass",
      confidence: "high",
      reason: "Alee interna fara nume.",
      baseScore: 98,
      roadDistanceMeters: 1.4,
      roadSegmentKey: "way:internal",
    };
    const namedStreet: HandoffProviderPoint = {
      label: "Punct langa strada",
      point: {
        latitude: PITESTI_CENTER.latitude,
        longitude: PITESTI_CENTER.longitude + 0.000_24,
      },
      type: "street_side",
      source: "osm_overpass",
      confidence: "high",
      reason: "Strada vizibila pe harta.",
      baseScore: 90,
      roadDistanceMeters: 3.8,
      roadName: "Strada Viilor",
      roadSegmentKey: "way:named",
    };

    const response = buildHandoffPointResponse(eligibleRequest, [
      unnamedInternalPath,
      namedStreet,
    ]);

    expect(response.points[0].point).toEqual(unnamedInternalPath.point);
  });

  it("tries to cover north, south, east, and west when candidates exist", () => {
    const providerPoints: HandoffProviderPoint[] = [
      {
        label: "Punct nord",
        point: {
          latitude: PITESTI_CENTER.latitude + 0.000_18,
          longitude: PITESTI_CENTER.longitude,
        },
        type: "street_side",
        source: "osm_overpass",
        confidence: "high",
        reason: "Drum la nord.",
        baseScore: 90,
        roadDistanceMeters: 1.4,
        roadSegmentKey: "way:north",
      },
      {
        label: "Punct est apropiat",
        point: {
          latitude: PITESTI_CENTER.latitude,
          longitude: PITESTI_CENTER.longitude + 0.000_08,
        },
        type: "street_side",
        source: "osm_overpass",
        confidence: "high",
        reason: "Drum la est.",
        baseScore: 98,
        roadDistanceMeters: 1.4,
        roadSegmentKey: "way:east-close",
      },
      {
        label: "Punct est alternativ",
        point: {
          latitude: PITESTI_CENTER.latitude,
          longitude: PITESTI_CENTER.longitude + 0.000_12,
        },
        type: "street_side",
        source: "osm_overpass",
        confidence: "high",
        reason: "Alt drum la est.",
        baseScore: 99,
        roadDistanceMeters: 1.4,
        roadSegmentKey: "way:east-alt",
      },
      {
        label: "Punct sud",
        point: {
          latitude: PITESTI_CENTER.latitude - 0.000_18,
          longitude: PITESTI_CENTER.longitude,
        },
        type: "street_side",
        source: "osm_overpass",
        confidence: "high",
        reason: "Drum la sud.",
        baseScore: 90,
        roadDistanceMeters: 1.4,
        roadSegmentKey: "way:south",
      },
      {
        label: "Punct vest",
        point: {
          latitude: PITESTI_CENTER.latitude,
          longitude: PITESTI_CENTER.longitude - 0.000_18,
        },
        type: "street_side",
        source: "osm_overpass",
        confidence: "high",
        reason: "Drum la vest.",
        baseScore: 90,
        roadDistanceMeters: 1.4,
        roadSegmentKey: "way:west",
      },
    ];

    const response = buildHandoffPointResponse(eligibleRequest, providerPoints);
    const directions = new Set(
      response.points.map((point) => getTestCardinalDirection(point.point)),
    );

    expect(response.points).toHaveLength(4);
    expect(directions).toEqual(new Set(["north", "south", "east", "west"]));
  });
});

describe("generateCandidatePointsForAddress — client fallback source", () => {
  it("returns the inferred fallback points for an eligible address", () => {
    const points = generateCandidatePointsForAddress(
      "pickup",
      eligiblePitestiAddress,
      true,
    );

    expect(points.length).toBe(4);
    for (const point of points) {
      expect(point.source).toBe("inferred");
      expect(point.type).toBe("street_side");
    }
  });
});
