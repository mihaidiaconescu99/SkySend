import type { DeliveryUrgency, DroneClass } from "@/types/domain";
import type {
  ParcelCategory,
  ParcelFragileLevel,
  ParcelPackagingType,
} from "@/types/parcel-assistant";

export type DroneSuitabilityTag =
  | "dense_urban"
  | "fragile_goods"
  | "grocery"
  | "high_priority"
  | "heavy_payload"
  | "long_distance"
  | "medical"
  | "oversized"
  | "secure_chain"
  | "same_hour"
  | "temperature_controlled"
  | "weather_resilient";

export type DroneCategory = "light" | "medium" | "heavy";

export type DroneLockerSize = "compact" | "secure_compact" | "standard" | "stabilized" | "large" | "max";

export type DeliveryPlatformId = "aer" | "nova" | "origin";

export type CargoModuleId =
  | "aer_express"
  | "aer_secure"
  | "nova_thermal_medium"
  | "nova_thermal_large"
  | "nova_cargo"
  | "origin_bulk"
  | "origin_secure_plus";

export type DeliveryTemperatureProtection =
  | "none"
  | "passive_insulated"
  | "active_thermal";

export type DeliverySecurityLevel =
  | "standard"
  | "secure"
  | "secure_plus";

export type DeliveryShockProtection =
  | "standard"
  | "stabilized"
  | "reinforced";

export type ParcelDimensions = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type DeliveryConfigurationPricingMultipliers = {
  baseMultiplier: number;
  perKmMultiplier: number;
  dispatchMultiplier?: number;
};

export type DeliveryConfiguration = {
  id: CargoModuleId;
  platform: DeliveryPlatformId;
  moduleName: string;
  shortDescription: string;
  maxPayloadKg: number;
  maxDimensionsCm: ParcelDimensions;
  maxVolumeLiters: number;
  temperatureProtection: DeliveryTemperatureProtection;
  securityLevel: DeliverySecurityLevel;
  shockProtection: DeliveryShockProtection;
  suitabilityTags: readonly DroneSuitabilityTag[];
  pricingMultipliers: DeliveryConfigurationPricingMultipliers;
  mappedDroneClass: DroneClass;
};

export type DeliveryConfigurationEvaluation = {
  configuration: DeliveryConfiguration;
  isEligible: boolean;
  isCompatible: boolean;
  isRecommended: boolean;
  score: number;
  unavailableReasons: string[];
  mappedDroneClass: DroneClass;
};

export type DeliveryConfigurationRiskFlag = {
  code: string;
  severity?: "low" | "medium" | "high";
  label?: string;
  reason?: string;
};

export type DeliveryConfigurationRecommendationInput = {
  confirmedWeightKg: number;
  parcelDimensionsCm: ParcelDimensions;
  volumeLiters?: number | null;
  category: ParcelCategory;
  packaging: ParcelPackagingType;
  fragilityLevel: ParcelFragileLevel;
  temperatureSensitive?: boolean;
  securitySensitive?: boolean;
  routeDistanceKm: number;
  urgency?: DeliveryUrgency;
  riskFlags?: readonly DeliveryConfigurationRiskFlag[];
  contentSignals?: readonly string[];
};

export type DeliveryConfigurationRecommendation = {
  selectedConfiguration: DeliveryConfiguration | null;
  recommendedConfiguration: DeliveryConfiguration | null;
  eligible: boolean;
  score: number;
  ineligibleReason: string | null;
  compatibleAlternatives: DeliveryConfigurationEvaluation[];
  fallbackDroneClass: DroneClass;
  options: DeliveryConfigurationEvaluation[];
};

export type DroneConfig = {
  id: DroneClass;
  name: string;
  imageSrc: string;
  category: DroneCategory;
  shortDescription: string;
  maxPayloadKg: number;
  maxVolumeLiters: number;
  maxDimensionsCm: ParcelDimensions;
  maxParcelDimensionsCm: ParcelDimensions;
  averageSpeedKmh: number;
  rangeKm: number;
  lockerSize: DroneLockerSize;
  baseMultiplier: number;
  perKmMultiplier: number;
  dispatchMultiplier?: number;
  strengths: string[];
  limitations: string[];
  bestFor: string[];
  estimatedRangeKm: number;
  estimatedSpeedKph: number;
  suitabilityTags: DroneSuitabilityTag[];
  recommendedUseCases: string[];
};

export type DroneRecommendationCriteria = {
  payloadKg: number;
  parcelDimensionsCm: ParcelDimensions;
  deliveryDistanceKm: number;
  urgency?: DeliveryUrgency;
  requiresFragileHandling?: boolean;
};

export type DroneOptionEvaluation = {
  drone: DroneConfig;
  isCompatible: boolean;
  isRecommended: boolean;
  score: number;
  unavailableReasons: string[];
};
