export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type ServiceAreaMode = "radius" | "polygon";

export type RadiusServiceArea = {
  mode: "radius";
  center: GeoPoint;
  radiusKm: number;
};

export type PolygonServiceArea = {
  mode: "polygon";
  polygon: GeoPoint[];
};

export type ServiceAreaDefinition = RadiusServiceArea | PolygonServiceArea;

export type GeocodedAddress = {
  formattedAddress: string;
  location: GeoPoint;
  city?: string | null;
  county?: string | null;
  country?: string | null;
  postalCode?: string | null;
};

export type CoverageStatusMessages = {
  available: string;
  outside: string;
  unsupported: string;
  review: string;
};

export type ServiceAreaConfig = {
  cityName: string;
  county: string;
  country: string;
  center: GeoPoint;
  coverageRadiusKm: number;
  activeMode: ServiceAreaMode;
  fallbackMode: "radius";
  area: ServiceAreaDefinition;
  futurePolygonArea: PolygonServiceArea | null;
  statusMessages: CoverageStatusMessages;
};

export type ServiceAreaCheckResult = {
  isCovered: boolean;
  modeUsed: ServiceAreaMode;
  distanceKm: number;
  message: string;
};
