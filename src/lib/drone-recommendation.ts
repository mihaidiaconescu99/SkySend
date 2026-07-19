import { droneFleet } from "@/constants/drone-fleet";
export {
  evaluateDeliveryConfigurations,
  getUnavailableDeliveryConfigurationRecommendation,
  recommendDeliveryConfiguration,
} from "@/lib/delivery-configuration-recommendation";
import type {
  DroneConfig,
  DroneOptionEvaluation,
  DroneRecommendationCriteria,
} from "@/types/drone";

function getVolumeLiters(dimensions: DroneRecommendationCriteria["parcelDimensionsCm"]) {
  return (
    (dimensions.lengthCm * dimensions.widthCm * dimensions.heightCm) /
    1000
  );
}

function getUnavailableReasons(
  criteria: DroneRecommendationCriteria,
  drone: DroneConfig,
) {
  const reasons: string[] = [];
  const parcelVolumeLiters = getVolumeLiters(criteria.parcelDimensionsCm);

  if (criteria.payloadKg > drone.maxPayloadKg) {
    reasons.push("Payload exceeds capacity");
  }

  if (
    criteria.parcelDimensionsCm.lengthCm > drone.maxDimensionsCm.lengthCm ||
    criteria.parcelDimensionsCm.widthCm > drone.maxDimensionsCm.widthCm ||
    criteria.parcelDimensionsCm.heightCm > drone.maxDimensionsCm.heightCm ||
    parcelVolumeLiters > drone.maxVolumeLiters
  ) {
    reasons.push("Locker size is not suitable");
  }

  if (criteria.deliveryDistanceKm > drone.rangeKm) {
    reasons.push("Range not suitable");
  }

  if (
    criteria.requiresFragileHandling &&
    drone.category === "light" &&
    !drone.suitabilityTags.includes("fragile_goods")
  ) {
    reasons.push("Not recommended for fragile parcel");
  }

  return reasons;
}

function scoreDrone(
  criteria: DroneRecommendationCriteria,
  drone: DroneConfig,
) {
  let score = 0;
  const payloadReserveKg = drone.maxPayloadKg - criteria.payloadKg;
  const rangeReserveKm = drone.rangeKm - criteria.deliveryDistanceKm;

  if (criteria.requiresFragileHandling) {
    score += drone.suitabilityTags.includes("fragile_goods") ? 46 : -28;
    score += drone.lockerSize === "stabilized" ? 24 : 0;
  }

  if (criteria.urgency === "critical") {
    score += drone.averageSpeedKmh / 2;
    score += drone.dispatchMultiplier && drone.dispatchMultiplier < 1 ? 16 : 0;
  }

  if (criteria.urgency === "priority") {
    score += drone.suitabilityTags.includes("high_priority") ? 16 : 0;
    score += drone.averageSpeedKmh / 5;
  }

  if (criteria.deliveryDistanceKm > 18) {
    score += drone.suitabilityTags.includes("long_distance") ? 36 : -12;
    score += Math.max(0, rangeReserveKm) / 2;
  }

  if (criteria.payloadKg > 5) {
    score += drone.category === "heavy" ? 44 : -40;
  } else if (criteria.payloadKg > 2.5) {
    score += drone.category === "medium" ? 24 : 0;
    score += drone.category === "heavy" ? 8 : 0;
  } else if (criteria.payloadKg <= 1.4) {
    score += drone.category === "light" ? 22 : 0;
  }

  score += Math.max(0, payloadReserveKg) * 2;
  score += Math.max(0, rangeReserveKm) / 4;
  score -= Math.max(0, drone.baseMultiplier - 1) * 10;
  score -= Math.max(0, drone.perKmMultiplier - 1) * 6;

  return Number(score.toFixed(2));
}

export function evaluateDroneOptions(
  criteria: DroneRecommendationCriteria,
): DroneOptionEvaluation[] {
  const scoredOptions = droneFleet.map((drone) => {
    const unavailableReasons = getUnavailableReasons(criteria, drone);

    return {
      drone,
      isCompatible: unavailableReasons.length === 0,
      isRecommended: false,
      score: unavailableReasons.length === 0 ? scoreDrone(criteria, drone) : -1,
      unavailableReasons,
    };
  });
  const recommendedId = [...scoredOptions]
    .filter((option) => option.isCompatible)
    .sort((left, right) => right.score - left.score)[0]?.drone.id;

  return scoredOptions.map((option) => ({
    ...option,
    isRecommended: option.drone.id === recommendedId,
  }));
}

export function getRecommendedDrone(criteria: DroneRecommendationCriteria) {
  return evaluateDroneOptions(criteria).find((option) => option.isRecommended)
    ?.drone ?? null;
}
