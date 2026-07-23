import { droneFleetById, legacyDroneClassMap } from "@/constants/drone-fleet";
import { readOperationalSettings } from "@/lib/admin-data";
import type { DeliveryUrgency, DroneClass } from "@/types/domain";
import type { CurrencyCode, MoneyAmount } from "@/types/entities";
import type { ParcelFragileLevel } from "@/types/parcel-assistant";
import type {
  PricingBreakdownItem,
  SkySendPricingInput,
  SkySendPricingResult,
} from "@/types/pricing";

const currency: CurrencyCode = "RON";

const baseFeeMinor = 1490;
const distanceFeePer100mMinor = 38;
const moderateFragileSurchargeMinor = 300;
const highFragileSurchargeMinor = 650;
const passiveThermalSurchargeMinor = 250;
const activeThermalSurchargeMinor = 550;
const secureHandlingSurchargeMinor = 350;
const securePlusHandlingSurchargeMinor = 800;
const heavySurchargeMinor = 700;
const extraHeavySurchargeMinor = 1200;
const oversizeSurchargeMinor = 500;
const reviewRouteComplexityMinor = 250;
const complexRouteComplexityMinor = 450;
const heavyThresholdKg = 3;
const extraHeavyThresholdKg = 5;

export type PricingParcelInput = {
  estimatedWeightKg?: number | null;
  requiresFragileHandling?: boolean;
  fragileLevel?: ParcelFragileLevel | null;
};

export type CalculateMissionPricingInput = {
  distanceKm: number;
  urgency: DeliveryUrgency;
  droneClass: DroneClass;
  parcel?: PricingParcelInput | null;
};

export type MissionPricingResult = SkySendPricingResult;

export const urgencyPricingMultipliers: Record<DeliveryUrgency, number> = {
  standard: 1,
  priority: 1.22,
  critical: 1.45,
};

export const dispatchTimingPricingMultipliers: Record<
  SkySendPricingInput["dispatchTiming"],
  number
> = {
  standard: 1,
  priority: 1.22,
  scheduled: 0.96,
  critical: 1.45,
};

export const droneClassPricingMultipliers: Record<DroneClass, number> = {
  light_swift: 0.92,
  light_secure: 1.02,
  medium_standard: 1,
  medium_stabilized: 1.14,
  medium_long_range: 1.12,
  heavy_cargo: 1.26,
  heavy_max: 1.48,
  light_express: 0.92,
  standard_courier: 1,
  fragile_care: 1.14,
  long_range: 1.12,
};

function money(amountMinor: number): MoneyAmount {
  return {
    amountMinor,
    currency,
  };
}

function roundMinor(value: number) {
  return Math.round(value);
}

function roundDistance(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100;
}

function getOperationalPricingConfig() {
  const settings = readOperationalSettings();

  return {
    baseFeeMinor: settings.basePrice.amountMinor,
    distanceFeePerKmMinor: settings.pricePerKm.amountMinor,
  };
}

function normalizeDroneClass(droneClass: DroneClass) {
  return droneClass in droneFleetById
    ? droneClass
    : legacyDroneClassMap[droneClass as keyof typeof legacyDroneClassMap];
}

function getDroneModel(droneClass: DroneClass) {
  return droneFleetById[normalizeDroneClass(droneClass)] ?? droneFleetById.medium_standard;
}

function getWeightSurchargeMinor(weightKg?: number | null) {
  if (!weightKg || weightKg <= heavyThresholdKg) {
    return 0;
  }

  return weightKg > extraHeavyThresholdKg
    ? extraHeavySurchargeMinor
    : heavySurchargeMinor;
}

function getFragileSurchargeMinor(
  fragileLevel?: ParcelFragileLevel | null,
  requiresFragileHandling?: boolean,
) {
  if (requiresFragileHandling || fragileLevel === "high") {
    return highFragileSurchargeMinor;
  }

  if (fragileLevel === "moderate") {
    return moderateFragileSurchargeMinor;
  }

  return 0;
}

function getThermalSurchargeMinor(
  configuration?: SkySendPricingInput["deliveryConfiguration"],
) {
  if (configuration?.temperatureProtection === "active_thermal") {
    return activeThermalSurchargeMinor;
  }

  if (configuration?.temperatureProtection === "passive_insulated") {
    return passiveThermalSurchargeMinor;
  }

  return 0;
}

function getSecureSurchargeMinor(
  configuration?: SkySendPricingInput["deliveryConfiguration"],
) {
  if (configuration?.securityLevel === "secure_plus") {
    return securePlusHandlingSurchargeMinor;
  }

  if (configuration?.securityLevel === "secure") {
    return secureHandlingSurchargeMinor;
  }

  return 0;
}

function getOversizeSurchargeMinor(dimensions?: SkySendPricingInput["dimensionsCm"]) {
  if (!dimensions?.lengthCm || !dimensions.widthCm || !dimensions.heightCm) {
    return 0;
  }

  return dimensions.lengthCm > 35 ||
    dimensions.widthCm > 28 ||
    dimensions.heightCm > 18
    ? oversizeSurchargeMinor
    : 0;
}

function getRouteComplexityMinor(routeComplexity: SkySendPricingInput["routeComplexity"]) {
  if (routeComplexity === "complex") {
    return complexRouteComplexityMinor;
  }

  if (routeComplexity === "review") {
    return reviewRouteComplexityMinor;
  }

  return 0;
}

function addBreakdownItem(
  breakdown: PricingBreakdownItem[],
  type: PricingBreakdownItem["type"],
  label: string,
  amountMinor: number,
  options?: { includeWhenZero?: boolean },
) {
  if (amountMinor === 0 && !options?.includeWhenZero) {
    return;
  }

  breakdown.push({
    type,
    label,
    amount: money(amountMinor),
  });
}

export function calculateSkySendPricing(
  input: SkySendPricingInput,
  authoritativePricing?: {
    baseFeeMinor: number;
    distanceFeePerKmMinor: number;
  },
): SkySendPricingResult {
  const distanceKm = roundDistance(input.distanceKm);
  const drone = getDroneModel(input.selectedDroneId);
  const configuration = input.deliveryConfiguration ?? null;
  const baseMultiplier =
    configuration?.pricingMultipliers.baseMultiplier ?? drone.baseMultiplier;
  const perKmMultiplier =
    configuration?.pricingMultipliers.perKmMultiplier ?? drone.perKmMultiplier;
  const operationalPricing =
    authoritativePricing ?? getOperationalPricingConfig();
  const effectiveBaseFeeMinor = operationalPricing.baseFeeMinor || baseFeeMinor;
  const effectiveDistanceFeePerKmMinor =
    operationalPricing.distanceFeePerKmMinor || distanceFeePer100mMinor * 10;
  const distanceFeeMinor = roundMinor(
    distanceKm * effectiveDistanceFeePerKmMinor,
  );
  const rawRouteSubtotalMinor = effectiveBaseFeeMinor + distanceFeeMinor;
  const configurationAdjustedSubtotalMinor = roundMinor(
    effectiveBaseFeeMinor * baseMultiplier +
      distanceFeeMinor * perKmMultiplier,
  );
  const deliveryConfigurationAdjustmentMinor =
    configurationAdjustedSubtotalMinor - rawRouteSubtotalMinor;
  const dispatchMultiplier = dispatchTimingPricingMultipliers[input.dispatchTiming];
  const dispatchTimingAdjustmentMinor = roundMinor(
    configurationAdjustedSubtotalMinor * (dispatchMultiplier - 1),
  );
  const scheduledAdjustmentMinor =
    input.dispatchTiming === "scheduled" && input.scheduledAt
      ? dispatchTimingAdjustmentMinor
      : 0;
  const normalizedDispatchTimingAdjustmentMinor =
    input.dispatchTiming === "scheduled" ? 0 : dispatchTimingAdjustmentMinor;
  const weightSurchargeMinor = getWeightSurchargeMinor(input.weightKg);
  const fragileHandlingSurchargeMinor = getFragileSurchargeMinor(
    input.fragilityLevel,
    input.fragilityLevel === "high" ||
      configuration?.shockProtection === "stabilized" ||
      configuration?.shockProtection === "reinforced",
  );
  const thermalHandlingSurchargeMinor = getThermalSurchargeMinor(configuration);
  const secureHandlingAdjustmentMinor = getSecureSurchargeMinor(configuration);
  const routeComplexityAdjustmentMinor =
    getRouteComplexityMinor(input.routeComplexity) +
    getOversizeSurchargeMinor(input.dimensionsCm);
  const subtotalMinor =
    configurationAdjustedSubtotalMinor +
    normalizedDispatchTimingAdjustmentMinor +
    scheduledAdjustmentMinor;
  const totalMinor = Math.max(
    100,
    roundMinor(
      subtotalMinor +
        weightSurchargeMinor +
        fragileHandlingSurchargeMinor +
        thermalHandlingSurchargeMinor +
        secureHandlingAdjustmentMinor +
        routeComplexityAdjustmentMinor,
    ),
  );
  const breakdown: PricingBreakdownItem[] = [];

  addBreakdownItem(breakdown, "base_fee", "Taxa de baza", effectiveBaseFeeMinor, {
    includeWhenZero: true,
  });
  addBreakdownItem(
    breakdown,
    "distance_fee",
    "Tarif distanta",
    distanceFeeMinor,
    { includeWhenZero: true },
  );
  addBreakdownItem(
    breakdown,
    configuration ? "delivery_configuration_adjustment" : "drone_model_adjustment",
    configuration
      ? `Ajustare ${configuration.moduleName}`
      : "Ajustare model drona",
    deliveryConfigurationAdjustmentMinor,
  );
  addBreakdownItem(
    breakdown,
    "dispatch_timing_adjustment",
    "Ajustare prioritate dispatch",
    normalizedDispatchTimingAdjustmentMinor,
  );
  addBreakdownItem(
    breakdown,
    "scheduled_adjustment",
    "Ajustare livrare programata",
    scheduledAdjustmentMinor,
  );
  addBreakdownItem(
    breakdown,
    "weight_surcharge",
    "Supliment greutate",
    weightSurchargeMinor,
  );
  addBreakdownItem(
    breakdown,
    "fragile_handling_surcharge",
    "Manipulare fragila",
    fragileHandlingSurchargeMinor,
  );
  addBreakdownItem(
    breakdown,
    "thermal_handling_surcharge",
    "Protectie termica",
    thermalHandlingSurchargeMinor,
  );
  addBreakdownItem(
    breakdown,
    "secure_handling_surcharge",
    "Manipulare securizata",
    secureHandlingAdjustmentMinor,
  );
  addBreakdownItem(
    breakdown,
    "route_complexity_adjustment",
    "Traseu si compatibilitate locker",
    routeComplexityAdjustmentMinor,
  );

  return {
    version: "skysend-pricing-v1",
    currency,
    input,
    distanceKm,
    baseFee: money(effectiveBaseFeeMinor),
    distanceFee: money(distanceFeeMinor),
    droneModelAdjustment: money(deliveryConfigurationAdjustmentMinor),
    deliveryConfigurationAdjustment: money(deliveryConfigurationAdjustmentMinor),
    dispatchTimingAdjustment: money(normalizedDispatchTimingAdjustmentMinor),
    scheduledAdjustment: money(scheduledAdjustmentMinor),
    weightSurcharge: money(weightSurchargeMinor),
    fragileHandlingSurcharge: money(fragileHandlingSurchargeMinor),
    thermalHandlingSurcharge: money(thermalHandlingSurchargeMinor),
    secureHandlingSurcharge: money(secureHandlingAdjustmentMinor),
    routeComplexityAdjustment: money(routeComplexityAdjustmentMinor),
    subtotal: money(subtotalMinor),
    total: money(totalMinor),
    breakdown,
  };
}

export function isValidPricingSnapshot(
  value: unknown,
): value is SkySendPricingResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<SkySendPricingResult>;

  return (
    record.version === "skysend-pricing-v1" &&
    record.currency === currency &&
    Boolean(record.total) &&
    typeof record.total?.amountMinor === "number" &&
    record.total.amountMinor >= 100 &&
    Array.isArray(record.breakdown)
  );
}

export function calculateMissionPricing({
  distanceKm,
  urgency,
  droneClass,
  parcel,
}: CalculateMissionPricingInput): MissionPricingResult {
  return calculateSkySendPricing({
    distanceKm,
    selectedDroneId: droneClass,
    dispatchTiming: urgency,
    weightKg: parcel?.estimatedWeightKg ?? null,
    fragilityLevel:
      parcel?.requiresFragileHandling || parcel?.fragileLevel === "high"
        ? "high"
        : parcel?.fragileLevel ?? null,
    routeComplexity: "standard",
  });
}
