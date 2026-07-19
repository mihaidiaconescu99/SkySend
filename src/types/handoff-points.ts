import type { CreateDeliveryAddressField } from "@/lib/create-delivery-addresses";
import type { CandidatePoint } from "@/types/candidate-points";
import type { GeoapifyAddressSuggestion } from "@/types/geoapify";
import type { GeocodedAddress, GeoPoint } from "@/types/service-area";

export type HandoffLocationType =
  | "shopping_center"
  | "residential"
  | "store"
  | "school"
  | "office"
  | "public_area"
  | "unknown";

export type HandoffPointSource =
  | "geoapify_places"
  | "geoapify_details"
  | "osm_overpass"
  | "inferred";

export type HandoffPointConfidence = "high" | "medium" | "low";
export type HandoffCardinalDirection = "north" | "east" | "south" | "west";

export type HandoffPointEligibility = {
  state: CandidatePoint["eligibilityState"];
  message: string;
};

export type HandoffPoint = CandidatePoint & {
  source: HandoffPointSource;
  confidence: HandoffPointConfidence;
  reason: string;
  eligibility: HandoffPointEligibility;
  locationType: HandoffLocationType;
};

export type HandoffPointRequest = {
  field: CreateDeliveryAddressField;
  address: GeocodedAddress;
  isAddressEligible: boolean;
  suggestion?: GeoapifyAddressSuggestion | null;
};

export type HandoffPointResponse = {
  points: HandoffPoint[];
  locationType: HandoffLocationType;
  sourcesUsed: HandoffPointSource[];
};

export type HandoffProviderPoint = {
  label: string;
  point: GeoPoint;
  type: CandidatePoint["type"];
  source: HandoffPointSource;
  confidence: HandoffPointConfidence;
  reason: string;
  baseScore: number;
  categories?: string[];
  direction?: HandoffCardinalDirection;
  roadDistanceMeters?: number;
  roadName?: string | null;
  roadSegmentKey?: string;
  roadWayId?: string;
};
