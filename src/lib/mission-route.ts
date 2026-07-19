import { droneFleetById, legacyDroneClassMap } from "@/constants/drone-fleet";
import { activeHub } from "@/constants/hub";
import { defaultMissionDurations } from "@/constants/mission";
import { calculateDistanceKm } from "@/lib/geo/distance";
import type { DroneClass } from "@/types/domain";
import type {
  MissionHub,
  MissionId,
  MissionRoutePoint,
  MissionSegment,
} from "@/types/mission";
import type { GeoPoint } from "@/types/service-area";

export { calculateDistanceKm };

const minimumOperationalSpeedKph = 28;
const takeoffLandingBufferSeconds = 8;
const parcelLoadBufferSeconds = 8;
const parcelCollectionBufferSeconds = 8;

export type MissionSegmentBuildInput = {
  missionId: MissionId;
  pickup: MissionRoutePoint;
  dropoff: MissionRoutePoint;
  warehouse?: MissionHub;
  includeReturnToWarehouse?: boolean;
};

export type MissionEtaInput = {
  pickup: GeoPoint;
  dropoff: GeoPoint;
  droneClass: DroneClass;
  warehouse?: MissionHub;
  includeReturnToWarehouse?: boolean;
};

export type MissionEtaBreakdown = {
  warehouseToPickupSeconds: number;
  pickupToDropoffSeconds: number;
  dropoffToWarehouseSeconds: number;
  pickupHandoffSeconds: number;
  dropoffHandoffSeconds: number;
  totalSeconds: number;
  minMinutes: number;
  maxMinutes: number;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function clampProgress(progress: number) {
  return Math.min(1, Math.max(0, progress));
}

function roundSeconds(value: number) {
  return Math.max(1, Math.round(value));
}

function getRoutePointForHub(hub: MissionHub): MissionRoutePoint {
  return {
    label: hub.name,
    location: hub.address.location,
    address: hub.address,
  };
}

function getScaledDurationSeconds(
  distanceKm: number,
  range: { minSeconds: number; maxSeconds: number },
) {
  const normalizedDistance = Math.min(1, Math.max(0, distanceKm / 6));

  return roundSeconds(
    range.minSeconds +
      (range.maxSeconds - range.minSeconds) * normalizedDistance,
  );
}

function getFlightSeconds(distanceKm: number, droneClass: DroneClass) {
  const normalizedDroneClass =
    droneClass in droneFleetById
      ? droneClass
      : legacyDroneClassMap[droneClass as keyof typeof legacyDroneClassMap];
  const drone = droneFleetById[normalizedDroneClass] ?? droneFleetById.medium_standard;
  const speedKph = Math.max(
    minimumOperationalSpeedKph,
    drone.estimatedSpeedKph * 0.72,
  );

  return roundSeconds((distanceKm / speedKph) * 3600 + takeoffLandingBufferSeconds);
}

export function interpolateGeoPoint(
  from: GeoPoint,
  to: GeoPoint,
  progress: number,
): GeoPoint {
  const normalizedProgress = clampProgress(progress);

  return {
    latitude:
      from.latitude + (to.latitude - from.latitude) * normalizedProgress,
    longitude:
      from.longitude + (to.longitude - from.longitude) * normalizedProgress,
  };
}

export function calculateHeadingDegrees(from: GeoPoint, to: GeoPoint) {
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);

  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function buildMissionSegments({
  missionId,
  pickup,
  dropoff,
  warehouse = activeHub,
  includeReturnToWarehouse = false,
}: MissionSegmentBuildInput): MissionSegment[] {
  const warehousePoint = getRoutePointForHub(warehouse);
  const warehouseToPickupDistanceKm = calculateDistanceKm(
    warehousePoint.location,
    pickup.location,
  );
  const pickupToDropoffDistanceKm = calculateDistanceKm(
    pickup.location,
    dropoff.location,
  );
  const baseSegments: MissionSegment[] = [
    {
      id: `${missionId}:warehouse_to_pickup`,
      missionId,
      type: "warehouse_to_pickup",
      state: "pending",
      sequence: 1,
      from: warehousePoint,
      to: pickup,
      distanceKm: warehouseToPickupDistanceKm,
      plannedDurationSeconds: getScaledDurationSeconds(
        warehouseToPickupDistanceKm,
        defaultMissionDurations.warehouseToPickup,
      ),
    },
    {
      id: `${missionId}:pickup_to_dropoff`,
      missionId,
      type: "pickup_to_dropoff",
      state: "pending",
      sequence: 2,
      from: pickup,
      to: dropoff,
      distanceKm: pickupToDropoffDistanceKm,
      plannedDurationSeconds: getScaledDurationSeconds(
        pickupToDropoffDistanceKm,
        defaultMissionDurations.pickupToDropoff,
      ),
    },
  ];

  if (!includeReturnToWarehouse) {
    return baseSegments;
  }

  const dropoffToWarehouseDistanceKm = calculateDistanceKm(
    dropoff.location,
    warehousePoint.location,
  );

  return [
    ...baseSegments,
    {
      id: `${missionId}:dropoff_to_warehouse`,
      missionId,
      type: "dropoff_to_warehouse",
      state: "pending",
      sequence: 3,
      from: dropoff,
      to: warehousePoint,
      distanceKm: dropoffToWarehouseDistanceKm,
      plannedDurationSeconds: getScaledDurationSeconds(
        dropoffToWarehouseDistanceKm,
        defaultMissionDurations.warehouseToPickup,
      ),
    },
  ];
}

export function calculateMissionEta({
  pickup,
  dropoff,
  droneClass,
  warehouse = activeHub,
  includeReturnToWarehouse = false,
}: MissionEtaInput): MissionEtaBreakdown {
  const warehouseLocation = warehouse.address.location;
  const warehouseToPickupDistanceKm = calculateDistanceKm(
    warehouseLocation,
    pickup,
  );
  const pickupToDropoffDistanceKm = calculateDistanceKm(pickup, dropoff);
  const dropoffToWarehouseDistanceKm = includeReturnToWarehouse
    ? calculateDistanceKm(dropoff, warehouseLocation)
    : 0;

  const pickupHandoffSeconds =
    defaultMissionDurations.pickupSafetyCheck +
    defaultMissionDurations.lockerDescent +
    parcelLoadBufferSeconds +
    defaultMissionDurations.lockerAscent;
  const dropoffHandoffSeconds =
    defaultMissionDurations.dropoffSafetyCheck +
    defaultMissionDurations.lockerDescent +
    parcelCollectionBufferSeconds +
    defaultMissionDurations.lockerAscent;

  const warehouseToPickupSeconds = getFlightSeconds(
    warehouseToPickupDistanceKm,
    droneClass,
  );
  const pickupToDropoffSeconds = getFlightSeconds(
    pickupToDropoffDistanceKm,
    droneClass,
  );
  const dropoffToWarehouseSeconds = includeReturnToWarehouse
    ? getFlightSeconds(dropoffToWarehouseDistanceKm, droneClass)
    : 0;
  const totalSeconds =
    defaultMissionDurations.preflightChecks +
    warehouseToPickupSeconds +
    pickupHandoffSeconds +
    pickupToDropoffSeconds +
    dropoffHandoffSeconds +
    dropoffToWarehouseSeconds;
  const totalMinutes = totalSeconds / 60;

  return {
    warehouseToPickupSeconds,
    pickupToDropoffSeconds,
    dropoffToWarehouseSeconds,
    pickupHandoffSeconds,
    dropoffHandoffSeconds,
    totalSeconds,
    minMinutes: Math.max(1, Math.floor(totalMinutes)),
    maxMinutes: Math.max(2, Math.ceil(totalMinutes + 1)),
  };
}
