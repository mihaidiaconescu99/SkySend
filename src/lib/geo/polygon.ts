import type { GeoPoint } from "@/types/service-area";

export function isPointInPolygon(
  point: GeoPoint,
  polygon: readonly GeoPoint[],
): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let isInside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const current = polygon[i];
    const previous = polygon[j];

    const straddlesLongitude =
      current.longitude > point.longitude !==
      previous.longitude > point.longitude;

    if (!straddlesLongitude) {
      continue;
    }

    const edgeLatitudeAtPoint =
      ((previous.latitude - current.latitude) *
        (point.longitude - current.longitude)) /
        (previous.longitude - current.longitude) +
      current.latitude;

    if (point.latitude < edgeLatitudeAtPoint) {
      isInside = !isInside;
    }
  }

  return isInside;
}

export type { GeoPoint };
