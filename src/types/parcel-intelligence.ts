import type { DroneClass } from "@/types/domain";
import type { ParcelDimensions } from "@/types/drone";
import type {
  ParcelCategory,
  ParcelFragileLevel,
  ParcelPackagingType,
  ParcelSizeOption,
} from "@/types/parcel-assistant";

export type ParcelIntelligenceConfidenceLevel = "low" | "medium" | "high";

export type ParcelIntelligenceConfidenceScore = number;

export type ParcelAiImageInput = {
  id: string;
  slot: number;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  dataUrl: string;
};

export type ParcelProfileUncertainty = {
  field: "identity" | "quantity" | "object_weight" | "object_dimensions" | "parcel_weight" | "parcel_dimensions" | "packaging";
  message: string;
  severity: "low" | "medium" | "high";
};

export type ParcelTextImageContradiction = {
  field: string;
  textEvidence: string;
  imageEvidence: string;
  impact: "low" | "medium" | "high";
};

export type ProductLookupResult = {
  title: string;
  url: string;
  snippet: string;
  sourceType: "web" | "catalog";
  confidence: number;
};

export type ParcelLookupTrace = {
  queries: string[];
  results: ProductLookupResult[];
  skipped: boolean;
  reason: "no_api_key" | "no_query" | "request_failed" | "timeout" | null;
  usedInPrompt: boolean;
};

export type ParcelNaturalDescription = {
  text: string;
  locale?: string | null;
  source?: "customer" | "operator" | "repeat_delivery" | "system_prefill";
  capturedAt?: string | null;
};

export type ParcelAdvancedDetails = {
  packagingType?: ParcelPackagingType | null;
  declaredWeightKg?: number | null;
  declaredDimensionsCm?: ParcelDimensions | null;
  declaredItemCount?: number | null;
  declaredValueMinor?: number | null;
  temperatureControlled?: boolean | null;
  perishable?: boolean | null;
  sealed?: boolean | null;
  stackable?: boolean | null;
  notes?: string | null;
};

export type ParcelDetectedItem = {
  id?: string | null;
  label: string;
  quantity?: number | null;
  category?: ParcelCategory | null;
  materials?: string[];
  estimatedWeightRangeKg?: ParcelEstimatedWeightRange | null;
  estimatedDimensionsCm?: ParcelDimensions | null;
  confidenceScore?: ParcelIntelligenceConfidenceScore | null;
  evidence?: string | null;
  sourceUrls?: string[];
  lookupEvidence?: ProductLookupResult[];
  evidenceConfidence?: ParcelIntelligenceConfidenceLevel | null;
  productIdentifier?: string | null;
  brand?: string | null;
  model?: string | null;
  packagingState?: "packaged" | "unpackaged" | "unknown";
  profileSource?: "catalog" | "vision" | "text" | "local";
};

export type ParcelPackagingInference = {
  packagingType: ParcelPackagingType;
  assumption: string;
  confidenceScore: ParcelIntelligenceConfidenceScore;
  confidence: ParcelIntelligenceConfidenceLevel;
  alternatives?: Array<{
    packagingType: ParcelPackagingType;
    reason: string;
    confidenceScore: ParcelIntelligenceConfidenceScore;
  }>;
};

export type ParcelEstimatedWeightRange = {
  minKg: number;
  maxKg: number;
  midpointKg?: number | null;
  label?: string | null;
  source?: "user_declared" | "openrouter" | "local" | "operator";
};

export type ParcelEstimatedDimensions = {
  dimensionsCm: ParcelDimensions;
  volumeLiters: number;
  source?: "user_declared" | "openrouter" | "local" | "operator";
  fitNotes?: string[];
};

export type ParcelHandlingNote = {
  code:
    | "fragile"
    | "keep_upright"
    | "temperature_sensitive"
    | "sealed_required"
    | "do_not_stack"
    | "operator_review"
    | "other";
  label: string;
  details?: string | null;
};

export type ParcelWeatherSensitivity = {
  rain?: boolean;
  wind?: boolean;
  heat?: boolean;
  cold?: boolean;
  humidity?: boolean;
  notes?: string | null;
};

export type ParcelRiskFlag = {
  code:
    | "overweight"
    | "oversize"
    | "fragile"
    | "restricted_contents"
    | "weather_sensitive"
    | "low_confidence"
    | "needs_clarification"
    | "operator_review"
    | "other";
  severity: "low" | "medium" | "high";
  label: string;
  reason: string;
};

export type ParcelClarificationQuestion = {
  id: string;
  question: string;
  field:
    | "contents"
    | "category"
    | "packaging"
    | "weight"
    | "dimensions"
    | "fragility"
    | "handling"
    | "weather_sensitivity"
    | "other";
  answerType: "text" | "single_select" | "multi_select" | "number" | "boolean";
  options?: Array<{
    value: string;
    label: string;
  }>;
  required?: boolean;
  blocksConfirmation?: boolean;
  reason?: string | null;
};

export type ParcelClarificationAnswer = {
  questionId: string;
  field?: ParcelClarificationQuestion["field"];
  answer: string | number | boolean | string[];
};

export type ParcelIntelligenceEstimate = {
  naturalDescription: ParcelNaturalDescription;
  advancedDetails?: ParcelAdvancedDetails | null;
  detectedItems: ParcelDetectedItem[];
  packagingInference: ParcelPackagingInference;
  estimatedWeightRange: ParcelEstimatedWeightRange;
  estimatedDimensions: ParcelEstimatedDimensions;
  volumeLiters: number;
  category: ParcelCategory;
  approximateSize?: ParcelSizeOption | null;
  fragility: ParcelFragileLevel;
  handlingNotes: ParcelHandlingNote[];
  weatherSensitivity: ParcelWeatherSensitivity;
  riskFlags: ParcelRiskFlag[];
  confidenceScore: ParcelIntelligenceConfidenceScore;
  confidence: ParcelIntelligenceConfidenceLevel;
  clarificationQuestions: ParcelClarificationQuestion[];
  previousClarificationAnswers?: ParcelClarificationAnswer[];
  recommendedDroneClass?: DroneClass | null;
  explanation?: string | null;
  lookupTrace?: ParcelLookupTrace | null;
  objectProfiles?: ParcelDetectedItem[];
  finalParcelProfile?: {
    weightRange: ParcelEstimatedWeightRange;
    dimensions: ParcelEstimatedDimensions;
    packagingMaterialNotes: string[];
  };
  contradictions?: ParcelTextImageContradiction[];
  uncertainties?: ParcelProfileUncertainty[];
};

export type ParcelEditableConfirmation = {
  estimate: ParcelIntelligenceEstimate;
  editableFields: Array<
    | "category"
    | "packaging"
    | "weight"
    | "dimensions"
    | "fragility"
    | "handlingNotes"
    | "weatherSensitivity"
  >;
  answeredClarifications?: ParcelClarificationAnswer[];
};

export type ConfirmedParcelProfile = {
  naturalDescription: ParcelNaturalDescription;
  advancedDetails?: ParcelAdvancedDetails | null;
  detectedItems: ParcelDetectedItem[];
  packaging: ParcelPackagingType;
  packagingInference?: ParcelPackagingInference | null;
  estimatedWeightRange: ParcelEstimatedWeightRange;
  estimatedDimensions: ParcelEstimatedDimensions;
  volumeLiters: number;
  category: ParcelCategory;
  approximateSize: ParcelSizeOption;
  fragility: ParcelFragileLevel;
  handlingNotes: ParcelHandlingNote[];
  weatherSensitivity: ParcelWeatherSensitivity;
  riskFlags: ParcelRiskFlag[];
  confidenceScore: ParcelIntelligenceConfidenceScore;
  confidence: ParcelIntelligenceConfidenceLevel;
  recommendedDroneClass: DroneClass;
  confirmedAt: string;
  confirmedBy?: "customer" | "operator" | "system";
};

export type ParcelIntelligenceSnapshot = {
  status: "draft" | "needs_clarification" | "ready_for_confirmation" | "confirmed";
  estimate?: ParcelIntelligenceEstimate | null;
  confirmation?: ParcelEditableConfirmation | null;
  confirmedProfile?: ConfirmedParcelProfile | null;
};
