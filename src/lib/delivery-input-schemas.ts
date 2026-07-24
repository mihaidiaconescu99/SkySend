import { z } from "zod";

import {
  boundedJsonValueSchema,
  geoPointSchema,
  isoDateTimeSchema,
  plainTextSchema,
} from "@/lib/api/input-schemas";

const nullableText = (maxLength: number) =>
  plainTextSchema(1, maxLength).nullable();
const optionalNullableText = (maxLength: number) =>
  nullableText(maxLength).optional();
const positiveMeasurement = z.number().finite().positive().max(10_000);
const nonNegativeMetric = z.number().finite().nonnegative().max(10_000_000);

const parcelCategorySchema = z.enum([
  "documents",
  "retail",
  "food",
  "medical",
  "electronics",
  "special",
]);
const packagingSchema = z.enum([
  "soft_pouch",
  "plastic_bag",
  "boxed",
  "insulated",
  "fragile_protective",
  "heavy_duty",
]);
const parcelSizeSchema = z.enum(["extra_small", "small", "medium", "large"]);
const fragilitySchema = z.enum(["low", "moderate", "high"]);
const droneClassSchema = z.enum([
  "light_swift",
  "light_secure",
  "medium_standard",
  "medium_stabilized",
  "medium_long_range",
  "heavy_cargo",
  "heavy_max",
  "light_express",
  "standard_courier",
  "fragile_care",
  "long_range",
]);
const candidatePointTypeSchema = z.enum([
  "curbside",
  "entrance",
  "parking",
  "public_point",
  "building_side",
  "street_side",
  "storefront",
  "access",
]);
const eligibilityStateSchema = z.enum(["eligible", "review", "outside"]);
const recommendationStateSchema = z.enum([
  "recommended",
  "alternative",
  "unavailable",
]);

const geocodedAddressSchema = z
  .object({
    formattedAddress: plainTextSchema(3, 500),
    location: geoPointSchema,
    city: optionalNullableText(120),
    county: optionalNullableText(120),
    country: optionalNullableText(120),
    postalCode: optionalNullableText(32),
  })
  .strict();

const addressDraftSchema = z
  .object({
    address: plainTextSchema(0, 500),
    notes: plainTextSchema(0, 500),
    selectedAddress: geocodedAddressSchema.nullable(),
  })
  .strict();

const candidatePointSchema = z
  .object({
    id: plainTextSchema(1, 200),
    label: plainTextSchema(1, 300),
    point: geoPointSchema,
    type: candidatePointTypeSchema,
    description: plainTextSchema(0, 1_000),
    reason: plainTextSchema(0, 1_000).optional(),
    source: z
      .enum([
        "geoapify_places",
        "geoapify_details",
        "osm_overpass",
        "inferred",
      ])
      .optional(),
    confidence: z.enum(["high", "medium", "low"]).optional(),
    suitabilityScore: z.number().finite().min(0).max(100),
    eligibilityState: eligibilityStateSchema,
    eligibility: z
      .object({
        state: eligibilityStateSchema,
        message: plainTextSchema(0, 1_000),
      })
      .strict()
      .optional(),
    smartScore: z.number().finite().min(0).max(100),
    distanceFromOriginMeters: z.number().finite().nonnegative().max(1_000_000),
    recommendationState: recommendationStateSchema,
  })
  .strict();

const parcelDraftSchema = z
  .object({
    category: parcelCategorySchema,
    packaging: packagingSchema,
    approximateSize: parcelSizeSchema,
    contentDescription: plainTextSchema(0, 2_000),
    weightKg: positiveMeasurement.nullable(),
    lengthCm: positiveMeasurement.nullable(),
    widthCm: positiveMeasurement.nullable(),
    heightCm: positiveMeasurement.nullable(),
    fragilityLevel: fragilitySchema,
    recommendedDroneClass: droneClassSchema,
    valueSource: z.enum(["manual", "assistant"]),
    assistantResult: boundedJsonValueSchema().nullable().optional(),
    intelligence: boundedJsonValueSchema().nullable().optional(),
    confirmedProfile: boundedJsonValueSchema().nullable().optional(),
  })
  .strict();

export const deliveryDraftPayloadSchema = z
  .object({
    routeAddresses: z
      .object({
        pickup: addressDraftSchema,
        dropoff: addressDraftSchema,
      })
      .strict(),
    candidatePoints: z
      .object({
        pickup: z.array(candidatePointSchema).max(30),
        dropoff: z.array(candidatePointSchema).max(30),
      })
      .strict(),
    selectedCandidatePoints: z
      .object({
        pickup: candidatePointSchema.nullable(),
        dropoff: candidatePointSchema.nullable(),
      })
      .strict(),
    parcelDraft: parcelDraftSchema,
    urgency: z.enum(["standard", "priority", "critical", "scheduled"]),
    scheduledDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .or(z.literal("")),
    scheduledTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/u)
      .or(z.literal("")),
  })
  .strict();

const addressPayloadSchema = z
  .object({
    input: plainTextSchema(3, 500),
    formattedAddress: plainTextSchema(3, 500),
    notes: optionalNullableText(500),
    location: geoPointSchema,
    city: optionalNullableText(120),
    county: optionalNullableText(120),
    country: optionalNullableText(120),
    postalCode: optionalNullableText(32),
  })
  .strict();

const selectedPointSchema = z
  .object({
    id: plainTextSchema(1, 200),
    label: plainTextSchema(1, 300),
    type: candidatePointTypeSchema,
    description: plainTextSchema(0, 1_000),
    location: geoPointSchema,
    eligibilityState: eligibilityStateSchema,
    recommendationState: recommendationStateSchema,
    smartScore: z.number().finite().min(0).max(100),
    distanceFromOriginMeters: z.number().finite().nonnegative().max(1_000_000),
  })
  .strict();

const checkoutParcelSchema = parcelDraftSchema
  .extend({
    estimatedWeightRange: plainTextSchema(1, 100),
  })
  .strict();

const selectedConfigurationSchema = z
  .object({
    id: z.enum([
      "aer_express",
      "aer_secure",
      "nova_thermal_medium",
      "nova_thermal_large",
      "nova_cargo",
      "origin_bulk",
      "origin_secure_plus",
    ]),
    platform: z.enum(["aer", "nova", "origin"]),
    moduleName: plainTextSchema(1, 160),
    shortDescription: plainTextSchema(1, 500),
    mappedDroneClass: droneClassSchema,
    selectionReason: plainTextSchema(1, 1_000),
    eligibility: z
      .object({
        isEligible: z.boolean(),
        ineligibleReason: optionalNullableText(1_000),
        score: z.number().finite().min(0).max(100),
      })
      .strict(),
    capacity: z
      .object({
        maxPayloadKg: positiveMeasurement,
        maxVolumeLiters: positiveMeasurement,
        maxDimensionsCm: z
          .object({
            lengthCm: positiveMeasurement,
            widthCm: positiveMeasurement,
            heightCm: positiveMeasurement,
          })
          .strict(),
      })
      .strict(),
    protection: z
      .object({
        temperatureProtection: z.enum([
          "none",
          "passive_insulated",
          "active_thermal",
        ]),
        securityLevel: z.enum(["standard", "secure", "secure_plus"]),
        shockProtection: z.enum(["standard", "stabilized", "reinforced"]),
      })
      .strict(),
    pricingImpact: z
      .object({
        amountMinor: z.number().int().min(-100_000_000).max(100_000_000),
        currency: z.literal("RON"),
      })
      .strict(),
  })
  .strict();

export const createDeliveryPayloadSchema = z
  .object({
    userId: z.string().trim().min(1).max(200).nullable(),
    pickupAddress: addressPayloadSchema,
    dropoffAddress: addressPayloadSchema,
    selectedPickupPoint: selectedPointSchema,
    selectedDropoffPoint: selectedPointSchema,
    pickupMeetingPoints: z.array(selectedPointSchema).max(30).optional(),
    dropoffMeetingPoints: z.array(selectedPointSchema).max(30).optional(),
    parcel: checkoutParcelSchema,
    urgency: z.enum(["standard", "priority", "critical", "scheduled"]),
    scheduledAt: isoDateTimeSchema.nullable(),
    recommendedDroneClass: droneClassSchema,
    selectedDeliveryConfiguration: selectedConfigurationSchema.nullable().optional(),
    estimatedPrice: z
      .object({
        amountMinor: z.number().int().nonnegative().max(100_000_000),
        currency: z.literal("RON"),
      })
      .strict(),
    pricingSnapshot: boundedJsonValueSchema(),
    estimatedEcoMetrics: z
      .object({
        estimatedCo2SavedGrams: nonNegativeMetric,
        estimatedRoadDistanceSavedKm: nonNegativeMetric,
        estimatedEnergyUseKwh: nonNegativeMetric,
      })
      .strict(),
    estimatedEta: z
      .object({
        minMinutes: z.number().int().nonnegative().max(10_000),
        maxMinutes: z.number().int().nonnegative().max(10_000),
      })
      .strict()
      .refine((value) => value.maxMinutes >= value.minMinutes, {
        message: "invalid_eta_range",
      }),
    coverageStatus: z.enum(["ready", "inside", "review", "outside"]),
    coverageSummary: z
      .object({
        state: z.enum(["ready", "inside", "review", "outside"]),
        tone: z.enum(["neutral", "success", "warning", "destructive", "info"]),
        title: plainTextSchema(1, 300),
        description: plainTextSchema(1, 1_000),
      })
      .strict(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const checkoutDeliveryPayloadSchema = createDeliveryPayloadSchema.omit({
  userId: true,
  estimatedPrice: true,
  pricingSnapshot: true,
});

export const parcelEvaluationSnapshotSchema = z
  .object({
    category: parcelCategorySchema,
    packaging: packagingSchema,
    approximateSize: parcelSizeSchema,
    fragilityLevel: fragilitySchema,
  })
  .strict();
