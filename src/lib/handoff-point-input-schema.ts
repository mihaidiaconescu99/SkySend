import { z } from "zod";

import { plainTextSchema } from "@/lib/api/input-schemas";

const geoPointSchema = z
  .object({
    latitude: z
      .number()
      .finite()
      .min(43, { message: "latitude out of Romania bounds" })
      .max(48, { message: "latitude out of Romania bounds" }),
    longitude: z
      .number()
      .finite()
      .min(20, { message: "longitude out of Romania bounds" })
      .max(30, { message: "longitude out of Romania bounds" }),
  })
  .strict();

const geocodedAddressSchema = z
  .object({
    formattedAddress: plainTextSchema(1, 500),
    location: geoPointSchema,
    city: plainTextSchema(1, 200).nullish(),
    county: plainTextSchema(1, 200).nullish(),
    country: plainTextSchema(1, 200).nullish(),
    postalCode: plainTextSchema(1, 40).nullish(),
  })
  .strict();

const handoffSuggestionSchema = z
  .object({
    id: plainTextSchema(1, 200),
    label: plainTextSchema(1, 500),
    secondaryLabel: plainTextSchema(1, 500).optional(),
    placeId: plainTextSchema(1, 200).optional(),
    resultType: plainTextSchema(1, 100).optional(),
    categories: z.array(plainTextSchema(1, 100)).max(30).optional(),
    distanceMeters: z.number().finite().nonnegative().max(1_000_000).optional(),
    geocodedAddress: geocodedAddressSchema,
  })
  .strict()
  .nullish();

export const handoffPointRequestSchema = z
  .object({
    field: z.enum(["pickup", "dropoff"]),
    address: geocodedAddressSchema,
    isAddressEligible: z.boolean(),
    suggestion: handoffSuggestionSchema,
  })
  .strict();

export type HandoffPointRequestInput = z.infer<
  typeof handoffPointRequestSchema
>;
