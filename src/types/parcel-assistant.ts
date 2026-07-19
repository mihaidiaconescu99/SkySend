import type { DroneClass } from "@/types/domain";
import type { ParcelDimensions } from "@/types/drone";
import type {
  ConfirmedParcelProfile,
  ParcelAdvancedDetails,
  ParcelClarificationAnswer,
  ParcelClarificationQuestion,
  ParcelIntelligenceSnapshot,
  ParcelNaturalDescription,
} from "@/types/parcel-intelligence";

export type ParcelPackagingType =
  | "soft_pouch"
  | "plastic_bag"
  | "boxed"
  | "insulated"
  | "fragile_protective"
  | "heavy_duty";

export type ParcelSizeOption =
  | "extra_small"
  | "small"
  | "medium"
  | "large";

export type ParcelFragileLevel = "low" | "moderate" | "high";

export type ParcelCategory =
  | "documents"
  | "retail"
  | "food"
  | "medical"
  | "electronics"
  | "special";

export type ParcelAssistantInput = {
  contents: string;
  naturalDescription?: ParcelNaturalDescription | null;
  advancedDetails?: ParcelAdvancedDetails | null;
  previousClarificationAnswers?: ParcelClarificationAnswer[];
  category?: ParcelCategory;
  packaging: ParcelPackagingType;
  approximateSize: ParcelSizeOption;
  fragilityLevel?: ParcelFragileLevel;
};

export type ParcelAssistantResult = {
  estimatedWeightRange: string;
  estimatedWeightKg?: number | null;
  suggestedDimensionsCm?: ParcelDimensions | null;
  fragileLevel: ParcelFragileLevel;
  suggestedDroneClass: DroneClass;
  confidenceNote: string;
  clarificationQuestions?: ParcelClarificationQuestion[];
  intelligence?: ParcelIntelligenceSnapshot | null;
  confirmedProfile?: ConfirmedParcelProfile | null;
};

export type {
  ConfirmedParcelProfile,
  ParcelAdvancedDetails,
  ParcelClarificationAnswer,
  ParcelClarificationQuestion,
  ParcelIntelligenceSnapshot,
  ParcelNaturalDescription,
} from "@/types/parcel-intelligence";
