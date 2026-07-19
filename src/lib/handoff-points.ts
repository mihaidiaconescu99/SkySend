import { isPointInPolygon } from "@/lib/geo/polygon";
import {
  getDistanceKm,
  getServiceAreaUnavailableMessage,
  isPointInServiceArea,
} from "@/lib/service-area";
import type { CandidatePoint } from "@/types/candidate-points";
import type {
  GeoapifyAutocompleteResult,
} from "@/types/geoapify";
import type {
  HandoffCardinalDirection,
  HandoffLocationType,
  HandoffPoint,
  HandoffPointConfidence,
  HandoffPointRequest,
  HandoffPointResponse,
  HandoffPointSource,
  HandoffProviderPoint,
} from "@/types/handoff-points";
import type { GeocodedAddress, GeoPoint } from "@/types/service-area";

const METERS_PER_DEGREE_LATITUDE = 111_320;
const GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places";
const GEOAPIFY_PLACE_DETAILS_URL = "https://api.geoapify.com/v2/place-details";
const GEOAPIFY_REVERSE_GEOCODING_URL = "https://api.geoapify.com/v1/geocode/reverse";
const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_MIRROR_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
] as const;
const OVERPASS_USER_AGENT = "SkySend/1.0 (local route planning)";
const HANDOFF_RADIUS_METERS = 700;
const MAX_HANDOFF_POINTS = 4;

const OVERPASS_ENDPOINT_TIMEOUT_MS = 4_000;

const OVERPASS_CACHE_TTL_MS = 10 * 60 * 1000;
const OVERPASS_CACHE_PRECISION = 4;
const OVERPASS_ROAD_SEARCH_RADIUS_METERS = 450;
const OVERPASS_BUILDING_SEARCH_RADIUS_METERS = 160;
const OVERPASS_BUILDING_TIMEOUT_MS = 1_200;
const MAX_USABLE_MEETING_POINT_DISTANCE_METERS = 650;
const MIN_USABLE_MEETING_POINT_DISTANCE_METERS = 0.8;
const IDEAL_STREET_SIDE_DISTANCE_METERS = 4;
const MIN_POINT_SEPARATION_METERS = 4;
const ROAD_VALIDATION_MAX_DISTANCE_METERS = 14;
const BUILDING_SAFETY_BUFFER_METERS = 3.2;
const MIN_ROAD_SEGMENT_LENGTH_METERS = 3;
const CARDINAL_DIRECTIONS = ["north", "east", "south", "west"] as const;
const INFERRED_SIDEWALK_OFFSETS: Record<
  HandoffCardinalDirection,
  { x: number; y: number }
> = {

  north: { x: -2, y: 12 },
  east: { x: 13, y: 2 },
  south: { x: 2, y: -12 },
  west: { x: -12, y: -2 },
};

type GeoapifyFeature = {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: GeoapifyAutocompleteResult & {
    name?: string;
    address_line1?: string;
    address_line2?: string;
  };
};

type GeoapifyFeatureCollection = {
  features?: GeoapifyFeature[];
};

type GeoapifyReverseGeocodingResponse = {
  results?: GeoapifyAutocompleteResult[];
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  geometry?: Array<{
    lat?: number;
    lon?: number;
  }>;
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type DirectedHandoffProviderPoint = HandoffProviderPoint & {
  direction: HandoffCardinalDirection;
};

type RoadGeometrySegment = {
  start: GeoPoint;
  end: GeoPoint;
};

type SegmentProjection = {
  point: GeoPoint;
  progress: number;
  segmentLengthMeters: number;
  distanceMeters: number;
};

type BuildingClearance = {
  isClear: boolean;
  distanceMeters: number | null;
};

const fieldTypeBonuses: Record<
  HandoffPointRequest["field"],
  Record<CandidatePoint["type"], number>
> = {
  pickup: {
    entrance: 7,
    curbside: 30,
    parking: 18,
    public_point: 24,
    building_side: -45,
    street_side: 32,
    storefront: 6,
    access: 28,
  },
  dropoff: {
    entrance: 7,
    curbside: 30,
    parking: 18,
    public_point: 24,
    building_side: -45,
    street_side: 32,
    storefront: 6,
    access: 28,
  },
};

const sourceScore: Record<HandoffPointSource, number> = {
  geoapify_details: 7,
  osm_overpass: 24,
  geoapify_places: 14,
  inferred: -6,
};

const confidenceScore: Record<HandoffPointConfidence, number> = {
  high: 16,
  medium: 9,
  low: 3,
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function normalizeText(value?: string | null) {
  return value
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim() ?? "";
}

function getPointFromFeature(feature: GeoapifyFeature): GeoPoint | null {
  const properties = feature.properties;

  if (
    typeof properties?.lat === "number" &&
    typeof properties.lon === "number"
  ) {
    return {
      latitude: properties.lat,
      longitude: properties.lon,
    };
  }

  const coordinates = feature.geometry?.coordinates;

  if (
    Array.isArray(coordinates) &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    return {
      latitude: coordinates[1],
      longitude: coordinates[0],
    };
  }

  return null;
}

function toLocalMeters(point: GeoPoint, origin: GeoPoint) {
  return {
    x:
      (point.longitude - origin.longitude) *
      METERS_PER_DEGREE_LATITUDE *
      Math.cos(toRadians(origin.latitude)),
    y: (point.latitude - origin.latitude) * METERS_PER_DEGREE_LATITUDE,
  };
}

function fromLocalMeters(point: { x: number; y: number }, origin: GeoPoint): GeoPoint {
  return {
    latitude: origin.latitude + point.y / METERS_PER_DEGREE_LATITUDE,
    longitude:
      origin.longitude +
      point.x /
        (METERS_PER_DEGREE_LATITUDE * Math.cos(toRadians(origin.latitude))),
  };
}

function getCardinalDirection(
  origin: GeoPoint,
  point: GeoPoint,
): HandoffCardinalDirection {
  const localPoint = toLocalMeters(point, origin);

  if (Math.abs(localPoint.y) >= Math.abs(localPoint.x)) {
    return localPoint.y >= 0 ? "north" : "south";
  }

  return localPoint.x >= 0 ? "east" : "west";
}

function getSegmentProjection(
  point: GeoPoint,
  segmentStart: GeoPoint,
  segmentEnd: GeoPoint,
): SegmentProjection {
  const origin = point;
  const localPoint = toLocalMeters(point, origin);
  const localStart = toLocalMeters(segmentStart, origin);
  const localEnd = toLocalMeters(segmentEnd, origin);
  const deltaX = localEnd.x - localStart.x;
  const deltaY = localEnd.y - localStart.y;
  const segmentLengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (segmentLengthSquared === 0) {
    return {
      point: segmentStart,
      progress: 0,
      segmentLengthMeters: 0,
      distanceMeters: getDistanceKm(point, segmentStart) * 1000,
    };
  }

  const progress = Math.max(
    0,
    Math.min(
      1,
      ((localPoint.x - localStart.x) * deltaX +
        (localPoint.y - localStart.y) * deltaY) /
        segmentLengthSquared,
    ),
  );
  const projectedPoint = fromLocalMeters(
    {
      x: localStart.x + progress * deltaX,
      y: localStart.y + progress * deltaY,
    },
    origin,
  );

  return {
    point: projectedPoint,
    progress,
    segmentLengthMeters: Math.sqrt(segmentLengthSquared),
    distanceMeters: getDistanceKm(point, projectedPoint) * 1000,
  };
}

function getClosestPointOnSegment(
  point: GeoPoint,
  segmentStart: GeoPoint,
  segmentEnd: GeoPoint,
) {
  return getSegmentProjection(point, segmentStart, segmentEnd).point;
}

function getGeometryPoints(geometry: OverpassElement["geometry"]) {
  return (
    geometry
      ?.map((point) =>
        typeof point.lat === "number" && typeof point.lon === "number"
          ? { latitude: point.lat, longitude: point.lon }
          : null,
      )
      .filter((point): point is GeoPoint => Boolean(point)) ?? []
  );
}

function getRoadSegmentsFromGeometry(
  geometry: OverpassElement["geometry"],
): RoadGeometrySegment[] {
  const points = getGeometryPoints(geometry);

  if (points.length < 2) {
    return [];
  }

  return points
    .slice(0, -1)
    .map((point, index) => ({
      start: point,
      end: points[index + 1],
    }))
    .filter((segment) => {
      return (
        getDistanceKm(segment.start, segment.end) * 1000 >=
        MIN_ROAD_SEGMENT_LENGTH_METERS
      );
    });
}

function getClosestPointOnPolyline(geometry: OverpassElement["geometry"], origin: GeoPoint) {
  const points = getGeometryPoints(geometry);

  if (points.length === 0) {
    return null;
  }

  if (points.length === 1) {
    return { point: points[0], segment: null };
  }

  let closestPoint = points[0];
  let closestDistanceKm = Number.POSITIVE_INFINITY;
  let closestSegment: [GeoPoint, GeoPoint] | null = null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const projectedPoint = getClosestPointOnSegment(
      origin,
      points[index],
      points[index + 1],
    );
    const distanceKm = getDistanceKm(origin, projectedPoint);

    if (distanceKm < closestDistanceKm) {
      closestDistanceKm = distanceKm;
      closestPoint = projectedPoint;
      closestSegment = [points[index], points[index + 1]];
    }
  }

  return { point: closestPoint, segment: closestSegment };
}

function getRoadEdgeOffsetMeters(tags: Record<string, string>) {
  const highway = tags.highway;

  if (
    tags.footway ||
    highway === "footway" ||
    highway === "pedestrian" ||
    highway === "path" ||
    highway === "steps" ||
    highway === "cycleway"
  ) {
    return 0.8;
  }

  if (highway === "primary" || highway === "secondary" || highway === "tertiary") {
    return 5.2;
  }

  if (tags.amenity === "parking" || tags.amenity === "parking_entrance") {
    return 1.8;
  }

  if (tags.name || tags.ref) {
    return 3.8;
  }

  return 1.4;
}

function getRoundedPointKey(point: GeoPoint) {
  return `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
}

function getRoadGeometrySegmentKey(segment: RoadGeometrySegment) {
  const startKey = getRoundedPointKey(segment.start);
  const endKey = getRoundedPointKey(segment.end);
  const [firstKey, secondKey] =
    startKey < endKey ? [startKey, endKey] : [endKey, startKey];

  return `geom:${firstKey}:${secondKey}`;
}

function getRoadSegmentKey(
  element: OverpassElement,
  segment: RoadGeometrySegment | null,
  point?: GeoPoint,
) {
  if (element.type === "way" && Number.isFinite(element.id)) {
    return `way:${element.id}`;
  }

  if (segment) {
    return getRoadGeometrySegmentKey(segment);
  }

  if (Number.isFinite(element.id)) {
    return `${element.type}:${element.id}`;
  }

  return point ? `point:${getRoundedPointKey(point)}` : "road:unknown";
}

function getProviderPointSegmentKey(point: HandoffProviderPoint) {
  return (
    point.roadSegmentKey ??
    `${point.source}:${point.type}:${getRoundedPointKey(point.point)}`
  );
}

function getDistanceToPolygonMeters(point: GeoPoint, polygon: readonly GeoPoint[]) {
  if (polygon.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  let closestDistanceMeters = Number.POSITIVE_INFINITY;

  for (let index = 0; index < polygon.length; index += 1) {
    const currentPoint = polygon[index];
    const nextPoint = polygon[(index + 1) % polygon.length];
    const closestPoint = getClosestPointOnSegment(point, currentPoint, nextPoint);
    const distanceMeters = getDistanceKm(point, closestPoint) * 1000;

    if (distanceMeters < closestDistanceMeters) {
      closestDistanceMeters = distanceMeters;
    }
  }

  return closestDistanceMeters;
}

function getBuildingClearance(
  point: GeoPoint,
  buildingPolygons: readonly GeoPoint[][],
): BuildingClearance {
  if (buildingPolygons.length === 0) {
    return {
      isClear: true,
      distanceMeters: null,
    };
  }

  let closestBuildingDistanceMeters = Number.POSITIVE_INFINITY;

  for (const polygon of buildingPolygons) {
    if (isPointInPolygon(point, polygon)) {
      return {
        isClear: false,
        distanceMeters: 0,
      };
    }

    const distanceMeters = getDistanceToPolygonMeters(point, polygon);

    if (distanceMeters < closestBuildingDistanceMeters) {
      closestBuildingDistanceMeters = distanceMeters;
    }
  }

  return {
    isClear: closestBuildingDistanceMeters > BUILDING_SAFETY_BUFFER_METERS,
    distanceMeters: closestBuildingDistanceMeters,
  };
}

function getBuildingPolygon(element: OverpassElement) {
  if (!element.tags?.building && !element.tags?.["building:part"]) {
    return null;
  }

  const geometryPoints = getGeometryPoints(element.geometry);
  const centerPoint = getPointFromOverpassElement(element);
  const points = geometryPoints.length > 0 ? geometryPoints : centerPoint ? [centerPoint] : [];

  if (points.length < 3) {
    return null;
  }

  return points;
}

function getPointFromOverpassElement(
  element: OverpassElement,
  origin?: GeoPoint,
): GeoPoint | null {
  const closestGeometryPoint = origin
    ? getClosestPointOnPolyline(element.geometry, origin)?.point
    : null;

  if (closestGeometryPoint) {
    return closestGeometryPoint;
  }

  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return { latitude, longitude };
}

function categoriesContain(categories: readonly string[] | undefined, pattern: string) {
  return categories?.some((category) => category.includes(pattern)) ?? false;
}

function detectLocationType(input: {
  address: GeocodedAddress;
  categories?: readonly string[];
  resultType?: string;
  nearbyCategories?: readonly string[];
}): HandoffLocationType {
  const combinedText = normalizeText(
    [
      input.address.formattedAddress,
      input.address.city,
      input.address.county,
      input.resultType,
      ...(input.categories ?? []),
      ...(input.nearbyCategories ?? []),
    ].join(" "),
  );

  if (
    combinedText.includes("shopping_mall") ||
    combinedText.includes("mall") ||
    combinedText.includes("shopping center") ||
    combinedText.includes("centru comercial")
  ) {
    return "shopping_center";
  }

  if (
    combinedText.includes("school") ||
    combinedText.includes("scoala") ||
    combinedText.includes("liceu") ||
    combinedText.includes("university")
  ) {
    return "school";
  }

  if (
    combinedText.includes("office") ||
    combinedText.includes("company") ||
    combinedText.includes("business") ||
    combinedText.includes("birou")
  ) {
    return "office";
  }

  if (
    combinedText.includes("commercial") ||
    combinedText.includes("shop") ||
    combinedText.includes("store") ||
    combinedText.includes("supermarket") ||
    combinedText.includes("pharmacy")
  ) {
    return "store";
  }

  if (
    combinedText.includes("apartment") ||
    combinedText.includes("residential") ||
    combinedText.includes("bloc") ||
    combinedText.includes("strada") ||
    combinedText.includes("bulevard")
  ) {
    return "residential";
  }

  if (
    combinedText.includes("park") ||
    combinedText.includes("public") ||
    combinedText.includes("station") ||
    combinedText.includes("transport")
  ) {
    return "public_area";
  }

  return "unknown";
}

function labelForProviderPoint(
  point: Pick<HandoffProviderPoint, "type" | "source" | "categories">,
  locationType: HandoffLocationType,
) {
  if (point.type === "parking") {
    return "Lângă parcare";
  }

  if (point.type === "street_side" || point.type === "curbside") {
    return "Punct lângă stradă";
  }

  if (point.type === "storefront") {
    return "Lângă intrare";
  }

  if (point.type === "access") {
    return "Acces pietonal";
  }

  if (point.type === "building_side") {
    return "Acces pietonal";
  }

  if (locationType === "shopping_center" || categoriesContain(point.categories, "commercial")) {
    return "Lângă intrare";
  }

  if (point.source === "geoapify_details") {
    return "Punct recomandat";
  }

  return "Acces pietonal";
}

function getEligibility(
  isAddressEligible: boolean,
  point: GeoPoint,
): HandoffPoint["eligibility"] {
  if (!isAddressEligible) {
    return {
      state: "outside",
      message: getServiceAreaUnavailableMessage(),
    };
  }

  const eligibility = isPointInServiceArea(point);

  if (!eligibility.isCovered) {
    return {
      state: "outside",
      message: getServiceAreaUnavailableMessage(),
    };
  }

  return {
    state: eligibility.distanceKm >= 5.5 ? "review" : "eligible",
    message: eligibility.message,
  };
}

function getProximityBonus(distanceFromOriginMeters: number) {
  if (distanceFromOriginMeters < 5) {
    return -8;
  }

  if (distanceFromOriginMeters <= 60) {
    return 24;
  }

  if (distanceFromOriginMeters <= 100) {
    return 12;
  }

  if (distanceFromOriginMeters <= 150) {
    return 2;
  }

  return -30;
}

function formatDistanceFromSelectedAddress(distanceMeters: number) {
  return `La ${Math.round(distanceMeters)} m de adresa selectată`;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toHandoffPoint(
  providerPoint: HandoffProviderPoint,
  index: number,
  request: HandoffPointRequest,
  locationType: HandoffLocationType,
): HandoffPoint {
  const distanceFromOriginMeters = Math.round(
    getDistanceKm(request.address.location, providerPoint.point) * 1000,
  );
  const eligibility = getEligibility(
    request.isAddressEligible,
    providerPoint.point,
  );
  const eligibilityBonus =
    eligibility.state === "outside" ? -65 : eligibility.state === "review" ? 6 : 18;
  const smartScore = clampScore(
    providerPoint.baseScore +
      sourceScore[providerPoint.source] +
      confidenceScore[providerPoint.confidence] +
      fieldTypeBonuses[request.field][providerPoint.type] +
      getProximityBonus(distanceFromOriginMeters) +
      eligibilityBonus,
  );
  const fieldPrefix = request.field === "pickup" ? "pickup" : "dropoff";

  return {
    id: `${fieldPrefix}-${providerPoint.source}-${providerPoint.type}-${index + 1}`,
    label: providerPoint.label || labelForProviderPoint(providerPoint, locationType),
    point: providerPoint.point,
    type: providerPoint.type,
    description:
      eligibility.state === "outside"
        ? eligibility.message
        : providerPoint.reason,
    reason: providerPoint.reason,
    source: providerPoint.source,
    confidence: providerPoint.confidence,
    eligibility,
    eligibilityState: eligibility.state,
    suitabilityScore: clampScore(providerPoint.baseScore + sourceScore[providerPoint.source]),
    smartScore,
    distanceFromOriginMeters,
    recommendationState: eligibility.state === "outside" ? "unavailable" : "alternative",
    locationType,
  };
}

function dedupeProviderPoints<T extends HandoffProviderPoint>(points: T[]) {
  const accepted: T[] = [];

  for (const point of points) {
    const duplicatesExistingPoint = accepted.some((currentPoint) => {
      return (
        getDistanceKm(currentPoint.point, point.point) * 1000 <
        MIN_POINT_SEPARATION_METERS
      );
    });

    if (!duplicatesExistingPoint) {
      accepted.push(point);
    }
  }

  return accepted;
}

function isPreferredAccessType(type: CandidatePoint["type"]) {
  return (
    type === "street_side" ||
    type === "curbside" ||
    type === "access" ||
    type === "public_point"
  );
}

function isUsableProviderPoint(point: HandoffProviderPoint, origin: GeoPoint) {
  const distanceMeters = getDistanceKm(origin, point.point) * 1000;
  const isRoadValidated =
    point.source === "osm_overpass" &&
    Boolean(point.roadSegmentKey) &&
    typeof point.roadDistanceMeters === "number" &&
    point.roadDistanceMeters <= ROAD_VALIDATION_MAX_DISTANCE_METERS;

  return (
    isRoadValidated &&
    point.type !== "building_side" &&
    distanceMeters >= MIN_USABLE_MEETING_POINT_DISTANCE_METERS &&
    distanceMeters <= MAX_USABLE_MEETING_POINT_DISTANCE_METERS &&
    isPointInServiceArea(point.point).isCovered
  );
}

function getDirectionalPointPriority(point: HandoffProviderPoint) {
  if (point.type === "street_side" || point.type === "curbside") {
    return 0;
  }

  if (point.type === "access" || point.type === "public_point") {
    return 1;
  }

  if (point.type === "parking") {
    return 2;
  }

  if (point.type === "entrance" || point.type === "storefront") {
    return 3;
  }

  return 4;
}

function withCardinalDirection(
  point: HandoffProviderPoint,
  origin: GeoPoint,
): DirectedHandoffProviderPoint {
  const direction = point.direction ?? getCardinalDirection(origin, point.point);

  return {
    ...point,
    direction,
  };
}

function selectDirectionalProviderPoints(
  points: readonly HandoffProviderPoint[],
  origin: GeoPoint,
) {
  function getDistanceMeters(point: HandoffProviderPoint) {
    return getDistanceKm(origin, point.point) * 1000;
  }

  function getSelectionRank(
    point: DirectedHandoffProviderPoint,
    currentSelection: readonly DirectedHandoffProviderPoint[] = [],
  ) {
    const distanceMeters = getDistanceMeters(point);
    const idealDistancePenalty = Math.abs(
      distanceMeters - IDEAL_STREET_SIDE_DISTANCE_METERS,
    );
    const roadDistancePenalty =
      typeof point.roadDistanceMeters === "number"
        ? Math.max(0, point.roadDistanceMeters - 2.8) * 3.2
        : 28;
    const repeatedDirectionPenalty = currentSelection.some(
      (selectedPoint) => selectedPoint.direction === point.direction,
    )
      ? 18
      : 0;

    return (
      getDirectionalPointPriority(point) * 18 +
      distanceMeters * 1.9 +
      idealDistancePenalty * 0.12 +
      roadDistancePenalty +
      (100 - point.baseScore) * 0.25 +
      repeatedDirectionPenalty
    );
  }

  function isDistinctFromSelected(point: HandoffProviderPoint) {
    return !selected.some((selectedPoint) => {
      return (
        getDistanceKm(selectedPoint.point, point.point) * 1000 <
        MIN_POINT_SEPARATION_METERS
      );
    });
  }

  function hasSelectedRoadSegment(point: HandoffProviderPoint) {
    const segmentKey = getProviderPointSegmentKey(point);

    return selected.some(
      (selectedPoint) => getProviderPointSegmentKey(selectedPoint) === segmentKey,
    );
  }

  function canSelectPoint(
    point: DirectedHandoffProviderPoint,
    options: { requireDistinctRoadSegment: boolean },
  ) {
    return (
      isDistinctFromSelected(point) &&
      (!options.requireDistinctRoadSegment || !hasSelectedRoadSegment(point))
    );
  }

  function selectBestPoint(
    candidates: readonly DirectedHandoffProviderPoint[],
    options: { requireDistinctRoadSegment: boolean },
  ) {
    const bestPoint = candidates
      .filter((point) => canSelectPoint(point, options))
      .sort(
        (left, right) =>
          getSelectionRank(left, selected) - getSelectionRank(right, selected),
      )[0];

    if (!bestPoint) {
      return false;
    }

    selected.push(bestPoint);
    return true;
  }

  function selectBestPointForDirection(
    direction: HandoffCardinalDirection,
    options: { requireDistinctRoadSegment: boolean },
  ) {
    const bestPoint = dedupedDirectionalPoints
      .filter(
        (point) =>
          point.direction === direction &&
          !selected.some(
            (selectedPoint) => selectedPoint.direction === direction,
          ) &&
          canSelectPoint(point, options),
      )
      .sort(
        (left, right) =>
          getSelectionRank(left, selected) - getSelectionRank(right, selected),
      )[0];

    if (!bestPoint) {
      return false;
    }

    selected.push(bestPoint);
    return true;
  }

  function selectDirectionalCoverage(options: {
    requireDistinctRoadSegment: boolean;
  }) {
    let selectedAnyDirection = false;

    while (selected.length < MAX_HANDOFF_POINTS) {
      const nextDirection = CARDINAL_DIRECTIONS.map((direction) => {
        const bestPoint = dedupedDirectionalPoints
          .filter(
            (point) =>
              point.direction === direction &&
              !selected.some(
                (selectedPoint) => selectedPoint.direction === direction,
              ) &&
              canSelectPoint(point, options),
          )
          .sort(
            (left, right) =>
              getSelectionRank(left, selected) -
              getSelectionRank(right, selected),
          )[0];

        return bestPoint ? { direction, point: bestPoint } : null;
      })
        .filter(
          (
            entry,
          ): entry is {
            direction: HandoffCardinalDirection;
            point: DirectedHandoffProviderPoint;
          } => Boolean(entry),
        )
        .sort(
          (left, right) =>
            getSelectionRank(left.point, selected) -
            getSelectionRank(right.point, selected),
        )[0]?.direction;

      if (!nextDirection) {
        break;
      }

      selectedAnyDirection =
        selectBestPointForDirection(nextDirection, options) ||
        selectedAnyDirection;
    }

    return selectedAnyDirection;
  }

  const directionalPoints = points
    .map((point) => withCardinalDirection(point, origin))
    .filter((point) => {
      const distanceMeters = getDistanceMeters(point);

      return (
        distanceMeters >= MIN_USABLE_MEETING_POINT_DISTANCE_METERS &&
        distanceMeters <= MAX_USABLE_MEETING_POINT_DISTANCE_METERS
      );
    })
    .sort((left, right) => {
      return getSelectionRank(left) - getSelectionRank(right);
    });
  const dedupedDirectionalPoints = dedupeProviderPoints(directionalPoints);
  const selected: DirectedHandoffProviderPoint[] = [];
  const bestPointBySegment = new Map<string, DirectedHandoffProviderPoint>();

  for (const point of dedupedDirectionalPoints) {
    const segmentKey = getProviderPointSegmentKey(point);
    const existingPoint = bestPointBySegment.get(segmentKey);

    if (!existingPoint || getSelectionRank(point) < getSelectionRank(existingPoint)) {
      bestPointBySegment.set(segmentKey, point);
    }
  }

  const segmentDiversePoints = [...bestPointBySegment.values()].sort(
    (left, right) => getSelectionRank(left) - getSelectionRank(right),
  );

  selectDirectionalCoverage({ requireDistinctRoadSegment: true });
  selectDirectionalCoverage({ requireDistinctRoadSegment: false });

  while (selected.length < MAX_HANDOFF_POINTS) {
    const selectedNextPoint = selectBestPoint(segmentDiversePoints, {
      requireDistinctRoadSegment: true,
    });

    if (!selectedNextPoint) {
      break;
    }
  }

  for (const point of dedupedDirectionalPoints) {
    if (selected.length >= MAX_HANDOFF_POINTS) {
      break;
    }

    if (canSelectPoint(point, { requireDistinctRoadSegment: false })) {
      selected.push(point);
    }
  }

  return selected.slice(0, MAX_HANDOFF_POINTS);
}

function markRecommendations(points: HandoffPoint[]) {
  const selectablePoints = [...points]
    .filter((point) => point.eligibilityState !== "outside")
    .sort((left, right) => right.smartScore - left.smartScore);
  const recommendedPointId =
    selectablePoints.find((point) => isPreferredAccessType(point.type))?.id ??
    selectablePoints[0]?.id ??
    null;
  const alternativePointIds = new Set(
    selectablePoints
      .filter((point) => point.id !== recommendedPointId)
      .slice(0, 3)
      .map((point) => point.id),
  );

  return points.map((point) => {
    if (point.id === recommendedPointId) {
      return {
        ...point,
        recommendationState: "recommended",
        label:
          point.source === "inferred" && point.confidence !== "high"
            ? point.label
            : point.label,
      } satisfies HandoffPoint;
    }

    if (alternativePointIds.has(point.id)) {
      return {
        ...point,
        recommendationState: "alternative",
      } satisfies HandoffPoint;
    }

    return {
      ...point,
      recommendationState:
        point.eligibilityState === "outside" ? "unavailable" : "alternative",
    } satisfies HandoffPoint;
  });
}

function cleanStreetName(value?: string | null) {
  const trimmedValue = value
    ?.replace(/\s+/g, " ")
    .replace(/,\s*Romania$/i, "")
    .trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue
    .replace(/^Strada\s+Strada\s+/i, "Strada ")
    .replace(/^Street\s+/i, "Strada ");
}

function getStreetExitName(result: GeoapifyAutocompleteResult | null | undefined) {
  if (!result) {
    return null;
  }

  const streetName = cleanStreetName(result.street);

  if (streetName) {
    return /^strada\s/i.test(streetName)
      ? `Ieșire la ${streetName}`
      : `Ieșire la Strada ${streetName}`;
  }

  const addressLine = cleanStreetName(result.address_line1);

  if (addressLine) {
    return /^strada\s/i.test(addressLine)
      ? `Ieșire la ${addressLine}`
      : `Ieșire la ${addressLine}`;
  }

  const namedPlace = cleanStreetName(result.name);

  if (namedPlace) {
    return `Ieșire lângă ${namedPlace}`;
  }

  return null;
}

async function fetchGeoapifyPointName(point: GeoPoint, apiKey: string) {
  const url = new URL(GEOAPIFY_REVERSE_GEOCODING_URL);

  url.searchParams.set("lat", String(point.latitude));
  url.searchParams.set("lon", String(point.longitude));
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "ro");
  url.searchParams.set("apiKey", apiKey);

  const data = await fetchJsonWithTimeout<GeoapifyReverseGeocodingResponse>(
    url.toString(),
    { timeoutMs: 1800 },
  );

  return getStreetExitName(data.results?.[0]);
}

export async function enrichHandoffPointNamesWithGeoapify(
  response: HandoffPointResponse,
  apiKey: string | null,
): Promise<HandoffPointResponse> {
  if (!apiKey || response.points.length === 0) {
    return response;
  }

  const enrichedPoints = await Promise.all(
    response.points.map(async (point) => {
      const streetExitName = await fetchGeoapifyPointName(point.point, apiKey).catch(
        () => null,
      );

      if (!streetExitName) {
        return {
          ...point,
          description:
            point.description ??
            formatDistanceFromSelectedAddress(point.distanceFromOriginMeters),
          reason:
            point.reason ??
            formatDistanceFromSelectedAddress(point.distanceFromOriginMeters),
        };
      }

      return {
        ...point,
        description: `${streetExitName}. ${formatDistanceFromSelectedAddress(
          point.distanceFromOriginMeters,
        )}`,
        reason: streetExitName,
      };
    }),
  );

  return {
    ...response,
    points: enrichedPoints,
  };
}

export function buildInferredHandoffPoints(
  request: HandoffPointRequest,
): HandoffPoint[] {
  const origin = request.address.location;
  const inferredLocationType = detectLocationType({
    address: request.address,
    categories: request.suggestion?.categories,
    resultType: request.suggestion?.resultType,
  });
  const fieldPrefix = request.field === "pickup" ? "pickup" : "dropoff";
  const points: HandoffPoint[] = [];

  CARDINAL_DIRECTIONS.forEach((direction, index) => {
    const offset = INFERRED_SIDEWALK_OFFSETS[direction];
    const point = fromLocalMeters(offset, origin);

    if (
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude)
    ) {
      return;
    }

    const distanceFromOriginMeters = Math.round(
      getDistanceKm(origin, point) * 1000,
    );
    const eligibility = getEligibility(request.isAddressEligible, point);
    const eligibilityBonus =
      eligibility.state === "outside"
        ? -65
        : eligibility.state === "review"
          ? 6
          : 18;
    const baseScore = 70;
    const smartScore = clampScore(
      baseScore +
        sourceScore.inferred +
        confidenceScore.low +
        fieldTypeBonuses[request.field].street_side +
        getProximityBonus(distanceFromOriginMeters) +
        eligibilityBonus,
    );

    points.push({
      id: `${fieldPrefix}-inferred-${direction}-${index + 1}`,
      label: "Punct estimat lângă stradă",
      point,
      type: "street_side",
      description:
        eligibility.state === "outside"
          ? eligibility.message
          : formatDistanceFromSelectedAddress(distanceFromOriginMeters),
      reason: formatDistanceFromSelectedAddress(distanceFromOriginMeters),
      source: "inferred",
      confidence: "low",
      eligibility,
      eligibilityState: eligibility.state,
      suitabilityScore: clampScore(baseScore + sourceScore.inferred),
      smartScore,
      distanceFromOriginMeters,
      recommendationState:
        eligibility.state === "outside" ? "unavailable" : "alternative",
      locationType: inferredLocationType,
    });
  });

  return markRecommendations(points.slice(0, MAX_HANDOFF_POINTS));
}

function providerPointFromGeoapifyFeature(
  feature: GeoapifyFeature,
  source: HandoffPointSource,
): HandoffProviderPoint | null {
  const point = getPointFromFeature(feature);
  const properties = feature.properties;
  const categories = properties?.categories ?? [];

  if (!point || !properties) {
    return null;
  }

  const hasMappedAccessCategory =
    categoriesContain(categories, "parking") ||
    categoriesContain(categories, "public_transport") ||
    categoriesContain(categories, "service");
  const isBuildingOnly =
    categoriesContain(categories, "building") &&
    !categoriesContain(categories, "parking") &&
    !categoriesContain(categories, "commercial") &&
    !categoriesContain(categories, "public_transport") &&
    !categoriesContain(categories, "service");

  if (isBuildingOnly || !hasMappedAccessCategory) {
    return null;
  }

  const name = properties.name ?? properties.address_line1 ?? properties.formatted;
  const type: CandidatePoint["type"] = categoriesContain(categories, "parking")
    ? "parking"
    : categoriesContain(categories, "public_transport")
      ? "access"
      : categoriesContain(categories, "commercial")
        ? "entrance"
        : source === "geoapify_details"
          ? "access"
          : "access";
  const reason = categoriesContain(categories, "parking")
    ? "Acces de parcare gasit aproape de adresa selectata."
    : categoriesContain(categories, "public_transport")
      ? "Acces pietonal sau public gasit aproape de adresa selectata."
      : categoriesContain(categories, "commercial")
        ? "Acces exterior comercial gasit aproape de adresa selectata."
        : source === "geoapify_details"
          ? "Acces mapat gasit in jurul adresei selectate."
          : "Punct de acces mapat aproape de adresa selectata.";

  return {
    label: labelForProviderPoint({ type, source, categories }, "unknown"),
    type,
    point,
    source,
    confidence: source === "geoapify_details" ? "high" : "medium",
    reason: name ? `${reason} ${name}` : reason,
    baseScore: source === "geoapify_details" ? 76 : 70,
    categories,
  };
}

function getRoadCandidatePointsNearSegment(
  segment: RoadGeometrySegment,
  origin: GeoPoint,
  edgeOffsetMeters: number,
) {
  const projection = getSegmentProjection(origin, segment.start, segment.end);

  if (
    projection.segmentLengthMeters < MIN_ROAD_SEGMENT_LENGTH_METERS ||
    projection.distanceMeters >
      MAX_USABLE_MEETING_POINT_DISTANCE_METERS +
        ROAD_VALIDATION_MAX_DISTANCE_METERS
  ) {
    return [];
  }

  const localStart = toLocalMeters(segment.start, projection.point);
  const localEnd = toLocalMeters(segment.end, projection.point);
  const segmentX = localEnd.x - localStart.x;
  const segmentY = localEnd.y - localStart.y;
  const segmentLength = Math.hypot(segmentX, segmentY);

  if (segmentLength === 0) {
    return [];
  }

  const tangent = {
    x: segmentX / segmentLength,
    y: segmentY / segmentLength,
  };
  const normal = {
    x: -tangent.y,
    y: tangent.x,
  };
  const alongOffsets = [0];
  const lateralOffsets = [edgeOffsetMeters];

  return alongOffsets.flatMap((alongOffsetMeters) => {
    return lateralOffsets.flatMap((lateralOffsetMeters) => {
      return [-1, 1].map((sideMultiplier) => {
        const lateralOffset = lateralOffsetMeters * sideMultiplier;

        return {
          point: fromLocalMeters(
            {
              x: tangent.x * alongOffsetMeters + normal.x * lateralOffset,
              y: tangent.y * alongOffsetMeters + normal.y * lateralOffset,
            },
            projection.point,
          ),
          roadDistanceMeters: Math.abs(lateralOffset),
          originToRoadDistanceMeters: projection.distanceMeters,
        };
      });
    });
  });
}

function isValidRoadCandidate(input: {
  point: GeoPoint;
  roadDistanceMeters: number;
  origin: GeoPoint;
  originToRoadDistanceMeters: number;
  buildingPolygons: readonly GeoPoint[][];
}) {
  const distanceFromOriginMeters = getDistanceKm(input.origin, input.point) * 1000;

  if (
    distanceFromOriginMeters < MIN_USABLE_MEETING_POINT_DISTANCE_METERS ||
    distanceFromOriginMeters > MAX_USABLE_MEETING_POINT_DISTANCE_METERS ||
    input.roadDistanceMeters > ROAD_VALIDATION_MAX_DISTANCE_METERS ||
    !isPointInServiceArea(input.point).isCovered
  ) {
    return false;
  }

  const buildingClearance = getBuildingClearance(
    input.point,
    input.buildingPolygons,
  );

  if (!buildingClearance.isClear) {
    return false;
  }

  return true;
}

function getRoadCandidateBaseScore(input: {
  distanceFromOriginMeters: number;
  roadDistanceMeters: number;
  edgeOffsetMeters: number;
  buildingClearanceMeters: number | null;
}) {
  const idealDistancePenalty = Math.abs(
    input.distanceFromOriginMeters - IDEAL_STREET_SIDE_DISTANCE_METERS,
  );
  const roadOffsetPenalty =
    Math.abs(input.roadDistanceMeters - input.edgeOffsetMeters) * 3.2;
  const buildingPenalty =
    input.buildingClearanceMeters !== null &&
    input.buildingClearanceMeters < BUILDING_SAFETY_BUFFER_METERS + 4
      ? (BUILDING_SAFETY_BUFFER_METERS +
          4 -
          input.buildingClearanceMeters) *
        1.8
      : 0;

  return clampScore(
    98 - idealDistancePenalty * 0.04 - roadOffsetPenalty - buildingPenalty,
  );
}

function providerPointsFromOverpassElement(
  element: OverpassElement,
  origin: GeoPoint,
  buildingPolygons: readonly GeoPoint[][],
): HandoffProviderPoint[] {
  const tags = element.tags ?? {};
  const highway = tags.highway;
  const isMappedRoadAccess =
    Boolean(highway) &&
    ![
      "construction",
      "proposed",
      "motorway",
      "motorway_link",
      "trunk",
      "trunk_link",
      "raceway",
      "corridor",
      "elevator",
    ].includes(highway);
  const isRoadAccess =
    isMappedRoadAccess ||
    Boolean(tags.footway) ||
    highway === "footway" ||
    highway === "pedestrian" ||
    highway === "path" ||
    highway === "steps" ||
    highway === "cycleway" ||
    highway === "crossing" ||
    highway === "residential" ||
    highway === "service" ||
    highway === "living_street" ||
    highway === "unclassified" ||
    highway === "primary" ||
    highway === "secondary" ||
    highway === "tertiary" ||
    highway === "bus_stop" ||
    tags.service === "driveway" ||
    tags.service === "parking_aisle" ||
    tags.service === "alley" ||
    tags.amenity === "parking" ||
    tags.amenity === "parking_entrance";

  if (!isRoadAccess) {
    return [];
  }

  const edgeOffsetMeters = getRoadEdgeOffsetMeters(tags);
  const segments = getRoadSegmentsFromGeometry(element.geometry);
  const roadName = cleanStreetName(tags.name ?? tags.ref);

  if (segments.length === 0) {
    const fallbackPoint = getPointFromOverpassElement(element, origin);

    if (
      !fallbackPoint ||
      !isValidRoadCandidate({
        point: fallbackPoint,
        roadDistanceMeters: 0,
        origin,
        originToRoadDistanceMeters:
          getDistanceKm(origin, fallbackPoint) * 1000,
        buildingPolygons,
      })
    ) {
      return [];
    }

    const distanceFromOriginMeters = getDistanceKm(origin, fallbackPoint) * 1000;

    return [
      {
        label: "Punct apropiat",
        type: "access",
        point: fallbackPoint,
        source: "osm_overpass",
        confidence: "medium",
        reason: formatDistanceFromSelectedAddress(distanceFromOriginMeters),
        baseScore: 72,
        direction: getCardinalDirection(origin, fallbackPoint),
        roadDistanceMeters: 0,
        roadName,
        roadSegmentKey: getRoadSegmentKey(element, null, fallbackPoint),
        roadWayId:
          element.type === "way" && Number.isFinite(element.id)
            ? String(element.id)
            : undefined,
      },
    ];
  }

  return segments.flatMap((segment) => {
    const segmentKey = getRoadSegmentKey(element, segment);
    const candidatePoints = getRoadCandidatePointsNearSegment(
      segment,
      origin,
      edgeOffsetMeters,
    );

    return candidatePoints
      .filter((candidatePoint) =>
        isValidRoadCandidate({
          point: candidatePoint.point,
          roadDistanceMeters: candidatePoint.roadDistanceMeters,
          origin,
          originToRoadDistanceMeters:
            candidatePoint.originToRoadDistanceMeters,
          buildingPolygons,
        }),
      )
      .map((candidatePoint) => {
        const distanceFromOriginMeters =
          getDistanceKm(origin, candidatePoint.point) * 1000;
        const buildingClearance = getBuildingClearance(
          candidatePoint.point,
          buildingPolygons,
        );

        return {
          label: "Punct lângă stradă",
          type: "street_side",
          point: candidatePoint.point,
          source: "osm_overpass",
          confidence: "high",
          reason: formatDistanceFromSelectedAddress(distanceFromOriginMeters),
          baseScore: getRoadCandidateBaseScore({
            distanceFromOriginMeters,
            roadDistanceMeters: candidatePoint.roadDistanceMeters,
            edgeOffsetMeters,
            buildingClearanceMeters: buildingClearance.distanceMeters,
          }),
          direction: getCardinalDirection(origin, candidatePoint.point),
          roadDistanceMeters: candidatePoint.roadDistanceMeters,
          roadName,
          roadSegmentKey: segmentKey,
          roadWayId:
            element.type === "way" && Number.isFinite(element.id)
              ? String(element.id)
              : undefined,
        } satisfies HandoffProviderPoint;
      });
  });
}

async function fetchJsonWithTimeout<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 2200);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

const overpassCache = new Map<
  string,
  { expiresAt: number; data: OverpassResponse }
>();

function getOverpassCacheKey(
  origin: GeoPoint,
  label: "road" | "building",
) {
  return `${origin.latitude.toFixed(OVERPASS_CACHE_PRECISION)},${origin.longitude.toFixed(OVERPASS_CACHE_PRECISION)}:${label}`;
}

async function fetchOverpassQuery(
  origin: GeoPoint,
  label: "road" | "building",
  query: string,
  options: {
    endpoints?: readonly string[];
    timeoutMs?: number;
  } = {},
): Promise<OverpassResponse> {
  const key = getOverpassCacheKey(origin, label);
  const cached = overpassCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const endpoints = options.endpoints ?? [DEFAULT_OVERPASS_URL, ...OVERPASS_MIRROR_URLS];
  const timeoutMs = options.timeoutMs ?? OVERPASS_ENDPOINT_TIMEOUT_MS;

  try {
    const data = await Promise.any(
      endpoints.map((url) =>
        fetchJsonWithTimeout<OverpassResponse>(url, {
          method: "POST",
          timeoutMs,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": OVERPASS_USER_AGENT,
          },
          body: new URLSearchParams({ data: query }).toString(),
        }),
      ),
    );
    overpassCache.set(key, {
      expiresAt: Date.now() + OVERPASS_CACHE_TTL_MS,
      data,
    });
    return data;
  } catch {
    return { elements: [] };
  }
}

async function fetchRoadOverpassQuery(origin: GeoPoint, query: string) {
  return fetchOverpassQuery(origin, "road", query);
}

async function fetchBuildingOverpassQuery(origin: GeoPoint, query: string) {
  return fetchOverpassQuery(origin, "building", query, {
    endpoints: [DEFAULT_OVERPASS_URL],
    timeoutMs: OVERPASS_BUILDING_TIMEOUT_MS,
  });
}

export async function fetchGeoapifyPlacesHandoffPoints(
  request: HandoffPointRequest,
  apiKey: string,
) {
  const url = new URL(GEOAPIFY_PLACES_URL);
  const { latitude, longitude } = request.address.location;

  url.searchParams.set(
    "categories",
    [
      "parking",
      "public_transport",
      "service",
    ].join(","),
  );
  url.searchParams.set("filter", `circle:${longitude},${latitude},${HANDOFF_RADIUS_METERS}`);
  url.searchParams.set("bias", `proximity:${longitude},${latitude}`);
  url.searchParams.set("limit", "18");
  url.searchParams.set("lang", "ro");
  url.searchParams.set("apiKey", apiKey);

  const data = await fetchJsonWithTimeout<GeoapifyFeatureCollection>(url.toString());

  return (data.features ?? [])
    .map((feature) => providerPointFromGeoapifyFeature(feature, "geoapify_places"))
    .filter((point): point is HandoffProviderPoint => Boolean(point));
}

export async function fetchGeoapifyDetailsHandoffPoints(
  request: HandoffPointRequest,
  apiKey: string,
) {
  const placeId = request.suggestion?.placeId ?? request.suggestion?.id;
  const { latitude, longitude } = request.address.location;
  const url = new URL(GEOAPIFY_PLACE_DETAILS_URL);

  if (placeId) {
    url.searchParams.set("id", placeId);
  } else {
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
  }

  url.searchParams.set("features", "details,building,radius_100");
  url.searchParams.set("lang", "ro");
  url.searchParams.set("apiKey", apiKey);

  const data = await fetchJsonWithTimeout<GeoapifyFeatureCollection>(url.toString());

  return (data.features ?? [])
    .map((feature) => providerPointFromGeoapifyFeature(feature, "geoapify_details"))
    .filter((point): point is HandoffProviderPoint => Boolean(point));
}

export async function fetchOverpassHandoffPoints(request: HandoffPointRequest) {
  const { latitude, longitude } = request.address.location;
  const roadQuery = `
    [out:json][timeout:5];
    way["highway"](around:${OVERPASS_ROAD_SEARCH_RADIUS_METERS},${latitude},${longitude});
    out geom;
  `;
  const buildingQuery = `
    [out:json][timeout:2];
    (
      way["building"](around:${OVERPASS_BUILDING_SEARCH_RADIUS_METERS},${latitude},${longitude});
      way["building:part"](around:${OVERPASS_BUILDING_SEARCH_RADIUS_METERS},${latitude},${longitude});
    );
    out geom;
  `;

  const [roadData, buildingData] = await Promise.all([
    fetchRoadOverpassQuery(request.address.location, roadQuery),
    fetchBuildingOverpassQuery(request.address.location, buildingQuery),
  ]);

  const roadElements = roadData.elements ?? [];
  const buildingPolygons = (buildingData.elements ?? [])
    .map(getBuildingPolygon)
    .filter((polygon): polygon is GeoPoint[] => Boolean(polygon));

  return roadElements
    .flatMap((element) =>
      providerPointsFromOverpassElement(
        element,
        request.address.location,
        buildingPolygons,
      ),
    )
    .filter((point): point is HandoffProviderPoint => Boolean(point))
    .filter((point) => getBuildingClearance(point.point, buildingPolygons).isClear);
}

export function buildHandoffPointResponse(
  request: HandoffPointRequest,
  providerPoints: HandoffProviderPoint[],
): HandoffPointResponse {
  const inferredLocationType = detectLocationType({
    address: request.address,
    categories: request.suggestion?.categories,
    resultType: request.suggestion?.resultType,
    nearbyCategories: providerPoints.flatMap((point) => point.categories ?? []),
  });
  const usableProviderPoints = providerPoints.filter((point) =>
    isUsableProviderPoint(point, request.address.location),
  );
  const mergedProviderPoints = selectDirectionalProviderPoints(
    usableProviderPoints,
    request.address.location,
  );
  const providerHandoffPoints = markRecommendations(
    mergedProviderPoints
      .map((point, index) => toHandoffPoint(point, index, request, inferredLocationType))
      .sort((left, right) => right.smartScore - left.smartScore)
      .slice(0, MAX_HANDOFF_POINTS),
  );
  const points =
    providerHandoffPoints.length > 0
      ? providerHandoffPoints
      : buildInferredHandoffPoints(request);
  const sourcesUsed = Array.from(
    new Set(points.map((point) => point.source ?? "inferred")),
  ) as HandoffPointSource[];

  return {
    points,
    locationType: inferredLocationType,
    sourcesUsed,
  };
}
