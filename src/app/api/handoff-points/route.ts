import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/api/validation";
import type { CreateDeliveryAddressField } from "@/lib/create-delivery-addresses";
import { handoffPointRequestSchema } from "@/lib/handoff-point-input-schema";
import {
  buildHandoffPointResponse,
  enrichHandoffPointNamesWithGeoapify,
  fetchGeoapifyDetailsHandoffPoints,
  fetchGeoapifyPlacesHandoffPoints,
  fetchOverpassHandoffPoints,
} from "@/lib/handoff-points";
import type { HandoffPointRequest } from "@/types/handoff-points";

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

