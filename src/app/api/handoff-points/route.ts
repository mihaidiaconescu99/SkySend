import { NextResponse } from "next/server";
import { z } from "zod";
import { plainTextSchema } from "@/lib/api/input-schemas";
import { validateRequest } from "@/lib/api/validation";
import type { CreateDeliveryAddressField } from "@/lib/create-delivery-addresses";
import {
  buildHandoffPointResponse,
  enrichHandoffPointNamesWithGeoapify,
  fetchGeoapifyDetailsHandoffPoints,
  fetchGeoapifyPlacesHandoffPoints,
  fetchOverpassHandoffPoints,
} from "@/lib/handoff-points";
import type { HandoffPointRequest } from "@/types/handoff-points";

const ROMANIA_LAT_MIN = 43;
const ROMANIA_LAT_MAX = 48;
const ROMANIA_LON_MIN = 20;
const ROMANIA_LON_MAX = 30;

const geoPointSchema = z.object({
  latitude: z
    .number()
    .finite()
    .min(ROMANIA_LAT_MIN, { message: "latitude out of Romania bounds" })
    .max(ROMANIA_LAT_MAX, { message: "latitude out of Romania bounds" }),
  longitude: z
    .number()
    .finite()
    .min(ROMANIA_LON_MIN, { message: "longitude out of Romania bounds" })
    .max(ROMANIA_LON_MAX, { message: "longitude out of Romania bounds" }),
}).strict();

const geocodedAddressSchema = z.object({
  formattedAddress: plainTextSchema(1, 500),
  location: geoPointSchema,
  city: plainTextSchema(1, 200).nullish(),
  county: plainTextSchema(1, 200).nullish(),
  country: plainTextSchema(1, 200).nullish(),
  postalCode: plainTextSchema(1, 40).nullish(),
}).strict();

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

const handoffPointRequestSchema = z.object({
  field: z.enum(["pickup", "dropoff"]),
  address: geocodedAddressSchema,
  isAddressEligible: z.boolean(),
  suggestion: handoffSuggestionSchema,
}).strict();

export type HandoffPointRequestInput = z.infer<typeof handoffPointRequestSchema>;

function getGeoapifyServerApiKey() {
  return (
    process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY?.trim() ||
    process.env.MAP_PROVIDER_SECRET_KEY?.trim() ||
    null
  );
}

export async function POST(request: Request) {

  const validation = await validateRequest(handoffPointRequestSchema, request);

  if (!validation.ok) {
    return validation.response;
  }

  const handoffRequest: HandoffPointRequest = {
    field: validation.data.field as CreateDeliveryAddressField,
    address: validation.data.address,
    isAddressEligible: validation.data.isAddressEligible,
    suggestion:
      (validation.data.suggestion as HandoffPointRequest["suggestion"]) ?? null,
  };

  const geoapifyApiKey = getGeoapifyServerApiKey();
  const providerResults = await Promise.allSettled([
    ...(geoapifyApiKey
      ? [
          fetchGeoapifyPlacesHandoffPoints(handoffRequest, geoapifyApiKey),
          fetchGeoapifyDetailsHandoffPoints(handoffRequest, geoapifyApiKey),
        ]
      : []),
    fetchOverpassHandoffPoints(handoffRequest),
  ]);
  const providerPoints = providerResults.flatMap((result) => {
    return result.status === "fulfilled" ? result.value : [];
  });

  const response = buildHandoffPointResponse(handoffRequest, providerPoints);
  const namedResponse = await enrichHandoffPointNamesWithGeoapify(
    response,
    geoapifyApiKey,
  );

  return NextResponse.json(namedResponse);
}

export { handoffPointRequestSchema };
