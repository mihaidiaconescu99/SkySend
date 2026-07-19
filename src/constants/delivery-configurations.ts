import type {
  CargoModuleId,
  DeliveryConfiguration,
  DeliveryPlatformId,
} from "@/types/drone";

export const deliveryPlatformLabels: Record<DeliveryPlatformId, string> = {
  aer: "AER",
  nova: "NOVA",
  origin: "ORIGIN",
};

export const deliveryConfigurations = [
  {
    id: "aer_express",
    platform: "aer",
    moduleName: "AER Express",
    shortDescription:
      "Fast compact module for documents and small same-hour parcels.",
    maxPayloadKg: 1.2,
    maxDimensionsCm: { lengthCm: 22, widthCm: 18, heightCm: 10 },
    maxVolumeLiters: 4,
    temperatureProtection: "none",
    securityLevel: "standard",
    shockProtection: "standard",
    suitabilityTags: ["dense_urban", "high_priority", "same_hour"],
    pricingMultipliers: {
      baseMultiplier: 0.92,
      perKmMultiplier: 0.94,
      dispatchMultiplier: 0.96,
    },
    mappedDroneClass: "light_swift",
  },
  {
    id: "aer_secure",
    platform: "aer",
    moduleName: "AER Secure",
    shortDescription:
      "Compact secure module for small sensitive parcels and pharmacy packs.",
    maxPayloadKg: 1.6,
    maxDimensionsCm: { lengthCm: 24, widthCm: 20, heightCm: 12 },
    maxVolumeLiters: 5,
    temperatureProtection: "passive_insulated",
    securityLevel: "secure",
    shockProtection: "stabilized",
    suitabilityTags: [
      "dense_urban",
      "fragile_goods",
      "medical",
      "secure_chain",
      "same_hour",
    ],
    pricingMultipliers: {
      baseMultiplier: 1.02,
      perKmMultiplier: 1,
      dispatchMultiplier: 1.02,
    },
    mappedDroneClass: "light_secure",
  },
  {
    id: "nova_thermal_medium",
    platform: "nova",
    moduleName: "NOVA Thermal Medium",
    shortDescription:
      "Stabilized insulated module for meals, medicine, and delicate retail.",
    maxPayloadKg: 2.8,
    maxDimensionsCm: { lengthCm: 32, widthCm: 26, heightCm: 17 },
    maxVolumeLiters: 12,
    temperatureProtection: "active_thermal",
    securityLevel: "secure",
    shockProtection: "stabilized",
    suitabilityTags: [
      "fragile_goods",
      "medical",
      "temperature_controlled",
      "high_priority",
    ],
    pricingMultipliers: {
      baseMultiplier: 1.14,
      perKmMultiplier: 1.08,
      dispatchMultiplier: 1.06,
    },
    mappedDroneClass: "medium_stabilized",
  },
  {
    id: "nova_thermal_large",
    platform: "nova",
    moduleName: "NOVA Thermal Large",
    shortDescription:
      "Larger insulated module for grocery, catering, and cold-chain runs.",
    maxPayloadKg: 3,
    maxDimensionsCm: { lengthCm: 35, widthCm: 28, heightCm: 18 },
    maxVolumeLiters: 14,
    temperatureProtection: "active_thermal",
    securityLevel: "secure",
    shockProtection: "stabilized",
    suitabilityTags: [
      "grocery",
      "medical",
      "same_hour",
      "temperature_controlled",
      "weather_resilient",
    ],
    pricingMultipliers: {
      baseMultiplier: 1,
      perKmMultiplier: 1,
      dispatchMultiplier: 1,
    },
    mappedDroneClass: "medium_standard",
  },
  {
    id: "nova_cargo",
    platform: "nova",
    moduleName: "NOVA Cargo",
    shortDescription:
      "Balanced cargo module for longer city routes and routine business parcels.",
    maxPayloadKg: 2.5,
    maxDimensionsCm: { lengthCm: 34, widthCm: 25, heightCm: 16 },
    maxVolumeLiters: 11,
    temperatureProtection: "passive_insulated",
    securityLevel: "standard",
    shockProtection: "standard",
    suitabilityTags: ["long_distance", "same_hour", "weather_resilient"],
    pricingMultipliers: {
      baseMultiplier: 1.12,
      perKmMultiplier: 1.14,
      dispatchMultiplier: 1.05,
    },
    mappedDroneClass: "medium_long_range",
  },
  {
    id: "origin_bulk",
    platform: "origin",
    moduleName: "ORIGIN Bulk",
    shortDescription:
      "Large-volume cargo module for bulk retail, supplies, and oversized parcels.",
    maxPayloadKg: 8,
    maxDimensionsCm: { lengthCm: 55, widthCm: 42, heightCm: 30 },
    maxVolumeLiters: 55,
    temperatureProtection: "none",
    securityLevel: "standard",
    shockProtection: "reinforced",
    suitabilityTags: [
      "heavy_payload",
      "long_distance",
      "oversized",
      "weather_resilient",
    ],
    pricingMultipliers: {
      baseMultiplier: 1.26,
      perKmMultiplier: 1.18,
      dispatchMultiplier: 1.12,
    },
    mappedDroneClass: "heavy_cargo",
  },
  {
    id: "origin_secure_plus",
    platform: "origin",
    moduleName: "ORIGIN Secure Plus",
    shortDescription:
      "Maximum secure cargo module for dense, fragile, or high-value payloads.",
    maxPayloadKg: 12,
    maxDimensionsCm: { lengthCm: 70, widthCm: 50, heightCm: 36 },
    maxVolumeLiters: 85,
    temperatureProtection: "passive_insulated",
    securityLevel: "secure_plus",
    shockProtection: "reinforced",
    suitabilityTags: [
      "fragile_goods",
      "heavy_payload",
      "oversized",
      "secure_chain",
      "weather_resilient",
    ],
    pricingMultipliers: {
      baseMultiplier: 1.48,
      perKmMultiplier: 1.32,
      dispatchMultiplier: 1.2,
    },
    mappedDroneClass: "heavy_max",
  },
] as const satisfies readonly DeliveryConfiguration[];

export const deliveryConfigurationsById = Object.fromEntries(
  deliveryConfigurations.map((configuration) => [
    configuration.id,
    configuration,
  ]),
) as unknown as Record<CargoModuleId, DeliveryConfiguration>;

export const deliveryConfigurationsByPlatform = deliveryConfigurations.reduce(
  (accumulator, configuration) => {
    accumulator[configuration.platform].push(configuration);

    return accumulator;
  },
  {
    aer: [],
    nova: [],
    origin: [],
  } as Record<DeliveryPlatformId, DeliveryConfiguration[]>,
);
