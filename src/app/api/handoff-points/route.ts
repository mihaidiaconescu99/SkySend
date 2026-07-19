import { NextResponse } from "next/server";
import { z } from "zod";
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
});

const geocodedAddressSchema = z.object({
  formattedAddress: z.string().trim().min(1).max(500),
  location: geoPointSchema,
  city: z.string().max(200).nullish(),
  county: z.string().max(200).nullish(),
  country: z.string().max(200).nullish(),
  postalCode: z.string().max(40).nullish(),
});

const handoffSuggestionSchema = z
  .object({
    pointId: z.string().max(200).optional(),
    label: z.string().max(500).optional(),
    location: geoPointSchema.optional(),
  })
  .passthrough()
  .nullish();

const handoffPointRequestSchema = z.object({
  field: z.enum(["pickup", "dropoff"]),
  address: geocodedAddressSchema,
  isAddressEligible: z.boolean(),
  suggestion: handoffSuggestionSchema,
});

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
