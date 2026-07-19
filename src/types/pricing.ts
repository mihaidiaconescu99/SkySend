import type { CreateDeliveryReviewUrgency } from "@/types/create-delivery";
import type { DroneClass } from "@/types/domain";
import type {
  CargoModuleId,
  DeliveryPlatformId,
  DeliverySecurityLevel,
  DeliveryShockProtection,
  DeliveryTemperatureProtection,
} from "@/types/drone";
import type { CurrencyCode, MoneyAmount } from "@/types/entities";
import type { ParcelFragileLevel } from "@/types/parcel-assistant";
import type { GeoPoint } from "@/types/service-area";

export type PricingBreakdownType =
  | "base_fee"
  | "distance_fee"
  | "drone_model_adjustment"
  | "delivery_configuration_adjustment"
  | "dispatch_timing_adjustment"
  | "scheduled_adjustment"
  | "weight_surcharge"
  | "fragile_handling_surcharge"
  | "thermal_handling_surcharge"
  | "secure_handling_surcharge"
  | "route_complexity_adjustment";

export type PricingBreakdownItem = {
  type: PricingBreakdownType;
  label: string;
  amount: MoneyAmount;
};

export type PricingDimensionsInput = {
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
};

export type PricingDeliveryConfigurationInput = {
  id: CargoModuleId;
  platform: DeliveryPlatformId;
  moduleName: string;
  mappedDroneClass: DroneClass;
  pricingMultipliers: {
    baseMultiplier: number;
    perKmMultiplier: number;
    dispatchMultiplier?: number;
  };
  temperatureProtection: DeliveryTemperatureProtection;
  securityLevel: DeliverySecurityLevel;
  shockProtection: DeliveryShockProtection;
};

export type SkySendPricingInput = {
  pickupCoordinates?: GeoPoint | null;
  dropoffCoordinates?: GeoPoint | null;
  distanceKm: number;
  selectedDroneId: DroneClass;
  deliveryConfiguration?: PricingDeliveryConfigurationInput | null;
  dispatchTiming: CreateDeliveryReviewUrgency;
  scheduledAt?: string | null;
  weightKg?: number | null;
  dimensionsCm?: PricingDimensionsInput | null;
  fragilityLevel?: ParcelFragileLevel | null;
  routeComplexity?: "standard" | "review" | "complex" | null;
};

export type SkySendPricingResult = {
  version: "skysend-pricing-v1";
  currency: CurrencyCode;
  input: SkySendPricingInput;
  distanceKm: number;
  baseFee: MoneyAmount;
  distanceFee: MoneyAmount;
  droneModelAdjustment: MoneyAmount;
  deliveryConfigurationAdjustment?: MoneyAmount;
  dispatchTimingAdjustment: MoneyAmount;
  scheduledAdjustment: MoneyAmount;
  weightSurcharge: MoneyAmount;
  fragileHandlingSurcharge: MoneyAmount;
  thermalHandlingSurcharge?: MoneyAmount;
  secureHandlingSurcharge?: MoneyAmount;
  routeComplexityAdjustment: MoneyAmount;
  subtotal: MoneyAmount;
  total: MoneyAmount;
  breakdown: PricingBreakdownItem[];
};

export type CreateDeliveryPricingSnapshot = SkySendPricingResult;
