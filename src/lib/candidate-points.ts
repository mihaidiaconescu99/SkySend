import type { CreateDeliveryAddressField } from "@/lib/create-delivery-addresses";
import { buildInferredHandoffPoints } from "@/lib/handoff-points";
import type {
  CandidatePoint,
  CandidatePointEligibilityState,
  CandidatePointRecommendationState,
  CandidatePointType,
} from "@/types/candidate-points";
import type {
  HandoffPointRequest,
  HandoffPointResponse,
} from "@/types/handoff-points";
import type { GeocodedAddress } from "@/types/service-area";

export const candidatePointTypeLabels: Record<CandidatePointType, string> = {
  curbside: "Langa strada",
  entrance: "Langa intrare",
  parking: "Langa parcare",
  public_point: "Acces pietonal",
  building_side: "Acces pietonal",
  street_side: "Langa strada",
  storefront: "Langa intrare",
  access: "Acces pietonal",
};

export const candidatePointEligibilityLabels: Record<
  CandidatePointEligibilityState,
  string
> = {
  eligible: "Eligible",
  review: "Verificare",
  outside: "Outside area",
};

export const candidatePointRecommendationLabels: Record<
  CandidatePointRecommendationState,
  string
> = {
  recommended: "Punct recomandat",
  alternative: "Alternativa",
  unavailable: "Indisponibil",
};

export async function fetchHandoffCandidatePoints(
  request: HandoffPointRequest,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {

  const timeoutMs = options.timeoutMs ?? 15_000;
  const externalSignal = options.signal;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch("/api/handoff-points", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Handoff point request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as HandoffPointResponse;

    return payload.points;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

export function generateCandidatePointsForAddress(
  field: CreateDeliveryAddressField,
  address: GeocodedAddress,
  isAddressEligible: boolean,
): CandidatePoint[] {
  return buildInferredHandoffPoints({
    field,
    address,
    isAddressEligible,
  });
}

export function getDefaultSelectedCandidatePoint(
  points: readonly CandidatePoint[],
): CandidatePoint | null {
  return (
    points.find((point) => point.recommendationState === "recommended") ??
    points.find((point) => point.eligibilityState === "eligible") ??
    points.find((point) => point.eligibilityState === "review") ??
    null
  );
}

export function hasSelectableCandidatePoints(points: readonly CandidatePoint[]) {
  return points.some((point) => point.eligibilityState !== "outside");
}
