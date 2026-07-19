import type { CandidatePointType } from "@/types/candidate-points";
import type { GeoPoint } from "@/types/service-area";

export type SavedPlaceCategory = "home" | "school" | "work" | "custom" | "recent";

export type SavedPlaceMeetingPoint = {
  id: string;
  label: string;
  type: CandidatePointType;
  description: string;
  coordinates: GeoPoint;
};

export type SavedPlace = {
  id: string;
  label: string;
  address: string;
  coordinates: GeoPoint;
  notes: string;
  category: SavedPlaceCategory;
  preferredMeetingPoint: SavedPlaceMeetingPoint | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
};

export type SavedPlaceInput = {
  label: string;
  address: string;
  coordinates: GeoPoint;
  notes?: string;
  category?: SavedPlaceCategory;
  preferredMeetingPoint?: SavedPlaceMeetingPoint | null;
};
