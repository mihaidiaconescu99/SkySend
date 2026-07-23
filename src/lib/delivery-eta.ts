export type DeliveryEtaWindow = {
  min: number;
  max: number;
};

const minimumEtaMinutes = 2;
const maximumEtaMinutes = 10;
const etaWindowSpreadMinutes = 2;

export function getDistanceBasedDeliveryEtaWindow(
  routeDistanceKm: number,
): DeliveryEtaWindow {
  const distanceKm = Number.isFinite(routeDistanceKm)
    ? Math.max(0, routeDistanceKm)
    : 0;
  const min = Math.min(
    maximumEtaMinutes - etaWindowSpreadMinutes,
    Math.max(minimumEtaMinutes, Math.ceil(distanceKm * 0.8) + 1),
  );

  return {
    min,
    max: Math.min(maximumEtaMinutes, min + etaWindowSpreadMinutes),
  };
}
