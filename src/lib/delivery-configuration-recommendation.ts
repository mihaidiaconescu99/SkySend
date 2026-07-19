import { deliveryConfigurations } from "@/constants/delivery-configurations";
import { droneFleetById, legacyDroneClassMap } from "@/constants/drone-fleet";
import type { DroneClass } from "@/types/domain";
import type {
  DeliveryConfiguration,
  DeliveryConfigurationEvaluation,
  DeliveryConfigurationRecommendation,
  DeliveryConfigurationRecommendationInput,
  DeliveryConfigurationRiskFlag,
  ParcelDimensions,
} from "@/types/drone";

function getVolumeLiters(dimensions: ParcelDimensions) {
  return (dimensions.lengthCm * dimensions.widthCm * dimensions.heightCm) / 1000;
}

function normalizeDroneClass(droneClass: DroneClass) {
  return droneClass in droneFleetById
    ? droneClass
    : legacyDroneClassMap[droneClass as keyof typeof legacyDroneClassMap];
}

function getMappedDroneRangeKm(configuration: DeliveryConfiguration) {
  return droneFleetById[normalizeDroneClass(configuration.mappedDroneClass)]
    ?.rangeKm;
}

function getRiskText(riskFlags: readonly DeliveryConfigurationRiskFlag[]) {
  return riskFlags
    .map((riskFlag) =>
      [riskFlag.code, riskFlag.label, riskFlag.reason]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ")
    .toLowerCase();
}

function hasAnySignal(
  input: DeliveryConfigurationRecommendationInput,
  signals: readonly string[],
) {
  const riskText = getRiskText(input.riskFlags ?? []);
  const contentText = (input.contentSignals ?? []).join(" ").toLowerCase();
  const searchableText = `${riskText} ${contentText}`;

  return signals.some((signal) => searchableText.includes(signal));
}

function isThermalParcel(input: DeliveryConfigurationRecommendationInput) {
  return (
    input.temperatureSensitive === true ||
    input.category === "food" ||
    input.category === "medical" ||
    input.packaging === "insulated" ||
    hasAnySignal(input, [
      "cold",
      "dessert",
      "drink",
      "food",
      "frozen",
      "grocery",
      "menu",
      "pizza",
      "temperature",
      "thermal",
    ])
  );
}

function isSecuritySensitive(input: DeliveryConfigurationRecommendationInput) {
  return (
    input.securitySensitive === true ||
    hasAnySignal(input, [
      "expensive",
      "high-value",
      "high value",
      "secure",
      "sensitive equipment",
      "valuable",
    ])
  );
}

function isLargeThermalParcel(
  input: DeliveryConfigurationRecommendationInput,
  volumeLiters: number,
) {
  return (
    volumeLiters > 11 ||
    input.confirmedWeightKg > 2.2 ||
    hasAnySignal(input, [
      "catering",
      "family",
      "grocery",
      "large food",
      "multiple menus",
      "large pizza",
      "family pizza",
    ])
  );
}

function isBulkyParcel(
  input: DeliveryConfigurationRecommendationInput,
  volumeLiters: number,
) {
  const dimensions = input.parcelDimensionsCm;

  return (
    input.confirmedWeightKg > 3 ||
    volumeLiters > 14 ||
    dimensions.lengthCm > 35 ||
    dimensions.widthCm > 28 ||
    dimensions.heightCm > 18 ||
    hasAnySignal(input, ["bulk", "bulky", "large box", "oversize"])
  );
}

function hasHighRiskFlag(input: DeliveryConfigurationRecommendationInput) {
  return (input.riskFlags ?? []).some(
    (riskFlag) => riskFlag.severity === "high",
  );
}

function getMissingDataReasons(input: DeliveryConfigurationRecommendationInput) {
  const reasons: string[] = [];
  const dimensions = input.parcelDimensionsCm;
  const volumeLiters = input.volumeLiters ?? getVolumeLiters(dimensions);

  if (!Number.isFinite(input.confirmedWeightKg) || input.confirmedWeightKg <= 0) {
    reasons.push("Missing parcel data: confirmed weight is required");
  }

  if (
    !Number.isFinite(dimensions.lengthCm) ||
    !Number.isFinite(dimensions.widthCm) ||
    !Number.isFinite(dimensions.heightCm) ||
    dimensions.lengthCm <= 0 ||
    dimensions.widthCm <= 0 ||
    dimensions.heightCm <= 0
  ) {
    reasons.push("Missing parcel data: confirmed dimensions are required");
  }

  if (!Number.isFinite(volumeLiters) || volumeLiters <= 0) {
    reasons.push("Missing parcel data: confirmed volume is required");
  }

  if (!Number.isFinite(input.routeDistanceKm) || input.routeDistanceKm <= 0) {
    reasons.push("Missing route data: route distance is required");
  }

  return reasons;
}

function getUnavailableReasons(
  input: DeliveryConfigurationRecommendationInput,
  configuration: DeliveryConfiguration,
  volumeLiters: number,
) {
  const reasons: string[] = [...getMissingDataReasons(input)];
  const dimensions = input.parcelDimensionsCm;
  const rangeKm = getMappedDroneRangeKm(configuration);
  const thermalParcel = isThermalParcel(input);
  const securitySensitive = isSecuritySensitive(input);

  if (input.confirmedWeightKg > configuration.maxPayloadKg) {
    reasons.push(
      `Weight constraint: ${input.confirmedWeightKg.toFixed(1)} kg exceeds ${configuration.maxPayloadKg} kg payload`,
    );
  }

  if (
    dimensions.lengthCm > configuration.maxDimensionsCm.lengthCm ||
    dimensions.widthCm > configuration.maxDimensionsCm.widthCm ||
    dimensions.heightCm > configuration.maxDimensionsCm.heightCm
  ) {
    reasons.push(
      `Dimensions constraint: ${dimensions.lengthCm} x ${dimensions.widthCm} x ${dimensions.heightCm} cm exceeds ${configuration.maxDimensionsCm.lengthCm} x ${configuration.maxDimensionsCm.widthCm} x ${configuration.maxDimensionsCm.heightCm} cm`,
    );
  }

  if (volumeLiters > configuration.maxVolumeLiters) {
    reasons.push(
      `Volume constraint: ${volumeLiters.toFixed(1)} L exceeds ${configuration.maxVolumeLiters} L`,
    );
  }

  if (rangeKm && input.routeDistanceKm > rangeKm) {
    reasons.push(
      `Distance constraint: route ${input.routeDistanceKm.toFixed(1)} km exceeds ${rangeKm} km range`,
    );
  }

  if (thermalParcel && configuration.temperatureProtection === "none") {
    reasons.push(
      "Thermal constraint: temperature-sensitive parcel requires insulated or active thermal protection",
    );
  }

  if (securitySensitive && configuration.securityLevel === "standard") {
    reasons.push(
      "Security constraint: sensitive or high-value parcel requires a secure module",
    );
  }

  if (
    input.fragilityLevel === "high" &&
    configuration.shockProtection === "standard"
  ) {
    reasons.push(
      "Fragility constraint: high-fragility parcel requires stabilized or reinforced protection",
    );
  }

  return reasons;
}

function scoreConfiguration(
  input: DeliveryConfigurationRecommendationInput,
  configuration: DeliveryConfiguration,
  volumeLiters: number,
) {
  let score = 0;
  const securitySensitive = isSecuritySensitive(input);
  const thermalParcel = isThermalParcel(input);
  const largeThermalParcel = isLargeThermalParcel(input, volumeLiters);
  const bulkyParcel = isBulkyParcel(input, volumeLiters);
  const payloadReserveKg = configuration.maxPayloadKg - input.confirmedWeightKg;
  const volumeReserveLiters = configuration.maxVolumeLiters - volumeLiters;

  if (configuration.id === "aer_express") {
    score += input.category === "documents" ? 55 : 0;
    score += hasAnySignal(input, ["key", "keys"]) ? 18 : 0;
    score += input.confirmedWeightKg <= 1.2 && volumeLiters <= 4 ? 24 : -22;
    score += input.fragilityLevel === "low" ? 8 : -24;
    score += securitySensitive || thermalParcel ? -36 : 0;
  }

  if (configuration.id === "aer_secure") {
    score += input.category === "electronics" ? 42 : 0;
    score += securitySensitive ? 44 : 0;
    score += input.fragilityLevel !== "low" ? 28 : 0;
    score += input.confirmedWeightKg <= 1.6 && volumeLiters <= 5 ? 18 : -18;
    score += thermalParcel ? -18 : 0;
  }

  if (configuration.id === "nova_thermal_medium") {
    score += thermalParcel ? 46 : -28;
    score += input.category === "food" || input.category === "medical" ? 18 : 0;
    score += thermalParcel && !largeThermalParcel ? 22 : -12;
    score += thermalParcel && input.fragilityLevel !== "low" ? 8 : 0;
    score += !thermalParcel && input.category === "electronics" ? -24 : 0;
  }

  if (configuration.id === "nova_thermal_large") {
    score += thermalParcel ? 42 : -28;
    score += thermalParcel && largeThermalParcel ? 32 : -8;
    score += thermalParcel && input.category === "food" ? 16 : 0;
  }

  if (configuration.id === "nova_cargo") {
    score += input.category === "retail" ? 40 : 0;
    score += input.category === "electronics" ? 24 : 0;
    score +=
      input.packaging === "boxed" ||
      input.packaging === "soft_pouch" ||
      input.packaging === "plastic_bag"
        ? 12
        : 0;
    score += !thermalParcel && !securitySensitive && !bulkyParcel ? 24 : -18;
  }

  if (configuration.id === "origin_bulk") {
    score += bulkyParcel ? 52 : -12;
    score += input.confirmedWeightKg > 3 ? 22 : 0;
    score += securitySensitive ? -16 : 0;
  }

  if (configuration.id === "origin_secure_plus") {
    score += securitySensitive ? 56 : 0;
    score += hasHighRiskFlag(input) ? 18 : 0;
    score += input.fragilityLevel === "high" ? 20 : 0;
    score += input.category === "electronics" || input.category === "special" ? 18 : 0;
    score += bulkyParcel && securitySensitive ? 12 : 0;
  }

  if (input.urgency === "priority" || input.urgency === "critical") {
    score += configuration.suitabilityTags.includes("high_priority") ? 10 : 0;
    score += configuration.suitabilityTags.includes("same_hour") ? 4 : 0;
  }

  score += Math.max(0, payloadReserveKg) * 1.5;
  score += Math.max(0, volumeReserveLiters) * 0.2;
  score -= Math.max(0, configuration.pricingMultipliers.baseMultiplier - 1) * 8;
  score -= Math.max(0, configuration.pricingMultipliers.perKmMultiplier - 1) * 5;

  return Number(score.toFixed(2));
}

function getIneligibleReason(options: readonly DeliveryConfigurationEvaluation[]) {
  const uniqueReasons = [
    ...new Set(options.flatMap((option) => option.unavailableReasons)),
  ];

  if (!uniqueReasons.length) {
    return "No delivery configuration can support this parcel profile.";
  }

  return `No delivery configuration is eligible. ${uniqueReasons.join("; ")}.`;
}

export function evaluateDeliveryConfigurations(
  input: DeliveryConfigurationRecommendationInput,
): DeliveryConfigurationEvaluation[] {
  const volumeLiters =
    input.volumeLiters ?? getVolumeLiters(input.parcelDimensionsCm);
  const scoredOptions = deliveryConfigurations.map((configuration) => {
    const unavailableReasons = getUnavailableReasons(
      input,
      configuration,
      volumeLiters,
    );

    return {
      configuration,
      isEligible: unavailableReasons.length === 0,
      isCompatible: unavailableReasons.length === 0,
      isRecommended: false,
      score:
        unavailableReasons.length === 0
          ? scoreConfiguration(input, configuration, volumeLiters)
          : -1,
      unavailableReasons,
      mappedDroneClass: configuration.mappedDroneClass,
    };
  });
  const recommendedId = [...scoredOptions]
    .filter((option) => option.isEligible)
    .sort((left, right) => right.score - left.score)[0]?.configuration.id;

  return scoredOptions.map((option) => ({
    ...option,
    isRecommended: option.configuration.id === recommendedId,
  }));
}

export function recommendDeliveryConfiguration(
  input: DeliveryConfigurationRecommendationInput,
): DeliveryConfigurationRecommendation {
  const options = evaluateDeliveryConfigurations(input);
  const selectedOption =
    options.find((option) => option.isRecommended) ?? null;
  const selectedConfiguration = selectedOption?.configuration ?? null;
  const compatibleAlternatives = options.filter(
    (option) =>
      option.isCompatible &&
      option.configuration.id !== selectedConfiguration?.id,
  );

  return {
    selectedConfiguration,
    recommendedConfiguration: selectedConfiguration,
    eligible: Boolean(selectedConfiguration),
    score: selectedOption?.score ?? -1,
    ineligibleReason: selectedConfiguration ? null : getIneligibleReason(options),
    compatibleAlternatives,
    fallbackDroneClass:
      selectedConfiguration?.mappedDroneClass ?? "heavy_cargo",
    options,
  };
}

export function getUnavailableDeliveryConfigurationRecommendation(
  ineligibleReason: string,
): DeliveryConfigurationRecommendation {
  return {
    selectedConfiguration: null,
    recommendedConfiguration: null,
    eligible: false,
    score: -1,
    ineligibleReason,
    compatibleAlternatives: [],
    fallbackDroneClass: "medium_standard",
    options: [],
  };
}
