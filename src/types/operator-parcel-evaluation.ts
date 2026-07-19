import type {
  ParcelCategory,
  ParcelFragileLevel,
  ParcelPackagingType,
  ParcelSizeOption,
} from "@/types/parcel-assistant";
import type {
  ParcelIntelligenceConfidenceLevel,
  ParcelLookupTrace,
  ProductLookupResult,
} from "@/types/parcel-intelligence";

export type OperatorParcelEvaluationStatus =
  | "in_evaluation"
  | "waiting_customer"
  | "customer_replied"
  | "finalized"
  | "closed";

export type OperatorParcelWarning =
  | "fragile"
  | "temperature"
  | "liquid"
  | "humidity"
  | "orientation";

export type OperatorParcelQuestion = {
  id: string;
  question: string;
  answer: string | null;
  askedAt: string;
  answeredAt: string | null;
  attachments?: Array<{
    id: string;
    original_name: string;
    content_type: string;
    size_bytes: number;
  }>;
};

export type OperatorParcelProfile = {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  warnings: OperatorParcelWarning[];
};

export type OperatorParcelSnapshot = {
  category: ParcelCategory;
  packaging: ParcelPackagingType;
  approximateSize: ParcelSizeOption;
  fragilityLevel: ParcelFragileLevel;
};

export type ParcelEstimateTraceSnapshot = {
  lookupTrace: ParcelLookupTrace;
  detectedItemsEvidence: Array<{
    label: string;
    sourceUrls: string[];
    lookupEvidence: ProductLookupResult[];
    evidenceConfidence: ParcelIntelligenceConfidenceLevel | null;
  }>;
  confidenceScore: number | null;
  confidence: ParcelIntelligenceConfidenceLevel | null;
  source: "openrouter" | "local";
};

export type OperatorParcelEvaluation = {
  id: string;
  sessionId: string;
  orderId: string | null;
  initialDescription: string;
  status: OperatorParcelEvaluationStatus;
  questions: OperatorParcelQuestion[];
  parcelSnapshot: OperatorParcelSnapshot;
  profile: OperatorParcelProfile | null;
  estimateTrace?: ParcelEstimateTraceSnapshot | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  appliedAt: string | null;
};
