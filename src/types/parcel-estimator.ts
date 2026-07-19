import type { DroneClass } from "@/types/domain";
import type { ParcelDimensions } from "@/types/drone";
import type {
  ParcelFragileLevel,
  ParcelCategory,
  ParcelPackagingType,
  ParcelSizeOption,
} from "@/types/parcel-assistant";
import type {
  ConfirmedParcelProfile,
  ParcelAdvancedDetails,
  ParcelClarificationAnswer,
  ParcelClarificationQuestion,
  ParcelDetectedItem,
  ParcelEstimatedDimensions,
  ParcelEstimatedWeightRange,
  ParcelHandlingNote,
  ParcelAiImageInput,
  ParcelIntelligenceSnapshot,
  ParcelLookupTrace,
  ParcelNaturalDescription,
  ParcelPackagingInference,
  ParcelRiskFlag,
  ParcelWeatherSensitivity,
} from "@/types/parcel-intelligence";

export type ParcelEstimatorRequest = {
  contentDescription: string;
  naturalDescription?: ParcelNaturalDescription | null;
  advancedDetails?: ParcelAdvancedDetails | null;
  previousClarificationAnswers?: ParcelClarificationAnswer[];
  category: ParcelCategory;
  packaging: ParcelPackagingType;
  approximateSize: ParcelSizeOption;
  currentFragileLevel?: ParcelFragileLevel | null;
  images?: ParcelAiImageInput[];
};

export type ParcelEstimatorSource = "openrouter" | "local";
export type ParcelEstimatorConfidence = "low" | "medium" | "high";

export type ParcelEstimatorCorrection = {
  code: "liquid_volume" | "explicit_weight" | "physical_bounds";
  message: string;
  detectedVolumeLiters?: number | null;
  detectedVolumeLabel?: string | null;
  originalWeightRange?: ParcelEstimatedWeightRange | null;
  correctedWeightRange?: ParcelEstimatedWeightRange | null;
  confidenceAdjusted?: boolean;
};

export type ParcelEstimatorResponse = {
  source: ParcelEstimatorSource;
  detectedItems: string[];
  detectedItemsDetailed?: ParcelDetectedItem[];
  estimatedWeightMin: number;
  estimatedWeightMax: number;
  estimatedWeightRange?: ParcelEstimatedWeightRange;
  suggestedDimensionsCm?: ParcelDimensions | null;
  estimatedDimensions?: ParcelEstimatedDimensions | null;
  volumeLiters?: number | null;
  confidence: ParcelEstimatorConfidence;
  confidenceScore?: number | null;
  fragileLevel: ParcelFragileLevel;
  category?: ParcelCategory;
  materials: string[];
  packagingAssumption: string;
  packagingInference?: ParcelPackagingInference | null;
  handlingNotes?: ParcelHandlingNote[];
  weatherSensitivity?: ParcelWeatherSensitivity | null;
  riskFlags?: ParcelRiskFlag[];
  clarificationQuestions?: ParcelClarificationQuestion[];
  previousClarificationAnswers?: ParcelClarificationAnswer[];
  recommendedDroneClass: DroneClass;
  explanation: string;
  corrections?: ParcelEstimatorCorrection[];
  intelligence?: ParcelIntelligenceSnapshot | null;
  confirmedProfile?: ConfirmedParcelProfile | null;
  lookupTrace?: ParcelLookupTrace;
  imageAnalysis?: {
    analyzedImageIds: string[];
    skipped: boolean;
    reason?: string | null;
  };
  safetyNote: "Greutatea finală va fi confirmată la pickup";
};

export type ParcelEstimatorErrorResponse = {
  error: string;
  code?: "invalid_request" | "estimator_unavailable";
};
