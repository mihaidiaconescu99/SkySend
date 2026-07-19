import { serviceAreaConfig } from "@/constants/service-area";
import { readOperationalSettings } from "@/lib/admin-data";
import { calculateDistanceKm } from "@/lib/geo/distance";
import { isPointInPolygon } from "@/lib/geo/polygon";
import type {
  GeoPoint,
  GeocodedAddress,
  PolygonServiceArea,
  ServiceAreaCheckResult,
  ServiceAreaConfig,
} from "@/types/service-area";

const REVIEW_MARGIN_KM = 0.35;

export const getDistanceKm = calculateDistanceKm;

export function getOperationalServiceAreaConfig(
  config: ServiceAreaConfig = serviceAreaConfig,
) {
  const settings = readOperationalSettings();
  const serviceRadiusKm = settings.serviceRadiusKm || config.coverageRadiusKm;

  return {
    ...config,
    coverageRadiusKm: serviceRadiusKm,
    area:
      config.area.mode === "radius"
        ? {
            ...config.area,
            radiusKm: serviceRadiusKm,
          }
        : config.area,
  } satisfies ServiceAreaConfig;
}

function normalizeLocationValue(value?: string | null) {
  return value
    ?.trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("ro-RO");
}

function getPolygonDistanceKm(point: GeoPoint, area: PolygonServiceArea) {
  return area.polygon.reduce((closestDistance, vertex) => {
    return Math.min(closestDistance, calculateDistanceKm(point, vertex));
  }, Number.POSITIVE_INFINITY);
}

export function getServiceAreaUnavailableMessage(
  config: ServiceAreaConfig = getOperationalServiceAreaConfig(),
) {
  return config.statusMessages.outside;
}

export function isPointInServiceArea(
  point: GeoPoint,
  config: ServiceAreaConfig = getOperationalServiceAreaConfig(),
): ServiceAreaCheckResult {
  if (config.area.mode === "polygon") {
    const isCovered = isPointInPolygon(point, config.area.polygon);
    const distanceKm = getPolygonDistanceKm(point, config.area);

    return {
      isCovered,
      modeUsed: "polygon",
      distanceKm,
      message: isCovered
        ? config.statusMessages.available
        : config.statusMessages.outside,
    };
  }

  const distanceKm = calculateDistanceKm(point, config.area.center);
  const isCovered = distanceKm <= config.area.radiusKm;

  return {
    isCovered,
    modeUsed: "radius",
    distanceKm,
    message: isCovered
      ? config.statusMessages.available
      : config.statusMessages.outside,
  };
}

export function isGeocodedAddressEligible(
  address: GeocodedAddress,
  config: ServiceAreaConfig = getOperationalServiceAreaConfig(),
) {
  const coverage = isPointInServiceArea(address.location, config);
  const cityMatches =
    normalizeLocationValue(address.city) === normalizeLocationValue(config.cityName);
  const countyMatches =
    normalizeLocationValue(address.county) === normalizeLocationValue(config.county);
  const countryMatches =
    normalizeLocationValue(address.country) === normalizeLocationValue(config.country);

  const needsManualReview =
    coverage.distanceKm >= config.coverageRadiusKm - REVIEW_MARGIN_KM ||
    !cityMatches ||
    !countyMatches ||
    !countryMatches;

  return {
    isEligible: coverage.isCovered && cityMatches && countyMatches && countryMatches,
    needsManualReview: coverage.isCovered && needsManualReview,
    coverage,
    message:
      coverage.isCovered && needsManualReview
        ? config.statusMessages.review
        : coverage.message,
  };
}
