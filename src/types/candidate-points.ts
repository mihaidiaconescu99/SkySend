import type { GeoPoint } from "@/types/service-area";

export type CandidatePointType =
  | "curbside"
  | "entrance"
  | "parking"
  | "public_point"
  | "building_side"
  | "street_side"
  | "storefront"
  | "access";

export type CandidatePointEligibilityState =
  | "eligible"
  | "review"
  | "outside";

export type CandidatePointRecommendationState =
  | "recommended"
  | "alternative"
  | "unavailable";

export type CandidatePoint = {
  id: string;
  label: string;
  point: GeoPoint;
  type: CandidatePointType;
  description: string;
  reason?: string;
  source?: "geoapify_places" | "geoapify_details" | "osm_overpass" | "inferred";
  confidence?: "high" | "medium" | "low";
  suitabilityScore: number;
  eligibilityState: CandidatePointEligibilityState;
  eligibility?: {
    state: CandidatePointEligibilityState;
    message: string;
  };
  smartScore: number;
  distanceFromOriginMeters: number;
  recommendationState: CandidatePointRecommendationState;
};
